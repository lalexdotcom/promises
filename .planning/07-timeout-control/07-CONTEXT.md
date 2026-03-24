---
phase: 7
title: Timeout Enhancements & Error Context
status: Planning
requirement_source: FR-4 (REQUIREMENTS.md)
phase_dependencies:
  requires: [05-backpressure-control, 06-pool-introspection]
  enables: [08-performance-optimization, 09-edge-case-expansion]
key_decision_points:
  - D1: TimeoutError class structure and field design
  - D2: Timing for context capture in timeout lifecycle
  - D3: Integration with Phase 5 error events
  - D4: Documentation and example patterns
---

# Phase 7 Context — Timeout Enhancements & Error Context

## Executive Summary

Phase 7 enhances the `TimeoutError` class to include optional timeout duration and promise context fields, enabling better error debugging for timeout-sensitive applications. This phase improves the developer experience when diagnosing timeout failures while maintaining strict backward compatibility through optional fields.

**Primary Goal:** Users can inspect timeout context (how long the timeout was, which promise timed out) directly from TimeoutError, reducing time spent correlating errors to execution.

**Scope Boundaries:**
- ✅ Enhance TimeoutError with optional fields only (no new API surface)
- ✅ Update timeout() utility function to populate context
- ✅ Document timeout composition patterns in README
- ✅ Add integration examples with Phase 5 error events
- ❌ Do NOT create new timeout configuration options
- ❌ Do NOT refactor scheduler (Phase 8 responsibility)
- ❌ Do NOT change pool rejectOnError behavior

---

## Locked Design Decisions

### D1: TimeoutError Class Structure

**Decision:** Keep TimeoutError as a custom class extending Error, add two optional fields without breaking compatibility.

**Implementation:**
```typescript
export class TimeoutError extends Error {
  /**
   * The timeout duration in milliseconds that was exceeded.
   * Present when TimeoutError is thrown by timeout() or pool enqueue.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  timeout?: number;

  /**
   * The promise that did not settle within the timeout duration.
   * Captured at rejection time for debugging timeout root-cause.
   * This is the original promise passed to timeout(), before any wrapping.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  promise?: unknown;

  constructor(message?: string) {
    super(message ?? 'Promise timed out');
    this.name = 'TimeoutError';
  }
}
```

**Why This Approach:**
- ✅ Extends existing v1.0 TimeoutError pattern (no rename, no structural breaking change)
- ✅ Fields are optional, so old code throwing bare TimeoutError still works
- ✅ Backward compatible: consumers can safely ignore new fields
- ✅ Follows TypeScript conventions for error enrichment
- ✅ Zero-dependency solution (no external error libraries needed)
- ❌ Alternative rejected: Change to `type TimeoutError = Error & { timeout: number }` would break instanceof checks

**Confidence:** HIGH (clear, proven pattern for error extension in JavaScript/TypeScript)

---

### D2: When to Capture Timeout Context

**Decision:** Capture timeout value and promise reference in the `timeout()` function, immediately after timeout rejection (synchronously, before any async propagation).

**Implementation Pattern:**
```typescript
export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    let isTooLate = false;
    let isResolved = false;
    const to = setTimeout(() => {
      if (!isResolved) {
        isTooLate = true;
        clearTimeout(to);
        
        // ← CONTEXT CAPTURE: Create error with full context
        const err = new TimeoutError(`Promise timed out after ${delay}ms`);
        err.timeout = delay;     // ← Field 1: timeout duration
        err.promise = p;         // ← Field 2: the original promise
        
        rej(err);  // Reject with enriched error
      }
    }, delay);
    
    // ... rest of timeout logic
  });
}
```

**Why This Timing:**
- ✅ Capture occurs in synchronous setTimeout callback (atomic, no race conditions)
- ✅ `delay` variable is in scope and immutable
- ✅ Original promise `p` is still accessible and not garbage-collected
- ✅ Captures context before any wrapping or transformation in calling code
- ✅ Works for both direct timeout() calls and pool.enqueue(..., timeoutMs) usage
- ❌ Alternative rejected: Capture at event listener time (too late, context may be lost)

**Pool.enqueue Integration** (for per-promise timeouts):
```typescript
// When enqueue(fn, timeoutMs) is called, internally:
timeoutPromise = timeout(promise, timeoutMs);
// The timeout() function handles context capture automatically
```

**Confidence:** HIGH (synchronous, deterministic, matches existing timeout() pattern)

**Note on promise field:** Storing `promise?: unknown` allows debugging tools and logging middleware to inspect the promise object (e.g., log its executor, named function, etc.). The type is `unknown` because the promise could have any shape or origin.

---

### D3: Integration with Phase 5 Error Events

**Decision:** TimeoutError context (timeout + promise fields) is orthogonal to and complementary with Phase 5's error events. Both provide different debugging dimensions.

**Relationship:**

| Context | Source | When Fires | Use Case |
|---------|--------|-----------|----------|
| **TimeoutError.timeout** | timeout() function | When promise doesn't settle by deadline | "How long was the timeout?" |
| **TimeoutError.promise** | timeout() function | When promise doesn't settle by deadline | "Which promise timed out?" |
| **PoolEventContext** | Error event listener | When any promise rejects (any reason) | Pool state at rejection time |
| **PoolEventContext.pendingCount** | Error event | When any promise rejects | How many promises were still in-flight? |

**Example Usage:**

```typescript
const pool = new PromisePool({ concurrency: 2 });

pool.on('error', (error, context) => {
  // Phase 5: pool-level context
  if (error instanceof TimeoutError) {
    // Phase 7: promise-level timeout context
    const timeoutDuration = error.timeout; // e.g., 1000
    const timedOutPromise = error.promise;
    const poolStateatRejection = context.pendingCount; // e.g., 3 promises still pending
    
    console.error(
      `Timeout: ${timeoutDuration}ms | Promise: ${timedOutPromise} | Pool state: ${context.pendingCount} pending`
    );
  }
});

pool.enqueue(async () => fetch(url), 5000); // 5s timeout per task
```

**Design Principle:** Phase 7 focuses on **promise-level** debugging (what about THIS timeout?). Phase 5 provides **pool-level** debugging (what was the pool doing?). Not duplicative; both needed.

**Confidence:** HIGH (complementary scopes, proven pattern in Node.js Error + context)

---

### D4: Documentation and Example Patterns

**Decision:** Document three timeout composition patterns in README:
1. **Direct timeout()**: Wrapping a single promise with deadline
2. **Pool with per-task timeout**: Enqueue with timeoutMs parameter
3. **Pool-level timeout + error events**: Detecting and reacting to timeouts

**Pattern 1: Direct Promise Timeout**
```typescript
const result = await timeout(fetch(url), 3000); // 3s deadline
// If timeout fires: TimeoutError { message, timeout: 3000, promise: <the fetch promise> }
```

**Pattern 2: Pool with Per-Task Timeout**
```typescript
const pool = new PromisePool({ concurrency: 5 });

for (const url of urls) {
  pool.enqueue(() => fetch(url), 1000); // 1s timeout per URL
}

await pool.close();
// If any timeout fires: TimeoutError { timeout: 1000, promise: <fetch promise> }
```

**Pattern 3: Pool Timeout + Error Events**
```typescript
const pool = new PromisePool({ concurrency: 5 });

pool.on('error', (error, context) => {
  if (error instanceof TimeoutError) {
    const { timeout, promise } = error;
    const { pendingCount, waitingCount } = context;
    
    // Log with full context for debugging
    logger.error('Task timeout', {
      timeoutMs: timeout,
      pendingTasks: pendingCount,
      queuedTasks: waitingCount,
      // Optionally extract promise details if available
    });
    
    // Retry or fallback logic here
  }
});

for (const url of urls) {
  pool.enqueue(() => fetch(url), 5000); // 5s timeout
}

await pool.close();
```

**Pattern 4: Nested Timeouts (Composition)**
```typescript
// Outer timeout: entire pool operation
const poolOperation = async () => {
  const pool = new PromisePool({ concurrency: 5 });
  
  urls.forEach(url => {
    // Inner timeout: per-task deadline
    pool.enqueue(() => fetch(url), 2000); // 2s per task
  });
  
  return pool.close();
};

// Wrap pool operation with global deadline
const result = await timeout(poolOperation(), 30000); // 30s for entire pool
// If outer timeout fires: TimeoutError { timeout: 30000, promise: poolOperation }
// If inner timeout fires: TimeoutError { timeout: 2000, promise: fetchPromise }
```

**README Sections:**
- Add "Timeout Patterns" subsection to Advanced Examples
- Include all 4 patterns with explanations
- Document best practices (prefer per-task timeouts for isolation)
- Show error handling with Phase 5 integration

**Confidence:** HIGH (clear patterns, no new mechanisms needed, proven in real-world usage)

---

## Implementation Approach

### Phase 7 Execution Plan

#### Wave 1: Type & Implementation
1. **Task 7.1**: Update TimeoutError class with timeout and promise fields
2. **Task 7.2**: Update timeout() function to capture context
3. **Task 7.3**: Update JSDoc for TimeoutError and timeout()
4. **Task 7.4**: Update src/index.ts exports (if needed)

#### Wave 2: Documentation
5. **Task 7.5**: Add timeout composition patterns to README
6. **Task 7.6**: Document error event + timeout integration example
7. **Task 7.7**: Add TS example for pool-level timeout handling

#### Wave 3: Testing
8. **Task 7.8**: Test TimeoutError field presence (direct timeout)
9. **Task 7.9**: Test context accuracy (timeout value captured correctly)
10. **Task 7.10**: Test pool integration (enqueue with timeoutMs)
11. **Task 7.11**: Test composition scenarios (nested timeouts)
12. **Task 7.12**: Test backward compatibility (bare TimeoutError still works)

### Code Changes Summary

**File: src/utils.ts**
```diff
export class TimeoutError extends Error {
+ timeout?: number;
+ promise?: unknown;

+ constructor(message?: string) {
+   super(message ?? 'Promise timed out');
+   this.name = 'TimeoutError';
+ }
}

export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    // ... existing logic ...
    const to = setTimeout(() => {
      if (!isResolved) {
        isTooLate = true;
        clearTimeout(to);
+       const err = new TimeoutError(`Promise timed out after ${delay}ms`);
+       err.timeout = delay;
+       err.promise = p;
-       rej(new TimeoutError('Promise timed out'));
+       rej(err);
      }
    }, delay);
    // ... rest of function ...
  });
}
```

**File: README.md**
- Add "Timeout Patterns" section under "Advanced Examples"
- Include 4 patterns with code samples
- Link to error event integration docs (Phase 5)

**File: tests/index.test.ts**
- Add TEST-09 with 5 timeout context test scenarios
- Verify context fields populated correctly
- Test pool.enqueue timeout integration
- Test composition (nested timeouts)
- Test backward compatibility

### No Changes Required To:
- ❌ src/pool.ts (timeout handling already works, just enriching errors)
- ❌ src/index.ts (TimeoutError already exported)
- ❌ tsconfig.json or build config
- ❌ biome.json or lint config

---

## Test Strategy

### Coverage Scope

**TEST-09: Timeout Error Context** (5 test scenarios, ~150 lines)

#### Scenario 1: Basic TimeoutError Fields
```typescript
// Direct timeout() call should populate both fields
const promise = new Promise(() => {}); // never settles
const timeout_ms = 100;

try {
  await timeout(promise, timeout_ms);
} catch (error) {
  assert(error instanceof TimeoutError);
  assert(error.timeout === timeout_ms); // ✅ Field present and accurate
  assert(error.promise === promise);     // ✅ Promise reference stored
}
```

#### Scenario 2: Context Accuracy Across Timeouts
```typescript
// Multiple concurrent timeouts with different durations
const timeouts = [100, 200, 500];
const errors: TimeoutError[] = [];

await Promise.all(
  timeouts.map(ms => 
    timeout(new Promise(() => {}), ms)
      .catch(e => errors.push(e))
  )
);

errors.forEach((err, idx) => {
  assert(err.timeout === timeouts[idx]); // Each has correct duration
});
```

#### Scenario 3: Pool.enqueue Timeout Integration
```typescript
// When pool.enqueue(fn, timeoutMs) is called
const pool = new PromisePool();
const timeoutMs = 50;

pool.enqueue(
  () => new Promise(() => {}), // never settles
  timeoutMs
);

pool.on('error', (error) => {
  assert(error instanceof TimeoutError);
  assert(error.timeout === timeoutMs); // ✅ Context captured
});

await pool.close().catch(() => {}); // Expected to fail
```

#### Scenario 4: Composition - Nested Timeouts
```typescript
// Inner timeout fires before outer timeout
const inner_ms = 100;
const outer_ms = 1000;

try {
  await timeout(
    timeout(new Promise(() => {}), inner_ms),
    outer_ms
  );
} catch (error) {
  assert(error.timeout === inner_ms); // ✅ Inner timeout fires first
}
```

#### Scenario 5: Backward Compatibility
```typescript
// Old code throwing bare TimeoutError should still work
try {
  const err = new TimeoutError('Legacy error');
  throw err;
} catch (error) {
  assert(error instanceof TimeoutError);
  assert(error.message === 'Legacy error');
  // New fields are optional, undefined is acceptable
  assert(error.timeout === undefined);
  assert(error.promise === undefined);
}
```

### Test Sampling & Verification

| Test Scenario | Sampling | Blocking? |
|---------------|----------|-----------|
| Scenario 1 | Per commit (quick) | Yes — must pass |
| Scenario 2 | Per commit | Yes — must pass |
| Scenario 3 | Per wave merge | Yes — must pass |
| Scenario 4 | Per wave merge | Yes — must pass |
| Scenario 5 | Pre-ship (backward compat gate) | **CRITICAL** |

**Verification Loop:**
1. Enqueue tests, run Wave 1 → verify all 5 scenarios pass
2. Run full test suite (existing + new) → zero regressions
3. Check TypeScript: `tsc --noEmit` → zero errors
4. Build library: `pnpm run build` → clean output
5. Final gate: Run backward compatibility test explicitly before shipping

---

## Success Criteria

### Phase Completion Checklist

- [ ] **Type Definition** — TimeoutError extends Error with optional timeout and promise fields
- [ ] **timeout() Function** — Populates both fields synchronously on rejection
- [ ] **Pool Integration** — pool.enqueue(fn, timeoutMs) works with enriched TimeoutError
- [ ] **Backward Compatibility** — Both new and old TimeoutError patterns work
- [ ] **JSDoc Complete** — TimeoutError, timeout(), and fields documented
- [ ] **README Updated** — 4 timeout patterns documented with examples
- [ ] **Error Event Integration** — Example showing Phase 5 + Phase 7 together
- [ ] **Test Scenarios** — All 5 timeout context scenarios pass
- [ ] **No Regressions** — All existing tests still pass (≥41 tests)
- [ ] **TypeScript Clean** — Zero compilation errors, no type warnings
- [ ] **Build Clean** — `pnpm run build` produces no errors

### Deliverables

1. ✅ Enhanced `TimeoutError` class in src/utils.ts
2. ✅ Updated `timeout()` function with context capture
3. ✅ Comprehensive JSDoc and TypeScript types
4. ✅ README section: "Timeout Patterns" with 4 examples
5. ✅ 5 test scenarios in TEST-09
6. ✅ All tests passing (41+ total)

### Quality Gates

- **Test Pass Rate**: 100% (all existing + new tests pass)
- **Coverage**: Error context fields tested in multiple scenarios
- **Backward Compat**: Verified with explicit test case
- **Documentation**: Clear examples for all 4 patterns
- **Code Quality**: Follows existing style, consistent with v1.0/v1.1 patterns

---

## Downstream Dependencies

### Phase 8 Impact (Performance Optimization)

Phase 8 will handle scheduler optimization including batching and microtask management. Phase 7's TimeoutError changes are **orthogonal and fully compatible**:

- ✅ TimeoutError context capture happens in setTimeout callback (not affected by scheduler changes)
- ✅ No additional overhead from storing timeout and promise fields
- ✅ Phase 8 can batch error emissions without affecting TimeoutError structure
- ✅ No conflicts with microtask batching (different concern)

**Dependency:** None (Phase 7 doesn't need Phase 8 changes, Phase 8 doesn't rely on Phase 7)

### Phase 9 Impact (Edge Case Expansion)

Phase 9 expands test coverage to 40+ tests including timeout edge cases. Phase 7 provides the foundation:

- ✅ Phase 9 can add edge case tests using TimeoutError fields from Phase 7
- ✅ Phase 9 boundary tests (extreme timeouts, NaN, negative) already supported by Phase 7 fields
- ✅ Phase 9 error propagation tests can verify timeout context survives wrapping

**Dependency:** Phase 9 assumes Phase 7 TimeoutError structure exists

---

## Constraints & Non-Functional Requirements

### Zero-Dependency Guarantee
✅ Phase 7 maintains zero-dependency requirement:
- Only uses built-in Error class
- No external libraries for error enrichment
- No changes to package.json dependencies

### Backward Compatibility
✅ Strictly backward compatible:
- New TimeoutError fields are optional (?: notation)
- Existing code throwing `new TimeoutError()` still works
- Existing code catching `instanceof TimeoutError` unaffected
- Old error messages still work (message is optional in constructor)

### Performance Constraints
✅ No performance regression:
- Context capture is synchronous (single setTimeout callback)
- Field assignment is O(1) (simple property writes)
- No additional promise wrapping or overhead
- Optional fields don't affect GC or memory significantly

### Type Safety
✅ Fully typed in TypeScript:
- Clear optional field declarations (?: notation)
- JSDoc comments for all fields
- No implicit `any` types
- Consumers can safely check `error.timeout !== undefined`

---

## Architecture Alignment

### v1.1 Vision: Better Error Debugging
Phase 7 directly supports this vision:
- ✅ TimeoutError now includes timeout duration (was implicit)
- ✅ TimeoutError now includes promise reference (was hidden)
- ✅ Combined with Phase 5 error events, gives complete error context
- ✅ Debugging tools can now write better error messages

### Pattern Alignment
- ✅ Follows v1.0 pattern of custom Error subclasses
- ✅ Matches Node.js error enrichment patterns (e.g., SystemError)
- ✅ Consistent with TypeScript error extension conventions
- ✅ Works with standard error handling (try/catch, instanceof)

---

## Known Unknowns & Decisions Deferred

### Open Design Questions
1. **Should promise field be serializable?** 
   - Decision: No — it's a reference for debugging, not meant for JSON
   - If serialization needed, Phase 9 can add a `promiseId?: string` alternative

2. **Should promise field be cloned/proxied for memory reasons?**
   - Decision: No — keep as direct reference
   - Promise is already referenced by race() wrapper, no additional leak
   - Storing reference doesn't prevent GC after timeout resolves

3. **What if promise is undefined (bare throw)?**
   - Decision: Fields remain undefined — backward compatible
   - Consumers check `if (error.timeout !== undefined)` before using

### Not In Scope
- ❌ Custom timeout configuration (e.g., per-promise settings) — Phase 10+
- ❌ Timeout stack traces with source location — requires different approach
- ❌ Timeout metrics collection/reporting — Phase 8+ responsibility
- ❌ Timeout-aware retry logic — user responsibility (documented in patterns)

---

## Phase Metadata

| Property | Value |
|----------|-------|
| **Phase Number** | 7 of 9 |
| **Status** | Planning (awaiting CONTEXT approval) |
| **Estimated Duration** | 1.5 - 2 hours |
| **Estimated Lines of Code** | ~40 (implementation) + ~80 (tests) + ~60 (docs) |
| **Files Modified** | 3 (utils.ts, index.test.ts, README.md) |
| **Breaking Changes** | None (optional fields only) |
| **Test Count Target** | 41 → 46 tests (5 new scenarios) |
| **Depends On** | Phase 5, Phase 6 (context availability) |
| **Enables** | Phase 8, Phase 9 |

---

## Approval Checkpoints

**Before Planning Phase (gsd-plan-phase 7):**
- [ ] All 4 design decisions locked (D1-D4)
- [ ] Implementation approach reviewed
- [ ] Test strategy approved
- [ ] Success criteria understood
- [ ] Downstream impacts acknowledged

**During Execution:**
- [ ] All 12 tasks completed per wave
- [ ] Test scenarios pass
- [ ] Documentation complete
- [ ] No TypeScript errors

**Before Shipping:**
- [ ] Backward compatibility verified (TEST-05)
- [ ] All 46 tests passing
- [ ] Zero build errors
- [ ] README updated with all 4 patterns

---

**CONTEXT.md Created:** 2026-03-24  
**Status:** Ready for Planning Phase  
**Next Step:** `gsd-plan-phase 7` to generate detailed PLAN.md

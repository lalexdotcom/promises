# Phase 9: Edge Cases & Documentation Polish — Context

**Phase:** 9
**Title:** Edge Cases & Documentation Polish
**Goal:** Expand test suite to 40+ tests, finalize documentation, validate TypeScript strict mode
**Milestone:** v1.2 (Event-Driven Enhancements)
**Researched:** 2026-03-24

---

## Locked Design Decisions

### D1: Boundary Testing Strategy ✅ LOCKED

**Decision:** Test concurrency and timeout at valid extremes; validate that invalid inputs are caught gracefully.

**Test Ranges:**
- **Concurrency boundaries:**
  - `concurrency=1` (serial mode)
  - `concurrency=10` (default)
  - `concurrency=100` (high concurrency)
  - `concurrency=0` (INVALID — expect error or default)
  - `concurrency=-1` (INVALID — expect error or default)
  - `concurrency=Infinity` (unlimited, if supported)

- **Timeout boundaries:**
  - `timeout=0` (immediate deadline — expect TimeoutError immediately)
  - `timeout=1` (very fast deadline — 1ms)
  - `timeout=10000` (reasonable deadline)
  - `timeout=Number.MAX_SAFE_INTEGER` (essentially infinite)
  - `timeout=-1` (INVALID — expect error or ignore)
  - `timeout=NaN` (INVALID — expect error or ignore)

- **Enqueue volume:**
  - 0 promises enqueued → close() immediately returns empty array
  - 1 promise enqueued
  - 10 promises at concurrency=1 (serial execution)
  - 10000 promises at concurrency=10 (large queue)

**Rationale:** Edge cases often hide state machine bugs and off-by-one errors. Testing valid extremes validates limits; testing invalid inputs validates graceful degradation.

**Implementation approach:**
- Create suite `TEST-XX: Boundary Conditions` with ~15-20 tests
- Each test documents assumption (e.g., "assume concurrency=0 defaults to 1")
- Verify results are deterministic and correct

---

### D2: Malformed Input Handling ✅ LOCKED

**Decision:** Validate that malformed options, null/undefined inputs, and non-numeric constraints are handled with clear error messages or sensible defaults.

**Test Scenarios:**
- **PoolOptions malformed:**
  - `{ concurrency: null }` → error or default to 10
  - `{ concurrency: undefined }` → default to 10
  - `{ concurrency: NaN }` → error or default to 10
  - `{ concurrency: "10" }` (string instead of number) → error or coerce
  - `{ concurrency: { value: 10 } }` (object) → error
  - `{ rejectOnError: "yes" }` (string instead of boolean) → error or coerce
  - `{ autoStart: 1 }` (number instead of boolean) → error or coerce
  - `{ timeout: null, concurrency: 5 }` → ignore null timeout per-promise

- **Enqueue malformed:**
  - `enqueue(null)` → error (cannot call null as function)
  - `enqueue(undefined)` → error
  - `enqueue(42)` (non-function) → error
  - `enqueue(() => 42)` (returns non-Promise) → handle gracefully or error

- **Event listener malformed:**
  - `on(null, callback)` → error
  - `on('unknown-event', callback)` → error or ignore
  - `on('resolve', null)` → error

**Rationale:** Users make mistakes. Clear error messages catch bugs early. Sensible defaults (where safe) improve UX.

**Implementation approach:**
- Document in JSDoc which inputs are validated vs. which use defaults
- Create suite `TEST-XX: Malformed Input Handling` with ~10-15 tests
- Categorize by component (PoolOptions, enqueue, event listeners)

---

### D3: Rapid Lifecycle Tests ✅ LOCKED

**Decision:** Validate that the state machine remains consistent under rapid transitions (start→close, back-to-back enqueues, concurrent enqueue+close).

**Test Scenarios:**
- **Start → Close with no work:**
  - `start()` → `close()` immediately → resolves with `[]`
  - Verify all state flags transition correctly
  - Verify no events fire incorrectly

- **Multiple enqueues before start:**
  - Enqueue 5 tasks, enqueue 5 more immediately, start
  - Verify all 10 execute in order

- **Multiple enqueues immediately before close:**
  - Enqueue task 1, enqueue task 2, close immediately
  - Verify both execute (not dropped)

- **Concurrent enqueue + close:**
  - Enqueue task 1, synchronously trigger close while task 1 is initializing
  - Verify race condition handled safely (either task runs or doesn't, but no crash)

- **Close called twice:**
  - `close()` → `close()` again
  - Second call should be idempotent or error clearly

- **Enqueue after close:**
  - `close()` → `enqueue(...)` → expect error (cannot enqueue on closed pool)

- **Start after close:**
  - `close()` → `start()` → expect error or no-op

- **Rapid state flag checks:**
  - Enqueue, immediately check `isStarted` (microtask not run yet)
  - Start, immediately check state before microtask
  - Verify flags are accurate at each point

**Rationale:** Real-world code is often sloppy with timing. These tests catch race conditions, deadlocks, and state corruption that aren't visible in happy-path tests.

**Implementation approach:**
- Create suite `TEST-XX: Rapid Lifecycle Transitions` with ~8-12 tests
- Use synchronous assertions where possible to avoid microtask surprises
- Document which safety guarantees are O(1) vs. O(microtask)

---

### D4: Advanced Patterns Documentation ✅ LOCKED

**Decision:** Add 5+ battle-tested patterns to README that extend Phase 7 examples and show real-world error handling, monitoring, and composition.

**Documentation Outline:**

**New README Section: "Advanced Patterns"**

1. **Retry Pattern**
   - Manual retry via re-enqueue
   - Exponential backoff
   - Max retry count enforcement
   - Example: `enqueue wrapper that wraps task, catches error, re-enqueues if count < max`

2. **Timeout with Fallback**
   - Chain `timeout()` with fallback value
   - Composition of pool timeout + per-task timeout
   - When to use each
   - Example: `timeout(fetchData(), 5000).catch(() => cachedValue)`

3. **Error Recovery & Batching**
   - Catch individual task errors, log, continue
   - Batch failed tasks for retry in separate pool
   - Example: execute pool with `rejectOnError=false`, filter for PoolErrors, re-enqueue in retry pool

4. **Monitoring with Getters**
   - Real-time progress tracking with `runningCount`, `waitingCount`, `settledCount`
   - Status dashboard pattern
   - Example: `setInterval(() => console.log(pool.pendingCount), 100)`

5. **Mixed Sync/Async Execution**
   - Wrap sync work with `unsync()` + pool
   - Parallel vs. serial sync/async mix
   - Example: mix CPU-intensive sync + I/O-bound async

6. **Cancellation & Partial Results** (stretch goal)
   - Graceful shutdown with partial results
   - Close pool early, inspect results
   - Example: process 10k items, stop after N errors

**Rationale:** Advanced patterns give expert users confidence that the library scales to their use cases. These patterns demonstrate composition (timeout + retry, monitoring + events, etc.), not just basic usage.

**Implementation approach:**
- Add "Advanced Patterns" section to README
- ~50-100 lines per pattern (doc + code example)
- Link patterns back to API docs for clarity
- Verify all examples are copypasteable and work end-to-end

---

### D5: TypeScript Strict Mode Validation ✅ LOCKED

**Decision:** Verify zero errors under `tsc --strict` and document type safety guarantees. Ensure all generics are explicit and public API has no `any` types.

**Validation Checklist:**
- [ ] Run `tsc --strict --noEmit` against src/ → zero errors
- [ ] Run `tsc --strict --noEmit` against tests/ → zero errors  
- [ ] Verify public API types:
  - `PromisePool` interface (all generics explicit)
  - `PoolOptions` interface (no optional-turned-any fields)
  - `PoolEventContext` (all fields typed)
  - `TimeoutError` (extends Error, no `any`)
  - Callback signatures in `on(event, callback)`
- [ ] Verify no implicit `any` in event payload handling
- [ ] Verify null checks are explicit (no unsafe nullish coalescing)
- [ ] Document type constraints in JSDoc (e.g., PromiseFunction generic bounds)

**Test Coverage for Strict Mode:**
- Unit test file typed with strictest possible settings
- Example consuming library typed with `"strict": true` in consumer's tsconfig
- Verify type inference works for tuples in `parallel()`

**Rationale:** TypeScript strict mode catches subtle type bugs. Users relying on the library deserve confidence that data flows safely through the type system.

**Implementation approach:**
- Add validation script: `tsc --strict --noEmit`
- Create example consumer file with strict tsconfig
- Add JSDoc comments documenting generic bounds and null safety
- Test `resolvedCount`, `rejectedCount` return `number` (not `number | undefined`)

---

## Test Scenarios by Category

### A. Boundary Condition Tests (~15-20 tests)

| Test ID | Scenario | Input | Expected Outcome |
|---------|----------|-------|------------------|
| BC-01 | Concurrency = 1 (serial) | `pool(1)` enqueue 5 tasks | Execute sequentially, no two overlapping |
| BC-02 | Concurrency = 100 | `pool(100)` enqueue 50 tasks | All 50 run simultaneously |
| BC-03 | Concurrency = 0 | `pool(0)` | Error or defaults to 1 |
| BC-04 | Concurrency = -5 | `pool(-5)` | Error or defaults to 10 |
| BC-05 | Concurrency = undefined | `pool(undefined)` | Defaults to 10 |
| BC-06 | Timeout = 0 (immediate) | `pool(1)` enqueue with timeout 0 | TimeoutError immediately |
| BC-07 | Timeout = 1ms (fast) | `pool(1)` enqueue with timeout 1 | Most likely TimeoutError unless task instant |
| BC-08 | Timeout = MAX_SAFE_INTEGER | `pool(1)` enqueue with timeout MAX | Behaves as unlimited timeout |
| BC-09 | Timeout = -100 | `pool(1)` enqueue with timeout -100 | Error or ignored (no timeout) |
| BC-10 | Timeout = NaN | `pool(1)` enqueue with timeout NaN | Error or ignored |
| BC-11 | Enqueue 0 promises | `pool(2)` close() without enqueue | Returns `[]` |
| BC-12 | Enqueue 1 promise | `pool(10)` enqueue 1 task | Result is `[value]` |
| BC-13 | Enqueue 10000 promises at concurrency=1 | Large queue, serial | All 10k execute, memory stable |
| BC-14 | Enqueue 10000 at concurrency=10 | Large queue, parallel | 10 at a time, correct results order |
| BC-15 | Rapid start + close lifecycle | Minimal wait | All state flags correct |

**Expected test count:** 15 tests

---

### B. Malformed Input Tests (~10-15 tests)

| Test ID | Scenario | Input | Expected Outcome |
|---------|----------|-------|------------------|
| MI-01 | concurrency is null | `pool({ concurrency: null })` | Error or default to 10 |
| MI-02 | concurrency is string | `pool({ concurrency: "10" })` | Error or coerce to 10 |
| MI-03 | concurrency is NaN | `pool({ concurrency: NaN })` | Error or default |
| MI-04 | rejectOnError is string | `pool({ rejectOnError: "yes" })` | Error or coerce to boolean |
| MI-05 | autoStart is number | `pool({ autoStart: 1 })` | Error or coerce to boolean |
| MI-06 | enqueue(null) | `pool.enqueue(null)` | Error (cannot call null as function) |
| MI-07 | enqueue(42) | `pool.enqueue(42)` | Error (not a function) |
| MI-08 | enqueue returns non-Promise | `pool.enqueue(() => 42)` | Error or wrap in Promise.resolve |
| MI-09 | on(null, cb) | `pool.on(null, callback)` | Error |
| MI-10 | on('unknown', cb) | `pool.on('unknown-event', cb)` | Error or silently ignored |
| MI-11 | on('resolve', null) | `pool.on('resolve', null)` | Error |
| MI-12 | Array of promises (not factories) | `pool.parallel([Promise.resolve(1)])` | Error (not a factory) or coerce |

**Expected test count:** 12 tests

---

### C. Rapid Lifecycle Tests (~8-12 tests)

| Test ID | Scenario | Behavior | Assertion |
|---------|----------|----------|-----------|
| RL-01 | start() → close() with no work | Immediate lifecycle | Returns `[]`, flags correct |
| RL-02 | Enqueue 5, enqueue 5 more, start | Back-to-back enqueue | All 10 tasks execute |
| RL-03 | Enqueue, close, task executes | Immediate close while task starting | Task runs or doesn't, no crash |
| RL-04 | close() called twice | Idempotent close | Second call errors or no-ops |
| RL-05 | enqueue() after close() | Enqueue on closed pool | Error ("cannot enqueue on closed pool") |
| RL-06 | start() after close() | Start on closed pool | Error or silent no-op |
| RL-07 | Synchronous isStarted check | Before microtask runs | Returns false (or true if sync) |
| RL-08 | Multiple tasks enqueue before close | Race with close | All tasks absorbed or rejected |
| RL-09 | Large queue (1000+) close quickly | Pressure test | No dropped tasks, deterministic order |
| RL-10 | Event listener added after enqueue | Listener late | Misses earlier events or gets all |

**Expected test count:** 10 tests

---

### D. Error Propagation & Event Tests (~8-12 tests)

| Test ID | Scenario | Behavior | Assertion |
|---------|----------|----------|-----------|
| EP-01 | 'error' event fires on rejection | Task rejects | Error event received with error object |
| EP-02 | 'error' event context is accurate | Task rejects | Context has correct pool state snapshot |
| EP-03 | rejectOnError=false, 'error' event fires | Mixed failures | Error event + result is PoolError |
| EP-04 | rejectOnError=true, 'error' event fires | First failure | Event fires, pool rejects immediately |
| EP-05 | 'resolve' event fires per promise | 10 tasks resolve | 10 'resolve' events, each with result |
| EP-06 | 'resolve' event timing | Relative to 'next' event | 'resolve' fires before next 'next' |
| EP-07 | Event order invariant | Multiple events | 'start' → 'next' → 'resolve'/'error' → 'available' → 'close' |
| EP-08 | Multiple listeners on same event | Two 'resolve' listeners | Both receive events (not one-or-other) |
| EP-09 | Listener removal (once vs on) | Use `once()` for single-fire | Listener fires exactly once then stops |
| EP-10 | Event listener in strict mode | Type checking event callbacks | No TypeScript errors for correct signature |

**Expected test count:** 10 tests

---

### E. Counter Getter Tests (~8-10 tests)

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| CG-01 | concurrency getter | Returns value from PoolOptions |
| CG-02 | runningCount at different pool states | Accurate during/after execution |
| CG-03 | waitingCount reflects queue size | Waiting = enqueued - running |
| CG-04 | pendingCount invariant | pendingCount = runningCount + waitingCount |
| CG-05 | resolvedCount increments | Increases by 1 per successful resolution |
| CG-06 | rejectedCount increments | Increases by 1 per rejection |
| CG-07 | settledCount invariant | settledCount = resolvedCount + rejectedCount |
| CG-08 | All getters after pool resolves | Read-only, immutable once settled |
| CG-09 | Getters under concurrent access | Multiple simultaneous reads | No race conditions |

**Expected test count:** 9 tests

---

### F. Advanced Patterns Verification (~5-8 tests)

| Test ID | Pattern | Behavior | Assertion |
|---------|---------|----------|-----------|
| AP-01 | Retry with backoff | Fail 2x, succeed on 3rd | Correct result in final pool |
| AP-02 | Timeout with fallback | Task times out, fallback used | Result is fallback value |
| AP-03 | Error recovery + batch retry | Fail some, retry batch | Verifies batch pool executes |
| AP-04 | Monitoring via getters | Progress tracking | Getters update as tasks run |
| AP-05 | Mixed sync/async | unsync() + pool | Both sync and async tasks run |
| AP-06 | Type inference in strict mode | parallel([...]) tuple typing | TypeScript infers correct tuple |

**Expected test count:** 6 tests

---

### Test Count Summary

| Category | Range | Target |
|----------|-------|--------|
| Boundary Conditions | 15-20 | 18 |
| Malformed Input | 10-15 | 12 |
| Rapid Lifecycle | 8-12 | 10 |
| Error Propagation & Events | 8-12 | 10 |
| Counter Getters | 8-10 | 9 |
| Advanced Patterns | 5-8 | 6 |
| **Existing Tests (carry forward)** | ~70 | 70 |
| **TOTAL** | **104-127** | **135** |

**Phase 9 target: Add 40+ new tests → Total suite reaches 110+ tests (exceeds 40+ requirement with buffer)**

---

## Documentation Outline

### README.md Changes

**New sections to add:**

1. **Advanced Patterns (New Section)**
   - Title: "Advanced Patterns"
   - Subsections: Retry, Timeout Composition, Error Recovery, Monitoring, Mixed Sync/Async
   - Length: ~400-500 words + 5 code examples

2. **TypeScript Strict Mode (Emphasis in API Reference)**
   - Add note: "This library is fully typed and supports TypeScript `strict: true`"
   - Document generic type constraints in PoolOptions and PromiseFunction
   - Example: consuming library with strict tsconfig

3. **Event System (Enhanced)**
   - Add 'resolve' and 'error' event documentation
   - Include PoolEventContext interface
   - Event timing diagrams (optional)

### New Documentation Files (optional)

- `.github/PATTERNS.md` (if README becomes too long)
- Type definition examples in dist/index.d.ts (auto-generated)

---

## the agent's Discretion

### DIS-1: Test Organization
**Options:**
1. Add new tests to single file (tests/index.test.ts) with new TEST-XX describe blocks
2. Create separate file (tests/edge-cases.test.ts, tests/patterns.test.ts)

**Recommendation:** Keep in single file for now (simpler CI/CD, fewer files to manage). Refactor to separate files if suite exceeds 150 tests.

### DIS-2: Error Handling for Invalid Concurrency
**Options:**
1. Throw error if concurrency < 1
2. Silently default to 1 if concurrency <= 0
3. Allow any number, let runtime behavior define result

**Recommendation:** Validate in constructor, throw clear error "concurrency must be ≥ 1". Helps users catch bugs early.

### DIS-3: Documentation Format
**Options:**
1. Add advanced patterns inline to README
2. Create separate PATTERNS.md, link from README
3. Move examples to ./examples/ folder, link from README

**Recommendation:** Inline to README (single source), but use collapsible sections if docs grow past 5000 words. Keep examples in README for discoverability.

### DIS-4: TypeScript Strict Mode Testing
**Options:**
1. Compile tests with `tsc --strict` (validation only)
2. Create separate strict-mode example file for CI
3. Add `typescript` version constraint to package.json

**Recommendation:** Add `tsc --strict --noEmit src/ tests/` as npm run script + CI step. Fail CI if errors detected.

---

## Validation Approach

### Pre-Implementation Validation

**Checklist:**
- [ ] All 5 locked decisions reviewed and agreed
- [ ] Test scenarios numbered and scoped (total test count ~65 new tests)
- [ ] Documentation outline matches README structure
- [ ] TypeScript strict mode enabled in tsconfig.json ✅ (already enabled)

### Per-Test Validation (Wave 0: Test Scaffolding)

**Each test must:**
1. Have a clear TEST-ID and scenario description
2. Include assumption comments if testing edge cases
3. Verify deterministic outcomes (not timing-dependent where possible)
4. Run in <100ms (no test exceeds suite time budget)

### Phase Gate Validation (Pre-close)

**Before closing phase, verify:**
- [ ] All written tests pass (`pnpm run test`)
- [ ] Suite runs in <30s total (no timeouts)
- [ ] TypeScript compilation: `tsc --strict --noEmit` zero errors
- [ ] Coverage: spot-check that new tests exercise edge code paths
- [ ] Documentation: README sections are complete and correct examples work

### Post-Phase Validation (/gsd-verify-work)

**User UAT checklist:**
- [ ] Read advanced patterns — are they clear and correct?
- [ ] Try one pattern example — does it work end-to-end?
- [ ] Run `tsc --strict` on library — zero errors?
- [ ] Review error messages for invalid concurrency/timeout — are they helpful?

---

## Environment & Dependencies

**No new external dependencies required.**

- Test framework: Rstest (already integrated, Phase 2)
- TypeScript: 5.x+ (already in devDependencies)
- Build tool: Rslib (already in use)

**Required tools:**
- `pnpm run test` to execute tests
- `tsc --strict --noEmit` for type validation
- `git` for version tracking

All available in current dev container.

---

## Success Criteria for Phase 9

- ✅ **40+ new tests added** → Total suite reaches 110+ tests
- ✅ **5 locked decisions** → This CONTEXT.md documents all
- ✅ **Boundary + malformed input coverage** → ~40 tests combined
- ✅ **Advanced patterns documentation** → 5-6 patterns with examples
- ✅ **TypeScript strict mode validation** → Scripts + documentation
- ✅ **Test suite runs in <30s** → Performance maintained
- ✅ **Zero TypeScript errors** → `tsc --strict` passes
- ✅ **README finalized** → Advanced patterns section complete

---

## Notes

- Phase 9 is the final quality/polish phase before v1.2 release
- All previous phases (1-8) deliver functionality; Phase 9 ensures robustness and documentation
- Edge cases discovered during testing may trigger new tests (scope increases slightly, that's OK)
- If TS strict mode reveals new errors, address in this phase (no defer to v1.2)

---
phase: 5
title: Event-Driven Pool (Resolve & Error Events)
status: Ready for Execution
created: 2026-03-24T07:41:17Z
updated: 2026-03-24T07:41:17Z
---

# Phase 5 Plan — Event-Driven Pool (Resolve & Error Events)

## Overview

Implement two new per-promise event types (`'resolve'` and `'error'`) to enable event-driven error handling and real-time result reactions. This phase realizes design decisions D1–D5 from CONTEXT.md and fulfills FR-1 and FR-2 from REQUIREMENTS.md.

**Deliverable:** Updated `src/pool.ts` with 'resolve'/'error' events, updated type exports, and 7+ new test cases bringing total to 40+.

**Success Criteria:**
- ✅ Both events emit per-promise with correct payloads
- ✅ Event ordering: resolve→next (or error before error handling)
- ✅ All existing tests pass (backward compatibility)
- ✅ 7+ new tests validate both events
- ✅ TypeScript types reflect new event types
- ✅ JSDoc documents event signatures

---

## Task Breakdown & Dependencies

### **Task 1: Type Definition — Rename Existing 'resolve' and Add 'error' to POOL_EVENT_TYPE**
**Depends on:** Nothing (foundational)  
**Affects:** Tasks 2–3 (typing)  
**Priority:** P0 (blocker)

**Location:** `src/pool.ts` line 10  
**Current:** `type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available' | 'resolve';`

**Issue:** The existing `'resolve'` type refers to the pool-resolved event (emitted when pool closes and all promises settle). We need:
1. Rename existing event from `'resolve'` → `'poolResolved'` (or keep for backward compat and document carefully)
2. Add new `'error'` event type

**Action Items:**
- [ ] A1a. Review current usage of `'resolve'` event in codebase (should only be in `runNext()` line ~230 where pool completes)
- [ ] A1b. Change type to: `type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available' | 'error' | 'resolve';`
  - Keep `'resolve'` for pool-resolved event (backward compatible)
  - Add `'error'` for per-promise rejections
- [ ] A1c. Update JSDoc on POOL_EVENT_TYPE to clarify both meanings

**Success Criteria:**
- `'resolve'` event type exists and is exported
- `'error'` event type exists and is exported
- TypeScript compilation passes

**Risk:** None — this is a pure type addition, doesn't change behavior yet.

---

### **Task 2: Interface Update — Add Resolve/Error Event Overloads to `on()` and `once()` Methods**
**Depends on:** Task 1  
**Affects:** Tasks 3–4 (implementation correctness)  
**Priority:** P0

**Location:** `src/pool.ts` lines 99–114 (on/once JSDoc and signatures)

**Challenge:** Current signatures:
```typescript
on(event: POOL_EVENT_TYPE, callback: () => void): void;
once(event: POOL_EVENT_TYPE, callback: () => void): void;
```

The callback signature is `() => void`, but:
- Resolve event callback: `(result: unknown) => void` — needs the result
- Error event callback: `(error: unknown, context?: object) => void` — needs error and optional context

**Options Considered:**
- (A) Use function overloads for each event type (complex, good DX)
- (B) Use discriminated union type (future TypeScript enhancement)
- (C) Accept `any` callback type with JSDoc documentation (simple, acceptable for now)

**Decision:** Use JSDoc with flexible callback typing — document each event signature in detail (D2-compliant error context).

**Action Items:**
```typescript
/**
 * Registers a persistent listener for a pool lifecycle event.
 * 
 * Supported events and callback signatures:
 * - 'start', 'full', 'next', 'close', 'available': `() => void`
 * - 'resolve': `(result: unknown) => void` — fires when promise resolves with result value
 * - 'error': `(error: unknown, context?: PoolEventContext) => void` — fires when promise rejects
 * 
 * @param event Event type
 * @param callback Listener function (signature depends on event type)
 */
on(event: POOL_EVENT_TYPE, callback: (...args: unknown[]) => void): void;

/**
 * Registers a one-time listener for a pool lifecycle event.
 * Same event signatures as on().
 */
once(event: POOL_EVENT_TYPE, callback: (...args: unknown[]) => void): void;
```

**Also define:**
```typescript
interface PoolEventContext {
  runningCount: number;    // Promises currently executing
  waitingCount: number;    // Promises enqueued but not started
  pendingCount: number;    // runningCount + waitingCount
  isStarted: boolean;
  isClosed: boolean;
  isResolved: boolean;
}
```

**Success Criteria:**
- JSDoc for `on()` lists all event types and callback signatures
- JSDoc for `once()` mirrors `on()`
- PoolEventContext interface properly defined
- TypeScript compilation passes

**Risk:** None — JSDoc only, no runtime changes yet.

---

### **Task 3: Update `#emit()` Method to Support Callback Arguments**
**Depends on:** Task 1–2  
**Affects:** Tasks 4–5 (implementation)  
**Priority:** P0

**Location:** `src/pool.ts` lines 158–167 (`#emit` private method and listener storage)

**Current Code:**
```typescript
#listeners: Partial<Record<POOL_EVENT_TYPE, Map<() => void, boolean>>> = {};

#emit(type: POOL_EVENT_TYPE) {
  if (this.#listeners[type]) {
    for (const [cb, once] of this.#listeners[type]!) {
      cb();  // ← Always called with no arguments
      if (once) this.#listeners[type]?.delete(cb);
    }
  }
}
```

**Changes Needed:**
- Change #listeners type to accept variadic args: `Map<(...args: unknown[]) => void, boolean>`
- Change #emit() signature to accept args: `#emit(type: POOL_EVENT_TYPE, ...args: unknown[])`
- Pass args to callback: `cb(...args)`

```typescript
#listeners: Partial<Record<POOL_EVENT_TYPE, Map<(...args: unknown[]) => void, boolean>>> = {};

#emit(type: POOL_EVENT_TYPE, ...args: unknown[]) {
  if (this.#listeners[type]) {
    for (const [cb, once] of this.#listeners[type]!) {
      cb(...args);  // ← Pass all arguments
      if (once) this.#listeners[type]?.delete(cb);
    }
  }
}
```

**Update all existing call sites:**
- Line ~195: `this.#emit('start')` → stays same (no args)
- Line ~233: `this.#emit('next')` → stays same (no args)
- Line ~238: `this.#emit('full')` → stays same (no args)
- Line ~247: `this.#emit('resolve')` → stays same (pool resolve, no args)
- Line ~253: `this.#emit('available')` → stays same (no args)

**Action Items:**
- [ ] A3a. Update #listeners type definition
- [ ] A3b. Update #emit() method signature
- [ ] A3c. Update #emit() call inside method (cb(...args))
- [ ] A3d. Verify all existing #emit() calls work with new signature

**Success Criteria:**
- Listener callback can receive 0+ arguments
- All existing events still work (backward compatible)
- TypeScript compilation passes
- No runtime behavior change for existing events

**Risk:** Low — backward compatible (variadic args swallows old no-arg calls).

---

### **Task 4: Implement 'resolve' Event in `promiseDone()` Method**
**Depends on:** Tasks 1–3  
**Affects:** Test Task 7 (resolve event test)  
**Priority:** P1

**Location:** `src/pool.ts` lines 325–334 (`promiseDone` method)

**Current Code:**
```typescript
private promiseDone(p: Promise<unknown>, result: any, index: number) {
  if (this.#isResolved) return;
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    this.result[index] = result;
    this.runNext();
  }
}
```

**New Code (D1 compliant):**
```typescript
private promiseDone(p: Promise<unknown>, result: any, index: number) {
  if (this.#isResolved) return;
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    this.result[index] = result;
    this.#emit('resolve', result);  // ← NEW: emit before runNext
    this.runNext();
  }
}
```

**Design Note (D1):** Timing is **after storing result in `#results`** (via `this.result[index] = result`), **before** calling `runNext()` which may emit `'next'`. This ensures resolve→next ordering for each promise.

**Action Items:**
- [ ] A4a. Add `this.#emit('resolve', result);` after `this.result[index] = result;`
- [ ] A4b. Verify timing: resolve fires after result stored, before runNext()
- [ ] A4c. Test that result value matches what's stored

**Success Criteria:**
- Resolve event fires exactly once per promise recovery
- Event payload (result) matches stored result
- Event fires before 'next'
- No duplicate events per promise

**Risk:** Post-resolution callback guard is already in place (early `if (this.#isResolved) return;`), so safe.

---

### **Task 5: Implement 'error' Event in `promiseRejected()` Method**
**Depends on:** Tasks 1–3  
**Affects:** Test Task 8 (error event test)  
**Priority:** P1

**Location:** `src/pool.ts` lines 336–351 (`promiseRejected` method)

**Current Code:**
```typescript
private promiseRejected(p: Promise<unknown>, error: any, index: number) {
  if (this.#isResolved) return;
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    this.result[index] = new PoolErrorImpl(
      `Promise ${index} was rejected`,
      error,
    );
    if (this.options?.rejectOnError) {
      this.#isResolved = true;
      this.#reject(error);
    } else {
      this.runNext();
    }
  }
}
```

**New Code (D2 compliant):**
```typescript
private promiseRejected(p: Promise<unknown>, error: any, index: number) {
  if (this.#isResolved) return;
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    
    // D2: Emit error event BEFORE respecting rejectOnError flag
    // This ensures error event fires regardless of rejectOnError value
    const context: PoolEventContext = {
      runningCount: this.#running.length,
      waitingCount: this.#enqueued.length,
      pendingCount: this.#running.length + this.#enqueued.length,
      isStarted: this.#isStarted,
      isClosed: this.#isClosed,
      isResolved: this.#isResolved,
    };
    this.#emit('error', error, context);
    
    // After event fires, store error in results
    this.result[index] = new PoolErrorImpl(
      `Promise ${index} was rejected`,
      error,
    );
    
    if (this.options?.rejectOnError) {
      this.#isResolved = true;
      this.#reject(error);
    } else {
      this.runNext();
    }
  }
}
```

**Design Notes (D5):** 
- Context includes pool state snapshot at rejection time (runningCount already decremented because splice happened)
- Context is optional in listener (caller can ignore)
- Event fires BEFORE error handling (rejectOnError), ensuring it always fires
- PoolEventContext interface defined in Task 2

**Action Items:**
- [ ] A5a. Create context object with pool state snapshot
- [ ] A5b. Add `this.#emit('error', error, context);` **before** rejectOnError check
- [ ] A5c. Add PoolEventContext interface to src/pool.ts exports
- [ ] A5d. Verify context is accurate (runningCount, waitingCount, etc.)

**Success Criteria:**
- Error event fires exactly once per rejection
- Event always fires regardless of rejectOnError flag
- Context object contains accurate pool state
- Error handling (rejectOnError) unchanged

**Risk:** Post-resolution callback guard ensures late errors are ignored. Context snapshot is point-in-time (accurate at emission time).

---

### **Task 6: Export New Types and Update Type Definitions**
**Depends on:** Tasks 1–5  
**Affects:** Test Task 7–8 (type checking in tests)  
**Priority:** P0

**Location:** `src/index.ts` (exports)

**Current Exports:**
- POOL_EVENT_TYPE
- PromisePool interface
- PoolOptions
- PoolError interface

**New/Updated Exports:**
- [ ] A6a. Export PoolEventContext interface (from Task 2)
- [ ] A6b. Verify POOL_EVENT_TYPE includes 'resolve' and 'error'
- [ ] A6c. Update JSDoc on POOL_EVENT_TYPE in src/pool.ts
- [ ] A6d. Add JSDoc comments to PoolEventContext fields

**Success Criteria:**
- PoolEventContext is exported and available to test files
- POOL_EVENT_TYPE union type includes both 'resolve' and 'error'
- TypeScript compilation passes

---

### **Task 7: Write Tests for 'resolve' Event**
**Depends on:** Tasks 4–6  
**Affects:** PR verification  
**Priority:** P1

**Location:** `tests/index.test.ts` (new test cases)

**Test Scenarios (add to existing test suite):**

#### T7a: Basic Resolve Event — Single Promise
```typescript
test('resolve event fires with result when promise resolves', async () => {
  const results: unknown[] = [];
  const p = pool(2);
  p.on('resolve', (result) => results.push(result));
  
  p.enqueue(() => Promise.resolve(42));
  const poolResults = await p.close();
  
  assert.deepEqual(results, [42]);
  assert.deepEqual(poolResults, [42]);
});
```

#### T7b: Resolve Event — Multiple Promises
```typescript
test('resolve event fires per promise with correct results', async () => {
  const resolveResults: unknown[] = [];
  const p = pool(2);
  p.on('resolve', (result) => resolveResults.push(result));
  
  p.enqueue(() => Promise.resolve(1));
  p.enqueue(() => Promise.resolve(2));
  p.enqueue(() => Promise.resolve(3));
  const poolResults = await p.close();
  
  assert.equal(resolveResults.length, 3);
  assert.deepEqual(resolveResults, [1, 2, 3]);
  assert.deepEqual(poolResults, [1, 2, 3]);
});
```

#### T7c: Resolve Event Ordering — Before 'next'
```typescript
test('resolve event fires before next event', async () => {
  const events: string[] = [];
  const p = pool(1);  // Concurrency=1 to control order
  p.on('resolve', () => events.push('resolve'));
  p.on('next', () => events.push('next'));
  
  p.enqueue(async () => Promise.resolve(1));
  p.enqueue(async () => Promise.resolve(2));
  await p.close();
  
  // Expected: resolve, next (for task 1), resolve, next (for task 2)
  const expected = ['resolve', 'next', 'resolve', 'next'];
  assert.deepEqual(events, expected);
});
```

#### T7d: Resolve Event — Skipped on Rejection
```typescript
test('resolve event does not fire when promise rejects', async () => {
  const resolveResults: unknown[] = [];
  const errorResults: unknown[] = [];
  const p = pool(2);
  p.on('resolve', (result) => resolveResults.push(result));
  p.on('error', (err) => errorResults.push(err));
  
  p.enqueue(() => Promise.resolve(1));
  p.enqueue(() => Promise.reject(new Error('fail')));
  await p.close();
  
  assert.equal(resolveResults.length, 1);
  assert.equal(resolveResults[0], 1);
  assert.equal(errorResults.length, 1);
});
```

**Action Items:**
- [ ] A7a. Add T7a–T7d to `tests/index.test.ts`
- [ ] A7b. Run tests: `pnpm run test`
- [ ] A7c. Verify all 4 tests pass

**Success Criteria:**
- 4 new tests added
- All tests pass
- No regression in existing tests

---

### **Task 8: Write Tests for 'error' Event**
**Depends on:** Tasks 5–6  
**Affects:** PR verification  
**Priority:** P1

**Location:** `tests/index.test.ts` (new test cases)

**Test Scenarios:**

#### T8a: Basic Error Event — Single Rejection
```typescript
test('error event fires with error when promise rejects', async () => {
  const errors: unknown[] = [];
  const p = pool(2, { rejectOnError: false });
  p.on('error', (err) => errors.push(err));
  
  const testError = new Error('test failure');
  p.enqueue(() => Promise.reject(testError));
  await p.close();
  
  assert.equal(errors.length, 1);
  assert.equal(errors[0], testError);
});
```

#### T8b: Error Event — Multiple Rejections
```typescript
test('error event fires per rejection with correct errors', async () => {
  const errors: unknown[] = [];
  const p = pool(2, { rejectOnError: false });
  p.on('error', (err) => errors.push(err));
  
  const err1 = new Error('fail 1');
  const err2 = new Error('fail 2');
  p.enqueue(() => Promise.reject(err1));
  p.enqueue(() => Promise.resolve(1));  // success
  p.enqueue(() => Promise.reject(err2));
  await p.close();
  
  assert.equal(errors.length, 2);
  assert.equal(errors[0], err1);
  assert.equal(errors[1], err2);
});
```

#### T8c: Error Event Context Accuracy
```typescript
test('error event context includes accurate pool state', async () => {
  const contexts: PoolEventContext[] = [];
  const p = pool(2);
  p.on('error', (err, ctx) => {
    if (ctx) contexts.push(ctx);
  });
  
  p.enqueue(async () => {
    await new Promise(r => setTimeout(r, 10));
    return Promise.reject(new Error('delayed fail'));
  });
  p.enqueue(() => Promise.resolve(1));
  await p.close();
  
  assert.equal(contexts.length, 1);
  const ctx = contexts[0];
  assert.isNumber(ctx.runningCount);
  assert.isNumber(ctx.waitingCount);
  assert.equal(ctx.isClosed, false);  // Error fires before close completes
});
```

#### T8d: Error Event Fires Regardless of rejectOnError Flag
```typescript
test('error event fires regardless of rejectOnError flag', async () => {
  // Test 1: rejectOnError = false
  const errors1: unknown[] = [];
  const p1 = pool(2, { rejectOnError: false });
  p1.on('error', (err) => errors1.push(err));
  
  const testError = new Error('test');
  p1.enqueue(() => Promise.reject(testError));
  await p1.close();
  assert.equal(errors1.length, 1);
  
  // Test 2: rejectOnError = true
  const errors2: unknown[] = [];
  const p2 = pool(2, { rejectOnError: true });
  p2.on('error', (err) => errors2.push(err));
  
  p2.enqueue(() => Promise.reject(testError));
  try {
    await p2.close();
  } catch (e) {
    // Pool rejects when rejectOnError=true
  }
  assert.equal(errors2.length, 1);  // Error event still fired
});
```

#### T8e: Mixed Resolve and Error Events
```typescript
test('mixed resolve and error events in single pool execution', async () => {
  const events: { type: string; payload?: unknown }[] = [];
  const p = pool(3, { rejectOnError: false });
  p.on('resolve', (result) => events.push({ type: 'resolve', payload: result }));
  p.on('error', (err) => events.push({ type: 'error' }));
  
  p.enqueue(() => Promise.resolve(1));
  p.enqueue(() => Promise.reject(new Error('fail')));
  p.enqueue(() => Promise.resolve(2));
  p.enqueue(() => Promise.reject(new Error('fail 2')));
  p.enqueue(() => Promise.resolve(3));
  await p.close();
  
  assert.equal(events.length, 5);  // 3 resolves, 2 errors
  const resolved = events.filter(e => e.type === 'resolve').length;
  const errored = events.filter(e => e.type === 'error').length;
  assert.equal(resolved, 3);
  assert.equal(errored, 2);
});
```

**Action Items:**
- [ ] A8a. Add T8a–T8e to `tests/index.test.ts`
- [ ] A8b. Run tests: `pnpm run test`
- [ ] A8c. Verify all 5 tests pass

**Success Criteria:**
- 5 new tests added
- All tests pass
- No regression in existing tests
- Context object is properly populated

---

### **Task 9: Verify Backward Compatibility**
**Depends on:** Tasks 4–8  
**Affects:** Release readiness  
**Priority:** P0

**Action Items:**
- [ ] A9a. Run full test suite: `pnpm run test` (should have 40+ tests)
- [ ] A9b. Verify all existing tests pass (no red X marks)
- [ ] A9c. Type-check with TypeScript: `pnpm run build` (no errors)
- [ ] A9d. Lint code: `pnpm run lint` (no linter violations)
- [ ] A9e. Verify pool still works without listeners (no event listeners registered)
- [ ] A9f. Test that old code using existing events still works unchanged

**Backward Compat Checklist:**
- ✅ Existing event types ('start', 'full', 'next', 'close', 'available', 'resolve' for pool) all work unchanged
- ✅ on() and once() accept callbacks without arguments (existing code)
- ✅ No changes to PoolOptions, pool() factory signature
- ✅ No changes to enqueue(), close(), start() behavior
- ✅ Error handling (rejectOnError) behavior unchanged

**Success Criteria:**
- 40+ tests passing
- Zero TypeScript errors
- Zero lint errors
- All backward compat checks pass

---

### **Task 10: Update Documentation (JSDoc and README outline)**
**Depends on:** Tasks 1–9  
**Affects:** User understanding  
**Priority:** P1

**Location:** `src/pool.ts` JSDoc + README (outline only, full update deferred to Phase 9)

**Action Items:**
- [ ] A10a. Add JSDoc for 'resolve' event in on()/once() comments (signature, timing, example)
- [ ] A10b. Add JSDoc for 'error' event in on()/once() comments (signature, context fields, example)
- [ ] A10c. Add JSDoc for PoolEventContext interface (field descriptions)
- [ ] A10d. Update README Events section with basic examples (deferred full examples to Phase 9):
  ```markdown
  ### Events
  
  - **'resolve'** — Fires per-promise when it resolves. Callback: `(result: unknown) => void`
  - **'error'** — Fires per-promise when it rejects. Callback: `(error: unknown, context?: PoolEventContext) => void`
  
  See Phase 9 for advanced event usage patterns.
  ```

**Success Criteria:**
- JSDoc comments are clear and accurate
- README Events section documents both new events
- Examples are code-complete and runnable

---

### **Task 11: Risk Mitigation — Post-Resolution Callback Safety**
**Depends on:** Tasks 4–5  
**Affects:** Production stability  
**Priority:** P0

**Risk:** During rapid promise settlement (near-simultaneously in microtask queue), multiple promises might settle and fire callbacks. If pool has already resolved, late callbacks should be ignored.

**Mitigation Already in Place:**
- Early guard in both `promiseDone()` and `promiseRejected()`: `if (this.#isResolved) return;`
- `#isResolved` is set **synchronously** before `#resolve()` fires
- Events are emitted **inside** the guard check (protected)

**Verification Actions:**
- [ ] A11a. Review guard placement in promiseDone() — confirmed present line 326 check
- [ ] A11b. Review guard placement in promiseRejected() — confirmed present line 337 check
- [ ] A11c. Verify #emit() calls are inside guard checks
- [ ] A11d. Add test case: "rapid settlement doesn't cause post-resolution events" (optional, but recommended for Phase 9)

**Success Criteria:**
- No events fire after pool resolves
- Guard checks are in place
- Code review confirms safety

---

### **Task 12: Integration Test — Verify Event Sequencing with All Pool States**
**Depends on:** Tasks 4–9  
**Affects:** Confidence in event ordering  
**Priority:** P2 (optional, can defer to Phase 9)

**Test Scenario (optional add):**
```typescript
test('event sequencing: resolve/error → next → available/full (integration)', async () => {
  const timeline: string[] = [];
  const p = pool(2);
  
  p.on('next', () => timeline.push('next'));
  p.on('resolve', () => timeline.push('resolve'));
  p.on('error', (err) => timeline.push('error'));
  p.on('full', () => timeline.push('full'));
  p.on('available', () => timeline.push('available'));
  
  // Enqueue 4 tasks with concurrency=2
  p.enqueue(() => Promise.resolve(1));  // Task 1
  p.enqueue(() => Promise.resolve(2));  // Task 2
  p.enqueue(() => Promise.resolve(3));  // Task 3
  p.enqueue(() => Promise.resolve(4));  // Task 4
  
  await p.close();
  
  // Expected: start → next (1) → full → next (2) → full
  //           → resolve (1) → available → next (3) → full
  //           → resolve (2) → available → next (4) → full
  //           → resolve (3) → available
  //           → resolve (4) → available
  // Then: resolve (pool) when all settle
  
  assert(timeline.includes('resolve'));  // At least one per-promise resolve
  assert(timeline.includes('next'));     // At least one next
});
```

**Action Items:**
- [ ] A12a. (Optional) Add integration test to verify overall event sequencing
- [ ] A12b. Document expected event order in test comment

---

## Implementation Order & Wave Strategy

### **Wave 1: Foundational Types (Tasks 1–3)**
- [ ] Task 1: Type definitions (POOL_EVENT_TYPE + 'error')
- [ ] Task 2: Interface updates (on/once JSDoc + PoolEventContext)
- [ ] Task 3: #emit() method refactor
- **Checkpoint:** TypeScript compilation passes, no behavior changes

### **Wave 2: Event Implementation (Tasks 4–5)**
- [ ] Task 4: promiseDone() — emit 'resolve'
- [ ] Task 5: promiseRejected() — emit 'error' with context
- **Checkpoint:** Implementation matches CONTEXT.md design decisions

### **Wave 3: Testing & Validation (Tasks 6–12)**
- [ ] Task 6: Export types
- [ ] Task 7: Resolve event tests (4 scenarios)
- [ ] Task 8: Error event tests (5 scenarios)
- [ ] Task 9: Backward compatibility verification
- [ ] Task 10: JSDoc updates
- [ ] Task 11: Risk mitigation review
- [ ] Task 12: (Optional) Integration test
- **Checkpoint:** 40+ tests passing, zero regressions, backward compatible

---

## Event Payload Specifications

### **'resolve' Event**

**Signature:** `(result: unknown) => void`

**Parameters:**
- `result` — The resolved value from the promise (any type)

**Timing:** After result is stored in `#results`, before emitting 'next' event

**Guarantees:**
- Fires exactly once per resolved promise
- Does NOT fire if promise rejects
- Fires in index order (Task 1 event before Task 2)
- Fires before 'next' event for same task

**Example:**
```typescript
pool.on('resolve', (result) => {
  console.log('Promise resolved with:', result);
});
```

---

### **'error' Event**

**Signature:** `(error: unknown, context?: PoolEventContext) => void`

**Parameters:**
- `error` — The rejection reason (any type, typically an Error)
- `context` — Optional pool state snapshot at rejection time:
  - `runningCount: number` — Promises currently executing (decremented from running promise)
  - `waitingCount: number` — Promises enqueued but not started
  - `pendingCount: number` — runningCount + waitingCount (total not settled)
  - `isStarted: boolean` — Whether pool.start() was called
  - `isClosed: boolean` — Whether pool.close() was called
  - `isResolved: boolean` — Whether pool has fully resolved

**Timing:** Before respecting rejectOnError flag in promiseRejected()

**Guarantees:**
- Fires exactly once per rejected promise
- Does NOT fire if promise resolves
- Fires regardless of rejectOnError flag
- Fires before error is stored in results
- Context is accurate snapshot at emission time

**Example:**
```typescript
pool.on('error', (error, context) => {
  console.log('Promise rejected:', error.message);
  if (context) {
    console.log(`Pool state: ${context.runningCount} running, ${context.waitingCount} waiting`);
  }
});
```

---

## Verification Checklist

### **Pre-Implementation Verification**
- ✅ CONTEXT.md reviewed (5 design decisions understood)
- ✅ REQUIREMENTS.md FR-1 and FR-2 reviewed (acceptance criteria clear)
- ✅ Current src/pool.ts analyzed (promiseDone/promiseRejected methods located)
- ✅ Test structure reviewed (test framework in place)

### **Post-Implementation Verification**
- [ ] All 12 tasks completed
- [ ] 40+ total tests passing (31 existing + 9 new)
- [ ] Zero TypeScript compilation errors
- [ ] Zero lint errors (`pnpm run lint`)
- [ ] Backward compatibility verified (existing tests pass unchanged)
- [ ] Event payload matches specification
- [ ] JSDoc comments complete and accurate
- [ ] Code review: event timing correct (resolve→next, error before rejectOnError)
- [ ] Memory safety: post-resolution callbacks guarded
- [ ] Manual testing: create pool, enqueue tasks, listen for events, verify payloads

### **Functional Tests Verification**
- [ ] T7a: Basic resolve event (single promise)
- [ ] T7b: Resolve event per promise (multiple)
- [ ] T7c: Resolve before next event (ordering)
- [ ] T7d: Resolve skipped on rejection
- [ ] T8a: Basic error event (single rejection)
- [ ] T8b: Error event per rejection (multiple)
- [ ] T8c: Error event context accurate
- [ ] T8d: Error event fires regardless of rejectOnError
- [ ] T8e: Mixed resolve and error events

---

## Risk Analysis & Mitigation

### **Risk: Event Timing Out of Order**
**Severity:** High  
**Mitigation:** D1/D2 specify exact timing; emit calls placed carefully in promiseDone/promiseRejected before runNext() or error handling. Test T7c validates ordering.

### **Risk: Post-Resolution Callbacks**
**Severity:** Medium  
**Mitigation:** Early guard checks (`if (this.#isResolved) return;`) prevent late callbacks from firing events. Already in place.

### **Risk: Context Object Inaccuracy**
**Severity:** Medium  
**Mitigation:** Context is captured synchronously inside guard check before any state changes. Snapshot is point-in-time. Test T8c validates accuracy.

### **Risk: Backward Incompatibility**
**Severity:** High  
**Mitigation:** New events are additive; existing events/methods unchanged. Callback signature uses variadic args (backward compatible). All existing tests must pass. Task 9 verifies this explicitly.

### **Risk: Duplicate Event Emission**
**Severity:** Low  
**Mitigation:** Each promise settles exactly once (single .then/.catch in runNext line 226–227). Guard checks prevent re-settlement. No risk of duplicates per promise.

---

## Success Criteria Summary

**✅ All Must-Have Criteria:**
- [ ] 'resolve' event emits per-promise when promise resolves
- [ ] 'error' event emits per-promise when promise rejects
- [ ] Event payload matches specification (result, error + context)
- [ ] Timing: resolve→next, error before error handling
- [ ] 40+ tests passing (9 new + 31 existing)
- [ ] Zero TypeScript errors
- [ ] Zero regressions (all existing tests pass)
- [ ] Backward compatible (no breaking changes)
- [ ] JSDoc complete

**✅ Nice-to-Have Criteria:**
- [ ] Integration test for full event sequencing (T12)
- [ ] Advanced JSDoc examples
- [ ] README Events section polished
- [ ] Code review approval from senior developer

---

## Next Phase Handoff

**Phase 6 builds on Phase 5:**
- Uses error event context from D5 (runningCount, waitingCount, etc.)
- Depends on resolve/error events being stable
- Adds counters (resolvedCount, rejectedCount) for health monitoring
- Implements 7+ new getters for pool introspection

**Assumptions for Phase 6:**
- Phase 5 tests all passing
- Event payloads are stable and backward compatible
- Context structure fixed and documented

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pool.ts` | POOL_EVENT_TYPE (+error), #emit() signature, promiseDone() +resolve event, promiseRejected() +error event, PoolEventContext interface, JSDoc updates |
| `src/index.ts` | Export PoolEventContext |
| `tests/index.test.ts` | +9 new tests (T7a–T8e) |
| `README.md` | Events section outline (deferred detailed docs to Phase 9) |

---

## Execution Guide

**1. Before Starting:**
```bash
cd /workspaces/promises
git checkout main
git pull
pnpm install
pnpm run test  # Verify starting point (31 tests passing)
```

**2. Execute Wave 1 (Types):**
- [ ] A1a–A1c: Update POOL_EVENT_TYPE
- [ ] A2a–A2c: Add JSDoc overloads + PoolEventContext interface
- [ ] A3a–A3d: Refactor #emit() method
- [ ] Check: `pnpm run build` (no errors)

**3. Execute Wave 2 (Events):**
- [ ] A4a–A4c: Add 'resolve' event to promiseDone()
- [ ] A5a–A5d: Add 'error' event to promiseRejected()
- [ ] Check: `pnpm run build` (no errors)

**4. Execute Wave 3 (Testing):**
- [ ] A6a–A6d: Export types
- [ ] A7a–A7c: Add resolve event tests (4)
- [ ] A8a–A8c: Add error event tests (5)
- [ ] Check: `pnpm run test` (40+ passing)
- [ ] A9a–A9f: Verify backward compatibility
- [ ] A10a–A10d: Update JSDoc/README
- [ ] A11a–A11d: Risk mitigation review

**5. Final Verification:**
```bash
pnpm run test        # 40+ tests passing
pnpm run build       # No errors
pnpm run lint        # No violations
git status           # Review changes
```

**6. Commit & Next Phase:**
```bash
git add src/ tests/ README.md
git commit -m "feat: implement 'resolve' and 'error' events (Phase 5)"
# → Ready for Phase 6
```

---

**Phase 5 Plan Created:** 2026-03-24  
**Status:** Ready for Execution  
**Estimated Duration:** 2–3 hours (including testing and verification)  
**Dependencies:** Phase 4 completed  
**Blockers:** None identified

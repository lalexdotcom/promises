---
phase: 06-pool-introspection
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pool.ts
autonomous: true
requirements:
  - FR-3
must_haves:
  truths:
    - "Pool exposes read-only getter for configured concurrency limit"
    - "Pool tracks count of executing promises (runningCount)"
    - "Pool tracks count of enqueued promises (waitingCount)"
    - "Pool tracks count of pending promises (pendingCount = running + waiting)"
    - "Pool tracks count of settled promises (settledCount = resolved + rejected)"
    - "Pool tracks count of successfully resolved promises (resolvedCount)"
    - "Pool tracks count of rejected promises (rejectedCount)"
  artifacts:
    - path: "src/pool.ts"
      provides: "PromisePool interface with 7 getters, PromisePoolImpl implementation with counters"
      exports:
        - "concurrency (getter)"
        - "runningCount (getter)"
        - "waitingCount (getter)"
        - "pendingCount (getter)"
        - "settledCount (getter)"
        - "resolvedCount (getter)"
        - "rejectedCount (getter)"
  key_links:
    - from: "PromisePool interface"
      to: "PromisePoolImpl class"
      via: "interface implementation"
      pattern: "class PromisePoolImpl implements PromisePool"
    - from: "promiseDone() method"
      to: "#resolvedCount counter"
      via: "increment after post-resolution guard"
      pattern: "this.#resolvedCount\\+\\+"
    - from: "promiseRejected() method"
      to: "#rejectedCount counter"
      via: "increment after post-resolution guard"
      pattern: "this.#rejectedCount\\+\\+"
---

<objective>
Implement comprehensive pool introspection via 7 read-only getters that provide real-time insight into pool configuration, execution state, and settlement tracking. All getters are O(1) operations (direct property access or simple arithmetic). Maintain strict backward compatibility with existing API.

**Purpose:** Enable health monitoring and debugging by exposing pool state without breaking encapsulation.

**Output:** 
- Updated `src/pool.ts` with new getters and counters
- All tests passing (40+ before, target 50+)
- No breaking changes to existing API or type definitions
</objective>

<execution_context>
@.github/get-shit-done/workflows/execute-plan.md
@.github/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@.planning/05-backpressure-control/05-SUMMARY.md
[Phase 5 provided: 'resolve' event in promiseDone(), 'error' event in promiseRejected(), PoolEventContext, event timing guarantees]

@src/pool.ts#L1-L50 [Type definitions, PoolEventContext, PromisePool interface]
@src/pool.ts#L150-210 [PromisePoolImpl constructor, state initialization, start method]
@src/pool.ts#L330-360 [promiseDone() method with 'resolve' event emission, post-resolution guard]
@src/pool.ts#L362-390 [promiseRejected() method with 'error' event emission, post-resolution guard]
@src/pool.ts#L280-295 [Pool resolution points, #isResolved flag]
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add private counter fields to PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add two private counters to the PromisePoolImpl class immediately after the existing private field declarations (after `#isResolved = false`). Initialize both to 0:

```typescript
private #resolvedCount = 0;
private #rejectedCount = 0;
```

These counters track the cumulative number of promises that have settled successfully (resolved) and unsuccessfully (rejected). Initialize in constructor or as field initializers (field initializers preferred for clarity).

**Why:** These form the basis for `resolvedCount` and `rejectedCount` getters. They must be private to maintain encapsulation.

**Location:** Add after line ~175 (after the state flag initializations `#isStarted`, `#isClosed`, `#isResolved`).
  </action>
  <verify>
    <automated>grep -n "#resolvedCount\|#rejectedCount" src/pool.ts</automated>
  </verify>
  <done>Both `#resolvedCount` and `#rejectedCount` fields declared and initialized to 0 in PromisePoolImpl class</done>
</task>

<task type="auto">
  <name>Task 2: Increment #resolvedCount in promiseDone() method</name>
  <files>src/pool.ts</files>
  <action>
In the `promiseDone()` private method, add counter increment **after the post-resolution guard** (after `if (this.#isResolved) return;`) and **after storing the result** but **before or after emitting the 'resolve' event** (order doesn't matter since both are post-guard).

Specifically, add `this.#resolvedCount++;` after the line `this.result[index] = result;` but before `this.#emit('resolve', result);`.

**Code context:**
```typescript
private promiseDone(p: Promise<unknown>, result: any, index: number) {
  if (this.#isResolved) return;  // POST-RESOLUTION GUARD
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    this.result[index] = result;
    this.#resolvedCount++;  // ADD THIS LINE
    this.#emit('resolve', result);
    this.runNext();
  }
}
```

**Why:** Increments the counter at the exact moment a promise has successfully resolved. The post-resolution guard ensures this counter is never incremented for duplicate callbacks from microtask races.

**Verification:** Counter increments exactly once per resolved promise, never during post-resolution callbacks.
  </action>
  <verify>
    <automated>grep -A 10 "private promiseDone" src/pool.ts | grep -n "resolvedCount"</automated>
  </verify>
  <done>`#resolvedCount` is incremented in promiseDone() after the post-resolution guard and after storing result</done>
</task>

<task type="auto">
  <name>Task 3: Increment #rejectedCount in promiseRejected() method</name>
  <files>src/pool.ts</files>
  <action>
In the `promiseRejected()` private method, add counter increment **after the post-resolution guard** and **after emitting the 'error' event** but **before storing the PoolError**. This ensures we track the logical rejection before error wrapping.

Specifically, add `this.#rejectedCount++;` after `this.#emit('error', error, context);` but before storing the PoolErrorImpl:

**Code context:**
```typescript
private promiseRejected(p: Promise<unknown>, error: any, index: number) {
  if (this.#isResolved) return;  // POST-RESOLUTION GUARD
  const promiseIndex = this.#running.indexOf(p);
  if (promiseIndex >= 0) {
    this.#running.splice(promiseIndex, 1);
    // Create and emit context...
    const context: PoolEventContext = { ... };
    this.#emit('error', error, context);
    this.#rejectedCount++;  // ADD THIS LINE
    this.result[index] = new PoolErrorImpl(...);
    if (this.options?.rejectOnError) {
      this.#isResolved = true;
      this.#reject(error);
    } else {
      this.runNext();
    }
  }
}
```

**Why:** Increments the counter at the exact moment a promise has been rejected. All error handling paths (rejectOnError true or false) go through this counter increment.

**Verification:** Counter increments exactly once per rejected promise, regardless of rejectOnError flag.
  </action>
  <verify>
    <automated>grep -A 20 "private promiseRejected" src/pool.ts | grep -n "rejectedCount"</automated>
  </verify>
  <done>`#rejectedCount` is incremented in promiseRejected() after the post-resolution guard and 'error' event</done>
</task>

</tasks>

<verification>
After Wave 1 completion:
- [ ] Both counters declared and initialized in PromisePoolImpl
- [ ] Counter fields are private (#symbol notation)
- [ ] #resolvedCount incremented in promiseDone() post-guard
- [ ] #rejectedCount incremented in promiseRejected() post-guard
- [ ] No TypeScript errors
- [ ] Code compiles cleanly
</verification>

<success_criteria>
**Wave 1 Complete When:**
- All counter field declarations present
- Both increments in correct location (post-guard, pre-event in promiseDone, post-event in promiseRejected)
- No compilation errors
- Counters initialize to 0
</success_criteria>

<output>
After Wave 1 completion, proceed to execute Wave 2 (getter implementation).
</output>

---

## WAVE 2: Implement Introspection Getters

<tasks>

<task type="auto">
  <name>Task 4: Add getter properties to PromisePool interface</name>
  <files>src/pool.ts</files>
  <action>
Update the `PromisePool` interface to add 7 new read-only getter properties. Add them **after existing getters** (`isStarted`, `isClosed`, `isResolved`, near line ~50).

**Interface additions:**
```typescript
export interface PromisePool {
  // ... existing properties ...
  
  /** Maximum number of promises that can run simultaneously (from PoolOptions). */
  readonly concurrency: number;

  /** Number of promises currently executing (started but not settled). */
  readonly runningCount: number;

  /** Number of promises enqueued but not yet started. */
  readonly waitingCount: number;

  /** Total promises not yet settled (runningCount + waitingCount). */
  readonly pendingCount: number;

  /** Total promises that have settled (resolvedCount + rejectedCount). */
  readonly settledCount: number;

  /** Number of promises that resolved successfully. */
  readonly resolvedCount: number;

  /** Number of promises that were rejected. */
  readonly rejectedCount: number;
```

**Order matters for clarity:** organize as: concurrency → runningCount/waitingCount → pendingCount → resolvedCount/rejectedCount → settledCount (logical grouping).

**Why:** These getters expose internal pool state for health monitoring and debugging. All are read-only (no setters) to maintain encapsulation. JSDoc provides clear semantics.

**Note:** The existing `running` and `waiting` getters remain unchanged (backward compat). New `runningCount` and `waitingCount` are semantic aliases. We keep both to avoid breaking existing code that uses `pool.running` and `pool.waiting`.

Actually, on second thought: consolidate and use NEW names only. Remove old `running` and `waiting`, replace with `runningCount` and `waitingCount`. This breaks backward compat, but the spec says to add 7 getters, not keep old names. **Decision: Keep existing `running` and `waiting` for backward compat, and add new `runningCount` and `waitingCount` as aliases** (or don't add them if they're the same as old ones). 

**Re-reading spec:** The spec says add `runningCount` and `waitingCount` as new getters. Looking at the ROADMAP closely, it says "runningCount" and "waitingCount" are new. But the interface already has `running` and `waiting`. 

**Resolution:** The specification asks for getters named `runningCount` and `waitingCount`. The codebase has `running` and `waiting`. For backward compatibility AND to satisfy the requirement, we keep `running` and `waiting`, but ALSO add `runningCount` and `waitingCount` that return the same value. Or, more likely, the specification meant to add exactly these as aliases, but to be safe: add both old and new names, documenting that they're equivalent.

Actually, re-reading the user's requirements more carefully: "Add 7 read-only getters" including `runningCount` and `waitingCount`. The spec doesn't say to remove the old ones. So we add NEW getters alongside the old ones. This is fully backward compatible.
  </action>
  <verify>
    <automated>grep -n "readonly concurrency:\|readonly runningCount:\|readonly waitingCount:\|readonly pendingCount:\|readonly settledCount:\|readonly resolvedCount:\|readonly rejectedCount:" src/pool.ts</automated>
  </verify>
  <done>All 7 getter properties declared in PromisePool interface with proper JSDoc</done>
</task>

<task type="auto">
  <name>Task 5: Implement concurrency getter in PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add a getter method to PromisePoolImpl that returns the maximum concurrent promise limit. Add it **after the existing `waiting` getter** (~line 300).

**Implementation:**
```typescript
get concurrency() {
  return this.size;
}
```

**Why:** `this.size` holds the concurrency configuration from the PoolOptions passed to the constructor. This is O(1) direct property access.

**Location:** Add immediately after the `waiting` getter.
  </action>
  <verify>
    <automated>grep -A 2 "get concurrency()" src/pool.ts</automated>
  </verify>
  <done>`concurrency` getter implemented, returns `this.size`</done>
</task>

<task type="auto">
  <name>Task 6: Implement runningCount and waitingCount getters in PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add two getter methods to PromisePoolImpl that expose internal queue and running promise counts. Add them **after the `concurrency` getter**.

**Implementation:**
```typescript
get runningCount() {
  return this.#running.length;
}

get waitingCount() {
  return this.#enqueued.length;
}
```

**Why:** These are O(1) direct `.length` property accesses on the internal arrays. They expose the same data as the existing `running` and `waiting` getters, but with clearer semantic names for health monitoring. Both old and new names coexist for backward compatibility.

**Location:** Add immediately after the `concurrency` getter.
  </action>
  <verify>
    <automated>grep -A 2 "get runningCount()\|get waitingCount()" src/pool.ts</automated>
  </verify>
  <done>Both `runningCount` and `waitingCount` getters implemented, return array lengths</done>
</task>

<task type="auto">
  <name>Task 7: Implement pendingCount getter in PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add a getter that returns the total count of promises that have not yet settled. This is the sum of running and waiting promises.

**Implementation:**
```typescript
get pendingCount() {
  return this.runningCount + this.waitingCount;
}
```

**Why:** This is derived from two O(1) components, so the total operation is O(1). `pendingCount` represents the total "in-flight" promises (both executing and enqueued), useful for health monitoring without exposing internal arrays.

**Invariant:** `pendingCount + settledCount = totalEnqueued` (verified in tests).

**Location:** Add immediately after the `waitingCount` getter.
  </action>
  <verify>
    <automated>grep -A 2 "get pendingCount()" src/pool.ts</automated>
  </verify>
  <done>`pendingCount` getter implemented, returns `runningCount + waitingCount`</done>
</task>

<task type="auto">
  <name>Task 8: Implement resolvedCount and rejectedCount getters in PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add two getter methods that expose the private counters tracking how many promises have successfully resolved or been rejected.

**Implementation:**
```typescript
get resolvedCount() {
  return this.#resolvedCount;
}

get rejectedCount() {
  return this.#rejectedCount;
}
```

**Why:** These provide direct access to the private counters initialized in Wave 1. Both are O(1) property accesses. These counters are monotonic (only increment, never reset or decrement) and represent the cumulative count since pool creation.

**Location:** Add immediately after the `pendingCount` getter.
  </action>
  <verify>
    <automated>grep -A 2 "get resolvedCount()\|get rejectedCount()" src/pool.ts</automated>
  </verify>
  <done>Both `resolvedCount` and `rejectedCount` getters implemented, return counter values</done>
</task>

<task type="auto">
  <name>Task 9: Implement settledCount getter in PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <action>
Add a getter that returns the total count of promises that have settled (both resolved and rejected).

**Implementation:**
```typescript
get settledCount() {
  return this.resolvedCount + this.rejectedCount;
}
```

**Why:** This is the sum of two O(1) counters, making it O(1). `settledCount` represents the total number of promises that have finished executing, regardless of success or failure. Useful for completion progress tracking.

**Invariant:** `settledCount = resolvedCount + rejectedCount` always. Also: `pendingCount + settledCount = totalEnqueued` (verified in tests).

**Location:** Add immediately after the `rejectedCount` getter.
  </action>
  <verify>
    <automated>grep -A 2 "get settledCount()" src/pool.ts</automated>
  </verify>
  <done>`settledCount` getter implemented, returns `resolvedCount + rejectedCount`</done>
</task>

</tasks>

<verification>
After Wave 2 completion:
- [ ] All 7 getter properties declared in PromisePool interface with JSDoc
- [ ] All 7 getters implemented in PromisePoolImpl class
- [ ] `concurrency` returns `this.size`
- [ ] `runningCount` returns `this.#running.length`
- [ ] `waitingCount` returns `this.#enqueued.length`
- [ ] `pendingCount` returns `runningCount + waitingCount`
- [ ] `resolvedCount` returns `this.#resolvedCount`
- [ ] `rejectedCount` returns `this.#rejectedCount`
- [ ] `settledCount` returns `resolvedCount + rejectedCount`
- [ ] No TypeScript errors
- [ ] All existing tests still pass
- [ ] Backward compatibility: old `running` and `waiting` getters still work
</verification>

<success_criteria>
**Wave 2 Complete When:**
- PromisePool interface extended with 7 new getters
- All 7 getters implemented in PromisePoolImpl
- Getters are read-only (no setters)
- No compilation errors
- Existing code using `running` and `waiting` still works
</success_criteria>

<output>
After Wave 2 completion, proceed to execute Wave 3 (comprehensive test scenarios).
</output>

---

## WAVE 3: Comprehensive Introspection Testing

<tasks>

<task type="auto" tdd="true">
  <name>Task 10: Add invariant test — runningCount + waitingCount = pendingCount</name>
  <files>tests/index.test.ts</files>
  <behavior>
- At any point in pool lifecycle (before start, during execution, after close), verify math identity
- Test at multiple checkpoints: after enqueue, during execution, after settlement
- 10 enqueued tasks with mixed durations → check invariant at random points
- Invariant must hold before pool starts, during execution, and after completion
  </behavior>
  <action>
Create a new test in the "TEST-08: Pool Introspection" describe block (new test group after TEST-07):

```typescript
describe('TEST-08: Pool Introspection', () => {
  test('invariant: runningCount + waitingCount = pendingCount at any time', async () => {
    const checkpoints: any[] = [];
    const p = pool(2, { autoStart: false });
    
    // Enqueue 10 tasks with varying durations
    for (let i = 0; i < 10; i++) {
      p.enqueue(() => wait(Math.random() * 50));
    }
    
    // Check invariant before start
    checkpoints.push({
      label: 'before start',
      runningCount: p.runningCount,
      waitingCount: p.waitingCount,
      pendingCount: p.pendingCount,
    });
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);
    
    p.start();
    
    // Check during execution
    await Promise.resolve();
    checkpoints.push({
      label: 'after start',
      runningCount: p.runningCount,
      waitingCount: p.waitingCount,
      pendingCount: p.pendingCount,
    });
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);
    
    await p.close();
    
    // Check after close
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);
    
    // All checkpoints must satisfy invariant
    checkpoints.forEach(cp => {
      expect(cp.runningCount + cp.waitingCount).toBe(cp.pendingCount);
    });
  });
});
```

**Why:** Tests the core arithmetic invariant at multiple lifecycle points. Ensures the derived getter calculation stays in sync with underlying arrays.

**Verification:** Invariant holds at all checkpoints before start, during execution, after close.
  </action>
  <verify>
    <automated>npm test -- --filter="invariant.*runningCount.*waitingCount.*pendingCount"</automated>
  </verify>
  <done>Invariant test passes at all lifecycle points</done>
</task>

<task type="auto" tdd="true">
  <name>Task 11: Add invariant test — resolvedCount + rejectedCount = settledCount</name>
  <files>tests/index.test.ts</files>
  <behavior>
- After pool completes, verify settlement invariant: all settled promises are accounted for
- 15 tasks with mixed success (10 resolve, 5 reject) + rejectOnError:false
- Verify invariant after close
- Verify invariant multiple times (should not change post-resolution)
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('invariant: resolvedCount + rejectedCount = settledCount always', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(3);
    
    // Enqueue 15 tasks: 10 resolve, 5 reject
    for (let i = 0; i < 10; i++) {
      p.enqueue(() => Promise.resolve(i));
    }
    for (let i = 0; i < 5; i++) {
      p.enqueue(() => Promise.reject(new Error(`err${i}`)));
    }
    
    await p.close();
    console.error = orig;
    
    // After close, verify invariant
    expect(p.resolvedCount + p.rejectedCount).toBe(p.settledCount);
    expect(p.settledCount).toBe(15); // All tasks settled
    expect(p.resolvedCount).toBe(10);
    expect(p.rejectedCount).toBe(5);
    
    // Counters should remain stable (not reset or change)
    expect(p.resolvedCount + p.rejectedCount).toBe(p.settledCount);
  });
```

**Why:** Verifies that the counter values correctly track all settled promises. Tests the core settlement invariant.

**Verification:** Invariant holds, counts match expectations (10 resolved, 5 rejected, 15 total settled).
  </action>
  <verify>
    <automated>npm test -- --filter="invariant.*resolvedCount.*rejectedCount.*settledCount"</automated>
  </verify>
  <done>Settlement invariant test passes with correct counts</done>
</task>

<task type="auto" tdd="true">
  <name>Task 12: Add lifecycle test — all getters across pool lifecycle</name>
  <files>tests/index.test.ts</files>
  <behavior>
- Single pool, 5 enqueued tasks, trace all 7 getters (concurrency, runningCount, waitingCount, pendingCount, resolvedCount, rejectedCount, settledCount) at each lifecycle point
- Points: after enqueue, after start, during execution, after close
- Verify getter values change correctly and monotonically (counters never decrease)
- Verify concurrency always reflects initial config (never changes)
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('lifecycle: all getters track state correctly through pool lifecycle', async () => {
    const p = pool(2, { autoStart: false });
    
    // After creation, before enqueue
    expect(p.concurrency).toBe(2);
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(0);
    expect(p.pendingCount).toBe(0);
    expect(p.resolvedCount).toBe(0);
    expect(p.rejectedCount).toBe(0);
    expect(p.settledCount).toBe(0);
    
    // After enqueue (before start)
    for (let i = 0; i < 5; i++) {
      p.enqueue(() => wait(30));
    }
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(5);
    expect(p.pendingCount).toBe(5);
    expect(p.settledCount).toBe(0);
    
    // After start
    p.start();
    await Promise.resolve();
    
    // During execution (2 running, 3 waiting)
    expect(p.runningCount).toBe(2);
    expect(p.waitingCount).toBe(3);
    expect(p.pendingCount).toBe(5);
    expect(p.resolvedCount + p.rejectedCount).toBe(0); // Nothing settled yet
    
    // After close
    await p.close();
    
    // All settled
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(0);
    expect(p.pendingCount).toBe(0);
    expect(p.settledCount).toBe(5);
    expect(p.resolvedCount).toBe(5);
    expect(p.rejectedCount).toBe(0);
    expect(p.concurrency).toBe(2); // Never changes
  });
```

**Why:** Tests that all 7 getters behave correctly through the full pool lifecycle, from creation through completion. Verifies monotonicity (counters only increase) and state consistency.

**Verification:** All getters return expected values at each lifecycle point. Concurrency is constant. Counters are monotonic.
  </action>
  <verify>
    <automated>npm test -- --filter="lifecycle.*getters.*pool.*lifecycle"</automated>
  </verify>
  <done>Lifecycle test passes, all getters track state correctly</done>
</task>

<task type="auto" tdd="true">
  <name>Task 13: Add test — settledCount + pendingCount = totalEnqueued</name>
  <files>tests/index.test.ts</files>
  <behavior>
- Enqueue 20 tasks (mix of fast, slow, failing)
- Periodically check: settledCount + pendingCount = 20 (total enqueued)
- Check at multiple points: start, middle of execution, end
- Verify invariant holds even with rapid start/close cycles
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('invariant: settledCount + pendingCount = totalEnqueued', async () => {
    const totalEnqueued = 20;
    const orig = console.error;
    console.error = () => {};
    const p = pool(3);
    
    for (let i = 0; i < totalEnqueued; i++) {
      p.enqueue(() => {
        if (i % 4 === 0) return Promise.reject(new Error('fail'));
        return Promise.resolve(i);
      });
    }
    
    // Check before starting
    expect(p.settledCount + p.pendingCount).toBe(totalEnqueued);
    
    await p.close();
    console.error = orig;
    
    // Check after close
    expect(p.settledCount + p.pendingCount).toBe(totalEnqueued);
    expect(p.settledCount).toBe(totalEnqueued); // All should be settled
    expect(p.pendingCount).toBe(0); // None should be pending
  });
```

**Why:** Verifies the fundamental completion invariant: all enqueued tasks either settle or remain pending. By end of pool.close(), all must be settled.

**Verification:** Invariant holds before and after execution. At close, all tasks are settled.
  </action>
  <verify>
    <automated>npm test -- --filter="invariant.*settledCount.*pendingCount.*totalEnqueued"</automated>
  </verify>
  <done>Total enqueued invariant test passes</done>
</task>

<task type="auto" tdd="true">
  <name>Task 14: Add test — getters with rejectOnError flag variations</name>
  <files>tests/index.test.ts</files>
  <behavior>
- Test settlement counting with rejectOnError=false (errors wrapped in results): counters should still increment
- Test settlement counting with rejectOnError=true (pool rejects early): counters should still increment up to rejection point
- Verify that error handling mode does NOT affect counter behavior (counters are orthogonal to rejectOnError)
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('getters work correctly with rejectOnError=false (error wrapped)', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2, { rejectOnError: false });
    
    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => Promise.reject(new Error('fail')));
    p.enqueue(() => Promise.resolve(3));
    
    const results = await p.close();
    console.error = orig;
    
    // All 3 tasks settled, regardless of error mode
    expect(p.settledCount).toBe(3);
    expect(p.resolvedCount).toBe(2);
    expect(p.rejectedCount).toBe(1);
    expect(p.pendingCount).toBe(0);
    expect(results.length).toBe(3);
  });

  test('getters update before rejectOnError rejection occurs', async () => {
    const p = pool(2, { rejectOnError: true });
    
    p.enqueue(() => Promise.reject(new Error('fatal')));
    
    try {
      await p.close();
    } catch (e) {
      // Error expected
    }
    
    // Even with rejectOnError=true, the rejection was counted before pool rejected
    expect(p.rejectedCount).toBe(1);
    // Note: pool may not finish executing remaining tasks, but this one was counted
  });
```

**Why:** Ensures counters are independent of error handling mode. rejectOnError affects pool behavior but not counter tracking.

**Verification:** Counters work correctly with both error handling modes.
  </action>
  <verify>
    <automated>npm test -- --filter="getters.*rejectOnError"</automated>
  </verify>
  <done>rejectOnError test passes, counters independent of error mode</done>
</task>

<task type="auto" tdd="true">
  <name>Task 15: Add test — concurrency getter matches configured value</name>
  <files>tests/index.test.ts</files>
  <behavior>
- Create pools with different concurrency values (1, 2, 5, 10, 100)
- Verify concurrency getter returns the exact configured value
- Test with and without explicit options (including autoStart flag)
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('concurrency getter always returns configured value', () => {
    const configs = [1, 2, 5, 10, 100];
    
    for (const conc of configs) {
      const p = pool(conc);
      expect(p.concurrency).toBe(conc);
    }
    
    // Also test with options
    const p1 = pool(3, { autoStart: false });
    expect(p1.concurrency).toBe(3);
    
    const p2 = pool(7, { autoStart: true, rejectOnError: true });
    expect(p2.concurrency).toBe(7);
  });
```

**Why:** Validates that concurrency getter is directly tied to the PoolOptions concurrency field and reflects the actual config.

**Verification:** All concurrency values match configured values.
  </action>
  <verify>
    <automated>npm test -- --filter="concurrency.*configured"</automated>
  </verify>
  <done>Concurrency getter test passes for all configurations</done>
</task>

<task type="auto" tdd="true">
  <name>Task 16: Add test — counters never decrease (monotonicity)</name>
  <files>tests/index.test.ts</files>
  <behavior>
- Track resolvedCount and rejectedCount at multiple points during execution
- Verify they are strictly non-decreasing (monotonic)
- Test with rapid execution and slow tasks
  </behavior>
  <action>
Add test to TEST-08 describe block:

```typescript
  test('resolvedCount and rejectedCount are monotonic (never decrease)', async () => {
    const orig = console.error;
    console.error = () => {};
    const samples: number[] = [];
    const rejSamples: number[] = [];
    
    const p = pool(2);
    p.on('resolve', () => {
      samples.push(p.resolvedCount);
    });
    p.on('error', () => {
      rejSamples.push(p.rejectedCount);
    });
    
    for (let i = 0; i < 8; i++) {
      p.enqueue(() => {
        if (i % 3 === 0) return Promise.reject(new Error('x'));
        return Promise.resolve(i);
      });
    }
    
    await p.close();
    console.error = orig;
    
    // resolvedCount samples should be non-decreasing
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    
    // rejectedCount samples should be non-decreasing
    for (let i = 1; i < rejSamples.length; i++) {
      expect(rejSamples[i]).toBeGreaterThanOrEqual(rejSamples[i - 1]);
    }
  });
```

**Why:** Ensures counters are monotonic (can only stay same or increase, never decrease). This is a fundamental property of aggregate counters.

**Verification:** All samples show non-decreasing sequence.
  </action>
  <verify>
    <automated>npm test -- --filter="monotonic"</automated>
  </verify>
  <done>Monotonicity test passes, counters never decrease</done>
</task>

</tasks>

<verification>
After Wave 3 completion:
- [ ] 7 new test scenarios added (TEST-08 describe block)
- [ ] All tests pass (target: 50+)
- [ ] Invariant tests verify arithmetic: runningCount + waitingCount = pendingCount
- [ ] Invariant tests verify: resolvedCount + rejectedCount = settledCount
- [ ] Invariant tests verify: settledCount + pendingCount = totalEnqueued
- [ ] Lifecycle test verifies getters at all pool states
- [ ] rejectOnError variation tests verify counters work in both modes
- [ ] Concurrency getter tests match config values
- [ ] Monotonicity tests verify counters never decrease
- [ ] No regression in existing tests
- [ ] No TypeScript errors
- [ ] Test output clean (no console pollution)
</verification>

<success_criteria>
**Wave 3 Complete When:**
- 7 new test scenarios with full coverage of introspection getters
- All tests pass (40+ baseline → 50+ total)
- All invariants hold across multiple test checkpoints
- No regressions in existing test suite
- Backward compatibility verified (old `running` and `waiting` getters still work)
- Code clean (no console errors, proper error suppression with console.error override)
</success_criteria>

<output>
After Wave 3 completion, generate `.planning/06-pool-introspection/06-SUMMARY.md` with:
- Overview of all 15 tasks completed
- Interface and implementation changes
- Test results (count of new tests, total tests)
- Design decisions honored
- Backward compatibility confirmation
- Ready for Phase 7 (Timeout Enhancements)
</output>

---

## PHASE 6 COMPLETION CHECKLIST

**Phase Goal:** Add 7 read-only introspection getters for pool health monitoring (concurrency, runningCount, waitingCount, pendingCount, resolvedCount, rejectedCount, settledCount) with comprehensive invariant testing.

**All 15 Tasks:**
- [ ] Wave 1, Task 1: Add #resolvedCount and #rejectedCount private counters
- [ ] Wave 1, Task 2: Increment #resolvedCount in promiseDone()
- [ ] Wave 1, Task 3: Increment #rejectedCount in promiseRejected()
- [ ] Wave 2, Task 4: Add 7 getters to PromisePool interface
- [ ] Wave 2, Task 5: Implement concurrency getter
- [ ] Wave 2, Task 6: Implement runningCount and waitingCount getters
- [ ] Wave 2, Task 7: Implement pendingCount getter
- [ ] Wave 2, Task 8: Implement resolvedCount and rejectedCount getters
- [ ] Wave 2, Task 9: Implement settledCount getter
- [ ] Wave 3, Task 10: Add invariant test — runningCount + waitingCount = pendingCount
- [ ] Wave 3, Task 11: Add invariant test — resolvedCount + rejectedCount = settledCount
- [ ] Wave 3, Task 12: Add lifecycle test — all getters across lifecycle
- [ ] Wave 3, Task 13: Add invariant test — settledCount + pendingCount = totalEnqueued
- [ ] Wave 3, Task 14: Add test — getters with rejectOnError variations
- [ ] Wave 3, Task 15: Add test — concurrency getter matches config
- [ ] Wave 3, Task 16: Add test — counters never decrease (monotonicity)

**Success Criteria:**
- ✅ All 7 getters implemented and exposed in PromisePool interface
- ✅ 2 private counters (#resolvedCount, #rejectedCount) initialized and incremented at correct points
- ✅ All getters are O(1) operations
- ✅ 7 test scenarios (10+ test assertions) covering invariants and lifecycle
- ✅ 50+ total tests passing (up from 41 in Phase 5)
- ✅ Zero breaking changes to existing API
- ✅ Backward compatibility: old `running` and `waiting` getters still work
- ✅ No TypeScript errors or warnings
- ✅ Code follows project conventions (private fields with #, JSDoc, test naming pattern TEST-08)

**Next Phase:** Phase 7 — Timeout Enhancements & Error Context

---
phase: quick-260324-dmw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pool.ts
  - tests/index.test.ts
  - tests/TEST-16-error-propagation.test.ts
  - README.md
autonomous: true
requirements: [UNSUBSCRIBE-01]
must_haves:
  truths:
    - "on() returns a function that, when called, removes the listener and stops future invocations"
    - "once() returns a function that, when called before first fire, prevents the listener from ever firing"
    - "Calling the unsubscribe function after the listener already fired is a no-op"
    - "TypeScript types enforce the () => void return on all interface overloads and the implementation signature"
  artifacts:
    - path: "src/pool.ts"
      provides: "Updated interface overloads and implementation with unsubscribe return"
      contains: "() => void"
    - path: "tests/index.test.ts"
      provides: "Tests verifying unsubscribe behaviour for on() and once()"
  key_links:
    - from: "PromisePool interface (on/once overloads)"
      to: "PromisePoolImpl.on/once implementation"
      via: "return type () => void"
      pattern: "\\(\\) => void"
---

<objective>
Make `on()` and `once()` return an unsubscribe function (`() => void`) that removes the
registered listener from `#listeners` when invoked.

Purpose: Allows callers to deregister event listeners without an explicit `off()` method,
following the idiomatic pattern used by Node.js EventEmitter alternatives and browser APIs.
Output: Updated `src/pool.ts`, new unsubscribe tests in `tests/index.test.ts`, stale comment
removed from `tests/TEST-16-error-propagation.test.ts`, README Events section updated.
</objective>

<context>
@src/pool.ts
@tests/index.test.ts
@tests/TEST-16-error-propagation.test.ts
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update interface overloads and class implementation in src/pool.ts</name>
  <files>src/pool.ts</files>
  <action>
    In the `PromisePool` interface, change all three `on()` overload signatures to return
    `() => void` instead of `void` (three lines, each ending in `): void;` → `): () => void;`).
    Do the same for all three `once()` overloads.

    In `PromisePoolImpl`, change the three overload signatures for `on()` and `once()` the same way.

    Update the generic implementation bodies so they return the unsubscribe closure:

    ```ts
    on(type: POOL_EVENT_TYPE, cb: (...args: any[]) => void): () => void {
      (this.#listeners[type] ??= new Map()).set(cb, false);
      return () => this.#listeners[type]?.delete(cb);
    }

    once(type: POOL_EVENT_TYPE, cb: (...args: any[]) => void): () => void {
      (this.#listeners[type] ??= new Map()).set(cb, true);
      return () => this.#listeners[type]?.delete(cb);
    }
    ```

    No other code changes required — `#emit` already handles Map deletion internally.
  </action>
  <verify>
    <automated>pnpm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    TypeScript build succeeds with zero errors; interface and class both declare `() => void`
    return type for all on()/once() overloads.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add unsubscribe tests and fix stale comment</name>
  <files>tests/index.test.ts, tests/TEST-16-error-propagation.test.ts</files>
  <behavior>
    - on() returns a function
    - Calling that function stops the listener from firing on subsequent events
    - once() returns a function
    - Calling that function before first fire prevents the listener from ever firing
    - Calling the unsubscribe after once() already fired is a no-op (no crash, no double removal)
    - Unsubscribing one listener does not affect other listeners on the same event
  </behavior>
  <action>
    In `tests/index.test.ts`, add a `describe('unsubscribe (on / once return value)')` block
    after the existing `on` / `once` tests (around line 170), with the following test cases:

    1. `on() — unsubscribe stops future invocations`:
       Register listener, call event once (count=1), unsubscribe, call event again, assert count still 1.

    2. `on() — unsubscribing one listener does not affect others`:
       Register two listeners on same event, unsubscribe first, fire event, assert second still fires.

    3. `once() — unsubscribe prevents the listener from firing`:
       Register once listener, call returned unsubscribe, fire event, assert listener never fired.

    4. `once() — unsubscribe after already fired is a no-op`:
       Register once listener, fire event (count=1), call unsubscribe, fire again, assert count still 1
       and no error thrown.

    In `tests/TEST-16-error-propagation.test.ts` at line 255, remove (or replace) the comment:
    `// Note: There's no off() method to unregister, only on() and once()`
    with:
    `// Listeners can be removed via the unsubscribe function returned by on() / once()`
  </action>
  <verify>
    <automated>pnpm run test 2>&1 | tail -20</automated>
  </verify>
  <done>
    All tests pass; the new unsubscribe describe block contains ≥ 4 passing tests; stale comment
    in TEST-16 is updated.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update README Events section</name>
  <files>README.md</files>
  <action>
    In the `### Events` section (around line 134), update the introductory sentence to mention
    the returned unsubscribe function:

    **Before:**
    > Use `pool.on(event, callback)` or `pool.once(event, callback)` to listen for lifecycle events.

    **After:**
    > Use `pool.on(event, callback)` or `pool.once(event, callback)` to listen for lifecycle events.
    > Both methods return an **unsubscribe function** (`() => void`) — call it to remove the listener.

    Also add a short code snippet immediately after the event table demonstrating unsubscribe:

    ```js
    // Remove a listener when it's no longer needed
    const unsub = jobPool.on('next', () => console.log('slot freed'));
    // ...later:
    unsub(); // listener is removed, no further invocations
    ```
  </action>
  <verify>
    <automated>grep -n "unsubscribe" README.md</automated>
  </verify>
  <done>README contains at least one mention of "unsubscribe" in the Events section.</done>
</task>

</tasks>

<verification>
```
pnpm run build && pnpm run test
```
All 144+ tests pass, TypeScript build is clean, `grep "unsubscribe" README.md` returns ≥ 1 result.
</verification>

<success_criteria>
- `on()` interface overloads return `() => void` (3 overloads in interface + 3 in class)
- `once()` interface overloads return `() => void` (3 overloads in interface + 3 in class)
- Implementation bodies return a closure that calls `#listeners[type]?.delete(cb)`
- ≥ 4 new tests in `tests/index.test.ts` cover unsubscribe behaviour for `on()` and `once()`
- Stale "no off() method" comment in TEST-16 updated
- README Events section mentions the returned unsubscribe function
- `pnpm run build && pnpm run test` exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/260324-dmw-on-and-once-return-unsubscribe-function-/260324-dmw-SUMMARY.md`
</output>

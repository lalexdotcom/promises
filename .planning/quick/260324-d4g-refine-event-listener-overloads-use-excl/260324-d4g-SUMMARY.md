---
quick_id: 260324-d4g
date: 2026-03-24
commit: d6dcd22
status: complete
---

## Summary

Refined the `on()` and `once()` overloads in both the `PromisePool` interface and `PromisePoolImpl` class:

1. **`Exclude<POOL_EVENT_TYPE, 'resolve' | 'error'>`** replaces the explicit union `'start' | 'full' | 'next' | 'close' | 'available'` for the generic no-arg case. New event types added to `POOL_EVENT_TYPE` automatically get the correct typing.

2. **Removed `context?: PoolEventContext`** from the `'error'` event callback signature. Pool state is now accessed via introspection getters (`pool.runningCount`, `pool.waitingCount`, etc.) inside the callback, which is cleaner and avoids snapshot allocation on every rejection.

3. **promiseRejected()** no longer builds a `PoolEventContext` object — `this.#emit('error', error)` now has one argument.

4. **Tests updated:**
   - `tests/index.test.ts`: removed `PoolEventContext` import, rewrote error context tests to use getters, added `@ts-expect-error` for 2-arg error callback
   - `tests/TEST-16-error-propagation.test.ts`: rewrote "Error Event Context" describe block as "Error Handling via Getters"
   - `README.md`: updated Pattern 3 example to use pool getters

## Results

- 148 tests passing (was 147 — +1 new @ts-expect-error test)
- `tsc --noEmit` — zero errors

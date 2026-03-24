---
created: 2026-03-24T07:41:17.163Z
title: Redesign 'resolve' event — fire per-promise, not pool-wide
area: features
files:
  - src/pool.ts#100-120
  - tests/index.test.ts
---

## Problem

The 'resolve' event was implemented in v1.0 to fire when the pool itself completes (all tasks done, pool closed). This is semantically incorrect for event-driven programming. Users need to react to individual promise resolution with their results — not just pool completion.

Current behavior: user gets one 'resolve' event at the end.  
Desired behavior: user gets 'resolve' event for each promise that completes, containing the result of that promise.

This should emit just before the 'next' event in the task completion flow.

## Solution

Modify `#runNext()` in `src/pool.ts`:
1. When a promise completes successfully, emit `'resolve'` with the result
2. Timing: after adding promise result to `#results`, before emitting 'next'
3. Event signature: `pool.on('resolve', (result: unknown) => {...})`
4. Update tests to verify resolve fires per-promise, not per-pool
5. Update README and JSDoc to reflect correct semantics

Related to Phase 7 error handling — similar pattern for 'error' event (per-rejection).

## Impact

- Fixes event semantics for v1.1
- Aligns with common event pattern: one event per lifecycle transition
- Enables real-time result streaming patterns
- Blocks Phase 5 (Backpressure) work until decided

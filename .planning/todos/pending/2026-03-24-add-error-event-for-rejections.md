---
created: 2026-03-24T07:41:17.163Z
title: Add 'error' event for promise rejection with state context
area: features
files:
  - src/pool.ts#200-220
  - tests/index.test.ts
---

## Problem

Currently, when a promise in the pool rejects, the event system doesn't emit anything. Users have no way to react in real-time to failures. The error is silently stored in results (if rejectOnError=false) or thrown (if rejectOnError=true), but no event fires.

Event-driven applications need to observe rejections as they happen, particularly for:
- Logging/monitoring per-rejection (not just final result)
- Immediate error recovery (retry) patterns
- Debugging (correlate error with pool state at failure time)

## Solution

Add new event type: `'error'` to POOL_EVENT_TYPE

Semantics (recommended):
1. When a promise rejects, always emit `'error'` event with:
   - The error object/reason
   - Optional pool state context (queueSize, pendingCount at rejection time)
2. After event fires, respect rejectOnError flag:
   - If rejectOnError=false: error goes to results array
   - If rejectOnError=true: error is stored AND pool will reject on close

Event signature: `pool.on('error', (error: unknown, context?: PoolState) => {...})`

Implement in `promiseRejected()` method in `src/pool.ts`:
1. Emit 'error' with error + optional state snapshot
2. Then proceed with existing rejectOnError logic

Update tests, README, and JSDoc with 'error' event documentation.

## Impact

- Completes event-driven API for v1.1 Phase 7 (Error Context)
- Enables real-time error monitoring and recovery patterns
- Aligns with 'resolve' event semantics (per-promise, not pool-wide)

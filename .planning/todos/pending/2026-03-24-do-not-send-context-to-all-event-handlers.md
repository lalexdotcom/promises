---
created: 2026-03-24T14:30:00.000Z
title: Do not send context to all event handlers to avoid overhead
area: architecture
files:
  - src/pool.ts:89-106 (on/once methods)
  - src/pool.ts:313-338 (promiseRejected with context)
---

# Do not send context to all event handlers to avoid overhead

## Decision

**Decision:** Pool lifecycle events ('start', 'full', 'next', 'close', 'available') will NOT receive `PoolEventContext` parameter. Only the `'error'` event (and optionally `'resolve'`) will include context.

**Date:** 2026-03-24  
**Status:** ✅ LOCKED (Phase 5-6 implementation complete)

## Rationale

### Problem with Universal Context Passing
Broadcasting `PoolEventContext` to all 7 event types would:
- Allocate new context object on every lifecycle event (start, full, next, close, available)
- Add unnecessary overhead for events that don't require pool state visibility
- Break existing callback signatures (all handlers must now accept context parameter)
- Create maintenance burden: syncing context updates across all emission points

### Current Best Practice (Implemented)
**Selective context passing:**
- `'error'` event: Always receives `PoolEventContext` (essential for debugging rejections)
- `'resolve'` event: Receives result value only (payload contains all needed info)
- Other lifecycle events: No payload (only signals state transitions)
- **Advanced user requirement:** Use Phase 6 getters to poll pool state when needed

### Cost-Benefit Analysis
| Approach | Overhead | Benefit | Verdict |
|----------|----------|---------|---------|
| Context on all events | High (object alloc × events) | Low (users can use getters) | ❌ Not worth it |
| Context on error only | Low (rare rejections) | High (debugging essential) | ✅ Chosen |
| Getters for state | None (lazy evaluation) | High (user-controlled) | ✅ Phase 6 solution |

## Implementation (Phase 5-6 Complete)

**Phase 5 (Events):**
- `'error'` event: Receives `(error, context: PoolEventContext)` at rejection time
- `'resolve'` event: Receives `(result)` at resolution time
- Other events: No parameters, just signal pool state changes

**Phase 6 (Getters):**
- Added 7 read-only getters for complete pool state visibility (O(1))
- Users can poll state via: `pool.runningCount`, `pool.settledCount`, etc.
- Eliminates need for context broadcasting — efficient lazy-evaluation pattern

## Why This Wins

1. **Zero overhead:** No object allocation for events that don't need it
2. **Backward compatible:** Existing callback signatures unchanged
3. **User flexibility:** Advanced monitoring via getters + error context
4. **Clean API:** Each event carries only needed information
5. **Performance:** No allocation churn on hot paths (start, full, next, close)

## Future Considerations

- If users request monitoring of all event state: they have Phase 6 getters + 'error' context
- If events need richer context post-v1.1: can add as optional parameter in v1.2+ without breaking v1.1
- Type overloads for on()/once() (see separate todo) would help clarify event signatures

## Status

**Enforced:** This decision is locked for v1.1. No changes to event context broadcasting planned.

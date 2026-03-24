---
created: 2026-03-24T14:25:00.000Z
title: Pass PoolEventContext to all events
area: api
files:
  - src/pool.ts:13-31 (PoolEventContext interface)
  - src/pool.ts:89-106 (on/once method signatures)
  - src/pool.ts:313-338 (promiseDone/promiseRejected)
---

# Pass PoolEventContext to all events

## Problem

Currently, `PoolEventContext` (pool state snapshot) is only provided with the `'error'` event callback:
```typescript
'error': (error: unknown, context?: PoolEventContext) => void
```

All other event callbacks have no context parameter:
```typescript
'start' | 'full' | 'next' | 'close' | 'available' | 'resolve': () => void
```

This forces users to implement their own polling or tracking of pool state when monitoring pool behavior via other events. For advanced monitoring patterns (e.g., logging state transitions, metrics collection), users need visibility into concurrency, queueing status, and settlement counts at event time.

## Solution Proposal

Enrich all event types with consistent context parameter:
```typescript
// All events receive optional context
'start': (context: PoolEventContext) => void
'full': (context: PoolEventContext) => void
'next': (context: PoolEventContext) => void
'close': (context: PoolEventContext) => void
'available': (context: PoolEventContext) => void
'resolve': (result: unknown, context: PoolEventContext) => void
'error': (error: unknown, context: PoolEventContext) => void
```

**Benefits:**
- Consistent event observer API (all events follow same pattern)
- Users can detect pool state anomalies from any event
- Enables advanced monitoring and metrics at event sites
- Supports audit/logging patterns (state snapshot on every transition)

**Trade-offs:**
- Breaking change to callback signatures (Phase 5 'resolve' currently has no context param)
- Requires function overload improvements (see: Improve on()/once() typing with overloads)
- Overhead: constructing context object on every event emission

## Timing & Scope

**Not blocking:** Current Phase 5 release (events already functional without context)  
**Candidate for:** Phase 9 (Quality & Polish) or Phase 7 (refactor event system)  
**Breaking change:** Yes — requires version bump (v1.1 → v1.2 if breaking)

## Related Todos

- See: "Improve on() and once() event listener typing with overloads" — prerequisite for proper typing
- Related to: Phase 5 complete (resolve/error events already delivered)

## Status

**Deferred:** Evaluate after Phase 6-8 execution. Assess whether breaking change is justified vs. new major version.

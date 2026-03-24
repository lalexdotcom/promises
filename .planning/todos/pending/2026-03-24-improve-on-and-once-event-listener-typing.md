---
created: 2026-03-24T14:20:00.000Z
title: Improve on() and once() event listener typing with overloads
area: api
files:
  - src/pool.ts:89-106
---

# Improve on() and once() event listener typing with overloads

## Problem

Current `on()` and `once()` signatures accept `(...args: unknown[]) => void`, which loses type information at the call site. TypeScript cannot verify callback signatures match the emitted event type.

Example issue:
```typescript
pool.on('resolve', (result: unknown) => { }); // Type-safe ✅
pool.on('resolve', (result: string, extra: number) => { }); // Should error ❌ but doesn't
pool.on('error', (err: unknown) => { }); // Missing required context param ❌ but doesn't error
```

## Solution

Use TypeScript function overloads to define precise callback signatures per event type:

**Required callback signatures (per event):**
- `'start'`, `'full'`, `'next'`, `'close'`, `'available'`: `() => void`
- `'resolve'`: `(result: unknown) => void`
- `'error'`: `(error: unknown, context?: PoolEventContext) => void`

**Return type consideration:**
- Current: `void`
- Proposed: `() => void` (unsubscribe function) — enables `off()` pattern without breaking backward compat if default returns no-op

## Implementation Notes

- Phase 9 (Quality & Polish) candidate, not blocking Phase 6
- May be breaking change if return type changes from `void` to function
- Consider `Overload<T>` utility pattern or `type EventListenerMap` pattern
- Validate with strict TypeScript compiler

## Status

**Deferred:** Not blocking v1.1 event implementation (Phase 5 complete). Evaluate for Phase 9 quality improvements or v1.2 polish.

---
created: 2026-03-24T07:41:17.163Z
phase: 5
title: Event-Driven Pool (Resolve & Error Events)
---

# Phase 5 Context — Design Decisions

## Goal

Implement two new event types (`'resolve'` and `'error'`) to enable event-driven error handling and per-promise result reactions. Rejects `maxQueueSize` backpressure option (concurrency already provides this control).

## Design Decisions

<canonical_refs>
- `.planning/REQUIREMENTS.md` — FR-1, FR-2, QR-1, QR-3 (resolve event, error event, tests, docs)
- `.planning/ROADMAP.md` — Phase 5 specification
- `src/pool.ts` — PromisePool implementation (promiseRejected, runNext methods)
- `.github/skills/gsd-next/SKILL.md` — Next workflow routing
</canonical_refs>

### D1: 'resolve' Event Semantics

**Decision:** `'resolve'` event fires **per-promise** when that promise resolves, carrying the result value.

**Rationale:**
- Already claimed in v1.0 (TODO-01 design todo captured)
- Event-driven apps need to react to individual resolutions, not pool completion
- Aligns with common pub/sub pattern: one event per state change
- Enables streaming results pattern (react as each promise completes)

**Implementation Details:**
- Event type: `type EventPayload<T = unknown> = { type: 'resolve'; data: T } | ...`
  - Or simpler: callback signature is `(result: unknown) => void` for resolve listener
- Timing: **after storing result in `#results`**, **before** `'next'` event
- No duplicate events: exactly one resolve per promise (tracked by index)
- Works across all pool states, including auto-started pools

**Testing:**
- Unit: enqueue 10 tasks → verify 10 resolve events fire with correct results in order
- Integration: mixed success/rejection pool → resolve events only for successful tasks
- Ordering: resolve→next→... sequence per task

---

### D2: 'error' Event Semantics

**Decision:** `'error'` event fires **per-promise** when that promise rejects, **always** emitted (regardless of rejectOnError flag).

**Rationale:**
- Already claimed in v1.0 (TODO-02 design todo captured)
- User choice to emit first, then respect rejectOnError — prevents silent failures
- Event context enables debugging: pool state at rejection time (queueSize, pendingCount)
- Decouples error notification from error semantics (rejectOnError behavior unchanged)

**Implementation Details:**
- Event type: callback signature is `(error: unknown, context?: object) => void`
- Context object (optional): `{ queueSize, pendingCount, isStarted, isClosed, isResolved }`
- Timing: **in `promiseRejected()` method**, before respecting rejectOnError flag
- Always fires: if `rejectOnError=false` → error to results; if `rejectOnError=true` → error to results AND pool rejects on close
- No change to existing rejectOnError behavior

**Testing:**
- Unit: enqueue 10 tasks where 5 fail → verify 5 error events with correct error objects
- Context validation: error event context includes accurate pool state
- Integration: rejectOnError=true case → error event fires, then pool.close() rejects with error
- Edge case: rapid failures → no duplicate error events per promise

---

### D3: Rejection of maxQueueSize Option

**Decision:** Do **NOT** implement `maxQueueSize` option. Reject it from v1.1 spec.

**Rationale:**
- User clarification (March 24, 2026): "concurrency already handles limiting, maxQueueSize is redundant"
- Pool behavior: `concurrency=N` already limits parallel tasks; remaining tasks naturally queue
- Attempting to fail enqueue() when queue is large (maxQueueSize) misunderstands pool design
  - Pool doesn't "pause" enqueueing — it just queues tasks until slots free
  - This is the correct behavior; no need for explicit backpressure option
- Scope was overspecified; removing it simplifies Phase 5 to core event improvements

**Deferred Ideas:**
- Backpressure pattern can be implemented by user: `pool.on('full', () => { pause_enqueueing() })`
- If max queue size needed in future, consider as v1.2 feature with different semantics

---

### D4: POOL_EVENT_TYPE Extension

**Decision:** Add `'resolve'` and `'error'` to POOL_EVENT_TYPE union type.

**Rationale:**
- Maintains type safety for event listeners (on(), once() methods)
- JSDoc can document each event type and payload signature
- TypeScript autocomplete shows all available events

**Implementation:**
```typescript
type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available' | 'resolve' | 'error';
```

---

### D5: Error Context vs PoolError Type

**Decision:** Include context in `'error'` event arguments, NOT in PoolError type modification.

**Rationale:**
- PoolError already exists (v1.0); adding fields would be backward-compatible but increases surface
- Error event provides context naturally (as second argument to listener callback)
- Cleaner design: error is error; context is listener's choice to read or ignore
- Simplifies testing: verify context is accurate, not buried in PoolError properties

**Note:** PoolError remains unchanged from v1.0. Future versions can enrich if needed.

---

## Testing Strategy

**Test additions (brings total from 31 to 40+):**
- `test('resolve event fires per promise with result')` — 10 tasks → 10 events
- `test('resolve event fires before next event')` — ordering invariant
- `test('error event fires per rejection')` — rejection detection
- `test('error event fires regardless of rejectOnError flag')` — semantic test
- `test('error event context includes accurate pool state')` — context validation
- `test('mixed resolve and error events in single pool')` — integration test
- Edge cases: rapid succession, task ordering, listener cleanup

---

## Downstream Impact

**Files to modify:**
- `src/pool.ts`: promiseRejected() method → emit 'error' event before error handling
- `src/pool.ts`: runNext() method → emit 'resolve' event after storing result
- `src/index.ts`: POOL_EVENT_TYPE export updated
- `tests/index.test.ts`: 7+ new test cases added

**Documentation:**
- `README.md`: Events section updated (add 'resolve' and 'error' descriptions)
- JSDoc: on() and once() methods document new event types
- Advanced Patterns section: error recovery example using 'error' event

**No breaking changes** — new events are additions; existing events unchanged.

---

## Success Criteria

- [ ] 'resolve' event emits per promise before 'next'
- [ ] 'error' event emits per rejection always
- [ ] Error context provided in event listener callback
- [ ] All 40+ tests passing
- [ ] TypeScript types accurate (extends POOL_EVENT_TYPE with resolve/error)
- [ ] Zero regression in existing tests
- [ ] Documentation (README Events section) complete

---

**Created:** 2026-03-24  
**Phase:** 5  
**Status:** Ready for planning (`/gsd-plan-phase 5`)

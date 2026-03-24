# ROADMAP — promises

## Milestones

- ✅ **v1.0 — Publication-Ready Library** ([Archived](milestones/v1.0-ROADMAP.md)) — Shipped 2026-03-24
- 🔄 **v1.1 — Balanced Enhancements** (5 phases, 3-4 weeks) — In Progress

---

## v1.1 Phases

### 5. Event-Driven Pool (Resolve & Error Events)

**Goal:** Add `'resolve'` event (per-promise resolution with result) and `'error'` event (per-promise rejection with context).

**Key Changes:**
- Implement `'resolve'` event: fires when each promise resolves (before 'next')
- Implement `'error'` event: fires when each promise rejects (always, regardless of rejectOnError)
- Enhance 'error' event with optional context field (queueSize, pendingCount at rejection time)
- Update POOL_EVENT_TYPE, JSDoc, TypeScript types
- Add comprehensive tests for both events

**Testing:** Per-promise event firing, result/error payload validation, event ordering  
**Deliverable:** `src/pool.ts` updated, tests passing (40+), event documentation

---

### 6. Pool Introspection & Health Monitoring

**Goal:** Add read-only getters for comprehensive pool health monitoring: configuration, execution state, and settlement tracking.

**Key Changes:**
- Add getter `concurrency: number` (max concurrent promises from PoolOptions)
- Add getter `runningCount: number` (promises in-flight, not yet settled)
- Add getter `waitingCount: number` (promises enqueued but not yet started)
- Add getter `pendingCount: number` (total not yet settled = running + waiting)
- Add getter `settledCount: number` (total that have settled = resolved + rejected)
- Add getter `resolvedCount: number` (promises resolved successfully, tracked via `#resolvedCount`)
- Add getter `rejectedCount: number` (promises rejected, tracked via `#rejectedCount`)
- O(1) implementation via direct counters and array.length
- Test state transition invariants: waitingCount + runningCount + settledCount = totalEnqueued

**Testing:** Getter accuracy across full lifecycle, settlement tracking validation, no performance impact  
**Deliverable:** `src/pool.ts` getters, counter tracking in promiseDone/promiseRejected, tests passing (40+)

---

### 7. Timeout Enhancements & Error Context

**Goal:** Improve error debugging — TimeoutError includes timeout value + promise context.

**Key Changes:**
- Enhance `TimeoutError` with optional `timeout: number` and `promise: unknown` fields
- Document timeout composition patterns
- Advanced timeout examples in README

**Testing:** Error context accuracy from 'resolve' events with error wrapping  
**Deliverable:** Updated TimeoutError type, timeout composition examples

---

### 8. Performance Optimization & Memory Audit

**Goal:** Batch task scheduling, validate memory efficiency, benchmark performance.

**Key Changes:**
- Refactor `#runNext()` batching (reduce event loop churn)
- Explicit listener cleanup in `close()`
- Memory leak detection tests
- Performance benchmarks (informational)

**Testing:** No regression post-refactor, leak tests, benchmark results  
**Deliverable:** Optimized scheduler, performance validation

---

### 9. Edge Case Expansion & Documentation Polish

**Goal:** Expand test suite to 40+ tests, finalize documentation, validate TypeScript strict mode.

**Key Changes:**
- Boundary tests (concurrency extremes, timeout extremes)
- Malformed input tests (null options, NaN values)
- Rapid lifecycle tests (start→close, back-to-back enqueues)
- Advanced Patterns section in README (5+ patterns)
- TypeScript strict mode validation

**Testing:** 40+ total tests passing, zero TypeScript strict errors  
**Deliverable:** Release-ready codebase, comprehensive documentation

---

## v1.2+ (Deferred)

- AsyncIterator / Stream API — Requires DX research for async iteration patterns
- Retry strategies — Users can re-enqueue failed tasks for now
- Batch result streaming — Revisit after AsyncIterator design
- Plugin/middleware system — Maintain simplicity, low demand

---

**Updated:** 2026-03-24 — v1.1 milestone initialized with 5 balanced phases

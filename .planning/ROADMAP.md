# ROADMAP — promises

## Milestones

- ✅ **v1.0 — Publication-Ready Library** ([Archived](milestones/v1.0-ROADMAP.md)) — Shipped 2026-03-24
- 🔄 **v1.1 — Balanced Enhancements** (5 phases, 3-4 weeks) — In Progress

---

## v1.1 Phases

### 5. Backpressure Control System

**Goal:** Add `maxQueueSize` option + paused/resumed event signaling + introspection getters (queueSize, pendingCount, isBackpressured).

**Key Changes:**
- Implement `maxQueueSize?: number` option (default: unbounded)
- `enqueue()` returns `false` when backpressure reached (no throw)
- Emit `'paused'` and `'resumed'` events
- Add three new getters: `queueSize`, `pendingCount`, `isBackpressured`

**Testing:** Boundary conditions, rapid pause/resume, queue overflow scenarios  
**Deliverable:** `src/pool.ts` updated, tests passing, README section added

---

### 6. Queue Introspection & Health Monitoring

**Goal:** Validate getters work reliably across pool lifecycle, confirm O(1) performance.

**Key Changes:**
- Test state transition invariants (queueSize + pendingCount accounting)
- Performance validation (no overhead from getters)
- Monitoring pattern documentation

**Testing:** Getter accuracy during start→full→next→close, invariant checks  
**Deliverable:** Complete test coverage, health monitoring example

---

### 7. Timeout Enhancements & Error Context

**Goal:** Improve error debugging with rich context — TimeoutError includes timeout value, PoolError includes pool state at failure.

**Key Changes:**
- Enhance `TimeoutError` with optional `timeout` and `promise` fields
- Enhance `PoolError` with optional `state` context (queue/pending/flags)
- Document timeout composition patterns

**Testing:** Error context accuracy, state snapshot validation  
**Deliverable:** Updated error types, error recovery examples in README

---

### 8. Performance Optimization & Memory Audit

**Goal:** Batch task scheduling in single microtask, validate memory efficiency, benchmark timeout overhead.

**Key Changes:**
- Refactor `#runNext()` batching (reduce event loop churn)
- Explicit listener cleanup in `close()`
- Memory leak detection tests
- Performance benchmarks (informational)

**Testing:** No regression post-refactor, leak test confirms clean shutdown  
**Deliverable:** Optimized scheduler, performance benchmarks, space complexity guarantee documented

---

### 9. Edge Case Expansion & Documentation Polish

**Goal:** Expand test suite to 40+ tests, finalize all documentation, validate TypeScript strict mode.

**Key Changes:**
- Boundary tests (concurrency extremes, queueSize extremes)
- Malformed input tests (negative/NaN timeouts)
- Rapid lifecycle tests (start→close, back-to-back enqueues)
- Complete README with Advanced Patterns section
- TypeScript strict mode validation

**Testing:** 40+ total tests passing, zero TypeScript strict errors  
**Deliverable:** Release-ready codebase, comprehensive documentation, ready for npm publish

---

## v1.2+ (Deferred)

- AsyncIterator / Stream API — Requires DX research for async iteration patterns
- Retry strategies — Users can re-enqueue failed tasks for now
- Batch result streaming — Revisit after AsyncIterator design
- Plugin/middleware system — Maintain simplicity, low demand

---

**Updated:** 2026-03-24 — v1.1 milestone initialized with 5 balanced phases

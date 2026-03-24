# v1.1 Requirements — Balanced Enhancements

**Milestone Goal:** Enhance pool performance, add backpressure control, improve quality through edge case testing and better error context — while maintaining strict backward compatibility with breaking-change-allowed policy (v1.x minor bumps).

**Scope:** 4-6 focused phases (~3-4 weeks) mixing features, performance, and quality improvements.

**Target:** Node.js 18+ and modern browsers equally. Lean into event-driven backpressure signaling.

---

## Functional Requirements

### FR-1: Backpressure Control (Feature)

**User Story:** As a batch processor handling unbounded workloads, I need to pause enqueueing when the queue grows too large, preventing memory bloat.

**Acceptance Criteria:**
- [ ] Add `maxQueueSize?: number` option to `PoolOptions` (default: unbounded/Infinity)
- [ ] When queue reaches `maxQueueSize`, `enqueue()` returns `false` (fail silently, no throw)
- [ ] Emit `'paused'` event when enqueue fails due to backpressure
- [ ] Emit `'resumed'` event when queue drops below threshold and enqueue succeeds again
- [ ] Getter `isBackpressured: boolean` reflects current state
- [ ] Event firing order invariant: paused→resumed→paused only (no duplicates)
- [ ] Works with both `autoStart: true` and `autoStart: false`
- [ ] `close()` clears paused state (no dangling resumed events after close)

**Testing:**
- Batch workload test with bounded queue + success callback on resumed
- Verify no message loss if user re-enqueues failed tasks
- Edge case: `maxQueueSize` of 0 (max rejection), large sizes (millions)

**Backward Compat:** Adding optional option = no breaking change.

---

### FR-2: Queue Introspection Getters (Feature)

**User Story:** As a system monitoring pool health, I need read-only insight into current queue and pending task counts.

**Acceptance Criteria:**
- [ ] Add getter `queueSize: number` — current count of enqueued-but-not-started tasks
- [ ] Add getter `pendingCount: number` — current count of started-but-not-finished tasks  
- [ ] Add getter `isBackpressured: boolean` — true if queue at or exceeds maxQueueSize
- [ ] All three getters return accurate numbers reflecting pool state at call time
- [ ] Getters work across all pool states (not-started, running, paused, closed)
- [ ] No performance regression from adding these (O(1) lookups via Map.size)

**Testing:**
- Invariant test: queueSize + pendingCount + (completed so far) = totalEnqueued
- State-transition test: verify getters update correctly during start→full→close lifecycle

**Backward Compat:** Adding getters = no breaking change.

---

### FR-3: Extended Timeout Control (Feature)

**User Story:** As a timeout-sensitive application, I need finer control over deadline propagation and timeout error context.

**Acceptance Criteria:**
- [ ] Enhance `TimeoutError` with optional `timeout: number` and `promise: unknown` fields for context
- [ ] `timeout(promise, delay)` now includes these fields in thrown `TimeoutError`
- [ ] Document timeout composition pattern: chaining `timeout()` calls or wrapping pool operations with deadline
- [ ] Clarify in JSDoc: when pool itself has timeout (per enqueue) vs global timeout (wrap the whole pool)
- [ ] Example in README: "timeout a pool" pattern with retry/fallback

**Testing:**
- Verify TimeoutError includes timeout duration and promise context
- Nested timeout test: inner timeout fires before outer (correct precedence)

**Backward Compat:** New fields on error type are optional = backward compatible.

---

### FR-4: Backpressure Documentation (Feature)

**User Story:** As a developer learning advanced pool features, I need clear guidance on when and how to use backpressure.

**Acceptance Criteria:**
- [ ] Add section in README under "Advanced Usage" → "Backpressure & Flow Control"
- [ ] Explain maxQueueSize, paused/resumed events, and enqueue return value semantics
- [ ] Example: HTTP client limiting concurrent requests while respecting queue bounds
- [ ] Example: Batch job processor pausing uploads when memory queue exceeds threshold
- [ ] Link to specific events in API table ("paused", "resumed")
- [ ] Show how to implement retry-on-backpressure pattern

**Testing:**
- Docs are consumable (no invalid API references)
- Examples are runnable and tested as part of test suite (or doc-tests)

---

## Performance Requirements

### PR-1: Microtask Batching Optimization (Performance)

**User Story:** As a high-throughput user, I need runNext scheduler to batch up multiple task starts in single microtask, reducing event loop churn.

**Acceptance Criteria:**
- [ ] Refactor `#runNext()` batching: collect all available slot fills into array, emit events once batch done, not per-task
- [ ] Benchmark: measure scheduling overhead before/after with 1000-task workload at concurrency=10
- [ ] Target: ≤10% improvement in wall-clock time for high-concurrency scenarios (acceptable trade-off for code clarity if minimal impact)
- [ ] No change to external behavior — events still fire in correct order, results still accurate

**Testing:**
- Existing tests must still pass
- Performance test (non-blocking, informational): log before/after times
- Verify event counts don't change (no dropped/duplicate events)

---

### PR-2: Memory Efficiency Validation (Performance)

**User Story:** As a long-running server, I need confidence that the pool doesn't accumulate hidden leaks or unbounded growth.

**Acceptance Criteria:**
- [ ] Audit codebase for potential leaks (event listener cleanup, callback references, Map growth)
- [ ] Add explicit cleanup in `close()` if any listeners remain: `#listeners.clear()`
- [ ] Test scenario: enqueue 10k tasks, close pool → verify listeners Map is empty
- [ ] Memory snapshot test (optional): enqueue+drain+close cycle, measure heap delta
- [ ] Document O(concurrency) space complexity guarantee in JSDoc

**Testing:**
- Leak detection test: add listener, close pool, verify listener removed
- Long-running stress test: 100k+ tasks over time, no unbounded heap growth

---

### PR-3: Timeout Implementation Optimization (Performance)

**User Story:** As a timeout-heavy application (many per-task deadlines), I need minimal overhead from per-task timeout wrapping.

**Acceptance Criteria:**
- [ ] Current `timeout()` uses `Promise.race()` which creates intermediate promise — acceptable
- [ ] Optimize TimeoutError creation to avoid unnecessary stack traces in non-error path
- [ ] Document: timeout checking is done via Promise.race, not polling (O(tasks) overhead, not O(concurrency))
- [ ] Benchmark reveals typical timeout overhead per 1000 operations (informational)

**Testing:**
- Verify TimeoutError stack trace is clean and useful for debugging
- High-timeout-load test: 1000 tasks with 10s timeout each, should complete in <2s (not waiting for all timeouts)

---

## Quality Requirements

### QR-1: Edge Case Test Expansion (Quality)

**User Story:** As a maintainer, I need comprehensive edge case coverage to catch subtle bugs before they reach users.

**Acceptance Criteria:**
- [ ] Expand test suite to 40+ test cases (currently 31)
- [ ] New test categories:
  - Boundary: concurrency=1, concurrency=1000, queueSize=0, queueSize=1000000
  - Malformed: negative timeouts, NaN timeout, null options  
  - Rapid lifecycle: start() immediately followed by close(), back-to-back enqueue calls
  - Error propagation: verify rejectOnError=true/false in all pool states
  - Event ordering: verify event sequence invariants (full→next→close, never out of order)
- [ ] All new tests must pass and increase coverage of edge paths
- [ ] No new tests should slow down suite (suite should remain <1s total)

**Testing:**
- Run full test suite (Rstest) → all passing
- Coverage report (nice-to-have): show any previously untested branches now covered

---

### QR-2: TypeScript Strict Mode Validation (Quality)

**User Story:** As a TypeScript user, I want to use this library in strictest TS settings without any looseness.

**Acceptance Criteria:**
- [ ] Run TypeScript compiler with `strict: true` (including strictNullChecks, strictFunctionTypes, etc.)
- [ ] Zero `any` types in public API surface (already done for v1.0)
- [ ] All generic constraints are explicit and documented
- [ ] Verify PoolOptions and PoolError interfaces are fully specified (no implicit any)
- [ ] Test: consume library in user project with `"strict": true` in their tsconfig.json

**Testing:**
- TypeScript compilation: `tsc --strict` zero errors
- Example projects with strict mode enabled build successfully

---

### QR-3: Error Context Enrichment (Quality)

**User Story:** As a debugger, when a promise in the pool rejects, I need to know what state the pool was in to understand why.

**Acceptance Criteria:**
- [ ] Enhance PoolError to include optional `state` context field with snapshot of pool state at error time
  - Fields: `queueSize`, `pendingCount`, `isStarted`, `isClosed`, `isResolved`
- [ ] When emitting error (promiseRejected), capture state snapshot and attach to PoolError
- [ ] PoolError message improved: include queueSize and pendingCount in message if available
- [ ] TimeoutError already has context (timeout value + promise) — verified working

**Testing:**
- Error test verifies PoolError.state contains queue/pending counts
- Stress test: error during high load includes accurate state snapshot

---

### QR-4: Documentation of Advanced Patterns (Quality)

**User Story:** As a power user, I need reference material for off-the-beaten-path use cases.

**Acceptance Criteria:**
- [ ] README section: "Advanced Patterns"
  - Pattern 1: Backpressure (linked to FR-4)
  - Pattern 2: Timeout composition (linked to FR-3)
  - Pattern 3: Error recovery (re-enqueue failed tasks)
  - Pattern 4: Pool composition (pool of pools, or sequence of pools)
- [ ] Each pattern includes runnable example code
- [ ] Link from JSDoc to README sections where relevant
- [ ] No promises made about features not in v1.1 (defer AsyncIterator discussion to v2)

**Testing:**
- Examples are copied into Rstest and run as tests (or at least linted/type-checked)

---

## Non-Functional Requirements

### NFR-1: Build & Compatibility

**Target:** Node.js 18+, modern browsers (ES2020+)

**Acceptance Criteria:**
- [ ] Build produces ESM + CJS with shared TypeScript declarations
- [ ] No new runtime dependencies added (maintain zero-dependency goal)
- [ ] All tests pass on Node.js 18+ (tested locally)
- [ ] Browser compat verified via unpkg/cdn link (minimal test, just loading the library)

---

### NFR-2: Release Readiness

**Acceptance Criteria:**
- [ ] All tests passing: `pnpm run test` → 0 failures
- [ ] All lint/format checks passing: `pnpm run lint` → 0 errors
- [ ] TypeScript compilation clean: `pnpm run build` → 0 errors
- [ ] No manual migration guide needed for v1.0→v1.1 (backward compatible, new features are opt-in)
- [ ] VERSION field in package.json updated (external process, not in scope)

---

## UAT Scenarios

### Scenario 1: Batch Processing with Backpressure

**Given:** HTTP client needs to scrape 100k URLs, memory-limited to 1000 pending requests  
**When:** Backpressure enabled with `maxQueueSize: 10000`  
**Then:** 
- Enqueue succeeds for first 10k URLs
- URL 10001 enqueue returns `false`
- Client observes `'paused'` event
- As tasks complete, queue drains
- `'resumed'` event fires when queue <10k again
- All 100k URLs eventually processed without OOM

---

### Scenario 2: High-Concurrency Health Monitoring

**Given:** Server-side batch processor at concurrency=100  
**When:** Monitoring script calls `queueSize`, `pendingCount` every 100ms  
**Then:**
- Getters reflect accurate counts
- Sum of counts shows work progression
- No performance degradation from frequent polling

---

### Scenario 3: Timeout Semantics

**Given:** API client with 30s timeout per request, pool with 10s timeout per-task option  
**When:** Database query takes 20s  
**Then:**
- Pool-level timeout fires at 10s → TimeoutError with `timeout: 10000`
- If pool timeout didn't exist, API timeout would fire at 30s
- Error context shows which timeout fired

---

### Scenario 4: Error Recovery Pattern

**Given:** Batch job that should retry failed tasks  
**When:** Task fails and has `rejectOnError: false`  
**Then:**
- Pool includes PoolError in results array
- User can inspect error state and re-enqueue same task
- State snapshot in PoolError helps user understand why task failed

---

## Success Metrics

| Metric | v1.0 | v1.1 Target | Notes |
|--------|------|-------------|-------|
| Test count | 31 | 40+ | 9+ new edge case tests |
| Types (any count) | 0 | 0 | Maintain strict typing |
| Build size (ESM) | ~7.2 kB | <8.5 kB | Backpressure logic modest addition |
| API surface (public members) | 12 | 15+ | +3 getters, +2 events, enhanced types |
| JSDoc coverage | 100% | 100% | All new members documented |
| README sections | 5 | 7+ | +Advanced Patterns, +Backpressure |
| Backward compatibility | N/A | 100% | No breaking changes (except removing verbose, already done) |

---

## Deferred to v1.2+

- **AsyncIterator** — complexity requires more DX research; defer to v2+
- **Retry strategies** — out of scope for v1.1; recommend user-side retry loops for now
- **Changelog** — generated externally per author's pipeline
- **Automatic npm publishing** — author handles via external pipeline

---

**Created:** 2026-03-24  
**Next Step:** `/gsd-plan-phase 5` to execute Phase 5 (Backpressure Implementation)

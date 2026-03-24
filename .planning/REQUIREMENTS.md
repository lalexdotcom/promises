# v1.1 Requirements — Event-Driven Enhancements

**Milestone Goal:** Enhance pool with rich event semantics (`'resolve'` per-promise, `'error'` on rejection with context), better error debugging, and comprehensive test coverage — maintaining zero-dependency goal and strict backward compatibility.

**Scope:** 5 focused phases (~3-4 weeks) mixing features, performance, and quality improvements.

**Target:** Node.js 18+ and modern browsers equally. Lean into event-driven patterns.

---

## Functional Requirements

### FR-1: Resolve Event (Per-Promise Resolution Notification)

**User Story:** As an event-driven application, I need to react to each individual promise resolution with its result value — not just pool completion.

**Acceptance Criteria:**
- [ ] Add `'resolve'` event type to POOL_EVENT_TYPE union
- [ ] When a promise resolves successfully, emit `'resolve'` event with the result value
- [ ] Emit timing: immediately after storing result in `#results`, **before** emitting `'next'`
- [ ] Event signature: `pool.on('resolve', (result: unknown) => {...})`
- [ ] Each promise resolution fires exactly one `'resolve'` event (no duplicates)
- [ ] Update JSDoc for `on()` / `once()` to document `'resolve'` event
- [ ] Update POOL_EVENT_TYPE in type definitions

**Testing:**
- Per-promise resolution test: enqueue 10 tasks → verify 10 'resolve' events fire with correct results
- Event ordering: resolve fires before 'next' for each task
- Result value matching: verify event payload matches `#results` array entry

**Backward Compat:** Adding new event type = no breaking change (existing code unaffected).

---

### FR-2: Error Event (Per-Promise Rejection Notification)

**User Story:** As an error-handling application, I need real-time notification when promises reject — not silent storage or propagation.

**Acceptance Criteria:**
- [ ] Add `'error'` event type to POOL_EVENT_TYPE union
- [ ] When a promise rejects, **always** emit `'error'` event with error object
- [ ] Event signature: `pool.on('error', (error: unknown, context?: PoolState) => {...})`
- [ ] Include optional context field with pool state at rejection time: `{ queueSize, pendingCount, isStarted, isClosed, isResolved }`
- [ ] Emit timing: before respecting `rejectOnError` flag (event always fires regardless)
- [ ] If `rejectOnError=false`: error goes to `#results` array (after event)
- [ ] If `rejectOnError=true`: error stored AND pool will reject on close (after event)
- [ ] Each promise rejection fires exactly one `'error'` event
- [ ] Update JSDoc, POOL_EVENT_TYPE, tests

**Testing:**
- Per-rejection test: enqueue 10 tasks where 5 fail → verify 5 'error' events with correct errors
- Context accuracy: verify pool state snapshot in event context
- rejectOnError interaction: verify event fires in both rejectOnError=true and false cases

**Backward Compat:** Adding new event type = no breaking change.

---

### FR-3: Queue Introspection Getters (Feature)

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

---

### FR-4: Extended Timeout Control (Feature)

**User Story:** As a timeout-sensitive application, I need finer control over deadline propagation and better timeout error context for debugging.

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
  - Boundary: concurrency=1, concurrency=1000, extreme timeout values
  - Malformed: negative timeouts, NaN timeout, null options  
  - Rapid lifecycle: start() immediately followed by close(), back-to-back enqueue calls
  - Error propagation: verify rejectOnError=true/false in all pool states
  - Event ordering: verify event sequence invariants (resolve→next, error→pool rejection, etc.)
  - 'resolve' event: per-promise resolution fires with correct result
  - 'error' event: per-promise rejection fires with correct error and context
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

### QR-3: Documentation of Advanced Patterns (Quality)

**User Story:** As a power user, I need reference material for off-the-beaten-path use cases.

**Acceptance Criteria:**
- [ ] README section: "Advanced Patterns"
  - Pattern 1: Error recovery via 'error' event (real-time error handling)
  - Pattern 2: Result streaming via 'resolve' event (per-promise reactions)
  - Pattern 3: Timeout composition (chaining timeouts, wrapping pool with deadline)
  - Pattern 4: Error context inspection (reading pool state from error event)
  - Pattern 5: Pool composition (pool of pools, or sequence of pools)
- [ ] Each pattern includes runnable example code
- [ ] Link from JSDoc to README sections where relevant
- [ ] No promises made about features not in v1.1 (defer AsyncIterator, retry strategies to v2)

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

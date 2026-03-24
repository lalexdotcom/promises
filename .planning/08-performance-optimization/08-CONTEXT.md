---
phase: 08
title: "Performance Optimization & Memory Audit"
status: context-created
date: 2026-03-24
upstream: [07-timeout-control]
downstream: [09-edge-case-expansion]
requires:
  - Phase 07 completion (timeout enhancements)
  - PR-1, PR-2, PR-3 (performance requirements)
---

# Phase 08: Performance Optimization & Memory Audit — Context

**Goal:** Batch task scheduling, validate memory efficiency, benchmark performance.

**Phase Boundary:** This phase focuses on runtime performance optimization (scheduler batching), explicit resource cleanup (listener deregistration), and validation that no memory leaks or performance regressions exist post-optimization.

---

## Decisions

### D1: Batching Strategy — Event Frequency Granularity

**Question:** Current `#runNext()` drains available slots in a while loop, emitting `'full'` and `'available'` events per slot state change. Should we batch emit logic to emit events only after all slots are filled?

**Options Evaluated:**
1. **Option 1 (CHOSEN):** No change to event frequency — keep per-slot granularity
   - Current behavior: Each slot fill emits event independently
   - Preserves event semantics: listeners see immediate state transitions
   - Minimally disruptive, maintains backward compatibility
   - Sufficient for most use cases

2. Option 2: Batch emit logic — emit events only after all slots filled
   - Fewer events per batch fill
   - Could confuse listeners expecting immediate transitions
   - Requires synchronization logic that adds complexity

**Decision:** **Option 1 (Keep per-slot granularity)**

**Rationale:**
- Event listeners expect real-time state transitions; per-slot granularity maintains this invariant
- The while loop already drains all slots in a single microtask — event frequency is not a bottleneck
- Complexity of Option 2 (batching with coordination) outweighs minimal performance gains
- Backward compatibility: existing listeners depend on per-state-change events

---

### D2: Listener Cleanup Strategy

**Question:** Current architecture uses `#listeners: Map<callback, once>`. When `pool.close()` is called, should listeners persist until pool is garbage collected or be explicitly cleared?

**Options Evaluated:**
1. Option 1: Do nothing — listeners persist until pool is garbage collected
   - Reduces GC churn temporarily (immediate callback cleanup deferred)
   - Increases pool memory footprint (listeners held in memory)
   - May cause listener callbacks to fire unexpectedly in long-lived applications

2. **Option 2 (CHOSEN):** Explicit cleanup on `close()` — clear all listeners
   - Enables immediate garbage collection of listener callbacks
   - Prevents stale listener references in long-lived applications
   - Follows explicit resource cleanup pattern (file handles, connections)
   - Minimal cost: single loop to clear map

**Decision:** **Option 2 (Clear all listeners on close())**

**Rationale:**
- Long-lived applications may create many pools; explicit cleanup prevents listener accumulation
- Post-close, listeners are semantically irrelevant (pool has settled)
- Aligns with resource cleanup best practices (databases, connections, event emitters)
- Implementation cost is negligible (one clear() operation)
- Improves heap profiling visibility in memory audits

---

### D3: Memory Leak Detection Test Strategy

**Question:** How should we test for memory leaks in this phase?

**Options Evaluated:**
1. Option 1: Promise-based leak detector
   - Create pools, enqueue, close, inspect WeakRef entries
   - Requires WeakRef API (ES2021+)
   - Platform-dependent GC timing makes test flaky
   - Complex setup with forced GC triggers

2. **Option 2 (CHOSEN):** Informational tests
   - Verify listener arrays are cleared on `close()`
   - Verify `#running` and `#enqueued` arrays are empty post-close
   - Verify no listeners remain registrable post-close
   - Pragmatic, deterministic, runnable in CI

**Decision:** **Option 2 (Informational tests – array inspection)**

**Rationale:**
- Listener cleanup is deterministic and verifiable without GC pressure
- Tests can run reliably in CI (no platform GC variance)
- Catches common leak scenarios (forgotten listener deregistration, dangling references)
- WeakRef approach is platform-dependent and timing-sensitive
- Informational tests provide sufficient confidence for the library's scope

---

### D4: Performance Benchmarks Scope

**Question:** Should performance benchmarks be included in the test suite?

**Options Evaluated:**
1. Option 1: Yes, with performance thresholds
   - Benchmarks in test suite with assertions
   - Fail CI if performance regresses past thresholds
   - Requires baseline maintenance and platform-specific tuning
   - Risk: flaky tests due to system load variance

2. **Option 2 (CHOSEN):** Informational only
   - Benchmarks run and log metrics to console
   - No assertions, no test failures
   - Developers inspect results for regression patterns
   - Useful for debugging and platform comparison

**Decision:** **Option 2 (Informational benchmarks only)**

**Rationale:**
- Performance is platform-dependent (CPU speed, OS scheduler, system load)
- Hard thresholds cause false positives in CI
- Informational output allows pattern detection without brittle assertions
- Supports ad-hoc profiling when investigating regressions
- Benchmark results are reviewed but not blocking

---

## the agent's Discretion

No areas of discretion identified. All major decisions are locked based on phase requirements.

---

## Deferred Ideas

- **Bulk listener deregistration API:** `pool.*removeAllListeners()` method. Deferred to post-v1.2 (not in scope for Phase 8).
- **Event coalescing configuration:** Configurable event batching (e.g., `{ batchEmit: true }`). Deferred to v1.2 (requires API surface change).
- **Detailed performance profiling:** Full async stack traces, timeline analysis. Deferred to profiling tools investigation.

---

## Implementation Approach

### Architecture Summary

Phase 8 focuses on three concrete improvements:

1. **Listener Cleanup (Decision D2)**
   - Modify `close()` to call cleanup function that clears all `#listeners` maps
   - Ensures post-close state is fully released for GC

2. **Performance Monitoring (Decision D4)**
   - Add baseline instrumentation to count event emissions and scheduler cycles
   - Log metrics (events/ms, promises/ms) to console for analysis
   - Non-blocking, informational only

3. **Memory Leak Tests (Decision D3)**
   - Add test cases that verify listener arrays are cleared
   - Add test cases verifying `#running` and `#enqueued` are emptied
   - Confirm pool state is fully released after close

### Testing Strategy

**Wave 1: Listener Cleanup (2-3 tasks)**
- Implement `close()` listener cleanup logic
- Add test: "listeners are deregistered after close()"
- Add test: "new listener registrations fail post-close"

**Wave 2: Batch Metrics & Monitoring (2-3 tasks)**
- Add performance instrumentation (event counter, scheduler cycle tracking)
- Baseline metrics collection test (verify counters increment)
- Add metrics output to test summary

**Wave 3: Full Resource Cleanup Tests (2-3 tasks)**
- Memory leak tests (verify `#running`, `#enqueued` arrays cleared)
- Backward compatibility smoke test (ensure refactors don't break existing code)
- End-to-end functional test (pool continues working with cleanup in place)

---

## Downstream Dependencies

### Phase 9 (Edge Case Expansion)
- Depends on Phase 8 listener cleanup being stable
- Will add boundary tests assuming clean listener state between tests
- May validate memory efficiency against Phase 8 metrics

### Future Phases (v1.2+)
- Event coalescing features can build on metrics from Phase 8
- Performance baselines from Phase 8 inform optimization priorities
- Listener cleanup pattern enables future bulk deregistration APIs

---

## Verification Criteria

✅ **Listener cleanup works correctly:**
- Listeners are cleared after `close()`
- Pool state is verifiable as fully released
- No dangling references prevent garbage collection

✅ **Batching strategy is unchanged:**
- Event granularity remains per-slot (no logic changes)
- Existing event listeners continue working as-is
- Backward compatibility maintained

✅ **Benchmarks are informational:**
- Metrics are logged but not asserted
- No test failures due to performance
- Data is available for manual review

✅ **All tests pass:**
- No regressions in existing functionality
- New memory cleanup tests verify proper deregistration
- Performance baseline is recorded

---

## Files Affected

**Modified:**
- `src/pool.ts` — Add listener cleanup logic to `close()`, add performance instrumentation
- `tests/index.test.ts` — Add memory leak tests, add performance baseline collection

**Not modified:**
- `src/utils.ts` — No changes (timeout utilities untouched)
- `src/index.ts` — No changes (public API unchanged)

---

## Success Metrics

| Metric | Target | How Verified |
|--------|--------|--------------|
| Listener cleanup | All listeners cleared post-close | Memory leak test suite |
| Event granularity | Per-slot unchanged | Existing event tests pass |
| Backward compatibility | 100% pass rate | All existing tests pass |
| Performance baseline | Recorded (no threshold) | Benchmark output captured |
| Test coverage | All pathways covered | Wave 3 test suite |

---

## Questions & Clarifications

**Q: Does listener cleanup affect the 'close' event?**
A: No. The 'close' event is emitted in `close()` before listener cleanup, so all listeners registered before `close()` will receive the 'close' event. Cleanup happens after final event emission.

**Q: Can listeners be re-registered after close()?**
A: Yes, technically the Maps still exist. However, listeners registered post-close won't receive any events (pool is settled). This is acceptable per D2 — cleanup is for GC efficiency, not enforcing API contracts.

**Q: What performance metrics are we tracking?**
A: Informational only — event emission rate (events/ms) and scheduler cycle efficiency. Specific metrics TBD in planning phase based on profiling data.

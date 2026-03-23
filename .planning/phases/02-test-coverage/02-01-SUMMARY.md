---
plan: "02-01"
phase: "02"
status: "complete"
completed: "2026-03-23"
---

# Summary — Plan 02-01: PromisePool Tests (TEST-01 through TEST-06)

## What Was Done

Replaced the broken placeholder `tests/index.test.ts` with a comprehensive PromisePool test suite.

## Tests Created

| Test | Req | Count | Key Assertions |
|------|-----|-------|----------------|
| Lifecycle | TEST-01 | 6 | flags, microtask isStarted, isClosed, result order, isResolved, running/waiting |
| Concurrency | TEST-02 | 1 | counter proves maxRunning ≤ N and == N |
| Events | TEST-03 | 5 | on/once semantics, start/full/available events |
| Error handling | TEST-04 | 3 | PoolError.catched, rejectOnError false/true |
| Per-promise timeout | TEST-05 | 2 | TimeoutError on slow task, normal on fast |
| parallel/serial | TEST-06 | 4 | ordered results, empty arrays |

**Total: 21 tests — all passing**

## Key Decisions

- `autoStart: false` used for start-event count test to avoid multi-fire behavior
- `console.error` stubbed manually (vi not available in @rstest/core)
- Realistic delays (10–100ms) throughout
- BUG-01 validated: `enqueue(fn, 20)` with 100ms promise → `TimeoutError` in `.catched`

## Commits

- `7a79221` — test: add comprehensive test suite (Phase 2)

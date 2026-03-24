---
phase: quick-260324-dmw
plan: "01"
subsystem: event-system
tags: [events, unsubscribe, api-change, typescript]
dependency_graph:
  requires: []
  provides: [unsubscribe-on-once]
  affects: [PromisePool interface, PromisePoolImpl, event listener lifecycle]
tech_stack:
  added: []
  patterns: [return-unsubscribe idiom (EventEmitter alternative)]
key_files:
  created: []
  modified:
    - src/pool.ts
    - tests/index.test.ts
    - tests/TEST-16-error-propagation.test.ts
    - README.md
decisions:
  - "Return () => { this.#listeners[type]?.delete(cb) } — reuses existing Map.delete, safe to call multiple times"
  - "Kept generic implementation signature on(type: POOL_EVENT_TYPE, cb): () => void per user requirement"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-24"
  tasks_completed: 3
  files_modified: 4
---

# Quick 260324-dmw: on() and once() return unsubscribe function — Summary

**One-liner:** Added `() => void` unsubscribe return value to all `on()`/`once()` overloads using a Map.delete closure, with 7 new tests and README update.

## What Was Done

### Task 1: src/pool.ts — interface + implementation

- All 3 `on()` overloads in `PromisePool` interface: `void` → `() => void`
- All 3 `once()` overloads in `PromisePool` interface: `void` → `() => void`  
- All 3 `on()` overload signatures in `PromisePoolImpl`: `void` → `() => void`
- All 3 `once()` overload signatures in `PromisePoolImpl`: `void` → `() => void`
- Generic implementation bodies now return closure: `() => this.#listeners[type]?.delete(cb)`
- Added `@returns` JSDoc on both methods

### Task 2: tests/index.test.ts + TEST-16

- Added `describe('TEST-03b: unsubscribe (on / once return value)')` with 7 tests:
  1. `on()` — unsubscribe stops future invocations
  2. `on()` — unsubscribing one listener does not affect others on same event
  3. `once()` — unsubscribe prevents listener from ever firing
  4. `once()` — unsubscribe after already fired is a no-op
  5. `on()` — returns a function (type check)
  6. `once()` — returns a function (type check)
  7. `on()` — unsubscribe works for resolve and error events
- Fixed stale comment in TEST-16: "no off() method" → "unsubscribe function returned by on()/once()"

### Task 3: README.md

- Updated Events section intro to mention unsubscribe return value
- Added code snippet demonstrating `unsub()` usage
- Updated API reference table: `on/once` return type column shows `() => void` with description

## Deviations from Plan

**1. [Rule 1 - Bug] Typo in interface overload during multi-replace**
- **Found during:** Task 1 build verification
- **Issue:** First `on()` interface overload got `() => () => void` instead of `() => void` due to replacement order
- **Fix:** Single-line correction of the typo before committing
- **Files modified:** src/pool.ts

## Verification

- `pnpm run build` — ✅ clean, zero errors
- `pnpm run test` — ✅ 156 tests passed (was 149, +7 new)
- `grep "unsubscribe" README.md` — ✅ 3 matches

## Commits

- `5e23dc5`: feat(quick-260324-dmw): on() and once() return unsubscribe () => void
- `d43689e`: feat(quick-260324-dmw): add unsubscribe tests and fix stale comment
- `99d5524`: feat(quick-260324-dmw): update README Events section for unsubscribe

## Self-Check: PASSED

- [x] src/pool.ts modified with correct return types
- [x] tests/index.test.ts contains TEST-03b describe block
- [x] README.md contains "unsubscribe"
- [x] All 3 commits exist
- [x] 156 tests pass

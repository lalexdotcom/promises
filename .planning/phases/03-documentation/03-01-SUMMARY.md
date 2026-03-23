---
phase: 03-documentation
plan: 01
subsystem: docs
tags: [jsdoc, readme, typescript, documentation]

requires:
  - phase: 02-test-coverage
    provides: all 31 tests passing, correctness validated — safe to document stable API

provides:
  - PoolOptions and PoolError exported for consumer TypeScript imports
  - JSDoc on all PromisePool interface members, PoolOptions properties, PoolError, pool factory, pool.parallel, pool.serial
  - 10 inline WHY-comments across runNext(), promiseDone(), promiseRejected(), #emit(), start()
  - JSDoc on all 6 exported utils symbols (wait, TimeoutError, timeout, unsync, slice, defer)
  - Complete README.md with installation, quick start, API reference tables, scenario examples, license

affects: [04-npm-config]

tech-stack:
  added: []
  patterns:
    - JSDoc on interface members (not impl class) — language server resolves hover from the interface
    - WHY-comments over WHAT-comments on non-obvious scheduler/lifecycle logic

key-files:
  created:
    - README.md
  modified:
    - src/pool.ts
    - src/utils.ts

key-decisions:
  - "JSDoc placed on PromisePool interface members, not PromisePoolImpl — TS language server resolves hover from the interface"
  - "PoolOptions and PoolError exported — enables named import type for consumers without inlining in .d.ts"
  - "All README code blocks use ```js not ```ts — lower barrier, examples are copy-runnable"
  - "No @example tags in JSDoc — examples centralized in README only"

patterns-established:
  - "WHY-comment pattern: comment placed on the line immediately above the logic it explains"
  - "JSDoc property docs: @default for every optional parameter with a meaningful default"

requirements-completed:
  - DOCS-01
  - DOCS-02
  - DOCS-03

duration: 25min
completed: 2026-03-23
---

# Plan 03-01: Documentation Summary

**All exported symbols JSDoc-documented with typed parameters and defaults; complete README enables a new user to evaluate and integrate the library without reading source code.**

## What Was Built

- **`src/pool.ts`**: Added `export` to `PoolOptions` and `PoolError`; JSDoc on all `PromisePool` interface members (promise, running, waiting, isStarted, isClosed, isResolved, start, enqueue, close, on, once), all `PoolOptions` properties (concurrency, name, rejectOnError, autoStart, verbose), `PoolError.catched`, and `pool`/`pool.parallel`/`pool.serial` factory; 10 inline WHY-comments at C1–C10 locations (scheduler loop, event guards, lifecycle flags, microtask deferral, timeout NaN sentinel).

- **`src/utils.ts`**: JSDoc on all 6 exports — `wait` (@default delay 0), `TimeoutError` (cross-linked to pool.enqueue), `timeout` (@throws TimeoutError), `unsync` (@default delay 0), `slice` (@default size 10_000), `defer` (@returns).

- **`README.md`**: 238-line production README with npm badge, one-line description, Installation, Quick Start, API Reference (before Examples per D-05), parameter tables for all 7 symbols, Events table, 4 scenario-based Examples (job queue, rate limiting, typed batch, utility functions), License. Zero TypeScript code blocks — all examples use `js` or `sh`. pool.parallel/serial typed tuple inference highlighted per D-04.

## Verification

- `pnpm run build` exits 0 — JSDoc introduces no TypeScript errors
- `pnpm run test` exits 0 — 31 tests pass, no runtime regressions
- `grep "export type PoolOptions" src/pool.ts` → 1 match ✓
- `grep "export interface PoolError" src/pool.ts` → 1 match ✓
- JSDoc count pool.ts: 22 blocks (≥12 required) ✓
- JSDoc count utils.ts: 6 blocks (≥6 required) ✓
- README 238 lines (≥150 required) ✓
- README API Reference appears before Examples ✓
- Zero ```ts code blocks in README ✓

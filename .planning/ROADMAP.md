# ROADMAP — promises v1

## Milestone: v1.0 — Publication-Ready Library

### Phase 1: Correctness

**Goal:** All known bugs are fixed and TypeScript types are accurate — the library behaves as documented and the type system reflects its actual API surface.

**Requirements covered:**
- **BUG-01**: Fix inverted timeout guard in `runNext()` so per-promise timeouts actually fire
- **BUG-02**: Fix `timeout()` in `utils.ts` — silence late resolution, propagate wrapped promise rejections
- **BUG-03**: Remove duplicate `pending` getter (identical to `waiting`, absent from interface) or add to interface
- **BUG-04**: Remove commented-out `emit('next')` calls — dead code causing confusion
- **TYPES-01**: `pool.parallel()` returns inferred `Promise<T[]>` or `Promise<[R1, R2, ...]>` via overloads
- **TYPES-02**: `pool.serial()` — same tuple/array inference as TYPES-01
- **TYPES-03**: `PromisePool` interface getters expose strict types (no `any`)

**Success criteria:**
- [ ] `enqueue(fn, 100)` actually times out after 100ms — `TimeoutError` is thrown (BUG-01 verified)
- [ ] `timeout(promise, delay)` silently ignores late resolution and correctly propagates wrapped promise rejections without spurious `rej(undefined)` calls (BUG-02 verified)
- [ ] `pool.parallel([fn1, fn2])` infers `Promise<[T1, T2]>` for heterogeneous, `Promise<T[]>` for homogeneous — TypeScript compilation confirms
- [ ] `PromisePool` interface compiles with zero `any` types on its getters
- [ ] Codebase has no dead code (`pending` duplicate and commented `emit('next')` removed)

**Plans:**
2/2 plans complete
2. Clean up dead code and improve types — BUG-03, BUG-04, TYPES-01, TYPES-02, TYPES-03

---

### Phase 2: Test Coverage

**Goal:** All public behaviors are verified by an automated test suite that passes with zero failures — concurrency control, lifecycle, events, error handling, and every utility.

**Requirements covered:**
- **TEST-01**: PromisePool lifecycle — creation, `start()`, `enqueue()`, `close()`, state flags, resolved result
- **TEST-02**: Concurrency limiting — never more than N promises run simultaneously
- **TEST-03**: Event system — `on()` receives all events, `once()` fires only once, all event types covered
- **TEST-04**: Error handling — `rejectOnError: false` continues with `PoolError` in result; `rejectOnError: true` rejects pool
- **TEST-05**: Per-promise timeout via `enqueue(fn, timeout)` — `TimeoutError` raised and propagated (validates BUG-01 fix)
- **TEST-06**: `pool.parallel()` and `pool.serial()` — correct results, order preserved in serial, empty array behavior
- **TEST-07**: `wait(delay)` — resolves after the expected delay
- **TEST-08**: `timeout(promise, delay)` — `TimeoutError` on expiry, clean resolution before expiry, wrapped promise rejection propagated (validates BUG-02 fix)
- **TEST-09**: `unsync(fn, delay?)` — executes asynchronously, propagates errors from `fn`
- **TEST-10**: `slice(fn, size)` — processes by chunks, preserves order, handles empty array

**Success criteria:**
- [ ] `pnpm run test` exits with code 0 — zero failures, zero import errors
- [ ] PromisePool concurrency is empirically verified: tracking simultaneous runners never exceeds configured N
- [ ] Per-promise timeout test confirms `TimeoutError` is thrown when `enqueue(fn, timeout)` is used with a slow promise
- [ ] All four utility functions (`wait`, `timeout`, `unsync`, `slice`) have dedicated passing tests
- [ ] Edge cases covered: empty arrays for `parallel`/`serial`/`slice`, rejection propagation for `timeout`

**Plans:**
1. Write `tests/pool.test.ts` — TEST-01 through TEST-06
2. Write `tests/utils.test.ts` — TEST-07 through TEST-10

---

### Phase 3: Documentation

**Goal:** A new user can understand, evaluate, and integrate the library using docs alone — README provides onboarding, JSDoc enables IDE discovery, inline comments explain the non-obvious.

**Requirements covered:**
- **DOCS-01**: README with installation, pool usage, `parallel`/`serial` examples, utility examples, API summary, npm badge, license
- **DOCS-02**: JSDoc on all public types (`PromisePool`, `PoolOptions`, `PoolError`, `TimeoutError`) and all exported functions
- **DOCS-03**: Inline comments on complex logic: `runNext()` scheduler, lifecycle state machine, event system, `promiseDone`/`promiseRejected`

**Success criteria:**
- [ ] README covers every exported symbol with at least one usage example
- [ ] TypeScript hover tooltips (via JSDoc) show meaningful descriptions for every public function and type in an IDE
- [ ] `runNext()`, the lifecycle state machine, and event dispatch logic each have clarifying comments that explain the non-obvious decisions

**Plans:**
1. Write README and add JSDoc + inline comments — DOCS-01, DOCS-02, DOCS-03

---

### Phase 4: Publication Prep

**Goal:** The package is fully configured for npm publication — metadata complete, `private` flag removed, file list correct, universal build verified.

**Requirements covered:**
- **NPM-01**: `package.json` with `description`, `keywords`, `homepage`, `repository`, `license`, `author`, `bugs`
- **NPM-02**: Remove `"private": true` from `package.json`
- **NPM-03**: Verify and complete `files` field — `dist/`, `README.md`, `LICENSE` included; no dev artifacts
- **NPM-04**: Universal build — verify no Node-only APIs used; `rslib.config.ts` targets browser + Node 18+

**Success criteria:**
- [ ] `package.json` has no `"private": true` — `npm publish` would not be blocked by the private flag
- [ ] `package.json` metadata fields are all populated: `description`, `keywords`, `homepage`, `repository`, `license`, `author`, `bugs`
- [ ] `npm pack --dry-run` output lists only `dist/`, `README.md`, `LICENSE` — no `.planning/`, `src/`, `tests/`, or config files
- [ ] Build output uses only universal globals (`setTimeout`, `Promise`, `console`) — confirmed by code review or bundle inspection

**Plans:**
1. Finalize package metadata and publication config — NPM-01, NPM-02, NPM-03, NPM-04

---

## Phase Details

### Phase 1: Correctness
**Goal**: Source code has correct runtime behavior and accurate TypeScript types
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, TYPES-01, TYPES-02, TYPES-03
**Success Criteria** (what must be TRUE):
  1. `enqueue(fn, 100)` actually times out after 100ms — `TimeoutError` is thrown
  2. `timeout(promise, delay)` silently ignores late resolution and propagates wrapped rejections
  3. `pool.parallel()` and `pool.serial()` infer correct tuple/array types
  4. `PromisePool` interface compiles with zero `any` on getters
  5. No dead code: `pending` duplicate and commented `emit('next')` removed
**Plans**: TBD

### Phase 2: Test Coverage
**Goal**: All public behaviors verified by automated tests — zero failures
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10
**Success Criteria** (what must be TRUE):
  1. `pnpm run test` exits code 0 — zero failures
  2. Concurrency empirically verified: simultaneous runners never exceed N
  3. Per-promise timeout test confirms `TimeoutError` for slow promises
  4. All four utils (`wait`, `timeout`, `unsync`, `slice`) have passing tests
  5. Edge cases: empty arrays, rejection propagation
**Plans**: TBD

### Phase 3: Documentation
**Goal**: New users can understand and integrate the library from docs alone
**Depends on**: Phase 1
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. README covers every exported symbol with at least one usage example
  2. JSDoc hover tooltips show meaningful descriptions in IDE
  3. `runNext()` and lifecycle state machine have clarifying inline comments
**Plans**: TBD

### Phase 4: Publication Prep
**Goal**: Package is npm-ready — metadata complete, `private` removed, files correct, build universal
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: NPM-01, NPM-02, NPM-03, NPM-04
**Success Criteria** (what must be TRUE):
  1. No `"private": true` in `package.json`
  2. All metadata fields populated: description, keywords, homepage, repository, license, author, bugs
  3. `npm pack --dry-run` lists only dist/, README.md, LICENSE
  4. Build uses only universal globals — no Node-only APIs
**Plans**: TBD

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Correctness | Not Started |
| 2 | Test Coverage | Not Started |
| 3 | Documentation | Not Started |
| 4 | Publication Prep | Not Started |

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Correctness | 0/2 | Not started | - |
| 2. Test Coverage | 0/2 | Not started | - |
| 3. Documentation | 0/1 | Not started | - |
| 4. Publication Prep | 0/1 | Not started | - |

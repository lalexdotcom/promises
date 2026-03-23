---
plan: "01-01"
phase: "01"
status: "complete"
completed: "2026-03-23"
---

# Summary — Plan 01-01: Fix Runtime Bugs (BUG-01, BUG-02)

## What Was Done

Fixed two runtime bugs that silently broke core functionality.

## Tasks Completed

| Task | Requirement | File | Result |
|------|-------------|------|--------|
| Fix inverted timeout guard | BUG-01 | `src/pool.ts` | `!Number.isNaN(timeout) && timeout > 0` — timeouts now fire correctly |
| Fix late-resolution + propagate rejections | BUG-02 | `src/utils.ts` | Silenced late `rej()`, added `.catch()` on inner promise |

## Key Changes

- **`src/pool.ts` L151**: `Number.isNaN(timeout) && timeout > 0` → `!Number.isNaN(timeout) && timeout > 0`
- **`src/utils.ts`**: Restructured `.then()` handler to ignore late resolution; added `.catch()` chain to propagate inner promise rejections

## Commits

- `0fcd2c8` — fix(pool): correct inverted timeout guard in runNext() (BUG-01 + BUG-02)

## Verification

- [x] `pnpm run build` passes — no type errors
- [ ] `pnpm run test` — tests to be added in Phase 2

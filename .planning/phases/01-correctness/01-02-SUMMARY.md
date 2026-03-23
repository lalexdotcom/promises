---
plan: "01-02"
phase: "01"
status: "complete"
completed: "2026-03-23"
---

# Summary — Plan 01-02: Dead Code Removal + Type Improvements

## What Was Done

Cleaned up dead code and upgraded TypeScript types for public API surface.

## Tasks Completed

| Task | Requirement | Status | Notes |
|------|-------------|--------|-------|
| Remove `pending` getter | BUG-03 | ✅ | Deleted — identical to `waiting`, not in interface |
| Remove `// this.#emit('next')` | BUG-04 | ✅ | Both lines in `promiseDone` + `promiseRejected` removed |
| `any` → `unknown` in private fields | TYPES-03 | ✅ | `#running`, `result`, `#promise`, `#resolve`, `#reject` |
| Generic typed `pool.parallel()` | TYPES-01 | ✅ | `Promise<[R1,R2,...]>` for tuples via `[...T]` spread |
| Generic typed `pool.serial()` | TYPES-02 | ✅ | Same pattern as TYPES-01 |

## Key Changes

**`src/pool.ts`**
- Removed `get pending()` getter (7 lines)
- Removed 2 `// this.#emit('next')` comment lines
- Private fields: `Promise<any>[]` → `Promise<unknown>[]`, `any[]` → `unknown[]`, resolve/reject signatures tightened
- `parallel` and `serial`: `(commands: PromiseFunction[]) => Promise<any[]>` upgraded to `<T extends PromiseFunction[]>(commands: [...T]) => Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }>`

## Commits

- `0d5a2e8` — fix(pool): remove dead code and improve types (BUG-03, BUG-04, TYPES-01/02/03)

## Verification

- [x] `pnpm run build` passes — no type errors (8.3 kB output)
- [x] Pre-existing test (`squared`) — pre-existing stub, unrelated to our changes; will be replaced in Phase 2
- [ ] TypeScript tuple inference — to be validated in Phase 2 tests

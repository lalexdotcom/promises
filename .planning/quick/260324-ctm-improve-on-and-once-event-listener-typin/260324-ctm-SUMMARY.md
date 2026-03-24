---
phase: quick-260324-ctm
plan: 01
subsystem: types
tags: [typescript, overloads, events, type-safety]
key-files:
  modified:
    - src/pool.ts
    - tests/index.test.ts
decisions:
  - "Used (...args: any[]) => void for implementation signatures instead of unknown[] — required for TypeScript overload compatibility since (error: unknown, ctx?: PoolEventContext) => void is not assignable to (...args: unknown[]) => void"
  - "Updated #listeners map type from unknown[] to any[] to match implementation signature"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-24"
  tasks: 2
  files: 2
---

# Quick Task 260324-CTM: Improve on() and once() Event Listener Typing — Summary

**One-liner:** Typed per-event overloads on `on()`/`once()` — `() => void` for simple events, `(result: unknown)` for resolve, `(error: unknown, ctx?)` for error — with `@ts-expect-error` compile-time guards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add overloads to PromisePool interface and PromisePoolImpl | `719ac5d` | src/pool.ts |
| 2 | Add type-level assertions to existing test file | `1052ce9` | tests/index.test.ts |

## Changes Made

### src/pool.ts

**PromisePool interface** — replaced two single-signature `on`/`once` declarations with 3 overloads each:
```typescript
on(event: 'start' | 'full' | 'next' | 'close' | 'available', callback: () => void): void;
on(event: 'resolve', callback: (result: unknown) => void): void;
on(event: 'error', callback: (error: unknown, context?: PoolEventContext) => void): void;

once(event: 'start' | 'full' | 'next' | 'close' | 'available', callback: () => void): void;
once(event: 'resolve', callback: (result: unknown) => void): void;
once(event: 'error', callback: (error: unknown, context?: PoolEventContext) => void): void;
```

**PromisePoolImpl class** — added the same 3 overload declarations above each implementation method. The implementation signatures use `(...args: any[]) => void` (required by TypeScript overload rules), and the `#listeners` map type was updated to `any[]` accordingly.

### tests/index.test.ts

Added `PoolEventContext` to the import and appended a `describe('on/once type overloads (compile-time)')` block with 3 tests that lock the type contract:
- Positive: all correct signatures compile without errors
- `@ts-expect-error`: `'start'` callback with a number arg is rejected
- `@ts-expect-error`: `'full'` callback with a string arg is rejected
- `@ts-expect-error`: `'resolve'` callback with two args is rejected

## Verification

- `pnpm run build` — zero TypeScript errors ✓
- `npx tsc --noEmit` — zero errors ✓
- `pnpm run test` — 147 tests passed (144 original + 3 new) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed implementation signature from `unknown[]` to `any[]`**
- **Found during:** Task 1 build verification
- **Issue:** TypeScript TS2394 — `(error: unknown, context?: PoolEventContext) => void` is not assignable to `(...args: unknown[]) => void` because the variadic call `cb(a, b, c)` is valid for `unknown[]` but not for a 2-arg callback.
- **Fix:** Changed impl signatures and the `#listeners` map type from `unknown[]` to `any[]`, which is the standard pattern for multi-overload callback maps.
- **Files modified:** src/pool.ts
- **Commit:** `719ac5d`

## Self-Check: PASSED

- `src/pool.ts` modified with overloads ✓
- `tests/index.test.ts` modified with type assertions ✓
- Commits `719ac5d` and `1052ce9` exist ✓
- Build: zero errors ✓
- Tests: 147/147 ✓

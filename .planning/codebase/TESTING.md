# TESTING.md — Test Structure & Practices

## Framework

| Tool | Role |
|------|------|
| **Rstest** (`@rstest/core`) | Test runner — Vitest-compatible API, Rspack-native |
| **@rstest/adapter-rslib** | Bridges Rstest with Rslib build config |

Config: `rstest.config.ts`
```ts
import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig } from '@rstest/core';

export default defineConfig({ extends: withRslibConfig() });
```

The adapter ensures tests run through the same Rspack pipeline as the library, so TypeScript is compiled identically.

## Test Commands

```bash
pnpm run test          # single run
pnpm run test:watch    # watch mode
```

## Current Test Structure

```
tests/
└── index.test.ts   ← Only test file (7 lines)
```

```ts
// tests/index.test.ts
import { expect, test } from '@rstest/core';
import { squared } from '../src/index';

test('squared', () => {
  expect(squared(2)).toBe(4);
  expect(squared(12)).toBe(144);
});
```

## ⚠ Critical: Tests Are Broken

**`squared` is not exported from `src/index.ts`** (or anywhere in the codebase).  
The test will fail with an import error before any assertions run.

This test appears to be a **placeholder or leftover** from project scaffolding.

## Coverage

**No coverage configuration** is defined in `rstest.config.ts`.

**What is NOT tested:**
- `PromisePoolImpl` constructor and options
- `pool()` factory function
- `pool.parallel()` and `pool.serial()` static methods
- `PromisePool.start()`, `enqueue()`, `close()` lifecycle
- Concurrency limiting behavior
- Event system (`on`, `once`, `emit`)
- Error handling (`rejectOnError` mode)
- `PoolError` / `PoolErrorImpl`
- `wait()` utility
- `timeout()` utility and `TimeoutError`
- `unsync()` utility
- `slice()` utility

**Effective test coverage: ~0%** (all tests broken).

## Test Patterns (Rstest API)

Rstest uses a Vitest-compatible API. Available conventions for new tests:

```ts
import { describe, test, expect, vi, beforeEach, afterEach } from '@rstest/core';

describe('PromisePool', () => {
  test('should limit concurrency', async () => {
    const p = pool(2);
    // ...
    await p.close();
    expect(results).toEqual([...]);
  });
});
```

## Mocking

Rstest supports `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()` (Vitest-compatible API). No mocking infrastructure is currently in use.

## CI

No CI configuration exists (no `.github/workflows/*.yml`). Tests are not automatically run on push/PR.

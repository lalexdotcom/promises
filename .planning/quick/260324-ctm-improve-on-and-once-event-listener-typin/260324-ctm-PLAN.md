---
phase: quick-260324-ctm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pool.ts
  - tests/index.test.ts
autonomous: true
requirements: [CTM-01]

must_haves:
  truths:
    - "pool.on('resolve', (r: unknown) => {}) compiles without error"
    - "pool.on('resolve', (r: string, x: number) => {}) produces a TypeScript error"
    - "pool.on('error', (e: unknown, ctx?: PoolEventContext) => {}) compiles"
    - "pool.on('start', () => {}) compiles"
    - "pool.on('start', (x: number) => {}) produces a TypeScript error"
    - "All 144 existing tests continue to pass"
  artifacts:
    - path: src/pool.ts
      provides: "Overloaded on() and once() signatures on PromisePool interface and PromisePoolImpl"
      contains: "on(event: 'resolve'"
  key_links:
    - from: "PromisePool interface"
      to: "PromisePoolImpl class"
      via: "implements"
      pattern: "class PromisePoolImpl implements PromisePool"
---

<objective>
Replace the loose `(...args: unknown[]) => void` callback on `on()` and `once()` with TypeScript function overloads that encode per-event callback signatures.

Purpose: Catch mismatched callbacks at compile time without any runtime change.
Output: Updated `PromisePool` interface and `PromisePoolImpl` implementation with overloads; type-level test assertions.
</objective>

<context>
@.planning/STATE.md
@src/pool.ts
@tests/index.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add overloads to PromisePool interface and PromisePoolImpl</name>
  <files>src/pool.ts</files>
  <behavior>
    - pool.on('start', () => {})         → OK
    - pool.on('full', () => {})          → OK
    - pool.on('next', () => {})          → OK
    - pool.on('close', () => {})         → OK
    - pool.on('available', () => {})     → OK
    - pool.on('resolve', (r: unknown) => {}) → OK
    - pool.on('error', (e: unknown) => {})   → OK
    - pool.on('error', (e: unknown, ctx?: PoolEventContext) => {}) → OK
    - pool.once mirrors all on() overloads exactly
  </behavior>
  <action>
    In the `PromisePool` interface, replace the two single-signature declarations for `on` and `once` with TypeScript function overloads. Define a `PoolSimpleEventCallback` type alias (`() => void`) and keep `'resolve'` and `'error'` inline in the overloads for clarity.

    **Exact replacement pattern for the interface:**

    ```typescript
    // Simple (no-arg) events
    on(event: 'start' | 'full' | 'next' | 'close' | 'available', callback: () => void): void;
    // Per-result event
    on(event: 'resolve', callback: (result: unknown) => void): void;
    // Per-rejection event
    on(event: 'error', callback: (error: unknown, context?: PoolEventContext) => void): void;

    // once mirrors on exactly
    once(event: 'start' | 'full' | 'next' | 'close' | 'available', callback: () => void): void;
    once(event: 'resolve', callback: (result: unknown) => void): void;
    once(event: 'error', callback: (error: unknown, context?: PoolEventContext) => void): void;
    ```

    In `PromisePoolImpl`, the implementation signatures must accept the union of all overload parameters, so add a broad implementation signature beneath the overloads (TypeScript requires the implementation signature to be compatible with all overloads):

    ```typescript
    on(event: POOL_EVENT_TYPE, cb: (...args: unknown[]) => void) {
      (this.#listeners[event] ??= new Map()).set(cb, false);
    }

    once(event: POOL_EVENT_TYPE, cb: (...args: unknown[]) => void) {
      (this.#listeners[event] ??= new Map()).set(cb, true);
    }
    ```

    The implementation body is unchanged — only overload declarations are added above it in the class body.

    Update the JSDoc on the interface methods to reference the new overloads (the JSDoc block already describes them — keep it, just remove the stale `@param callback` sentence referencing `...args: unknown[]`).

    The `POOL_EVENT_TYPE` type alias remains unchanged (it is still needed internally).
  </action>
  <verify>
    <automated>pnpm run build && pnpm run test</automated>
  </verify>
  <done>
    Build succeeds with zero TypeScript errors. All 144 tests pass. `on` and `once` on `PromisePool` interface expose three overloads each.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add type-level assertions to existing test file</name>
  <files>tests/index.test.ts</files>
  <action>
    At the bottom of `tests/index.test.ts`, add a describe block `'on/once type overloads (compile-time)'` that uses `@ts-expect-error` directives to assert that incorrect callback arities are rejected by the compiler, and positive cases to confirm correct signatures compile.

    ```typescript
    describe('on/once type overloads (compile-time)', () => {
      it('correct signatures compile without errors', () => {
        const p = pool({ concurrency: 1 });
        // Simple events — no args
        p.on('start', () => {});
        p.on('full', () => {});
        p.on('next', () => {});
        p.on('close', () => {});
        p.on('available', () => {});
        // resolve — one arg
        p.on('resolve', (_result: unknown) => {});
        // error — one or two args
        p.on('error', (_err: unknown) => {});
        p.on('error', (_err: unknown, _ctx?: PoolEventContext) => {});
        // once mirrors on
        p.once('start', () => {});
        p.once('resolve', (_result: unknown) => {});
        p.once('error', (_err: unknown, _ctx?: PoolEventContext) => {});
      });

      it('rejects wrong arity on simple events', () => {
        const p = pool({ concurrency: 1 });
        // @ts-expect-error — 'start' callback takes no args
        p.on('start', (_x: number) => {});
        // @ts-expect-error — 'full' callback takes no args
        p.once('full', (_x: string) => {});
      });

      it('rejects wrong arity on resolve event', () => {
        const p = pool({ concurrency: 1 });
        // @ts-expect-error — 'resolve' callback takes exactly one arg
        p.on('resolve', (_a: unknown, _b: unknown) => {});
      });
    });
    ```

    Import `PoolEventContext` at the top of the test file if not already imported (add to existing import statement from `'../src/pool'`).
  </action>
  <verify>
    <automated>pnpm run build && pnpm run test</automated>
  </verify>
  <done>
    All tests pass including the new describe block. The `@ts-expect-error` lines compile without "unused @ts-expect-error" warnings, confirming the overloads actually reject the bad signatures.
  </done>
</task>

</tasks>

<verification>
```bash
pnpm run build   # zero TypeScript errors
pnpm run test    # all tests pass (≥144)
pnpm run lint    # no lint errors
```
</verification>

<success_criteria>
- `PromisePool` interface exposes 3 overloads for `on` and 3 for `once`
- `PromisePoolImpl` compiles — implementation signature is broad enough to satisfy all overloads
- `@ts-expect-error` tests confirm bad signatures are caught at compile time
- All existing tests continue to pass (zero regressions)
- No runtime behaviour changed
</success_criteria>

<output>
After completion, create `.planning/quick/260324-ctm-improve-on-and-once-event-listener-typin/260324-ctm-SUMMARY.md`
</output>

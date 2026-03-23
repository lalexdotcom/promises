# CONVENTIONS.md — Code Style & Patterns

## Code Style

Enforced by **Biome** (`biome.json`). Key rules:

| Rule | Setting |
|------|---------|
| Indent style | Spaces |
| JS/TS quote style | Single quotes |
| Import organization | Auto-sorted (`organizeImports: "on"`) |
| Linter ruleset | Biome recommended rules |

## TypeScript Patterns

### Strict Mode
`tsconfig.json` has `"strict": true` — all strict checks enabled.

### Private Fields
ES2022 `#` private field syntax (not `private` keyword) is used for core state:

```ts
#running: Promise<any>[] = [];
#enqueued: QueuedPromise[] = [];
#listeners: Partial<Record<POOL_EVENT_TYPE, Map<() => void, boolean>>> = {};
#isStarted = false;
```

`private` keyword is used for internal methods:

```ts
private runNext() { ... }
private verbose(level, ...args) { ... }
private promiseDone(p, result, index) { ... }
private promiseRejected(p, error, index) { ... }
```

### Interface + Implementation Separation
Public API is defined as an interface; implementation is a class that is never exported:

```ts
export interface PromisePool { ... }          // Public contract
class PromisePoolImpl implements PromisePool { ... }  // Private implementation
export const pool = (...) => new PromisePoolImpl(...)  // Only factory is exported
```

### Generics
Used to preserve callback return types:

```ts
type PromiseFunction<T = unknown> = () => Promise<T>;
enqueue<P extends PromiseFunction>(promiseGenerator: P): void;
```

### Nullish Coalescing & Optional Chaining
Used throughout for safe defaults:

```ts
this.size = options?.concurrency || DEFAULT_CONCURRENCY;
(this.#listeners[type] ??= new Map()).set(cb, false);
```

## Error Handling

### Pool Errors
Rejected promises are wrapped in `PoolErrorImpl`:

```ts
class PoolErrorImpl extends Error implements PoolError {
  catched: any;  // stores original error
  constructor(message: string, catched: any) { ... }
}
```

- Default behavior (`rejectOnError: false`): errors are logged to `console.error` and processing continues; error stored in `result[index]`
- Optional behavior (`rejectOnError: true`): rejects the main pool promise immediately

### Guard Checks
Both `promiseDone` and `promiseRejected` guard against processing after resolution:

```ts
if (this.#isResolved) return;
```

### Enqueue Guards
```ts
if (this.#isClosed) throw new Error(`[${this.name}] PromisePool already closed`);
if (this.#isResolved) throw new Error(`[${this.name}] PromisePool already performed`);
```

## Logging / Verbose Pattern

Optional verbose logging with level-aware dispatch:

```ts
const VERBOSE_LEVELS = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

private verbose(level: keyof typeof VERBOSE_LEVELS, ...args: any[]) {
  if (!this.options?.verbose) return;
  if (typeof this.options?.verbose === 'function') {
    this.options.verbose(level, ...args);
  } else {
    VERBOSE_LEVELS[level](...args);
  }
}
```

`verbose` accepts `boolean` (use console) or custom function (inject your own logger).

## Object.assign Pattern for Factory + Static Methods

```ts
export const pool = Object.assign(
  (concurrency = 10, options?) => new PromisePoolImpl(...),
  {
    parallel: (commands, options?) => { ... },
    serial: (commands, options?) => { ... },
  }
);
```

This keeps the factory callable as a function while also exposing static utilities on the same symbol (common utility library pattern).

## Module Style

- All modules use **named exports** only (no default exports in src/)
- `index.ts` uses `export * from` barrel pattern
- No circular dependencies between modules

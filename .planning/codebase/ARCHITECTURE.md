# ARCHITECTURE.md — System Design & Patterns

## Pattern

**Single-concern utility library** following a class + factory function pattern.

The library exposes one main abstraction (`PromisePool`) and a set of standalone async utilities. There is no framework, no DI container, no layered architecture — it is deliberately minimal.

## Module Boundaries

```
src/
  index.ts     ← Public API surface (re-exports only)
  pool.ts      ← PromisePool feature (interface + implementation + factory)
  utils.ts     ← Standalone async utilities (no pool dependency)
```

`index.ts` acts as a barrel/aggregator — it imports nothing except the other two modules and re-exports everything.

## Core Abstractions

### `PromisePool` interface (`src/pool.ts`)

Public contract exposed to consumers:

```ts
export interface PromisePool {
  readonly promise: Promise<unknown[]>;
  readonly running: number;
  readonly waiting: number;
  readonly isStarted: boolean;
  readonly isClosed: boolean;
  readonly isResolved: boolean;

  start(): void;
  enqueue<P extends PromiseFunction>(promiseGenerator: P): void;
  close(): Promise<unknown[]>;
  on(event: POOL_EVENT_TYPE, callback: () => void): void;
  once(event: POOL_EVENT_TYPE, callback: () => void): void;
}
```

### `PromisePoolImpl` class (`src/pool.ts`)

Private implementation of `PromisePool`. Uses ES2022 private fields (`#`) for encapsulation:

- `#running` — array of in-flight Promises
- `#enqueued` — queue of pending `QueuedPromise` objects
- `#listeners` — event emitter map (`Map<cb, isOnce>`)
- `#promise`, `#resolve`, `#reject` — lifecycle Promise
- `#isStarted`, `#isClosed`, `#isResolved` — lifecycle state flags

### `pool` factory function (`src/pool.ts`)

Public factory with two static utility methods:

```ts
// Create a pool with N concurrency
const p = pool(5);

// Run all promises in parallel (unlimited concurrency)
await pool.parallel([fn1, fn2, fn3]);

// Run all promises serially (concurrency = 1)
await pool.serial([fn1, fn2, fn3]);
```

## Data Flow

```
Consumer calls pool(N)
  → new PromisePoolImpl({ concurrency: N })

Consumer calls p.enqueue(fn)
  → pushes { generator: fn, index, timeout } to #enqueued
  → if autoStart: calls start() → triggers runNext()

runNext() (core scheduler loop):
  while (#running.length < size && #enqueued.length):
    dequeue → call generator() → attach .then/.catch
    push resulting Promise to #running

On promise completion (.then):
  → promiseDone() → splice from #running → store result[index]
  → call runNext() again

On promise rejection (.catch):
  → promiseRejected():
    - if rejectOnError: reject main #promise
    - else: log error, continue runNext()

Consumer calls p.close():
  → sets #isClosed = true
  → calls start()
  → when #running empties + #isClosed: resolves main #promise
```

## Lifecycle State Machine

```
[created] → start() → [started] → enqueue() → [running]
                                     ↓
                               close() → [closed]
                                     ↓
                          all done → [resolved]
```

Once `isResolved = true`, all further `promiseDone`/`promiseRejected` callbacks are ignored (guard check at top of each).

## Event System

Lightweight internal publish-subscribe:

- Events: `'start'`, `'full'`, `'next'`, `'close'`, `'available'`
- Listeners stored in `Map<cb, isOnce>` per event type
- `once()` callbacks are auto-removed after first fire

## Entry Points

| Entry | Type | Purpose |
|-------|------|---------|
| `dist/index.js` | ESM | Runtime entry for consumers |
| `dist/index.d.ts` | TypeScript declaration | Type entry for consumers |
| `src/index.ts` | Source | Build entry for Rslib |

## Async Utilities (`src/utils.ts`)

Standalone functions with no dependency on `pool.ts`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `wait` | `(delay?) → Promise<void>` | Simple async delay |
| `timeout` | `(p, delay) → Promise<T>` | Wrap promise with a timeout |
| `unsync` | `(fct, delay?) → Promise<T>` | Run sync fn asynchronously via `setTimeout` |
| `slice` | `(fct, size?) → async fn` | Chunk array processing to prevent blocking |
| `TimeoutError` | class extends Error | Thrown by `timeout()` on expiry |

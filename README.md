# @lalex/promises

[![npm version](https://img.shields.io/npm/v/%40lalex%2Fpromises.svg)](https://www.npmjs.com/package/@lalex/promises)
[![license](https://img.shields.io/npm/l/%40lalex%2Fpromises.svg)](./LICENSE)

> Zero-dependency TypeScript promise pool + async utilities. Control concurrency,
> batch parallel/serial execution, and compose async workflows with typed results.

## Installation

```sh
npm install @lalex/promises
```

```sh
pnpm add @lalex/promises
```

## Quick Start

```js
import { pool } from '@lalex/promises';

const imagePool = pool(3); // max 3 concurrent

for (const url of imageUrls) {
  imagePool.enqueue(() => processImage(url));
}

const results = await imagePool.close();
// results[i] is the resolved value (or a PoolError if the promise failed)
console.log(`Processed ${results.length} images`);
```

## API Reference

### `pool(concurrency?, options?)`

Creates a new `PromisePool`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| concurrency | number | 10 | Max promises running simultaneously |
| options.name | string | `'pool'` | Used in error messages and verbose logs |
| options.rejectOnError | boolean | `false` | Reject pool immediately on first failure |
| options.autoStart | boolean | `true` | Auto-start on first `enqueue()` |
| options.verbose | boolean \| function | `false` | Log to console or a custom logger |

Returns a `PromisePool` with the following interface:

| Member | Type | Description |
|---|---|---|
| `promise` | `Promise<unknown[]>` | Resolves with all results once pool is closed and settled |
| `running` | `number` | Number of promises currently executing |
| `waiting` | `number` | Number of promises enqueued but not yet started |
| `isStarted` | `boolean` | `true` after `start()` has been called |
| `isClosed` | `boolean` | `true` after `close()` has been called |
| `isResolved` | `boolean` | `true` once all promises have settled |
| `start()` | `void` | Starts the pool (called automatically when `autoStart` is `true`) |
| `enqueue(fn, timeout?)` | `void` | Enqueues a promise factory for execution |
| `close()` | `Promise<unknown[]>` | Seals the queue and returns the results promise |
| `on(event, cb)` | `void` | Registers a persistent event listener |
| `once(event, cb)` | `void` | Registers a one-time event listener |

### `pool.parallel(commands, options?)`

Runs all promise factories concurrently with a configurable concurrency limit (default: 10) and resolves with results in the original input order.

To run without a concurrency limit, pass `{ concurrency: Infinity }` via options.

Return type is inferred from the input tuple: heterogeneous arrays yield `Promise<[T1, T2, ...]>`, homogeneous arrays yield `Promise<T[]>`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| commands | `(() => Promise)[]` | — | Promise factories to run concurrently |
| options | `PoolOptions` | — | Optional pool configuration. Set `concurrency: Infinity` to run all concurrently without limit |

Returns: `Promise<Results>` — typed tuple for heterogeneous, array for homogeneous.

### `pool.serial(commands, options?)`

Same as `pool.parallel` but runs one at a time (concurrency = 1), guaranteeing sequential order.

| Parameter | Type | Default | Description |
|---|---|---|---|
| commands | `(() => Promise)[]` | — | Promise factories to run sequentially |
| options | `PoolOptions` | — | Optional pool configuration (excluding `concurrency`) |

Returns: `Promise<Results>` — typed tuple for heterogeneous, array for homogeneous.

### `wait(delay?)`

Returns a Promise that resolves after the specified delay.

| Parameter | Type | Default | Description |
|---|---|---|---|
| delay | number | `0` | Milliseconds to wait |

Returns: `Promise<void>`

### `timeout(promise, delay)`

Races a Promise against a timeout. Rejects with `TimeoutError` if the promise does not settle in time.

| Parameter | Type | Default | Description |
|---|---|---|---|
| promise | `Promise<T>` | — | The promise to race against the deadline |
| delay | number | — | Timeout in milliseconds |

Throws: `TimeoutError` if the promise does not settle within `delay` milliseconds.

### `unsync(fct, delay?)`

Executes a synchronous function asynchronously by scheduling it inside a `setTimeout` callback.

| Parameter | Type | Default | Description |
|---|---|---|---|
| fct | function | — | Synchronous function to run asynchronously |
| delay | number | `0` | Milliseconds before execution |

Returns: `Promise<ReturnType of fct>`

### `slice(fct, size?)`

Wraps an array-processing function to execute in fixed-size chunks, yielding to the event loop between each chunk.

| Parameter | Type | Default | Description |
|---|---|---|---|
| fct | function | — | Array-processing function `(input[], ...args) => output[]` |
| size | number | `10_000` | Max elements per chunk |

Returns: async version of `fct` that yields between chunks.

### Events

Use `pool.on(event, callback)` or `pool.once(event, callback)` to listen for lifecycle events.

| Event | Fires when |
|---|---|
| `start` | Pool begins executing (first `start()` or `autoStart`) |
| `next` | A promise begins executing |
| `full` | Pool reaches maximum concurrency |
| `available` | A slot opens (one promise finished, capacity available) |
| `close` | `close()` is called |

## Examples

### Concurrency pool — job queue

Process a list of URLs with a bounded pool and track progress via events.

```js
import { pool } from '@lalex/promises';

const urls = [/* ... */];
let completed = 0;

const jobPool = pool(5, { name: 'scraper' });

jobPool.on('next', () => {
  process.stdout.write(`\rRunning: ${jobPool.running} | Done: ${completed}`);
});

for (const url of urls) {
  jobPool.enqueue(async () => {
    const data = await fetch(url).then(r => r.json());
    completed++;
    return data;
  });
}

const results = await jobPool.close();
console.log(`\nAll ${results.length} jobs complete`);
```

### Rate-limited API scraping

Use `wait()` to add delay between requests and keep concurrency low.

```js
import { pool, wait } from '@lalex/promises';

const userIds = [1, 2, 3, /* ... */];

const rateLimitedPool = pool(2); // max 2 in-flight at once

for (const id of userIds) {
  rateLimitedPool.enqueue(async () => {
    const user = await fetchUser(id);
    await wait(200); // 200ms cooldown per request
    return user;
  });
}

const users = await rateLimitedPool.close();
```

### Typed batch execution with `pool.parallel()` and `pool.serial()`

`pool.parallel()` and `pool.serial()` infer the result type from the input tuple —
heterogeneous arrays produce a typed tuple result with no casting needed.

By default, `pool.parallel()` runs with concurrency limit of 10. Pass `{ concurrency: Infinity }` to run all concurrently without limit.

```js
import { pool } from '@lalex/promises';

// TypeScript infers: Promise<[User, Settings, Notification[]]>
// Runs with default concurrency = 10
const [user, settings, notifications] = await pool.parallel([
  () => fetchUser(id),
  () => fetchSettings(id),
  () => fetchNotifications(id),
]);

// Run with no concurrency limit (all at once)
const results = await pool.parallel(commands, { concurrency: Infinity });

// pool.serial() guarantees sequential ordering — useful for dependent operations
const [created, confirmed] = await pool.serial([
  () => createOrder(cart),
  () => sendConfirmationEmail(cart.userId),
]);
```

### Utility functions

```js
import { wait, timeout, unsync, slice } from '@lalex/promises';

// Pause execution for 500ms
await wait(500);

// Reject if fetchData() takes longer than 3 seconds
const data = await timeout(fetchData(), 3000);

// Run a CPU-bound function off the current tick
const result = await unsync(() => expensiveComputation());

// Process a huge array without blocking the main thread
const processChunked = slice(transformRows, 5_000);
const output = await processChunked(millionRowArray);
```

## License

MIT
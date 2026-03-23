import { timeout as timeoutPromise } from './utils';

type PromiseFunction<T = unknown> = () => Promise<T>;
type QueuedPromise = {
  generator: PromiseFunction;
  index: number;
  timeout: number;
};

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_PARALLEL_CONCURRENCY = 10;
const DEFAULT_NAME = 'pool';
type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available';

/**
 * A concurrency-bounded promise pool. Enqueue async work, control how many
 * run simultaneously, and await a single promise for all results.
 *
 * Create instances via the {@link pool} factory function.
 */
export interface PromisePool {
  /** The underlying promise that resolves with all results once the pool is
   *  closed and all enqueued promises have settled. */
  readonly promise: Promise<unknown[]>;

  /** Number of promises currently executing. */
  readonly running: number;

  /** Number of promises enqueued but not yet started. */
  readonly waiting: number;

  /**
   * `true` after {@link PromisePool.start} has been called (or after the first
   * {@link PromisePool.enqueue} when `autoStart` is enabled).
   */
  readonly isStarted: boolean;

  /**
   * `true` after {@link PromisePool.close} has been called. No further
   * promises can be enqueued once the pool is closed.
   */
  readonly isClosed: boolean;

  /**
   * `true` once all running promises have settled and the pool has resolved.
   * Transitions from `false` to `true` exactly once — never reset.
   */
  readonly isResolved: boolean;

  /**
   * Starts the pool, allowing enqueued promises to begin executing.
   * No-op if the pool is already started. When `autoStart` is `true`
   * (default), this is called automatically on the first `enqueue()`.
   */
  start(): void;

  /**
   * Enqueues a promise factory for execution.
   *
   * @param promiseGenerator - A zero-argument function that returns a Promise.
   * @param timeout - Optional per-promise timeout in milliseconds. Rejects with
   *   {@link TimeoutError} if the promise does not settle within this duration.
   * @throws {Error} If the pool is already closed or already resolved.
   */
  enqueue<P extends PromiseFunction>(
    promiseGenerator: P,
    timeout?: number,
  ): void;

  /**
   * Seals the queue so no further promises can be enqueued, then returns
   * the pool promise. The pool resolves once all in-flight promises finish.
   *
   * @returns The ordered results array — one entry per enqueued promise, in
   *   enqueue order. Failed promises appear as {@link PoolError} instances
   *   when `rejectOnError` is `false`.
   */
  close(): Promise<unknown[]>;

  /**
   * Registers a persistent listener for a pool lifecycle event.
   *
   * @param event - `'start'` | `'full'` | `'next'` | `'close'` | `'available'`
   * @param callback - Invoked each time the event fires.
   */
  on(event: POOL_EVENT_TYPE, callback: () => void): void;

  /**
   * Registers a one-time listener for a pool lifecycle event.
   * The listener is automatically removed after its first invocation.
   *
   * @param event - `'start'` | `'full'` | `'next'` | `'close'` | `'available'`
   * @param callback - Invoked once, then deregistered.
   */
  once(event: POOL_EVENT_TYPE, callback: () => void): void;
}

const VERBOSE_LEVELS = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

export type PoolOptions = {
  /**
   * Maximum number of promises running simultaneously.
   * @default 10
   */
  concurrency: number;
  /**
   * Pool name used in error messages and verbose log output.
   * @default 'pool'
   */
  name?: string;
  /**
   * When `true`, rejects the pool promise immediately on the first failure.
   * When `false` (default), failures are wrapped as {@link PoolError} entries
   * in the results array and execution continues.
   * @default false
   */
  rejectOnError?: boolean;
  /**
   * Automatically starts the pool on the first `enqueue()` call.
   * Set to `false` to require an explicit `start()` call.
   * @default true
   */
  autoStart?: boolean;
  /**
   * Enable verbose logging. Pass `true` to log to the console, or a function
   * to receive structured entries: `(level: 'debug'|'info'|'warn'|'error', ...args) => void`.
   * @default false
   */
  verbose?:
    | boolean
    | ((
        level: keyof typeof VERBOSE_LEVELS,
        ...debug: Parameters<typeof console.log>
      ) => any);
};

/**
 * Wraps a rejected promise's error in the pool result array when
 * `rejectOnError` is `false`. The original thrown value is in `catched`.
 */
export interface PoolError extends Error {
  /** The original error (or rejection reason) from the failed promise. */
  catched: any;
}

class PoolErrorImpl extends Error implements PoolError {
  catched: any;

  constructor(message: string, catched: any) {
    super(message);
    this.catched = catched;
  }
}

class PromisePoolImpl implements PromisePool {
  size: number;

  private name: string;
  private options?: PoolOptions;

  private currentIndex = 0;

  #running: Promise<unknown>[] = [];
  #enqueued: QueuedPromise[] = [];
  private result: unknown[] = [];

  // Monotonic state flags — each transitions false → true exactly once and
  // is never reset. Progression is always: isStarted → isClosed → isResolved.
  #isStarted = false;
  #isClosed = false;
  #isResolved = false;

  #promise: Promise<unknown[]>;
  #resolve!: (value: unknown[]) => void;
  #reject!: (reason?: unknown) => void;

  #listeners: Partial<Record<POOL_EVENT_TYPE, Map<() => void, boolean>>> = {};

  #emit(type: POOL_EVENT_TYPE) {
    if (this.#listeners[type]) {
      this.verbose('debug', `emit ${type}`);
      for (const [cb, once] of this.#listeners[type]!) {
        cb();
        // ES2015+ Map allows safe deletion of entries during for...of iteration —
        // no deferred post-loop cleanup needed.
        if (once) this.#listeners[type]?.delete(cb);
      }
    }
  }

  on(type: POOL_EVENT_TYPE, cb: () => void) {
    (this.#listeners[type] ??= new Map()).set(cb, false);
  }

  once(type: POOL_EVENT_TYPE, cb: () => void) {
    (this.#listeners[type] ??= new Map()).set(cb, true);
  }

  constructor(options?: PoolOptions) {
    this.size = options?.concurrency || DEFAULT_CONCURRENCY;
    this.name = options?.name || DEFAULT_NAME;
    this.options = options;
    this.#promise = new Promise((res, rej) => {
      this.#resolve = res;
      this.#reject = rej;
    });
  }

  start() {
    if (!this.#isStarted) {
      this.#emit('start');
      this.verbose('info', 'start pool');
      // Defer #isStarted to the next microtask so that enqueue() calls in the
      // same synchronous frame still see #isStarted === false and enqueue normally.
      // runNext() fires once this microtask runs, picking up everything enqueued.
      Promise.resolve().then(() => {
        this.#isStarted = true;
        this.runNext();
      });
    } else {
      this.runNext();
    }
  }

  enqueue<P extends PromiseFunction>(
    promiseGenerator: P,
    timeout: number = Number.NaN,
  ) {
    if (this.#isClosed)
      throw new Error(`[${this.name}] PromisePool already closed`);
    if (this.#isResolved)
      throw new Error(`[${this.name}] PromisePool already performed`);
    this.verbose('info', `enqueue promise@${this.currentIndex}`);
    this.#enqueued.push({
      index: this.currentIndex++,
      generator: promiseGenerator,
      timeout,
    });
    if ((this.options?.autoStart ?? true) && !this.#isStarted) {
      this.start();
    } else if (this.#isStarted) {
      this.runNext();
    }
  }
  private verbose(level: keyof typeof VERBOSE_LEVELS, ...args: any[]) {
    if (!this.options?.verbose) return;
    if (typeof this.options?.verbose === 'function') {
      this.options.verbose(level, ...args);
    } else if (this.options?.verbose) {
      VERBOSE_LEVELS[level](...args);
    }
  }

  private runNext() {
    if (this.#isStarted) {
      if (this.#enqueued.length) {
        let added = 0;
        // Drain all available slots in one call. A single `if` would fill one slot per
        // tick, causing artificial latency when multiple slots free up simultaneously
        // after a batch of promises completes.
        while (this.#running.length < this.size && !!this.#enqueued.length) {
          const nextQueuedPromise = this.#enqueued.shift();
          this.verbose('info', `run promise ${nextQueuedPromise?.index}`);
          if (nextQueuedPromise) {
            const { generator, index, timeout } = nextQueuedPromise;
            this.#emit('next');
            // enqueue() defaults timeout to Number.NaN to mean "no timeout requested".
            // NaN is intentional: !Number.isNaN(NaN) === false, so the timeout wrapper
            // is skipped cleanly without an extra boolean flag.
            const nextPromise =
              !Number.isNaN(timeout) && timeout > 0
                ? timeoutPromise(generator(), timeout)
                : generator();
            nextPromise
              .then((res) => this.promiseDone(nextPromise, res, index))
              .catch((err) => this.promiseRejected(nextPromise, err, index));
            this.#running.push(nextPromise);
            added++;
          }
        }
        // Only emit 'full' when new promises were added in *this* call and the pool
        // reached capacity. Without the `added` guard, 'full' would fire on every
        // promiseDone cycle even when the pool was already saturated.
        if (this.#running.length >= this.size) {
          if (added) this.#emit('full');
        }
      } else if (!this.#running.length) {
        // The pool resolves at this single point only — both conditions must hold:
        // queue is sealed (close() was called) AND nothing is still running. This
        // prevents premature resolution when the queue is momentarily empty between
        // enqueue() calls.
        if (this.#isClosed) {
          this.verbose('info', 'no more queue: done');
          this.#isResolved = true;
          this.#resolve(this.result);
        } else {
          this.verbose('info', 'waiting for new promises or close');
        }
      } else {
        // 'available' signals that exactly one slot just freed up. Checked *after*
        // #running.splice() removes the settled promise — `size - 1` running means
        // capacity has become available again.
        if (this.#running.length === this.size - 1) {
          this.#emit('available');
        }
        this.verbose('info', `${this.#running.length} promises still running`);
      }
    }
  }

  get promise() {
    return this.#promise;
  }

  get running() {
    return this.#running.length;
  }

  get waiting() {
    return this.#enqueued.length;
  }

  get isStarted() {
    return this.#isStarted;
  }

  get isClosed() {
    return this.#isClosed;
  }

  get isResolved() {
    return this.#isResolved;
  }

  private promiseDone(p: Promise<unknown>, result: any, index: number) {
    // Guard against post-resolution callbacks: multiple in-flight promises can
    // settle near-simultaneously in the microtask queue. #isResolved is set
    // synchronously before #resolve() fires, so late callbacks are silently ignored.
    if (this.#isResolved) return;
    const promiseIndex = this.#running.indexOf(p);
    if (promiseIndex >= 0) {
      this.#running.splice(promiseIndex, 1);
      this.result[index] = result;
      this.verbose('info', `promise@${index} done`);
      this.runNext();
    } else {
      this.verbose('warn', 'unknown promise resolved');
    }
  }

  private promiseRejected(p: Promise<unknown>, error: any, index: number) {
    // Guard against post-resolution callbacks: multiple in-flight promises can
    // settle near-simultaneously in the microtask queue. #isResolved is set
    // synchronously before #resolve() fires, so late callbacks are silently ignored.
    if (this.#isResolved) return;
    const promiseIndex = this.#running.indexOf(p);
    if (promiseIndex >= 0) {
      this.#running.splice(promiseIndex, 1);
      this.result[index] = new PoolErrorImpl(
        `Promise ${index} was rejected`,
        error,
      );
      if (this.options?.rejectOnError) {
        this.#isResolved = true;
        this.#reject(error);
      } else {
        console.error(
          error instanceof Error ? error.message : JSON.stringify(error),
        );
        this.runNext();
      }
      this.verbose('error', `promise@${index} error`, error);
    } else {
      this.verbose('warn', 'unknown promise error');
    }
  }

  close() {
    this.verbose('info', 'close pool');
    this.#isClosed = true;
    this.start();
    return this.#promise;
  }
}

/**
 * Creates a new {@link PromisePool} with the given concurrency and options.
 *
 * Also exposes two static batch-execution helpers:
 * - `pool.parallel(commands)` — runs all commands with concurrency limit (default: 10)
 * - `pool.serial(commands)` — runs all commands one at a time
 *
 * Both helpers infer typed results: heterogeneous arrays yield a tuple
 * `Promise<[T1, T2, ...]>`; homogeneous arrays yield `Promise<T[]>`.
 *
 * @param concurrency - Max promises running simultaneously.
 * @param options - Additional pool configuration.
 * @default concurrency 10
 */
// Object.assign attaches parallel() and serial() as static methods on the
// factory function — enabling both `pool(10)` and `pool.parallel([...])` from
// a single import without a class-based API that would require `new`.
export const pool = Object.assign(
  (concurrency = 10, options?: Omit<PoolOptions, 'concurrency'>): PromisePool =>
    new PromisePoolImpl({ ...options, concurrency }),
  {
    /**
     * Runs all promise factories concurrently with a configurable concurrency limit
     * (default: 10). Resolves with results in the original input order.
     *
     * Return type is inferred from the input tuple type:
     * heterogeneous → `Promise<[T1, T2, ...]>`, homogeneous → `Promise<T[]>`.
     *
     * To run without a concurrency limit, pass `{ concurrency: Infinity }` via options.
     *
     * @param commands - Array of zero-argument functions each returning a Promise.
     * @param options - Optional pool configuration. `concurrency` is optional (default: 10); set to `Infinity` for unlimited concurrency.
     */
    parallel: <T extends PromiseFunction[]>(
      commands: [...T],
      options?: Omit<PoolOptions, 'concurrency'> & { concurrency?: number },
    ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> => {
      if (!commands.length)
        return Promise.resolve([]) as Promise<{
          [K in keyof T]: Awaited<ReturnType<T[K]>>;
        }>;
      const parallelPool = new PromisePoolImpl({
        concurrency: options?.concurrency ?? DEFAULT_PARALLEL_CONCURRENCY,
        ...options,
      });
      for (const cmd of commands) parallelPool.enqueue(cmd);
      return parallelPool.close() as Promise<{
        [K in keyof T]: Awaited<ReturnType<T[K]>>;
      }>;
    },
    /**
     * Runs all promise factories sequentially (concurrency = 1) and resolves
     * with results in the original input order.
     *
     * Return type is inferred from the input tuple type:
     * heterogeneous → `Promise<[T1, T2, ...]>`, homogeneous → `Promise<T[]>`.
     *
     * @param commands - Array of zero-argument functions each returning a Promise.
     * @param options - Optional pool configuration (excluding `concurrency`).
     */
    serial: <T extends PromiseFunction[]>(
      commands: [...T],
      options?: Omit<PoolOptions, 'concurrency'>,
    ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> => {
      if (!commands.length)
        return Promise.resolve([]) as Promise<{
          [K in keyof T]: Awaited<ReturnType<T[K]>>;
        }>;
      const parallelPool = new PromisePoolImpl({ ...options, concurrency: 1 });
      for (const cmd of commands) parallelPool.enqueue(cmd);
      return parallelPool.close() as Promise<{
        [K in keyof T]: Awaited<ReturnType<T[K]>>;
      }>;
    },
  },
);

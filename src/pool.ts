import { timeout as timeoutPromise } from './utils';

type PromiseFunction<T = unknown> = () => Promise<T>;
type QueuedPromise = {
  generator: PromiseFunction;
  index: number;
  timeout: number;
};

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_PARALLEL_CONCURRENCY = 10;
type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available' | 'resolve' | 'error';

/**
 * Context object provided with 'error' event listener, containing pool state snapshot at rejection time.
 */
export interface PoolEventContext {
  /** Number of promises currently executing (started but not settled). */
  runningCount: number;
  /** Number of promises enqueued but not yet started. */
  waitingCount: number;
  /** Total promises not yet settled (runningCount + waitingCount). */
  pendingCount: number;
  /** `true` if pool has started. */
  isStarted: boolean;
  /** `true` if pool has been closed. */
  isClosed: boolean;
  /** `true` if pool has fully resolved. */
  isResolved: boolean;
}

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
   * Maximum number of promises that can run simultaneously (from PoolOptions).
   * This value is immutable for the lifetime of the pool.
   */
  readonly concurrency: number;

  /**
   * Number of promises currently executing (started but not yet settled).
   * Equivalent to `running` property.
   */
  readonly runningCount: number;

  /**
   * Number of promises enqueued but not yet started.
   * Equivalent to `waiting` property.
   */
  readonly waitingCount: number;

  /**
   * Total number of promises not yet settled (both running and waiting).
   * Equivalent to `runningCount + waitingCount`.
   */
  readonly pendingCount: number;

  /**
   * Number of promises that have successfully resolved.
   * Monotonically increases (never decreases or resets).
   */
  readonly resolvedCount: number;

  /**
   * Number of promises that have been rejected.
   * Monotonically increases (never decreases or resets).
   */
  readonly rejectedCount: number;

  /**
   * Total number of promises that have settled (either resolved or rejected).
   * Equivalent to `resolvedCount + rejectedCount`.
   */
  readonly settledCount: number;

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
   * Supported events and callback signatures:
   * - `'start'`, `'full'`, `'next'`, `'close'`, `'available'`: `() => void`
   * - `'resolve'`: `(result: unknown) => void` — fires per-promise when it resolves
   * - `'error'`: `(error: unknown, context?: PoolEventContext) => void` — fires per-promise on rejection
   *
   * @param event - Event type
   * @param callback - Listener function (signature depends on event type)
   */
  on(event: POOL_EVENT_TYPE, callback: (...args: unknown[]) => void): void;

  /**
   * Registers a one-time listener for a pool lifecycle event.
   * The listener is automatically removed after its first invocation.
   *
   * Supported events and callback signatures: same as `on()` method.
   *
   * @param event - Event type
   * @param callback - Listener function (signature depends on event type); invoked once then deregistered
   */
  once(event: POOL_EVENT_TYPE, callback: (...args: unknown[]) => void): void;
}

export type PoolOptions = {
  /**
   * Maximum number of promises running simultaneously.
   * @default 10
   */
  concurrency: number;
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

  // Cumulative counters for settled promises. Incremented in promiseDone()
  // and promiseRejected() respectively. Only increase, never reset.
  #resolvedCount = 0;
  #rejectedCount = 0;

  #promise: Promise<unknown[]>;
  #resolve!: (value: unknown[]) => void;
  #reject!: (reason?: unknown) => void;

  #listeners: Partial<Record<POOL_EVENT_TYPE, Map<(...args: unknown[]) => void, boolean>>> = {};

  #emit(type: POOL_EVENT_TYPE, ...args: unknown[]) {
    if (this.#listeners[type]) {
      for (const [cb, once] of this.#listeners[type]!) {
        cb(...args);
        // ES2015+ Map allows safe deletion of entries during for...of iteration —
        // no deferred post-loop cleanup needed.
        if (once) this.#listeners[type]?.delete(cb);
      }
    }
  }

  on(type: POOL_EVENT_TYPE, cb: (...args: unknown[]) => void) {
    (this.#listeners[type] ??= new Map()).set(cb, false);
  }

  once(type: POOL_EVENT_TYPE, cb: (...args: unknown[]) => void) {
    (this.#listeners[type] ??= new Map()).set(cb, true);
  }

  constructor(options?: PoolOptions) {
    this.size = options?.concurrency || DEFAULT_CONCURRENCY;
    this.options = options;
    this.#promise = new Promise((res, rej) => {
      this.#resolve = res;
      this.#reject = rej;
    });
  }

  start() {
    if (!this.#isStarted) {
      this.#emit('start');
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
      throw new Error('PromisePool already closed');
    if (this.#isResolved)
      throw new Error('PromisePool already performed');
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

  private runNext() {
    if (this.#isStarted) {
      if (this.#enqueued.length) {
        let added = 0;
        // Drain all available slots in one call. A single `if` would fill one slot per
        // tick, causing artificial latency when multiple slots free up simultaneously
        // after a batch of promises completes.
        while (this.#running.length < this.size && !!this.#enqueued.length) {
          const nextQueuedPromise = this.#enqueued.shift();
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
          this.#isResolved = true;
          // Note: 'resolve' event is reserved for per-promise resolutions (emitted
          // in promiseDone). Pool completion is detected via isResolved getter or by
          // awaiting pool.promise.
          this.#resolve(this.result);
        }
      } else {
        // 'available' signals that exactly one slot just freed up. Checked *after*
        // #running.splice() removes the settled promise — `size - 1` running means
        // capacity has become available again.
        if (this.#running.length === this.size - 1) {
          this.#emit('available');
        }
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

  get concurrency() {
    return this.size;
  }

  get runningCount() {
    return this.#running.length;
  }

  get waitingCount() {
    return this.#enqueued.length;
  }

  get pendingCount() {
    return this.runningCount + this.waitingCount;
  }

  get resolvedCount() {
    return this.#resolvedCount;
  }

  get rejectedCount() {
    return this.#rejectedCount;
  }

  get settledCount() {
    return this.resolvedCount + this.rejectedCount;
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
      this.#resolvedCount++;
      // Emit 'resolve' event per-promise with the result value (before 'next')
      this.#emit('resolve', result);
      this.runNext();
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
      // Emit 'error' event per-promise with error and current pool context (always, before rejectOnError handling)
      const context: PoolEventContext = {
        runningCount: this.#running.length,
        waitingCount: this.#enqueued.length,
        pendingCount: this.#running.length + this.#enqueued.length,
        isStarted: this.#isStarted,
        isClosed: this.#isClosed,
        isResolved: this.#isResolved,
      };
      this.#emit('error', error, context);
      this.#rejectedCount++;
      this.result[index] = new PoolErrorImpl(
        `Promise ${index} was rejected`,
        error,
      );
      if (this.options?.rejectOnError) {
        this.#isResolved = true;
        this.#reject(error);
      } else {
        this.runNext();
      }
    }
  }

  close() {
    this.#isClosed = true;
    // Clear all listeners per D2: explicit resource cleanup
    for (const lifeCycleListeners of Object.values(this.#listeners)) {
      lifeCycleListeners?.clear();
    }
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

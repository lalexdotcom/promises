/**
 * Returns a Promise that resolves after the specified delay.
 *
 * @param delay - Duration in milliseconds to wait before resolving.
 * @default delay 0
 */
export function wait(delay = 0) {
  return new Promise<void>((res) => {
    setTimeout(res, delay);
  });
}

/**
 * Thrown when a promise does not settle within the allowed duration.
 * Raised by {@link timeout} and by {@link PromisePool.enqueue} when a
 * per-promise timeout is set via `enqueue(fn, timeoutMs)`.
 *
 * Optional context fields populated by timeout() and pool.enqueue():
 * - `timeout`: The timeout duration in milliseconds that was exceeded
 * - `promise`: The promise that did not settle within the timeout duration
 *
 * These fields are always present when TimeoutError is thrown by timeout(),
 * but may be undefined if the error is created elsewhere.
 */
export class TimeoutError extends Error {
  /**
   * The timeout duration in milliseconds that was exceeded.
   * Present when TimeoutError is thrown by timeout() or pool.enqueue.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  timeout?: number;

  /**
   * The promise that did not settle within the timeout duration.
   * Captured at rejection time for debugging timeout root-cause.
   * This is the original promise passed to timeout(), before any wrapping.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  promise?: unknown;

  constructor(message?: string) {
    super(message ?? 'Promise timed out');
    this.name = 'TimeoutError';
  }
}

/**
 * Races a Promise against a timeout. If the promise does not settle
 * within `delay` milliseconds the returned promise rejects with
 * {@link TimeoutError}. A late resolution (after timeout) is silently ignored.
 * A rejection from `p` before the timeout is propagated normally.
 *
 * When TimeoutError is thrown, it includes:
 * - `timeout` field: the deadline duration in milliseconds
 * - `promise` field: the original promise that was raced
 *
 * @param p - The promise to race against the deadline.
 * @param delay - Timeout duration in milliseconds.
 * @throws {TimeoutError} If `p` does not settle within `delay` milliseconds.
 *
 * @example
 * ```typescript
 * try {
 *   const result = await timeout(fetchData(), 5000);
 * } catch (err) {
 *   if (err instanceof TimeoutError) {
 *     console.log(`Timed out after ${err.timeout}ms`);
 *     console.log(`Promise that timed out: ${err.promise}`);
 *   }
 * }
 * ```
 */
export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    let isTooLate = false;
    let isResolved = false;
    const to = setTimeout(() => {
      if (!isResolved) {
        isTooLate = true;
        clearTimeout(to);
        const err = new TimeoutError(`Promise timed out after ${delay}ms`);
        err.timeout = delay;
        err.promise = p;
        rej(err);
      }
    }, delay);
    p.then((v) => {
      if (!isTooLate) {
        isResolved = true;
        clearTimeout(to);
        res(v);
      }
      // late resolution silently ignored — outer promise already rejected
    }).catch((err) => {
      if (!isTooLate) {
        isResolved = true;
        clearTimeout(to);
        rej(err);
      }
    });
  });
}

/**
 * Executes a synchronous function asynchronously by scheduling it inside
 * a `setTimeout` callback. Errors thrown by `fct` are propagated as
 * promise rejections.
 *
 * @param fct - The synchronous function to execute asynchronously.
 * @param delay - Delay before execution in milliseconds.
 * @default delay 0
 */
export function unsync<TResult>(
  fct: (...args: unknown[]) => TResult,
  delay?: number,
): Promise<TResult> {
  return new Promise((res, rej) => {
    setTimeout(() => {
      try {
        const result = fct();
        res(result);
      } catch (e) {
        rej(e);
      }
    }, delay);
  });
}

/**
 * Wraps an array-processing function to execute in fixed-size chunks,
 * yielding to the event loop between each chunk. Prevents the main thread
 * from blocking on CPU-heavy array operations.
 *
 * @param fct - A function that accepts an array (plus optional extra args)
 *   and returns a transformed array of the same result type.
 * @param size - Maximum number of elements to process per chunk.
 * @default size 10_000
 */
export function slice<
  FuncType extends (input: any[], ...args: unknown[]) => any[],
>(fct: FuncType, size = 10_000) {
  type OutputType = ReturnType<FuncType>;
  return async (...args: Parameters<FuncType>): Promise<OutputType> => {
    const [input, ...restArgs] = args;
    const pendingInput = [...input];
    let result = [] as OutputType;
    while (pendingInput.length) {
      const sliceInput = pendingInput.splice(0, size);
      const sliceResult = await new Promise<OutputType>((res) => {
        setTimeout(() => res(fct(sliceInput, ...restArgs) as OutputType));
      });
      result = result.concat(sliceResult) as OutputType;
    }
    return result;
  };
}

/**
 * Creates a deferred promise — a Promise whose `resolve` and `reject`
 * functions are exposed for external control. Useful when the resolution
 * source is separate from the consumption site.
 *
 * @returns An object containing `promise`, `resolve`, and `reject`.
 */
export const defer = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

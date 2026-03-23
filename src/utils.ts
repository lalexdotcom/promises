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
 */
export class TimeoutError extends Error {}

/**
 * Races a Promise against a timeout. If the promise does not settle
 * within `delay` milliseconds the returned promise rejects with
 * {@link TimeoutError}. A late resolution (after timeout) is silently ignored.
 * A rejection from `p` before the timeout is propagated normally.
 *
 * @param p - The promise to race against the deadline.
 * @param delay - Timeout duration in milliseconds.
 * @throws {TimeoutError} If `p` does not settle within `delay` milliseconds.
 */
export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    let isTooLate = false;
    let isResolved = false;
    const to = setTimeout(() => {
      if (!isResolved) {
        isTooLate = true;
        clearTimeout(to);
        rej(new TimeoutError('Promise timed out'));
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

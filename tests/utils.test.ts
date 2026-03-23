import { describe, expect, test } from '@rstest/core';
import { slice, TimeoutError, timeout, unsync, wait } from '../src/index';

// ─── TEST-07 : wait ──────────────────────────────────────────────────────────

describe('wait', () => {
  test('TEST-07: resolves after at least the expected delay', async () => {
    const delay = 30;
    const start = Date.now();
    await wait(delay);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(delay);
  });
});

// ─── TEST-08 : timeout ───────────────────────────────────────────────────────

describe('timeout', () => {
  test('TEST-08a: rejects with TimeoutError when promise is slow (200 ms, timeout 30 ms)', async () => {
    const slow = new Promise<void>((res) => setTimeout(res, 200));
    await expect(timeout(slow, 30)).rejects.toBeInstanceOf(TimeoutError);
  });

  test('TEST-08b: resolves correctly when promise is fast', async () => {
    const fast = Promise.resolve(42);
    const result = await timeout(fast, 500);
    expect(result).toBe(42);
  });

  test('TEST-08c: propagates rejection from inner promise — not TimeoutError, not undefined (BUG-02 fix)', async () => {
    // Inner promise rejects immediately, well before the 500 ms timeout.
    // Must reject with the original Error, NOT with TimeoutError.
    let caughtError: unknown;
    try {
      await timeout(Promise.reject(new Error('boom')), 500);
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).not.toBeInstanceOf(TimeoutError);
    expect((caughtError as Error).message).toBe('boom');
  });

  test('TEST-08d: late resolution after timeout is silenced (no unhandled rejection)', async () => {
    // Inner promise resolves AFTER the 30 ms timeout fires.
    // Outer promise must reject with TimeoutError — no double rejection.
    const slow = new Promise<number>((res) => setTimeout(() => res(99), 200));
    await expect(timeout(slow, 30)).rejects.toBeInstanceOf(TimeoutError);
    // Wait for the slow promise to settle so any unhandled rejection would surface.
    await wait(200);
  });
});

// ─── TEST-09 : unsync ────────────────────────────────────────────────────────

describe('unsync', () => {
  test('TEST-09: executes asynchronously — fn runs after the synchronous caller continues', async () => {
    const order: string[] = [];

    const p = unsync(() => {
      order.push('inside');
      return 'result';
    });

    // This line runs BEFORE the setTimeout callback fires.
    order.push('after-unsync');

    const result = await p;

    expect(result).toBe('result');
    // 'after-unsync' must come before 'inside' — proves non-blocking.
    expect(order).toEqual(['after-unsync', 'inside']);
  });

  test('TEST-09: propagates errors from fn as promise rejections', async () => {
    const p = unsync(() => {
      throw new Error('unsync error');
    });
    await expect(p).rejects.toThrow('unsync error');
  });
});

// ─── TEST-10 : slice ─────────────────────────────────────────────────────────

describe('slice', () => {
  test('TEST-10: processes array in chunks of given size and preserves order', async () => {
    const calls: number[][] = [];

    const fn = (input: number[]) => {
      calls.push([...input]);
      return input.map((n) => n * 2);
    };

    const sliced = slice(fn, 3);
    const result = await sliced([1, 2, 3, 4, 5, 6, 7]);

    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
    // 7 items, size 3 → chunks [1,2,3], [4,5,6], [7]
    expect(calls).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  test('TEST-10: handles empty array without calling fn', async () => {
    const callCount = { n: 0 };
    const fn = (input: number[]) => {
      callCount.n++;
      return input.map((n) => n * 2);
    };
    const sliced = slice(fn, 3);
    const result = await sliced([]);
    expect(result).toEqual([]);
    expect(callCount.n).toBe(0);
  });

  test('TEST-10: default size (10 000) processes small arrays in a single chunk', async () => {
    const calls: number[][] = [];
    const fn = (input: number[]) => {
      calls.push([...input]);
      return input.map((n) => n + 1);
    };
    const sliced = slice(fn); // no size argument → default 10 000
    const input = [10, 20, 30, 40, 50];
    const result = await sliced(input);
    expect(result).toEqual([11, 21, 31, 41, 51]);
    // All 5 items fit in one chunk.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(input);
  });
});

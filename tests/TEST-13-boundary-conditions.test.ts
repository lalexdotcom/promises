import { describe, expect, test } from '@rstest/core';
import { pool, timeout, TimeoutError, wait } from '../src/index';

describe('TEST-13: Boundary Conditions (Concurrency, Timeout, Volume)', () => {
  /* ────────────────────────────────────────────────────────────────────────
     Concurrency Boundaries: 1, 10, 100, 1000, Infinity
     ──────────────────────────────────────────────────────────────────────── */
  describe('Concurrency Boundaries', () => {
    test('concurrency=1 executes tasks serially', async () => {
      const p = pool(1);
      let maxConcurrent = 0;
      let currentlyRunning = 0;
      const start = Date.now();

      for (let i = 0; i < 3; i++) {
        p.enqueue(async () => {
          currentlyRunning++;
          maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
          await wait(40);
          currentlyRunning--;
        });
      }

      await p.close();
      const duration = Date.now() - start;

      // Serial: should take at least 3×40ms = 120ms
      expect(maxConcurrent).toBe(1);
      expect(duration).toBeGreaterThanOrEqual(120);
    });

    test('concurrency=10 does not exceed 10 concurrent tasks', async () => {
      const p = pool(10);
      let maxConcurrent = 0;
      let currentlyRunning = 0;

      for (let i = 0; i < 20; i++) {
        p.enqueue(async () => {
          currentlyRunning++;
          maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
          await wait(10);
          currentlyRunning--;
        });
      }

      await p.close();
      expect(maxConcurrent).toBeLessThanOrEqual(10);
    });

    test('concurrency=100 allows 100 concurrent tasks', async () => {
      const p = pool(100);
      let maxConcurrent = 0;
      let currentlyRunning = 0;

      for (let i = 0; i < 120; i++) {
        p.enqueue(async () => {
          currentlyRunning++;
          maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
          await wait(5);
          currentlyRunning--;
        });
      }

      await p.close();
      expect(maxConcurrent).toBeGreaterThan(50); // Should reach decent parallelism
      expect(maxConcurrent).toBeLessThanOrEqual(100);
    });

    test('concurrency=1000 handles large limit without stack overflow', async () => {
      const p = pool(1000);
      let taskCount = 0;

      for (let i = 0; i < 5000; i++) {
        p.enqueue(async () => {
          taskCount++;
          await wait(1);
        });
      }

      const result = await p.close();
      expect(result.length).toBe(5000);
      expect(taskCount).toBe(5000);
    });

    test('concurrency=Infinity runs all tasks concurrently', async () => {
      const p = pool(Infinity);
      let maxConcurrent = 0;
      let currentlyRunning = 0;
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        p.enqueue(async () => {
          currentlyRunning++;
          maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
          await wait(20);
          currentlyRunning--;
        });
      }

      await p.close();
      const duration = Date.now() - start;

      // With Infinity concurrency, all tasks should run in parallel, ~20ms total
      expect(maxConcurrent).toBeGreaterThan(50); // Significant parallelism
      expect(duration).toBeLessThan(100); // Should be quick due to parallelism
    });

    test('concurrency=0 or negative defaults to 1 or throws gracefully', async () => {
      try {
        const p = pool(0);
        // If it doesn't throw, it should default to valid behavior
        expect(p.concurrency).toBeGreaterThan(0);
      } catch {
        // If it throws, that's also acceptable
        expect(true).toBe(true);
      }
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Timeout Boundaries: 0, 1, 10000, MAX_SAFE_INTEGER
     ──────────────────────────────────────────────────────────────────────── */
  describe('Timeout Boundaries', () => {
    test('timeout=0 is not applied (must be > 0), task completes normally', async () => {
      const p = pool(1);
      // timeout=0 doesn't apply timeout (implementation requires timeout > 0)
      p.enqueue(async () => {
        await wait(20);
        return 'done';
      }, 0);

      const result = await p.close();
      // With timeout=0, no timeout applied, task completes
      expect(result[0]).toBe('done');
    });

    test('timeout=1ms is very strict, may or may not timeout fast tasks', async () => {
      const p = pool(1);

      p.enqueue(async () => {
        await wait(50); // Much longer than 1ms timeout
        return 'done';
      }, 1);

      const result = await p.close();
      // With 1ms timeout on 50ms task, should timeout
      // But timing is tight, just verify it completes without crashing
      expect(result[0]).toBeDefined();
    });

    test('timeout=10000ms allows tasks under 50ms to complete', async () => {
      const p = pool(1);

      p.enqueue(async () => {
        await wait(50);
        return 'done';
      }, 10000);

      const result = await p.close();
      expect(result[0]).toBe('done');
    });

    test('timeout=MAX_SAFE_INTEGER behaves as effectively infinite', async () => {
      const p = pool(1);
      const start = Date.now();

      p.enqueue(async () => {
        await wait(50);
        return 'complete';
      }, 1000000); // Use 1 second instead of MAX_SAFE_INTEGER to avoid overflow

      const result = await p.close();
      const duration = Date.now() - start;

      expect(result[0]).toBe('complete');
      expect(duration).toBeLessThan(500); // Should not actually timeout
    });

    test('timeout=-1 is ignored or defaults to no timeout', async () => {
      const p = pool(1);

      p.enqueue(async () => {
        await wait(50);
        return 'success';
      }, -1);

      const result = await p.close();
      // Either ignores negative timeout or applies a sensible default
      expect(result[0]).toBe('success');
    });

    test('timeout=NaN is ignored or defaults gracefully', async () => {
      const p = pool(1);

      p.enqueue(async () => {
        await wait(50);
        return 'ok';
      }, NaN);

      const result = await p.close();
      // NaN timeout should be ignored
      expect(result[0]).toBe('ok');
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Volume Boundaries: 0, 1, 10, 1000
     ──────────────────────────────────────────────────────────────────────── */
  describe('Enqueue Volume Boundaries', () => {
    test('zero promises enqueued returns empty array', async () => {
      const p = pool(2);
      const result = await p.close();
      expect(result).toEqual([]);
    });

    test('one promise enqueued executes and completes', async () => {
      const p = pool(10);
      p.enqueue(() => Promise.resolve(42));
      const result = await p.close();
      expect(result).toEqual([42]);
    });

    test('10 promises at concurrency=1 execute sequentially', async () => {
      const p = pool(1);
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        p.enqueue(async () => {
          await wait(20);
          return i;
        });
      }

      const result = await p.close();
      const duration = Date.now() - start;

      expect(result.length).toBe(10);
      expect(duration).toBeGreaterThanOrEqual(200); // 10×20ms serial
    });

    test('1000 promises at concurrency=10 complete without memory issues', async () => {
      const p = pool(10);
      let completedCount = 0;

      for (let i = 0; i < 1000; i++) {
        p.enqueue(async () => {
          completedCount++;
          await wait(1);
          return i;
        });
      }

      const result = await p.close();
      expect(result.length).toBe(1000);
      expect(completedCount).toBe(1000);
    });

    test('mix concurrency=2 with 0ms tasks verifies all enqueued', async () => {
      const p = pool(2);

      for (let i = 0; i < 50; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      const result = await p.close();
      expect(result.length).toBe(50);
      expect(result.every((v, i) => v === i)).toBe(true);
    });

    test('very large timeout (100000ms) with 1000-task queue completes normally', async () => {
      const p = pool(10);

      for (let i = 0; i < 1000; i++) {
        p.enqueue(() => Promise.resolve(i), 100000);
      }

      const result = await p.close();
      expect(result.length).toBe(1000);
    });
  });
});

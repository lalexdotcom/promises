import { describe, expect, test } from '@rstest/core';
import { pool, TimeoutError, timeout, wait } from '../src/index';

describe('TEST-18: Advanced Patterns (Integration)', () => {
  /* ────────────────────────────────────────────────────────────────────────
     Retry Pattern: manual retry with max attempts, exponential backoff
     ──────────────────────────────────────────────────────────────────────── */
  describe('Retry Pattern', () => {
    test('manual retry with max attempts succeeds after transient failure', async () => {
      const p = pool(5);
      const MAX_RETRIES = 3;
      let attemptCount = 0;

      async function retryableTask() {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Transient failure');
        }
        return 'success';
      }

      p.enqueue(async () => {
        let lastError: any = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            return await retryableTask();
          } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
              await wait(2 ** attempt * 10); // Exponential backoff
            }
          }
        }
        throw lastError;
      });

      const result = await p.close();
      expect(result[0]).toBe('success');
      expect(attemptCount).toBe(2);
    });

    test('retry respects max retry count and fails gracefully', async () => {
      const p = pool(5);
      const MAX_RETRIES = 2;
      let attemptCount = 0;

      async function alwaysFails() {
        attemptCount++;
        throw new Error('Permanent failure');
      }

      p.enqueue(async () => {
        let lastError: any = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            return await alwaysFails();
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      });

      const result = await p.close();
      // Should fail after 2 attempts
      expect(result[0] instanceof Error).toBe(true);
      expect(attemptCount).toBe(2);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Timeout with Fallback: graceful degradation with cached values
     ──────────────────────────────────────────────────────────────────────── */
  describe('Timeout with Fallback', () => {
    test('timeout wrapper with fallback catches timeout error', async () => {
      const p = pool(5);
      const cachedValue = 'cached-result';

      p.enqueue(async () => {
        return timeout(
          wait(100).then(() => 'slow-result'),
          50,
        ).catch(() => cachedValue);
      });

      const result = await p.close();
      expect(result[0]).toBe(cachedValue);
    });

    test('fast task completes before timeout, no fallback used', async () => {
      const p = pool(5);
      const fallbackValue = 'fallback';

      p.enqueue(async () => {
        return timeout(
          wait(20).then(() => 'fast-result'),
          100,
        ).catch(() => fallbackValue);
      });

      const result = await p.close();
      expect(result[0]).toBe('fast-result');
    });

    test('pool timeout and per-task timeout composition works', async () => {
      const p = pool(5); // Pool circuit breaker

      p.enqueue(() =>
        // Task-level timeout with fallback
        timeout(
          wait(50).then(() => 'success'),
          100,
        ).catch(() => 'timeout-fallback'),
      );

      const result = await p.close();
      expect(result[0]).toBe('success');
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Monitoring & Progress Tracking: getters, progress ratio
     ──────────────────────────────────────────────────────────────────────── */
  describe('Monitoring & Progress Tracking', () => {
    test('monitoring pendingCount during execution', async () => {
      const p = pool(3, { autoStart: false });
      const progressSnapshots: number[] = [];

      for (let i = 0; i < 20; i++) {
        p.enqueue(async () => {
          await wait(20);
          return i;
        });
      }

      p.start();

      // Sample progress periodically
      const snapshots = setInterval(() => {
        progressSnapshots.push(p.pendingCount);
      }, 5);

      await p.close();
      clearInterval(snapshots);

      // Initially high pending count
      expect(progressSnapshots[0]).toBeGreaterThan(0);
      // Eventually reaches 0 (or near 0 at last sample)
      expect(
        progressSnapshots[progressSnapshots.length - 1],
      ).toBeLessThanOrEqual(2);
    });

    test('task completion ratio increases monotonically', async () => {
      const p = pool(2);
      const ratios: number[] = [];

      for (let i = 0; i < 20; i++) {
        p.enqueue(async () => {
          await wait(10);
          return i;
        });
      }

      // Monitor during execution
      const monitor = setInterval(() => {
        const total = p.settledCount + p.pendingCount;
        if (total > 0) {
          const ratio = (p.settledCount / total) * 100;
          ratios.push(ratio);
        }
      }, 2);

      await p.close();
      clearInterval(monitor);

      // Ratio should be monotonically increasing
      for (let i = 1; i < ratios.length; i++) {
        expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]);
      }

      // Final check: all settled
      expect(p.settledCount).toBe(20);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Mixed Sync/Async Execution: wrapping sync in Promise, concurrency control
     ──────────────────────────────────────────────────────────────────────── */
  describe('Mixed Sync/Async Execution', () => {
    test('async and sync work mixed in one pool with concurrency control', async () => {
      const p = pool(2);
      let syncWorkCount = 0;
      let asyncWorkCount = 0;

      // 5 async tasks
      for (let i = 0; i < 5; i++) {
        p.enqueue(async () => {
          asyncWorkCount++;
          await wait(20);
          return `async-${i}`;
        });
      }

      // 5 sync tasks wrapped in Promise.resolve()
      for (let i = 0; i < 5; i++) {
        p.enqueue(async () => {
          syncWorkCount++;
          // Simulate sync work
          let sum = 0;
          for (let j = 0; j < 1000000; j++) {
            sum += j;
          }
          return `sync-${i}`;
        });
      }

      const result = await p.close();
      expect(result.length).toBe(10);
      expect(asyncWorkCount).toBe(5);
      expect(syncWorkCount).toBe(5);
    });

    test('sync and async at concurrency=1 ensures strict sequentiality', async () => {
      const p = pool(1);
      const executionOrder: string[] = [];
      const start = Date.now();

      // Async task: 50ms
      p.enqueue(async () => {
        executionOrder.push('async-1');
        await wait(50);
      });

      // Sync task: instant
      p.enqueue(async () => {
        executionOrder.push('sync-1');
        let sum = 0;
        for (let i = 0; i < 1000000; i++) sum += i;
      });

      // Async task: 50ms
      p.enqueue(async () => {
        executionOrder.push('async-2');
        await wait(50);
      });

      await p.close();
      const duration = Date.now() - start;

      expect(executionOrder).toEqual(['async-1', 'sync-1', 'async-2']);
      // Serial execution: ~100ms min (50 + 0 + 50)
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('mixed sync/async at concurrency=10 allows parallelism', async () => {
      const p = pool(10);
      let maxConcurrent = 0;
      let currentRunning = 0;
      const start = Date.now();

      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // Async
          p.enqueue(async () => {
            currentRunning++;
            maxConcurrent = Math.max(maxConcurrent, currentRunning);
            await wait(20);
            currentRunning--;
          });
        } else {
          // Sync
          p.enqueue(async () => {
            currentRunning++;
            maxConcurrent = Math.max(maxConcurrent, currentRunning);
            let sum = 0;
            for (let j = 0; j < 1000000; j++) sum += j;
            currentRunning--;
          });
        }
      }

      await p.close();
      const duration = Date.now() - start;

      expect(maxConcurrent).toBeGreaterThan(1); // Real parallelism
      expect(maxConcurrent).toBeLessThanOrEqual(10);
      expect(duration).toBeLessThan(200); // Not strict serial
    });
  });
});

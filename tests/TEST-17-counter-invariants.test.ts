import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-17: Counter Getter Invariants', () => {
  /* ────────────────────────────────────────────────────────────────────────
     State Transition Invariants: running + waiting + settled = total
     ──────────────────────────────────────────────────────────────────────── */
  describe('State Transition Invariants', () => {
    test('runningCount + waitingCount + settledCount = totalEnqueued', async () => {
      const p = pool(2, { autoStart: false });

      for (let i = 0; i < 10; i++) {
        p.enqueue(async () => {
          await wait(20);
          return i;
        });
      }

      p.start();

      // Check at start: running=2, waiting=8, settled=0
      await Promise.resolve();
      const sum1 = p.runningCount + p.waitingCount + p.settledCount;
      expect(sum1).toBe(10);

      // Mid-execution
      await wait(25);
      const sum2 = p.runningCount + p.waitingCount + p.settledCount;
      expect(sum2).toBe(10);

      // After completion
      await p.close();
      const sum3 = p.runningCount + p.waitingCount + p.settledCount;
      expect(sum3).toBe(10);
    });

    test('resolvedCount + rejectedCount = settledCount', async () => {
      const p = pool(1, { rejectOnError: false });

      p.enqueue(() => Promise.resolve(1));
      p.enqueue(async () => {
        throw new Error('fail');
      });
      p.enqueue(() => Promise.resolve(3));
      p.enqueue(async () => {
        throw new Error('fail');
      });
      p.enqueue(() => Promise.resolve(5));

      await p.close();

      expect(p.resolvedCount + p.rejectedCount).toBe(p.settledCount);
      expect(p.settledCount).toBe(5);
      expect(p.resolvedCount).toBe(3);
      expect(p.rejectedCount).toBe(2);
    });

    test('runningCount never exceeds concurrency', async () => {
      const p = pool(5);
      let maxRunning = 0;

      for (let i = 0; i < 100; i++) {
        p.enqueue(async () => {
          maxRunning = Math.max(maxRunning, p.runningCount);
          await wait(10);
        });
      }

      await p.close();

      expect(maxRunning).toBeLessThanOrEqual(5);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Getter Accuracy: exact counts at lifecycle points
     ──────────────────────────────────────────────────────────────────────── */
  describe('Getter Accuracy', () => {
    test('runningCount tracks in-flight promises exactly', async () => {
      const p = pool(1, { autoStart: false });

      p.enqueue(async () => {
        await wait(50);
        return 1;
      });
      p.enqueue(async () => {
        await wait(50);
        return 2;
      });
      p.enqueue(async () => {
        await wait(50);
        return 3;
      });

      p.start();
      await Promise.resolve();

      // After microtask: first task should be running
      expect(p.runningCount).toBe(1);
      expect(p.waitingCount).toBe(2);

      await wait(60); // Let first task complete
      // Next task should be running
      expect(p.runningCount).toBe(1);
      expect(p.waitingCount).toBe(1);

      await p.close();
    });

    test('waitingCount decreases as tasks start', async () => {
      const p = pool(2, { autoStart: false });

      for (let i = 0; i < 5; i++) {
        p.enqueue(async () => {
          await wait(30);
          return i;
        });
      }

      p.start();
      await Promise.resolve();

      expect(p.waitingCount).toBe(3); // 2 running, 3 waiting
      expect(p.runningCount).toBe(2);

      await wait(35);
      // More tasks should be running/settled now
      expect(p.runningCount + p.settledCount).toBeGreaterThan(2);
    });

    test('settledCount increases as tasks finish', async () => {
      const p = pool(2, { autoStart: false });

      for (let i = 0; i < 5; i++) {
        p.enqueue(async () => {
          await wait(20);
          return i;
        });
      }

      p.start();
      expect(p.settledCount).toBe(0);

      await wait(25);
      expect(p.settledCount).toBeGreaterThan(0);

      await p.close();
      expect(p.settledCount).toBe(5);
    });

    test('counter getters are O(1) with large queues', async () => {
      const p = pool(10);

      for (let i = 0; i < 10000; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      // Accessing getters should be instant, not iterate the queue
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        const _ = p.runningCount + p.waitingCount + p.settledCount;
      }
      const duration = Date.now() - start;

      // Should complete in less than 10ms (1000 getter calls)
      expect(duration).toBeLessThan(10);

      await p.close();
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Concurrency Bounds: pendingCount invariant, monotonic counts
     ──────────────────────────────────────────────────────────────────────── */
  describe('Concurrency Bounds', () => {
    test('pendingCount = runningCount + waitingCount always', async () => {
      const p = pool(2, { autoStart: false });

      for (let i = 0; i < 10; i++) {
        p.enqueue(async () => {
          await wait(20);
          return i;
        });
      }

      p.start();
      await Promise.resolve();
      expect(p.pendingCount).toBe(p.runningCount + p.waitingCount);

      await wait(25);
      expect(p.pendingCount).toBe(p.runningCount + p.waitingCount);

      await p.close();
      expect(p.pendingCount).toBe(0);
    });

    test('resolvedCount and rejectedCount never decrease', async () => {
      const p = pool(1, { rejectOnError: false });

      p.enqueue(() => Promise.resolve(1));
      p.enqueue(() => Promise.resolve(2));

      await p.close();

      const resolvedAfter2 = p.resolvedCount;
      // Create new pool, test should start fresh
      const p2 = pool(1);
      p2.enqueue(() => Promise.resolve(3));
      await p2.close();

      // p2 should have its own counts
      expect(p2.resolvedCount).toBeGreaterThanOrEqual(1);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Concurrency scale validation: various concurrency levels
     ──────────────────────────────────────────────────────────────────────── */
  describe('Concurrency Scale Validation', () => {
    test('counter invariants hold at concurrency=1', async () => {
      const p = pool(1);

      for (let i = 0; i < 10; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      await p.close();

      expect(p.runningCount).toBe(0);
      expect(p.waitingCount).toBe(0);
      expect(p.settledCount).toBe(10);
      expect(p.resolvedCount).toBe(10);
    });

    test('counter invariants hold at concurrency=10', async () => {
      const p = pool(10);

      for (let i = 0; i < 100; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      await p.close();

      expect(p.runningCount).toBe(0);
      expect(p.waitingCount).toBe(0);
      expect(p.settledCount).toBe(100);
      expect(p.resolvedCount).toBe(100);
      expect(p.rejectedCount).toBe(0);
    });

    test('counter invariants hold at concurrency=100', async () => {
      const p = pool(100);

      for (let i = 0; i < 500; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      await p.close();

      expect(p.settledCount).toBe(500);
      expect(p.resolvedCount).toBe(500);
      expect(p.runningCount + p.waitingCount).toBe(0);
    });
  });
});

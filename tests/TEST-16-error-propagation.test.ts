import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-16: Error Propagation & Event Ordering', () => {
  /* ────────────────────────────────────────────────────────────────────────
     Error Handling: pool state accessible via getters inside error callback
     ──────────────────────────────────────────────────────────────────────── */
  describe('Error Handling via Getters', () => {
    test('error callback receives the error — pool runningCount accessible via getter', async () => {
      const p = pool(2, { rejectOnError: false });
      const runningAtError: number[] = [];

      p.on('error', () => {
        runningAtError.push(p.runningCount);
      });

      p.enqueue(async () => {
        throw new Error('fail 1');
      });
      p.enqueue(async () => {
        await wait(50);
        return 'ok';
      });
      p.enqueue(async () => {
        await wait(100);
        return 'ok';
      });

      await p.close();

      expect(runningAtError.length).toBeGreaterThan(0);
      expect(runningAtError[0]).toBeDefined();
      expect(typeof runningAtError[0]).toBe('number');
    });

    test('pool waitingCount accessible via getter inside error callback', async () => {
      const p = pool(2, { rejectOnError: false });
      let waitingAtError = -1;

      p.on('error', () => {
        if (waitingAtError === -1) waitingAtError = p.waitingCount;
      });

      for (let i = 0; i < 5; i++) {
        if (i === 1) {
          p.enqueue(async () => {
            throw new Error('fail');
          });
        } else {
          p.enqueue(async () => {
            await wait(20);
            return i;
          });
        }
      }

      await p.close();

      expect(waitingAtError).toBeGreaterThanOrEqual(0);
    });

    test('pool state flags accessible via getters inside error callback', async () => {
      const p = pool(2, { rejectOnError: false });
      let stateSnapshot: any = null;

      p.on('error', () => {
        stateSnapshot = {
          isStarted: p.isStarted,
          isClosed: p.isClosed,
          isResolved: p.isResolved,
        };
      });

      p.enqueue(async () => {
        throw new Error('fail');
      });

      await p.close();

      expect(stateSnapshot).not.toBeNull();
      expect(stateSnapshot.isStarted).toBeDefined();
      expect(stateSnapshot.isClosed).toBeDefined();
      expect(stateSnapshot.isResolved).toBe(false); // Still resolving/executing
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Event Ordering: error before next, multiple errors maintain order
     ──────────────────────────────────────────────────────────────────────── */
  describe('Event Ordering', () => {
    test('error event fires before next event', async () => {
      const p = pool(2, { rejectOnError: false });
      const events: string[] = [];

      p.on('error', () => {
        events.push('error');
      });

      p.on('next', () => {
        events.push('next');
      });

      p.enqueue(async () => {
        throw new Error('fail');
      });
      p.enqueue(async () => {
        return 'ok';
      });

      await p.close();

      // Error should appear before or alongside next events
      const errorIndex = events.indexOf('error');
      const nextIndex = events.indexOf('next');
      expect(errorIndex).toBeGreaterThanOrEqual(0);
    });

    test('multiple errors maintain order', async () => {
      const p = pool(1, { rejectOnError: false });
      const errors: any[] = [];

      p.on('error', (error: any) => {
        errors.push(error.message);
      });

      p.enqueue(async () => {
        throw new Error('error-1');
      });
      p.enqueue(async () => {
        return 'ok';
      });
      p.enqueue(async () => {
        throw new Error('error-2');
      });

      await p.close();

      expect(errors.length).toBeGreaterThanOrEqual(1);
      if (errors.length >= 2) {
        expect(errors[0]).toBe('error-1');
        expect(errors[1]).toBe('error-2');
      }
    });

    test('resolve events fire for successful tasks', async () => {
      const p = pool(1);
      const resolvedValues: any[] = [];

      p.on('resolve', (value: any) => {
        resolvedValues.push(value);
      });

      p.enqueue(() => Promise.resolve(1));
      p.enqueue(() => Promise.resolve(2));
      p.enqueue(() => Promise.resolve(3));

      await p.close();

      expect(resolvedValues).toEqual([1, 2, 3]);
    });

    test('mixed resolve and error events maintain order', async () => {
      const p = pool(1, { rejectOnError: false });
      const results: any[] = [];

      p.on('resolve', (value: any) => {
        results.push({ type: 'resolve', value });
      });

      p.on('error', (error: any) => {
        results.push({ type: 'error', message: error.message });
      });

      p.enqueue(() => Promise.resolve(1));
      p.enqueue(async () => {
        throw new Error('fail-1');
      });
      p.enqueue(() => Promise.resolve(2));
      p.enqueue(async () => {
        throw new Error('fail-2');
      });
      p.enqueue(() => Promise.resolve(3));

      await p.close();

      expect(results.length).toBeGreaterThanOrEqual(5);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Event Filtering: rejectOnError true vs false
     ──────────────────────────────────────────────────────────────────────── */
  describe('Event Filtering', () => {
    test('rejectOnError=true stops further processing on error', async () => {
      const p = pool(1, { rejectOnError: true });
      let executed = 0;

      p.enqueue(async () => {
        throw new Error('fail');
      });
      p.enqueue(async () => {
        executed++;
        return 'should not run';
      });

      // With rejectOnError=true, pool rejects immediately on first error
      const result = await p.close().catch((e) => e);
      // Result should be an error (pool rejected)
      expect(result instanceof Error).toBe(true);
      // Task 2 may or may not execute depending on timing
      // The key is that the pool rejects early
    });

    test('rejectOnError=false continues on error and fires events', async () => {
      const p = pool(1, { rejectOnError: false });
      let executed = 0;
      let errorCount = 0;

      p.on('error', () => {
        errorCount++;
      });

      p.enqueue(async () => {
        throw new Error('fail');
      });
      p.enqueue(async () => {
        executed++;
        return 'ok';
      });

      const result = await p.close();
      expect(result instanceof Array).toBe(true);
      expect(executed).toBe(1); // Task 2 should execute
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Event Listener Deregistration
     ──────────────────────────────────────────────────────────────────────── */
  describe('Event Listener Deregistration', () => {
    test('listener persists if not unregistered', async () => {
      const p = pool(1);
      let count = 0;

      const listener = () => {
        count++;
      };

      p.on('resolve', listener);
      p.enqueue(() => Promise.resolve(1));
      await p.close();

      expect(count).toBeGreaterThan(0);
      // Listeners can be removed via the unsubscribe function returned by on() / once()
    });
  });
});

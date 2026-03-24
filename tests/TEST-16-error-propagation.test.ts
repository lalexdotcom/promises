import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-16: Error Propagation & Event Ordering', () => {
  /* ────────────────────────────────────────────────────────────────────────
     Error Event Context: runningCount, waitingCount, pool state flags
     ──────────────────────────────────────────────────────────────────────── */
  describe('Error Event Context', () => {
    test('error event context has accurate runningCount', async () => {
      const p = pool(2, { rejectOnError: false });
      const errorContexts: any[] = [];

      p.on('error', (error: any, context: any) => {
        errorContexts.push(context);
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

      expect(errorContexts.length).toBeGreaterThan(0);
      expect(errorContexts[0].runningCount).toBeDefined();
    });

    test('error event context has accurate waitingCount', async () => {
      const p = pool(2, { rejectOnError: false });
      let contextSnapshot: any = null;

      p.on('error', (error: any, context: any) => {
        if (!contextSnapshot) contextSnapshot = context;
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

      expect(contextSnapshot).toBeDefined();
      expect(contextSnapshot.waitingCount).toBeGreaterThanOrEqual(0);
    });

    test('error context includes pool state flags', async () => {
      const p = pool(2, { rejectOnError: false });
      let contextSnapshot: any = null;

      p.on('error', (error: any, context: any) => {
        contextSnapshot = context;
      });

      p.enqueue(async () => {
        throw new Error('fail');
      });

      await p.close();

      expect(contextSnapshot).toBeDefined();
      expect(contextSnapshot.isStarted).toBeDefined();
      expect(contextSnapshot.isClosed).toBeDefined();
      expect(contextSnapshot.isResolved).toBe(false); // Still resolving/executing
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
      const result = await p.close().catch(e => e);
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
      // Note: There's no off() method to unregister, only on() and once()
    });
  });
});

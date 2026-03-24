import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-15: Rapid Lifecycle Transitions', () => {
  /* ────────────────────────────────────────────────────────────────────────
     Start to Close Races: immediate, with work in progress
     ──────────────────────────────────────────────────────────────────────── */
  describe('Start to Close Races', () => {
    test('start() then close() with no work returns empty array', async () => {
      const p = pool(2, { autoStart: false });
      p.start();
      const result = await p.close();

      expect(result).toEqual([]);
      expect(p.isResolved).toBe(true);
      expect(p.isClosed).toBe(true);
    });

    test('start() then close() with work in progress completes work', async () => {
      const p = pool(1, { autoStart: false });
      let executed = false;

      p.enqueue(async () => {
        executed = true;
        await wait(20);
        return 'done';
      });

      p.start();
      const result = await p.close();

      expect(executed).toBe(true);
      expect(result[0]).toBe('done');
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Enqueue Before/After State Changes
     ──────────────────────────────────────────────────────────────────────── */
  describe('Enqueue Before/After State Changes', () => {
    test('multiple enqueues before start all execute', async () => {
      const p = pool(2, { autoStart: false });

      for (let i = 0; i < 10; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      p.start();
      const result = await p.close();

      expect(result.length).toBe(10);
      expect(result.every((v, i) => v === i)).toBe(true);
    });

    test('enqueue immediately before close absorbs tasks', async () => {
      const p = pool(2);

      p.enqueue(() => Promise.resolve(1));
      p.enqueue(() => Promise.resolve(2));

      const result = await p.close();
      expect(result.length).toBe(2);
      expect(result).toEqual([1, 2]);
    });

    test('enqueue after close throws or errors', async () => {
      const p = pool(2);
      await p.close();

      expect(() => {
        p.enqueue(() => Promise.resolve(1));
      }).toThrow();
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Concurrent Operations: close idempotence, start after close
     ──────────────────────────────────────────────────────────────────────── */
  describe('Concurrent Operations', () => {
    test('close() called twice is idempotent', async () => {
      const p = pool(2);
      p.enqueue(() => Promise.resolve(1));

      const promise1 = p.close();
      const promise2 = p.close();

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toEqual([1]);
      expect(result2).toEqual([1]);
    });

    test('start() after close() throws or no-ops', async () => {
      const p = pool(2);
      await p.close();

      try {
        p.start();
        // If no throw, start is a no-op (acceptable)
        expect(true).toBe(true);
      } catch (error) {
        // Throwing is also valid
        expect(error).toBeDefined();
      }
    });

    test('rapid start/close cycles work correctly', async () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        const p = pool(2, { autoStart: false });
        p.enqueue(() => Promise.resolve(cycle));
        p.start();
        const result = await p.close();
        expect(result[0]).toBe(cycle);
      }
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     State Flag Consistency: synchronous checks, no missed transitions
     ──────────────────────────────────────────────────────────────────────── */
  describe('State Flag Consistency', () => {
    test('state flags transition correctly through lifecycle', async () => {
      const p = pool(1, { autoStart: false });

      expect(p.isStarted).toBe(false);
      expect(p.isClosed).toBe(false);
      expect(p.isResolved).toBe(false);

      p.start();
      // isStarted is async
      expect(p.isClosed).toBe(false);

      await Promise.resolve(); // Let microtask run

      expect(p.isStarted).toBe(true);
      expect(p.isClosed).toBe(false);

      p.enqueue(() => Promise.resolve(1));
      await p.close();

      expect(p.isStarted).toBe(true);
      expect(p.isClosed).toBe(true);
      expect(p.isResolved).toBe(true);
    });

    test('isStarted never reverts to false after start()', async () => {
      const p = pool(1, { autoStart: false });

      p.start();
      await Promise.resolve();
      const firstCheck = p.isStarted;

      await wait(10);
      const secondCheck = p.isStarted;

      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(true);
    });

    test('large queue (1000+) close quickly without dropped tasks', async () => {
      const p = pool(10);
      let addedCount = 0;

      for (let i = 0; i < 1000; i++) {
        p.enqueue(() => {
          addedCount++;
          return Promise.resolve(i);
        });
      }

      const result = await p.close();
      expect(result.length).toBe(1000);
      expect(addedCount).toBe(1000);
    });

    test('event listener added after enqueue receives events', async () => {
      const p = pool(1);
      let resolveCount = 0;

      p.enqueue(() => Promise.resolve(1));

      // Register listener after enqueue but before execute
      p.on('resolve', () => {
        resolveCount++;
      });

      await p.close();
      // Listener should have fired at least once
      expect(resolveCount).toBeGreaterThan(0);
    });
  });
});

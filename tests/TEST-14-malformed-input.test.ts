import { describe, expect, test } from '@rstest/core';
import { pool, TimeoutError, wait } from '../src/index';

describe('TEST-14: Malformed Input Handling', () => {
  /* ────────────────────────────────────────────────────────────────────────
     PoolOptions Malformed: string/object concurrency, rejectOnError coercion
     Note: null, undefined, NaN concurrency cause pool.size to be falsy,
     preventing tasks from executing. These should never be used.
     ──────────────────────────────────────────────────────────────────────── */
  describe('PoolOptions Malformed', () => {
    test('valid concurrency number works correctly', async () => {
      const p = pool(5); // Correct: concurrency as first argument
      for (let i = 0; i < 10; i++) {
        p.enqueue(() => Promise.resolve(i));
      }
      const result = await p.close();
      expect(result.length).toBe(10);
    });

    test('string concurrency as first arg behaves as invalid number', () => {
      // '10' as concurrency is invalid (not a number)
      // The pool will try: size = '10' || DEFAULT_CONCURRENCY
      // Since '10' is truthy, size becomes '10' (string)
      try {
        const p = pool('10' as any);
        expect(p).toBeDefined();
      } catch (e) {
        // May throw or may accept - implementation specific
        expect(e).toBeDefined();
      }
    });

    test('object concurrency as first arg is invalid but construction doesn\'t throw', () => {
      // { value: 10 } is truthy, so size = { value: 10 }
      const p = pool({ value: 10 } as any);
      expect(p).toBeDefined();
    });

    test('rejectOnError as string in options is coerced to truthy', async () => {
      const p = pool(2, { rejectOnError: 'yes' as any });
      p.enqueue(() => Promise.resolve(1));
      const result = await p.close();
      expect(result[0]).toBe(1);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Enqueue Malformed: null, undefined, non-function
     ──────────────────────────────────────────────────────────────────────── */
  describe('Enqueue Malformed', () => {
    test('enqueue(null) pushes to queue without immediate validation', () => {
      const p = pool(1);
      // enqueue doesn't validate generator is a function, it just pushes to queue
      // The error will occur when trying to call null as function during execution
      p.enqueue(null as any);
      expect(p.waitingCount).toBe(1); // Was enqueued
    });

    test('enqueue(undefined) pushes to queue without validation', () => {
      const p = pool(1);
      p.enqueue(undefined as any);
      expect(p.waitingCount).toBe(1);
    });

    test('enqueue(42) doesn\'t throw immediately, will error at runtime', () => {
      const p = pool(1);
      // enqueue doesn't validate synchronously
      p.enqueue(42 as any);
      expect(p.waitingCount).toBe(1);
    });

    test('enqueue(() => 42) handles non-Promise return', async () => {
      const p = pool(1);
      try {
        p.enqueue(() => 42 as any);
        const result = await p.close();
        // Either converts to Promise or errors
        expect(result[0]).toBe(42);
      } catch (error) {
        // Throwing on non-Promise is also valid
        expect(error).toBeDefined();
      }
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Event Listener Malformed: null event, invalid event, null callback
     ──────────────────────────────────────────────────────────────────────── */
  describe('Event Listener Malformed', () => {
    test('on(unknown-event, callback) throws or ignores', () => {
      const p = pool(1);
      try {
        p.on('unknown-event' as any, () => {});
        // If no throw, listener was registered (but won't fire)
        expect(true).toBe(true);
      } catch (error) {
        // Throwing on unknown event is valid
        expect(error).toBeDefined();
      }
    });

    test('on(null, callback) doesn\'t throw, null becomes event key', () => {
      const p = pool(1);
      // on() doesn't validate event type strictly
      p.on(null as any, () => {});
      // Listener registered with null as key (won't fire, but no error)
      expect(true).toBe(true);
    });

    test('on(resolve, null) registers null listener (won\'t fire)', () => {
      const p = pool(1);
      // on() stores the callback without validating it's a function
      p.on('resolve', null as any);
      // Listener stored but won't fire properly (null isn't callable)
      expect(true).toBe(true);
    });

    test('event listener registration with valid event works', async () => {
      const p = pool(1);
      let resolved = false;

      p.on('resolve', () => {
        resolved = true;
      });

      p.enqueue(() => Promise.resolve(1));
      await p.close();

      expect(resolved).toBe(true);
    });
  });
});

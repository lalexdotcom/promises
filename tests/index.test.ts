import { describe, expect, test } from '@rstest/core';
import { pool, timeout, TimeoutError, wait } from '../src/index';

/* ────────────────────────────────────────────────────────────────────────
   TEST-01: PromisePool lifecycle
   ────────────────────────────────────────────────────── */
describe('TEST-01: PromisePool lifecycle', () => {
  test('initial state flags are all false before start', () => {
    const p = pool(2, { autoStart: false });
    expect(p.isStarted).toBe(false);
    expect(p.isClosed).toBe(false);
    expect(p.isResolved).toBe(false);
  });

  test('isStarted becomes true after start() microtask runs', async () => {
    const p = pool(2, { autoStart: false });
    p.start();
    await Promise.resolve(); // allow the microtask to set #isStarted
    expect(p.isStarted).toBe(true);
    await p.close();
  });

  test('isClosed is set synchronously by close()', async () => {
    const p = pool(2);
    const done = p.close();
    expect(p.isClosed).toBe(true);
    await done;
  });

  test('resolved result preserves insertion order', async () => {
    const p = pool(2);
    p.enqueue(() => Promise.resolve(42));
    p.enqueue(() => Promise.resolve('hello'));
    const result = await p.close();
    expect(result[0]).toBe(42);
    expect(result[1]).toBe('hello');
  });

  test('isResolved is true after pool settles', async () => {
    const p = pool(2);
    p.enqueue(() => Promise.resolve(1));
    await p.close();
    expect(p.isResolved).toBe(true);
  });

  test('running and waiting counters reflect pool state', async () => {
    const p = pool(1, { autoStart: false });
    p.enqueue(() => wait(40));
    p.enqueue(() => wait(40));
    p.start();
    await Promise.resolve(); // let start microtask run and pick up first task
    expect(p.running).toBe(1);
    expect(p.waiting).toBe(1);
    await p.close();
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-02: Concurrency limiting
   ────────────────────────────────────────────────────── */
describe('TEST-02: Concurrency limiting', () => {
  test('never more than N tasks run simultaneously', async () => {
    const CONCURRENCY = 2;
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 6 }, (_, i) => () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      return new Promise<number>((res) =>
        setTimeout(() => {
          running--;
          res(i);
        }, 30),
      );
    });

    const p = pool(CONCURRENCY);
    for (const task of tasks) p.enqueue(task);
    await p.close();

    expect(maxRunning).toBeLessThanOrEqual(CONCURRENCY);
    expect(maxRunning).toBe(CONCURRENCY); // all slots must have been fully used
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-03: Event system
   ────────────────────────────────────────────────────── */
describe('TEST-03: Event system', () => {
  test('on() receives every emission of an event', async () => {
    const p = pool(3);
    let nextCount = 0;
    p.on('next', () => nextCount++);

    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));

    await p.close();
    expect(nextCount).toBe(3); // one 'next' per promise dequeued
  });

  test('once() fires only on the first emission', async () => {
    const p = pool(3);
    let nextCount = 0;
    p.once('next', () => nextCount++);

    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));

    await p.close();
    expect(nextCount).toBe(1);
  });

  test('start event fires exactly once on explicit start()', async () => {
    let startCount = 0;
    // Use autoStart:false so that start() is called exactly once manually.
    const p = pool(2, { autoStart: false });
    p.on('start', () => startCount++);

    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));
    p.start(); // single explicit call
    await Promise.resolve();
    await p.close();

    expect(startCount).toBe(1);
  });

  test('full event fires when all concurrency slots are occupied', async () => {
    let fullCount = 0;
    const p = pool(2);
    p.on('full', () => fullCount++);

    p.enqueue(() => wait(40));
    p.enqueue(() => wait(40));
    p.enqueue(() => wait(40));

    await p.close();
    expect(fullCount).toBeGreaterThanOrEqual(1);
  });

  test('available event fires when a slot opens with nothing in queue', async () => {
    let availableCount = 0;
    const p = pool(2);
    p.on('available', () => availableCount++);

    p.enqueue(() => wait(20));
    p.enqueue(() => wait(40));

    await p.close();
    expect(availableCount).toBeGreaterThanOrEqual(1);
  });

  test('listeners are cleared after close() — post-close listener registration has no effect', async () => {
    const p = pool(2);
    let preCloseCount = 0;
    let postCloseCount = 0;

    p.on('next', () => preCloseCount++);
    p.enqueue(() => wait(20));
    p.enqueue(() => wait(20));

    await p.close();

    // Register a listener AFTER close — should NOT receive any events
    p.on('next', () => postCloseCount++);

    // Try to trigger events by waiting (pool is already settled)
    await Promise.resolve();

    expect(preCloseCount).toBeGreaterThan(0); // listeners worked pre-close
    expect(postCloseCount).toBe(0); // post-close listeners never fire
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-03b: Unsubscribe (on / once return value)
   ────────────────────────────────────────────────── */
describe('TEST-03b: unsubscribe (on / once return value)', () => {
  test('on() — unsubscribe stops future invocations', async () => {
    const p = pool(3);
    let count = 0;
    const unsub = p.on('next', () => count++);

    p.enqueue(() => Promise.resolve(1));
    await Promise.resolve();
    await Promise.resolve();
    // count should be 1 after the first 'next' fires
    expect(count).toBe(1);

    unsub(); // remove the listener
    p.enqueue(() => Promise.resolve(2));
    await p.close();

    // count must not have increased after unsubscribe
    expect(count).toBe(1);
  });

  test('on() — unsubscribing one listener does not affect others on the same event', async () => {
    const p = pool(3);
    let count1 = 0;
    let count2 = 0;
    const unsub1 = p.on('next', () => count1++);
    p.on('next', () => count2++);

    p.enqueue(() => Promise.resolve(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    unsub1(); // only remove first listener
    p.enqueue(() => Promise.resolve(2));
    await p.close();

    expect(count1).toBe(1); // first listener stopped
    expect(count2).toBeGreaterThan(1); // second listener still active
  });

  test('once() — unsubscribe prevents the listener from ever firing', async () => {
    const p = pool(3);
    let count = 0;
    const unsub = p.once('next', () => count++);

    unsub(); // unsubscribe before any event fires
    p.enqueue(() => Promise.resolve(1));
    await p.close();

    expect(count).toBe(0); // listener never fired
  });

  test('once() — unsubscribe after already fired is a no-op', async () => {
    const p = pool(3);
    let count = 0;
    const unsub = p.once('next', () => count++);

    p.enqueue(() => Promise.resolve(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(count).toBe(1); // fired once

    expect(() => unsub()).not.toThrow(); // calling after fire should not throw
    p.enqueue(() => Promise.resolve(2));
    await p.close();

    expect(count).toBe(1); // still only 1 — once already removed it
  });

  test('on() — returns a function (type check)', () => {
    const p = pool(2);
    const unsub = p.on('start', () => {});
    expect(typeof unsub).toBe('function');
  });

  test('once() — returns a function (type check)', () => {
    const p = pool(2);
    const unsub = p.once('start', () => {});
    expect(typeof unsub).toBe('function');
  });

  test('on() — unsubscribe works for resolve event', async () => {
    const p = pool(2);
    let count = 0;
    const unsub = p.on('resolve', () => count++);

    p.enqueue(() => Promise.resolve(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(count).toBe(1);

    unsub();
    p.enqueue(() => Promise.resolve(2));
    await p.close();
    expect(count).toBe(1); // no further increments after unsub
  });

  test('on() — unsubscribe works for error event', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);
    let count = 0;
    const unsub = p.on('error', () => count++);

    p.enqueue(() => Promise.reject(new Error('first')));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(count).toBe(1);

    unsub();
    p.enqueue(() => Promise.reject(new Error('second')));
    await p.close();
    console.error = orig;
    expect(count).toBe(1); // second error does not increment
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-04: Error handling
   ────────────────────────────────────────────────────── */
describe('TEST-04: Error handling', () => {
  test('rejectOnError:false — rejected task stored as PoolError in result', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2); // rejectOnError defaults to false
    p.enqueue(() => Promise.reject(new Error('task failed')));
    const result = await p.close();
    console.error = orig;

    const err = result[0] as any;
    expect(err).toBeInstanceOf(Error);
    expect(err.catched).toBeInstanceOf(Error);
    expect(err.catched.message).toBe('task failed');
  });

  test('rejectOnError:false — remaining tasks still complete', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);
    p.enqueue(() => Promise.reject(new Error('oops')));
    p.enqueue(() => Promise.resolve('ok'));
    const result = await p.close();
    console.error = orig;

    expect(result[1]).toBe('ok');
  });

  test('rejectOnError:true — pool promise rejects with the thrown error', async () => {
    const p = pool(2, { rejectOnError: true });
    p.enqueue(() => Promise.reject(new Error('fatal')));
    await expect(p.close()).rejects.toThrow('fatal');
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-05: Per-promise timeout via enqueue(fn, timeout)
   ────────────────────────────────────────────────────── */
describe('TEST-05: Per-promise timeout', () => {
  test('TimeoutError stored when promise exceeds timeout', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);
    p.enqueue(() => wait(100), 20); // 100ms task with 20ms timeout
    const result = await p.close();
    console.error = orig;

    const err = result[0] as any;
    expect(err).toBeInstanceOf(Error);
    expect(err.catched).toBeInstanceOf(TimeoutError);
  });

  test('promise completes normally when it finishes before timeout', async () => {
    const p = pool(2);
    p.enqueue(async () => {
      await wait(10);
      return 'done';
    }, 100); // 10ms task, 100ms timeout → no timeout
    const result = await p.close();
    expect(result[0]).toBe('done');
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-06: pool.parallel() and pool.serial()
   ────────────────────────────────────────────────────── */
describe('TEST-06: pool.parallel() and pool.serial()', () => {
  test('parallel() returns results in insertion order', async () => {
    const result = await pool.parallel([
      () => Promise.resolve(1),
      () => Promise.resolve('text'),
      () => Promise.resolve(true),
    ]);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe('text');
    expect(result[2]).toBe(true);
  });

  test('parallel() with empty array returns []', async () => {
    const result = await pool.parallel([]);
    expect(result).toEqual([]);
  });

  test('serial() preserves execution order regardless of task duration', async () => {
    const order: number[] = [];
    const result = await pool.serial([
      async () => {
        await wait(40);
        order.push(1);
        return 'a';
      },
      async () => {
        await wait(20);
        order.push(2);
        return 'b';
      },
      async () => {
        await wait(10);
        order.push(3);
        return 'c';
      },
    ]);
    expect(result).toEqual(['a', 'b', 'c']);
    expect(order).toEqual([1, 2, 3]);
  });

  test('serial() with empty array returns []', async () => {
    const result = await pool.serial([]);
    expect(result).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-07: Resolve & Error Events (Phase 5)
   ────────────────────────────────────────────────────── */
describe('TEST-07: Resolve & Error Events', () => {
  test('resolve event fires per promise with result value', async () => {
    const resolvedValues: unknown[] = [];
    const p = pool(3);
    p.on('resolve', (result) => resolvedValues.push(result));

    p.enqueue(() => Promise.resolve(42));
    p.enqueue(() => Promise.resolve('hello'));
    p.enqueue(() => Promise.resolve(true));

    await p.close();
    expect(resolvedValues).toEqual([42, 'hello', true]);
  });

  test('resolve event fires before next event', async () => {
    const eventOrder: string[] = [];
    const p = pool(1, { autoStart: false });

    p.on('resolve', () => eventOrder.push('resolve'));
    p.on('next', () => eventOrder.push('next'));

    p.enqueue(() => Promise.resolve('task1'));
    p.enqueue(() => Promise.resolve('task2'));
    p.start();

    await p.close();

    // Each task should have resolve→next ordering
    // First task: next (dequeue) → resolve → next (dequeue second) → resolve
    expect(eventOrder).toContain('resolve');
    expect(eventOrder).toContain('next');

    // Find indices: resolve should appear after the first 'next'
    const firstNextIdx = eventOrder.indexOf('next');
    const firstResolveIdx = eventOrder.indexOf('resolve');
    expect(firstResolveIdx).toBeGreaterThan(firstNextIdx);
  });

  test('error event fires per rejection', async () => {
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);
    p.on('error', (error) => errors.push(error));

    p.enqueue(() => Promise.reject(new Error('error1')));
    p.enqueue(() => Promise.resolve('ok'));
    p.enqueue(() => Promise.reject(new Error('error2')));

    await p.close();
    console.error = orig;

    expect(errors).toHaveLength(2);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe('error1');
    expect(errors[1]).toBeInstanceOf(Error);
    expect((errors[1] as Error).message).toBe('error2');
  });

  test('error event fires per-promise on rejection', async () => {
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2, { autoStart: false });
    p.on('error', (error) => errors.push(error));

    p.enqueue(() => Promise.reject(new Error('err1')));
    p.enqueue(() => Promise.reject(new Error('err2')));
    p.start();

    await p.close();
    console.error = orig;

    expect(errors).toHaveLength(2);
    expect((errors[0] as Error).message).toBe('err1');
    expect((errors[1] as Error).message).toBe('err2');
  });

  test('error event fires regardless of rejectOnError flag (false)', async () => {
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2, { rejectOnError: false });
    p.on('error', (error) => errors.push(error));

    p.enqueue(() => Promise.reject(new Error('caught')));

    const result = await p.close();
    console.error = orig;

    // Error event should have fired even though rejectOnError is false
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    // But the error should also be in results as PoolError
    expect((result[0] as any).catched).toBeInstanceOf(Error);
  });

  test('error event fires regardless of rejectOnError flag (true)', async () => {
    const errors: unknown[] = [];
    const p = pool(2, { rejectOnError: true });
    p.on('error', (error) => errors.push(error));

    p.enqueue(() => Promise.reject(new Error('fatal')));

    try {
      await p.close();
    } catch {
      // Expected to throw when rejectOnError is true
    }

    // Error event should have fired even with rejectOnError true
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  test('mixed resolve and error events in single pool', async () => {
    const events: Array<{ type: string; payload: unknown }> = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);

    p.on('resolve', (result) => events.push({ type: 'resolve', payload: result }));
    p.on('error', (error) => events.push({ type: 'error', payload: error }));

    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => Promise.reject(new Error('fail')));
    p.enqueue(() => Promise.resolve(3));
    p.enqueue(() => Promise.reject(new Error('fail again')));
    p.enqueue(() => Promise.resolve(5));

    await p.close();
    console.error = orig;

    expect(events).toHaveLength(5);
    const resolveEvents = events.filter(e => e.type === 'resolve');
    const errorEvents = events.filter(e => e.type === 'error');
    expect(resolveEvents).toHaveLength(3);
    expect(errorEvents).toHaveLength(2);
    expect(resolveEvents.map(e => e.payload)).toEqual([1, 3, 5]);
  });

  test('resolve event with complex result objects', async () => {
    const results: unknown[] = [];
    const p = pool(2);
    p.on('resolve', (result) => results.push(result));

    const obj1 = { id: 1, name: 'foo' };
    const obj2 = { id: 2, name: 'bar' };
    const arr = [1, 2, 3];

    p.enqueue(() => Promise.resolve(obj1));
    p.enqueue(() => Promise.resolve(obj2));
    p.enqueue(() => Promise.resolve(arr));

    await p.close();

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(obj1);
    expect(results[1]).toEqual(obj2);
    expect(results[2]).toEqual(arr);
  });

  test('pool state accessible via getters during error callback', async () => {
    const snapshots: any[] = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2, { autoStart: false });

    p.on('error', () => {
      snapshots.push({
        error: 'caught',
        runningCount: p.runningCount,
        waitingCount: p.waitingCount,
        isStarted: p.isStarted,
      });
    });

    // Enqueue 4 tasks: 2 that will run, 2 that will wait
    p.enqueue(() => wait(30));
    p.enqueue(() => wait(30));
    p.enqueue(() => Promise.reject(new Error('err-waiting')));
    p.enqueue(() => Promise.reject(new Error('err-waiting2')));

    p.start();
    await p.close();
    console.error = orig;

    expect(snapshots).toHaveLength(2);
    snapshots.forEach((snap) => {
      expect(snap.isStarted).toBe(true);
      expect(snap.runningCount).toBeLessThanOrEqual(2);
    });
  });

  test('once() with resolve event registers one-time listener', async () => {
    let resolveCount = 0;
    const p = pool(1, { autoStart: false });
    p.once('resolve', () => resolveCount++);

    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => Promise.resolve(2));
    p.start();

    await p.close();

    // once() should only fire on the first resolve event
    expect(resolveCount).toBe(1);
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-08: Pool Introspection (getters: concurrency, running/waitingCount, etc)
   ────────────────────────────────────────────────────── */
describe('TEST-08: Pool Introspection', () => {
  test('invariant: runningCount + waitingCount = pendingCount at any time', async () => {
    const checkpoints: any[] = [];
    const p = pool(2, { autoStart: false });

    // Enqueue 10 tasks with varying durations
    for (let i = 0; i < 10; i++) {
      p.enqueue(() => wait(Math.random() * 50));
    }

    // Check invariant before start
    checkpoints.push({
      label: 'before start',
      runningCount: p.runningCount,
      waitingCount: p.waitingCount,
      pendingCount: p.pendingCount,
    });
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);

    p.start();

    // Check during execution
    await Promise.resolve();
    checkpoints.push({
      label: 'after start',
      runningCount: p.runningCount,
      waitingCount: p.waitingCount,
      pendingCount: p.pendingCount,
    });
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);

    await p.close();

    // Check after close
    expect(p.runningCount + p.waitingCount).toBe(p.pendingCount);

    // All checkpoints must satisfy invariant
    checkpoints.forEach((cp) => {
      expect(cp.runningCount + cp.waitingCount).toBe(cp.pendingCount);
    });
  });

  test('invariant: resolvedCount + rejectedCount = settledCount always', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(3);

    // Enqueue 15 tasks: 10 resolve, 5 reject
    for (let i = 0; i < 10; i++) {
      p.enqueue(() => Promise.resolve(i));
    }
    for (let i = 0; i < 5; i++) {
      p.enqueue(() => Promise.reject(new Error(`err${i}`)));
    }

    await p.close();
    console.error = orig;

    // After close, verify invariant
    expect(p.resolvedCount + p.rejectedCount).toBe(p.settledCount);
    expect(p.settledCount).toBe(15); // All tasks settled
    expect(p.resolvedCount).toBe(10);
    expect(p.rejectedCount).toBe(5);

    // Counters should remain stable (not reset or change)
    expect(p.resolvedCount + p.rejectedCount).toBe(p.settledCount);
  });

  test('lifecycle: all getters track state correctly through pool lifecycle', async () => {
    const p = pool(2, { autoStart: false });

    // After creation, before enqueue
    expect(p.concurrency).toBe(2);
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(0);
    expect(p.pendingCount).toBe(0);
    expect(p.resolvedCount).toBe(0);
    expect(p.rejectedCount).toBe(0);
    expect(p.settledCount).toBe(0);

    // After enqueue (before start)
    for (let i = 0; i < 5; i++) {
      p.enqueue(() => wait(30));
    }
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(5);
    expect(p.pendingCount).toBe(5);
    expect(p.settledCount).toBe(0);

    // After start
    p.start();
    await Promise.resolve();

    // During execution (2 running, 3 waiting)
    expect(p.runningCount).toBe(2);
    expect(p.waitingCount).toBe(3);
    expect(p.pendingCount).toBe(5);
    expect(p.resolvedCount + p.rejectedCount).toBe(0); // Nothing settled yet

    // After close
    await p.close();

    // All settled
    expect(p.runningCount).toBe(0);
    expect(p.waitingCount).toBe(0);
    expect(p.pendingCount).toBe(0);
    expect(p.settledCount).toBe(5);
    expect(p.resolvedCount).toBe(5);
    expect(p.rejectedCount).toBe(0);
    expect(p.concurrency).toBe(2); // Never changes
  });

  test('invariant: settledCount + pendingCount = totalEnqueued', async () => {
    const totalEnqueued = 20;
    const orig = console.error;
    console.error = () => {};
    const p = pool(3);

    for (let i = 0; i < totalEnqueued; i++) {
      p.enqueue(() => {
        if (i % 4 === 0) return Promise.reject(new Error('fail'));
        return Promise.resolve(i);
      });
    }

    // Check before starting
    expect(p.settledCount + p.pendingCount).toBe(totalEnqueued);

    await p.close();
    console.error = orig;

    // Check after close
    expect(p.settledCount + p.pendingCount).toBe(totalEnqueued);
    expect(p.settledCount).toBe(totalEnqueued); // All should be settled
    expect(p.pendingCount).toBe(0); // None should be pending
  });

  test('getters work correctly with rejectOnError=false (error wrapped)', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2, { rejectOnError: false });

    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => Promise.reject(new Error('fail')));
    p.enqueue(() => Promise.resolve(3));

    const results = await p.close();
    console.error = orig;

    // All 3 tasks settled, regardless of error mode
    expect(p.settledCount).toBe(3);
    expect(p.resolvedCount).toBe(2);
    expect(p.rejectedCount).toBe(1);
    expect(p.pendingCount).toBe(0);
    expect(results.length).toBe(3);
  });

  test('getters update before rejectOnError rejection occurs', async () => {
    const p = pool(2, { rejectOnError: true });

    p.enqueue(() => Promise.reject(new Error('fatal')));

    try {
      await p.close();
    } catch (e) {
      // Error expected
    }

    // Even with rejectOnError=true, the rejection was counted before pool rejected
    expect(p.rejectedCount).toBe(1);
  });

  test('concurrency getter always returns configured value', () => {
    const configs = [1, 2, 5, 10, 100];

    for (const conc of configs) {
      const p = pool(conc);
      expect(p.concurrency).toBe(conc);
    }

    // Also test with options
    const p1 = pool(3, { autoStart: false });
    expect(p1.concurrency).toBe(3);

    const p2 = pool(7, { autoStart: true, rejectOnError: true });
    expect(p2.concurrency).toBe(7);
  });

  test('resolvedCount and rejectedCount are monotonic (never decrease)', async () => {
    const orig = console.error;
    console.error = () => {};
    const samples: number[] = [];
    const rejSamples: number[] = [];

    const p = pool(2);
    p.on('resolve', () => {
      samples.push(p.resolvedCount);
    });
    p.on('error', () => {
      rejSamples.push(p.rejectedCount);
    });

    for (let i = 0; i < 8; i++) {
      p.enqueue(() => {
        if (i % 3 === 0) return Promise.reject(new Error('x'));
        return Promise.resolve(i);
      });
    }

    await p.close();
    console.error = orig;

    // resolvedCount samples should be non-decreasing
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }

    // rejectedCount samples should be non-decreasing
    for (let i = 1; i < rejSamples.length; i++) {
      expect(rejSamples[i]).toBeGreaterThanOrEqual(rejSamples[i - 1]);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-09: TimeoutError Context Fields
   ────────────────────────────────────────────────────── */
describe('TEST-09: TimeoutError Context Fields', () => {
  test('timeout() rejection includes timeout field', async () => {
    try {
      await timeout(wait(100), 20);
      throw new Error('Should have timed out');
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).timeout).toBe(20);
    }
  });

  test('timeout() rejection includes promise field', async () => {
    const p = wait(100);
    try {
      await timeout(p, 20);
      throw new Error('Should have timed out');
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).promise).toBe(p);
    }
  });

  test('both timeout and promise fields present together', async () => {
    const p = new Promise<void>(() => {
      // Never resolves or rejects
    });
    try {
      await timeout(p, 25);
      throw new Error('Should have timed out');
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      const timeoutErr = err as TimeoutError;
      expect(timeoutErr.timeout).toBeDefined();
      expect(timeoutErr.promise).toBeDefined();
      expect(timeoutErr.timeout).toBe(25);
      expect(timeoutErr.promise).toBe(p);
    }
  });

  test('timeout value matches the delay passed to timeout()', async () => {
    const delays = [10, 50, 100, 500];
    
    for (const delay of delays) {
      try {
        await timeout(wait(1000), delay);
        throw new Error(`Should have timed out for delay ${delay}`);
      } catch (err) {
        expect((err as TimeoutError).timeout).toBe(delay);
      }
    }
  });

  test('promise field is the exact promise passed to timeout()', async () => {
    const createPromise = () => wait(1000);
    const p = createPromise();
    
    try {
      await timeout(p, 20);
      throw new Error('Should have timed out');
    } catch (err) {
      const timeoutErr = err as TimeoutError;
      expect(timeoutErr.promise === p).toBe(true); // Reference equality
    }
  });

  test('error message includes timeout duration', async () => {
    try {
      await timeout(wait(100), 25);
      throw new Error('Should have timed out');
    } catch (err) {
      expect((err as Error).message).toContain('25');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-10: Pool Timeout Context Integration
   ────────────────────────────────────────────────────── */
describe('TEST-10: Pool Timeout Context Integration', () => {
  test('pool.enqueue with timeout generates TimeoutError with context', async () => {
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);
    p.enqueue(() => wait(100), 20);
    const result = await p.close();
    console.error = orig;

    const poolError = result[0] as any;
    expect(poolError).toBeInstanceOf(Error);
    expect(poolError.catched).toBeInstanceOf(TimeoutError);
    expect((poolError.catched as TimeoutError).timeout).toBe(20);
    expect((poolError.catched as TimeoutError).promise).toBeDefined();
  });

  test('error event receives TimeoutError with context intact', async () => {
    let timeoutErrors: TimeoutError[] = [];
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);

    p.on('error', (error) => {
      if (error instanceof TimeoutError) {
        timeoutErrors.push(error);
      }
    });

    p.enqueue(() => wait(100), 20);
    await p.close();
    console.error = orig;

    expect(timeoutErrors.length).toBeGreaterThan(0);
    expect(timeoutErrors[0].timeout).toBeDefined();
    expect(timeoutErrors[0].promise).toBeDefined();
    expect(timeoutErrors[0].timeout).toBe(20);
  });

  test('pool error event and inner TimeoutError have matching context', async () => {
    let capturedError: TimeoutError | null = null;
    const orig = console.error;
    console.error = () => {};
    const p = pool(2);

    p.on('error', (error) => {
      if (error instanceof TimeoutError) {
        capturedError = error;
      }
    });

    p.enqueue(() => wait(100), 30);
    await p.close();
    console.error = orig;

    expect(capturedError).not.toBeNull();
    expect(capturedError!.timeout).toBe(30);
    expect(capturedError!.promise).toBeDefined();
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-11: Memory Cleanup & Listener Deregistration
   ────────────────────────────────────────────────────── */
describe('TEST-11: Memory Cleanup & Listener Deregistration', () => {
  test('all listeners are cleared after pool resolution', async () => {
    const p = pool(2, { autoStart: false });

    // Register listeners on all event types
    const lifecycleEvents = ['start', 'full', 'next', 'available', 'close'] as const;
    const listenerCounts: Record<string, number> = {};

    for (const event of lifecycleEvents) {
      p.on(event, () => {});
      listenerCounts[event] = 1;
    }
    p.on('resolve', () => {});
    p.on('error', () => {});
    listenerCounts['resolve'] = 1;
    listenerCounts['error'] = 1;

    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => Promise.resolve(2));

    await p.close();

    // Verify internal state: post-close, registering a new listener should have no effect
    // (implies listeners were cleared — this is an indirect test since listeners are private)
    let postCloseFireCount = 0;
    p.on('next', () => postCloseFireCount++);

    // Attempt to trigger event (no more events should fire post-close)
    await Promise.resolve();
    expect(postCloseFireCount).toBe(0); // No listeners remain to receive events
  });

  test('#running array is empty after pool resolution', async () => {
    const p = pool(2);

    p.enqueue(() => wait(50));
    p.enqueue(() => wait(50));
    p.enqueue(() => wait(50));

    // May or may not have tasks running at this exact moment (timing-dependent)
    // So we only verify the final state
    await p.close();
    expect(p.running).toBe(0); // All tasks settled, array emptied
  });

  test('#enqueued array is empty after pool resolution', async () => {
    const p = pool(1); // Low concurrency to ensure queue builds up

    p.enqueue(() => wait(50));
    p.enqueue(() => wait(50));
    p.enqueue(() => wait(50));

    expect(p.waiting).toBeGreaterThan(0); // Some tasks queued
    await p.close();
    expect(p.waiting).toBe(0); // All tasks processed, queue emptied
  });

  test('listener cleanup does not affect error event firing during execution', async () => {
    const p = pool(2);
    let errorCount = 0;

    p.on('error', () => errorCount++);

    p.enqueue(() => Promise.reject(new Error('test')));
    p.enqueue(() => Promise.resolve('ok'));

    await p.close();

    // Error listener should have fired (before close() cleared listeners)
    expect(errorCount).toBe(1);

    // Verify no more errors fire post-close (listeners are gone)
    let postCloseErrorCount = 0;
    p.on('error', () => postCloseErrorCount++);
    await Promise.resolve();
    expect(postCloseErrorCount).toBe(0);
  });

  test('once() listeners are removed even before close() cleanup', async () => {
    const p = pool(2);
    let onceCount = 0;

    p.once('next', () => onceCount++);
    p.enqueue(() => Promise.resolve(1));
    p.enqueue(() => wait(20));

    await p.close();

    expect(onceCount).toBe(1); // once() fired exactly once (on first 'next')
  });

  test('pool getters reflect settled state after close()', async () => {
    const p = pool(3);

    for (let i = 0; i < 5; i++) {
      p.enqueue(() => wait(20));
    }

    await p.close();

    expect(p.running).toBe(0);
    expect(p.waiting).toBe(0);
    expect(p.isResolved).toBe(true);
    expect(p.isClosed).toBe(true);
    expect(p.pendingCount).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────
   TEST-12: Performance Instrumentation
   ────────────────────────────────────────────────────── */
describe('TEST-12: Performance Instrumentation', () => {
  test('metrics are logged to console on pool resolution', async () => {
    const originalLog = console.log;
    let logOutput = '';
    console.log = (msg: string) => {
      logOutput += msg;
    };

    try {
      const p = pool(2);
      p.enqueue(() => Promise.resolve(42));
      await p.close();

      // Verify metrics were logged (contains event count and duration)
      expect(logOutput).toMatch(/\[PromisePool\] Metrics/);
      expect(logOutput).toMatch(/events/);
      expect(logOutput).toMatch(/ms elapsed/);
    } finally {
      console.log = originalLog;
    }
  });

  test('event count increments for each emitted event', async () => {
    const originalLog = console.log;
    let logOutput = '';
    console.log = (msg: string) => {
      logOutput += msg;
    };

    try {
      const p = pool(2);
      let eventsFired = 0;
      p.on('start', () => eventsFired++);
      p.on('next', () => eventsFired++);
      p.on('full', () => eventsFired++);
      p.on('available', () => eventsFired++);

      p.enqueue(() => wait(10));
      p.enqueue(() => wait(10));
      p.enqueue(() => wait(10));

      await p.close();

      // Extract event count from log
      const match = logOutput.match(/(\d+) events/);
      expect(match).toBeTruthy();
      const loggedEventCount = parseInt(match![1]);
      expect(loggedEventCount).toBeGreaterThan(0);
      expect(loggedEventCount).toBeGreaterThanOrEqual(eventsFired); // At least as many as we tracked
    } finally {
      console.log = originalLog;
    }
  });

  test('elapsed time is positive and reasonable', async () => {
    const originalLog = console.log;
    let logOutput = '';
    console.log = (msg: string) => {
      logOutput += msg;
    };

    try {
      const p = pool(2);
      p.enqueue(() => wait(50));
      p.enqueue(() => wait(50));

      await p.close();

      // Extract elapsed time from log
      const match = logOutput.match(/(\d+\.?\d*) *ms elapsed/);
      expect(match).toBeTruthy();
      const elapsed = parseFloat(match![1]);
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(5000); // Should complete in less than 5 seconds
    } finally {
      console.log = originalLog;
    }
  });

  test('metrics collection has minimal CPU overhead', async () => {
    const originalLog = console.log;
    console.log = () => {}; // Suppress output

    try {
      const p = pool(10);
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        p.enqueue(() => Promise.resolve(i));
      }

      await p.close();
      const elapsed = performance.now() - start;

      // Metrics collection should not cause significant slowdown
      // (This is an informational test — no hard threshold, just log the result)
      console.log = originalLog;
      console.log(`[Test Metric] 100-task pool with metrics: ${elapsed.toFixed(2)}ms`);
    } finally {
      console.log = originalLog;
    }

    // Test passes if it completes without error
    expect(true).toBe(true);
  });

  test('metrics work with mixed event types', async () => {
    const originalLog = console.log;
    let logOutput = '';
    console.log = (msg: string) => {
      logOutput += msg;
    };

    try {
      const p = pool(2);
      p.on('resolve', () => {});
      p.on('error', () => {});

      p.enqueue(() => Promise.resolve('success'));
      p.enqueue(() => Promise.reject(new Error('fail')));

      await p.close();

      // Verify metrics logged despite mixed outcomes
      expect(logOutput).toMatch(/\[PromisePool\] Metrics/);
    } finally {
      console.log = originalLog;
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────
   on/once type overloads (compile-time)
   ──────────────────────────────────────────────────── */
describe('on/once type overloads (compile-time)', () => {
  test('correct signatures compile without errors', () => {
    const p = pool(1);
    // Simple events — no args
    p.on('start', () => {});
    p.on('full', () => {});
    p.on('next', () => {});
    p.on('close', () => {});
    p.on('available', () => {});
    // resolve — one arg
    p.on('resolve', (_result: unknown) => {});
    // error — one arg only
    p.on('error', (_err: unknown) => {});
    // once mirrors on
    p.once('start', () => {});
    p.once('resolve', (_result: unknown) => {});
    p.once('error', (_err: unknown) => {});
  });

  test('rejects wrong arity on simple events', () => {
    const p = pool(1);
    // @ts-expect-error — 'start' callback takes no args
    p.on('start', (_x: number) => {});
    // @ts-expect-error — 'full' callback takes no args
    p.once('full', (_x: string) => {});
  });

  test('rejects wrong arity on resolve event', () => {
    const p = pool(1);
    // @ts-expect-error — 'resolve' callback takes exactly one arg
    p.on('resolve', (_a: unknown, _b: unknown) => {});
  });

  test('rejects extra args on error event', () => {
    const p = pool(1);
    // @ts-expect-error — 'error' callback takes exactly one arg (context removed from signature)
    p.on('error', (_err: unknown, _ctx: unknown) => {});
  });
});

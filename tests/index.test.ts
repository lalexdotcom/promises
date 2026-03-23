import { describe, expect, test } from '@rstest/core';
import { TimeoutError, pool, wait } from '../src/index';

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

import { timeout as timeoutPromise } from './utils';

type PromiseFunction<T = unknown> = () => Promise<T>;
type QueuedPromise = { generator: PromiseFunction; index: number; timeout: number };

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_NAME = 'pool';
type POOL_EVENT_TYPE = 'start' | 'full' | 'next' | 'close' | 'available';

export interface PromisePool {
	readonly promise: Promise<unknown[]>;
	readonly running: number;
	readonly waiting: number;

	readonly isStarted: boolean;
	readonly isClosed: boolean;
	readonly isResolved: boolean;

	start(): void;
	enqueue<P extends PromiseFunction>(promiseGenerator: P): void;
	close(): Promise<unknown[]>;

	on(event: POOL_EVENT_TYPE, callback: () => void): void;
	once(event: POOL_EVENT_TYPE, callback: () => void): void;
}

const VERBOSE_LEVELS = {
	debug: console.debug,
	info: console.info,
	warn: console.warn,
	error: console.error,
};

type PoolOptions = {
	concurrency: number;
	name?: string;
	rejectOnError?: boolean;
	autoStart?: boolean;
	verbose?: boolean | ((level: keyof typeof VERBOSE_LEVELS, ...debug: Parameters<typeof console.log>) => any);
};

interface PoolError extends Error {
	catched: any;
}

class PoolErrorImpl extends Error implements PoolError {
	catched: any;

	constructor(message: string, catched: any) {
		super(message);
		this.catched = catched;
	}
}

class PromisePoolImpl implements PromisePool {
	size: number;

	private name: string;
	private options?: PoolOptions;

	private currentIndex = 0;

	#running: Promise<any>[] = [];
	#enqueued: QueuedPromise[] = [];
	private result: any[] = [];

	#isStarted = false;
	#isClosed = false;
	#isResolved = false;

	#promise: Promise<any[]>;
	#resolve!: (...args: any[]) => void;
	#reject!: (...args: any[]) => void;

	#listeners: Partial<Record<POOL_EVENT_TYPE, Map<() => void, boolean>>> = {};

	#emit(type: POOL_EVENT_TYPE) {
		if (this.#listeners[type]) {
			this.verbose('debug', `emit ${type}`);
			for (const [cb, once] of this.#listeners[type]!) {
				cb();
				if (once) this.#listeners[type]?.delete(cb);
			}
		}
	}

	on(type: POOL_EVENT_TYPE, cb: () => void) {
		(this.#listeners[type] ??= new Map()).set(cb, false);
	}

	once(type: POOL_EVENT_TYPE, cb: () => void) {
		(this.#listeners[type] ??= new Map()).set(cb, true);
	}

	constructor(options?: PoolOptions) {
		this.size = options?.concurrency || DEFAULT_CONCURRENCY;
		this.name = options?.name || DEFAULT_NAME;
		this.options = options;
		this.#promise = new Promise((res, rej) => {
			this.#resolve = res;
			this.#reject = rej;
		});
	}

	start() {
		if (!this.#isStarted) {
			this.#emit('start');
			this.verbose('info', 'start pool');
			Promise.resolve().then(() => {
				this.#isStarted = true;
				this.runNext();
			});
		} else {
			this.runNext();
		}
	}

	enqueue<P extends PromiseFunction>(promiseGenerator: P, timeout: number = Number.NaN) {
		if (this.#isClosed) throw new Error(`[${this.name}] PromisePool already closed`);
		if (this.#isResolved) throw new Error(`[${this.name}] PromisePool already performed`);
		this.verbose('info', `enqueue promise@${this.currentIndex}`);
		this.#enqueued.push({ index: this.currentIndex++, generator: promiseGenerator, timeout });
		if ((this.options?.autoStart ?? true) && !this.#isStarted) {
			this.start();
		} else if (this.#isStarted) {
			this.runNext();
		}
	}
	private verbose(level: keyof typeof VERBOSE_LEVELS, ...args: any[]) {
		if (!this.options?.verbose) return;
		if (typeof this.options?.verbose === 'function') {
			this.options.verbose(level, ...args);
		} else if (this.options?.verbose) {
			VERBOSE_LEVELS[level](...args);
		}
	}

	private runNext() {
		if (this.#isStarted) {
			if (this.#enqueued.length) {
				let added = 0;
				while (this.#running.length < this.size && !!this.#enqueued.length) {
					const nextQueuedPromise = this.#enqueued.shift();
					this.verbose('info', `run promise ${nextQueuedPromise?.index}`);
					if (nextQueuedPromise) {
						const { generator, index, timeout } = nextQueuedPromise;
						this.#emit('next');
						const nextPromise =
						!Number.isNaN(timeout) && timeout > 0 ? timeoutPromise(generator(), timeout) : generator();
						nextPromise
							.then((res) => this.promiseDone(nextPromise, res, index))
							.catch((err) => this.promiseRejected(nextPromise, err, index));
						this.#running.push(nextPromise);
						added++;
					}
				}
				if (this.#running.length >= this.size) {
					if (added) this.#emit('full');
				}
			} else if (!this.#running.length) {
				if (this.#isClosed) {
					this.verbose('info', 'no more queue: done');
					this.#isResolved = true;
					this.#resolve(this.result);
				} else {
					this.verbose('info', 'waiting for new promises or close');
				}
			} else {
				if (this.#running.length === this.size - 1) {
					this.#emit('available');
				}
				this.verbose('info', `${this.#running.length} promises still running`);
			}
		}
	}

	get promise() {
		return this.#promise;
	}

	get running() {
		return this.#running.length;
	}

	get waiting() {
		return this.#enqueued.length;
	}

	get pending(): number {
		return this.#enqueued.length;
	}

	get isStarted() {
		return this.#isStarted;
	}

	get isClosed() {
		return this.#isClosed;
	}

	get isResolved() {
		return this.#isResolved;
	}

	private promiseDone(p: Promise<unknown>, result: any, index: number) {
		if (this.#isResolved) return;
		const promiseIndex = this.#running.indexOf(p);
		if (promiseIndex >= 0) {
			this.#running.splice(promiseIndex, 1);
			this.result[index] = result;
			this.verbose('info', `promise@${index} done`);
			// this.#emit('next');
			this.runNext();
		} else {
			this.verbose('warn', 'unknown promise resolved');
		}
	}

	private promiseRejected(p: Promise<unknown>, error: any, index: number) {
		if (this.#isResolved) return;
		const promiseIndex = this.#running.indexOf(p);
		if (promiseIndex >= 0) {
			this.#running.splice(promiseIndex, 1);
			this.result[index] = new PoolErrorImpl(`Promise ${index} was rejected`, error);
			if (this.options?.rejectOnError) {
				this.#isResolved = true;
				this.#reject(error);
			} else {
				console.error(error instanceof Error ? error.message : JSON.stringify(error));
				// this.#emit('next');
				this.runNext();
			}
			this.verbose('error', `promise@${index} error`, error);
		} else {
			this.verbose('warn', 'unknown promise error');
		}
	}

	close() {
		this.verbose('info', 'close pool');
		this.#isClosed = true;
		this.start();
		return this.#promise;
	}
}

export const pool = Object.assign(
	(concurrency = 10, options?: Omit<PoolOptions, 'concurrency'>): PromisePool =>
		new PromisePoolImpl({ ...options, concurrency }),
	{
		parallel: (commands: PromiseFunction[], options?: PoolOptions): Promise<any[]> => {
			if (!commands.length) return Promise.resolve([]);
			const parallelPool = new PromisePoolImpl({ concurrency: Number.POSITIVE_INFINITY, ...options });
			for (const cmd of commands) parallelPool.enqueue(cmd);
			return parallelPool.close();
		},
		serial: (commands: PromiseFunction[], options?: Omit<PoolOptions, 'concurrency'>): Promise<any[]> => {
			if (!commands.length) return Promise.resolve([]);
			const parallelPool = new PromisePoolImpl({ ...options, concurrency: 1 });
			for (const cmd of commands) parallelPool.enqueue(cmd);
			return parallelPool.close();
		},
	},
);

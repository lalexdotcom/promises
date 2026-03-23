export function wait(delay = 0) {
	return new Promise<void>((res) => {
		setTimeout(res, delay);
	});
}

export class TimeoutError extends Error {}

export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
	return new Promise((res, rej) => {
		let isTooLate = false;
		let isResolved = false;
		const to = setTimeout(() => {
			if (!isResolved) {
				isTooLate = true;
				clearTimeout(to);
				rej(new TimeoutError('Promise timed out'));
			}
		}, delay);
		p.then((v) => {
			if (!isTooLate) {
				isResolved = true;
				clearTimeout(to);
				res(v);
			}
			// late resolution silently ignored — outer promise already rejected
		}).catch((err) => {
			if (!isTooLate) {
				isResolved = true;
				clearTimeout(to);
				rej(err);
			}
		});
	});
}

export function unsync<TResult>(fct: (...args: unknown[]) => TResult, delay?: number): Promise<TResult> {
	return new Promise((res, rej) => {
		setTimeout(() => {
			try {
				const result = fct();
				res(result);
			} catch (e) {
				rej(e);
			}
		}, delay);
	});
}

export function slice<FuncType extends (input: any[], ...args: unknown[]) => any[]>(fct: FuncType, size = 10_000) {
	type OutputType = ReturnType<FuncType>;
	return async (...args: Parameters<FuncType>): Promise<OutputType> => {
		const [input, ...restArgs] = args;
		const pendingInput = [...input];
		let result = [] as OutputType;
		while (pendingInput.length) {
			const sliceInput = pendingInput.splice(0, size);
			const sliceResult = await new Promise<OutputType>((res) => {
				setTimeout(() => res(fct(sliceInput, ...restArgs) as OutputType));
			});
			result = result.concat(sliceResult) as OutputType;
		}
		return result;
	};
}

export const defer = <T>() => {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: any) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

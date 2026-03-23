# CONCERNS.md — Technical Debt, Bugs & Issues

## 🔴 Critical Bugs

### 1. Broken Test Import — tests will not run at all

**File:** `tests/index.test.ts`  
**Severity:** Critical — 100% test failure

```ts
import { squared } from '../src/index'; // ⚠ `squared` does not exist
```

`src/index.ts` exports only `pool`, `PromisePool` (type), and the utils (`wait`, `timeout`, `TimeoutError`, `unsync`, `slice`). There is no `squared` function anywhere in the codebase.

**Impact:** Running `pnpm run test` will fail immediately with an import/compilation error.  
**Action needed:** Replace this placeholder test with real tests or remove it.

---

### 2. Inverted Timeout Guard Logic

**File:** `src/pool.ts`, line in `runNext()`:

```ts
// Current (broken):
const nextPromise =
  Number.isNaN(timeout) && timeout > 0 ? timeoutPromise(generator(), timeout) : generator();
```

`Number.isNaN(timeout) && timeout > 0` is **always `false`** — if a value `isNaN`, it cannot be `> 0`. The `timeoutPromise` wrapper is therefore **never used**, even when a real timeout value is passed to `enqueue()`.

**Fix:**
```ts
const nextPromise =
  !Number.isNaN(timeout) && timeout > 0 ? timeoutPromise(generator(), timeout) : generator();
```

**Impact:** The `timeout` parameter to `enqueue()` is silently ignored. Any consumer relying on per-promise timeouts gets no protection against hanging promises.

---

## 🟡 Logic Issues / Edge Cases

### 3. Spurious Rejection in `timeout()` on Late Resolution

**File:** `src/utils.ts`

```ts
p.then((v) => {
  if (isTooLate) rej();   // ← calls rej() with undefined argument
  else { ... res(v); }
});
```

If the wrapped promise resolves after the timeout has already fired, `rej()` is called with no argument (resolves to `undefined` rejection reason). This produces an unhandled rejection with `undefined` as the reason, which can be confusing in debugging.

**Better approach:** Silently ignore the late resolution (since the promise was already rejected with `TimeoutError`):
```ts
p.then((v) => {
  if (!isTooLate) { isResolved = true; clearTimeout(to); res(v); }
  // else: no-op — already rejected
});
```

---

### 4. `timeout()` Doesn't Handle Rejection of Wrapped Promise

**File:** `src/utils.ts`  
The `timeout()` wrapper does not attach a `.catch()` to the input promise `p`. If `p` rejects before the timeout fires, the rejection is unhandled (becomes an unhandled promise rejection in Node.js).

```ts
export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    // ... sets up timeout
    p.then((v) => { ... res(v); });
    // ⚠ missing: p.catch((e) => { clearTimeout(to); rej(e); });
  });
}
```

---

### 5. `result` Array is Sparse on Errors

**File:** `src/pool.ts`

When a promise is rejected and `rejectOnError: false`, `result[index]` is set to a `PoolErrorImpl` instance, not `undefined`. This mixes error objects in with normal results in the returned array — consumers must check each item's type to distinguish errors from values.

This design decision should be clearly documented in the public API/README.

---

## 🟠 Technical Debt

### 6. No Real Tests

Beyond the broken placeholder test, there are **zero tests** for the library's core functionality (`PromisePool`, all utils). This is a significant gap for a concurrency-control library where edge cases matter (race conditions, error propagation, event ordering).

### 7. Commented-Out Event Emissions

**File:** `src/pool.ts`

```ts
// this.#emit('next');   ← commented out in promiseDone
// this.#emit('next');   ← commented out in promiseRejected
```

The `'next'` event is emitted in `runNext()` when dequeuing, but the commented-out calls suggest the event semantics were changed without cleanup. This is dead code and reduces clarity.

### 8. `pending` Getter Is a Duplicate

**File:** `src/pool.ts`

```ts
get waiting() { return this.#enqueued.length; }
get pending(): number { return this.#enqueued.length; }  // ← duplicate
```

`pending` returns the same value as `waiting` but is not part of the `PromisePool` interface. It is likely an oversight from a rename and should be removed or added to the interface.

### 9. `private` is `true` in `package.json` But This Is a Library

The package has `"private": true`, which prevents accidental npm publishing but may cause confusion if the intent is eventually to publish this library. Should be documented intentionally.

### 10. No CI / CD

No GitHub Actions workflows exist. Tests are never automatically validated on commit or PR.

### 11. No README API Documentation

The `README.md` exists but its contents aren't visible in the codebase map. Given the API has non-obvious behaviors (error handling in results, timeout guard bug, event system), thorough API docs would reduce future confusion.

---

## 🟢 Low Risk / Minor

### 12. `autoStart` Default Not in Interface

`PoolOptions.autoStart` defaults to `true` (via `options?.autoStart ?? true`) but is not documented in the public `PoolOptions` type comment or README. Consumers may not know they can disable it.

### 13. `close()` Return Type Is Incorrect

```ts
close(): Promise<unknown[]>
```

Returns `this.#promise` which is typed as `Promise<any[]>`. The interface says `Promise<unknown[]>` — minor type widening that is safe but inconsistent.

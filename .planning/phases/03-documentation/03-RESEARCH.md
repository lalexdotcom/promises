# Phase 3: Documentation - Research

**Researched:** 2026-03-23
**Domain:** TypeScript library documentation — JSDoc, README authoring, inline code comments
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use realistic, scenario-based examples (e.g., job queue, rate limiting, scraping) — not minimal throwaway snippets.
- **D-02:** Examples should NOT include explicit TypeScript type annotations — keep examples readable and JS-friendly.
- **D-03:** Number of examples per section is at the agent's discretion — prefer fewer complete examples over many partial ones.
- **D-04:** Highlight the typed return values of `pool.parallel()` and `pool.serial()` — these infer `Promise<[T1, T2, ...]>` for heterogeneous and `Promise<T[]>` for homogeneous arrays. Worth a dedicated note or example.
- **D-05:** README must be in English.
- **D-06:** JSDoc on ALL public types and exported functions — standard `@param`, `@returns`, `@default` tags.
- **D-07:** Dedicated API reference section in README with parameter tables for each exported symbol.
- **D-08:** Inline comments explain WHY, not WHAT — only on non-trivial or non-obvious code paths.
- **D-09:** Mandatory inline comment targets: `runNext()` scheduler logic, lifecycle state machine transitions, event dispatch mechanism, `promiseDone`/`promiseRejected` guard logic, `#isResolved` guard semantics, `Object.assign` factory pattern on `pool`.

### Agent's Discretion
- Exact wording of JSDoc descriptions
- Whether to include `@throws` tags (recommended yes for `timeout`, `enqueue` guards)
- Section ordering within the README (installation → quick start → API reference → examples is natural but agent can adjust)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | README with installation, pool usage, `parallel`/`serial` examples, utility examples, API summary, npm badge, licence | README structure analysis, content inventory, JSDoc complement strategy |
| DOCS-02 | JSDoc on all public types (`PromisePool`, `PoolOptions`, `PoolError`, `TimeoutError`) and all exported functions (`pool`, `wait`, `timeout`, `unsync`, `slice`) | Full API surface audit, JSDoc placement strategy, TypeScript-idiomatic JSDoc patterns |
| DOCS-03 | Inline comments on complex logic: `runNext()` scheduler, lifecycle state machine, event system, `promiseDone`/`promiseRejected` | Code reading of src/pool.ts, key non-obvious paths catalogued |
</phase_requirements>

---

## Summary

Phase 3 is a pure documentation phase — no runtime behaviour changes. The deliverables are three: (1) a rewritten README that takes a new user from zero to working code, (2) JSDoc on every public export, and (3) inline WHY-comments on the complex scheduler and lifecycle logic in `src/pool.ts`.

The codebase is small and self-contained: two source files (`pool.ts` ~264 lines, `utils.ts` ~80 lines) and a barrel `index.ts`. There is currently no JSDoc anywhere, and the README is a stock Rslib placeholder. Everything is written from scratch.

The biggest documentation design challenge is the partial type-visibility problem: `PoolOptions` and `PoolError` are **not exported** but appear in the public API surface (as a parameter and as a result type). The planner should add `export` to both types as part of this phase so a consumer can reference them explicitly and IDEs can resolve them properly.

**Primary recommendation:** Write JSDoc on the `PromisePool` interface and the exported types/functions, add the API reference tables to README before the examples section, and concentrate inline comments inside `runNext()`, `promiseDone()`, `promiseRejected()`, and the `Object.assign` factory block.

---

## Standard Stack

### No new dependencies needed
This is a documentation-only phase. No packages to install.

| Tool | Already present | Purpose in this phase |
|------|----------------|----------------------|
| TypeScript 5.9 | ✓ | JSDoc type inference, hover tooltips |
| Biome 2.4.6 | ✓ | Format JSDoc comments consistently |
| Rslib / tsc | ✓ | Verify JSDoc produces clean `.d.ts` output |

### Verification command
```bash
pnpm run build    # confirms JSDoc passes through tsc cleanly
pnpm run lint     # Biome: no formatting issues introduced
```

---

## Architecture Patterns

### JSDoc Placement Strategy

**Rule: Document the interface, not the implementation.**

`PromisePool` is a TypeScript `interface` — JSDoc placed on its members shows in IDE hover for every consumer, regardless of the internal class. Never place JSDoc on `PromisePoolImpl` members that shadow the interface.

```typescript
// Correct — JSDoc on interface member
export interface PromisePool {
  /**
   * Starts the pool, allowing enqueued promises to begin execution.
   * Calling `start()` is optional when `autoStart` is enabled (default).
   */
  start(): void;
}
```

**For types and classes that are NOT exported**, add the JSDoc anyway — TypeScript's language server resolves them through declaration files and IDE hover will display them correctly. However, **`PoolOptions` and `PoolError` should be exported** (adding `export` is a one-word change) to allow consumers to write typed code.

### JSDoc Tag Conventions for TypeScript

In TypeScript projects, omit `{type}` annotations from `@param` and `@returns` — the TypeScript type system already communicates types. Include `{type}` only when documenting plain-JS consumers explicitly, which is not a goal here.

```typescript
// Preferred TypeScript-style JSDoc
/**
 * Enqueues a promise factory for execution.
 *
 * @param promiseGenerator - A zero-argument function that returns a Promise.
 * @param timeout - Optional per-promise timeout in milliseconds. Rejects with
 *   {@link TimeoutError} if the promise does not resolve within this duration.
 * @throws {Error} If the pool is already closed or resolved.
 */
enqueue<P extends PromiseFunction>(promiseGenerator: P, timeout?: number): void;
```

Key decisions:
- `@param name - description` (dash-separated, no type)
- `@returns description` (no type)
- `@default value` on options properties with defaults
- `@throws {ErrorClass} description` — use for `enqueue` (closed/resolved guards) and `timeout` utility

### README Structure (recommended order)

```markdown
# promises

[badges: npm version | license | bundle size]

> One-line summary (zero-dependency TypeScript promise pool + async utilities)

## Installation
## Quick Start         ← minimal pool example, ~10 lines
## API Reference       ← parameter tables, BEFORE full examples
## Examples
  ### Concurrency pool
  ### pool.parallel() / pool.serial()
  ### Utilities (wait, timeout, unsync, slice)
## License
```

**Rationale for API Reference before Examples:** A developer evaluating the library will scan the API table first to understand the scope, then look at examples. This is the pattern used by popular libraries like `p-limit`, `bottleneck`, and Sindre Sorhus utility packages.

### README Code Block Language Tag

Use `js` (not `ts`) for all code examples per decision D-02. This keeps examples readable for JS developers and avoids redundancy with the JSDoc/API table which already communicates types.

```markdown
​```js
const { pool } = require('promises');
// or: import { pool } from 'promises';
​```
```

### API Reference Table Format

Parameter tables should have columns: **Name | Type | Default | Description**. Use `—` for required fields with no default.

```markdown
#### `pool(concurrency?, options?)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `concurrency` | `number` | `10` | Max number of promises running simultaneously |
| `options.name` | `string` | `'pool'` | Pool name used in error messages and verbose logs |
| `options.rejectOnError` | `boolean` | `false` | If `true`, rejects the pool promise as soon as any promise fails |
| `options.autoStart` | `boolean` | `true` | Starts the pool automatically on first `enqueue()` |
| `options.verbose` | `boolean \| function` | `false` | Log pool activity to console or a custom logger |
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Badge URLs | Construct manually | Use shields.io standard URLs: `https://img.shields.io/npm/v/{package}` |
| Type cross-references in JSDoc | Inline type names as plain text | Use TSDoc `{@link TypeName}` for navigable cross-refs |
| README table generation | Hand-craft markdown | Write directly — tables are simple and don't change often |

---

## Full API Surface Audit

This is the complete inventory the planner must cover in DOCS-02. Derived from reading `src/pool.ts` and `src/utils.ts`.

### From `src/pool.ts`

| Symbol | Export status | JSDoc target |
|--------|--------------|-------------|
| `PromisePool` | ✅ exported interface | All interface members |
| `pool` factory | ✅ exported const | The factory call signature |
| `pool.parallel` | ✅ static method on `pool` | The static method |
| `pool.serial` | ✅ static method on `pool` | The static method |
| `PoolOptions` | ⚠️ NOT exported — `type PoolOptions = {…}` | Needs `export` added + JSDoc on each property |
| `PoolError` | ⚠️ NOT exported — `interface PoolError extends Error` | Needs `export` added + JSDoc on `catched` property |

> **Critical finding:** `PoolOptions` and `PoolError` are internal but part of the public API contract. Without `export`, consumers cannot write `import type { PoolOptions } from 'promises'` and TypeScript may not surface them in `.d.ts` output correctly. **The planner should include a micro-task to add `export` to both.**

### From `src/utils.ts`

| Symbol | Export status | JSDoc target |
|--------|--------------|-------------|
| `wait` | ✅ exported function | Function + `delay` param |
| `TimeoutError` | ✅ exported class | Class + inherits from `Error` |
| `timeout` | ✅ exported function | Function + `p`, `delay` params |
| `unsync` | ✅ exported function | Function + `fct`, `delay` params |
| `slice` | ✅ exported function | Function + `fct`, `size` params |
| `defer` | ✅ exported function | Function — **not listed in DOCS-02 scope** but exported; agent should add JSDoc to avoid a documentation gap |

> **Note on `defer`:** DOCS-02 lists `pool`, `wait`, `timeout`, `unsync`, `slice` — `defer` is absent. Since it IS exported from the package, leaving it undocumented would be a documentation gap. Recommend adding a brief JSDoc block to `defer` as well (it's a trivial one-liner). The planner can decide whether to include it explicitly.

### `PromisePool` interface members to document

| Member | Kind | Notes |
|--------|------|-------|
| `promise` | getter | Returns the pool's main `Promise<unknown[]>` |
| `running` | getter | Count of currently executing promises |
| `waiting` | getter | Count of enqueued but not-yet-started promises |
| `isStarted` | getter | `true` after first `start()` call |
| `isClosed` | getter | `true` after `close()` is called |
| `isResolved` | getter | `true` after all promises have settled and pool has resolved |
| `start()` | method | Begins pool execution; no-op if already started |
| `enqueue()` | method | Enqueues a promise factory; throws if pool is closed/resolved |
| `close()` | method | Seals the queue and returns the pool promise |
| `on()` | method | Register a persistent event listener |
| `once()` | method | Register a one-time event listener |

---

## Inline Comment Guide (DOCS-03)

The following locations in `src/pool.ts` need WHY-comments. This is derived from reading the actual code.

### 1. `Object.assign` factory pattern (pool.ts, bottom of file)

```typescript
// Object.assign attaches parallel() and serial() as static methods on the factory
// function, providing a callable namespace: pool(10) or pool.parallel([...]).
// This avoids a class-based API (which would require `new`) while preserving
// grouped ergonomics and a single import.
export const pool = Object.assign(
  (concurrency = 10, options?) => new PromisePoolImpl({ ...options, concurrency }),
  { parallel: ..., serial: ... },
);
```

### 2. `runNext()` scheduler (pool.ts)

Comment targets within `runNext()`:
- **Why `while` loop (not `if`):** Each call drains up to `size` enqueued promises in one tick, preventing artificial latency when multiple slots are free after a batch completes.
- **The `added` counter + `full` emit:** `full` is only emitted when *new* promises filled the last available slot(s) in this call — not on every call where `#running.length >= size`. Without `added`, spurious `full` events would fire after every completion even when the pool was already saturated.
- **The `available` emit condition (`#running.length === size - 1`):** Fires when exactly one slot has freed up — computed *after* removal in `promiseDone`, so it signals that capacity has become available again.
- **The `!#running.length && #isClosed` resolution branch:** The only place where the pool resolves — two conditions must both be true: nothing running AND the queue is sealed. This prevents premature resolution on momentary empty-queue states between enqueue bursts.

### 3. `#isResolved` guard in `promiseDone` / `promiseRejected`

```typescript
if (this.#isResolved) return;
```

Comment: `#isResolved` is set synchronously before `#resolve()` is called. Because multiple in-flight promises can settle near-simultaneously (microtask queue), a late `.then()` or `.catch()` could fire after the pool has already resolved. This guard prevents double-resolution and stale `#running` mutations on a logically completed pool.

### 4. Lifecycle state machine transitions

Key states: `#isStarted → #isClosed → #isResolved`. These are monotonic flags (never reset to `false`). A comment explaining the one-way state flow prevents future contributors from accidentally resetting them.

### 5. Event dispatch mechanism

The `#listeners` map stores `Map<callback, isOnce: boolean>`. The `once` flag is checked during iteration — the entry is deleted immediately after the first call. Comment should note why deletion happens *during* the `for...of` loop (Map allows safe deletion during iteration in ES2015+).

### 6. `start()` deferred-start (`Promise.resolve().then(...)`)

`start()` sets `#isStarted` inside a microtask (`Promise.resolve().then(...)`), not synchronously. This ensures any code in the same synchronous frame that calls `enqueue()` right after `start()` will still find `#isStarted === false` and will enqueue — `runNext()` will then be called once the microtask runs. The WHY: prevents a race where `start()` + `enqueue()` in the same tick causes `enqueue` to skip calling `runNext()`.

### 7. `timeout` guard in `runNext()`

```typescript
!Number.isNaN(timeout) && timeout > 0 ? timeoutPromise(generator(), timeout) : generator()
```

Comment: `enqueue()` defaults `timeout` to `Number.NaN`. The `!Number.isNaN` check is intentional — `NaN` means "no timeout requested", any finite positive number means "wrap with timeout". This avoids a separate boolean flag.

---

## Common Pitfalls

### Pitfall 1: JSDoc on implementation instead of interface
**What goes wrong:** Adding `/** ... */` blocks to `PromisePoolImpl` methods rather than `PromisePool` interface members. IDE hover shows the interface declaration, not the implementation — so the JSDoc never surfaces to users.
**Prevention:** All `PromisePool` JSDoc goes on the `export interface PromisePool` block.

### Pitfall 2: Documenting `PoolOptions` without exporting it
**What goes wrong:** JSDoc exists on `PoolOptions` properties but the type is not exported. TypeScript may inline the type in `.d.ts` output, losing the named reference. Consumers cannot import it for typed use.
**Prevention:** Add `export` to `type PoolOptions` and `interface PoolError` before writing JSDoc.

### Pitfall 3: README examples that require TS to understand
**What goes wrong:** Examples use `as`, `satisfies`, generics, or explicit return types. A JS developer can't copy-run them.
**Prevention:** Enforce D-02 strictly — language tag `js`, no type annotations. The API table communicates types.

### Pitfall 4: `@example` tags in JSDoc (explicitly excluded)
**What goes wrong:** Adding `@example` tags to JSDoc so examples appear in IDE hover. Decision D-09 explicitly says examples live in README, not JSDoc.
**Prevention:** No `@example` blocks — keep JSDoc concise with `@param`, `@returns`, `@default`, `@throws` only.

### Pitfall 5: Inline comments that describe WHAT (not WHY)
**What goes wrong:** `// push to running array` vs. `// track in #running to prevent over-scheduling in runNext()`.
**Prevention:** Before writing a comment ask: "could I infer this from reading the code?" If yes, delete it.

### Pitfall 6: Badges with missing package name
**What goes wrong:** shields.io badges reference the npm package name, which is currently `"name": "promises"` in package.json — a very likely name collision on npm. Phase 4 (NPM-01/02) may change the name.
**Prevention:** Use placeholder badge URLs or add a TODO comment in README noting that badge URLs must be updated in Phase 4 once the final package name is confirmed.

---

## Code Examples

Verified patterns from reading the source — for use in README.

### Job queue (pool with concurrency limit)

```js
import { pool } from 'promises';

const jobs = urls.map(url => () => fetch(url).then(r => r.json()));

const p = pool(5);           // max 5 concurrent requests
for (const job of jobs) p.enqueue(job);
const results = await p.close();
```

### Rate-limited scraper (autoStart: false + events)

```js
import { pool } from 'promises';

const scraper = pool(3, { autoStart: false, name: 'scraper' });

scraper.on('full', () => console.log('All slots busy'));
scraper.on('available', () => console.log('A slot freed up'));

for (const url of urls) {
  scraper.enqueue(() => scrape(url));
}

scraper.start();
const results = await scraper.close();
```

### pool.parallel() — typed tuple return

```js
import { pool } from 'promises';

// TypeScript infers: Promise<[User, Post[], Settings]>
const [user, posts, settings] = await pool.parallel([
  () => fetchUser(id),
  () => fetchPosts(id),
  () => fetchSettings(id),
]);
```

### pool.serial() — sequential execution

```js
import { pool } from 'promises';

const results = await pool.serial([
  () => migratePhase1(),
  () => migratePhase2(),
  () => migratePhase3(),
]);
```

### wait — simple delay

```js
import { wait } from 'promises';

await wait(500);  // pause for 500ms
console.log('half a second later');
```

### timeout — deadline wrapper

```js
import { timeout, TimeoutError } from 'promises';

try {
  const data = await timeout(fetch('/api/slow'), 3000);
} catch (e) {
  if (e instanceof TimeoutError) console.log('Request took too long');
  else throw e;
}
```

### unsync — defer CPU work off the main thread tick

```js
import { unsync } from 'promises';

const sorted = await unsync(() => hugeArray.sort());
```

### slice — chunked async processing

```js
import { slice } from 'promises';

const processChunk = slice(async (items) => {
  return Promise.all(items.map(processItem));
}, 100);  // 100 items per chunk

const all = await processChunk(tenThousandItems);
```

---

## State of the Art

| Old Approach | Current Approach | Relevant to This Phase |
|--------------|------------------|------------------------|
| `/** @type {MyType} */` in JSDoc | TypeScript native types + minimal JSDoc tags | Use TypeScript style — no `{type}` in tags |
| `@example` blocks in JSDoc | Examples in README only | D-09 decision matches current practice |
| Separate `API.md` file | README-embedded API reference | Single README is standard for small libraries |

---

## Open Questions

1. **`PoolOptions` / `PoolError` export status**
   - What we know: Both are used in the public API but lack `export` keyword in source
   - What's unclear: Whether Phase 1 added `export` or not (not mentioned in STATE.md)
   - Recommendation: Planner should include a micro-task to verify and add `export` if missing

2. **`defer` coverage**
   - What we know: `defer<T>()` is exported from `utils.ts` but absent from DOCS-02 requirements
   - What's unclear: Whether it was intentionally omitted (considered internal?) or an oversight
   - Recommendation: Add a JSDoc block anyway — it's exported and one-liners cost nothing

3. **Package name for badges**
   - What we know: Current `"name"` in package.json is `"promises"` — almost certainly taken on npm
   - What's unclear: Whether Phase 4 will rename it
   - Recommendation: Use `TODO: update badge URL` placeholder; do not block Phase 3 on Phase 4 decisions

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely file editing (code comments, markdown). No external tools or services required beyond the existing dev toolchain (TypeScript, Biome, pnpm — all confirmed present from Phase 1/2).

---

## Sources

### Primary (HIGH confidence)
- Source code: `src/pool.ts`, `src/utils.ts`, `src/index.ts` — read directly
- Planning context: `CONTEXT.md`, `REQUIREMENTS.md`, `CONVENTIONS.md`, `STRUCTURE.md` — read directly
- TypeScript handbook — JSDoc reference for TypeScript projects: types omitted from tags in TS-native codebases
- TSDoc standard: `{@link}` cross-references, standard tag set

### Secondary (MEDIUM confidence)
- Established npm README conventions (p-limit, bottleneck, p-queue) — API tables before examples, `js` language tag for cross-language readability

### Tertiary (LOW confidence — N/A)
No LOW confidence claims in this research. Everything derives from direct source reading or well-established JSDoc/README patterns.

---

## Metadata

**Confidence breakdown:**
- Public API surface: HIGH — read directly from source files
- JSDoc placement strategy: HIGH — TypeScript interface + implementation separation is well-established
- Inline comment targets: HIGH — derived from reading the actual complex code paths
- README structure: MEDIUM — follows established npm library patterns, confirmed via CONTEXT.md decisions
- `PoolOptions`/`PoolError` export gap: HIGH — directly observed in source

**Research date:** 2026-03-23
**Valid until:** Indefinite — no external dependencies; codebase is stable post Phase 1/2

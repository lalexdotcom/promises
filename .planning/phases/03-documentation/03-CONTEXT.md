# Phase 3: Documentation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the library understandable and immediately usable by a new user through documentation alone — README provides onboarding and usage examples, JSDoc enables IDE discovery, and inline comments explain non-obvious implementation decisions.

This phase does NOT include:
- TypeDoc HTML generation or hosted documentation site
- CHANGELOG authoring
- npm publication (handled in Phase 4)

</domain>

<decisions>
## Implementation Decisions

### README Content & Style
- **D-01:** Use realistic, scenario-based examples (e.g., job queue, rate limiting, scraping) — not minimal throwaway snippets. A reader should be able to recognize a real use-case and copy-adapt it.
- **D-02:** Examples should NOT include explicit TypeScript type annotations — keep examples readable and JS-friendly. The JSDoc + API reference section communicates types.
- **D-03:** Number of examples per section is at the agent's discretion — use the natural density that best communicates each feature. Prefer fewer complete examples over many partial ones.
- **D-04:** Highlight the typed return values of `pool.parallel()` and `pool.serial()` — these helpers infer `Promise<[T1, T2, ...]>` for heterogeneous arrays and `Promise<T[]>` for homogeneous ones. This is a noteworthy TypeScript DX feature worth showcasing.
- **D-05:** README must be in **English** — public npm package, international audience.

### API Documentation Approach
- **D-06:** Write JSDoc on ALL public types and exported functions (standard `@param`, `@returns`, `@default` tags).
- **D-07:** Also add a **dedicated API reference section in the README** with parameter tables for each exported symbol. This supplements IDE hover with a skimmable reference for evaluators who read the README without an IDE.

### Inline Code Comments
- **D-08:** Comments explain **WHY**, not WHAT — only on non-trivial or non-obvious code paths.
- **D-09:** Mandatory comment targets: `runNext()` scheduler logic, lifecycle state machine transitions, event dispatch mechanism, `promiseDone`/`promiseRejected` guard logic, the `#isResolved` guard semantics, and the `Object.assign` factory pattern on `pool`.

### Agent's Discretion
- Exact wording of JSDoc descriptions
- Whether to include `@throws` tags (recommended yes for `timeout`, `enqueue` guards)
- Section ordering within the README (installation → quick start → API reference → examples feels natural but agent can adjust)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files to Document
- `src/pool.ts` — PromisePool interface, PromisePoolImpl, pool factory, PoolOptions, PoolError
- `src/utils.ts` — wait, timeout, TimeoutError, unsync, slice
- `src/index.ts` — barrel export (public API surface)

### Requirements
- `.planning/REQUIREMENTS.md` §Documentation — DOCS-01, DOCS-02, DOCS-03

### Codebase Context
- `.planning/codebase/CONVENTIONS.md` — code style, naming conventions
- `.planning/codebase/STRUCTURE.md` — file layout and public export locations

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pool.ts`: All public exports already typed via interface — JSDoc goes on the interface members, not the implementation
- `src/utils.ts`: 5 standalone exported functions — each needs individual JSDoc

### Established Patterns
- No JSDoc exists anywhere in the codebase today — this phase writes it from scratch
- README is currently the Rslib template placeholder — will be fully rewritten
- Naming is consistent: interface `PromisePool`, factory `pool(...)`, implementaiton class is not exported

### Integration Points
- README links to npm badge, license, homepage — package.json metadata will be finalized in Phase 4; use placeholder badges or note them as TODOs for Phase 4

</code_context>

<specifics>
## Specific Ideas

- User wants typed return values of `parallel`/`serial` to be highlighted — these are a differentiator (type-safe batch execution) worth a dedicated note or example in the README.
- JSDoc standard style (`@param`, `@returns`, `@default`) — no `@example` tags in JSDoc itself (examples live in README)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-documentation*
*Context gathered: 2026-03-23*

# Phase 4: Publication Prep — Discussion Context

**Phase Goal:** The package is fully configured for npm publication — metadata complete, `private` flag removed, file list correct, universal build verified.

**Requirements Covered:** NPM-01, NPM-02, NPM-03, NPM-04

**Status:** Context created (--auto mode) — All gray areas auto-selected and resolved with recommended options.

---

## Project Context & Prior Decisions

### From Prior Phases
- **Phase 1 (Correctness):** Core library logic verified and tested
- **Phase 2 (Test Coverage):** Comprehensive test suite in place (utilities and index)
- **Phase 3 (Documentation):** README.md and API documentation completed

### Project-Level Constraints
- **Library Type:** Pure JavaScript/TypeScript library (promises/async utilities)
- **Target Environments:** Node.js 18+ and modern browsers (universal build)
- **Distribution:** npm package distributed via public registry
- **Tooling:** Rslib for builds, Biome for linting/formatting, Rstest for testing

---

## Requirements Analysis

### NPM-01: Package Metadata
**Requirement:** `package.json` populated with `description`, `keywords`, `homepage`, `repository`, `license`, `author`, `bugs`

**Current State:**
- Some metadata may already exist; full audit needed
- Need complete, meaningful values for all fields

**Gray Areas Resolved (--auto):**
1. **Description specificity** — How detailed should it be?
   - ✅ **[AUTO SELECTED]** "Concise summary of what the library does in 1-2 sentences (what it provides, not internal details)"
   - Rationale: Consistent with npm convetion; helps discovery; easy to understand at a glance

2. **Keywords strategy** — What should they cover?
   - ✅ **[AUTO SELECTED]** "Library name, core concepts (promises, async, utilities), use cases, target envs (Node.js, browser)"
   - Rationale: Balances searchability with accuracy; avoids keyword spamming

3. **Author format** — Individual, org, or multiple?
   - ✅ **[AUTO SELECTED]** "Individual name + email (standard format); no organization override unless explicitly preferred"
   - Rationale: Standard npm author format; allows clear maintainer accountability

4. **License field** — Which license?
   - ✅ **[AUTO SELECTED]** SPDX identifier in `package.json` + matching LICENSE file already in root (Phase 3)
   - Rationale: Standard practice; LICENSE file already in place; npm expects SPDX identifier

5. **Repository and bugs URLs** — GitHub repo format?
   - ✅ **[AUTO SELECTED]** Standard GitHub HTTPS URLs: `https://github.com/owner/repo` and `https://github.com/owner/repo/issues`
   - Rationale: Standard npm convention; enables npm CLI integrations

**Decision:** All metadata fields will be populated with meaningful, standard values following npm best practices.

---

### NPM-02: Remove Private Flag
**Requirement:** Remove `"private": true` from `package.json` (or ensure it's `false`)

**Current State:**
- Likely `"private": true` is present (common dev default)

**Gray Areas Resolved (--auto):**
1. **Private flag approach** — Delete entirely or set to `false`?
   - ✅ **[AUTO SELECTED]** "Delete `"private": true` entirely; absence defaults to public on npm"
   - Rationale: Cleaner, aligns with npm convention; deletion is simpler than setting false

**Decision:** Remove `"private": true` line entirely from `package.json`.

---

### NPM-03: Files Field Configuration
**Requirement:** Verify and complete `files` field (whitelist) — ensure `dist/`, `README.md`, `LICENSE` included; no dev artifacts

**Current State:**
- `files` field may not exist or be incomplete

**Gray Areas Resolved (--auto):**
1. **Files whitelist strategy** — Explicit list or exclude-based?
   - ✅ **[AUTO SELECTED]** "Explicit whitelist in `files` array: minimal, only dist, README, LICENSE, and any type definitions"
   - Rationale: Explicit is safer; prevents accidental inclusion of dev/test files; easier to audit

2. **What to include beyond dist/** — Type definitions, source maps, package.json metadata?
   - ✅ **[AUTO SELECTED]** "`files`: [\"dist\", \"README.md\", \"LICENSE\"]` — only production artifacts; let npm include package.json/package-lock automatically"
   - Rationale: Minimal, focused on what users need; npm handles metadata automatically

3. **Source map inclusion** — Include .map files or strip them?
   - ✅ **[AUTO SELECTED]** "Include .map files (if generated); they are useful for debugging without bloating package size significantly"
   - Rationale: Aid user debugging without major cost; common practice in modern libraries

**Decision:**  
```json
{
  "files": ["dist", "README.md", "LICENSE"]
}
```
Add source maps if rslib generates them; include in dist/ automatically.

---

### NPM-04: Universal Build Verification
**Requirement:** Universal build — verify no Node-only APIs used; `rslib.config.ts` targets browser + Node 18+

**Current State:**
- Library likely uses only universal globals and common async patterns
- `rslib.config.ts` may need review to ensure multi-target configuration

**Gray Areas Resolved (--auto):**
1. **API audit scope** — What counts as "Node-only"?
   - ✅ **[AUTO SELECTED]** "Node-only = APIs not available in browser (e.g., `fs`, `path`, `crypto` Node modules). Safe: `Promise`, `setTimeout`, `console`, standard globals"
   - Rationale: Clear boundary; library is promise utilities, should not depend on Node-specific modules

2. **Verification method** — Code review, bundle analysis, or both?
   - ✅ **[AUTO SELECTED]** "Both: First manual code review of src/ to confirm no Node-specific requires; then run bundle check or use bundle analyzer to confirm final output uses only universal APIs"
   - Rationale: Catches both explicit requires and indirect dependencies; defensive approach

3. **Build config targets** — Should it be dual-build or universal single-build?
   - ✅ **[AUTO SELECTED]** "Single universal build (CJS + ESM from same source); both Node 18+ and modern browsers should use same code path"
   - Rationale: Simplifies maintenance, reduces build complexity, avoids sync/async branching; library doesn't need Node-specific code paths

4. **Test verification** — Can existing tests validate this?
   - ✅ **[AUTO SELECTED]** "Yes—existing tests run in both Node (via rstest) and browser contexts if configured; if only Node, add browser compatibility note to docs as future work"
   - Rationale: Tests already cover logic; if they pass in Node and code has no Node-only APIs, safety is high

**Decision:**
- Source code uses only universal globals (`Promise`, `setTimeout`, `console`, standard library)
- Build emits CJS and ESM suitable for both environments
- Manual audit confirms no `require()` of Node modules
- Bundle inspection as secondary gate before publish

---

## Implementation Approach

### Phase Scope (Boundaries)
**What's IN:**
- ✅ Audit and populate `package.json` metadata (NPM-01)
- ✅ Remove `"private": true` (NPM-02)
- ✅ Add/verify `files` whitelist (NPM-03)
- ✅ Verify source code and build use only universal APIs (NPM-04)
- ✅ Final pre-publish checklist

**What's OUT (deferred):**
- ❌ Actual npm publish (that's a release pipeline step, not this phase)
- ❌ Semantic versioning decisions (handled in release workflow)
- ❌ v2 feature roadmap (deferred post-publication)

### Success Criteria (What Must Be True)
1. **Metadata:** `package.json` has `"name"` (implicit), `"description"`, `"keywords"`, `"homepage"`, `"repository"`, `"license"`, `"author"`, `"bugs"` — all meaningful
2. **Private Flag:** No `"private": true` in `package.json` (default public)
3. **Files List:** `npm pack --dry-run` output shows only `dist/`, `README.md`, `LICENSE`, and any .d.ts files — no `.planning/`, `src/`, `tests/`, `tsconfig.json`, etc.
4. **Universal Build:** Code audit + bundle check confirm no Node-only APIs (`fs`, `path`, `crypto` modules, etc.); only universal globals used
5. **Build Output:** Both CJS and ESM outputs verified to work in Node 18+ and browser;  type definitions included

### Dependency Chain
- **Depends On:** Phase 1 (Correctness), Phase 2 (Test Coverage), Phase 3 (Documentation) — all provide the artifacts that go into publication
- **No Blocking Dependencies:** This phase is last in MVP; nothing depends on it completing

### Approach Summary
**Plan Outline (to be detailed in PLAN.md):**
1. **Task 1:** Audit current `package.json`; fill in all required metadata fields with accurate, meaningful values
2. **Task 2:** Remove `"private": true`; add `"files"` whitelist
3. **Task 3:** Review source code for Node-only APIs (manual + grep verification)
4. **Task 4:** Run `npm pack --dry-run` and verify output whitelist matches expected
5. **Task 5:** Test build outputs (CJS, ESM) in both Node and browser contexts (or verify build config targets both)
6. **Task 6:** Final checklist and documentation of publication readiness

---

## Deferred Ideas & Out of Scope
- **Automated release pipeline:** npm publish automation, GitHub Actions, etc. — deferred to post-MVP release workflow
- **Version management:** Semantic versioning, changelog automation — handled separately via release process
- **Post-publication metrics:** Download stats, user feedback — not applicable in publication-prep phase
- **Additional distribution channels:** unpkg, CDN, etc. — deferred to later distribution phases

---

## Next Step
Ready to **plan Phase 4** — run:  
```
/gsd-plan-phase 4
```

This will create detailed 04-01-PLAN.md with concrete tasks and verification steps for publication readiness.

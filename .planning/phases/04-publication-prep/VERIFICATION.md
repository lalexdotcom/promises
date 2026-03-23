# Phase 4: Publication Prep — Verification Plan

**Phase Goal:** The package is fully configured for npm publication — metadata complete, `private` flag removed, file list correct, universal build verified.

**Verification Approach:** Manual verification using npm CLI tools, code review, and build output inspection. No automated test harness required; verification gates embedded in task checklist (see `04-01-PLAN.md`).

---

## Verification Strategy

### Scope
Verify that ALL four NPM requirements (NPM-01 through NPM-04) are met and the package is publication-ready:
- **NPM-01:** Complete, accurate package metadata
- **NPM-02:** No private flag blocking publication
- **NPM-03:** Correct files whitelist (no dev artifacts)
- **NPM-04:** Universal build (Node + browser compatibility)

### Verification Methods
1. **File & config inspection:** Read `package.json`, `rslib.config.ts`, build output
2. **npm CLI dry-run:** `npm publish --dry-run` to simulate publication
3. **Code review:** Manual grep and source inspection for Node-only APIs
4. **Build validation:** Run `pnpm run build` and inspect output
5. **Test execution:** Run `pnpm run test` to confirm tests pass

### Who Verifies?
Any team member can follow this verification plan. No special tooling required beyond npm CLI and git.

---

## Checklist: Verification Gates

### Gate 1: Metadata Completeness (NPM-01)

**Goal:** `package.json` contains all 7 required fields with meaningful values.

**Verification:**
1. Open `package.json` and confirm these fields exist:
   - [ ] `"name": "promises"`
   - [ ] `"version": "1.0.0"` (or similar SemVer)
   - [ ] `"description"`: Present and >= 20 chars (describes library in 1-2 sentences)
   - [ ] `"keywords"`: Array of >= 5 terms (includes "promises", "async", "pool")
   - [ ] `"homepage"`: Valid HTTPS GitHub URL ending with `#readme`
   - [ ] `"repository"`: Object with `"type": "git"` and valid HTTPS GitHub URL
   - [ ] `"license": "MIT"` (or other SPDX identifier)
   - [ ] `"author"`: String with name + email in format `"Name <email@domain.com>"`
   - [ ] `"bugs"`: Object with `"url"` pointing to GitHub issues

2. Run npm CLI:
   ```bash
   npm view ./
   ```
   Expected: No `ERR!` warnings; all fields present.

3. Cross-reference with LICENSE file:
   ```bash
   head -5 LICENSE
   ```
   Verify TEXT mentions appropriate license (MIT, Apache, etc.)

**Pass Criteria:**
- ✅ All 7 fields present in `package.json`
- ✅ Each field has > 0 characters (no empty strings)
- ✅ `npm view ./` runs without errors or metadata warnings
- ✅ License in `package.json` matches LICENSE file type

---

### Gate 2: Private Flag Removal (NPM-02)

**Goal:** `package.json` has no `"private": true` (package is public on npm).

**Verification:**
1. Search `package.json` for private flag:
   ```bash
   grep -c '"private"' package.json || echo "0"
   ```
   Expected output: `0` (not found)

2. Open `package.json` and manually scan — confirm no line with `"private"`

3. Simulate publish:
   ```bash
   npm publish --dry-run
   ```
   Expected: No warning like "This package can't be published to npm".

**Pass Criteria:**
- ✅ `package.json` contains NO line with `"private"`
- ✅ `npm publish --dry-run` succeeds without private-flag warning

---

### Gate 3: Files Whitelist Configuration (NPM-03)

**Goal:** `package.json` `"files"` array includes only production artifacts (`dist/`, `README.md`, `LICENSE`).

**Verification:**
1. Check `files` field in `package.json`:
   ```bash
   grep -A 5 '"files"' package.json
   ```
   Expected:
   ```json
   "files": [
     "dist",
     "README.md",
     "LICENSE"
   ]
   ```

2. Test with npm pack:
   ```bash
   npm pack --dry-run 2>&1 | grep -E '(dist/|README|LICENSE|package.json)' | head -20
   ```
   Expected: Output shows ONLY:
   - Files under `dist/`
   - `README.md`
   - `LICENSE`
   - (npm auto-includes `package.json`, `package-lock.json`)

3. Verify no dev files in output:
   ```bash
   npm pack --dry-run 2>&1 | grep -E '\.(planning|src|test|config|ts)' || echo "✓ No dev files found"
   ```
   Expected: No matches (or message "No dev files found")

4. Inspect actual tarball size (optional):
   ```bash
   npm pack --dry-run 2>&1 | grep -i 'size'
   ```
   Expected: Tarball < 100KB (this small library should be ~20-50KB)

**Pass Criteria:**
- ✅ `"files"` array includes `"dist"`, `"README.md"`, `"LICENSE"`
- ✅ `npm pack --dry-run` lists only authorized files
- ✅ No `.planning/`, `src/`, `.test.ts`, `*.config.ts` files in tarball
- ✅ Tarball size is reasonable (< 100KB)

---

### Gate 4: Build Configuration (NPM-04 Part A)

**Goal:** `rslib.config.ts` targets both CJS and ESM; exports in `package.json` correct.

**Verification:**
1. Inspect `rslib.config.ts`:
   ```bash
   cat rslib.config.ts | grep -A 20 'lib:'
   ```
   Expected: Both `format: 'cjs'` and `format: 'esm'` entries

2. Check `package.json` exports:
   ```bash
   grep -A 10 '"exports"' package.json
   ```
   Expected:
   ```json
   "exports": {
     ".": {
       "types": "./dist/index.d.ts",
       "require": "./dist/index.cjs",
       "import": "./dist/index.js"
     }
   }
   ```

3. Build and verify output:
   ```bash
   pnpm run build
   ls -lah dist/
   ```
   Expected files:
   - [ ] `dist/index.cjs` (CommonJS, > 1KB)
   - [ ] `dist/index.js` (ESM, > 1KB)
   - [ ] `dist/index.d.ts` (TypeScript definitions, > 0.5KB)
   - [ ] `dist/index.cjs.map` (optional; source map)
   - [ ] `dist/index.js.map` (optional; source map)

4. Verify no build errors:
   ```bash
   pnpm run build 2>&1 | grep -i 'error' || echo "✓ Build succeeded"
   ```
   Expected: "Build succeeded" or similar success message

**Pass Criteria:**
- ✅ `rslib.config.ts` contains both CJS and ESM format configs
- ✅ `package.json` exports includes `require` and `import` conditions
- ✅ `pnpm run build` succeeds with no errors
- ✅ Both `dist/index.cjs` and `dist/index.js` exist and are > 1KB each
- ✅ `dist/index.d.ts` exists (TypeScript definitions)

---

### Gate 5: Code Audit — No Node-Only APIs (NPM-04 Part B)

**Goal:** Source code uses only universal APIs; no Node-specific imports (fs, path, crypto, etc.).

**Verification:**
1. Search for Node-only module imports:
   ```bash
   grep -r "from ['\"]fs['\"]" src/ && echo "❌ FAIL: fs import found" || echo "✓ No fs imports"
   grep -r "from ['\"]path['\"]" src/ && echo "❌ FAIL: path import found" || echo "✓ No path imports"
   grep -r "from ['\"]crypto['\"]" src/ && echo "❌ FAIL: crypto import found" || echo "✓ No crypto imports"
   grep -r "from ['\"]http['\"]" src/ && echo "❌ FAIL: http import found" || echo "✓ No http imports"
   grep -r "from ['\"]node:" src/ && echo "❌ FAIL: node: protocol found" || echo "✓ No node: protocol"
   ```
   Expected: All return "✓ No X imports" (no Node-only modules found)

2. Manual code review of source files:
   ```bash
   head -20 src/index.ts src/pool.ts src/utils.ts
   ```
   Verify imports are only relative paths (`./pool`, `./utils`) or absent

3. Verify universal APIs used:
   Scan for these acceptable patterns (should be present):
   - `Promise` — Standard promise constructor
   - `setTimeout` / `clearTimeout` — Universal timers
   - `console.log` / `console.error` — Universal logging
   - Array/object methods — Standard JavaScript

4. Grep for unsafe patterns (should be absent):
   ```bash
   grep -r "require(" src/ && echo "❌ FAIL: require() found" || echo "✓ No require()"
   grep -r "import.*from.*['\"]fs['\"]" src/ && echo "❌ FAIL: fs import" || echo "✓ Safe"
   ```

**Pass Criteria:**
- ✅ No imports from Node-specific modules (fs, path, crypto, http, net, stream, worker_threads, etc.)
- ✅ All imports are relative paths (./utils, ./pool) or absent
- ✅ Code uses only universal globals: Promise, setTimeout, clearTimeout, console, standard methods
- ✅ Manual code review finds no Node-only APIs

---

### Gate 6: Compatibility Testing (NPM-04 Part C)

**Goal:** Package works in Node.js 18+ environment; no runtime errors.

**Verification:**
1. Run existing test suite (Node.js environment):
   ```bash
   pnpm run test
   ```
   Expected: All tests pass (0 failures)

2. Test CJS require path:
   ```bash
   node -e "const lib = require('./dist/index.cjs'); console.log('CJS exports:', Object.keys(lib).slice(0, 3))"
   ```
   Expected: Prints exports like `pool`, `wait`, `timeout`

3. Test ESM import path:
   ```bash
   node -e "import('./dist/index.js').then(lib => console.log('ESM exports:', Object.keys(lib).slice(0, 3)))"
   ```
   Expected: Prints exports like `pool`, `wait`, `timeout`

4. Verify all expected exports present:
   ```bash
   node -e "const lib = require('./dist/index.cjs'); const exports = ['pool', 'wait', 'timeout', 'TimeoutError', 'unsync', 'slice']; const missing = exports.filter(e => !(e in lib)); console.log('Missing exports:', missing.length ? missing : 'none')"
   ```
   Expected: "Missing exports: none"

**Pass Criteria:**
- ✅ `pnpm run test` passes (all test suites succeeded)
- ✅ CJS require loads without errors; exports present
- ✅ ESM import loads without errors; exports present
- ✅ All expected exports accessible: `pool`, `wait`, `timeout`, `TimeoutError`, `unsync`, `slice`
- ✅ No runtime errors or missing dependency warnings

---

### Gate 7: Publication Dry-Run (Final)

**Goal:** Simulate npm publish; confirm no errors or blockers.

**Verification:**
1. Final publication simulation:
   ```bash
   npm publish --dry-run
   ```
   Expected:
   - No `ERR!` messages
   - No `WARN` about private flag
   - Lists files being published
   - Output ends with successful message

2. Parse output for warnings:
   ```bash
   npm publish --dry-run 2>&1 | grep -i "warn\|error" || echo "✓ No warnings or errors"
   ```
   Expected: "No warnings or errors" message

3. Optionally, inspect published metadata:
   ```bash
   npm view . name version description
   ```
   Expected: Prints `name`, `version`, and meaningful `description`

**Pass Criteria:**
- ✅ `npm publish --dry-run` succeeds with exit code 0
- ✅ No WARN about `"private"` flag
- ✅ No ERR messages
- ✅ Output confirms files being published (dist/, README, LICENSE)

---

## Sign-Off Checklist

Verifier completes each gate and checks off:

```
Gate 1: Metadata Completeness (NPM-01)
- [ ] All 7 fields present: description, keywords, homepage, repository, license, author, bugs
- [ ] npm view ./ shows complete record with no warnings

Gate 2: Private Flag Removal (NPM-02)
- [ ] "private" not in package.json
- [ ] npm publish --dry-run succeeds without private warning

Gate 3: Files Whitelist (NPM-03)
- [ ] "files" array includes dist, README.md, LICENSE
- [ ] npm pack --dry-run shows no dev files (.planning, src, tests, config)
- [ ] Tarball size appropriate (< 100KB)

Gate 4: Build Configuration (NPM-04 Part A)
- [ ] rslib.config.ts has both 'cjs' and 'esm' formats
- [ ] package.json exports include require, import, types
- [ ] pnpm run build succeeds
- [ ] dist/index.cjs and dist/index.js both exist

Gate 5: Code Audit (NPM-04 Part B)
- [ ] No Node-only imports (fs, path, crypto, http)
- [ ] Only universal APIs used (Promise, setTimeout, console)
- [ ] Manual code review complete; no blockers

Gate 6: Compatibility Testing (NPM-04 Part C)
- [ ] pnpm run test passes
- [ ] CJS require('./dist/index.cjs') works
- [ ] ESM import('./dist/index.js') works
- [ ] All exports present: pool, wait, timeout, TimeoutError, unsync, slice

Gate 7: Publication Dry-Run (Final)
- [ ] npm publish --dry-run succeeds (exit 0)
- [ ] No warnings or errors
- [ ] Metadata and files confirmed in dry-run output

PHASE SIGN-OFF:
- [ ] All 7 gates passed
- [ ] Package is publication-ready
- [ ] Verifier name: _______________
- [ ] Date: _______________
```

---

## Failure Diagnosis

If any gate fails:

1. **Gate 1 (Metadata):** Re-read `04-01-PLAN.md` Task 4.1; ensure all fields populated with non-empty values.

2. **Gate 2 (Private flag):** Delete the line `"private": true` from `package.json`; confirm with grep.

3. **Gate 3 (Files):** Check `"files"` array is correct; run `npm pack --dry-run` to see included files; filter with grep to find unexpected files.

4. **Gate 4 (Build):**
   - Re-read `rslib.config.ts` and ensure both `cjs` and `esm` entries present
   - Run `pnpm run build` manually; check error messages
   - Inspect `dist/` contents: `ls -lah dist/`

5. **Gate 5 (Code audit):**
   - Re-run grep searches; if Node-only APIs found, refactor to use only universal APIs
   - Consider removing problematic imports or adding polyfills

6. **Gate 6 (Testing):**
   - Run `pnpm run test` and check for failures
   - If `require()` or `import()` fails, check `dist/` exists and build succeeded
   - Verify export names match in both `.cjs` and `.js` files

7. **Gate 7 (Publication):**
   - Run `npm publish --dry-run` and parse full output (not just exit code)
   - Check for hidden warnings: `npm publish --dry-run 2>&1`
   - Compare metadata against `package.json` source

---

## Notes for Verifier

- **No actual publish:** Skip final npm publish step; stop at dry-run
- **Timing:** Budget ~30-45 min for full verification walkthrough
- **Node version:** Ensure Node.js 18+ available (`node -v`)
- **npm version:** Use npm 8+ (`npm -v`)
- **No special setup:** All tools (npm, node, grep) should already be on PATH
- **Reproducibility:** Each gate is independent; can verify in any order (Gates 1-3 fastest; Gates 4-6 may take longer)

---

## Success Definition

**Phase 4 is verified COMPLETE and publication-ready when:**
1. ✅ All 7 verification gates pass
2. ✅ Sign-off checklist fully completed
3. ✅ No open issues or blockers
4. ✅ Verifier has signed off with name + date

**Next Steps:**
- Phase archive (move to completed milestones)
- Prepare for MVP release (v1.0.0)
- Consider npm publish to staging or production (release pipeline decision, not verification scope)

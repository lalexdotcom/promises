# promises

## What This Is

Une bibliothèque TypeScript zero-dépendance, **correcte et complètement testée**, pour la gestion avancée des promesses : un pool de concurrence (`PromisePool`) avec 4 bugs critiques fixés + 31 tests exhaustifs, et des utilitaires async (`wait`, `timeout`, `unsync`, `slice`). Entièrement documentée (JSDoc + README) et prête pour la publication npm, universelle (Node.js 18+ et browser). La valeur centrale est la **fiabilité et la prévisibilité du contrôle de concurrence**, avec une API correctement typée et une DX optimale.

## Core Value

Un PromisePool qui limite la concurrence de façon fiable, avec des helpers `parallel`/`serial` correctement typés — utilisable sans effort dans tout projet TypeScript.

## Requirements

### Validated (v1.0 — Complete)

- ✓ `PromisePool` interface + `PromisePoolImpl` class avec concurrence configurable — v1.0
- ✓ Lifecycle complet : `start()`, `enqueue()`, `close()`, états `isStarted`/`isClosed`/`isResolved` — v1.0
- ✓ Système d'événements `on()`/`once()` — v1.0
- ✓ Option `rejectOnError` pour contrôler la propagation des erreurs — v1.0
- ✓ Option `verbose` (boolean ou fonction custom) pour le logging — v1.0
- ✓ Option `autoStart` — v1.0
- ✓ `pool.parallel(commands)` — exécute toutes les promesses en parallèle (concurrence infinie) — v1.0
- ✓ `pool.serial(commands)` — exécute toutes les promesses en série (concurrence 1) — v1.0
- ✓ `wait(delay?)` — pause async via setTimeout — v1.0
- ✓ `timeout(promise, delay)` + `TimeoutError` — wrap une promesse avec deadline — v1.0
- ✓ `unsync(fn, delay?)` — exécute une fonction sync de façon asynchrone — v1.0
- ✓ `slice(fn, size?)` — découpe le traitement d'un grand tableau en chunks async — v1.0
- ✓ Build ESM + déclarations TypeScript via Rslib — v1.0
- ✓ **BUG-01** : Garde inversée du timeout dans `runNext()` corrigée — timeout fire correctement — v1.0
- ✓ **BUG-02** : `timeout()` silence les résolutions tardives et propage les rejets correctement — v1.0
- ✓ **BUG-03** : Getter `pending` duplicate supprimé — v1.0
- ✓ **BUG-04** : Événements `'next'` commentés (code mort) supprimés — v1.0
- ✓ **TYPES-01, TYPES-02** : Type inference pour `pool.parallel()` et `pool.serial()` — `Promise<[T1, T2, ...]>` et `Promise<T[]>` — v1.0
- ✓ **TYPES-03** : `any` → `unknown` dans les champs privés ; interface strictement typée — v1.0
- ✓ **TEST-01 à TEST-10** : Suite complète de 31 tests (PromisePool + utils) — tous passing — v1.0
- ✓ **DOCS-01** : README complet avec exemples d'installation, quick start, API tables, scénarios — v1.0
- ✓ **DOCS-02** : JSDoc sur tous les symboles publics (PromisePool, Pool*, TimeoutError, utils) — v1.0
- ✓ **DOCS-03** : Commentaires inline WHY sur scheduler, lifecycle, événements — v1.0
- ✓ **NPM-01** : `package.json` avec metadata complète (description, keywords, homepage, repository, license, author, bugs) — v1.0
- ✓ **NPM-02** : Bundle dual-format (CJS + ESM) avec déclarations TypeScript universelles — v1.0
- ✓ **NPM-03** : Flag `private: true` supprimé — prêt pour `npm publish` — v1.0

### Validated (v1.2 — Complete)

- ✓ `'resolve'` event per-promise (avec valeur de résultat) — v1.2
- ✓ `'error'` event per-promise (au rejet, toujours, avant `rejectOnError`) — v1.2
- ✓ Overloads TypeScript typés pour `on()`/`once()` — Exclude<POOL_EVENT_TYPE>, `'resolve'`, `'error'` — v1.2
- ✓ `on()`/`once()` retournent une fonction d'unsubscribe `() => void` — v1.2
- ✓ 7 getters O(1) : `runningCount`, `waitingCount`, `pendingCount`, `settledCount`, `resolvedCount`, `rejectedCount`, `concurrency` — v1.2
- ✓ `TimeoutError.timeout` et `TimeoutError.promise` — champs de debug — v1.2
- ✓ Cleanup explicite des listeners à la résolution (`#listeners.clear()`) — v1.2
- ✓ Instrumentation de métriques (`eventCount`, `performance.now()`) — v1.2
- ✓ 74 tests de cas limites (boundary, malformed input, lifecycle rapide, error propagation, patterns avancés) — v1.2
- ✓ TypeScript strict mode — zéro erreur `tsc --noEmit` — v1.2
- ✓ 5 patterns avancés documentés (Backpressure, Error events, Timeout, Introspection, Pipeline) — v1.2

### Active (v1.2 — À planifier)

**Features à explorer :**
- AsyncIterator / Stream API — DX research nécessaire
- Retry strategies intégrées — pour l'instant les utilisateurs re-enqueuent manuellement
- Batch result streaming — après AsyncIterator
- Plugin / middleware system — priorité basse, API simple à préserver

### Out of Scope

- AsyncIterator / stream de résultats pour le pool générique — complexité DX non justifiée pour v1.0 ; envisager en v2
- Publication npm effective — l'auteur gère son propre pipeline de release
- Git tags / versioning automatisé — idem, pipeline externe
- CHANGELOG — pas demandé pour ce milestone
- CJS build — ESM only, conforme à la cible Node 18+ / browser moderne

## Context

**Codebase après v1.2 :**
- `src/pool.ts` (~520 lignes) : `PromisePoolImpl` avec événements typés, 7 getters, unsubscribe, cleanup listeners, métriques
- `src/utils.ts` (~69 lignes) : 5 utilitaires async + `TimeoutError` (avec champs `timeout` et `promise`)
- `src/index.ts` : barrel export complet
- `tests/index.test.ts` : ~65 tests (lifecycle, concurrence, événements, erreurs, timeouts, type-level)
- `tests/utils.test.ts` : 10 tests (wait, timeout, unsync, slice)
- `tests/TEST-11` à `TEST-18` : 6 fichiers de tests spécialisés (90+ tests)
- **Total : 156 tests, tous passing**

**Stack :**
- TypeScript 5.9 strict mode, Rslib (ESM), Rstest, Biome, pnpm
- Zéro dépendance runtime intentionnel

---
*Last updated: 2026-03-24 after v1.2 milestone*

**Build :**
- Dual-format: CJS + ESM avec déclarations TypeScript universelles
- Tested: Node.js 18+, verified browser-compatible (no Node APIs used)
- Metrics: 31 tests passing, npm publish --dry-run successful

## Constraints

- **Runtime cible** : Node.js 18+ et browser moderne — APIs limitées aux globals universels (`setTimeout`, `Promise`, `console`)
- **Zéro dépendance runtime** : aucune dépendance dans `dependencies` (seulement `devDependencies`)
- **Tooling** : Rstest pour les tests (pas Vitest, pas Jest), Biome pour lint/format
- **Publish** : Pas de publication npm ni de tag git dans ce projet — pipeline externe

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ESM only (pas CJS) | Cible Node 18+ et browser moderne, conforme à `"type": "module"` | ✓ Good — dual-format build output avec shared types declarations |
| Garder l'API `pool.close()` existante | Pas de breaking change — correction de bugs uniquement | ✓ Good — tous les bugs visibles fixés sans API change |
| Types inférés via overloads/conditionnel pour parallel/serial | Même pattern que `Promise.all` — tuple pour hétérogène, T[] pour homogène | ✓ Good — TypeScript inference works as expected, tests pass |
| Pas d'AsyncIterator en v1 | DX à préciser, risque de design sous-optimal — défer pour v2 | ✓ Good — scope maîtrisé, v1.0 successful |
| Focus bug fixes + tests + docs pour v1.0 | Atteindre publication-ready state avant features additionnelles | ✓ Good — tous bugs resolved, 31 tests passing, full documentation, npm-ready |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-03-24 after v1.0 milestone completion and v1.2 milestone planning*

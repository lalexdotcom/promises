# promises

## What This Is

Une bibliothèque TypeScript zero-dépendance pour la gestion avancée des promesses : un pool de concurrence (`PromisePool`), et des utilitaires async (`wait`, `timeout`, `unsync`, `slice`). Destinée à être publiée sur npm, universelle (Node.js 18+ et browser). La valeur centrale est la fiabilité et la prévisibilité du contrôle de concurrence, avec une API typée et une DX optimale.

## Core Value

Un PromisePool qui limite la concurrence de façon fiable, avec des helpers `parallel`/`serial` correctement typés — utilisable sans effort dans tout projet TypeScript.

## Requirements

### Validated

- ✓ `PromisePool` interface + `PromisePoolImpl` class avec concurrence configurable — existing
- ✓ Lifecycle complet : `start()`, `enqueue()`, `close()`, états `isStarted`/`isClosed`/`isResolved` — existing
- ✓ Système d'événements `on()`/`once()` — existing
- ✓ Option `rejectOnError` pour contrôler la propagation des erreurs — existing
- ✓ Option `verbose` (boolean ou fonction custom) pour le logging — existing
- ✓ Option `autoStart` — existing
- ✓ `pool.parallel(commands)` — exécute toutes les promesses en parallèle (concurrence infinie) — existing
- ✓ `pool.serial(commands)` — exécute toutes les promesses en série (concurrence 1) — existing
- ✓ `wait(delay?)` — pause async via setTimeout — existing
- ✓ `timeout(promise, delay)` + `TimeoutError` — wrap une promesse avec deadline — existing
- ✓ `unsync(fn, delay?)` — exécute une fonction sync de façon asynchrone — existing
- ✓ `slice(fn, size?)` — découpe le traitement d'un grand tableau en chunks async — existing
- ✓ Build ESM + déclarations TypeScript via Rslib — existing

### Active

- [ ] **BUG-01** : Corriger la garde inversée du timeout dans `runNext()` (`Number.isNaN(timeout) && timeout > 0` → `!Number.isNaN(timeout) && timeout > 0`)
- [ ] **BUG-02** : Corriger `timeout()` dans utils — ne pas appeler `rej()` sans argument sur résolution tardive ; ajouter `.catch()` pour les rejets du promise wrappé
- [ ] **TEST-01** : Suite de tests exhaustive avec rstest couvrant tous les comportements de `PromisePool` (concurrence, lifecycle, événements, erreurs, timeouts) et tous les utilitaires
- [ ] **TYPES-01** : `pool.parallel()` et `pool.serial()` retournent des tableaux correctement typés — inférence `Promise<[R1, R2, ...]>` pour les tuples hétérogènes, `Promise<T[]>` pour les tableaux homogènes
- [ ] **DOCS-01** : README complet avec exemples d'usage pour chaque fonctionnalité
- [ ] **DOCS-02** : JSDoc sur toutes les fonctions, méthodes et types publics
- [ ] **DOCS-03** : Commentaires inline sur la logique complexe (scheduler `runNext()`, machine à états lifecycle)
- [ ] **NPM-01** : `package.json` propre pour la publication (description, keywords, homepage, repository, license, author, supprimer `private: true`)
- [ ] **NPM-02** : Bundle universel Node.js + browser (vérifier les exports, les targets de build, la taille)
- [ ] **NPM-03** : Retirer `private: true` du `package.json`

### Out of Scope

- AsyncIterator / stream de résultats pour le pool générique — complexité DX non justifiée pour ce milestone ; envisager en v2
- Publication npm effective — l'auteur gère son propre pipeline de release
- Git tags / versioning automatisé — idem, pipeline externe
- CHANGELOG — pas demandé pour ce milestone
- CJS build — ESM only, conforme à la cible Node 18+ / browser moderne

## Context

**Codebase actuelle :**
- `src/pool.ts` (~264 lignes) : `PromisePoolImpl` avec champs privés ES2022, scheduler `runNext()`, système d'événements interne
- `src/utils.ts` (~69 lignes) : 5 utilitaires async standalone
- `src/index.ts` : barrel re-export
- `tests/index.test.ts` : 1 test placeholder cassé (importe `squared` inexistant)

**Bugs connus documentés dans `.planning/codebase/CONCERNS.md` :**
- Garde inversée dans `runNext()` rend le timeout des promesses inopérant
- `timeout()` peut appeler `rej()` sans raison + ne gère pas les rejets du promise source
- Le test existant échoue immédiatement (import `squared` inexistant)
- Getter `pending` duplique `waiting` sans être dans l'interface
- 2 événements `'next'` commentés (code mort)

**Stack :**
- TypeScript 5.9, Rslib (ESM), Rstest, Biome, pnpm
- Zéro dépendance runtime intentionnel

## Constraints

- **Runtime cible** : Node.js 18+ et browser moderne — APIs limitées aux globals universels (`setTimeout`, `Promise`, `console`)
- **Zéro dépendance runtime** : aucune dépendance dans `dependencies` (seulement `devDependencies`)
- **Tooling** : Rstest pour les tests (pas Vitest, pas Jest), Biome pour lint/format
- **Publish** : Pas de publication npm ni de tag git dans ce projet — pipeline externe

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ESM only (pas CJS) | Cible Node 18+ et browser moderne, conforme à `"type": "module"` | — Pending |
| Garder l'API `pool.close()` existante | Pas de breaking change — correction de bugs uniquement | — Pending |
| Types inférés via overloads/conditionnel pour parallel/serial | Même pattern que `Promise.all` — tuple pour hétérogène, T[] pour homogène | — Pending |
| Pas d'AsyncIterator en v1 | DX à préciser, risque de design sous-optimal — défer pour v2 | — Pending |

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
*Last updated: 2026-03-23 after initialization*

# RETROSPECTIVE — promises

---

## Milestone: v1.1 — Balanced Enhancements

**Shipped:** 2026-03-24  
**Phases:** 5 (phases 5–9) | **Plans:** 5 | **Tests:** 156 passing (82 → 156)

### What Was Built

- Event-driven API étendu : `'resolve'` et `'error'` par promesse, avec overloads TypeScript typés et `Exclude<POOL_EVENT_TYPE>` pour le système générique vs spécialisé
- `on()` et `once()` retournent une fonction d'unsubscribe `() => void`
- 7 getters d'introspection O(1) pour monitoring de l'état du pool en temps réel
- `TimeoutError` enrichi avec `timeout` (durée) et `promise` (contexte) pour le débogage
- Cleanup automatique des listeners à la résolution + instrumentation de métriques
- 74 tests de cas limites portant la suite à 156 tests, TypeScript strict mode validé
- 5 patterns avancés documentés dans README

### What Worked

- **Phases atomiques bien délimitées** : chaque phase avait un objectif unique — peu de débordement de scope
- **Quick tasks pour itérations post-release** : les 3 quick tasks (overloads, Exclude, unsubscribe) permettent d'affiner l'API sans rouvrir un milestone complet
- **tsc --noEmit comme gate de qualité** : exécuté après chaque modification, a évité des regressions de types silencieuses
- **Overloads avec signature générique d'implémentation** : `on(type: POOL_EVENT_TYPE, cb: (...args: any[]) => void)` permet aux surcharges typées d'exister sans friction avec le code interne

### What Was Inefficient

- **Génération de tests avec paramètre `timeout` dans le mauvais argument** (Phase 9 SubAgent) : a nécessité des corrections manuelles dans 9 localisations après coup
- **PoolEventContext créé puis supprimé** : l'interface a été ajoutée (Phase 5) puis retirée (quick task), représentant du travail inutile — une discussion préalable sur la stratégie event context aurait évité ça
- **Les quick tasks se succèdent rapidement** : 3 itérations sur la même API en une session — signe que la conception initiale des overloads n'était pas assez réfléchie

### Patterns Established

- **`Exclude<POOL_EVENT_TYPE, 'resolve' | 'error'>` pour les événements génériques** : s'adapte automatiquement si de nouveaux événements de lifecycle sont ajoutés
- **Unsubscribe retourné par `on()`/`once()`** : `() => this.#listeners[type]?.delete(cb)` — fermeture sur la référence du callback, compatible avec la suppression-en-iterating de Map
- **Signatures d'implémentation génériques sous overloads typées** : pattern stable pour les méthodes overloaded qui doivent rester internes

### Key Lessons

- Définir le contrat d'événements AVANT d'implémenter : resolve/error callback signatures, présence/absence de contexte, return type de `on()`
- Les types `context` dans les événements créent un couplage fort — préférer les getters sur l'objet principal
- 156 tests est une bonne base ; maintenir le ratio test/feature lors des prochains milestones

### Cost Observations

- Toutes les phases exécutées dans une seule session
- Quick tasks : 3 itérations post-release en ~2 heures

---

## Cross-Milestone Trends

| Milestone | Tests | LOC (src) | Phases | Duration |
|-----------|-------|-----------|--------|----------|
| v1.0      | 31    | ~333      | 4      | 1 day    |
| v1.1      | 156   | ~520      | 5+3qt  | 1 day    |

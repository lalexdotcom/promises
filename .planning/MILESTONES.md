# Milestones

## v1.2 Balanced Enhancements (Shipped: 2026-03-24)

**Phases completed:** 5 phases (phases 5–9), 5 plans, 156 tests passing

**Key accomplishments:**

- Phase 5: Système d'événements étendu — `'resolve'` (par promesse avec résultat) et `'error'` (par promesse au rejet) ajoutés à `POOL_EVENT_TYPE`, avec overloads TypeScript typés et callbacks de désabonnement (`on()`/`once()` retournent `() => void`)
- Phase 6: 7 getters d'introspection O(1) — `runningCount`, `waitingCount`, `pendingCount`, `settledCount`, `resolvedCount`, `rejectedCount`, `concurrency` pour monitoring en temps réel
- Phase 7: `TimeoutError` enrichi avec champs `timeout: number` et `promise: unknown` pour le débogage
- Phase 8: Cleanup explicite des listeners à la résolution du pool, instrumentation de métriques (`#metrics`, `performance.now()`)
- Phase 9: 74 nouveaux tests de cas limites, 5 patterns avancés documentés dans README, validation TypeScript strict mode
- +3 quick tasks post-release : overloads typés `on()`/`once()`, `Exclude<POOL_EVENT_TYPE>`, retour de fonction unsubscribe

---

## v1.0 Publication-Ready Library (Shipped: 2026-03-24)

**Phases completed:** 4 phases, 6 plans, 7 tasks

**Key accomplishments:**

- `src/pool.ts`
- All exported symbols JSDoc-documented with typed parameters and defaults; complete README enables a new user to evaluate and integrate the library without reading source code.
- Date:

---

# ROADMAP — promises

## Milestones

- ✅ **v1.0 — Publication-Ready Library** ([Archived](milestones/v1.0-ROADMAP.md)) — Shipped 2026-03-24
- ✅ **v1.1 — Balanced Enhancements** ([Archived](milestones/v1.1-ROADMAP.md)) — Shipped 2026-03-24
- 📋 **v1.2 — (Planned)**

---

<details>
<summary>✅ v1.1 — Balanced Enhancements (Phases 5–9) — SHIPPED 2026-03-24</summary>

- [x] Phase 5: Event-Driven Pool — `'resolve'` & `'error'` events per-promise (1 plan)
- [x] Phase 6: Pool Introspection — 7 read-only getters + counters (1 plan)
- [x] Phase 7: Timeout Enhancements — `TimeoutError` with `timeout` & `promise` fields (1 plan)
- [x] Phase 8: Performance & Memory Audit — listener cleanup, metrics instrumentation (1 plan)
- [x] Phase 9: Edge Cases & Polish — 74 new tests, 5 advanced patterns, strict mode (1 plan)

</details>

---

## v1.2 Phases

*(Planning not yet started — define scope with `/gsd-new-milestone`)*

### Deferred to v1.2+

- AsyncIterator / Stream API — DX research needed for async iteration patterns
- Retry strategies — Users can re-enqueue failed tasks for now
- Batch result streaming — Revisit after AsyncIterator design
- Plugin/middleware system — Maintain simplicity, low demand

---

**Updated:** 2026-03-24 — v1.1 milestone archived, ready for v1.2 planning

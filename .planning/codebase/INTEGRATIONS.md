# INTEGRATIONS.md — External Services & APIs

## External APIs

**None.** The library has no external API calls, HTTP clients, or network dependencies.

## Databases

**None.** No database drivers, ORMs, or storage layers.

## Authentication Providers

**None.** No auth integrations.

## Cloud / Infrastructure

**None.** No cloud SDK, serverless infrastructure, or platform-specific code.

## Operating System Integration

The library uses standard Node.js globals only:

| API | Usage | Location |
|-----|-------|----------|
| `setTimeout` | Delay, timeout, unsync, slice | `src/utils.ts` |
| `clearTimeout` | Cancel pending timers in `timeout()` | `src/utils.ts` |
| `console.debug/info/warn/error` | Verbose logging in pool | `src/pool.ts` |
| `Promise` | Core semantics throughout | `src/pool.ts`, `src/utils.ts` |

No file system, network, or process-level APIs are used.

## Summary

This is an isolated, self-contained utility library. It intentionally depends only on JavaScript/Node.js built-ins, making it portable across any Node.js 18+ environment with no external integration risk.

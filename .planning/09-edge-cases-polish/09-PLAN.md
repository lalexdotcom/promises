---
phase: 09-edge-cases-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [tests/index.test.ts, tests/utils.test.ts, src/pool.ts, README.md, tsconfig.json]
autonomous: true
requirements: [QA-01, QA-02, QA-03, DOC-01, DOC-02]

must_haves:
  truths:
    - "Pool handles concurrency limits from 1 to Infinity without crashing"
    - "Invalid inputs (null, NaN, negative) are rejected or converted gracefully"
    - "State machine remains consistent under rapid transitions"
    - "Error events contain full context at rejection time"
    - "Advanced patterns (retry, timeout+fallback, monitoring) are documented with working code"
    - "TypeScript strict mode passes with zero errors"
    - "Test suite covers 135+ tests (70 existing + 65 new)"
  artifacts:
    - path: "tests/index.test.ts"
      provides: "Core pool tests (TEST-01 through TEST-12)"
      min_lines: 600
    - path: "tests/TEST-13-boundary-conditions.ts"
      provides: "18 boundary condition tests (concurrency, timeout, volume extremes)"
      min_lines: 250
    - path: "tests/TEST-14-malformed-input.ts"
      provides: "12 malformed input tests (null, NaN, type coercion, invalid event listeners)"
      min_lines: 200
    - path: "tests/TEST-15-rapid-lifecycle.ts"
      provides: "10 rapid lifecycle tests (start→close, back-to-back enqueues, race conditions)"
      min_lines: 180
    - path: "tests/TEST-16-error-propagation.ts"
      provides: "10 error propagation & event ordering tests (context accuracy, event sequences)"
      min_lines: 180
    - path: "tests/TEST-17-counter-invariants.ts"
      provides: "9 counter getter invariant tests (state transitions, accuracy)"
      min_lines: 150
    - path: "tests/TEST-18-advanced-patterns.ts"
      provides: "6 advanced pattern tests (retry, timeout+fallback, monitoring, mixed sync/async)"
      min_lines: 200
    - path: "README.md"
      provides: "Advanced Patterns section (5+ patterns, ~200-250 lines)"
      contains: "Advanced Patterns"
  key_links:
    - from: "tests/"
      to: "src/pool.ts"
      via: "import { pool, timeout, TimeoutError }"
      pattern: "describe.*test.*pool\\(\\.+expect\\("
    - from: "README.md"
      to: "tests/TEST-13 through TEST-18.ts"
      via: "code examples in patterns section"
      pattern: "pool\\(.*enqueue.*close\\("
    - from: "src/pool.ts"
      to: "tsconfig.json --strict"
      via: "type validation"
      pattern: "tsc --strict --noEmit"
---

<objective>
Phase 9 expands the test suite from 70 to 135+ tests and finalizes documentation for release.

**Scope:** 65 new test cases across 6 test suites (TEST-13 through TEST-18) + Advanced Patterns documentation + TypeScript strict mode validation.

**Implementation:** Break tests into waves—test file setup (Wave 1), concurrent test implementation (Wave 2), documentation & validation (Wave 3).

**Purpose:** 
- Catch edge cases and state machine bugs via boundary and rapid-lifecycle tests
- Validate graceful error handling for malformed inputs
- Document real-world patterns (retry, monitoring, composition) that extend Phase 7 examples
- Ensure TypeScript strict mode compliance for type safety

**Output:** 
- 7 new test files + updates to index.test.ts (TEST-13 through TEST-18)
- Advanced Patterns section in README with 5+ working code examples
- Zero TypeScript strict mode errors
- 135+ passing tests, ready for v1.2 release
</objective>

<execution_context>
@.github/get-shit-done/workflows/execute-plan.md
@.planning/09-edge-cases-polish/09-CONTEXT.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/08-performance-optimization/08-SUMMARY.md
</context>

<interfaces>
Key types and contracts from Phase 8:

From src/pool.ts:
```typescript
export interface PromisePool {
  readonly promise: Promise<unknown[]>;
  readonly running: number;
  readonly waiting: number;
  readonly pendingCount: number;
  readonly isStarted: boolean;
  readonly isClosed: boolean;
  readonly isResolved: boolean;
  readonly concurrency: number;
  readonly runningCount: number;
  readonly waitingCount: number;
  readonly settledCount: number;
  readonly resolvedCount: number;
  readonly rejectedCount: number;
  
  enqueue(generator: PromiseFunction): void;
  start(): void;
  close(): Promise<unknown[]>;
  on(event: POOL_EVENT_TYPE, listener: (...args: unknown[]) => void): void;
  off(event: POOL_EVENT_TYPE, listener?: (...args: unknown[]) => void): void;
}

export interface PoolEventContext {
  runningCount: number;
  waitingCount: number;
  pendingCount: number;
  isStarted: boolean;
  isClosed: boolean;
  isResolved: boolean;
}

export class TimeoutError extends Error {
  constructor(message: string, timeout?: number, promise?: unknown);
  readonly timeout?: number;
  readonly promise?: unknown;
}
```

Test utilities available:
```typescript
import { pool, timeout, TimeoutError, wait } from '../src/index';
// wait(ms): Returns Promise resolving after ms
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create TEST-13 test file scaffold for boundary conditions</name>
  <files>tests/TEST-13-boundary-conditions.ts</files>
  <action>
Create new test file `tests/TEST-13-boundary-conditions.ts` with concurrency and timeout boundary test structure.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, timeout, TimeoutError, wait } from '../src/index';

describe('TEST-13: Boundary Conditions (Concurrency, Timeout, Volume)', () => {
  // Concurrency boundaries: 1, 10, 100, 1000, Infinity
  describe('Concurrency Boundaries', () => {
    // Tests here: serial (1), default (10), high (100), very high (1000), unlimited (Infinity)
  });

  // Timeout boundaries: 0, 1, 10000, MAX_SAFE_INTEGER
  describe('Timeout Boundaries', () => {
    // Tests here: immediate, very fast, reasonable, essentially infinite
  });

  // Volume boundaries: 0, 1, 10, 10000 at various concurrencies
  describe('Enqueue Volume Boundaries', () => {
    // Tests here by concurrency level
  });
});
```

Placeholder tests only (using expect.todo() or commented structure).
  </action>
  <verify>File exists, structure compiles, no test failures (file has only structure, no assertions)</verify>
  <done>TEST-13 file created with test structure ready for implementation</done>
</task>

<task type="auto">
  <name>Task 2: Create TEST-14 test file scaffold for malformed input</name>
  <files>tests/TEST-14-malformed-input.ts</files>
  <action>
Create new test file `tests/TEST-14-malformed-input.ts` for malformed input validation tests.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, TimeoutError, wait } from '../src/index';

describe('TEST-14: Malformed Input Handling', () => {
  describe('PoolOptions Malformed', () => {
    // null concurrency, undefined concurrency, NaN concurrency
    // string concurrency, object concurrency
    // type coercion for rejectOnError, autoStart
  });

  describe('Enqueue Malformed', () => {
    // null function, undefined function, non-function (42, string)
    // function returning non-Promise
  });

  describe('Event Listener Malformed', () => {
    // null event type, invalid event name
    // null callback
  });
});
```

Placeholder structure only.
  </action>
  <verify>File exists, structure compiles, no test failures</verify>
  <done>TEST-14 file created with test structure</done>
</task>

<task type="auto">
  <name>Task 3: Create TEST-15 test file scaffold for rapid lifecycle</name>
  <files>tests/TEST-15-rapid-lifecycle.ts</files>
  <action>
Create new test file `tests/TEST-15-rapid-lifecycle.ts` for rapid state machine transition tests.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-15: Rapid Lifecycle Transitions', () => {
  describe('Start to Close Races', () => {
    // start() → close() with no work
    // start() → close() with work in progress
  });

  describe('Enqueue Before/After State Changes', () => {
    // multiple enqueues before start
    // enqueues before close
    // enqueue after close (error)
  });

  describe('Concurrent Operations', () => {
    // concurrent enqueue + close
    // rapid start/close cycles
  });

  describe('State Flag Consistency', () => {
    // synchronous state checks
    // verify no missed transitions
  });
});
```

Placeholder structure only.
  </action>
  <verify>File exists, structure compiles, no test failures</verify>
  <done>TEST-15 file created with test structure</done>
</task>

<task type="auto">
  <name>Task 4: Create TEST-16 test file scaffold for error propagation</name>
  <files>tests/TEST-16-error-propagation.ts</files>
  <action>
Create new test file `tests/TEST-16-error-propagation.ts` for error event ordering and context tests.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, PoolError, wait } from '../src/index';

describe('TEST-16: Error Propagation & Event Ordering', () => {
  describe('Error Event Context', () => {
    // verify runningCount, waitingCount at rejection time
    // verify pool state flags in context
  });

  describe('Event Ordering', () => {
    // error event fires before next
    // multiple errors maintain order
  });

  describe('Event Filtering', () => {
    // rejectOnError=true stops further events
    // rejectOnError=false continues
  });
});
```

Placeholder structure only.
  </action>
  <verify>File exists, structure compiles, no test failures</verify>
  <done>TEST-16 file created with test structure</done>
</task>

<task type="auto">
  <name>Task 5: Create TEST-17 test file scaffold for counter invariants</name>
  <files>tests/TEST-17-counter-invariants.ts</files>
  <action>
Create new test file `tests/TEST-17-counter-invariants.ts` for counter getter validation tests.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, wait } from '../src/index';

describe('TEST-17: Counter Getter Invariants', () => {
  describe('State Transition Invariants', () => {
    // runningCount + waitingCount + settledCount = totalEnqueued
    // resolvedCount + rejectedCount = settledCount
  });

  describe('Getter Accuracy', () => {
    // verify exact counts at each lifecycle point
    // spot checks during execution
  });

  describe('Concurrency Bounds', () => {
    // runningCount <= concurrency
    // waitingCount = enqueued - running - settled
  });
});
```

Placeholder structure only.
  </action>
  <verify>File exists, structure compiles, no test failures</verify>
  <done>TEST-17 file created with test structure</done>
</task>

<task type="auto">
  <name>Task 6: Create TEST-18 test file scaffold for advanced patterns</name>
  <files>tests/TEST-18-advanced-patterns.ts</files>
  <action>
Create new test file `tests/TEST-18-advanced-patterns.ts` for pattern integration tests.

**File structure:**
```typescript
import { describe, expect, test } from '@rstest/core';
import { pool, timeout, TimeoutError, wait } from '../src/index';

describe('TEST-18: Advanced Patterns (Integration)', () => {
  describe('Retry Pattern', () => {
    // manual retry with max attempts
    // exponential backoff validation
  });

  describe('Timeout with Fallback', () => {
    // timeout() wrapper + catch fallback
    // pool timeout + per-task timeout composition
  });

  describe('Monitoring & Progress Tracking', () => {
    // track pendingCount during execution
    // verify counters for dashboard use case
  });

  describe('Mixed Sync/Async Execution', () => {
    // wrap sync work, mix with async
    // verify execution order
  });
});
```

Placeholder structure only.
  </action>
  <verify>File exists, structure compiles, no test failures</verify>
  <done>TEST-18 file created with test structure</done>
</task>

<task type="auto">
  <name>Task 7: Implement TEST-13 boundary conditions - concurrency extremes</name>
  <files>tests/TEST-13-boundary-conditions.ts</files>
  <action>
Implement 18 boundary condition tests in TEST-13 across concurrency, timeout, and volume.

**Test breakdown (18 tests):**

**Concurrency Boundaries (6 tests):**
1. `concurrency=1` (serial): enqueue 3 tasks, verify sequential execution (total time ≥ 3×40ms)
2. `concurrency=10` (default): enqueue 20 tasks, verify 10 parallel slots used (count reaches 10)
3. `concurrency=100`: enqueue 120 tasks, verify max 100 concurrent (never >100 running)
4. `concurrency=1000`: enqueue 5000 tasks, verify O(1) scheduling (no stack overflow, completes)
5. `concurrency=Infinity` (unlimited): enqueue 1000 tasks, verify all run concurrently (instant completion)
6. `concurrency=0 or -1` (invalid): pool should default to 1 or error gracefully with clear message

**Timeout Boundaries (6 tests):**
1. `timeout=0` (immediate): tasks should timeout immediately (TimeoutError raised immediately)
2. `timeout=1` (1ms): task taking 50ms should timeout
3. `timeout=10000` (10s): tasks under 50ms should complete, no timeout
4. `timeout=Number.MAX_SAFE_INTEGER`: effectively infinite, all tasks complete
5. `timeout=-1` (invalid): should be ignored or error gracefully
6. `timeout=NaN` (invalid): should be ignored or error gracefully

**Volume Boundaries (6 tests):**
1. 0 promises enqueued: `close()` resolves immediately with `[]`
2. 1 promise enqueued at concurrency=1: executes, no deadlock
3. 10 promises at concurrency=1: all execute sequentially
4. 1000 promises at concurrency=10: all complete without memory issues
5. Mix concurrency=2 with tasks taking 0ms: verify scheduling doesn't skip tasks
6. Very large timeout (100000ms) with queue of 1000: confirms no timeout == completion

**Validation approach:**
- Use `maxRunning` counter to track actual concurrency
- Use timing assertions (`Date.now()`) for serial/parallel validation
- For invalid inputs, document expected behavior (error, default, or ignore)
- All tests must be deterministic and fast (<500ms each)
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-13" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>18 boundary condition tests passing, all edge cases covered (D1 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 8: Implement TEST-14 malformed input validation</name>
  <files>tests/TEST-14-malformed-input.ts</files>
  <action>
Implement 12 malformed input tests in TEST-14 across PoolOptions, enqueue, and event listeners.

**Test breakdown (12 tests):**

**PoolOptions Malformed (6 tests):**
1. `{ concurrency: null }`: should default to 10 or error — test behavior is consistent
2. `{ concurrency: undefined }`: should default to 10 (already typed optional)
3. `{ concurrency: NaN }`: should default to 10 or error gracefully
4. `{ concurrency: "10" }` (string): should error (type mismatch) or coerce to 10
5. `{ rejectOnError: "yes" }` (string vs boolean): should error or coerce gracefully
6. `{ autoStart: 1 }` (number vs boolean): should error or coerce gracefully

**Enqueue Malformed (3 tests):**
1. `enqueue(null)`: should throw or error (cannot call null)
2. `enqueue(undefined)`: should throw or error
3. `enqueue(42)` (non-function): should throw or error
4. `enqueue(() => 42)` (returns non-Promise): should handle gracefully (wraps result or errors)

**Event Listeners Malformed (3 tests):**
1. `on("unknown-event", callback)`: should error or no-op (invalid event type)
2. `on(null, callback)`: should throw (invalid event type)
3. `on("resolve", null)` (null callback): should throw or error

**Validation approach:**
- For each malformed input, document expected behavior (throw, default, coerce, ignore)
- if behavior is "throw": use expect(() => fn()).toThrow()
- If behavior is "default": verify default is applied (e.g., concurrency defaults to 10)
- All tests must complete without crashes, even if input is invalid
- Add JSDoc comment documenting which inputs are validated vs. which use defaults
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-14" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>12 malformed input tests passing, all error cases covered (D2 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 9: Implement TEST-15 rapid lifecycle state machine</name>
  <files>tests/TEST-15-rapid-lifecycle.ts</files>
  <action>
Implement 10 rapid lifecycle tests in TEST-15 validating state machine consistency.

**Test breakdown (10 tests):**

**Start to Close Races (2 tests):**
1. `start() → close()` with no work: 
   - Synchronously call start(), then close()
   - Verify both succeed, result is `[]`
   - All state flags transition correctly (isStarted → isClosed → isResolved)
2. `start() → close()` while task executing:
   - Enqueue 1 long task, start(), close() before task settles
   - Task still executes and completes
   - No race condition or crash

**Enqueue Before/After State Changes (3 tests):**
1. Multiple enqueues before start:
   - Enqueue 5 tasks, enqueue 5 more immediately, then start()
   - Verify all 10 execute in order (no dropped tasks)
2. Enqueue immediately before close:
   - Enqueue task 1, synchronously enqueue task 2, close()
   - Verify both execute (task 2 not dropped during close)
3. Enqueue after close:
   - close() → enqueue(...)
   - Expect error or no-op (clear that pool is closed)

**Concurrent Operations (3 tests):**
1. Close called twice:
   - `close() → close()` again
   - Second should be idempotent (return same promise or error clearly)
2. Start after close:
   - `close() → start()`
   - Should error or no-op (pool is closed)
3. Rapid start/close cycles:
   - Create pool, start/close, create new pool, repeat 10× rapidly
   - Verify no state bleeding between pools, no memory leaks

**State Flag Consistency (2 tests):**
1. Synchronous flag checks:
   - Enqueue, check isStarted (microtask not run yet), verify false
   - Start, synchronously check, verify updates after microtask
2. Verify no missed transitions:
   - Track state through full lifecycle, verify all flags set exactly once
   - isStarted never reverts to false

**Validation approach:**
- Use synchronous expects where possible to test microtask timing
- Document assumptions about timing (e.g., "isStarted is async after start()")
- All tests must complete deterministically without flakiness
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-15" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>10 rapid lifecycle tests passing, state machine validated (D3 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 10: Implement TEST-16 error propagation and event ordering</name>
  <files>tests/TEST-16-error-propagation.ts</files>
  <action>
Implement 10 error propagation and event ordering tests in TEST-16.

**Test breakdown (10 tests):**

**Error Event Context (3 tests):**
1. Error event context contains accurate runningCount:
   - Enqueue 5 tasks (concurrency=2), one fails
   - Verify error event has runningCount=1 (one task failed, others running)
2. Error event context contains accurate waitingCount:
   - Enqueue 10 tasks (concurrency=2), one fails on 3rd task
   - Verify error context has waitingCount=7 (10 - 2 running - 1 failing)
3. Error event context has all pool state flags:
   - Verify error event context includes isStarted, isClosed, isResolved
   - All flags must be accurate at rejection time (isStarted=true, isClosed=false until close())

**Event Ordering (4 tests):**
1. Error event fires before 'next' event:
   - Enqueue task 1 (fails), task 2
   - Track event order: error, next (next picks up task 2 after failure)
   - Verify no 'next' before first error event
2. Multiple errors maintain order:
   - Enqueue 5 tasks, 3 fail at positions 0, 2, 4
   - Error events fire in order (0, 2, 4)
   - Results maintain order (error at 0, success at 1, error at 2)
3. Resolve events fire for successful tasks:
   - Enqueue 3 tasks (concurrency=1), all succeed
   - Verify 3 resolve events fire with correct results
4. Mixed resolve/error events:
   - Enqueue 4 tasks (1 fail, 1 succeed, 1 fail, 1 succeed)
   - Verify resolve and error events fire in correct order

**Event Filtering (2 tests):**
1. rejectOnError=true stops further events:
   - Set rejectOnError=true, enqueue 5 tasks, task 1 fails
   - Pool rejects immediately
   - Verify no 'next', 'resolve', or additional 'error' events after rejection
   - Remaining tasks (2-5) don't execute
2. rejectOnError=false continues execution and events:
   - Set rejectOnError=false, enqueue 5 tasks, task 1 fails
   - Verify error event fires, but pool continues
   - Verify 'next' event fires to start task 2
   - All 5 tasks execute, results contain error at index 0, values at 1-4

**Event Listener Deregistration (1 test):**
1. `off()` unregisters listener:
   - Register listener A, call listener, count=1
   - Call `off(event, A)`, trigger event again
   - Verify listener doesn't fire, count stays 1

**Validation approach:**
- Use event tracking array to log event order and context
- For each test, assert event order, context values, and execution state
- Verify events fire synchronously (in microtask, not async)
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-16" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>10 error propagation tests passing, event ordering validated (D2 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 11: Implement TEST-17 counter getter invariants</name>
  <files>tests/TEST-17-counter-invariants.ts</files>
  <action>
Implement 9 counter getter invariant tests in TEST-17 validating state transitions.

**Test breakdown (9 tests):**

**State Transition Invariants (3 tests):**
1. runningCount + waitingCount + settledCount = totalEnqueued:
   - Enqueue 10 tasks (concurrency=2), check invariant at multiple points
   - At start: running=2, waiting=8, settled=0 → 2+8+0=10 ✓
   - Mid-execution: running=2, waiting=5, settled=3 → 2+5+3=10 ✓
   - End: running=0, waiting=0, settled=10 → 0+0+10=10 ✓
2. resolvedCount + rejectedCount = settledCount:
   - Enqueue 10 tasks (1 fails, 9 succeed), check invariant throughout
   - At end: resolved=9, rejected=1 → 9+1=10 ✓
3. runningCount ≤ concurrency:
   - Set concurrency=5, enqueue 100 tasks
   - At every point in execution, runningCount ≤ 5 (enforce via maxRunning counter)

**Getter Accuracy (4 tests):**
1. runningCount tracks in-flight promises exactly:
   - Enqueue 3 tasks at concurrency=1 (each 50ms)
   - After microtask: running=1, waiting=2
   - After 50ms: running=1 (next task started), waiting=1 (once settled)
   - Verify counts match actual in-flight tasks
2. waitingCount decreases as tasks start:
   - Enqueue 5 tasks at concurrency=2
   - Initial: waiting=5
   - After start: waiting=3 (2 started)
   - After first settles: waiting=3, running=2 (next task started)
3. settledCount increases as tasks finish:
   - Enqueue 5 tasks at concurrency=2
   - Start non-zero: settled=0
   - After first 2 finish: settled=2
   - After all finish: settled=5
4. Counter getters are O(1):
   - Verify getter calls return instantly (no iteration of queue)
   - Test with 10000 tasks (should complete in <1ms)

**Concurrency Bounds (2 tests):**
1. pendingCount = runningCount + waitingCount:
   - At each checkpoint, verify pendingCount equals sum
   - Initial: pendingCount should reflect total enqueued before execution
2. resolvedCount never decreases:
   - Track resolvedCount through execution
   - Verify it only stays same or increases (monotonic)
   - Same for rejectedCount and settledCount

**Validation approach:**
- Use helper function to assert invariants at checkpoint
- Verify all counts using getters (not private fields)
- Test with various concurrency levels (1, 2, 10, 100) to ensure counts correct at all scales
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-17" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>9 counter invariant tests passing, all getter logic validated (D1 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 12: Implement TEST-18 advanced patterns integration tests</name>
  <files>tests/TEST-18-advanced-patterns.ts</files>
  <action>
Implement 6 advanced pattern integration tests in TEST-18 demonstrating real-world usage.

**Test breakdown (6 tests):**

**Retry Pattern (1 test):**
1. Manual retry with max attempts:
   - Create helper: retryableTask(fn, maxAttempts) that re-enqueues on failure
   - Enqueue 3 tasks (one fails on first try, succeeds on 2nd)
   - Verify task succeeds after retry, result is correct
   - Verify max attempts prevents infinite loops (4 attempts > 3 max, task fails)

**Timeout with Fallback (1 test):**
1. timeout() wrapper with fallback:
   - Enqueue task: timeout(slowFn, 50).catch(() => cachedValue)
   - Verify timeout error caught, fallback value returned
   - Enqueue task: timeout(fastFn, 50).catch(() => cachedValue)
   - Verify fast task completes before timeout, no fallback

**Monitoring & Progress Tracking (2 tests):**
1. Real-time progress dashboard:
   - Enqueue 20 tasks (concurrency=3), track pendingCount at 100ms intervals
   - Verify pendingCount decreases over time
   - Verify pendingCount reaches 0 when done
2. Task completion ratio:
   - Calculate (settledCount / totalEnqueued) * 100 at each checkpoint
   - Verify percentage increases monotonically from 0 to 100

**Mixed Sync/Async Execution (2 tests):**
1. Wrap sync work in Promise:
   - Enqueue mix of async tasks and sync tasks wrapped in Promise.resolve()
   - Verify both types execute, concurrency still applies
   - Results contain values from both sync and async
2. Sync + async at different concurrency levels:
   - Concurrency=1: verify strictly sequential (async + sync + async = 150ms)
   - Concurrency=10: verify parallelism despite mix

**Validation approach:**
- Each pattern test should be a realistic usage example
- Verify both happy path (pattern works) and edge case (pattern handles error)
- All tests must complete without exceptions unrelated to pattern logic
  </action>
  <verify>
    <automated>npm test -- --testNamePattern="TEST-18" 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>6 advanced pattern tests passing, patterns validated in context (D4 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 13: Write Advanced Patterns section in README - Part 1 (Retry & Timeout)</name>
  <files>README.md</files>
  <action>
Add "Advanced Patterns" section to README with 2 foundational patterns: Retry Pattern and Timeout with Fallback.

**README section structure (insert after "API Reference" section):**

```markdown
## Advanced Patterns

Extend the basic pool with proven patterns for real-world scenarios.

### Retry Pattern — Automatic Retry with Backoff

Handle transient failures by re-enqueueing failed tasks with exponential backoff.

**When to use:** Network requests, flaky operations, transient database errors

**Example:**
\`\`\`typescript
import { pool, wait } from '@lalex/promises';

const retryablePool = pool(5);
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, attempt = 0) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoffMs = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
      await wait(backoffMs);
      return fetchWithRetry(url, attempt + 1);
    }
    throw error;
  }
}

const urls = ['https://api.example.com/data1', /* ... */];
for (const url of urls) {
  retryablePool.enqueue(() => fetchWithRetry(url));
}

const results = await retryablePool.close();
```

**Key insights:**
- Retries happen inside the task, not at the pool level
- Backoff prevents overwhelming a recovering service
- Max retry count prevents infinite loops
- Exceptions after max retries are captured in results as PoolErrors

---

### Timeout with Fallback — Graceful Degradation

Combine `timeout()` with fallback values to degrade gracefully when operations exceed deadline.

**When to use:** APIs with SLAs, user-facing requests, non-critical data enrichment

**Example:**
\`\`\`typescript
import { pool, timeout } from '@lalex/promises';

const cache = new Map<string, string>();
const apiPool = pool(10);

async function fetchDataWithCache(url: string) {
  return timeout(fetch(url).then(r => r.json()), 2000) // 2 second timeout
    .catch(error => {
      if (cache.has(url)) {
        console.log(\`Timeout, using cached value for \${url}\`);
        return cache.get(url);
      }
      throw error; // No cache, fail loudly
    });
}

const urls = ['https://api.example.com/trending', /* ... */];
for (const url of urls) {
  apiPool.enqueue(() => fetchDataWithCache(url));
}

const results = await apiPool.close();
```

**When to combine pool timeout + per-task timeout:**
- Pool timeout (in `pool(n, { timeout: 5000 })`) as a circuit breaker for runaway tasks
- Per-task timeout (via `timeout()` wrapper) for graceful degradation with fallback
- Example: pool timeout = 10s (kill if stuck), per-task timeout = 3s (try fallback)

\`\`\`typescript
const p = pool(5, { timeout: 10000 }); // Pool-level circuit breaker

p.enqueue(() =>
  timeout(expensiveOperation(), 3000) // Task-level graceful timeout
    .catch(() => defaultValue)
);
\`\`\`

**Key insights:**
- `timeout()` function returns a Promise that rejects after timeout
- `.catch()` handles TimeoutError and other errors uniformly
- Pool timeout (if set) acts as outer safety net
- Fallback values should be sensible defaults, not empty values
```

Add ~200 lines total. Ensure code examples are complete and runnable. Link back to API Reference section for timeout() and pool() signatures.
  </action>
  <verify>
    <automated>grep -c "Retry Pattern" README.md && grep -c "Timeout with Fallback" README.md</automated>
  </verify>
  <done>README contains Retry and Timeout+Fallback patterns with working code examples</done>
</task>

<task type="auto">
  <name>Task 14: Write Advanced Patterns section in README - Part 2 (Error Recovery & Monitoring)</name>
  <files>README.md</files>
  <action>
Extend "Advanced Patterns" section in README with 2 observability patterns: Error Recovery & Batching and Monitoring with Getters.

**Add to existing Advanced Patterns section:**

```markdown
### Error Recovery & Batching — Separate Success from Failure

Capture and replay failed tasks in a separate retry pool without losing partial results.

**When to use:** Batch data processing, error categorization, multi-wave retries

**Example:**
\`\`\`typescript
import { pool, PoolError } from '@lalex/promises';

const primaryPool = pool(10, { rejectOnError: false });
const retryPool = pool(3);

for (const item of largeDataset) {
  primaryPool.enqueue(() => parseAndValidate(item));
}

const primaryResults = await primaryPool.close(); // Results with PoolErrors at failure indices

// Separate successes from errors
const failures = primaryResults
  .map((result, index) => ({ result, index }))
  .filter(({ result }) => result instanceof PoolError);

// Batch failed items for retry
for (const { result, index } of failures) {
  const item = largeDataset[index];
  retryPool.enqueue(() => parseAndValidateWithLogging(item, result.cause));
}

const retryResults = await retryPool.close();

// Merge results: keep primary successes, inject retry results
const finalResults = primaryResults.map((result, index) => {
  if (result instanceof PoolError) {
    // Find retry result (order preserved in retryResults)
    return retryResults[failures.findIndex(f => f.index === index)];
  }
  return result;
});
\`\`\`

**Key insights:**
- Set `rejectOnError: false` to capture all results (including PoolErrors) without stopping
- Filter results by instanceof PoolError to identify failures
- Retry pool makes multiple attempts without re-running successes
- Results order is preserved across pools (by tracking index)

---

### Monitoring with Getters — Real-Time Pool Health

Use pool getters to build dashboards and progress trackers without side effects.

**When to use:** Long-running batch jobs, UI progress displays, operational health checks

**Example:**
\`\`\`typescript
import { pool, wait } from '@lalex/promises';

const importPool = pool(5);

// Large import job
for (let i = 0; i < 10000; i++) {
  importPool.enqueue(async () => {
    await fetch(\`/api/import\`, { method: 'POST', body: JSON.stringify(item) });
  });
}

// Progress tracker (no side effects)
const progressInterval = setInterval(() => {
  const {
    pendingCount,
    settledCount,
    runningCount,
    resolvedCount,
    rejectedCount,
  } = importPool;

  const total = settledCount + pendingCount;
  const pct = Math.round((settledCount / total) * 100);

  console.log(\`
Import Progress: \${pct}%
  Running: \${runningCount}
  Pending: \${pendingCount}
  Resolved: \${resolvedCount}
  Rejected: \${rejectedCount}
  \`);
}, 500);

const results = await importPool.close();
clearInterval(progressInterval);
console.log(\`Import complete: \${importPool.resolvedCount} succeeded, \${importPool.rejectedCount} failed\`);
\`\`\`

**Getter invariants to rely on:**
- `runningCount + waitingCount = pendingCount`
- `resolvedCount + rejectedCount = settledCount`
- `pendingCount + settledCount = total enqueued`
- All getters are O(1) (safe to call frequently)

**Key insights:**
- Getters reflect pool state at the moment of call (fast snapshot)
- No events needed; periodic polling is simple and effective
- Invariants hold at every point in lifecycle
- Safe to monitor without changing pool behavior
```

Add ~150 lines total. Ensure examples show real-world monitoring and error handling workflows.
  </action>
  <verify>
    <automated>grep -c "Error Recovery & Batching" README.md && grep -c "Monitoring with Getters" README.md</automated>
  </verify>
  <done>README contains Error Recovery, Batching, and Monitoring patterns with examples</done>
</task>

<task type="auto">
  <name>Task 15: Write Advanced Patterns section in README - Part 3 (Mixed Sync/Async)</name>
  <files>README.md</files>
  <action>
Complete "Advanced Patterns" section with final pattern: Mixed Sync/Async Execution.

**Add to existing Advanced Patterns section:**

```markdown
### Mixed Sync/Async Execution — When Speed Matters

Combine synchronous and asynchronous operations under unified concurrency control, useful for CPU-intensive work mixed with I/O.

**When to use:** Image processing + uploads, data transformation + API calls, compute-heavy tasks in parallel with network requests

**Example:**
\`\`\`typescript
import { pool } from '@lalex/promises';

const workPool = pool(4); // CPU cores on target machine

// Mix sync (heavy computation) and async (I/O) in one pool
const imageQueue = [{file: 'img1.jpg', data: buffer1}, /* ... */];

for (const { file, data } of imageQueue) {
  // Sync: thumbnails (CPU-bound)
  workPool.enqueue(async () => {
    const thumb = generateThumbnail(data); // Synchronous, fast
    return { file, thumb };
  });

  // Async: upload (I/O-bound)
  workPool.enqueue(() =>
    uploadToStorage(file, thumb) // Asynchronous, network
  );
}

const results = await workPool.close();
// Results interleave sync and async outputs in enqueue order
```

**Why this works:**
- Event loop schedules both sync and async equally
- Concurrency limit applies to both (no hogging CPU or network)
- Sync ops yield immediately, async ops yield during I/O wait
- Pool prevents "thundering herd" of requests

**Performance tip:**
- Set `concurrency = # of CPU cores` for mixed workloads
- Monitor `runningCount` to ensure neither type starves the other

\`\`\`typescript
const workPool = pool(navigator.hardwareConcurrency || 4);
\`\`\`

---

## Patterns Summary

| Pattern | Problem | Solution |
|---------|---------|----------|
| Retry | Transient failures | Automatically re-enqueue with backoff |
| Timeout + Fallback | Slow operations | Degrade gracefully with cached/default values |
| Error Recovery | Partial failures | Batch and replay failed tasks separately |
| Monitoring | Lack of visibility | Track counters for dashboards/logging |
| Mixed Sync/Async | Uneven resource use | Pool both equally, concurrency = CPU cores |

All patterns compose—use multiple in the same application.
```

Add ~100 lines total. Section now covers 5 patterns as per D4.
  </action>
  <verify>
    <automated>grep -c "Mixed Sync/Async" README.md && grep -c "Patterns Summary" README.md</automated>
  </verify>
  <done>README Advanced Patterns section complete with 5 patterns (D4 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 16: Validate TypeScript strict mode</name>
  <files>src/pool.ts, src/utils.ts, tsconfig.json</files>
  <action>
Validate zero TypeScript errors under `tsc --strict` for src/ and tests/.

**Validation checklist:**
1. Create new tsconfig.test.json with `"strict": true` and test path includes
2. Run `tsc --strict --noEmit --project tsconfig.json` on src/
3. Run `tsc --strict --noEmit --project tsconfig.test.json` on tests/
4. Verify zero errors reported
5. Document any forced strict-compliant patterns (e.g., explicit type annotations, null checks)

**Expected safe patterns already in place:**
- PromisePool interface fully typed (no `any`)
- PoolOptions interface fully typed
- PoolEventContext all fields typed
- TimeoutError extends Error with optional typed fields
- Event callbacks properly typed

**Action steps:**
- Ensure tsconfig.json has `"strict": true` enabled (already set in v1.2)
- Add verification comment in JSDoc for public API: "TypeScript strict mode compliant"
- Run validation command and capture output
- If any errors: fix type annotations, no downcastings to `any`
- Commit validation results to .planning/09-TYPE-VALIDATION.md
  </action>
  <verify>
    <automated>cd /workspaces/promises && npx tsc --strict --noEmit && echo "✓ TypeScript strict mode validation passed"</automated>
  </verify>
  <done>TypeScript strict mode passes with zero errors (D5 locked ✓)</done>
</task>

<task type="auto">
  <name>Task 17: Update JSDoc type safety documentation</name>
  <files>src/pool.ts, src/utils.ts</files>
  <action>
Enhance JSDoc comments with explicit type safety callouts referencing strict mode compliance.

**Updates:**

1. **Pool factory function JSDoc:**
```typescript
/**
 * Creates a new PromisePool with full TypeScript strict mode compliance.
 * All generics are explicit, no implicit `any` types.
 * ...
 * @template T - Result type of enqueued promises
 * ...
 */
export function pool<T = unknown>(concurrency?: number, options?: PoolOptions): PromisePool<T>
```

2. **PoolOptions JSDoc:**
```typescript
/**
 * Configuration for pool behavior. All fields are optional and type-safe.
 * - concurrency: number (numeric, validated for positive integer)
 * - rejectOnError: boolean (strict boolean, not truthy/falsy)
 * - autoStart: boolean (strict boolean)
 * - timeout: number | undefined (numeric, NaN/negative are ignored)
 */
interface PoolOptions
```

3. **PoolEventContext JSDoc:**
```typescript
/**
 * Immutable snapshot of pool state at error event emission.
 * All numeric fields are non-negative integers.
 * All boolean flags reflect state at event emission time.
 */
export interface PoolEventContext
```

4. **Add section to README under "Advanced Patterns":**

**Strict Type Safety**

PoolPromise is fully compliant with TypeScript strict mode. All types are explicit and verifiable.

\`\`\`bash
# Verify in your project
npx tsc --strict --noEmit
\`\`\`

No `any` types in public API, full generic type support for result composition.

---

Document which fields are validated (concurrency, rejectOnError, autoStart) vs which use defaults (timeout).
  </action>
  <verify>
    <automated>grep -c "strict mode" src/pool.ts && grep -c "strict mode" README.md</automated>
  </verify>
  <done>JSDoc updated with strict mode callouts and verification commands</done>
</task>

<task type="auto">
  <name>Task 18: Run full test suite and verify 135+ tests pass</name>
  <files>tests/</files>
  <action>
Execute full test suite and verify all 135+ tests (70 existing + 65 new) pass.

**Action steps:**
1. Run `npm test 2>&1 | tee test-results.log`
2. Capture output and count passing tests
3. Verify expected breakdown:
   - TEST-01 through TEST-12: 70 tests (Phase 8 baseline)
   - TEST-13: 18 boundary tests
   - TEST-14: 12 malformed input tests
   - TEST-15: 10 rapid lifecycle tests
   - TEST-16: 10 error propagation tests
   - TEST-17: 9 counter invariant tests
   - TEST-18: 6 advanced pattern tests
   - **Total: 135+ tests**

4. Verify test output contains no failures, skipped tests, or errors
5. Verify all tests complete in reasonable time (<30 seconds total)
6. Create `.planning/09-edge-cases-polish/09-TEST-RESULTS.md` documenting test breakdown and pass rates

**Expected output format:**
```
TEST-01: PromisePool lifecycle ✓ 5 tests
TEST-02: Concurrency limiting ✓ 1 test
...
TEST-13: Boundary Conditions ✓ 18 tests
TEST-14: Malformed Input ✓ 12 tests
TEST-15: Rapid Lifecycle ✓ 10 tests
TEST-16: Error Propagation ✓ 10 tests
TEST-17: Counter Invariants ✓ 9 tests
TEST-18: Advanced Patterns ✓ 6 tests

TOTAL: 135+ tests all passing ✓
```

If any test fails: diagnose, fix, and re-run until all pass.
  </action>
  <verify>
    <automated>npm test 2>&1 | grep -E "passed|failed|✓" | tail -3</automated>
  </verify>
  <done>All 135+ tests passing, test suite complete</done>
</task>

<task type="auto">
  <name>Task 19: Final documentation review and polish</name>
  <files>README.md, src/pool.ts</files>
  <action>
Review and finalize all documentation for release readiness.

**Documentation checklist:**
- [ ] README.md has complete "Advanced Patterns" section (5 patterns, ~200 lines)
- [ ] All code examples in README are copy-pasteable and correct
- [ ] API Reference section links to Advanced Patterns where relevant
- [ ] JSDoc comments are complete and accurate (no TODO or placeholders)
- [ ] TypeScript strict mode validation documented (command provided)
- [ ] No typos, grammar issues, or formatting inconsistencies
- [ ] Section ordering: Quick Start → API Reference → Advanced Patterns → TypeScript → Error Handling
- [ ] All pattern descriptions include "When to use" and "Key insights" sections
- [ ] Code examples follow consistent style (indentation, naming, formatting)

**Quality checks:**
1. Read through README cover-to-cover, looking for clarity and completeness
2. Verify all links are internal or to valid external resources
3. Validate Markdown syntax (no broken tables, code blocks, formatting)
4. Ensure all APIs mentioned in documentation are actually exported
5. Check that error messages match actual error handling behavior
6. Verify all examples use actual API (no hypothetical functions)

**Polish touches:**
- Add visual separators between major sections (---or similar)
- Ensure consistent capitalization and terminology
- Add table of contents if README exceeds 2000 lines
- Verify code formatting: 2-space indentation, consistent quotes, proper syntax

**Output:** Polish README and JSDoc to publication quality, ready for v1.2 release.
  </action>
  <verify>
    <automated>wc -l README.md && grep -c "Advanced Patterns" README.md</automated>
  </verify>
  <done>Documentation polished and release-ready</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - 7 new test files (TEST-13 through TEST-18) with 65 new test cases
    - Advanced Patterns section in README with 5 patterns and code examples
    - Full test suite: 135+ tests, all passing
    - TypeScript strict mode validation (zero errors)
    - JSDoc and type safety documentation
  </what-built>
  <how-to-verify>
    **Step 1: Run Tests**
    ```bash
    cd /workspaces/promises
    npm test
    ```
    Verify output shows "135+ tests passed" (at least 135 total tests, zero failures)

    **Step 2: Verify TypeScript Strict Mode**
    ```bash
    cd /workspaces/promises
    npx tsc --strict --noEmit
    ```
    Should output zero errors

    **Step 3: Review README Advanced Patterns**
    - Open README.md
    - Scroll to "Advanced Patterns" section
    - Verify 5 patterns present:
      1. Retry Pattern
      2. Timeout with Fallback
      3. Error Recovery & Batching
      4. Monitoring with Getters
      5. Mixed Sync/Async Execution
    - Verify each has "When to use" and "Key insights"
    - Copy-paste one code example and verify it runs without changes

    **Step 4: Verify Test Files**
    ```bash
    ls -la tests/TEST-1{3,4,5,6,7,8}*.ts
    ```
    Should show 6 new test files

    **Step 5: Check Test Breakdown**
    Run and visually inspect:
    ```bash
    npm test 2>&1 | grep -E "TEST-1[3-8]:|passed|failed"
    ```
    Verify:
    - TEST-13: 18 tests (boundary conditions)
    - TEST-14: 12 tests (malformed input)
    - TEST-15: 10 tests (rapid lifecycle)
    - TEST-16: 10 tests (error propagation)
    - TEST-17: 9 tests (counter invariants)
    - TEST-18: 6 tests (advanced patterns)
  </how-to-verify>
  <resume-signal>Type "approved" once verification passes, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
**Pre-commit checklist:**
- [ ] All 7 test files created and implemented (TEST-13 through TEST-18)
- [ ] 65 new test cases across all suites
- [ ] All tests passing (135+ total)
- [ ] TypeScript strict mode: zero errors
- [ ] README has Advanced Patterns section with 5 patterns
- [ ] Each pattern includes working code examples
- [ ] JSDoc updated with strict mode callouts
- [ ] No breaking changes to existing API
- [ ] All locked design decisions (D1-D5) implemented

**Design decision tracking:**
- ✅ D1: Boundary testing (18 tests in TEST-13)
- ✅ D2: Malformed input (12 tests in TEST-14)
- ✅ D3: Rapid lifecycle (10 tests in TEST-15)
- ✅ D4: Advanced patterns documented (5 patterns in README)
- ✅ D5: TypeScript strict mode validated (0 errors)

**Test coverage summary:**
- TEST-01 through TEST-12: 70 tests (Phase 8 baseline)
- TEST-13: 18 boundary condition tests
- TEST-14: 12 malformed input tests  
- TEST-15: 10 rapid lifecycle tests
- TEST-16: 10 error propagation tests
- TEST-17: 9 counter invariant tests
- TEST-18: 6 advanced pattern tests
- **Total: 135+ tests, 100% pass rate**
</verification>

<success_criteria>
Phase 9 planning is complete when:
- ✅ PLAN.md created with 20 concrete tasks (19 implementation + 1 verification)}
- ✅ Tasks organized into 3 waves (prep, execution, documentation)
- ✅ All 65 test scenarios detailed (18+12+10+10+9+6)
- ✅ All 5 Advanced Patterns documented with examples
- ✅ All 5 locked design decisions (D1-D5) addressed in tasks
- ✅ TypeScript strict mode validation clearly specified
- ✅ Test files, locations, assertion types specified for each test
- ✅ Documentation approvals and verification checkpoints clear
- ✅ Ready for `/gsd-execute-phase 09` execution
</success_criteria>

<output>
After completion, create `.planning/09-edge-cases-polish/09-SUMMARY.md` with:
- Test breakdown (65 new tests across 7 test suites)
- Patterns added to README (5 patterns, ~200 lines)
- Test results (135+ passing)
- TypeScript validation results (0 errors)
- Files modified (tests/, README.md, src/)
- Commits made (atomic per wave)
- Release readiness assessment
</output>

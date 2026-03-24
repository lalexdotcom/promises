---
phase: 07-timeout-control
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils.ts
  - src/index.ts
  - tests/index.test.ts
  - README.md
autonomous: true
requirements:
  - FR-4
user_setup: []

must_haves:
  truths:
    - "TimeoutError includes optional timeout duration field when thrown by timeout() function"
    - "TimeoutError includes optional promise reference field when thrown by timeout() function"
    - "timeout() function captures both timeout value and original promise on rejection"
    - "TimeoutError context fields are populated synchronously before rejection propagation"
    - "Developer can inspect error.timeout and error.promise from caught TimeoutError"
    - "Backward compatibility maintained: code throwing bare TimeoutError still works"
    - "All existing tests (49+) still pass with enhanced TimeoutError"
    - "Documentation shows 4 timeout composition patterns using new context fields"
  artifacts:
    - path: "src/utils.ts"
      provides: "Enhanced TimeoutError class with timeout and promise fields"
      min_lines: 15
      must_contain: "timeout?: number"
    - path: "src/utils.ts"
      provides: "Updated timeout() function with context capture logic"
      min_lines: 30
      must_contain: "err.timeout = delay"
    - path: "src/utils.ts"
      provides: "JSDoc for TimeoutError documenting new fields"
      must_contain: "@param timeout"
    - path: "src/index.ts"
      provides: "Export of enhanced TimeoutError (if not already exported)"
      must_contain: "TimeoutError"
    - path: "tests/index.test.ts"
      provides: "Test suite for TimeoutError fields (5-7 test scenarios)"
      min_lines: 50
      must_contain: "TimeoutError.timeout"
    - path: "README.md"
      provides: "Documentation of timeout composition patterns (Pattern 1-4)"
      must_contain: "Timeout Patterns"

  key_links:
    - from: "timeout() function"
      to: "TimeoutError class"
      via: "instantiation and field assignment"
      pattern: "err.timeout = delay; err.promise = p"
    - from: "TimeoutError"
      to: "pool.enqueue(fn, timeoutMs)"
      via: "internal timeout() call"
      pattern: "timeoutPromise = timeout(promise, timeoutMs)"
    - from: "error event listener (Phase 5)"
      to: "TimeoutError context"
      via: "rejection handling"
      pattern: "if (error instanceof TimeoutError) { error.timeout, error.promise }"
---

<objective>
Add optional `timeout` and `promise` fields to TimeoutError for better timeout debugging and error context.

Purpose: User debugging experience — when a timeout occurs, developers can immediately inspect the timeout duration and the promise that timed out, without additional correlation logic. Improves error diagnostics for timeout-sensitive applications.

Output: Enhanced TimeoutError class with two optional fields, timeout() function context capture, documentation of composition patterns, comprehensive test coverage, and zero breaking changes.

Success: All 12 tasks complete, 49+ existing tests pass, 5-7 new timeout context tests pass, README shows 4 timeout patterns, backward compatibility verified.
</objective>

<execution_context>
@.github/get-shit-done/workflows/execute-plan.md
@.planning/PROJECT.md
@.planning/STATE.md

**Key References:**
- Design decisions D1-D4 from `.planning/07-timeout-control/07-CONTEXT.md` (LOCKED — must be implemented exactly)
- Current implementation in `src/utils.ts` (TimeoutError and timeout() function)
- Test patterns in `tests/index.test.ts` (tests 01-07 show framework conventions)
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/07-timeout-control/07-CONTEXT.md

## Current Implementation

### TimeoutError (src/utils.ts)
```typescript
export class TimeoutError extends Error {}
```

Currently a bare class with no fields. Must be enhanced with optional fields per D1.

### timeout() Function (src/utils.ts)
```typescript
export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  return new Promise((res, rej) => {
    let isTooLate = false;
    let isResolved = false;
    const to = setTimeout(() => {
      if (!isResolved) {
        isTooLate = true;
        clearTimeout(to);
        rej(new TimeoutError('Promise timed out'));
      }
    }, delay);
    p.then((v) => {
      if (!isTooLate) {
        isResolved = true;
        clearTimeout(to);
        res(v);
      }
    }).catch((err) => {
      if (!isTooLate) {
        isResolved = true;
        clearTimeout(to);
        rej(err);
      }
    });
  });
}
```

Must be updated to capture context (delay and p) per D2.

### Pool Integration
From `src/pool.ts`, enqueue() calls `timeoutPromise = timeout(promise, timeoutMs)` internally. Context capture in timeout() automatically flows through to all pool-enqueued promises that timeout.

### Error Events (Phase 5)
Pool implements 'error' event with PoolEventContext. Phase 7 is orthogonal — timeout context fields populate in 'error' event callbacks naturally.

## Interface Context for Executors

### TimeoutError Type (to be implemented)
```typescript
export class TimeoutError extends Error {
  /**
   * The timeout duration in milliseconds that was exceeded.
   * Present when TimeoutError is thrown by timeout() or pool enqueue.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  timeout?: number;

  /**
   * The promise that did not settle within the timeout duration.
   * Captured at rejection time for debugging timeout root-cause.
   * This is the original promise passed to timeout(), before any wrapping.
   * Undefined for TimeoutErrors thrown from other sources.
   */
  promise?: unknown;

  constructor(message?: string) {
    super(message ?? 'Promise timed out');
    this.name = 'TimeoutError';
  }
}
```

### timeout() Function Signature (unchanged)
```typescript
export function timeout<T>(p: Promise<T>, delay: number): Promise<T>
```

Return type and parameters unchanged. Context capture happens internally.

### Usage Example (from README Pattern 1)
```typescript
const p = pool(3);
p.on('error', (error, context) => {
  if (error instanceof TimeoutError) {
    console.log(`Timeout: ${error.timeout}ms, Promise: ${error.promise}`);
    console.log(`Pool state: ${context.pendingCount} pending`);
  }
});
p.enqueue(() => fetch(url), 5000);
```
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update TimeoutError class with optional fields</name>
  <files>src/utils.ts</files>
  <action>
    Replace the bare TimeoutError class definition with the enhanced version including:
    1. Add `timeout?: number` field with JSDoc explaining it's set by timeout() function
    2. Add `promise?: unknown` field with JSDoc explaining it captures the original promise
    3. Add explicit `constructor(message?: string)` that:
       - Calls `super(message ?? 'Promise timed out')`
       - Sets `this.name = 'TimeoutError'` for stack traces
    4. Keep it extending Error (no breaking changes)
    
    Reference D1 from CONTEXT.md for exact implementation. This is Wave 1, Task 1.
    
    Do NOT change the function signature or any behavior of the class at runtime — only add field declarations and constructor.
  </action>
  <verify>
    - File `src/utils.ts` parses with no TypeScript errors
    - TimeoutError has timeout and promise as optional fields
    - TimeoutError extends Error
    - Constructor body sets this.name = 'TimeoutError'
    - Run: `cd /workspaces/promises && npx tsc --noEmit` (should pass)
  </verify>
  <done>
    TimeoutError class updated with optional timeout and promise fields. Constructor added. No functional changes yet — fields not populated anywhere.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update timeout() function to capture context on rejection</name>
  <files>src/utils.ts</files>
  <action>
    Locate the timeout() function in src/utils.ts. In the setTimeout callback where `rej()` is called:
    
    1. Replace the simple `rej(new TimeoutError('Promise timed out'))` with:
       ```typescript
       const err = new TimeoutError(`Promise timed out after ${delay}ms`);
       err.timeout = delay;
       err.promise = p;
       rej(err);
       ```
    
    2. Ensure this happens BEFORE `rej()` is called (synchronously, atomically)
    
    3. Do NOT modify any other logic in the function (promise race, timing, error propagation)
    
    4. Update the message to include the timeout duration for better debugging ("Promise timed out after Xms")
    
    Reference D2 from CONTEXT.md for implementation pattern. This is Wave 1, Task 2.
  </action>
  <verify>
    - File `src/utils.ts` parses with no TypeScript errors
    - timeout() function captures both delay and p into the error object
    - Error message includes the timeout duration
    - Run: `cd /workspaces/promises && npx tsc --noEmit` (should pass)
    - Run: `npm test` — existing tests should still pass (49+ tests, especially TEST-05)
  </verify>
  <done>
    timeout() function updated to capture timeout duration and promise reference in TimeoutError. Context capture happens synchronously in the setTimeout callback before rejection propagates.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update JSDoc for timeout() function</name>
  <files>src/utils.ts</files>
  <action>
    Update JSDoc comment for timeout() function to document the new error context:
    
    1. Add to the existing @throws line or create new @remarks section:
       ```
       *   When TimeoutError is thrown, it includes:
       *   - `timeout` field: the deadline duration in milliseconds
       *   - `promise` field: the original promise that was raced
       ```
    
    2. Example in JSDoc to show developers can inspect context:
       ```
       *   Example:
       *   ```typescript
       *   try {
       *     await timeout(fetchData(), 5000);
       *   } catch (err) {
       *     if (err instanceof TimeoutError) {
       *       console.log(`Timed out after ${err.timeout}ms`);
       *     }
       *   }
       *   ```
       ```
    
    3. Note that context fields may be undefined if TimeoutError is thrown from other sources
    
    Reference existing JSDoc style in the file for consistency. This is Wave 1, Task 3.
  </action>
  <verify>
    - JSDoc comment is present above timeout() function
    - Mentions timeout and promise fields in error context
    - Includes example code showing how to inspect fields
    - Mentions that fields may be undefined for other error sources
    - Run: `npx tsc --noEmit` (TSDoc parsing should pass)
  </verify>
  <done>
    JSDoc for timeout() function documented with error context fields and usage examples.
  </done>
</task>

<task type="auto">
  <name>Task 4: Update JSDoc for TimeoutError class</name>
  <files>src/utils.ts</files>
  <action>
    Update JSDoc comment above TimeoutError class definition to document the new optional fields:
    
    1. Expand the existing class JSDoc to mention the optional fields:
       ```
       *   Optional fields populated by timeout() and PromisePool.enqueue(fn, timeoutMs):
       *   - timeout: The timeout duration in milliseconds that was exceeded
       *   - promise: The promise that did not settle within the timeout duration
       ```
    
    2. Add note that both fields are optional and may be undefined:
       ```
       *   These fields are always present when TimeoutError is thrown by timeout(),
       *   but may be undefined if the error is created elsewhere.
       ```
    
    3. Link to timeout() function in JSDoc (use @link TimeoutError)
    
    4. Document pool.enqueue integration: "Also thrown by PromisePool.enqueue when per-promise timeout is set"
    
    Reference existing JSDoc format in the file. This is Wave 1, Task 4.
  </action>
  <verify>
    - JSDoc comment is present above TimeoutError class
    - Documents timeout and promise optional fields
    - Mentions both timeout() function and pool.enqueue as sources
    - Notes that fields may be undefined from other sources
    - Run: `npx tsc --noEmit` (TSDoc parsing should pass)
  </verify>
  <done>
    JSDoc for TimeoutError class updated documenting optional context fields and their sources.
  </done>
</task>

<task type="auto">
  <name>Task 5: Verify src/index.ts exports TimeoutError</name>
  <files>src/index.ts</files>
  <action>
    Check if TimeoutError is exported from src/index.ts. 
    
    1. Open src/index.ts and search for "TimeoutError" export
    2. If already exported, no changes needed (verify export is correct and move to Task 6)
    3. If NOT exported, add: `export { TimeoutError } from './utils';` to the exports section
    4. Ensure it's grouped with other utils exports for consistency
    
    This is Wave 1, Task 5 (dependency check).
  </action>
  <verify>
    - Run: `npx tsc --noEmit` (TimeoutError should be resolvable from @lalex/promises)
    - Run: `grep -n "export.*TimeoutError" src/index.ts` (should find the export)
    - Run: `npm test` (existing tests should still pass)
  </verify>
  <done>
    TimeoutError is exported from src/index.ts and available to consumers. If not already exported, export added.
  </done>
</task>

<task type="auto">
  <name>Task 6: Add "Timeout Patterns" section to README with Pattern 1 (Direct Timeout)</name>
  <files>README.md</files>
  <action>
    Add a new "## Timeout Patterns" subsection to README.md under "## Examples" section or as a peer section to "Advanced Examples":
    
    1. Create section header: "## Timeout Patterns"
    
    2. Add introductory text explaining that timeout composition is a primary use case, enabled by timeout context fields
    
    3. Add Pattern 1: "Direct Promise Timeout"
       - Title: "### Pattern 1: Direct Promise Timeout"
       - Code example:
         ```typescript
         import { timeout, TimeoutError } from '@lalex/promises';
         
         try {
           const result = await timeout(fetch(url), 3000); // 3s deadline
           console.log('Success:', result);
         } catch (err) {
           if (err instanceof TimeoutError) {
             console.error(`Timeout after ${err.timeout}ms while fetching ${err.promise}`);
           }
         }
         ```
       - Explanation: "Use timeout() to race any promise against a deadline. TimeoutError includes the timeout duration and original promise for debugging."
    
    4. Ensure formatting matches existing README code blocks (use backticks, language markers)
    
    5. Add placeholder comments for Patterns 2-4 (to be completed in Tasks 7-8)
    
    Reference existing README format and structure. This is Wave 2, Task 6.
  </action>
  <verify>
    - File "README.md" contains "## Timeout Patterns" section
    - Pattern 1 code example is present and valid TypeScript
    - TimeoutError usage shown with .timeout and .promise field inspection
    - Code block has proper syntax highlighting markers
    - Run: `grep -n "Timeout Patterns" README.md` (should find section)
  </verify>
  <done>
    README.md updated with "Timeout Patterns" section and Pattern 1 (Direct Promise Timeout) documented with code example and explanation.
  </done>
</task>

<task type="auto">
  <name>Task 7: Add Pattern 2 (Pool with Per-Task Timeout) and Pattern 3 (Pool + Error Events) to README</name>
  <files>README.md</files>
  <action>
    Continue the "## Timeout Patterns" section in README.md with Patterns 2 and 3:
    
    1. Pattern 2: "Pool with Per-Task Timeout"
       - Title: "### Pattern 2: Pool with Per-Task Timeout"
       - Code example showing enqueue(fn, timeoutMs):
         ```typescript
         import { pool, TimeoutError } from '@lalex/promises';
         
         const imagePool = pool(5); // 5 concurrent downloads
         
         for (const url of imageUrls) {
           imagePool.enqueue(() => fetch(url), 3000); // 3s timeout per image
         }
         
         const results = await imagePool.close();
         // Results include PoolError wrapping TimeoutError with timeout + promise context
         ```
       - Explanation: "Enqueue with timeoutMs parameter to set per-task deadline. Each timeout gets its own TimeoutError with context."
    
    2. Pattern 3: "Pool with Error Events + Timeout Context"
       - Title: "### Pattern 3: Pool with Error Events + Timeout Context"
       - Code example showing error event listener:
         ```typescript
         import { pool, TimeoutError } from '@lalex/promises';
         
         const httpPool = pool(10);
         
         httpPool.on('error', (error, context) => {
           if (error instanceof TimeoutError) {
             const { timeout, promise } = error;
             const { pendingCount, waitingCount } = context;
             
             logger.warn('Task timeout during batch operation', {
               timeoutMs: timeout,
               remainingTasks: pendingCount,
               queuedTasks: waitingCount,
               promise: String(promise),
             });
             
             // Retry logic: re-enqueue with longer timeout
           }
         });
         
         for (const url of urls) {
           httpPool.enqueue(() => fetch(url), 5000); // 5s per request
         }
         
         await httpPool.close();
         ```
       - Explanation: "Combine error events (Phase 5) with timeout context (Phase 7). Error event provides pool state snapshot, timeout context provides the specific promise details."
    
    3. Add placeholder section header for Pattern 4
    
    Reference existing README code format. This is Wave 2, Task 7.
  </action>
  <verify>
    - "README.md" contains Pattern 2 code example with enqueue(fn, timeoutMs)
    - "README.md" contains Pattern 3 code example with error event listener
    - Both examples show TimeoutError field inspection
    - Both show context usage (PoolEventContext in error event)
    - Code is valid TypeScript
    - Run: `grep -n "Pattern 2\|Pattern 3" README.md` (should find both)
  </verify>
  <done>
    README.md updated with Pattern 2 (Pool with Per-Task Timeout) and Pattern 3 (Pool + Error Events + Timeout Context) with code examples and explanations.
  </done>
</task>

<task type="auto">
  <name>Task 8: Add Pattern 4 (Nested/Composed Timeouts) to README</name>
  <files>README.md</files>
  <action>
    Complete the "## Timeout Patterns" section with Pattern 4:
    
    1. Pattern 4: "Nested Timeouts (Composition)"
       - Title: "### Pattern 4: Nested Timeouts (Composition)"
       - Code example showing multiple timeout layers:
         ```typescript
         import { pool, timeout, TimeoutError } from '@lalex/promises';
         
         // Inner: per-task timeout
         const poolOperation = async (urls: string[]) => {
           const imagePool = pool(5);
           
           for (const url of urls) {
             imagePool.enqueue(() => fetch(url), 2000); // 2s per image
           }
           
           return imagePool.close();
         };
         
         // Outer: global deadline for entire batch
         try {
           const allResults = await timeout(poolOperation(imageUrls), 30000);
           // 30s timeout for entire pool operation
         } catch (err) {
           if (err instanceof TimeoutError) {
             const { timeout: outerTimeout, promise: poolPromise } = err;
             if (outerTimeout === 30000) {
               console.error('Entire batch exceeded 30s deadline');
             }
           }
         }
         ```
       - Explanation: "Wrap a pool operation with timeout() for a global deadline, while each task has its own deadline. Compose timeouts at different abstraction levels. TimeoutError fields let you distinguish which timeout fired."
    
    2. Add best practices note at end of section:
       ```
       **Best Practices:**
       - Prefer per-task timeouts (Pool Pattern 2) for fine-grained control and isolation
       - Use global timeouts (Pattern 4, outer) as safety net for runaway batches
       - Combine with error events (Pattern 3) for comprehensive timeout monitoring
       - Store timeout context in logs for post-mortem analysis
       ```
    
    Reference existing README structure. This is Wave 2, Task 8.
  </action>
  <verify>
    - "README.md" contains Pattern 4 code example with nested timeout() calls
    - Shows both inner (per-task) and outer (global) timeout durations
    - Example demonstrates TimeoutError field usage to distinguish timeout sources
    - Best practices section is present
    - Code is valid TypeScript
    - Run: `grep -n "Pattern 4\|Best Practices\|Nested" README.md` (should find section)
  </verify>
  <done>
    README.md updated with Pattern 4 (Nested Timeouts / Composition) and best practices for timeout usage.
  </done>
</task>

<task type="auto">
  <name>Task 9: Test TimeoutError fields present in timeout() rejection</name>
  <files>tests/index.test.ts</files>
  <action>
    Add a new test block "TEST-08: TimeoutError Context Fields" to tests/index.test.ts after existing tests (around line 350+).
    
    Test scenario 1: "timeout() rejection includes timeout field"
    - Create a promise that will timeout: `wait(100)` with `timeout(..., 20)`
    - Catch the rejection and verify: `expect(err.timeout).toBe(20)`
    - Verify error is instanceof TimeoutError
    
    Test scenario 2: "timeout() rejection includes promise field"
    - Create a promise: `const p = wait(100)`
    - Wrap in timeout: `timeout(p, 20)`
    - Catch rejection and verify: `expect(err.promise).toBe(p)`
    - Verify promise field is truthy (not undefined, null, or empty)
    
    Test scenario 3: "both timeout and promise fields present together"
    - Create resolve order tracking: `let resolveOrder = []`
    - Use a custom promise that logs when resolved/rejected
    - Wrap with timeout
    - Catch and verify both fields are present: `expect(err.timeout).toBeDefined()` and `expect(err.promise).toBeDefined()`
    
    Use pattern from existing tests (async/await, expect, describe/test structure).
    This is Wave 3, Task 9.
  </action>
  <verify>
    <automated>npm test -- --filter=TEST-08</automated>
  </verify>
  <done>
    New TEST-08 test block added to tests/index.test.ts with 3 passing test cases verifying TimeoutError timeout and promise field presence.
  </done>
</task>

<task type="auto">
  <name>Task 10: Test TimeoutError field values are accurate</name>
  <files>tests/index.test.ts</files>
  <action>
    Add to TEST-08 test block in tests/index.test.ts:
    
    Test scenario 4: "timeout value matches the delay passed to timeout()"
    - Test multiple delay values: 10, 50, 100, 500
    - For each delay, wrap in `timeout(..., delay)`
    - Verify `err.timeout === delay` (exact match, not approximate)
    - This ensures synchronous capture happens at the right moment
    
    Test scenario 5: "promise field is the exact promise passed to timeout()"
    - Create a named promise generator for clarity: `const myPromise = () => new Promise(...)`
    - Call it: `const p = myPromise()`
    - Wrap: `timeout(p, 20)`
    - Verify: `err.promise === p` (reference equality, not just truthy)
    
    Test scenario 6: "error message includes timeout duration"
    - Create a timeout with known delay: `timeout(wait(100), 25)`
    - Catch and verify: `expect(err.message).toContain('25')`
    - Ensures message is informative
    
    Add these to TEST-08 block. This is Wave 3, Task 10.
  </action>
  <verify>
    <automated>npm test -- --filter=TEST-08</automated>
  </verify>
  <done>
    TEST-08 test block expanded with 3 new test cases verifying TimeoutError field accuracy (timeout value matches, promise is correct reference, message includes duration).
  </done>
</task>

<task type="auto">
  <name>Task 11: Test pool integration with TimeoutError context + error event</name>
  <files>tests/index.test.ts</files>
  <action>
    Add a new test block "TEST-09: Pool Timeout Context Integration" to tests/index.test.ts after TEST-08.
    
    Test scenario 7: "pool.enqueue with timeout generates TimeoutError with context"
    - Create a pool: `const p = pool(2)`
    - Enqueue a slow task with short timeout: `p.enqueue(() => wait(100), 20)`
    - Close pool and extract the PoolError from results
    - Verify the wrapped TimeoutError has context:
      ```
      const poolError = result[0];
      expect(poolError.catched).toBeInstanceOf(TimeoutError);
      expect(poolError.catched.timeout).toBe(20);
      expect(poolError.catched.promise).toBeDefined();
      ```
    
    Test scenario 8: "error event receives TimeoutError with context intact"
    - Create pool with error event listener
    - Track errors emitted: `let timeoutErrors = []`
    - In error listener: `if (error instanceof TimeoutError) timeoutErrors.push(error)`
    - Enqueue failing tasks with timeout
    - Verify: `expect(timeoutErrors[0].timeout).toBeDefined()`
    - Verify: `expect(timeoutErrors[0].promise).toBeDefined()`
    
    Test scenario 9: "pool error event and inner TimeoutError have matching context"
    - Set up error event listener capturing timeout from error
    - Enqueue task with known timeout: `pool.enqueue(() => wait(100), 30)`
    - In error listener, capture both error context and PoolEventContext
    - Verify they're both populated: timeout from TimeoutError, pendingCount from PoolEventContext
    
    Use pattern from existing pool tests (TEST-05 as reference). This is Wave 3, Task 11.
  </action>
  <verify>
    <automated>npm test -- --filter=TEST-09</automated>
  </verify>
  <done>
    New TEST-09 test block added with 3 test cases verifying pool integration with TimeoutError context fields and error event propagation.
  </done>
</task>

<task type="auto">
  <name>Task 12: Test backward compatibility (all 49+ existing tests)</name>
  <files>tests/index.test.ts</files>
  <action>
    Verify backward compatibility by running the full test suite. This task ensures:
    
    1. No breaking changes to existing TimeoutError behavior
    2. Existing code that creates bare TimeoutError() still works
    3. All existing tests (TEST-01 through TEST-07, 49+ cases) still pass
    4. timeout() function behaves identically for happy paths
    5. Pool functionality unchanged
    
    Specific backward compatibility checks:
    
    A. Bare TimeoutError creation (if used anywhere in codebase or tests):
       - Verify `new TimeoutError()` works (constructor is optional)
       - Verify `new TimeoutError('custom message')` works
       - Verify error extends Error normally (instanceof, .message, .stack)
    
    B. Existing timeout() usage patterns from TEST-05:
       - `const result = await pool.enqueue(() => wait(100), 20)`
       - Error wrapping in PoolError still works
       - Result ordering preserved
    
    C. Error event handling (Phase 5, TEST-07):
       - Error events still fire
       - Event data structure unchanged
       - PoolEventContext still provided
    
    Run command verification test: `npm test` (all 49+ tests pass with 0 failures)
    
    This is Wave 3, Task 12 (final verification task).
  </action>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>
    Full test suite (49+ tests) passing. Backward compatibility verified:
    - TEST-01 through TEST-09 all pass
    - Existing timeout behavior unchanged
    - Error wrapping in pools still works
    - Event system unaffected
    - New context fields optional (don't break old code)
    - TimeoutError instanceof checks still work
  </done>
</task>

</tasks>

<verification>
**Phase Completion Checklist:**

✅ **Type System (Tasks 1-4):**
- [ ] TimeoutError class has optional `timeout?: number` field
- [ ] TimeoutError class has optional `promise?: unknown` field
- [ ] Constructor added with `this.name = 'TimeoutError'`
- [ ] JSDoc for TimeoutError documents both fields
- [ ] JSDoc for timeout() documents context capture
- [ ] TypeScript compilation passes (`npx tsc --noEmit`)

✅ **Code Integration (Tasks 5-8):**
- [ ] timeout() function captures delay into `err.timeout`
- [ ] timeout() function captures promise into `err.promise`
- [ ] Context capture is synchronous (in setTimeout callback)
- [ ] Error message updated to include timeout duration
- [ ] src/index.ts exports TimeoutError

✅ **Documentation (Tasks 6-8):**
- [ ] README has "Timeout Patterns" section
- [ ] Pattern 1: Direct Promise Timeout (with code example)
- [ ] Pattern 2: Pool with Per-Task Timeout (with code example)
- [ ] Pattern 3: Pool + Error Events + Timeout Context (with code example)
- [ ] Pattern 4: Nested/Composed Timeouts (with code example)
- [ ] Best practices section for timeout usage

✅ **Testing (Tasks 9-12):**
- [ ] TEST-08 (3 tests): TimeoutError fields present
- [ ] TEST-08 (3 tests): TimeoutError field values accurate
- [ ] TEST-09 (3 tests): Pool integration with context
- [ ] TEST-09 (3 tests): Error event context propagation
- [ ] npm test passes (49+ existing tests + 9 new tests = 58+ total)
- [ ] Backward compatibility verified (no breaking changes)

**Code Changes Summary:**
- `src/utils.ts`: ~20 lines (TimeoutError enhancement, timeout() context capture, JSDoc)
- `src/index.ts`: 0-2 lines (export TimeoutError if needed)
- `tests/index.test.ts`: ~80 lines (TEST-08 + TEST-09 blocks, 9 test scenarios)
- `README.md`: ~120 lines (Timeout Patterns section, 4 patterns with examples + best practices)

**Total Scope:** 12 tasks, 3 waves, 220+ lines implementation, 58 total tests passing
</verification>

<success_criteria>
**Phase 7 Success Metrics:**

1. ✅ **Design Decision Implementation**
   - D1: TimeoutError extends Error with optional `timeout` and `promise` fields
   - D2: timeout() captures context synchronously in setTimeout callback
   - D3: Integration with Phase 5 error events (orthogonal, complementary)
   - D4: 4 timeout composition patterns documented in README

2. ✅ **Backward Compatibility**
   - All 49+ existing tests pass
   - Bare TimeoutError() still constructable
   - timeout() function signature unchanged
   - No breaking API changes

3. ✅ **Feature Implementation**
   - TimeoutError.timeout field populated by timeout()
   - TimeoutError.promise field populated by timeout()
   - Pool.enqueue integration works (internal timeout() call captures context)
   - Error event listeners receive TimeoutError with context fields

4. ✅ **Test Coverage**
   - 9 new test scenarios (TEST-08 + TEST-09)
   - Field presence tests (3 scenarios)
   - Field accuracy tests (3 scenarios)
   - Pool integration tests (3 scenarios)
   - 58+ total tests passing (49 existing + 9 new)

5. ✅ **Documentation**
   - README updated with "Timeout Patterns" section
   - 4 complete timeout composition patterns with code examples
   - Best practices for timeout usage
   - Error event + timeout context integration example

6. ✅ **Code Quality**
   - TypeScript compilation passes
   - All tests pass with no failures
   - JSDoc fully documents new fields and behavior
   - No console errors or warnings

**Release Readiness:**
- Phase 7 enables developers to inspect timeout context directly from TimeoutError
- Improves error debugging for timeout-sensitive applications
- Maintains strict backward compatibility
- Production-ready with comprehensive documentation and test coverage
</success_criteria>

<output>
After successful completion of all 12 tasks, create:

**`.planning/07-timeout-control/07-PLAN.md-SUMMARY.md`** containing:

```markdown
# Phase 7 Execution Summary — Timeout Enhancements & Error Context

**Status:** ✅ Complete

**Objectives:** Add optional `timeout` and `promise` fields to TimeoutError for better error debugging.

**Deliverables:**
- Enhanced TimeoutError class with optional context fields
- Updated timeout() function with synchronous context capture
- 4 timeout composition patterns documented in README
- 9 new test scenarios covering field presence, accuracy, and pool integration
- Backward compatibility verified (49+ existing tests still pass)

**Changes Made:**

### src/utils.ts
- TimeoutError class enhanced with `timeout?: number` and `promise?: unknown` fields
- Added explicit constructor with `this.name = 'TimeoutError'`
- timeout() function updated to capture delay and promise on rejection
- Error message updated to include timeout duration for debugging
- JSDoc updated for both TimeoutError and timeout()

### README.md
- Added "Timeout Patterns" section with 4 complete examples
- Pattern 1: Direct Promise Timeout
- Pattern 2: Pool with Per-Task Timeout
- Pattern 3: Pool + Error Events + Timeout Context
- Pattern 4: Nested/Composed Timeouts
- Best practices for timeout composition

### tests/index.test.ts
- TEST-08: TimeoutError Context Fields (6 test scenarios)
  - Field presence verification
  - Field accuracy verification
  - Error message verification
- TEST-09: Pool Timeout Context Integration (3 test scenarios)
  - Pool.enqueue timeout integration
  - Error event context propagation
  - Combined error + context handling

**Test Results:**
- 49 existing tests: ✅ all passing
- 9 new tests: ✅ all passing
- Total: 58 tests passing, 0 failures

**Backward Compatibility:**
- ✅ TimeoutError extends Error (instanceof checks work)
- ✅ Constructor is optional (bare new TimeoutError() still works)
- ✅ timeout() function signature unchanged
- ✅ No breaking changes to API or behavior
- ✅ Pool integration transparent (uses timeout() internally)

**Dependencies Addressed:**
- Phase 5 (Event-Driven Pool): ✅ Complementary, not conflicting
- Phase 6 (Pool Introspection): ✅ Independent, no conflicts
- ROADMAP FR-4: ✅ Fully implemented

**Key Decisions Locked (from D1-D4):**
- ✅ D1: TimeoutError structure (extends Error, optional fields)
- ✅ D2: Context capture timing (synchronous in setTimeout callback)
- ✅ D3: Phase 5 integration (orthogonal dimensions)
- ✅ D4: Documentation patterns (all 4 patterns with examples)

**Next Steps:**
- Phase 8: Performance Optimization & Memory Audit
- Phase 9: Edge Case Expansion & Documentation Polish
```

Record completion timestamp and mark phase-07 as COMPLETE in `.planning/STATE.md`.
</output>


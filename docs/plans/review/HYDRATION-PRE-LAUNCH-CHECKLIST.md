# Antigravity execution prompt — Universal Field Hydration, pre-launch checklist

> Paste this whole file into Antigravity. It targets commit `cdc3d23`
> ("last batch of bug fixes."), the fourth fix pass on this subsystem. A
> verification pass (four independent reviewers tracing real call chains and
> actually executing the test suite, not just reading it) confirmed the
> single biggest blocker from the last three rounds is now genuinely
> fixed: the pipeline is connected end-to-end from document upload through
> to a materialized fact, via both a real cron and a synchronous trigger,
> with real extraction data flowing through it.
>
> This prompt is intentionally narrow. It is not another full sweep — it's
> the small number of specific things standing between this and being safe
> to launch, found by executing code, not just reading it.

## 1. Fix the test that is currently failing — do this first, before anything else

**File:** `apps/custom/tests/universal-hydration-phase6.test.ts`, the
"test-matrix #18" FAILED-status test (~lines 138–178).

**Bug:** Running `npx vitest run tests/universal-hydration-phase6.test.ts -t
"test-matrix #18"` produces `AssertionError: expected null to be 'FAILED'`.
The test mocks `db.hydrationRun.findUnique`, but `persistProposals` (in
`hydrationRunEngine.ts:119`) actually calls `db.hydrationRun.findFirst` —
different method, left unmocked, so `run` resolves falsy and the `if (run)`
guard in the failure-handling catch block silently skips the status update
the test is trying to verify.

**Fix:** Mock the method the code actually calls (`findFirst`, not
`findUnique`), confirm the test passes, then run the full suite
(`npm test --workspace=apps/custom`) to make sure this wasn't masking
anything else. Before merging any further hydration work, confirm CI is
actually green on this file — if this has been silently red or skipped,
find out why your CI didn't catch it and fix that gap too.

## 2. Get one real-Postgres-backed test for each of the two highest-stakes claims

Every test across four rounds still uses `vi.spyOn` for its core DB
interaction — reasonable for pure logic, but insufficient for the two
claims that matter most for a production launch:

### 2.1 Transaction atomicity

**File:** `apps/custom/tests/universal-hydration-phase4.test.ts`, the
"rolls back transaction cleanly" test (~lines 217–251).

**Bug:** `vi.spyOn(db, "$transaction").mockImplementation(async () => {
throw new Error("Database write failed"); })` — the mock throws before ever
invoking the real transaction callback, so `ShipmentPartyService.assignParty`
and `db.fact.create` never run, real or fake. The test cannot fail
regardless of whether the actual `$transaction` wrapping in
`materializers.ts` is correct.

**Fix:** Write one test that seeds a real shipment/document/candidate via
the actual test-Postgres Prisma client, calls the real
`MaterializerRegistry.materializeDecision` for `PartyRoleMaterializer` with
a forced failure partway through (e.g. mock only
`ShipmentPartyService.assignParty` to throw, leaving `db.$transaction` and
the `Fact` write real), then queries the database afterward and asserts no
`Fact` row was created. This is the one test in this entire review sequence
that actually proves the `$transaction` fix from round 2 does what it
claims.

### 2.2 Honest failure state

Once item 1 is fixed, upgrade that same test (or add a sibling) to seed a
real `HydrationRun` row, force a real throw inside the proposal-processing
loop (not a mocked return value), and query the database afterward to
confirm `status: "FAILED"` was actually persisted — not just that `update`
was *called* with that argument, which is what the current (post-fix)
version would still only prove.

## 3. Decide on the mapper gap, explicitly

**File:** `apps/custom/src/modules/hydration/mapper/structuredFieldMapper.ts`.

This has been flagged in three consecutive rounds and not attempted in any
of them; this round added a dead `LLMFieldMapperProvider` interface that is
never implemented or called, plus a logging call — no actual model
integration exists. Before launch, make an explicit call:

- If real LLM-based mapping is required for launch, implement it now — the
  supporting infrastructure (cardinality checks, tiered confidence scoring,
  fail-closed validation defaults) built in round 2 was specifically
  designed to sit in front of real model output and is currently validating
  nothing but deterministic string matches.
- If deterministic alias matching is an acceptable v1 scope for launch,
  say so explicitly in your report and rename the class/module to reflect
  what it actually does (it currently implies LLM-driven semantic mapping
  it doesn't perform), so this doesn't get silently mistaken for done in a
  future round.

Either answer is fine. Silently carrying it forward a fifth time is not.

## 4. Small cleanups

- `hydrationMetricsService.ts`: `estimatedCostUsd` and
  `estimatedCostUsdApprox` are still the same flat `totalRuns * 0.005`
  guess under two names. Collapse to one field, clearly named as an
  approximation, or wire in real token accounting if 3's answer produces a
  meterable model call.
- The swallowed-error catches on outbox enqueue
  (`shipmentEventBus.ts`) and the inline dispatch trigger
  (`documentProcessingWorker.ts`) now log instead of silently failing —
  good — but still don't retry or alert. A transient DB blip between parse
  promotion and hydration currently waits silently for the next 5-minute
  cron tick. Consider whether that's an acceptable degradation for launch
  or whether it needs a retry/alert; either is fine, just make the call
  deliberately.
- The old event-consumer tautology test
  (`universal-hydration-phase3.test.ts` "test-matrix #1.2", asserting
  `toBeGreaterThanOrEqual(0)`/`toEqual([])`) and the still-`null`-stubbed
  detach/recompute test (`universal-hydration-phase4.test.ts` ~lines
  191–215) were both left in place while new tests were added alongside
  them. Either fix or remove the superseded ones so the suite doesn't carry
  two versions of the same claim, one real and one decorative.
- Test-matrix item numbers #14 and #15 now each appear twice across
  `universal-hydration-phase4.test.ts`. Renumber so the test matrix mapping
  in `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` Section 9 stays legible.

## Required validation

1. `npm test --workspace=apps/custom` — must be fully green, including the
   fix from item 1.
2. The two new real-DB tests from item 2 must actually query persisted
   state, not mock call arguments.
3. `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace=apps/custom`
4. ESLint on all changed files.
5. `git diff --check`.
6. Report the explicit decision from item 3, whichever way it goes.

This list is short by design — the hard structural work (wiring, candidate
identity, dataMode) is genuinely done. This is what's left standing between
here and launch.

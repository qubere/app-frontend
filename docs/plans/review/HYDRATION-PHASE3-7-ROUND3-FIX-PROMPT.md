# Antigravity execution prompt — Universal Field Hydration, round 3 fixes

> Paste this whole file into Antigravity. It targets commit `aa36076`
> ("bug fixes2 on the hydration methods"), which addressed
> `docs/plans/review/HYDRATION-PHASE3-7-ROUND2-FIX-PROMPT.md`. A verification
> pass (five independent reviewers, each tracing real call chains rather than
> checking for file existence) found genuine fixes in several areas, but the
> single item flagged as highest priority in the last two rounds — getting
> real production traffic to flow through this pipeline — is **still not
> fixed**, and this round it's disguised better: new files were added that
> look like wiring (an API route, an event consumer) but none of them
> actually carry real traffic yet. One other "fix" (candidate-identity
> idempotency) is cosmetic — a type-unsafe cast that changes nothing about
> the actual runtime behavior.
>
> This is the third fix pass on this subsystem. Before writing any new code,
> read `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` and all three prior
> documents in `docs/plans/review/` (`HYDRATION-PHASE1-2-FIX-PROMPT.md`,
> `HYDRATION-PHASE3-7-FIX-PROMPT.md`, `HYDRATION-PHASE3-7-ROUND2-FIX-PROMPT.md`)
> so the pattern of what keeps regressing/getting cosmetically patched is
> understood, not just this round's diff.

## Group 1 — Close the wiring gap for real this time (do this before anything else)

### 1.1 The event → consumer link doesn't exist; wire it to something that actually runs

**File:** `apps/custom/src/modules/events/shipmentEventConsumer.ts`.

**Bug:** `ShipmentEventConsumer.dispatchOutboxEvents` correctly queries
`workflowOutboxEvent` for `aggregateType: "SHIPMENT", status: "PENDING"` and
calls `HydrationWorker.processDocumentHydration`, but has exactly one caller
in the entire repo — a test. No cron entry in `apps/custom/vercel.json`, no
API route, no startup hook invokes it. The outbox rows it's meant to
dequeue still just accumulate as `PENDING` forever, identical in effect to
before this file existed.

**Fix:** Add a real invocation path. This codebase already has a working
cron pattern (`apps/custom/vercel.json` — the document-processing cron) and
a working outbox-dispatch pattern in `apps/tms/src/lib/tmsPipelineOutbox.ts`
— follow one of those, don't invent a third. Add a cron entry (or wire into
an existing cron that already runs frequently enough) that calls
`ShipmentEventConsumer.dispatchOutboxEvents` for every account/tenant that
needs it, on a schedule tight enough that `DOCUMENT_PARSE_PROMOTED` events
don't sit for hours. Confirm it actually executes by checking cron logs
after deploying to a non-prod environment, not just by code review.

### 1.2 The consumer calls hydration with an empty payload — it would be a no-op even if wired

**File:** same file, `dispatchOutboxEvents`, the call to
`processDocumentHydration(event.accountId, { documentId: docId,
parseVersionId, extractedFields: [] as any }, ...)`.

**Bug:** `extractedFields` is hardcoded to an empty array/object, and no
`tradeMetadata`, `keyValuePairs`, `lineItems`, or `entities` are populated —
`RawExtractionContext.extractedFields` is typed `Record<string, string>` in
`universalEvidenceExtractor.ts`, not even the right shape. The consumer
never fetches the actual parse output for the document. Fixing 1.1 alone
would make this run hydration against zero evidence on every document.

**Fix:** Before calling `processDocumentHydration`, fetch the real parse
output for `docId`/`parseVersionId` (however the document worker's
`promoteToActive` path already accesses it — check
`apps/custom/src/modules/documents/processing/processingRuns.ts` and
`documentIntelligenceAgent.ts` for the existing extraction result shape) and
build a genuine `RawExtractionContext` from it. Add a test that seeds a real
parsed document with actual field data, runs the consumer, and asserts real
`ExtractionField`/`HydrationCandidate` rows were created from that data —
not from an empty payload.

### 1.3 The review UI still doesn't call the code this project has been fixing for three rounds

**File:** `apps/custom/src/app/api/shipments/[id]/field-review/route.ts`
(new, correctly authenticated, calls `FieldReviewService.submitFieldReviewAction`)
vs. `apps/custom/src/app/api/shipments/[id]/documents/[documentId]/field-review/route.ts`
(pre-existing, has its own separate ad-hoc `db.shipment.update`/
`FactService.record` logic) vs. the actual frontend callers
(`DocumentFieldReviewModal.tsx`, `ExceptionsDrawer.tsx`), which all still
POST to the old route.

**Bug:** Every fix applied to `FieldReviewService` across all three rounds
of this review — the action-branching fix, the optimistic-concurrency CAS,
the select-alternate logic, the honest-decision replacement of
`mockDecision` — is unreachable from the real product. The UI talks to a
different, unaudited code path entirely.

**Fix:** This needs a decision, not just more code: either (a) point the
frontend callers at the new route and delete/deprecate the old one once
parity is confirmed, or (b) if the old route must stay for a migration
period, port its ad-hoc logic to call `FieldReviewService` internally so
there's one implementation, not two diverging ones. Do not leave both
routes live with different logic indefinitely — that's exactly the
"scattered per-surface maps" failure mode the original design doc
(Section 2) was written to eliminate. Whichever path you choose, add an
integration-style test that hits the real route the UI actually calls and
asserts it now goes through `FieldReviewService`.

### 1.4 Logging still only covers 2 of ~24 files in the module

**Bug:** `HydrationLogger` is a real, working structured logger (confirmed —
this part is fixed), but it's only called from `hydrationWorker.ts` and
`materializers.ts`. `evidenceLedgerService.ts`, `structuredFieldMapper.ts`,
`promotionPolicyEngine.ts`, `corroborationConflictResolver.ts`,
`fieldReviewService.ts`, and `shadowBackfillRunner.ts` — every other named
stage from the last two rounds' fix prompts — are still completely silent.

**Fix:** Add `HydrationLogger` calls at the start/end of every stage in
these files (at minimum: evidence persistence count, mapping proposal
count, every promotion decision with its reason, every review action, every
shadow-backfill run), and specifically inside `shipmentEventBus.ts`'s
`.catch(() => {})` on the outbox insert (~line 49–51) — that failure is
still silently swallowed with no log line at all.

## Group 2 — Fix the fix: candidate-identity idempotency is unchanged behind a type-unsafe cast

**File:** `apps/custom/src/modules/hydration/promotion/materializers.ts`,
~line 75.

**Bug:** `const realCandidateId = (candidate as any).id ||
candidate.proposal.targetFieldKey;`. The `candidate` parameter is typed
`ResolvedCandidate` (`corroborationConflictResolver.ts`), which has no `.id`
field — the `as any` cast exists specifically to bypass the compiler
catching this. `.id` is `undefined` on every real call, so this always
falls through to `targetFieldKey`, identical to the original bug this was
supposed to fix in round 2. Trace confirms: `HydrationRunEngine.persistProposals`
does create real `HydrationCandidate` rows with real IDs, but its return
value is discarded by every caller, and `resolvedCandidates` is built from
the separate in-memory `proposals` array that never carries a persisted ID.

**Fix:** Thread the real ID through properly instead of reaching for it
where it doesn't exist. `HydrationRunEngine.persistProposals`'s return
value (the created/updated `HydrationCandidate` rows, which do have real
`id`s) needs to reach the corroboration/resolution/materialization stage —
either have `persistProposals`'s result flow into
`CorroborationConflictResolver.resolveShipmentProposals` so `ResolvedCandidate`
can carry a real `candidateId` field, or have `hydrationWorker.ts` re-fetch
the persisted candidates by their natural key
(`hydrationRunId`/`fieldDefinitionKey`/`targetEntityRef`) before calling the
materializer. Remove the `as any` cast — it should be a compile error to
access `.id` on a type that doesn't have it, and its presence here is what
let this ship as "fixed" when it wasn't. Add the test round 2 asked for:
materialize two genuinely different candidates for the same field (e.g. an
initial promotion, then a later one from `SELECT_ALTERNATE` or
re-resolution) and assert both produce correct, distinct `Fact` history —
not a silently-skipped duplicate.

## Group 3 — Smaller items still open

### 3.1 `estimatedCostUsd` is still fake, just duplicated

**File:** `hydrationMetricsService.ts`.

**Bug:** The flat `totalRuns * 0.005` guess is unchanged. A new field
`estimatedCostUsdApprox` was added with the identical value, but the
original `estimatedCostUsd` field — the one a dashboard would already be
reading — is untouched and still misleadingly named as if it were a real
computed cost.

**Fix:** Either compute a real cost from actual token usage (requires 4.1
below to exist first, since there's no model call to meter yet) or rename
the one field that's actually returned to make clear it's an approximation
(e.g. `estimatedCostUsd` → `estimatedCostUsdApprox` as the only field, not
an addition alongside the original).

### 3.2 `dataMode` plumbing is complete but never fed a real value

**Bug:** Every layer from `CreateHydrationRunParams` through
`getAccountMetrics`/`runShadowBackfill` correctly threads and filters by
`dataMode` now — confirmed working end to end. But the one real production
caller, `ShipmentEventConsumer.dispatchOutboxEvents`, never passes it, so
every real run defaults to `"PRODUCTION"` regardless of the account's actual
mode. This will matter as soon as 1.1/1.2 make this consumer live.

**Fix:** When wiring 1.1/1.2, fetch the account's actual `dataMode` (however
the rest of the app determines it — check for an existing
`withDataModeContext`/account-context utility referenced in this repo's own
recent commit history) and pass it into `processDocumentHydration`'s
options.

### 3.3 The mapper is still not a real LLM call

**File:** `apps/custom/src/modules/hydration/mapper/structuredFieldMapper.ts`
— untouched by the last two commits.

This has now been flagged in both prior rounds and not attempted either
time. If it's intentionally deferred, say so explicitly in your report with
a reason, rather than letting it silently continue rolling forward
unaddressed while everything downstream of it gets fixed.

## Test suite: still not meeting the bar, and now disproportionate to the change size

This round changed 957 lines across 17 files (including two brand-new
production files, an API route and an event consumer) but only 35 lines
across two test files. Specifically:

- **No test for the new API route at all.**
- **The new event-consumer test is a tautology**:
  `expect(result.processedCount).toBeGreaterThanOrEqual(0)` and
  `expect(result.errors).toEqual([])` both pass whether or not anything was
  actually dequeued and processed. This is not a real coverage.
- **The restored detach/recompute test is still fully `vi.spyOn`-mocked** —
  the "no human lock" and "surviving candidate" cases are both stubbed to
  return `null` rather than exercised with real seeded rows, which is
  exactly what round 2 asked to be fixed and wasn't.
- **No test in phases 3–6 seeds real Postgres rows and asserts on persisted
  state afterward** — this is the third round this exact gap has been
  flagged.
- **No forced-mid-pipeline-failure test exists** asserting a `HydrationRun`
  ends up `FAILED` rather than falsely `SUCCEEDED`.
- **Transaction-threading changes in `entityResolutionService.ts`,
  `factService.ts`, `lineItemReconciler.ts`, `shipmentPartyService.ts`
  (174 combined lines) have no new test coverage at all** — there is still
  no test that forces a failure partway through a multi-write materialization
  (e.g. make `assignParty` throw) and asserts no orphaned `Fact` row exists,
  despite this being explicitly requested in round 2.

**Fix:** Before claiming any of Group 1–3 above as done, add:
1. A real-DB-seeded test for 1.1/1.2 (real outbox row → real consumer run →
   real evidence persisted from real parse content).
2. A real-DB-seeded detach/recompute test exercising an actual human-locked
   fact and an actual surviving-document candidate, asserting on queried
   state afterward, not mocked call counts.
3. A transaction-failure test proving `PartyRoleMaterializer`'s multi-write
   is genuinely atomic (force `assignParty` to throw, assert no `Fact` row
   persisted).
4. A forced-failure test asserting `HydrationRun.status === "FAILED"` after
   a mid-pipeline throw.
5. A real candidate-identity idempotency test per Group 2.

## Required validation

1. `npm test --workspace=apps/custom`
2. `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace=apps/custom`
3. ESLint on all changed files — specifically flag and remove the `as any`
   cast from Group 2; it should not be able to hide a broken fix again.
4. `npx prisma validate` for any schema changes.
5. `git diff --check`.
6. Deploy to a non-production environment and confirm, by actually
   observing it happen (cron logs, or a manual trigger plus a DB query),
   that a document upload results in: a `DOCUMENT_PARSE_PROMOTED` event →
   dequeued by the consumer → a `HydrationRun` created → real
   `HydrationCandidate` rows from real evidence → at least one materialized
   `Fact`. This is the single most important validation step in this
   entire review sequence. A code-review pass alone has not been sufficient
   evidence for "wired" in either of the last two rounds — an observed,
   working run is the bar this time.
7. Report each item as FIXED (with the test/observation that proves it),
   PARTIALLY FIXED (state exactly what's left), or NOT FIXED. Do not use a
   type-unsafe cast, a duplicated field name, or a new file that has no
   caller as evidence of "fixed" — three separate instances of exactly that
   pattern were caught in this round alone.

This subsystem has now had three fix rounds without reaching a state where
a document upload actually produces a materialized fact through this
pipeline in any real environment. If the full wiring in Group 1 is too large
for one more pass, say so explicitly and propose a smaller, fully-verified
slice (e.g. just the field-review path, end to end, with the UI actually
pointed at it) rather than adding more scaffolding that isn't connected.

# Antigravity execution prompt — Universal Field Hydration, round 2 fixes

> Paste this whole file into Antigravity. It targets commit `d3f7127`
> ("fixes for the phases."), which addressed
> `docs/plans/review/HYDRATION-PHASE3-7-FIX-PROMPT.md`. A verification pass
> (six independent reviewers, each re-reading current source and re-running
> the original repro steps rather than trusting the commit message) found
> that commit fixed roughly 15 of ~27 items solidly, left several partially
> fixed with new problems introduced, deleted one feature outright instead of
> fixing it, and left the single most important item — production wiring —
> untouched. Every finding below was verified against actual current source,
> not the diff or the docstrings.
>
> Read `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` and both prior fix
> prompts in `docs/plans/review/` before editing.

## Group 1 — Nothing runs in production yet (fix this first; everything else is unreachable until it does)

### 1.1 The pipeline still has zero callers from the real upload/parse path

**Bug:** Re-grepping the entire `apps/custom/src` tree (excluding the
hydration module and tests) for `HydrationWorker`, `processDocumentHydration`,
`ShadowBackfillRunner`, `runShadowBackfill`, `FieldReviewService`,
`submitFieldReviewAction` still returns zero matches. No API route under
`apps/custom/src/**/api/**` mentions hydration at all. `DOCUMENT_PARSE_PROMOTED`
was added to `ShipmentEventType` but nothing anywhere emits it — it's a type
with no producer. This is unchanged from the previous review: the entire
Phase 3–7 subsystem cannot execute today regardless of how correct its
internals are.

**Fix:** Wire it for real. At minimum:
- The document worker must emit `DOCUMENT_PARSE_PROMOTED` (via
  `ShipmentEventBus.logEvent`) at the point it promotes an active parse
  version.
- A consumer must exist for that event that calls
  `HydrationWorker.processDocumentHydration` — see 1.2 for why the outbox
  write alone isn't enough.
- A real, authenticated API route must call
  `FieldReviewService.submitFieldReviewAction` for the review UI to be able
  to do anything.
- `RolloutController.isHydrationEngineEnabled` is already called correctly
  inside `processDocumentHydration` (confirmed fixed) — it just has nothing
  upstream calling that function yet.

If full end-to-end wiring is too large for this pass, wire at least one path
completely (e.g. field review submission, since it's the most self-contained)
and say explicitly in your report which paths remain unwired — do not mark
this phase "done" while `processDocumentHydration` still has one caller
total in the whole codebase.

### 1.2 The "durable outbox" has no consumer — events land and rot

**File:** `apps/custom/src/modules/events/shipmentEventBus.ts`.

**Bug:** `logEvent` now also writes to `db.workflowOutboxEvent` (a real,
pre-existing table with genuine consumers elsewhere in `apps/tms`) with
`aggregateType: "SHIPMENT"`. But every existing dispatcher for that table
filters by `aggregateType: "PipelineJob"` or other TMS-specific types (e.g.
`apps/tms/src/lib/tmsPipelineOutbox.ts`). Nothing anywhere queries
`aggregateType: "SHIPMENT"` or the hydration event types. Rows land as
`PENDING` and are never dequeued. Separately, the insert is wrapped in
`.catch(() => {})` — a failure to even enqueue is silently swallowed with no
retry and no alert.

**Fix:** Add a real consumer/dispatcher for `aggregateType: "SHIPMENT"` rows
(or reuse the existing dispatcher pattern in `apps/tms/src/lib/tmsPipelineOutbox.ts`
if its design generalizes) that calls the appropriate hydration entry point
and marks the row processed on success. Stop swallowing the enqueue failure
silently — log it and consider surfacing it as a metric/alert.

### 1.3 Zero logging anywhere in the module

**Bug:** `grep -rn "console\.|logger\." apps/custom/src/modules/hydration/`
returns nothing. Every stage of this pipeline — evidence persistence,
mapping, corroboration, promotion, materialization, review actions, shadow
backfill — runs (in tests, and once 1.1 is fixed, in production) with zero
observable output. Several `.catch(() => {})` blocks were added in this last
round specifically to swallow errors silently (materializers.ts's
`LineItemReconciler` catch, `hydrationWorker.ts`'s `createExceptionItem`
catch) — these need logging most of all, since they're exactly the paths
where a real production failure would otherwise vanish without a trace.

**Fix:** Add structured logging (match whatever logging convention the rest
of `apps/custom` uses — check for an existing logger utility before adding a
new one) at minimum: run start/end with duration and outcome, every
`FAIL_CLOSED` rejection, every swallowed-catch block (log before returning
the fallback, don't just swallow), and every materialization
success/failure with the field key and shipment ID. This is required before
any claim of production-readiness — you cannot operate a pipeline you can't
see.

## Group 2 — A previously-existing feature was deleted, not fixed

### 2.1 `recomputeShipmentFactsOnDetach` was removed entirely

**File:** was in `apps/custom/src/modules/hydration/orchestration/hydrationWorker.ts`,
now absent. Confirmed via `git show d3f7127` diff and a repo-wide grep for
`recomputeShipmentFactsOnDetach` (zero hits anywhere).

**Bug:** The prior review flagged this function for hard-deleting `Fact`
rows instead of using the `supersededAt` column that already exists on the
`Fact` model for exactly this purpose, and for not actually recomputing a
replacement value from surviving evidence. Round 2 did not fix either
problem — it deleted the function and its test. Design doc invariant #3
("raw extraction evidence is immutable") and Section 6 requirement #7
("detach/supersede recomputes current facts... preserving human locks and
all historical evidence") are back to fully unimplemented, and test-matrix
item #22 has no implementation to test at all.

**Fix:** Reimplement detach/recompute properly this time:
- Do not hard-delete `Fact` rows. Set `supersededAt` on facts sourced from
  the detached document (excluding human-locked ones).
- After superseding, re-run the promotion policy over the shipment's
  remaining candidates for each affected field to promote the next-best
  surviving value, if any — don't just leave a gap.
- Restore a test for test-matrix item #22 that seeds real Fact rows
  (including at least one human-locked one and one from a surviving
  document) and asserts on actual persisted state afterward: the detached
  document's non-locked facts are superseded, the human lock survives
  untouched, and a surviving document's evidence produces a replacement
  current value where applicable.

## Group 3 — Fixes that are partial or introduced new problems

### 3.1 Materializer transaction is fake for 2 of 3 write paths

**File:** `apps/custom/src/modules/hydration/promotion/materializers.ts`.

**Bug:** `db.$transaction(async (tx) => {...})` wraps the materializer body,
but only `ShipmentScalarMaterializer`'s `tx.fact.*`/`tx.shipment.update`
calls actually use the `tx` client. `PartyRoleMaterializer` (via
`EntityResolutionService.findOrCreateEntity` and
`ShipmentPartyService.assignParty`) and `LineItemMaterializer` (via
`LineItemReconciler.applyDiscoveries`) all go through the module-level `db`
singleton instead — in Prisma, those writes commit independently of `tx` and
are not rolled back if something inside the transaction later fails. This
gives a false sense of atomicity for exactly the two materializers that do
the most complex, multi-write work.

**Fix:** Thread `tx` through to `EntityResolutionService`,
`ShipmentPartyService`, and `LineItemReconciler` (accept an optional Prisma
client/transaction parameter in each, defaulting to the module `db` when not
in a transaction) so all writes for one materialization genuinely share one
transaction. Add a test that forces a failure partway through
`PartyRoleMaterializer` (e.g. make `assignParty` throw) and asserts no `Fact`
row was left behind either.

### 3.2 New swallowed-error paths report fake success

**File:** same file, ~line 191 (`LineItemReconciler.applyDiscoveries` wrapped
in `.catch(() => {})` while still returning `success: true, materialized:
true`), and `hydrationWorker.ts` ~lines 124–126 (`createExceptionItem`
wrapped in `.catch(() => {})`, comment says "for tests" but this also
swallows real production failures).

**Fix:** Don't swallow these. If a materialization genuinely fails, return
`success: false` with the real error, not a fabricated success. If a
conflict's exception record fails to write, that's a real problem for a
human to know about (and per 1.3, at minimum it must be logged). Reserve
test-environment leniency for actual test setup code, not production error
handling.

### 3.3 Idempotency key is keyed on the field name, not the candidate's real identity

**File:** same file, ~lines 80–107; `packages/db/prisma/schema.prisma` ~line
3743 (`@@unique([shipmentId, field, candidateId])`).

**Bug:** `candidateId` is populated with
`candidate.proposal.targetFieldKey` — the field key again, duplicating the
`field` column — not the actual `HydrationCandidate.id` being materialized.
Two genuinely different candidates for the same field (e.g. after a later
re-resolution supersedes an earlier one) collide on this "unique" key and
the second is treated as a no-op duplicate instead of a legitimate new
materialization.

**Fix:** Use the real `HydrationCandidate.id` for this field, threading it
through from wherever the candidate is resolved. Add a test that
materializes candidate A, then materializes a different candidate B for the
same field with a real supersession, and asserts both produce distinct,
correct `Fact` history (with B superseding A), not a silently-skipped
duplicate.

### 3.4 `ShipmentScalarMaterializer`'s new optimistic-concurrency check is unused in practice

**File:** same file, ~lines 127–150; caller at `hydrationWorker.ts` ~131–136.

**Bug:** The CAS logic (`where: { version: expectedVersion }`, `P2025` →
`STALE_SHIPMENT_VERSION`) is real, but `expectedVersion` is optional and the
only real caller, `hydrationWorker.ts`, never passes it — so in the one path
that actually runs, this still falls through to the old blind-write
behavior.

**Fix:** Have `hydrationWorker.ts` fetch and pass the shipment's current
version before materializing, and make `expectedVersion` required (not
optional) for `ShipmentScalarMaterializer` so this can't silently regress to
unguarded writes again.

### 3.5 `ProductAttributeMaterializer` still doesn't exist

**File:** `materializers.ts` / `promotion/promotionPolicyEngine.ts` /
`registry/canonicalRegistryV1.ts` — confirmed absent from all three via
repo-wide grep.

**Fix:** Implement it per Section 5.6 ("creates reviewable product evidence,
not authoritative master-data changes"), or if genuinely out of scope for
this pass, remove any registry field definitions that reference it as their
`materializer` so nothing can silently no-op against a nonexistent
implementation.

### 3.6 "Select alternate candidate" writes a no-op supersession and doesn't demote the prior winner

**File:** `apps/custom/src/modules/hydration/review/fieldReviewService.ts`,
the `SELECT_ALTERNATE` branch (~lines 246–256).

**Bug:** `supersedesCandidateId: candidate.supersedesCandidateId` writes the
candidate's own pre-existing value back onto itself — never the ID of the
candidate actually being replaced. The previously-`PROMOTED` candidate for
that field is never transitioned to `REJECTED`/`SUPERSEDED`, so two
candidates can end up `PROMOTED` simultaneously for one field. It also falls
through into the shared approve path using the caller-supplied `value`
string rather than the selected candidate's own stored value, so nothing
enforces that `value` actually matches `candidateId`.

**Fix:** Look up the field's current winning candidate before writing,
record its real ID as `supersedesCandidateId` on the new one, transition the
old winner's status, and materialize the selected candidate's own stored
value — not an independently-supplied string. Add a test that selects an
alternate and asserts exactly one `PROMOTED` candidate remains for the
field, with a correct supersession chain.

### 3.7 Hardcoded `mockDecision` object for every human-approved materialization

**File:** `fieldReviewService.ts`, ~lines 308–330.

**Bug:** Every APPROVE/EDIT/SELECT_ALTERNATE materialization synthesizes a
fresh object with literal `mappingConfidence: 100, corroborationScore: 100,
calibratedScore: 100, status: "PROMOTED"` instead of deriving these from a
real `PromotionDecision`. This is exactly the kind of fabricated-value
pattern flagged repeatedly in this review — a human approval should produce
an honest decision record, not one dressed up with maximal synthetic scores.

**Fix:** Construct the decision from the actual resolved candidate and a
real "human override" reason code, without inventing numeric scores that
imply automated corroboration/validation never happened.

### 3.8 Dashboard metrics: two of four are still effectively hardcoded

**File:** `apps/custom/src/modules/hydration/rollout/hydrationMetricsService.ts`.

**Bug:** `extractionRecall`/`evidencedFillRate` are now genuinely computed —
good. But `avgLatencyMs` reads `HydrationRun.durationMs`, a column **nothing
in the codebase ever writes** (confirmed via grep of every `hydrationRun`
create/update call site) — so `validDurations` is always empty and this
permanently falls through to a hardcoded `120` (previously `250`; same kind
of defect, different number). `estimatedCostUsd` is unchanged: a flat
`totalRuns * 0.005` guess with no real token accounting.

**Fix:** Set `durationMs` in `HydrationRunEngine` when a run completes
(capture a start timestamp at `createOrGetRun` and compute the delta at the
final status update in `persistProposals`). For cost, either track real
token usage from the mapping stage (once 4.1 below gives you a real model
call to meter) or clearly label this field as an estimate placeholder in its
type/name (e.g. `estimatedCostUsdApprox`) rather than presenting a flat
guess as a real dashboard metric.

### 3.9 `dataMode` columns exist but are completely unused

**File:** schema has `dataMode` on `HydrationRun`/`HydrationCandidate`
(defaulting to `PRODUCTION`), but `hydrationWorker.ts`'s
`ProcessHydrationOptions.dataMode` is declared and never read,
`HydrationRunEngine.CreateHydrationRunParams` has no `dataMode` field at
all, and `HydrationMetricsService`/`ShadowBackfillRunner` never filter or
accept one.

**Fix:** This needs to actually do something, not just exist in the schema.
Thread `dataMode` from the account/request context through
`processDocumentHydration` → `createOrGetRun`/`persistProposals` (persist
it on the row) → `getAccountMetrics`/`runShadowBackfill` (filter by it).
Confirm with whoever owns the broader app-wide `dataMode` fix (referenced in
the design doc's Section 0) that this aligns with that work rather than
diverging from it.

## Group 4 — Still open from round 1, unaddressed

### 4.1 The mapper still isn't an LLM call

**File:** `apps/custom/src/modules/hydration/mapper/structuredFieldMapper.ts`.

**Bug:** The docstring/class naming was made more honest
("Grounded Semantic Candidate Generator" rather than claiming LLM mapping),
which is a real improvement, but the underlying logic is unchanged
deterministic alias/substring matching — no model call, no prompt, no
structured-output parsing exists anywhere in this file. Ambiguous or
unfamiliar document layouts (test-matrix item #1) still cannot be mapped —
only labels that already match a known alias string work.

**Fix:** This is the single largest remaining gap in the whole feature. Wire
in a real structured-output model call per Section 5.3, with the
already-fixed cardinality/confidence/fail-closed infrastructure (D2–D5 from
the previous round) sitting in front of it as the validation layer it was
designed to be. If a full model integration is out of scope for this
specific pass, say so explicitly and track it as a named follow-up — do not
let the honest renaming stand in for the missing capability.

## Test suite: mocking replaced fake-IDs as the "looks covered, isn't" pattern

The previous round's specific false-coverage tests (undefined shipmentIds,
nonexistent IDs) were fixed by using real-looking IDs — but every
replacement assertion across phases 3–6 now uses `vi.spyOn(db.*, ...)`
instead of seeding real Postgres rows and asserting on persisted state,
even though CI runs against a real Postgres instance and phase 1/2 tests
already demonstrate the pattern of targeted real-DB assertions. Concretely:

- The Human Lock test passes real-looking IDs now, but `db.fact.findFirst`
  is mocked, so it proves the branching logic runs, not that the real
  tenant-scoped Prisma query (`shipment: { accountId }`) matches actual
  schema/data.
- The 409 concurrency test now has a correct name and assertion, but
  simulates the Prisma `P2025` error via `mockRejectedValue` rather than
  racing two real writers against one row.
- No test anywhere in phases 3–6 seeds a row, calls the function under test,
  and re-queries the database to check what's actually there.
- No test forces a mid-pipeline failure (e.g. a throw inside the resolver or
  materializer loop) and asserts the `HydrationRun` ends up `FAILED` rather
  than falsely `SUCCEEDED`.

**Fix:** For the highest-risk claims — materializer atomicity (3.1),
idempotency (3.3), detach/recompute (2.1), and the FAILED-on-crash guarantee
— write at least one test per claim that seeds real rows via the test
Postgres instance, invokes the real (non-mocked) code path, and asserts on
what is actually persisted afterward. Mocking is fine for unit-testing pure
logic (normalizers, validators, the calibrated score formula); it is not
sufficient evidence for atomicity, idempotency, or concurrency claims, which
is exactly what's being certified here.

## Required validation

1. Add/extend tests for every item above, per the "seed real rows, assert
   persisted state" standard described in the Test suite section.
2. `npm test --workspace=apps/custom`
3. `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace=apps/custom`
4. ESLint on all changed files.
5. `npx prisma validate` for any schema changes (candidate identity fix,
   durationMs writes, dataMode threading).
6. `git diff --check`.
7. Report each item's status honestly: FIXED (with the test that proves it),
   PARTIALLY FIXED (state exactly what remains), or NOT FIXED (state why, if
   deliberately deferred). Do not report a phase as production-ready while
   Group 1 (production wiring, logging) remains open — those are the
   precondition for everything else mattering.
8. Do not delete a previously-implemented capability to make a defect
   disappear (see Group 2). If a function needs to change shape, change it —
   don't remove it and its test.

Stop after these fixes and request review before starting any new phase.

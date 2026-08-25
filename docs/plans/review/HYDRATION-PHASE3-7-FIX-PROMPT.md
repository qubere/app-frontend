# Antigravity execution prompt — fix Universal Field Hydration Phase 3–7 defects

> Paste this whole file into Antigravity. It targets code committed to PR #83
> in `apps/custom/src/modules/hydration/` by commit `3c12815` ("phase 2 -7 of
> field hydration"), which implements the mapper, validation, promotion,
> resolution, orchestration, review, and rollout layers described in Phases
> 3–7 of `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md`.
>
> **Before touching anything else:** the Phase 1/2 defects from
> `docs/plans/review/HYDRATION-PHASE1-2-FIX-PROMPT.md` are already fixed in
> the working tree as of this writing (uncommitted changes to
> `hydrationRunEngine.ts`, `evidenceLedgerService.ts`,
> `factCanonicalAdapter.ts`, `evidenceInspection.ts`, `registrySlicer.ts`,
> the phase1/phase2 tests, and a Prisma migration adding a unique constraint
> on `HydrationCandidate`). Verify those changes are still present, run their
> tests, and commit them as their own commit before starting on the defects
> below — do not let them get silently reverted or re-mixed into this pass.

## Context

The design doc (Section 10, its own execution prompt) says: *"Ship in small
PRs behind feature flags... For each phase: ...Stop after the current phase
and request review before beginning the next."* Commit `3c12815` instead
implements Phases 3 through 7 — mapper, validator, promotion, resolution,
orchestration, review, and rollout, ~2,000 lines across 20 files — in one
commit with no review gate in between. That is very likely *why* the defects
below compounded undetected: each layer was built against the layer below it
without confirming that layer actually did what its name and docstring
claimed.

A parallel adversarial review (five independent reviewers, one per module
cluster, each required to re-verify every claim against the actual source
before reporting) found that **the orchestration, review, and rollout layers
are not wired into anything and would not run in production even if
deployed**, and that **several modules whose docstrings claim real behavior
(LLM mapping, shadow mode, optimistic concurrency, atomic materialization)
implement none of it**. Every finding below was independently confirmed by
reading the cited lines directly — this is not speculative.

Read `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` in full before editing,
especially invariants #3–#12, Section 5.3–5.7, Section 6, and the Phase 3–7
exit criteria. Fix every item below. Add or extend tests in
`apps/custom/tests/universal-hydration-phase3.test.ts` through
`universal-hydration-phase6.test.ts` for each one, named after the
design-doc test-matrix item (Section 9) it covers where applicable — 20 of
the 32 required test-matrix items currently have **zero** coverage anywhere
in the codebase (see the Test suite section at the end). Do not defer tests
to a later phase.

## Group A — Nothing is actually wired up (fix first; everything else is unreachable until this is fixed)

### A1. The entire hydration pipeline has no caller from the real upload/parse path

**Files:** `orchestration/hydrationWorker.ts`, `rollout/shadowBackfillRunner.ts`,
`review/fieldReviewService.ts`, `rollout/rolloutController.ts`.

**Bug:** `HydrationWorker.processDocumentHydration` has exactly one caller in
the entire codebase — `ShadowBackfillRunner.runShadowBackfill` — and
`ShadowBackfillRunner` itself has zero callers anywhere in `apps/custom/src`.
`FieldReviewService.submitFieldReviewAction` has zero callers — no API route
invokes it. `RolloutController.isHydrationEngineEnabled` /
`isShadowModeEnabled` are referenced only inside `rolloutController.ts` and
its own test. The `DOCUMENT_PARSE_PROMOTED` event named in the design doc's
Section 6 sequence diagram isn't even defined in `ShipmentEventType`
(`apps/custom/src/modules/events/shipmentEventBus.ts`). None of Phases 3–7
run in the real system today; this is design-doc-shaped code sitting next to
the pipeline, not integrated with it.

**Fix:** Wire the pipeline the way Section 6 specifies: the document worker
emits `DOCUMENT_PARSE_PROMOTED` after promoting an active parse version; a
durable, idempotent hydration worker consumes it and calls
`HydrationWorker.processDocumentHydration`; a real API route (with auth +
tenant scoping) calls `FieldReviewService.submitFieldReviewAction`; some
admin surface or scheduled job calls `RolloutController` before hydration
runs, and it must actually gate execution (see A3). If full pipeline cutover
is out of scope for this pass, at minimum wire enough to make every module
below reachable by its own test through the real call path, not just via a
unit test calling the class directly — and say explicitly in your report
which parts remain unwired and why.

### A2. `ShipmentEventBus` is a log, not a queue — explicitly called out in the design doc

**File:** `apps/custom/src/modules/events/shipmentEventBus.ts`, `logEvent`
(~lines 28–42).

**Bug:** `logEvent` is `db.shipmentEventLog.create(...)` wrapped in a
try/catch that `console.error`s and returns `null` on failure — no retry, no
outbox, no dequeue. The design doc says verbatim (Section 6, requirement
#3): *"Add durable outbox events and idempotent workers for hydration. A
log-only ShipmentEventBus row is not a work queue."* `hydrationWorker.ts`'s
`processDocumentHydration` is a single synchronous in-process function call
chain with this log call tacked on the end — there is no outbox anywhere in
this diff.

**Fix:** Introduce a real outbox table (or reuse an existing job-queue
primitive already in this codebase — check `apps/custom/src` for one before
adding a new one) that `DOCUMENT_HYDRATION_PROMOTED` and
`DOCUMENT_PARSE_PROMOTED` get durably enqueued to, with a worker that retries
on failure instead of swallowing it into a `console.error`.

### A3. The "kill switch" and canary rollout gate nothing

**File:** `apps/custom/src/modules/hydration/rollout/rolloutController.ts`.

**Bug:** Confirmed via grep — `isHydrationEngineEnabled` and
`isShadowModeEnabled` are never called from `hydrationWorker.ts`, any API
route, or any queue consumer. Flipping the global kill switch or removing an
account from the canary allowlist currently has no effect on whether
hydration runs.

**Fix:** Call `RolloutController.isHydrationEngineEnabled(accountId)` (and
the shadow-mode check where relevant) at the top of
`HydrationWorker.processDocumentHydration` and any other real entry point,
short-circuiting to the legacy path when disabled. Add a test that flips the
switch off and asserts hydration does not run.

## Group B — Review actions do the opposite of what they claim (fix second — this is user-facing data corruption)

### B1. "Reject" and "Mark not applicable" approve and materialize the value anyway

**File:** `apps/custom/src/modules/hydration/review/fieldReviewService.ts`,
`submitFieldReviewAction` (~lines 140–260).

**Bug:** `action` (`APPROVE | EDIT | REJECT | MARK_NOT_APPLICABLE`) is read
only to choose audit-log wording (lines 179, 207). Every branch —
including `REJECT` and `MARK_NOT_APPLICABLE` — executes the identical
unconditional path: logs an approval-flavored audit event, bumps the
shipment version, creates a `FieldApproval` row with the submitted value,
resolves the document exception, records a `USER_ENTERED` `Fact` and marks
it `isHumanLocked: true`, then calls `MaterializerRegistry.materializeDecision`
with a **hard-coded** `shouldPromote: true, reason: "HUMAN_APPROVED"` mock
decision (lines 228–252). A user clicking "Reject" on a proposed field value
locks it in as a human-approved canonical fact and materializes it — the
exact opposite of the intended action, and it silently overwrites future
correction attempts because the value is now `isHumanLocked`.

**Fix:** Branch on `action` before any write. Only `APPROVE`/`EDIT` should
create the human-locked `Fact` and materialize. `REJECT` should record the
rejection (audit + candidate status `REJECTED`) without locking or
materializing anything. `MARK_NOT_APPLICABLE` should set the field state to
`NOT_APPLICABLE` and resolve any exception, again without materializing a
value. Add a test for test-matrix item #25 that asserts each of the five
actions (approve/edit/reject/select-alternate/not-applicable) produces a
distinct fact/projection/audit/exception outcome — not the same outcome for
all four.

### B2. Optimistic concurrency check is check-then-act, not atomic — never actually returns 409 under real concurrency

**File:** same file, ~lines 153–186.

**Bug:** The function reads `shipment.version` via `findFirst` (line
153–155), compares it to `expectedVersion` (line 162), and only *then*
performs a separate `db.shipment.update({ where: { id: shipmentId }, data:
{ version: { increment: 1 } } })` (lines 183–186) with **no version
predicate in the update's `where` clause**. Two concurrent requests that both
read the same version both pass the equality check and both successfully
increment — last-write-wins, not the required 409. The existing test
(`universal-hydration-phase5.test.ts` ~lines 32–47) is named "returns 409
STALE_SHIPMENT" but actually passes a nonexistent `shipmentId`, hits the
404 branch at line 158, and asserts `toBe(404)` — it does not exercise the
409 path at all, so this bug currently has zero test coverage despite
appearing tested.

**Fix:** Make the update itself the compare-and-swap:
`db.shipment.update({ where: { id: shipmentId, version: expectedVersion },
data: { version: { increment: 1 } } })`, and treat Prisma's
"record not found" result (zero rows matched) as the stale-version 409 case,
not a 404. Add a real test matching test-matrix item #26: two concurrent
reviewers load the same version, the second writer must get 409.

### B3. Field states collapse; several required states are never emitted

**File:** same file, `getShipmentDocumentFieldReview` (~lines 93–109), and
`review/fieldStateGenerator.ts` (~lines 19–50).

**Bug:** `getShipmentDocumentFieldReview` only ever assigns `MISSING`,
`HUMAN_LOCKED`, `CONFLICT`, `PROMOTED`, or `NEEDS_REVIEW` — `UNREADABLE`,
`NOT_APPLICABLE`, and `PROPOSED` (all defined on `FieldState` in
`types/canonicalRegistry.ts`) are never produced; abstained/proposed
candidates get lumped into `NEEDS_REVIEW`, losing the distinction Section 5.7
requires ("distinguish missing, unreadable, not applicable, conflicting,
proposed, auto-promoted, and human-approved"). Separately,
`fieldStateGenerator.ts` declares `FieldExceptionDescriptor` types
`MISSING_REQUIRED_FIELD`, `FIELD_CONFLICT`, and `UNREADABLE_FIELD`, but
`generateDocumentExceptions` only ever emits `MISSING_REQUIRED_FIELD` — the
other two declared types are dead.

**Fix:** Implement the missing state transitions in both files so every
`FieldState` value is reachable and `FIELD_CONFLICT`/`UNREADABLE_FIELD`
exceptions actually get generated when their conditions occur.

### B4. "Select an alternate candidate" review action doesn't exist

**File:** same file, the `action` union (line 147).

**Bug:** Section 5.7 requires five review actions — approve, edit, reject,
select an alternate candidate, or mark not applicable. Only four exist; there
is no way for a reviewer to pick a losing candidate over the current winner.

**Fix:** Add a `SELECT_ALTERNATE` action that takes a `candidateId`, promotes
that candidate instead of the current winner, and supersedes the prior one
with a recorded `supersedesCandidateId` per Section 5.4.

## Group C — Promotion and materialization don't do what the design (or their own docstrings) claim

### C1. No idempotency on materialization — retries duplicate `Fact` rows

**File:** `apps/custom/src/modules/hydration/promotion/materializers.ts`,
~lines 54–68 (`db.fact.create(...)`), and
`apps/custom/src/modules/hydration/orchestration/hydrationWorker.ts` where
it's called (~line 90).

**Bug:** `materializeDecision` unconditionally creates a new `Fact` row on
every call, with no lookup against an existing `Fact` for the same
`(shipmentId, field, candidateId)` first, and `Fact` has no unique constraint
enabling an upsert (`packages/db/prisma/schema.prisma` ~lines 3721–3743 —
`candidateId` exists but is unconstrained). A retried job or duplicate queue
delivery (which A2's real outbox will make routine, since queues redeliver)
produces duplicate `Fact` rows, and for `PartyRoleMaterializer`, a duplicate
`ShipmentPartyService.assignParty` call.

**Fix:** Add a unique constraint (Prisma migration) on `Fact` for
`(shipmentId, field, candidateId)` (or the appropriate entity-scoped key),
and upsert or check-then-skip inside `materializeDecision` before writing.
Add a test that replays the same decision twice and asserts one `Fact`, not
two.

### C2. "Optimistic concurrency" in `ShipmentScalarMaterializer` is a blind write

**File:** `promotion/materializers.ts`, ~lines 86–94.

**Bug:** The design doc (Section 5.6) explicitly requires
`ShipmentScalarMaterializer` to have "optimistic concurrency." The actual
code does `db.shipment.update({ where: { id: shipmentId, accountId }, data:
{ [column]: valStr, version: { increment: 1 } } })` — it bumps `version` but
never reads or compares an *expected* prior version in the `where` clause.
Two concurrent promotions (or a promotion racing a human edit through
`fieldReviewService.ts`) silently last-write-wins.

**Fix:** Thread the version the candidate was resolved against into the
`where` clause (`where: { id, accountId, version: expectedVersion }`) and
treat a zero-row update as a conflict requiring re-resolution, not a silent
success.

### C3. Materializer writes are not transactional — partial failure leaves inconsistent, unaudited state

**File:** `promotion/materializers.ts`, ~lines 54–135.

**Bug:** The `Fact` write, the domain write (`db.shipment.update` /
`ShipmentPartyService.assignParty`), and any audit/provenance record are
separate awaited calls with no `db.$transaction` wrapper and no outbox —
directly contradicting Section 5.6: *"Every materializer writes the
canonical fact, typed projection, provenance, audit event, and any resulting
conflict/exception atomically through an outbox."* If the domain write throws
after the `Fact` row is created, you're left with a `Fact` implying a
promoted value that was never actually applied to the shipment, with no
compensating record.

**Fix:** Wrap each materializer's writes in `db.$transaction`, or route them
through a real outbox pattern if cross-service calls (like
`ShipmentPartyService`) can't share a DB transaction — either way, a partial
failure must not leave a `Fact` row implying success without the
corresponding domain state.

### C4. Rejected/conflicting candidates are silently dropped instead of becoming a visible conflict

**File:** `promotion/promotionPolicyEngine.ts` (~lines 65–72, `CONFLICT`
status → `shouldPromote:false`) and `promotion/materializers.ts` (~lines
37–44, early return on `!shouldPromote`).

**Bug:** `CorroborationConflictResolver` correctly detects disagreeing
documents and tags both candidates `CONFLICT`
(`resolution/corroborationConflictResolver.ts` ~lines 109–118). But once a
decision comes back `shouldPromote:false`, `materializeDecision` returns
immediately with no `Fact`, audit, or exception record of any kind, and
`hydrationWorker.ts` has no handling for `CONFLICT` status at all (grep
confirms no matches for "CONFLICT" outside the resolver/policy files). The
conflict the resolver correctly identified simply vanishes — it never
reaches a human, violating the design doc's explicit requirement that a
conflicting candidate "becomes a visible candidate/conflict," not a silent
drop (this is a silent *drop*, distinct from but as harmful as the silent
*overwrite* the doc also prohibits).

**Fix:** When `shouldPromote:false` because of a real conflict (not just
low confidence), persist a visible conflict record — either an `Exception`
via the existing exception service, or ensure the `HydrationCandidate` rows
already carry `status: "CONFLICT"` are actually surfaced by
`fieldReviewService.ts`'s field-review query (tie this to B3). Add a test
for test-matrix item #12 that asserts a conflict is queryable/visible after
the pipeline runs, not just present in an in-memory return value.

### C5. Missing tenant scoping on the human-lock check

**File:** `promotion/promotionPolicyEngine.ts`, `evaluateCandidate`
(~lines 27–52).

**Bug:** `evaluateCandidate(shipmentId, resolvedCandidate)` takes no
`accountId` parameter, and its `db.fact.findFirst({ where: { shipmentId,
field } })` query has no account filter (`Fact` has no `accountId` column).
Tenant isolation for this check depends entirely on the caller having
already verified `shipmentId` belongs to the right account — the function
itself enforces nothing.

**Fix:** Pass `accountId` through and verify it via the shipment relation
(`db.fact.findFirst({ where: { shipmentId, field, shipment: { accountId } }
})`), matching the pattern already used elsewhere in this module
(`hydrationRunEngine.ts`'s document ownership check).

### C6. Corroboration doesn't require independent documents

**File:** `resolution/corroborationConflictResolver.ts`, ~lines 71–98.

**Bug:** The corroboration branch is guarded by `items.length > 1` and
`uniqueNormValues.size === 1`, but never checks that the distinct document
count (`docIds.length`, already computed via a `Set` on line 79) is greater
than 1. Two proposals from the *same* document with equal normalized values
(e.g. a duplicate extraction pass) get `corroborationScore: 100` and
reasoning text that literally says "Corroborated by 1 independent
documents." This inflated score bypasses
`promotionPolicyEngine.ts`'s `REQUIRES_HIGH_CONFIDENCE_OR_CORROBORATION`
policy (~lines 120–129, which checks `corroborationScore === 0`).

**Fix:** Require `docIds.length > 1` before treating agreement as
corroboration; same-document duplicates should not increase the score.

### C7. Consequential-risk fields can auto-promote from a single document with no policy check

**File:** `resolution/corroborationConflictResolver.ts` (~lines 52–67) and
`promotion/promotionPolicyEngine.ts`.

**Bug:** Any single-document proposal whose validator passes is set to
`status: "PROMOTED"` unconditionally — the field definition's `riskClass`
("LOW" | "MEDIUM" | "CONSEQUENTIAL") and `promotionPolicy` string (both
already defined on `CanonicalFieldDefinition`) are never read anywhere in the
mapper, resolver, or policy engine. Invariant #11 says consequential fields
"keep their existing stronger rules" and are never silently inferred; this
code has no mechanism to special-case them at all.

**Fix:** Have `promotionPolicyEngine.ts` read the field definition's
`riskClass`/`promotionPolicy` and require review (not auto-promotion) for
`CONSEQUENTIAL` fields regardless of single-document validator pass. Add a
test for test-matrix item #15.

### C8. Three of six design-doc materializers are no-op stubs reporting success; one doesn't exist

**File:** `promotion/materializers.ts`, ~lines 119–129.

**Bug:** `LineItemMaterializer`, `TrackingMaterializer`, and
`FilingDraftMaterializer` write only the generic `Fact` row and
unconditionally `return { success: true, factId }` — no `LineItem`,
tracking, or filing-draft table is ever touched, yet the caller has no way to
tell this apart from a real materialization. `ProductAttributeMaterializer`
(named in Section 5.6) doesn't exist in this file or the registry at all —
not even stubbed.

**Fix:** Either implement these materializers for real, or have them return
a distinct result (e.g. `materialized: false, reason: "NO_TYPED_PROJECTION"`)
so callers and the review UI can honestly report "not materialized" per
Section 5.7 and test-matrix item #27, instead of claiming success. Do not
report these as done until at least `LineItemMaterializer` extends the
existing `LineItemReconciler` as Section 5.6 specifies.

## Group D — The "LLM mapper" isn't one, and validation fails open

### D1. `structuredFieldMapper.ts` is deterministic string matching, not an LLM call

**File:** `apps/custom/src/modules/hydration/mapper/structuredFieldMapper.ts`,
~lines 39–61.

**Bug:** There is no model call anywhere in this file. Candidate selection is
`possibleKeys.some(k => item.stableKey === k || item.rawLabel === k ||
item.stableKey.endsWith(...) || item.stableKey.includes(k))` — plain alias
matching. This may be a defensible deterministic v1, but it is presented
(module docstring, design-doc terminology) as "Schema-guided LLM mapping." At
minimum, the naming and docstrings are misleading; more importantly, without
a model doing semantic reasoning, ambiguous or unfamiliar document layouts
(test-matrix item #1, "unknown document layout with unfamiliar labels maps
to known semantic fields") cannot be handled — only labels that already
match a known alias string work at all.

**Fix:** Either wire in an actual structured-output model call as Section
5.3 describes, or rename/re-scope this module honestly as a deterministic
alias-matching fallback and track the real LLM mapper as separate follow-up
work — don't let it stand in for the Phase 3 exit criterion ("≥95% grounded
mapping coverage") since a fixed alias list can't approach that on
unfamiliar layouts.

### D2. The mapper's "fail-closed" unregistered-key check can never trigger

**File:** same file, ~lines 39, 81–83.

**Bug:** `registrySlice` is built by `RegistrySlicer.getSlice()`, which only
ever emits keys already present in `CANONICAL_FIELD_REGISTRY_V1`. The loop
then checks `if (!RegistrySlicer.isRegisteredKey(canonicalKey))` on a
`canonicalKey` that came directly from that same registry — it is registered
by construction and this branch is dead. This isn't the "reject an unknown
field key" protection Phase 3's exit criterion requires, because there's no
free-form model output here to validate against in the first place (a
consequence of D1).

**Fix:** Once D1 introduces real model output, validate *that* output
against the registry (which is where an unknown-key check actually matters),
not the registry's own keys against themselves.

### D3. `targetEntityRef` is never checked against field cardinality

**File:** same file, ~line 70, and `types/canonicalRegistry.ts` (`cardinality:
"ONE" | "MANY"` on `CanonicalFieldDefinition`, defined but never read).

**Bug:** `targetEntityRef` is taken verbatim from `item.groupKey` with no
validation. A field declared `cardinality: "ONE"` can receive multiple
conflicting entity-scoped proposals with nothing rejecting the violation,
contrary to Section 5.3: "Reject the entire proposal item if... its entity
reference violates cardinality rules."

**Fix:** Look up the field definition's `cardinality` and reject/flag
proposals that violate it (e.g. a second distinct `targetEntityRef` for a
`ONE`-cardinality field).

### D4. Hardcoded confidence value presented as a real mapping signal

**File:** same file, ~lines 95, 114.

**Bug:** `mappingConfidence: 95` is a literal constant for every proposal
regardless of match quality — an exact `stableKey` match and a fuzzy
`.includes()` substring match on a line-item key get the identical
"confidence." This value then feeds 40% of the weight in
`calibratedScoreCalculator.ts` (~line 25), meaning the calibrated decision
score that gates auto-promotion is partly built from a made-up constant, not
an independent signal — directly contradicting invariant #6.

**Fix:** Derive a real confidence signal from match quality (exact key match
vs. label match vs. substring/fuzzy match should score differently), or, if
still no real model is involved, use a value that honestly reflects
determinism (e.g. exact matches score high, fuzzy matches score
meaningfully lower) rather than one constant for every match type.

### D5. Calibrated score defaults missing signals to "assume success," not fail-closed

**File:** `validation/calibratedScoreCalculator.ts`, ~lines 19–22.

**Bug:** `input.mappingConfidence ?? 90`, `input.extractionConfidence ?? 90`,
`input.validationScore ?? 100` — any caller that omits a signal gets treated
as if it nearly or fully passed. This is exactly the "hardcoded confidence=100
fallback presented as real validation" pattern Phase 3's exit criteria bans.

**Fix:** Missing signals should default to `0` (fail closed) so an
incomplete evaluation can't accidentally clear the promotion threshold.

### D6. Country normalizer fabricates a plausible-but-wrong code that then passes validation

**File:** `validation/normalizerRegistry.ts`, ~line 39 (`isoCountryNormalizer`)
and `validation/validators.ts`, ~lines 29–32 (`iso2CountryValidator`).

**Bug:** For an unmapped country name, the normalizer falls back to
`str.slice(0, 2)` — e.g. `"SPAIN"` → `"SP"` (the real ISO-2 code is `"ES"`).
The validator only checks the 2-letter-uppercase *format*, so this fabricated
code passes validation and is eligible to auto-promote. This is precisely
test-matrix item #10's failure mode ("invalid format cannot auto-promote")
except the value isn't invalid-*format* — it's wrong-but-well-formed, which
is worse because nothing catches it.

**Fix:** An unmapped country string should normalize to `null` (triggering
`NEEDS_REVIEW`/abstain) rather than a truncated guess. Add a corpus/unit
test with a country name not in the lookup table and assert it does not
silently produce a wrong 2-letter code.

## Group E — Rollout: shadow mode isn't shadow, dashboards show fake numbers

### E1. "Shadow" backfill runs the exact same promotion/materialization path as production

**File:** `apps/custom/src/modules/hydration/rollout/shadowBackfillRunner.ts`,
~lines 34–44.

**Bug:** `runShadowBackfill` calls `HydrationWorker.processDocumentHydration`
with `mapperPromptVersion: "v1.0-shadow"` — a label in a version string is
the *only* shadow marker anywhere. `processDocumentHydration`'s type
signature has no `mode`/`dryRun` parameter at all, and unconditionally runs
`PromotionPolicyEngine.evaluateCandidate` and, when it says promote,
`MaterializerRegistry.materializeDecision`, which does real
`db.fact.create`/`db.shipment.update` writes — the identical path production
hydration uses. A "shadow" backfill run over historical documents can mutate
real canonical data, directly violating invariant #12's spirit (this must
never present as a safe non-mutating comparison when it isn't one) and the
Phase 6 deliverable that shadow runs only "compare proposed/promoted values
to current canonical records," not apply them.

**Fix:** Add an explicit `mode: "shadow" | "live"` parameter threaded from
`runShadowBackfill` through `processDocumentHydration` into
`PromotionPolicyEngine`/`MaterializerRegistry`, and hard-gate every
`db.fact.create`/`update` call behind `mode === "live"`. Add a test that runs
a shadow backfill against a shipment with existing Facts and asserts zero
`Fact` rows were created or modified.

### E2. Metrics dashboard reports hardcoded constants as live numbers

**File:** `apps/custom/src/modules/hydration/rollout/hydrationMetricsService.ts`,
~lines 57, 60, 64–65.

**Bug:** `extractionRecall: 100.0` and `evidencedFillRate: 100.0` are literal
constants never derived from `runs`/`candidates`. `avgLatencyMs: 250` is a
fixed constant — no latency is even recorded on `HydrationRun` to compute it
from. `estimatedCostUsd` is `totalRuns * 0.005`, a flat per-run guess with no
real token-usage accounting. Anyone reading this dashboard during the
"two weeks of canary traffic within agreed accuracy/correction/error
budgets" exit criterion (Phase 6) would be looking at decorative numbers for
at least these four fields.

**Fix:** Compute these from real persisted data (add a `durationMs`/latency
field to `HydrationRun` if none exists, compute recall/fill-rate from actual
candidate outcomes vs. an applicable-fields denominator, track real token
usage if available) or omit the field and mark it `"NOT_YET_MEASURED"`
rather than a plausible-looking placeholder number.

### E3. No `dataMode` isolation anywhere in this module

**File:** entire `hydration/` module — confirmed via grep, zero occurrences
of `dataMode`.

**Bug:** Test-matrix item #30 requires "Production, demo, and sandbox
contexts do not leak across background work." None of
`processDocumentHydration`, `runShadowBackfill`, or `getAccountMetrics`
accept a `dataMode`/environment parameter, and no hydration model
(`HydrationRun`, `HydrationCandidate`, `Fact`, `FieldApproval`) has a
`dataMode` column. A canary rollout or shadow backfill has no way to exclude
demo/sandbox-seeded shipments from its precision/fill-rate numbers, and
nothing prevents a mock/synthetic parse from auto-promoting in production
(test-matrix item #32). This is the same class of gap flagged in the design
doc's own Section 0 review notes about `dataMode` context being missing
app-wide — this new subsystem inherited the gap instead of closing it.

**Fix:** Add a `dataMode` column to `Fact`/`HydrationRun`/`HydrationCandidate`,
thread it through the worker from the account/request context, and filter on
it in `HydrationMetricsService` and `ShadowBackfillRunner`. Confirm with
whoever owns the broader `dataMode` fix (see the design doc's Section 0,
item 2) that this doesn't duplicate or conflict with that work.

### E4. Unscoped cross-tenant `Fact` queries

**File:** `hydrationMetricsService.ts` ~line 31
(`db.fact.findMany({ where: { isHumanLocked: true } })`, no `accountId`
filter — result currently unused, but the query still executes
unrestricted) and `shadowBackfillRunner.ts` ~lines 47–48
(`db.fact.findMany({ where: { shipmentId } })`, never verifies `shipmentId`
belongs to the caller's `accountId`).

**Fix:** Filter both through the shipment relation
(`shipment: { accountId }`) — `Fact` has no direct `accountId` column, so
this must join through `Shipment`.

## Test suite: 20 of 32 required test-matrix items have zero coverage, and some "covered" ones don't test what they claim

A test-quality audit of `universal-hydration-phase3.test.ts` through
`phase6.test.ts` against the design doc's 32-item test matrix (Section 9)
found:

- **Missing entirely (no test anywhere in phases 1–6):** items #2, #3, #6,
  #7, #8, #13, #15, #16, #19, #20, #21, #23, #24, #27, #28, #30, #31, #32 —
  18 items with zero coverage. (#1 and #5 are also present but too weak to
  count as real coverage — see below.)
- **False coverage — the test's own setup prevents the code path it claims
  to test from ever running:**
  - `phase4.test.ts` (~lines 23–49), the "Human Lock Invariant" test, calls
    `evaluateCandidate(undefined, ...)` — with `shipmentId` undefined, the
    DB-backed human-lock branch (`promotionPolicyEngine.ts` ~lines 45–62)
    never executes. The assertion (`isHumanLocked === false`) is trivially
    true because the check was skipped, not because it passed.
  - `phase4.test.ts` (~lines 138–147), the detach test, calls
    `recomputeShipmentFactsOnDetach` with IDs that don't exist in the test
    DB, so the delete/find queries match zero rows and no-op. It only
    asserts `result.detachedDocumentId` echoes back — it proves nothing
    about whether human locks survive or only `EXTRACTED` facts are
    cleared, which is the entire point of test-matrix item #22.
  - `phase5.test.ts` (~lines 32–47) is titled/described as testing "409
    STALE_SHIPMENT" but passes a nonexistent `shipmentId`, hits the 404
    branch before the version check ever runs, and asserts
    `expect(result.status).toBe(404)` — the real 409/optimistic-concurrency
    path (see B2) has never been exercised by CI.
  - `phase4.test.ts` (~lines 132–136) similarly passes `shipmentId:
    undefined` to a materializer test, so `db.fact.create` never runs.
- **No test in phases 3–6 mocks or stubs `db`** (unlike phase 1/2, which use
  targeted `vi.spyOn`), and none seeds real rows or forces a mid-write
  failure — so none of the atomicity (C3), idempotency (C1), or
  human-lock-preservation claims this design doc treats as non-negotiable
  are actually provable by the current suite, even though CI does run
  against a real Postgres instance.

**Fix:** For every defect group above, add a test that (a) seeds real rows
via the actual DB the CI Postgres instance provides, (b) exercises the code
path with valid, existing IDs so the branch under test actually runs, and
(c) asserts on persisted state after the call, not just the return value.
Rename or rewrite the phase5 409 test so its name matches what it tests.
Prioritize closing test-matrix items #14, #22, #25, #26 first since they
correspond directly to Group B/C defects above; then work through the
remaining missing items.

## Required validation

1. Confirm the uncommitted Phase 1/2 fixes are intact and commit them
   separately before starting this pass (see top of this document).
2. Add/extend tests for every defect above, named after the invariant/test-
   matrix item they cover.
3. `npm test --workspace=apps/custom` (targeted hydration tests first, then
   full suite).
4. `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace=apps/custom`
5. ESLint on all changed files.
6. `npx prisma validate` (and generate a migration) for any new unique
   constraint or `dataMode`/`accountId` column additions.
7. `git diff --check`.
8. Report which defects were fixed, with the new/updated test name proving
   each one — don't just claim "fixed," show the test. For any defect you
   could not fully fix in this pass (e.g. if full pipeline wiring in A1 is
   too large), say so explicitly and describe the remaining gap rather than
   silently leaving it half-done.
9. Re-run the design doc's Phase 3–6 exit criteria checklist
   (`docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` Section 8) against what
   you actually shipped and report honestly which criteria are met vs. not
   — do not claim a phase is "done" because its files exist.

Do not fold this into more new phases or start Phase 8+ work in the same
pass. Stop after these fixes and request review, per the design doc's own
instruction in Section 10.

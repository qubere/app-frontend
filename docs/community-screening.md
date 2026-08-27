# Community Screening — Multi-Party Batch RPS + Embargo Orchestration

Community Screening (`src/modules/compliance/communityScreening/`) lets a
compliance user submit a batch of parties (manual entry or file upload) and
runs the *canonical* Restricted Party Screening (RPS) and Country Embargo
engines against every row. It is an orchestration layer, not a seventh
matcher: it never reimplements name/address matching, red-flag keyword
scanning, or embargo rule evaluation — see `evaluator.ts`'s header comment.

## The rule the whole model exists to enforce

A denied-party match and a red-flag keyword hit are independent findings.
Historically a red flag could hide inside a shared "REVIEW_REQUIRED" status
tier and look indistinguishable from an actual candidate match. Community
Screening tracks `restrictedPartyMatchFound` and `restrictedPartyRedFlagFound`
as two separate booleans, computed across *every* RPS pass (party-name and
contact-name), never just the worst-severity one — so a match on one pass and
a red flag on another both surface, and neither silently absorbs the other.
A `restrictedPartyFindingCategory` (`NO_MATCH` / `CONFIRMED_MATCH` /
`POTENTIAL_DENIED_PARTY_MATCH` / `RED_FLAG_ONLY` / `PAL_SUPPRESSED` /
`SKIPPED` / `SYSTEM_ERROR`) gives every row one human-readable label without
collapsing that independence — see `CommunityScreeningFindingCategory` in
`types.ts` and `evaluateRestrictedParty()` in `evaluator.ts`.

A pre-approval (PAL) gate hit is deliberately never presented as an ordinary
`CLEAR` — it never ran the local matcher for that identity at all, so it is
its own status (`PRE_APPROVED_REUSE`) and its own category (`PAL_SUPPRESSED`),
even though both aggregate to `PASSED` when nothing else fails. See
`checkPreApprovalGate()` in `preApproval.ts` and the PAL branch in
`evaluateRestrictedParty()`.

The internal uniqueness key for a screened party is **never the Party ID
alone** — it's `(runId, rowNumber)` on `CommunityScreeningPartyResult`
(`@@unique([runId, rowNumber])`). The same Party ID can legitimately appear
more than once in one batch (e.g. two shipment lines naming the same
supplier), and each occurrence keeps its own independent result row. The one
place that ever collapses occurrence-level rows down to a single
Party-ID-keyed view, for legacy-compatible consumers, is
`deriveLegacyPartyStatusMap()` in `aggregation.ts`, and it is most-severe-wins
by construction: a later `PASSED` occurrence can never overwrite an earlier
`FAILED`/`ERROR`/`INCOMPLETE` occurrence for the same Party ID, regardless of
arrival order. `tests/community-screening-duplicate-party-order.test.ts` is
the standing regression guard for that invariant.

## Data model

Additive migrations only — `packages/db/prisma/migrations/`:
`20260827020000_add_community_screening/`,
`20260827030000_add_community_screening_processing_status/`,
`20260827040000_add_community_screening_finding_categories/`.

| Table | Holds |
| --- | --- |
| `CommunityScreeningRun` | One batch: `checksEnabled` (`restrictedParty`/`embargo`, at least one required), `overrides`, `complianceCountry`, `inputMode` (manual vs. file upload), status/counts, timestamps |
| `CommunityScreeningPartyResult` | One occurrence, keyed by `(runId, rowNumber)` — snapshot identity fields, `restrictedPartyStatus`/`restrictedPartyResultId`, `restrictedPartyMatchFound`, `restrictedPartyRedFlagFound`, `restrictedPartyFindingCategory`, `embargoStatus`/`embargoEvidence`, `aggregateStatus`, `failureReason`, `errorMessage`, `evaluatedAt` |

`CommunityScreeningPartyStatus` includes `NOT_EVALUATED` for forward/legacy
compatibility, guarding against ever reporting a false `PASSED` when nothing
was actually checked — though today `createRun()` already rejects a request
with zero checks enabled, so that branch is defensive and not currently
reachable in the running app.

## Evaluation flow

`evaluateParty()` (`evaluator.ts`), called per row by both the sync path
(`CommunityScreeningService.runSync`) and the async dispatcher below:

1. **PAL gate first.** `checkPreApprovalGate()` — fail-closed. If a valid,
   non-expired, non-revoked pre-approval exists for this exact party identity
   and reference-data version, RPS is short-circuited entirely:
   `PRE_APPROVED_REUSE` / `PAL_SUPPRESSED`, no call to the RPS engine.
2. **Otherwise, run the canonical RPS engine** (`runRestrictedPartyScreening`)
   and persist through the canonical `persistScreeningRun` — the same
   persistence path the standalone Restricted Party Screening feature uses.
   The worst-severity persisted pass (`HIT` > `REVIEW_REQUIRED` > `PARTIAL` >
   `ERROR` > `SKIPPED` > `CLEAR`) becomes the row's `restrictedPartyStatus`;
   `matchFound`/`redFlagFound` are derived independently from every pass's
   `hitCount`/`redFlagCount`.
3. **Embargo**, if enabled: `doEmbargoCheck` against `getAccountEmbargoConfig`,
   screening level `PARTY`. Skips cleanly (`SKIPPED`, never calls the engine)
   when the run's compliance country or the row's snapshot country is
   missing.
4. **Aggregation** (`aggregatePartyStatus` in `aggregation.ts`, pure/testable):
   `ERROR` > `FAILED` (RPS `HIT`/`REVIEW_REQUIRED`, or embargo `HIT`) >
   `INCOMPLETE` (a check was skipped) > `PASSED` (every enabled check landed
   in `CLEAR` or `PRE_APPROVED_REUSE`). A thrown exception from either check
   is caught inside `evaluateParty` and recorded as `ERROR` with a message —
   it never escapes, so one bad row never fails the batch.

A `FAILED` row's `failureReason` names each independent finding —
`describeRestrictedPartyFailure()` can emit both
`"Restricted Party: Confirmed Match"` and `"Restricted Party: Red Flag"` on
the same row, joined by `"; "`, rather than one generic `"HIT"` string.

## Sync vs. async execution

Small/manual runs execute inline (`CommunityScreeningService.runSync`).
Large or file-sourced runs are claimed row-by-row by
`CommunityScreeningDispatcher.dispatchPending()` — an optimistic
`updateMany({ where: { aggregateStatus: "PENDING" }, ... })` claim per row,
the same pattern `ComplianceNotificationDispatcher` uses, so a crashed or
retried tick can never double-process a row. A run is finalized
(`CommunityScreeningService.finalizeRunIfComplete`) once no `PENDING` rows
remain for it.

## RBAC, tenant isolation, audit

Three permissions in the central catalogue
(`packages/auth/src/permissions.ts`): `compliance.communityScreening.read`,
`.screen`, `.override`. Every API route under
`src/app/api/compliance/community-screening/` is wrapped in
`withAuthenticatedRoute`, so `accountId` always comes from the authenticated
session, never a request parameter. The three mutating/exporting routes
(create, rescreen, export) write to the audit log via `createAuditLog`; the
two read-only routes (list, results) deliberately don't.

## Export & Ask Qubere

CSV/XLSX export (`export.ts`) includes the finding-category and red-flag
columns alongside status/failure-reason, so a downloaded file carries the
same independent-findings evidence the UI shows. The assistant tools
`list_failed_community_screening_parties` and
`explain_community_screening_party_failure`
(`src/modules/assistant/tools.ts`) surface `restrictedPartyMatchFound`,
`restrictedPartyRedFlagFound`, and `restrictedPartyFindingCategory` in their
payloads, evidence-only — they read persisted results verbatim and never
re-derive or guess a determination, and license determination is explicitly
out of scope for this feature.

## Deliberately not built

A legacy XML/password-in-body ingestion adapter, the legacy Community
Screening tables, and a `ProcessManager`-style orchestrator were explicitly
out of scope — the canonical RPS/Embargo engines and this occurrence-level
model replace them rather than sit alongside them. `ComplianceExecution`
integration beyond the existing `AuditLog` trail is not wired up.

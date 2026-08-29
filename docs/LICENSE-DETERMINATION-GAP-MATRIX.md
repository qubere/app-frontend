# License Determination & Management -- Implementation Gap Matrix

Tracks implementation status of the "Export/Import License Determination
Management" feature against the originating product prompt. The full
numbered prompt text is not persisted anywhere in this repository; the
section numbers below are the ones referenced from code/schema comments
(`schema.prisma`, `ruleResolver.ts`, `exceptionEvaluator.ts`, etc.) and are
used as anchors for traceability, not a verbatim reproduction of the prompt.

Status legend: **EXISTS** (implemented and wired end-to-end) · **PARTIAL**
(implemented but with a known, intentional limitation) · **MISSING** (not
yet built) · **NOT_APPLICABLE** (deliberately out of scope, see rationale).

## Fail-safe design decision (governs most "NOT_APPLICABLE" rows below)

No jurisdiction-specific regulatory rule datasets (US/EU country export
control matrices, license exception eligibility tables, end-use/encryption/
replacement-parts-license rule sets, ECCN/USML/Schedule-B/ICN authoritative
reference data) have been ingested into this repository. Only
`CommerceControlList` exists as ECCN/CCL master data (id/description/
country/licensable flag only -- no rule logic).

Per the prompt's fail-safe rule (referenced in `schema.prisma` as section
103 and in `ruleResolver.ts` as sections 9-21), the determination engine
**never fabricates** a `LICENSE_REQUIRED` / `NO_LICENSE_REQUIRED` outcome
in the absence of authoritative rule data. It returns `RULE_DATA_UNAVAILABLE`,
`INCOMPLETE`, or `REVIEW_REQUIRED` instead, with full evidence of what was
and wasn't evaluated. Any prompt requirement that depends on an actual
jurisdiction-specific control determination (e.g. "system determines no
license is required for shipments to Country X under License Exception Y")
is therefore `NOT_APPLICABLE` until those datasets are sourced and ingested
-- doing otherwise would risk presenting an unverified legal conclusion as
fact.

## Core determination engine

| Area | Status | Notes |
|---|---|---|
| Deterministic rule-routing core (sections 9-21) | EXISTS | `ruleResolver.ts` -- pure function, ordered fail-safe checks, no I/O. |
| Classification format validation (sections 6-8) | EXISTS | `classification.ts` -- structural regex validation for ECCN/USML/HTS/SCHEDULE_B/ICN. Does NOT validate against a controlled-item list (none ingested). |
| Tri-state end-use/end-user condition handling (section 12) | EXISTS | `conditions.ts` -- UNKNOWN never collapses to false. |
| Sensitive end-use hard-stop to REVIEW_REQUIRED | EXISTS | Any TRUE sensitive flag (government/military/nuclear/missile/CBW end-use or military end-use country) always routes to `REVIEW_REQUIRED`, regardless of rule data availability. |
| Explicit license-exception claim evaluation (section 18) | EXISTS | `exceptionEvaluator.ts` -- applies only to `finalDecision`, never over hard-safety statuses, never determines eligibility itself. |
| Actual jurisdiction-specific control determination (country export-control matrices, EU rules) | NOT_APPLICABLE | No rule dataset ingested -- see fail-safe section above. |
| ECCN/USML/Schedule-B/ICN authoritative reference/control lookup | NOT_APPLICABLE | Only `CommerceControlList` master data exists; no rule-eligibility logic tied to it. |
| Encryption self-classification / RPL eligibility rules | NOT_APPLICABLE | No encryption or replacement-parts rule dataset ingested; encryption items with unknown self-classification route to `INCOMPLETE`. RPL assertions are recorded in evidence but not acted upon. |
| Reviewer disposition / override workflow (section 5) | EXISTS | `determinationService.reviewLicenseDetermination` -- never overwrites `baseDecision`, audit-logged before/after diff. |

## License Management (portfolio, utilization, allocation)

| Area | Status | Notes |
|---|---|---|
| License header CRUD | EXISTS | `POST/GET/PATCH/DELETE /api/compliance/licenses[/:id]`. `DELETE` performs a soft-close (`status: CLOSED`, audit-logged, `licenses.delete`-gated) rather than a destructive delete -- the record is never removed. |
| License lines, parties, documents, notes | EXISTS | Dedicated sub-resource routes; document upload reuses `@qubere/storage` via `storeDocumentFile`. Document Intelligence extraction fields are schema-ready (`extractedFields`, `verified`) but no extraction pipeline is wired yet. |
| Utilization ledger (event-sourced) (sections 33-36) | EXISTS | `utilizationService.ts` -- single writer, idempotent dedupe key (`accountId, licenseLineId, eventType, transactionId, transactionLineId`), optimistic concurrency via `version` CAS update in a Serializable transaction. |
| Reason-required adjustments | EXISTS | `postLicenseAdjustment` -- requires non-empty `reason`, before/after snapshots persisted. |
| Applicability / candidate license lookup (section 37) | EXISTS | `applicabilityService.findApplicableLicenses` -- never auto-selects a license. |
| Allocation reservation/release (section 38) | EXISTS | `allocationService.ts` -- reservation posts an `ASSIGNMENT` ledger event first so allocation and ledger state cannot drift; release posts a `RELEASE` event. |
| Expiry / utilization-threshold alerts (sections 47-48) | EXISTS | `alertsService.ts` -- computed on demand plus a daily cron (`/api/cron/license-alerts`) delivering via the existing email provider abstraction. |
| Reports catalog integration (section 50) | EXISTS | Added to the existing Compliance Reporting catalog/query framework (no separate handlers): `license-determination`, `license-inventory`, `license-utilization`, `expiring-licenses`, `license-events-adjustments`. |
| RBAC permissions | EXISTS | 14 permissions under category "Compliance" in `packages/auth/src/permissions.ts` (`licenseDetermination.*`, `licenses.*`). |
| UI -- determination form + explainability | EXISTS | `/app/license-management` "Run Determination" tab: shows status, base vs. final decision, reason, missing inputs. |
| UI -- license portfolio list/detail | EXISTS | `/app/license-management` (list + create) and `/app/license-management/[id]` (lines, parties, documents, add-line, post-event, post-adjustment, reserve allocation, attach party, upload document, close license). |
| UI -- alerts view | EXISTS | `/app/license-management` "Alerts" tab. |
| UI -- adjustment posting, allocation reserve/release, party/document management forms | EXISTS | `LicenseDetailClient.tsx` -- per-line "Adjust"/"Allocate" modals, header "Attach Party"/"Upload"/"Close License" actions, all gated by their respective permissions. |
| Dedicated utilization-history list endpoints (events/adjustments by line) | EXISTS | `GET /api/compliance/license-lines/[id]/events`, `.../adjustments`, and `.../allocate` (list allocations) -- each scoped by `accountId`, newest first, `licenses.view`-gated. |
| License closure / delete endpoint | EXISTS | `DELETE /api/compliance/licenses/[id]` -- soft-close to `status: CLOSED`, `licenses.delete`-gated, audit-logged with previous status + optional reason. Rejects if already `CLOSED` (409). |

## Testing

| Area | Status | Notes |
|---|---|---|
| Unit tests (classification, conditions, rule resolver, exception evaluator) | EXISTS | 26 tests across `tests/license-classification.test.ts`, `license-conditions.test.ts`, `license-rule-resolver.test.ts`, `license-exception-evaluator.test.ts`. |
| Concurrency/dedupe tests (utilization ledger) | EXISTS | `tests/license-utilization-concurrency.test.ts` -- 7 tests covering duplicate-event replay (dedupe), the dedupe lookup's scoping keys, CAS `updateMany` version-conflict handling for both events and adjustments, Serializable isolation, and the adjustment reason requirement. |
| API route / RBAC / IDOR tests | EXISTS | `tests/license-api-tenant-isolation.test.ts` -- source-scan test (pattern mirrors `audit-package-tenant-isolation.test.ts`) asserting every license route uses `withAuthenticatedRoute`, declares a `permission`, never resolves a license/licenseLine/licenseDeterminationResult via bare `findUnique(id)`, and scopes every `findFirst(params.id)` lookup with `accountId`; plus checks on the `license-alerts` cron route's `withCronRoute`/`runWithAccountId` usage. |

## Validation performed

- `npx prisma validate` -- passed.
- `npx prisma generate` -- succeeded.
- `npx tsc --noEmit` (full `apps/custom` project) -- 0 errors.
- Per-file IDE diagnostics on all new modules -- no errors found.
- `npx vitest run` on all 6 license test files -- 40/40 tests passed.

All previously tracked gaps are now closed; remaining `NOT_APPLICABLE` rows
are intentional per the fail-safe design decision above (no jurisdiction-
specific rule datasets have been ingested).

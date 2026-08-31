# Compliance & Reporting — Feature Inventory

This document catalogs every feature under the **Compliance & Reporting**
workspace (`apps/custom/src/app/app/compliance/**`), backed by
`apps/custom/src/modules/compliance/**`, `modules/complianceBatch/**`,
`modules/agents/compliance/**`, and `modules/reports/**`.

The workspace is a single tabbed UI (`ComplianceWorkspaceClient.tsx`); each
tab below is gated by a permission check passed down as a boolean prop from
`page.tsx`.

## Tab / Feature Map

| Tab | Component | Gating Permission |
|---|---|---|
| Overview | `OverviewPanel.tsx` | always visible |
| Screening (Findings) | `ScreeningPanel.tsx`, `ComplianceFindingsClient.tsx` | `compliance.read` / party screening read |
| Audit / Execution History | `AuditHistoryPanel.tsx`, `ExecutionHistoryPanel.tsx` | `audit.read` / `compliance.read` |
| Notifications | `NotificationSettingsPanel.tsx` | `compliance.restrictedParty.settings.manage` |
| Community Screening | `CommunityScreeningPanel.tsx` | `compliance.community_screening.read` (+ `.override`) |
| Continuous Party Monitoring (RDPS) | `RdpsPanel.tsx` | `compliance.rdps.read` (+ `.manage`) |
| Bulk Compliance Screening | `BulkScreeningPanel.tsx` | `compliance.bulk_screening.view` (+ `.create`) |
| Reports | `ComplianceReportsClient.tsx` | `compliance.reports.view` (+ `.generate`, `.manage`) |

---

## 1. Restricted Party Screening (RPS)

Location: `modules/agents/compliance/restrictedParty/`.

- Screens transaction parties (importer, exporter, consignee, etc.) against
  denied/restricted-party reference lists (OFAC SDN, BIS Entity/Unverified
  lists, UFLPA Entity List, Dow Jones, etc. — see reference-data ingestion
  services below).
- Fuzzy name/address matching with configurable **name threshold**,
  **address threshold**, **country-match required**, and **red-flag check**
  overrides (gated by `compliance.community_screening.override` when run via
  Community Screening; similar overrides exist in the canonical RPS engine).
- Produces a per-party `RestrictedPartyScreeningResult` with automated result
  status: `CLEAR | HIT | REVIEW_REQUIRED | PARTIAL | ERROR`, hit count, red
  flag count, matcher version, and reference-data-as-of version for
  reproducibility/audit.
- Reviewer disposition workflow: hits/review-required results can be
  reviewed and resolved from the Screening/Findings tab.
- Party Red Flag checks (military end-use/end-user red flags) are tracked
  alongside RPS but persisted to the same `RestrictedPartyScreeningResult`
  table rather than the generic `ComplianceScreeningFinding` table.
- Drives downstream **notifications** (RPS hit alerts, PAL re-screen alerts)
  and the **Continuous Party Monitoring (RDPS)** re-screening pipeline.
- Reportable via the "Restricted Party Screening" and "Party Compliance"
  report catalog entries (see Reporting section).

## 2. Pre-Approved Party Lists (PAL)

Location: `modules/agents/compliance/restrictedParty/preApproval.ts`, docs in
`docs/pre-approved-party-list.md`.

- Lets a compliance user record that a specific party identity has already
  been cleared, so a future screening pass can **reuse** that decision
  instead of re-running the RPS engine — but only when reuse is provably
  still safe. The gate is **fail-closed**: any ambiguity resolves to
  "screen again," never to "assume clear."
- Single reuse-eligibility check, `checkPreApprovalGate()`, called
  identically from the standalone RPS flow and from Community Screening's
  `evaluateParty()` (no reimplementation). Returns a reuse hit only when
  **all** of the following hold against the active `PartyScreeningApproval`:
  - **Identity hash match** — hash of name/address/country at approval time
    must match today's snapshot.
  - **Party version match** — stored `partyVersion` must equal the party's
    current version; editing a party invalidates its own approvals.
  - **Reference-data freshness** — the approval must be no older than the
    reference data the current screening run would use.
  - **Not expired** — `expiresAt`, if set, must be in the future.
  - **Not revoked** — `status` must still be `ACTIVE`.
- **One-at-a-time API**: create
  (`POST /api/v1/parties/[partyId]/restricted-party-screening/pre-approval/**`,
  permission `compliance.restricted_party.approve`) and revoke (same path,
  permission `compliance.restricted_party.revoke`), both scoped to the
  authenticated account via `withAuthenticatedRoute`.
- **Bulk import** (`PRE_APPROVED_PARTY_IMPORT` batch type, CSV only, via
  `modules/complianceBatch/palImportParser.ts`): each valid row becomes a
  `BatchRecord` the dispatcher feeds through the exact same
  `createPreApproval()` used by the one-at-a-time API — never a
  reimplementation and never a shortcut. The parser only validates row
  *structure* (party ID / reason / expiresAt columns); partyId existence,
  identity, and reference-data freshness are all re-checked at processing
  time. Gated by `mayImportPreApprovals`. PAL import rows never touch
  RPS/License/Embargo/Classification screening themselves.
- A PAL hit inside Community Screening short-circuits the RPS engine and is
  recorded as its own status (`PRE_APPROVED_REUSE`) / finding category
  (`PAL_SUPPRESSED`) — distinct from an ordinary `CLEAR`, even though both
  aggregate to a passing outcome.
- **No scheduled expiry sweep** — an approval with `expiresAt` simply stops
  matching once that moment passes; nothing proactively flips its `status`.
  A revoked approval's row is retained (soft state) for a permanent audit
  trail of who approved and who later revoked it.
- Every approval creation, revocation, and gate reuse decision is captured
  via `createAuditLog`.
- Drives the **PAL re-screen alert** notification recipient list
  (`rpsPalRescreenRecipients`) and is tracked in RDPS outcome records
  (`hadActivePreApproval`) and the RDPS export.

## 3. Embargo Screening

Location: `modules/agents/compliance/embargo/`.

- **Country Embargo Screening**: deterministic, per-shipment-line check of
  compliance/ship-from country against destination/screened country,
  evaluated with matcher precedence:
  1. **Private** — account-specific `PrivateEmbargoRule` table (tenant-owned
     rules), when `privateEmbargoEnabled` for the account.
  2. **Generic** — global country-by-country / country-group / CY-CCG /
     Commerce Control List (ECCN) reference data.
- Produces a decision per line: `P` (pass) / `F` (fail/hit), with rule/rule
  ID provenance, decision source ("Decision Source": Private vs. Generic),
  and ECCN + Military End-Use context where applicable.
- **Ad-hoc pair check** (`adHocPairCheck.ts`): a walk-up country-pair check
  independent of a shipment, for "is X embargoed to Y" style questions
  (used by the AI assistant tool `screen_shipment_embargo`).
- **Private Embargo Rule management**: tenant-scoped CRUD + conflict
  detection (`privateEmbargoRuleRepository.ts`) — lets an account define its
  own embargoed country pairs beyond the generic/global rule set.
- Audit persistence via header+detail pattern (`EmbargoUsageHeader` /
  `EmbargoUsageLine`), with usage/audit context builder helpers.
- Account-wide **"Run screening" sweep** button on the Embargo sub-tab
  (gated by `ai.use`) to bulk re-run embargo screening.
- Reportable via the "Embargo Screening" report catalog entry.

## 4. Other Deterministic Compliance Screening Checks

All screened via the same `complianceAuditAgent.ts` orchestrator and
persisted to the generic `ComplianceScreeningFinding` table (bucketed by
`ScreeningBucket`), surfaced together in the Screening/Findings tab and
Overview severity counts:

- **UFLPA / Forced Labor** (`forcedLabor/`) — matches against the UFLPA
  Entity List / forced-labor regime reference data; result codes follow the
  same HIT/PARTIAL pattern as Country Embargo Screening.
- **End-Use Restriction** (`endUse/`) — e.g. military end-use red flags.
- **End-User Restriction** (`endUser/`) — e.g. military end-user red flags.
- **Anti-Boycott** (`antiBoycott/`) — reuses embargo country resolution for
  boycotting-country determination.
- **Military End-Use** / **Military End-User** — dedicated buckets distinct
  from the generic end-use/end-user restriction checks.
- Each finding carries severity (`CRITICAL/HIGH/MEDIUM/LOW`), rule,
  description, recommendation, confidence score, and assignment/resolution
  workflow (assignee, resolvedAt).
- **SCREENING_GAP** rows: surfaced when a check couldn't run (e.g. missing
  country data) — bucketed heuristically from the gap's rule name so gaps
  still appear under the correct sub-tab.

## 5. License Determination & Management

Location: `modules/licenses/` (referenced from Compliance for reporting/
notifications; full license workspace lives outside this doc's scope).

- Export/import **license determination** engine: base decision vs. final
  (post-exception/override) decision, with statuses including
  `LICENSE_REQUIRED`, `NO_LICENSE_REQUIRED`, `LICENSE_EXCEPTION_APPLIES`,
  `REVIEW_REQUIRED`, `INCOMPLETE`, `INVALID_CLASSIFICATION`,
  `UNSUPPORTED_JURISDICTION`, `RULE_DATA_UNAVAILABLE`, `BLOCKED`, `ERROR`.
- **License inventory** (header, agency, jurisdiction, status, effective/
  expiration dates, line count) and **license utilization ledger**
  (licensed/committed/shipped/adjusted quantities & values per line, with
  remaining capacity).
- **Expiring Licenses** monitoring and **License Events & Adjustments**
  (merged utilization ledger + reason-required adjustments).
- License-specific **notifications** (`licenseNotificationService.ts`,
  `licenseEligibility.ts`) alongside RPS notifications.
- Usage metering: `LICENSE_DETERMINATION_COMPLETED` and
  `LICENSE_UTILIZATION_EVENT_POSTED` billing events.
- Formal overrides supported (see Formal Compliance Overrides below).

## 6. Community Screening

Location: `modules/compliance/communityScreening/`.

- Ad-hoc/bulk screening of a **community of parties** (not tied to a single
  shipment) against the existing RPS and Embargo engines — never duplicates
  matching logic.
- Three input modes:
  - **Direct Entry** — parties typed/pasted in directly.
  - **Party Master** — select existing parties by ID from Party Master.
  - **File Upload** — CSV / XLSX / JSON file of parties.
- Per-run **checks enabled** toggle: Restricted Party and/or Embargo
  (independently switchable).
- Per-run **overrides** (name threshold, address threshold, country-match
  required, red-flag check enabled) — only settable when the actor holds
  `compliance.community_screening.override`.
- Explicitly **out of scope**: License Determination is never evaluated by
  Community Screening and is always labeled "not evaluated" in results
  (never inferred as a pass).
- Run lifecycle: `CommunityScreeningRun` with status tracking, aggregated
  per-party outcomes (pass/hit/review/error counts).
- **Export** of run results (party name, embargo status, RPS status, etc.)
  to file.
- Dispatcher for sync/async execution split depending on batch size.

## 7. Bulk Compliance Screening (Batch)

Location: `modules/complianceBatch/`, UI at
`apps/custom/src/app/app/compliance/bulk-screening/` and as a workspace tab.

- CSV/XLSX/XML/JSON **batch upload** of shipment/party records for combined
  **RPS + License Determination** screening (and Embargo where applicable).
- Batch types include a dedicated **Pre-Approved Party List (PAL) import**
  parser (`palImportParser.ts`) — PAL import rows skip RPS/License/Embargo/
  Classification entirely; each row just creates a pre-approval record (see
  section 2, "Pre-Approved Party Lists (PAL)", for the full feature).
- Per-batch **column mapping** (`columns.ts`) with validation (e.g. embargo
  screening requires destination/compliance-country columns present).
- **Validation errors** file generated at upload time (if any invalid rows)
  and **Results** + **Processing Summary** files generated at finalize —
  both via best-effort `storeGeneratedFile` (never blocks batch create/
  finalize on failure).
- Batch list view with **status / batch type / search filters**; detail view
  with a per-record table and click-to-open record detail modal (shows
  normalized input, RPS result ID, License Determination result ID, error
  code).
- **Retention/expiry sweep**: age-based cleanup of terminal-status batches
  via a scheduled cron job, with optimistic per-row claiming.
- Gated by `compliance.bulk_screening.view` (read) and
  `compliance.bulk_screening.create` (upload).

## 8. Continuous Party Monitoring (RDPS — Reference Data-driven Party Screening)

Location: `modules/compliance/rdps/`, docs in
`docs/rdps-continuous-monitoring.md`.

- Automatically **re-screens parties** whenever underlying restricted-party
  reference data (watchlists) changes, so a party's compliance status stays
  current without waiting for the next transaction.
- Two dispatch modes:
  - **Delta Impact** — triggered by specific `ReferenceDataChangeSet` rows
    (targeted re-screen of only affected parties), batch size configurable
    via `RDPS_DELTA_IMPACT_BATCH_SIZE` (default 200).
  - **Full Population** — periodic sweep re-screening the entire party
    population, keyset-paginated so a long sweep resumes across many
    scheduler ticks; batch size via `RDPS_FULL_POPULATION_BATCH_SIZE`
    (default 100).
- **Recall validation** — a daily scheduled job validates a bounded sample
  (`RDPS_RECALL_VALIDATION_SAMPLE_SIZE`, default 500) of recent outcomes;
  the post-Full-Population validation pass is exhaustive.
- Tracks **status transitions** per party (previous vs. new RPS status),
  flags **escalations** (`isWorsening`) vs. risk reduction, tied to a
  specific `runId`.
- **Export** of RDPS run outcomes (`rdpsExport.ts`).
- Query service for browsing monitoring history (`rdpsQueryService.ts`).
- Gated by `compliance.rdps.read` (view) and `compliance.rdps.manage`
  (trigger scans / record dispositions).
- Reportable via "Party Compliance", "Continuous Party Monitoring", and
  "Reference Data Changes" report catalog entries.

## 9. Reference Data Ingestion (Watchlist Management)

Location: `modules/compliance/*IngestionService.ts`.

- **OFAC SDN** ingestion (`ofacSdnIngestionService.ts`).
- **BIS Entity List / Unverified List** ingestion (`bisCslIngestionService.ts`
  — Commerce Control List / consolidated screening list).
- **UFLPA Entity List** ingestion (`uflpaEntityListIngestionService.ts`).
- **Dow Jones** watchlist integration (`dowJones/`).
- **Entity hashing** for dedupe/change detection (`entityHash.ts`).
- **Reference data change tracking** (`referenceDataChangeTracking.ts`) —
  records additions, updates, supersessions, and expirations per source
  list; feeds the RDPS Delta Impact dispatcher and the "Reference Data
  Changes" report.
- **Reference data expiry sweep** (`referenceDataExpirySweep.ts`) — expires
  stale reference data records on a schedule.

## 10. Formal Compliance Overrides

- Domain-agnostic override mechanism (`ComplianceFormalOverride`) usable
  across all compliance domains (RPS, Embargo, License, Classification,
  etc.).
- API: `POST /api/v1/compliance/overrides` (create),
  `POST /api/v1/compliance/overrides/[id]/revoke` (revoke); permission
  `compliance.override`.
- UI: inline create-override form + per-override revoke control inside the
  "Formal Overrides" section of the Execution History detail modal, gated
  by `mayCreateFormalOverride`.
- Every override preserves the **original automated decision** alongside
  the override decision and reason — never silently replaces it (see
  "Compliance Exceptions & Overrides" report).

## 11. Notifications

Location: `modules/compliance/notifications/`.

- **Queue-then-dispatch** pattern: `evaluateAndQueue` queues a
  `ComplianceNotification` transactionally alongside the triggering result;
  actual sending happens asynchronously via
  `ComplianceNotificationDispatcher`. Idempotent by construction (unique
  constraint on `screeningResultId` + `notificationType`).
- **Eligibility rules** (`eligibility.ts`) — per-account
  `AccountScreeningConfig` controls whether a notification is sent or
  suppressed (with a `RPS_NOTIFICATION_SUPPRESSED` audit log entry when
  suppressed).
- Configurable **notification settings** (Notifications tab,
  `NotificationSettingsPanel.tsx`), gated by
  `compliance.restrictedParty.settings.manage`:
  - Enable/disable RPS email alerts (`rpsEmailAlertsEnabled`).
  - Separate recipient lists: general (`rpsGeneralRecipients`), hit alerts
    (`rpsHitRecipients`), and PAL re-screen alerts
    (`rpsPalRescreenRecipients`).
  - Email format: `HTML` or `TEXT`.
  - **Secure email** mode (`rpsSecureEmailEnabled`) — sends a secure-review
    link instead of embedding sensitive match details directly in the email
    body (see `templates/secureTemplate.ts`, `buildSecureReviewUrl.ts`).
  - Global suppress switch (`rpsSuppressEmailAlerts`).
- **Notification templates** (`templates/`): secure vs. non-secure HTML/text
  templates, license-specific templates, shared label lookups, HTML
  escaping helpers.
- **License notifications** (`licenseNotificationService.ts`,
  `licenseEligibility.ts`) follow the same eligibility/queue pattern.
- Recipient resolution logic (`recipients.ts`) — resolves who actually
  receives each notification type per account.

## 12. Audit History & Execution History

- **Audit History** (`AuditHistoryPanel.tsx`) — chronological audit log of
  compliance-relevant actions (`createAuditLog` calls across the compliance
  modules), gated by `mayReadAuditHistory`.
- **Execution/Service Usage History** (`ExecutionHistoryPanel.tsx`,
  `modules/compliance/executionHistory.ts`) — records **one row per
  compliance-check invocation** (RPS, Embargo, License Determination,
  Classification, etc.) via `recordComplianceExecution`, linking screening
  findings back to their triggering execution (`linkScreeningFinding`).
  Also hosts the Formal Overrides section (see above). Gated by
  `mayReadExecutionHistory` (`audit.read` or `compliance.read`).
- Execution query helper (`executionQuery.ts`) computes whether an execution
  has been "reviewed" (has at least one linked, resolved
  `ComplianceScreeningFinding`) — domains with no linked findings (RPS,
  Embargo) are, by definition, never "reviewed" under this metric.

## 13. Service Usage / Billing Metering

- Every billable compliance action records a usage event via
  `recordUsageEvent({accountId, eventCode, quantity, sourceFunction,
  idempotencyKey, ...})`, always wrapped in try/catch (billing must never
  block the main operation).
- Tracked event codes include (non-exhaustive):
  `COMPLIANCE_REPORT_GENERATED`, `LICENSE_DETERMINATION_COMPLETED`,
  `LICENSE_UTILIZATION_EVENT_POSTED`.
- Idempotency enforced via a stable, derivable `idempotencyKey` so retries
  never double-bill (e.g. ledger replay dedup for license utilization
  events).
- Surfaced to users via the "Service Usage" tab (Execution History) for
  transparency into what has been billed/metered.

## 14. Reporting

Location: `modules/reports/` (`catalog.ts`, `generate.ts`, `delivery.ts`,
`scheduler.ts`, `queries/`, `export/`).

Single source of truth is `REPORT_CATALOG` — every report's id, domain,
supported formats, filters, and columns are declared there; adding a report
requires a catalog entry + a query file registered in `REPORT_QUERIES`.

### Available reports

| Report | Domain | Formats | Description |
|---|---|---|---|
| Compliance Audit | Audit & Governance | CSV, XLSX, PDF | Audit-ready record of compliance decisions, evidence, reviews, overrides, users, timestamps |
| Screening Activity | Screening | CSV, XLSX | Summary/detail of all party screening activity across screening types |
| Restricted Party Screening | Screening | CSV, XLSX | Detailed RPS results with match evidence and reviewer disposition |
| Embargo Screening | Screening | CSV, XLSX | Embargo/country-control decisions per shipment line, with rule provenance |
| Party Compliance | Continuous Monitoring | CSV, XLSX | Current compliance posture per party (RPS status, pre-approval, monitoring state) |
| Continuous Party Monitoring | Continuous Monitoring | CSV, XLSX | RDPS re-screening outcomes: transitions, escalations, risk reduction |
| Reference Data Changes | Continuous Monitoring | CSV, XLSX | Watchlist ingestion changes: additions/updates/supersessions/expirations |
| Compliance Exceptions & Overrides | Audit & Governance | CSV, XLSX, PDF | Every human override of an automated decision, original decision preserved |
| Classification Decisions | Product Classification | CSV, XLSX | Attested HTS classification decisions with rationale, overrides, effective dates |
| License Determination | Licenses | CSV, XLSX | License determination results, base vs. final decision, reviewer disposition |
| License Inventory | Licenses | CSV, XLSX | Managed license portfolio header/status/jurisdiction/line count |
| License Utilization | Licenses | CSV, XLSX | Per-line licensed/committed/shipped/adjusted ledger totals & remaining capacity |
| Expiring Licenses | Licenses | CSV, XLSX | Active/suspended licenses approaching or past expiration |
| License Events & Adjustments | Licenses | CSV, XLSX | Merged utilization ledger events + reason-required adjustments |

### Reporting capabilities

- **Ad-hoc generation** with per-report filters (date range, text, select,
  multi-select, boolean) declared in the catalog.
- **Scheduled reports** (`scheduler.ts`): create/update/delete schedules,
  pause/resume, and run-now, all audit-logged.
- **Report definitions**: saved filter/format configurations, with
  create/update/delete lifecycle (audit-logged).
- **Delivery** (`delivery.ts`) of generated reports (e.g. email/download).
- **Export** formats: CSV, XLSX, and PDF (audit/exceptions reports only).
- Usage metering (`COMPLIANCE_REPORT_GENERATED`) and structured logging on
  both success and failure paths of report generation.
- Gated by `compliance.reports.view` (read), `.generate` (run reports), and
  `.manage` (definitions/schedules).

---

## Cross-cutting conventions

- **Tenant isolation**: every route enforces `accountId` scoping via
  `withAuthenticatedRoute`; tenant-isolation is verified by source-scan
  tests (`tests/*-tenant-isolation.test.ts`).
- **Never block on side effects**: billing/usage metering, file generation,
  and notification queuing are all best-effort (try/catch, never throw into
  the main compliance operation).
- **Audit trail everywhere**: every create/update/delete/override/schedule
  action across Compliance & Reporting writes an audit log entry via
  `createAuditLog`.
- **Reference-data reproducibility**: screening results record matcher
  version and reference-data-as-of version so a past result can always be
  explained against the data that produced it.

# Qubere - Enterprise AI Trade Compliance Platform

**Qubere** is an enterprise-grade AI-native trade compliance platform designed for customs and trade-compliance teams to turn commercial invoices, packing lists, and product data into evidence-backed, review-ready import decisions before filing.

This repository contains the **Phase 1 Multi-Tenant SaaS Application Foundation**, featuring enterprise identity management, account-based tenancy, fine-grained Role-Based Access Control (RBAC), Clerk authentication, Supabase PostgreSQL database models, security audit logging, and the Qubere Platform Admin Console.

---

## 🧩 Shared Platform Capabilities Directive

To prevent code duplication, maintain consistent security, and enforce unified auditing across the monorepo, **all developers must consume shared platform capabilities** instead of building local helper implementations in individual apps/modules:

- **[PLATFORM_CAPABILITIES.md](file:///Users/rachitlohani/Documents/GitHub/app-frontend/PLATFORM_CAPABILITIES.md)** — Complete Guide to Shared Platform Capabilities (`PlatformEmailService`, `@qubere/auth`, `@qubere/storage`, `@qubere/db`, `@qubere/ai`).

---

## 🛠 Technology Stack

- **Framework**: Next.js 16 (App Router, Server Components, Turbopack)
- **UI**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Apple Light Design System (`#F5F5F7`, `#1D1D1F`, `#0071E3`)
- **Authentication**: Clerk Authentication (`@clerk/nextjs`, `@clerk/backend`)
- **Database & ORM**: Supabase PostgreSQL + Prisma ORM (`@prisma/client`)
- **Testing**: Vitest (`vitest`)
- **Icons**: Lucide React (`lucide-react`)

---

## 🏗 Architecture & Key Concepts

### 1. Account-Based Tenancy Boundary

The `Account` table is the primary source of truth for tenant data isolation. An account represents an isolated customer environment and can be either:

- **`ENTERPRISE`**: A customer company environment (e.g. *Acme Corporation*). Created exclusively by Qubere internal administrators via the Platform Admin Console.
- **`INDIVIDUAL`**: A personal workspace (e.g. *Rachit's Workspace*). Created via self-service user signup.

Users can belong to multiple accounts and switch between active account contexts using the top-left **Account Switcher**.

### 2. Authentication vs Authorization

- **Authentication (Identity)**: Managed strictly by **Clerk** (sign in, MFA, sessions, email/password verification).
- **Authorization**: Managed inside PostgreSQL (`User`, `AccountMembership`, `Role`, `Permission`, `PlatformUserRole`).

### 3. Separated Platform & Customer RBAC

- **Platform Roles (`PlatformRole` & `PlatformUserRole`)**: Platform-level roles (`PLATFORM_ADMIN`, `CUSTOMER_SUPPORT`, `BILLING_ADMIN`, `SECURITY_ADMIN`) for Qubere internal operations.
- **Customer Account Roles (`Role`)**: Built-in system roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER` where `isSystem = true`) and custom customer-defined roles (`isSystem = false`, `accountId = specific account`).

### 4. Secure Token-Based Invitations

Invitations are generated with secure, unique tokens (`/invite/<token>`) supporting `PENDING`, `ACCEPTED`, `EXPIRED`, and `REVOKED` statuses.

### 5. SOC2-Ready Enterprise Audit Logging

Every administrative action (role change, status toggle, account modification, user invitation) generates an immutable `AuditLog` entry in PostgreSQL capturing:

- `accountId` & `userId`
- `action`, `entity`, `entityId`, `metadata`
- `ipAddress`, `userAgent`, `requestId`
- `success` outcome status (`true` / `false`)

`createAuditLog` is a single, best-effort write path — a logging failure never
blocks or rolls back the action it was about — shared by every compliance
module (private embargo, RDPS, PAL, Community Screening, settings) against a
~104-entry `AuditAction` catalogue (`src/lib/audit/auditActions.ts`); the
`action` parameter itself is a loose `string`, not type-checked against that
enum. Compliance events additionally queue outbox-pattern emails
(`ComplianceNotification` → `ComplianceNotificationDispatcher`) over SMTP,
covering RPS hit/review/rescreen types plus License Determination review-
required alerts and the license portfolio expiry/utilization digest. See
[docs/compliance-notifications-and-audit.md](docs/compliance-notifications-and-audit.md)
for the full mechanism, audit-history UI surfaces, export, and known gaps.

### 6. Row-Level Security & Capability Gating

To ensure data privacy within multi-tenant accounts:

- **Row-Level Security (Data Segregation)**: Planners can only access their own assigned records (e.g., shipments), while Admins can view all data within the account.
- **Capability Gating**: API routes strictly enforce capabilities via `hasPermission()` checks (e.g., `documents.create`, `filings.submit`, `intel.read`), returning `403 Forbidden` if a user lacks the necessary privilege.

### 7. Global Product / Item Master

One product record per tenant holds what is true about the goods everywhere;
jurisdiction-specific customs positions hang off it separately. There is no
`Product.hsCode` — a product has a US classification, an EU classification and
so on, each with its own status, reviewer and effective window, and only
`APPROVED` counts. Country of manufacture and country of origin are stored as
different facts, and origin is never inferred from a manufacturer, supplier,
seller, export or shipping country.

See [docs/product-master.md](docs/product-master.md) for the domain model,
matching rules, change-detection signals, CSV import, and what is deliberately
not implemented.

### 8. Global Party Master

One party record per tenant holds who they are — identity, roles, and
registrations are kept as separate axes rather than a single "verified"
flag. `PartyRole` records that a party acts as a supplier, importer,
carrier, broker and so on (a party is not one fixed "type"), and
`PartyRegistration` tracks per-country registration claims through their
own `CLAIMED → UNDER_REVIEW → VERIFIED` lifecycle, independent of the
party's own `UNREVIEWED → IN_REVIEW → APPROVED` review status. A name match
alone is never treated as legal-identity proof.

See [docs/party-master.md](docs/party-master.md) for the domain model,
matching rules, change-detection signals, CSV import, and what is
deliberately not implemented.

### 9. AI Chat Assistant

A conversational layer over the data the console already shows, reached at
`/chat`. It is not a database agent: the model never sees SQL, an internal API,
or the page's DOM. It calls a registry of 41 tools (`src/modules/assistant/tools.ts`
— shipments, value-at-risk, shipment creation, products (including change
history and sourcing evidence), parties (including change history, evidence,
and restricted-party screening/rescreening), documents, team members, decisions,
exceptions, classification, duty/HTS lookups, filing status and per-shipment
filing readiness, a prioritized task queue, and compliance/Country Embargo
Screening), each reading through the same services and permission checks the
screens use, in a single streaming tool-calling loop
(`src/modules/assistant/orchestrator.ts`) — everything the model produces is
streamed straight to the client, so there is no hidden reasoning stage to guard.

An earlier, standalone "Qubere AI Copilot" panel (`src/modules/copilot/`) was
built in parallel with this surface, never wired into any route, and has since
been deleted outright; its guardrails and any capability it had that this
registry lacked were folded directly into `src/modules/assistant/` so there is
only one AI surface to maintain:

- **RBAC.** Each tool optionally declares the nav route or permission it
  requires (`canUseTool`, in `src/modules/assistant/shared/toolAccess.ts`).
  `availableAssistantTools(ctx)` filters the registry down to what the caller
  may use *before* it is declared to the model, and the orchestrator re-checks
  a called tool name against that same filtered set before executing it — a
  model that names a tool it was never offered still cannot run it. Tools with
  no access requirement (e.g. team member lookup) are available to any
  authenticated account member. A regression test
  (`tests/assistant-tools-rbac.test.ts`) asserts every tool whose name matches
  a write-verb pattern (create/update/delete/approve/screen/etc.) declares a
  non-empty access requirement.
- **Tenancy.** Every tool reads through the account-scoped services the
  screens already use — there is no path from a chat message to another
  tenant's rows.
- **Origin safety.** A `get_product_origin_position` tool surfaces a
  product's legal country-of-origin position, backed by
  `resolveOriginPosition()` (`src/modules/assistant/shared/origin.ts`). The
  system prompt requires the model to quote its verbatim result rather than
  rephrase or reason past it, and forbids falling back to a manufacturing,
  supplier, ship-from, port or export country as a stand-in — even when the
  tool's own physical-fact fields mention one — when no approved
  determination exists.
- **Audit.** Turns are recorded in the existing audit log via
  `COPILOT_CONVERSATION_STARTED`, `COPILOT_QUERY`, `COPILOT_TOOL_EXECUTED` and
  `COPILOT_ERROR` actions (`src/modules/assistant/shared/audit.ts`),
  keyed by the chat request's own request id (this surface has no persisted
  server-side conversation id to key off instead) — question, outcome and
  counts, never tool arguments or answer prose. `COPILOT_QUERY`'s status is
  only ever `ANSWERED`, `PARTIAL` (stopped after too many tool rounds in one
  turn) or `ERROR`.

Retrieved business content — extracted document fields especially — is passed to
the model inside a labelled data envelope and is never treated as instruction,
per the system prompt's grounding clause.

### 10. Customs Filing — Canonical Messaging

Filing submission and response handling (`src/modules/filings/`,
`src/lib/canonicalMessaging/`) are config-driven per country rather than
hardcoded to one authority. A filing's `entryType`, procedure code, and
authority resolve through `FilingProcedureMapping` / `FilingAuthorityConfig`
lookups keyed on the shipment's `destinationCountry` — a country with no row
for either simply cannot have a filing created for it yet (fail-closed, not a
silent US fallback). Outbound/inbound messages are validated against
versioned JSON Schemas (`schemas/customs-filing/`, tracked in
`FilingSchemaVersion` with a `DRAFT → ACTIVE → DEPRECATED/SUPERSEDED`
lifecycle) and applied to `filingStatus` through a table-driven state machine
(`filingStateMachine.ts` for legal transitions, `FilingChildActionRule` for
which actions like `CANCEL` are offered per country/procedure/status) —
adding a country or a new child action is a data change, not new branching
logic. No real third-party customs system is wired up yet: with
`CUSTOMS_FILING_MOCK_RESPONSES` unset (default: on), transmitting, resubmitting,
or cancelling a filing simulates and applies a matching inbound response
inline so the Response tab populates without any manual step; set it to
`false` once a real integration exists. See
[docs/customs-filing/customs-filing-canonical-messaging-changelog.md](docs/customs-filing/customs-filing-canonical-messaging-changelog.md)
for the full implementation history, including the second-country (Germany)
proof and the gaps closed along the way.

Cost is bounded per turn — at most 6 tool-calling rounds — and per caller: 15
questions a minute per user and 60 per account (`checkCopilotRate`, reused
as-is), answered with HTTP 429 and a plain explanation the client already knows
how to surface, plus the shared per-account daily token ceiling described in
[AI cost controls](#-ai-cost-controls). Provider token counts are recorded via
`meterGeminiCall` on each model round and on the `COPILOT_QUERY` audit entry, so
spend can be attributed to an account without a separate billing export; a
provider that reports nothing is recorded as `null`, never as zero.

The assistant cannot approve a classification, determine origin, edit the
Product or Party Master, submit a filing, or close an exception. Every workflow
remains fully usable without it, and when no model is configured
(`GEMINI_API_KEY` unset) the route says so rather than answering from nothing.

### 11. Country Embargo Screening — Deterministic Engine, Copilot & Partner API

Country Embargo Screening (`src/modules/agents/compliance/embargo/`) is a
deterministic, rule-table-driven engine — never an LLM — that evaluates a
shipment's transaction, party, and line-level country pairs against
`country_by_country_maps`, country-group, and CCL/ECCN reference data. It runs
as part of the Compliance Audit Agent pipeline and persists its full result
(`status`, `hits`, `checks`, `skippedChecks`, `errors`) to
`AgentDecision.evidenceItems.countryEmbargoScreening`. Two known engine gaps
are deliberately surfaced rather than hidden: country-group/CCL data is
evidence-only (it never drives a HIT/CLEAR determination on its own), and a
CLEAR run that had to skip a check (e.g. a party with no country on file) is
presented as `PARTIAL`, not `CLEAR`, even though the engine's own stored
status doesn't make that distinction.

A tenant can additionally layer its own **Private Embargo Screening**
country-pair rules (`PrivateEmbargoRule`) in front of these government-source
matchers via `privateEmbargoMatcher.ts` — a private rule can only add a
`HIT`, never manufacture a `CLEAR`, and is gated by the `settings.manage`
permission with its own audit actions. See
[docs/private-embargo-screening.md](docs/private-embargo-screening.md) for
the rule model, admin UI, and known gaps (no edit UI, no allow-list
exemption, unverified matcher-precedence ordering).

Every consumer of this evidence — the chat assistant's `screen_shipment_embargo`
/ `get_embargo_screening_details` tools and the partner API below — reads and
presents it through one shared module,
`src/modules/agents/compliance/embargo/screeningQuery.ts`, so they cannot drift
apart on status presentation, on keeping audit-line counts (checks
performed/passed/failed) distinct from finding counts (deduplicated hits), or
on tenant scoping.

- **Chat assistant.** `screen_shipment_embargo` reuses the last completed
  screening unless the caller explicitly asks to rescreen (or none has ever
  run), gating an actual rescreen behind the `shipments.manage` permission and
  reporting `rescreenDenied: true` rather than silently reusing stale evidence
  when that permission is missing. `get_embargo_screening_details` is pure
  read — it never triggers a rescreen — and can filter by line item, party,
  screening level (`TRANSACTION`/`PARTY`/`LINE`), or direction (`D`/`O`).
- **Partner API.** `GET /api/v1/compliance/embargo-screening` and
  `POST /api/v1/compliance/embargo-screening` expose the same read/rescreen
  behavior to external systems, authenticated via API key (`Bearer` or
  `X-Api-Key` header, same as the other `/api/v1/*` routes) rather than a
  session. Reading requires the `embargo.read` scope; triggering a fresh run
  additionally requires `embargo.screen`. Both actions are recorded to the
  audit log tagged `source: "API"`.

A rescreen, from either surface, is triggered the same way a manual
reconciliation is — `PipelineOrchestrator.processEvent({ triggerEvent:
"RECONCILIATION_REQUESTED" })` — there is no separate rerun mechanism to keep
in sync with the pipeline.

### 12. Restricted/Denied-Party Screening & Compliance Workspace UI

Restricted/Denied-Party Screening (`src/modules/agents/compliance/restrictedParty/`,
see `docs/restricted-party-screening-implementation-report.md` for the full
design) is a sixth deterministic screening module, in the same house style as
Country Embargo/UFLPA/End-Use/End-User/Anti-Boycott/Military End-Use, closing
the gap where `SDN`, `CONSOLIDATED_NON_SDN`, `DPL`, `ISN`, `SSI`, `FSE`, `PLC`,
and `NS_MBS` `ScreeningEntity` rows were fully ingested but never screened by
any pipeline module. It screens Party Master records (name + address + contact,
each its own immutable pass) and shipment/line-level parties, using exact,
raw-word, and a self-contained phonetic shortlist — Double Metaphone or a
classic single-code Metaphone2, selectable per account via
`AccountScreeningConfig.phoneticAlgorithm` — feeding the existing
`scoreDpsMatch` fuzzy scorer, plus an independent red-flag word check
(`ComplianceKeywordRule`, `category: "RESTRICTED_PARTY_RED_FLAG"`). Every result
is immutable; reviewer judgment (`APPROVED`/`FALSE_POSITIVE`/`BLOCKED`/etc.) is
recorded separately on `RestrictedPartyDisposition`, 1:1 with the result, so a
past HIT is never rewritten. Party Master keeps a satellite
`PartyScreeningSummary` per party (current status, last result, staleness
driven by identity-fact changes and reference-data republishes — no fixed TTL).

Reference data now also includes a **Dow Jones full-feed ingestion pipeline**
(`src/modules/screening/dowJones/`), carrying provider lineage (`provider`,
`providerRecordId`, `providerUpdatedAt`, `sourceAuthority`) and multi-valued
child data (`ScreeningEntityAlias`, `ScreeningEntityAddress`,
`ScreeningEntityIdentifier`, `ScreeningEntityReference`) per profile — modeled
so a single Dow Jones entity can carry several regulatory references (OFAC,
BIS, UN, EU, etc.) rather than the legacy one-denial-order-per-row shape. A
2026-08-25 gap analysis against the legacy Oracle RPS schema
(`PartyScreening_Tables.sql`) closed the remaining business-critical fields —
`ScreeningEntityReference.restrictionType`/`orderNumber`/`orderDate`/
`publicationDate`/`citationUrl` — while explicitly declining to recreate
Oracle-era storage artifacts (fixed name/address word columns, Soundex
columns, `DENIED_WORDS`, `SUBSCRIBER_PARTY_LIST`, `TRADING_PARTNER`
duplication); see the report's Section N for the full mapping matrix.

It's wired into the `ComplianceAuditAgent` as a seventh concurrent check
(`RESTRICTED_PARTY` / `PARTY_RED_FLAG` finding categories), exposed to external
systems via `/api/v1/screening/restricted-party` and related party-history/
disposition routes (API-key scoped, idempotent), and to the Copilot via
`screenRestrictedParty` / `getRestrictedPartyScreeningDetails` /
`getPartyRestrictedPartyScreeningHistory` tools in `complianceTools.ts`.

Results surface in the app at `/app/compliance`, a two-tier tab workspace
(`ComplianceWorkspaceClient.tsx`): top-level **Overview / Screening / Review
Queue / Audit History** tabs, with **Screening** further split into per-module
sub-tabs (the five existing embargo-family findings, plus a dedicated **Party
Screening** sub-tab for this module's results) and on each party's own detail
page. Deliberately not yet implemented: PEP screening, beneficial-ownership
graphs, corporate registry ingestion, autonomous approval, and any fuzzy
matching beyond the Double Metaphone/Metaphone2 shortlist — see
`docs/party-master.md` and Sections K/N of the implementation report for the
full list of known gaps.

A **Pre-Approved Party List (PAL)** lets a prior clearance be reused instead
of re-running RPS, but only through a fail-closed gate
(`checkPreApprovalGate`) that requires an identity-hash match, matching party
version, fresh-enough reference data, no expiry, and no revocation — any gap
in that chain falls straight through to a normal screening run. The same gate
is shared verbatim by Community Screening below. See
[docs/pre-approved-party-list.md](docs/pre-approved-party-list.md) for the
full lifecycle and known gaps (no scheduled expiry sweep, no bulk approval).

### 13. RDPS — Reverse Denied-Party Screening / Continuous Party Monitoring

RDPS re-screens previously-cleared parties so that a change in the party's
own data, or in the denied-party reference data, gets caught rather than
persisting behind a stale one-time clearance. A **delta-impact dispatcher**
reacts to a specific reference-data change; a **full-population dispatcher**
proactively re-screens the whole account on a schedule — both funnel into one
shared `outcomeRecorder.ts`, which reuses the canonical `rescreenParty()`
lifecycle rather than reimplementing it, and both persist an
`RdpsPartyOutcome` row that records whether a result worsened plus a
deterministic `transitionType` (`NEW_HIT` / `ESCALATED` / `RISK_REDUCED` /
`CLEARED` / `UNCHANGED_*` / `ERROR` / …). Reference-data changes carry a
`changeType` of `ADDED` / `UPDATED` / `SUPERSEDED` / `EXPIRED` — the last
written by an hourly `referenceDataExpirySweep.ts` cron that catches entities
whose own `expirationDate` elapsed while still active in every feed, a case
the ingestion services themselves never catch. A read-only **Preview
Impact** action shows which parties a reference-data change would match
today without rescreening or recording anything, and a per-change-set
**Impacted Parties** drill-down (via `triggeringChangeSetIds` on each
outcome) shows which parties actually were re-screened because of it. Both
dispatchers, the expiry sweep, and Community Screening's dispatcher are all
wired into scheduled cron (`rdps-delta-impact-dispatch` every 10 minutes,
`rdps-full-population-dispatch` and `reference-data-expiry-sweep` hourly),
registered in both `apps/custom/vercel.json` and
`infrastructure/gcp/configure-scheduler.sh` (GCP Cloud Scheduler is
authoritative in production). Surfaced via `RdpsPanel.tsx` inside the
Compliance workspace and its tenant-scoped API routes. See
[docs/rdps-continuous-monitoring.md](docs/rdps-continuous-monitoring.md) for
the full design.

### 14. Community Screening — Multi-Party Batch RPS + Embargo Orchestration

Community Screening (`src/modules/compliance/communityScreening/`) lets a
compliance user submit a batch of parties (manual entry or file upload) and
runs the *canonical* Restricted Party Screening and Country Embargo engines
against every row — it orchestrates, it never reimplements matching. A
denied-party match and a red-flag keyword hit are tracked as independent
findings (`restrictedPartyMatchFound` / `restrictedPartyRedFlagFound`), never
collapsed into one shared status tier, and a
`restrictedPartyFindingCategory` (`NO_MATCH` / `CONFIRMED_MATCH` /
`POTENTIAL_DENIED_PARTY_MATCH` / `RED_FLAG_ONLY` / `PAL_SUPPRESSED` / …) gives
every row one human-readable label without losing that independence. A valid
pre-approval (PAL) short-circuits the RPS engine entirely and is its own
status (`PRE_APPROVED_REUSE`), deliberately distinct from an ordinary `CLEAR`.

The internal uniqueness key for a screened party is `(runId, rowNumber)` on
`CommunityScreeningPartyResult`, never the Party ID alone — the same Party ID
can appear more than once in a batch, and each occurrence keeps its own
result. `deriveLegacyPartyStatusMap()` is the one place that collapses
occurrences down to a Party-ID-keyed view for legacy-compatible consumers,
and it is most-severe-wins by construction: a later `PASSED` occurrence can
never overwrite an earlier `FAILED`/`ERROR`/`INCOMPLETE` one for the same
Party ID, regardless of arrival order.

Small/manual runs execute inline; large or file-sourced runs are claimed
row-by-row by `CommunityScreeningDispatcher`, using the same optimistic
per-row claim pattern as `ComplianceNotificationDispatcher` so a retried tick
can never double-process a row. Gated by three permissions
(`compliance.community_screening.read`/`.screen`/`.override`), every route
tenant-scoped via `withAuthenticatedRoute`, with export (CSV/XLSX) and Ask
Qubere assistant tools surfacing the same independent-findings evidence. See
[docs/community-screening.md](docs/community-screening.md) for the full
design, data model, and known gaps.

### 15. Qubere Autonomous Freight Execution TMS (`apps/tms`)

**Qubere TMS** (`apps/tms`, running on **`http://localhost:3001`**) is an autonomous freight execution application built for logistics operators, freight forwarders, and dispatchers.

#### 🤖 6 Autonomous Pipeline Agents
1. **Document Intake Agent**: Classifies incoming trade and logistics PDFs (`BILL_OF_LADING`, `AIR_WAYBILL`, `COMMERCIAL_INVOICE`, `PACKING_LIST`, `PROOF_OF_DELIVERY`, `CARRIER_INVOICE`, `BOOKING_REQUEST`, `BOOKING_CONFIRMATION`) and extracts 100% of visible freight facts with evidence provenance.
2. **Shipment Enrichment Agent**: Synchronizes extracted document facts with the operational `Shipment` record and `TransportationOrder` DB rows, promoting route details (`countryOfExport`, `destinationCountry`, `transportMode`, `portOfEntry`), tracking references (`MBL`, `HBL`, `BOOKING`, `CONTAINER`), equipment requirements, and cargo line items.
3. **Document Readiness Agent**: Evaluates mode- and customs-dependent document completeness (e.g. `BILL_OF_LADING` + `PACKING_LIST` + `COMMERCIAL_INVOICE`) using RAG account memory, raising/resolving `ExceptionItem` records.
4. **Movement Readiness Agent**: Verifies positioning, stops, equipment requirements, and carrier tracking references to ensure execution readiness.
5. **Cost & Carrier Readiness Agent**: Audits linehaul and drayage freight quotes, tenders, and buy/sell margins against approved target margins.
6. **Operational Risk Agent**: Evaluates tracking freshness, customer promise buffers, last free day (LFD) detention risks, and open exceptions to assign real-time health status (`Healthy`, `At Risk`, `Critical`).

#### 🔒 Zero Data Loss & Additive Intelligence Mandate
Every agent operates under a strict **Additive Intelligence Mandate**:
- Raw key-value pairs, contact details, dates (`CutOff`, `ETD`, `ETA`), move types (`FCL/FCL`), vessel/voyage details, line items, and unmapped fields are captured in `rawMetadataJson` and `extractedJson`.
- No agent step filters out or discards facts from prior agents. Downstream agents build upon the accumulated state stored in `pipelineJob.state.accumulatedData`.

#### 🔑 Credentials & Access
- **App URL**: `http://localhost:3001`
- **Default Password**: `QuberePass2026!`
- **Primary Dispatcher / Admin**: `admin@qubere.ai`
- **Target Enterprise Planner**: `sarah@target.com`
- **Acme Enterprise Owner**: `owner.acme@qubere.ai`

---

### 16. License Determination & Management

License Determination (`src/modules/licenses/`) evaluates whether an
export/import operation needs a government authorization and, if it does,
tracks that authorization's remaining capacity for the life of the license.
It is a **deterministic engine, never an LLM**: classification format
validation (ECCN/USML/HTS/Schedule B/ICN), tri-state (true/false/unknown)
end-use and end-user condition handling, and license-exception claim
evaluation all run as pure functions with no external rule lookup. No
jurisdiction-specific control-rule datasets (country export-control
matrices, encryption/RPL eligibility tables) have been ingested into this
repository, so per its fail-safe design the engine **never fabricates** a
`LICENSE_REQUIRED`/`NO_LICENSE_REQUIRED` outcome — it returns
`RULE_DATA_UNAVAILABLE`, `INCOMPLETE`, or `REVIEW_REQUIRED` with full
evidence of what was and wasn't evaluated instead, and any sensitive
end-use/end-user flag always hard-stops to `REVIEW_REQUIRED` regardless of
rule-data availability.

License Management layers a full authorization lifecycle on top of a
positive determination: license/line/party/document CRUD, an event-sourced
utilization ledger (`utilizationService.ts` — the single writer of ledger
totals, with an idempotent dedupe key and optimistic-concurrency `version`
CAS updates inside a Serializable transaction), reason-required manual
adjustments, allocation reserve/release against remaining capacity, and a
daily expiry/utilization-threshold alert cron. Both the alert digest and a
review-required determination outcome queue a durable `ComplianceNotification`
through the same outbox/dispatcher pipeline RPS uses, rather than sending
email inline. Reporting is integrated into the existing Compliance Reports
catalog rather than a separate export pipeline. Surfaced at
`/app/license-management` (portfolio list, run determination, alerts) and
its detail page (lines, utilization/adjustment/allocation history, parties,
documents, close license), gated by a dedicated `licenseDetermination.*` /
`licenses.*` permission set. Formal compliance overrides against a License
Determination result can be created/revoked from the Audit & History panel's
execution detail view (`compliance.override`-gated), the same generic
`ComplianceFormalOverride` mechanism every compliance domain shares. See
[docs/LICENSE-DETERMINATION-GAP-MATRIX.md](docs/LICENSE-DETERMINATION-GAP-MATRIX.md)
for the full implementation status, fail-safe rationale, and test coverage.

### 17. Document Association & Trade Repository

`DocumentAssociation` (`src/modules/documentAssociations/`) generalizes
document-to-record linking beyond the original shipment-only attachment
model: any `ShipmentDocument` can now be linked to a `SHIPMENT`, `PARTY`,
`PRODUCT`, `LICENSE`, or `FILING` record, with a stable
`(accountId, documentId, entityType, entityId)` uniqueness constraint and a
soft `active` flag rather than hard deletes, so unlinking preserves history.
`entityResolver.ts` validates that a target entity actually exists (and
belongs to the caller's account) before a link is created — a link can never
point at a row from another tenant or one that was never created.

The shared `<EntityDocuments />` component renders the same linked-documents
list and link/unlink controls on Party, Product, and Filing detail pages, and
on the shipment `DocumentWorkspacePanel`, against one API surface
(`/api/document-associations`, `/api/documents/[id]/associations`,
`/api/documents/[id]/signed-url`) — no per-entity-type document UI to keep in
sync. `GET /api/documents` accepts `linkedEntityType`/`linkedEntityId` filters
and returns a `linkedEntityCount` per document so a caller can tell how widely
a document is already referenced. `scripts/backfill-document-associations.ts`
one-time-migrates pre-existing shipment-attached documents into the new
association table.

A standalone cross-entity search surface, **Trade Repository**
(`/app/trade-repository`, `document.read`-gated), lists every document in the
account with search/type/status/linked-entity filters independent of any one
shipment/party/product page. The signed-URL route returns a short-lived
(15 minute) object-storage URL via `createSignedReadUrl` for documents backed
by real storage, falling back to the existing streaming proxy
(`documentViewUrl()` / `/api/documents/proxy`) for local-disk/dev-fallback
documents or on a storage error — it complements rather than replaces that
proxy route. License detail-page document wiring is deliberately deferred
pending a product decision on how it should coexist with that module's
existing document mechanism.

---

## 💰 AI Cost Controls

Every AI capability here — the Copilot, HTS classification, document
intelligence, product intelligence, normalization, the compliance audit and
email intake — bills against one `GEMINI_API_KEY`. `src/lib/ai/aiQuota.ts` is the
one counter all of them go through, backed by the `AiUsageWindow` table because
the database is the only thing every serverless instance shares.

**Metering is always on. Enforcement is opt-in.** With none of the variables below
set, every AI call is counted and every AI call is allowed — the agents behave
exactly as they did before, and an operator gets a spend history they did not
have. Ceilings apply only where one is deliberately configured.

| What | Where it applies | Default |
| --- | --- | --- |
| `AI_ACCOUNT_TOKENS_PER_DAY` | Every surface, per account, per UTC day | Unset — unlimited |
| `AI_AGENT_USER_REQUESTS_PER_MIN` | Agent routes, per user per surface | Unset — unlimited |
| `AI_AGENT_ACCOUNT_REQUESTS_PER_MIN` | Agent routes, per account per surface | Unset — unlimited |
| `COPILOT_USER_REQUESTS_PER_MIN` | `/chat` assistant, per user | 15 |
| `COPILOT_ACCOUNT_REQUESTS_PER_MIN` | `/chat` assistant, per account | 60 |

A value of `0`, a negative number or anything unparseable is treated as unset
rather than as a ceiling of zero, so a typo cannot refuse every request on the
platform.

Three properties are worth knowing before turning a ceiling on:

- **Refusal happens at the route, before any work starts.** Once an agent has
  begun writing decisions and findings against a shipment, stopping it would leave
  the shipment half-classified — worse than the overspend. Cron routes are not
  request-throttled for the same reason; the daily token ceiling still bounds what
  they spend.
- **Failure is not enforcement.** If the counter cannot be read or written — the
  migration below not yet applied, a database blip — the call is allowed and
  `ai.quota_unavailable` is logged once per process. A metering table must never be
  able to stop customs classification.
- **Windows are fixed, not sliding.** A minute window is a truncated minute, so a
  burst of up to twice the nominal rate is possible across a boundary. That is the
  trade for one atomic statement per increment, and for a cost guard it is the
  right one.

Counters are attributed to a real user where there is one and to `system` where
there is not (a cron-triggered classification has no user). Old windows are swept
by the existing `/api/cron/document-processing` tick, which reports
`usageWindowsPruned`.

`prisma/migrations/20260812200000_ai_usage_windows/migration.sql` is hand-written,
purely additive and idempotent — one new table, three indexes and one foreign key,
with `IF NOT EXISTS` throughout. It has been applied to the development database
(`prisma migrate deploy`, confirmed by `prisma migrate status`). Any other
environment needs the same step:

```bash
npx prisma migrate deploy
```

In an environment where it has not been applied — or during a database outage —
every AI call takes the fail-open path above: unmetered, unrestricted, and logged
as degraded.

---

## 🧠 AI Model Selection

Each of the seven AI surfaces chooses its model independently, through
`src/lib/ai/aiModel.ts`. It is keyed off the same surface names the quota layer
uses, so a call site names its surface once and gets both its model and its meter
under that name.

Precedence, most specific first:

| Rung | Variable | Scope |
| --- | --- | --- |
| 1 | `COPILOT_MODEL`, `HTS_CLASSIFICATION_MODEL`, `DOCUMENT_INTELLIGENCE_MODEL`, `PRODUCT_INTELLIGENCE_MODEL`, `NORMALIZATION_MODEL`, `COMPLIANCE_AUDIT_MODEL`, `DOCUMENT_INTAKE_MODEL` | One surface |
| 2 | `AI_DEFAULT_MODEL` | Every surface without an override |
| 3 | `GEMINI_MODEL` | Deprecated; honoured so existing environments do not silently move |
| 4 | built-in default | Nothing configured |

A blank value counts as unset at every rung, so `COPILOT_MODEL=` falls through
rather than asking the provider for a model named empty string.

This selects a model *name*, not a provider. The only adapter wired today is
google-genai, so a name from another vendor would be handed to the Gemini client
and rejected by it — adding a second vendor means an adapter, not a new variable.

Two places record the model rather than call it: the `DocumentParseVersion` row
written by the Document Intelligence Agent, and the `AgentExecution` row written
by the classification extractor. Both now report the model that actually ran, so
provenance cannot claim one model while another did the reading.

---

## 📁 Repository Structure

```text
├── docs/
│   ├── product-master.md    # Global Product / Item Master domain reference
│   ├── party-master.md      # Global Party Master domain reference
│   ├── document-intelligence.md # Document parsing pipeline reference
│   ├── community-screening.md # Multi-party batch RPS + Embargo orchestration reference
│   ├── private-embargo-screening.md # Tenant country-pair overlay in front of the embargo engine
│   ├── pre-approved-party-list.md # PAL fail-closed reuse gate reference
│   ├── rdps-continuous-monitoring.md # Reverse/continuous denied-party re-screening reference
│   ├── compliance-notifications-and-audit.md # Email notification pipeline + audit logging reference
│   ├── ai-chat-interface.md # AI assistant design spec — see "AI Chat Assistant" above for the built shape
│   ├── customs-filing-canonical-messaging-changelog.md # Multi-country filing/messaging implementation history
│   └── LICENSE-DETERMINATION-GAP-MATRIX.md # License Determination & Management implementation status reference
├── prisma/
│   ├── schema.prisma        # Prisma data models & database relationships
│   ├── migrations/          # Versioned schema migrations
│   └── seed.ts              # Database seed script for test accounts & RBAC
├── scripts/
│   ├── seed-clerk-users.ts  # Programmatic Clerk user provisioning script
│   ├── seed-qubere-trade-network.ts # Demo product/party network seed
│   └── backfill-document-associations.ts # One-time backfill into DocumentAssociation
├── src/
│   ├── app/
│   │   ├── (auth)/          # Clerk Auth routes (/sign-in, /sign-up)
│   │   ├── api/             # Internal API routes (account, users, platform-admin,
│   │   │                    #   products, parties, documents, shipments, filing, …)
│   │   ├── app/             # Application Console — dashboard, admin, products,
│   │   │                    #   parties, shipments, documents, filing, actions
│   │   ├── invite/[token]/  # Token-based secure invitation acceptance
│   │   ├── platform-admin/  # Qubere Platform Admin Console
│   │   ├── globals.css      # Design tokens & Apple light theme
│   │   └── page.tsx         # Landing page & auto-redirect guard
│   ├── components/          # Reusable UI components (Sidebar, Header, AccountSwitcher,
│   │                        #   table/BulkSelection, …)
│   ├── lib/                 # Core utilities (auth context, audit logger, db client,
│   │                        #   csvExport, i18n)
│   ├── modules/             # Domain logic (product, party, shipment, documents,
│   │                        #   assistant, copilot, tables, …), independent of the route layer
│   └── middleware.ts        # Route protection middleware
├── tests/                   # Vitest unit and integration tests
└── package.json
```

---

## ⚡ Getting Started Locally

### 1. Prerequisites

- Node.js 20.9+ & npm (required by Next.js 16)
- Clerk account credentials
- Supabase PostgreSQL database URL

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app/dashboard

# Supabase Connection Strings (Transaction Pooler vs Direct Connection)
# DATABASE_URL uses Port 6543 (Transaction Mode) for Next.js App / Serverless API routes
DATABASE_URL="postgresql://postgres.cqrhojmrdbrfrgtkurzj:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
# DIRECT_URL uses Port 5432 (Session Mode) for Prisma Migrations & CLI commands
DIRECT_URL="postgresql://postgres.cqrhojmrdbrfrgtkurzj:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres"

# Scheduled job authentication (see "Scheduled Jobs" below).
# Optional locally; required in production so /api/cron/* endpoints can't
# be triggered by anyone who finds the URL.
CRON_SECRET=
```

The block above is enough to run the app with auth, RBAC, and the core
product/party/shipment/filing flows. The variables below turn on specific
integrations — each one is optional, and every feature it gates reports
itself as unavailable (never a silent fallback) when unset. See each
feature's linked doc for what "unconfigured" looks like in the UI.

| Variable | Gates | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI agents (classification, document intelligence, normalization, product intelligence, HTS classification) and the `/chat` assistant | No default; agent calls fail closed without it, and `/api/assistant/chat` reports itself unconfigured. `ANTHROPIC_API_KEY` below is an alternative provider for the `/chat` assistant and the advisory-query/product-enrich/AD-CVD-scope-screening routes — either key alone is enough for those surfaces |
| `ANTHROPIC_API_KEY` | Alternative AI provider (Claude) for the `/chat` assistant, `/api/advisory/query`, product enrichment, and AD/CVD scope screening | No default; those routes fall back to Gemini (if configured) or report themselves unconfigured without either key |
| `CLAUDE_MODEL` | Fallback Claude model name when `COPILOT_MODEL`/`ADVISORY_MODEL` aren't set | Defaults to `claude-3-5-sonnet-20241022` |
| `ADVISORY_MODEL` | Claude model override for `/api/advisory/query` specifically | Falls back to `CLAUDE_MODEL`, then the built-in default |
| `AI_DEFAULT_MODEL` | The model every AI surface calls | Falls back to a built-in name. See [AI model selection](#-ai-model-selection) |
| `COPILOT_MODEL`, `HTS_CLASSIFICATION_MODEL`, `DOCUMENT_INTELLIGENCE_MODEL`, `PRODUCT_INTELLIGENCE_MODEL`, `NORMALIZATION_MODEL`, `COMPLIANCE_AUDIT_MODEL`, `DOCUMENT_INTAKE_MODEL` | One surface each | Each overrides `AI_DEFAULT_MODEL` for that surface alone. `COPILOT_MODEL` governs the `/chat` assistant — it reuses the `"copilot"` surface name rather than a new one |
| `GEMINI_MODEL` | Deprecated global model name | Still honoured below `AI_DEFAULT_MODEL` so existing environments do not move; prefer the variables above |
| `AI_ACCOUNT_TOKENS_PER_DAY` | Daily token ceiling for an account, across every AI surface | Unset means unlimited; usage is still counted. See [AI cost controls](#-ai-cost-controls) |
| `AI_AGENT_USER_REQUESTS_PER_MIN`, `AI_AGENT_ACCOUNT_REQUESTS_PER_MIN` | Request ceilings on the agent routes | Both unset by default, so agents are metered and never refused |
| `COPILOT_USER_REQUESTS_PER_MIN`, `COPILOT_ACCOUNT_REQUESTS_PER_MIN` | `/chat` assistant request ceilings | Default 15 per user and 60 per account per minute |
| `BLOB_READ_WRITE_TOKEN` | Document upload storage (Vercel Blob) | Required for any document upload in production; see [docs/document-intelligence.md](docs/document-intelligence.md) |
| `MAX_UPLOAD_BYTES` | Upload size limit | Defaults to 50 MB |
| `UPLOAD_TOKEN_SECRET` (or `NEXTAUTH_SECRET`) | Signs shipment-document upload-request tokens (`src/lib/uploadToken.ts`) | `NEXTAUTH_SECRET` is checked first — a legacy name kept for compatibility, not NextAuth config (this app uses Clerk). One of the two is required; token signing throws without either |
| `DOCUMENT_MALWARE_SCAN_MODE` | Malware-scan policy for uploaded documents when no real scanner is configured | `advisory` (default, accepts unscanned) \| `block` (quarantines unscanned uploads) |
| `DOCUMENT_PARSER_PROVIDER` | Document Intelligence parsing pipeline | `ibm-docling` \| `mock` \| `none` (default `none` — see [docs/document-intelligence.md](docs/document-intelligence.md)) |
| `DOCLING_API_BASE_URL`, `DOCLING_API_KEY`, `DOCLING_AUTH_HEADER_NAME`, `DOCLING_AUTH_HEADER_SCHEME`, `DOCLING_SUBMIT_PATH`, `DOCLING_STATUS_PATH`, `DOCLING_RESULT_PATH`, `DOCLING_SOURCE_DELIVERY`, `DOCLING_SUBMIT_ENCODING`, `DOCLING_ARTIFACT_HOSTS`, `DOCLING_SOURCE_ENVELOPE` | IBM-hosted Docling connection, only read when `DOCUMENT_PARSER_PROVIDER=ibm-docling` | All but base URL and API key have working defaults |
| `DOCUMENT_PARSER_REQUEST_TIMEOUT_MS` | Docling request timeout | Defaults to 60000 |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Inbound email → document intake | Required to receive documents by email |
| `RESEND_ALLOWED_INBOUND_RECIPIENTS`, `RESEND_PUBLIC_DOCUMENT_ADDRESS` | Inbound email allow-list / displayed address | Optional even with Resend configured |
| `RESEND_FROM_ADDRESS` | From-address on outbound document-request emails | Defaults to `noreply@qubere.ai` |
| `TRADE_GOV_API_KEY` | BIS Consolidated Screening List ingestion (`api.trade.gov`) | No default; requests are unauthenticated and likely rate-limited/fail without it |
| `CURRENCYFREAKS_API_KEY` | `ExchangeRateService` — powers automatic filing exchange-rate resolution when no manual rate is on file. See [Customs Filing — Canonical Messaging](#10-customs-filing--canonical-messaging) | No default; rate fetches are unauthenticated and likely fail without it |
| `CBP_ABI_FILER_CODE`, `CBP_ABI_FILER_PASSWORD` | Real CBP ABI filer credentials, activate `RealAceProvider` for customs transmission | No default; without both, `MockCustomsTransmissionProvider` stays active (a hard failure in production — see `/api/health`) |
| `CBP_ABI_BASE_URL` | ACE/ABI transmission endpoint | Defaults to `https://ace.cbp.dhs.gov/abi` |
| `NEXT_PUBLIC_APP_URL` | Base app URL used in emails, dataset-registry/cron self-calls | Defaults to `http://localhost:3000` (one call site defaults to `https://app.qubere.ai` instead) |
| `APP_ENV`, `NEXT_PUBLIC_APP_ENV` | Marks the environment as production for `isProductionEnv()` checks (e.g. malware-scan/transmission-provider hard failures) | Optional; `NODE_ENV=production` or a `NEXT_PUBLIC_APP_URL` pointing off localhost also count as production |
| `ALLOW_DEMO_SEEDING` | Enables demo/mock seeding routines outside of `NODE_ENV=development` | Always blocked in production regardless of this flag — see `src/lib/environment.ts` |
| `PLATFORM_ADMIN_EMAIL` | `scripts/bootstrap-admin.ts` | Only used by that one-off script |
| `DEMO_ADMIN_EMAIL`, `DEMO_SENDER_EMAIL` | `scripts/seed-inbound-demo.ts` | Only used by that one-off script |
| `SYSTEM_REVIEWER_ACCOUNT_ID`, `SYSTEM_REVIEWER_USER_ID` | `scripts/publish-compliance-keyword-rules.ts` — attributes the resulting audit-log rows | Only used by that one-off script; `accountId` is required for it to run |
| `ENABLE_LEGACY_CLASSIFICATION_MOCK` | Legacy `/api/classification/classify` mock path | Dev/testing only |
| `CUSTOMS_FILING_MOCK_RESPONSES` | Simulated third-party customs response on transmit/resubmit/cancel | Defaults on (`true`); set `false` once a real customs integration is wired up. See [Customs Filing — Canonical Messaging](#10-customs-filing--canonical-messaging) |

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Setup & Seeding

Generate the Prisma Client, push schema to PostgreSQL, and seed the test environment:

```bash
npx prisma generate
npx prisma db push --force-reset
npx prisma db seed
```

To provision all 10 test users into your Clerk instance via the Clerk API:

```bash
npx tsx scripts/seed-clerk-users.ts
```

#### Manual seed scripts

Some data is not seeded by `prisma db seed` and must be run explicitly:

| Script | Purpose |
|--------|---------|
| `npx tsx prisma/import-hts.ts` | Import HTS tariff schedule from the USITC source file. Required before classification works. |
| `npx tsx scripts/backfill-triage-state.ts` | One-time backfill: populates `AgentDecision.triageState` from legacy `status` strings. Run after deploying the 20260812060000 migration. |
| `npx tsx scripts/seed-qubere-trade-network.ts` | Seed the Qubere demo trade-network data (parties, products, shipments). |
| `npx tsx scripts/seed-inbound-demo.ts` | Seed inbound email demo routes and mailboxes. |
| `npx tsx scripts/seed-canonical-messaging.ts` | Seed customs-filing canonical messaging config: JSON Schema versions, message catalog, procedure/authority mappings, response-status and child-action rules. Required before creating a filing. |

GET endpoints **never** seed data. If a collection is empty, they return `[]`. Run the appropriate seed script above to populate it.

### 5. Running & Managing Applications

This repository is a Turborepo monorepo containing two primary web applications:
- **`apps/custom`** (Customs & Trade Compliance App) ➔ **`http://localhost:3000`**
- **`apps/tms`** (Autonomous Freight Execution TMS App) ➔ **`http://localhost:3001`**

#### 🚀 How to Start the Applications

- **Start All Applications Simultaneously (Recommended)**:
  ```bash
  npm run dev
  ```
  *Launches both Customs (`:3000`) and TMS (`:3001`) concurrently via Turborepo.*

- **Start Only the TMS App (Port 3001)**:
  ```bash
  npm run dev --workspace=@qubere/tms
  ```

- **Start Only the Customs App (Port 3000)**:
  ```bash
  npm run dev --workspace=@qubere/custom
  ```

---

#### 🛑 How to Stop the Applications

- **Graceful Stop**: Press **`Ctrl + C`** in the terminal where `npm run dev` is running.
- **Kill Lingering Processes (If `EADDRINUSE` Port 3000/3001 error occurs)**:
  If a Node background process remains bound to port 3000 or 3001, clear them instantly:
  ```bash
  lsof -ti :3000 -ti :3001 | xargs kill -9
  ```

---

#### 🗄️ Database & Schema Management

- **Push Prisma Schema Changes to Database**:
  ```bash
  npx prisma db push --accept-data-loss --schema=packages/db/prisma/schema.prisma
  ```
- **Regenerate Prisma Client Types**:
  ```bash
  npm run build --workspace=@qubere/db
  ```
- **Typecheck Workspaces**:
  ```bash
  npm run typecheck:workspaces
  ```

## ⏰ Scheduled Jobs & Data Dispatcher

### Single Daily Dispatcher Cron
`GET|POST /api/cron/data-dispatcher` runs daily (`0 2 * * *` in `vercel.json`) to fan out across all `LIVE` platform datasets based on `scheduledFrequencyHours` vs `lastSuccessAt` from the `DatasetRefreshLog` database table.

- **Vercel Hobby 2-Cron Limit**: Fits the Hobby plan ceiling by consolidating dataset triggers into a single daily dispatcher.
- **Staleness Alerts**: Automatically fires `Notification` (`dataset_staleness_alert`) and `AuditLog` events if any dataset exceeds its `staleThresholdHours`.

---

## 📊 Platform Dataset Master Registry (19 Core Datasets)

All 19 platform datasets are strictly audited under a **Zero-Fabrication Policy**. Operational calculations derive strictly from verified government and multilateral sources. Un-wired datasets return HTTP 422 and never fake success.

For detailed dataset architecture, source endpoints, and engineering complexity breakdowns, see **[docs/data/README.md](docs/data/README.md)** and **[docs/data/data-refresh-policy.md](docs/data/data-refresh-policy.md)**.

### Dataset Status Summary Matrix

| Dataset (`<data>`) | Current State | Technical Implementation & Complexity Summary |
| :--- | :--- | :--- |
| **HTSUS Schedule** | `LIVE` | Automated JSON REST API fetcher (`HtsUsitcFetcher`) fetching 99 chapters from `hts.usitc.gov/reststop/exportList`. Staged as `DRAFT` in `HtsRelease` for admin review. |
| **Federal Register (CBP Notices)** | `LIVE` | Real REST API fetcher (`federalregister.gov/api/v1/documents.json`) + Gemini AI extraction. Auto-creates `RefundOpportunity` records. |
| **BIS Consolidated Screening List** | `LIVE` | Real paginated REST API fetcher (`BisCslIngestionService`) querying `api.trade.gov/v1/consolidated_screening_list/search` across 10 agency lists, upserting SHA-256 entity hashes into `ScreeningEntity`. |
| **CBP CROSS Rulings** | `LIVE` | Real REST API fetcher (`CbpCrossFetchService`) querying `rulings.cbp.gov/api/search`, storing titles, issued dates, HTS classifications, and legal text in `Ruling`. |
| **OFAC SDN + Non-SDN** | `LIVE` | Cron enqueues a durable Inngest job (`ofac-sdn-ingest`) that streams and parses the ~29MB SDN.XML (~19,700 entries) plus the Consolidated Non-SDN list (~500 entries) outside the request lifecycle, avoiding the Vercel 60s timeout, and owns its own `DatasetRefreshLog` run. |
| **UFLPA Entity List** | `LIVE` | Real fetcher (`src/app/api/cron/uflpa-entity-list-ingest`) ingesting the DHS UFLPA Entity List, with `DatasetRefreshLog` RUNNING/SUCCESS/FAILED run tracking. |
| **USITC Trade Remedy (AD/CVD Orders)** | `NOT_YET_IMPLEMENTED` | **Planned**: AD/CVD orders published across HTML/CSV dumps. Requires Cheerio DOM scraper parsing case numbers and staging into `AdCvdOrder` with a `PENDING` review gate. |
| **ACE Port Codes** | `NOT_YET_IMPLEMENTED` | **Planned**: Published quarterly as fixed-width/CSV directory files by CBP. Requires fixed-width text parsing and upserting into `AcePortCode`. |
| **CBP Import Trade Trends** | `NOT_YET_IMPLEMENTED` | **Planned**: Published as monthly multi-tab Excel workbooks. Requires SheetJS binary stream parsing into `CbpImportTrend` time-series tables. |
| **USITC DataWeb (Import Stats)** | `NOT_YET_IMPLEMENTED` | **Planned**: Requires OAuth token exchange and dynamic query transformers aggregating customs values into landed cost benchmark tables. |
| **WTO Tariff Download Facility** | `NOT_YET_IMPLEMENTED` | **Planned**: Multi-gigabyte bulk CSV dumps across 160+ WTO members. Requires streaming CSV parsing into `WtoTariffRate`. |
| **Census Schedule B** | `NOT_YET_IMPLEMENTED` | **Planned**: Annual fixed-width text file (~9,000 export codes). Requires fixed-width column parsing into `ScheduleBCode`. |
| **Section 301 Rates (Lists 1-4B)** | `NOT_YET_IMPLEMENTED` | **Planned**: 100+ Federal Register PDF/HTML annexes (~7,500 HTS codes). Requires Gemini OCR extraction and staging as `PENDING` for mandatory admin review. |
| **Section 301 Exclusions** | `NOT_YET_IMPLEMENTED` | **Planned**: Legal prose notices across USTR releases. Requires LLM extraction generating compiled regex rules and effective date windows. |
| **Section 232 Rates & Exclusions** | `NOT_YET_IMPLEMENTED` | **Planned**: 25% Steel & 10% Aluminum rates, TRQ quotas, and General Approved Exclusions. Requires Commerce BIS scraper tracking quota cap thresholds. |
| **USMCA Rules of Origin (Annex 4-B)** | `NOT_YET_IMPLEMENTED` | **Planned**: ~2,000 Product-Specific Rules (PSR). Requires building a complex tariff shift parser (CC, CTH, CTSH) and RVC % graph tree in `TradeAgreementRule`. |
| **CAFTA-DR Rules of Origin** | `NOT_YET_IMPLEMENTED` | **Planned**: Annex 4.1 legal text detailing tariff shift rules for Central America. Requires rule tree parsing matching USMCA graph architecture. |
| **AD/CVD Company Deposit Rates** | `NOT_YET_IMPLEMENTED` | **Planned**: Annual review notices in Federal Register. Requires LLM tabular extraction of Case Numbers, Exporter Names, and staging as `PENDING` for admin review. |
| **PGA Requirements by HTS** | `NOT_YET_IMPLEMENTED` | **Planned**: ACE CATAIR Appendix PGA fixed-width text files across 15+ Partner Government Agencies (FDA, EPA, DOT, etc.). Requires fixed-width parsing into `HtsPgaRequirement`. |

---

### HTS Master Data Nightly Refresh
`GET /api/cron/hts-refresh` checks USITC for changes to the US Harmonized Tariff Schedule and stages a new release if the content has actually changed.

- **Schedule**: nightly, defined in `vercel.json` (`0 8 * * *`, i.e. 8am UTC). On Vercel this runs automatically once deployed. On other hosts, you need your own scheduler (e.g. a system cron, GitHub Actions on a schedule) making an authenticated `GET` request to this endpoint on the same cadence — `vercel.json`'s `crons` block only takes effect on Vercel.
- **Source**: fetches the real USITC export API (`https://hts.usitc.gov/reststop/exportList`) chapter by chapter (01–99), since a single request spanning the whole schedule is rejected by that API.
- **Change detection**: the fetched content is checksummed (SHA-256) and compared against the currently published release. If nothing changed, the run is a no-op (`status: "NO_CHANGE"`). This means it's safe to run nightly even when USITC hasn't published anything new.
- **Never auto-publishes**: a genuinely new revision is staged as `DRAFT` only — never automatically made live. Duty rates from this data feed real filing calculations (`/api/filing`), so a change to legally-binding tariff data goes through a human review-and-publish step: `POST /api/v1/admin/hts/releases/[releaseId]/publish`.
- **Auth**: set `CRON_SECRET` in production; the endpoint requires `Authorization: Bearer <CRON_SECRET>` when that env var is set (Vercel Cron sends this header automatically once `CRON_SECRET` is configured in your Vercel project).
- **Runtime**: configured with `maxDuration = 300` (seconds) — the chapter-by-chapter fetch plus batched DB inserts for the full schedule (~20k+ line items) takes roughly 2–3 minutes end to end.

To trigger it manually (e.g. to test), call the endpoint directly with the correct bearer token:
```bash
curl -X GET "https://<your-deployment>/api/cron/hts-refresh" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Document Processing Worker
`GET|POST /api/cron/document-processing` advances the Document Intelligence pipeline by one bounded pass: it submits queued documents to the configured parser provider, polls in-flight conversions, retrieves and persists completed results, runs the quality gate, and reclaims work abandoned by a crashed worker.

- **Schedule**: daily, defined in `vercel.json` (`0 9 * * *`). This endpoint is a **backstop, not the pipeline** — Vercel's Hobby plan allows two cron entries, each at most once a day, which is nowhere near enough to carry a document through submit-then-poll. What actually drives the pipeline on Vercel is the request path: uploading, reprocessing, or polling a document's processing status schedules a bounded drain via Next's `after()`, so a document reaches the parser within seconds. Cron then sweeps up what no request will ever touch — runs abandoned by a crashed worker, and conversions that outlived the invocation that started them. It also carries the inbound-email backstop tick, which has no cron entry of its own for the same reason.
- **On other hosts**, run the long-lived worker instead: `npm run worker:documents`. All three paths drive the same durable Postgres state and are safe to run simultaneously; every transition is a conditional update, so no two callers can double-apply one.
- **Auth**: requires `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set.
- **No work without a provider**: returns HTTP 503 with an explicit blocker when `DOCUMENT_PARSER_PROVIDER` is unset or IBM Docling is not configured, rather than a 200 that looks like an idle queue.
- **Does not hold the request open** waiting for the parser, and creates no documents, exceptions, or demo data.

See [docs/document-intelligence.md](docs/document-intelligence.md) for the architecture, processing profiles, provenance chain, configuration, and known limitations.

### Sanctions Watchlist Sync
`scripts/nightly-watchlist-sync.ts` exists in the repo but is **not currently wired to any scheduler** — running it today requires invoking it manually (`npx tsx scripts/nightly-watchlist-sync.ts`). It also currently seeds hardcoded example OFAC/BIS entries rather than fetching from a real sanctions list source. Treat it as a stub, not a working scheduled job.

### Customs Filing Inbound Message Worker
With `CUSTOMS_FILING_MOCK_RESPONSES` at its default, the transmit/resubmit/cancel routes simulate and apply a response inline, so no separate worker is needed for local development. `scripts/customs-filing-inbound-worker.ts` (long-running poll loop over `FilingMessage`) and `scripts/dev-stub-third-party.ts` (answers a pending outbound message as a stand-in customs authority would) exist for exercising the real async queue path end-to-end, but like the sanctions sync above, neither is wired to a scheduler — run them manually with `npx tsx`.

---

## 🧪 Testing & Build Verification

### Run Unit Tests

```bash
npm test
```

Some suites read the configured database, so prefer running the files that cover
what you changed. The `/chat` assistant's guardrails (RBAC gating, origin
safety, rate limiting, tool coverage) and the shared AI cost controls are
covered by the following files, which need no database and run in seconds:

```bash
npx vitest run tests/assistant-tools.test.ts tests/assistant-tools-rbac.test.ts \
  tests/assistant-orchestrator.test.ts tests/assistant-advisory.test.ts \
  tests/assistant-embargo-tools.test.ts tests/assistant-origin-safety.test.ts \
  tests/assistant-rate-limit.test.ts tests/ai-quota.test.ts tests/ai-meter.test.ts
```

### Production Build Verification

```bash
npm run build
```

---

## 🔑 Test User Credentials

Default password for all seeded test users: **`QuberePass2026!`**

| Email | Account / Context | Role | Access Level |
| :--- | :--- | :--- | :--- |
| `admin@qubere.ai` | Qubere Platform + Acme Corp | `PLATFORM_ADMIN` / `OWNER` | Full Platform Admin Console (`/platform-admin`) |
| `owner.acme@qubere.ai` | Acme Corporation (`ENTERPRISE`) | `OWNER` | Enterprise Owner |
| `admin.acme@qubere.ai` | Acme Corporation (`ENTERPRISE`) | `ADMIN` | Enterprise Admin |
| `member.acme@qubere.ai` | Acme Corporation (`ENTERPRISE`) | `MEMBER` | Standard Enterprise Member |
| `viewer.acme@qubere.ai` | Acme Corporation (`ENTERPRISE`) | `VIEWER` | Read-only Viewer |
| `owner.global@qubere.ai` | Global Trade Logistics (`ENTERPRISE`) | `OWNER` | Enterprise Owner |
| `multirole@qubere.ai` | Acme Corp & Global Trade | Multi-Account | Member @ Acme + Admin @ Global Trade |
| `admin@target.com` | Target (`ENTERPRISE`) | `ADMIN` | Account Admin (Views all Target data) |
| `joe@target.com` | Target (`ENTERPRISE`) | `ADMIN` | Account Admin (Views all Target data) |
| `anna@target.com` | Target (`ENTERPRISE`) | `ADMIN` | Account Admin (Views all Target data) |
| `sarah@target.com` | Target (`ENTERPRISE`) | `PLANNER` | Planner (Uploads docs; restricted to own data) |
| `romeo@target.com` | Target (`ENTERPRISE`) | `PLANNER` | Planner (Uploads docs; restricted to own data) |
| `eva@target.com` | Target (`ENTERPRISE`) | `PLANNER` | Planner (Uploads docs; restricted to own data) |

---

## 📄 License

© 2026 Qubere Inc. All rights reserved. Trade Compliance AI Platform.

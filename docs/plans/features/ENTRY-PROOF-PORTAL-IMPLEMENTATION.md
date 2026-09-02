# Partner portal: Entry Proof, shipment answers, and Your setup

## Current customer access model (supersedes client-filter assumptions below)

Active account membership grants access to the customer workspace. Broker-A keeps
Target, Amazon and DHL in separate accounts. Portal queries retain account and data
mode predicates, but client assignments, null client links and legacy document
visibility labels do not restrict reads within that workspace. Optional client filters
are organizational views. Role permissions, filing publication, document lifecycle
and other-workspace isolation remain enforced.

The September 2 follow-up makes Setup aggregate the account's importers and cases by
default. It retrieves stored executed PoAs without requiring ClientDocument promotion,
projects safe metadata and audits downloads. No live ownership repair or migration is
needed. Documents include legacy INTERNAL files with uploader attribution, and uploads
validate referenced client/shipment account membership before storing bytes. Default
workspace shipment/document lists skip importer-ownership lookups.

The user-provided diagnostic explains the previous mismatch: 000001 has no client or
importer link, Porter's assigned client has no onboarding, and the saved executed PoA
belongs to a null-client importer under another client record in the **same Target
account**. These links no longer hide records. No database records were changed.

The portal header/sidebar display the authenticated workspace, replacing a client
selector that only changed its label. Setup still offers an optional company filter.
The read-only diagnostic reports workspace access separately from client assignments.

Validation: real authorization-engine and route tests cover Target/Amazon/DHL workspace
isolation, null-client shipments, INTERNAL documents, workspace uploads, importer
aggregation, legacy signed downloads, role restrictions, data-mode contexts and loading
budgets. Portal source TypeScript passed. This restored environment lacks PGlite and happy-dom, so the PostgreSQL
execution and DOM-interaction test files cannot run here; SQL parameterization and
publication guards are covered in route tests. The other 113 portal tests and 14
authorization tests pass. No authenticated live walkthrough or
latency benchmark has been performed. The sections below record earlier implementation
history; the access model above governs current behavior. See the sales demo for the
current walkthrough.


Implementation of [issue #294](https://github.com/qubere/app-frontend/issues/294).

## Contract

The broker computes and publishes an immutable, versioned customer-safe Entry Proof.
The portal reads published payloads only. Customer questions and access requests use
CustomerRequest and its existing message workflow. Shipment answers are deterministic.
Neither assemblers nor API responses expose internal recommendations, agent notes,
buy costs, margins, or profit. Client/account scope is enforced before reading data.

## Delivery checklist

- [x] Shared pure entry-proof package, Decimal scorecard, safe finding copy and tests.
- [x] Shared migration: proof/events, stakeholders/documents, visibility columns.
- [x] Broker generation, atomic publication/supersession and Entry Proof workspace.
- [x] Portal published proof APIs, line questions, compliance table and dashboard.
- [x] Shipment answers API, At a glance view and attention items.
- [x] Setup API, document download, access requests, broker panel and promotion hooks.
- [x] Stakeholder backfill and notification preferences.
- [x] Guarded Target/Amazon demo seed and run instructions.
- [x] Product-accurate sales script and five deck additions.
- [x] Regression, isolation, redaction, versioning and tariff parity validation.

## Design decisions

Money uses Decimal until JSON serialization. A missing reference-data result is not
proof of non-applicability. Unavailable AD/CVD rates remain visibly unevaluated.
Published proof remains available while a replacement draft is prepared; replacement
publication atomically supersedes it. Publication and generation serialize per filing
to avoid duplicate versions or multiple current published proofs.

Setup does not send invitations on a customer's behalf. It records an access request
for broker review. Signed documents are served through authenticated storage access.
No ABI transmission, real 7501/invoice PDF generation, or customer recomputation is
introduced by this feature.

## Validation and rollout

Apply the checked-in migration and regenerate Prisma before starting either app.
The migration includes existing-role permission grants and partial unique indexes for
one current draft/publication per filing. Preserve those SQL additions if regenerating.

Run the guarded demo and contact/document backfill as described in
[the five-minute demo script](../../sales/PARTNER-PORTAL-ENTRY-PROOF-DEMO.md).
The existing authenticated compliance-notification dispatch cron must be scheduled for
email and bell reconciliation. OpenSign requires the shared webhook secret documented
in the demo script. Existing Dropbox Sign API methods remain stubs.

### Verified locally

- 102 focused tests: score branches, Decimal amounts, redaction, auth/scope, HTTP handlers,
  document access, notification preferences/retries, webhook authentication, versioning,
  company/origin rate resolution, and existing tariff/7501 regressions.
- Custom and portal TypeScript checks, including the demo/backfill scripts.
- Prisma schema validation and client generation.
- The seed's production guard rejects execution before database access.
- Diff whitespace check; deck has 14 slides and continues using its existing navigation.

Reproduce the focused tests from the repository root:

```bash
npx vitest run packages/entry-proof/src packages/auth/src/portal-auth.test.ts packages/auth/src/portal-permissions.test.ts packages/db/src/services/portal-status-mapper.test.ts
npm --workspace @qubere/custom test -- tests/entry-proof-service.test.ts tests/entry-proof-tariff.test.ts tests/portal-notifications.test.ts tests/portal-esign-auth.test.ts tests/form7501-builder.test.ts tests/unit/dutyEngine.test.ts
(cd apps/portal && ../../node_modules/.bin/vitest run --config vitest.config.mts)
```

### Environment validation still required

No test database, Clerk session, or provider credentials were configured in this workspace.
Migration application, the full seed, signed-document/email provider integration, and
an authenticated browser walkthrough have not been executed. The available cloud browser
could not reach the local component preview (ERR_BLOCKED_BY_CLIENT). Run the sales script
against an isolated demo database before presenting to a customer. GitHub reported no
workflow runs or commit status checks on the published branch during implementation.

The PR links this tracking issue for closure on merge; deployment validation remains
explicitly recorded here rather than being represented as completed.

### Deliberate implementation details

Reference-data absence never means zero duty. Specific/compound base rates are left
unavailable until quantity-aware computation exists. Manufacturer-specific rates use an
unambiguous active Product Master manufacturer; ambiguous manufacturers need review.
Customer-facing classification explanations use safe structural copy. Internal reviewer
notes are not automatically reused as customer explanations, and GRI/ruling fields stay
empty unless a publishable source is available.

The seed contains synthetic reference data and visibly synthetic setup PDFs. Use an
isolated demo database: the reference tables are global, even though clients are scoped.

## Client navigation

The portal uses the customs app's Qubere branding, muted rail, active white rows,
accordion sections, and collapsible icon rail. Actions stays pinned. Operations
contains Shipments, Freight (when enabled), and Documents; Compliance contains
Entry Proofs; Billing contains Invoices; Your company contains Your setup. Profile
and security stays in the footer. The portal uses its existing access capabilities
and routes, including active states for entry, request, and onboarding detail pages.
The former placeholder AI button is removed. Small screens use a dismissible drawer
with Escape, keyboard focus containment, and automatic close after navigation.

Validated with the portal TypeScript check and server-render smoke checks for seven
route/active-state combinations, customs/freight visibility, and client-only links.

## Shipment workspace and demo visibility follow-up

Shipment numbers link to a shared detail workspace from Shipments and Freight; both
lists omit the separate Action column. Freight reads assigned shipments with an active
TMS workspace instead of hard-coded orders. The detail workspace adds customer-safe
filing progress, route milestones, Tracking, and Filing data. Published line items come
from the immutable Entry Proof. Actual, estimated, and planned events stay distinct;
missing history is not presented as completed work. Existing transport-leg records are
supported alongside the newer journey legs.

Legacy portal APIs now establish both account and data-mode context before any query.
Missing database updates produce a 503 error with an actionable server log, while API
and network failures no longer render as successful empty dashboards. The reported log confirmed that an outdated running Prisma client lacked the
`entryProof` delegate. Optional summaries now load separately at `/api/dashboard/summary`,
so they cannot crash the core action list. Shipment proof failures likewise leave
tracking and existing requests available. Regenerate Prisma and restart the dev processes
to activate the new model; apply migrations if they have not already run.

Validation: 57 portal tests and four demo journey seed tests plus the portal TypeScript check pass, including mode
isolation, shipment and freight access, proof-list errors, redaction, milestone state,
and rendered identifier links/panels. The isolated demo seed includes journey examples
and preserves existing routes. Deployment/migration/Clerk walkthrough remain pending.


## Shipment loading and top-tab follow-up

The old detail route selected every Shipment scalar, all request message bodies,
documents, invoice lines, and each published proof payload. Once it completed, At a
glance made a second overlapping request. The updated route selects the fields used
by the header, milestone stepper, request titles, and published-entry metadata.
Documents/invoices are requested on tab selection in 50-record pages; Tracking loads
its history on selection. Request conversations stay on their existing thread route.
Published proof lines load only when expanded in Filing data. Component-local caches
reuse tab/page responses and reset on shipment navigation; aborted responses cannot
overwrite the active panel. Overview and answers fetch concurrently.

The answers route selects named fields, fetches unique issued invoices instead of all
invoice lines, and computes duty completeness within PostgreSQL so proof JSON never
crosses the database connection just to summarize costs. Its parameterized SQL repeats
account, client, data-mode, shipment, and publication checks explicitly because raw SQL
does not use Prisma's query-isolation extension. No migration or new stored field is
needed for this optimization.

Tabs now sit directly under the shipment heading. Overview lands on Filing progress;
other tabs replace the overview panel. View tracking details selects Tracking and
scrolls/focuses its panel, instead of changing content below the old long overview.
The portal maps @qubere/entry-proof to workspace source and includes it in package
transpilation. Run npm install after pulling a branch that adds workspace packages.

Verification: the portal's 84 tests pass, including React DOM interaction tests for
initial parallel loading, top-tab order, Tracking navigation/focus, tab caching,
pagination, lazy proof lines, and retry. An embedded PostgreSQL (PGlite) test executes
the actual cost-summary SQL against published/unpublished, other-client/account/mode,
and incomplete-duty fixtures. Portal TypeScript passes. Next.js 16.3.0 Turbopack
compile-mode build succeeds for all portal routes, including shipment answers.

Commands: npm --workspace @qubere/portal run test; npm --workspace @qubere/portal run
typecheck; npm exec --workspace @qubere/portal -- next build --experimental-build-mode compile.
Compile mode is compilation verification, not a deployed/authenticated walkthrough.
No live production latency claim is made. Use the browser Network panel to compare a
warm Overview load, first tab access, and repeat tab access against the same shipment
on the same database; repeat access should not refetch cached tab data.


## Broker PoA upload follow-up

Both importer/PoA upload forms sent multipart files to a JSON-only handler. The old
handler created legacy Active records and placeholder document URLs without promoting
a portal document. The handler now accepts and validates the actual file through the
existing storage/MIME/size/malware workflow, stores it, and transactionally creates an
executed PoA plus a client document for the account-verified importer/client. It keeps
the existing parties.manage write permission. Unlinked importers receive an explicit
portalVisible=false response and UI explanation; no client is guessed from a name.

The broker grids recognize the canonical executed status. Portal Setup selects the
newer PoA for the same importer instead of always preferring an older onboarding draft,
and filters the resolved stale POA blocker from its projection. Refresh setup and
window-focus refresh expose newly saved documents. Signed PNG/JPEG downloads retain
the correct content type and extension.

Validation: six broker upload tests and 22 portal Setup tests pass, covering multipart
storage/publication, account/client boundaries, missing/invalid files, unlinked importers,
failed publication, old-draft precedence, and signed-image downloads. Portal TypeScript
passes. The full customs typecheck exceeded the default 2 GB Node heap; a scoped check
of the changed upload route, both broker screens, their imports, and tests passed.
The live user database and real object-storage upload remain unverified here.

### Follow-up: onboarding and portal client mismatch (2026-09-02)

The screenshot pair shows Customs onboarding for `target` and an empty portal setup
for `Target Corporation`. Live client IDs were not available, so duplicate ownership
is an inference. Two code defects were confirmed: the new-case UI always sent
`newClient`, and entity creation omitted `ImporterOfRecord.clientId`. PoA/bond
publication then relied on that missing importer link.

- Existing-client onboarding is the default; the server validates the chosen client
  within the account. New importers inherit the case's client ID. The client picker
  selects only ID/name/contact email, searches within the account, and caps at 50.
- Legacy PoA/bond promotion also follows explicit onboarding-case relationships.
- A broker-only `POST /api/onboarding/cases/[caseId]/client` repairs the case and
  importer/legal-entity links and republishes the saved setup in one serializable
  transaction. Existing case document rows move with their visibility/revocation
  intact. Source clients with portal access or operational history, activated cases,
  and importers used elsewhere cannot be silently moved. Logins and operational data
  are never reassigned. The case event records the actor and before/after client IDs.
- A changed client requires reviewing Billing & access again. Saving the same client
  can repair legacy null links without resetting completed billing.
- Customs and portal now share the pure readiness function. Form 5106 submission,
  bond coverage, waivers, and all-entity completion use the same rules. Empty entity
  arrays cannot count as completed PoA/bond/screening. The portal selects the primary
  importer, ignores withdrawn cases, computes current public blockers, and explains
  missing case linkage rather than asserting a signature is outstanding.

Validation: 23 broker tests across onboarding-client-link, onboarding-client-repair,
PoA upload; 27 portal Setup tests including the screenshot state, submitted Form
5106, secondary entities, waivers and scope. TypeScript checks for the changed broker
and portal modules/tests passed. Full portal TypeScript was blocked by a missing
local PGlite test dependency in this restored workspace; no live database, storage,
Clerk session, or user record was changed. No schema migration is introduced.

### Follow-up: complete client workspace and multiple importers

- Shipment lists now include direct client shipments and shipments with a null direct
  client linked to any importer owned by that client. Detail and answers use the same
  explicit importer/case ownership, replacing the importer-name fallback. A conflicting
  explicit client is never overridden; ambiguous legacy case links fail closed. The
  list selects only displayed metadata and offers Previous/Next paging.
- Documents resolves client ownership directly or through its shipment/importer. It
  combines customer-visible shipment files and active, visible setup documents, with
  bounded 25/50-row keyset pages across both sources and stable timestamp ties. Downloads
  recheck both the document and linked shipment scope. No full parsed document JSON or
  storage URLs are fetched for the list. Internal files retain their visibility policy.
- Uploaded by uses original upload audit events or the inbound sender. It never uses
  the current assignee. Missing history is shown as Not recorded. Source, refresh,
  paging and the appropriate shipment/setup download endpoint are rendered per row.
  Lists no longer reuse a response after the user's client assignments change.
- Your setup returns all explicitly linked importers plus importers linked through
  every non-withdrawn case for the client. The newest case is selected per importer,
  not once for the entire client. Each importer has separate masked identifiers,
  registration, PoA, bond, screening, and progress. A registered importer can be On file
  without an onboarding case. The case-link warning no longer blocks those records.
  Entity-bound 5106 evidence is not applied to a sibling importer; overall completion
  requires every importer, and existing primary fields remain for compatibility.

Validation: 46 ownership/document/shipments/answers route tests and 32 Setup tests pass
(78 total), including both SHP-2026-000001 and SHP-2026-000002 fixtures, explicit-client
precedence, legacy ambiguity, uploader attribution, shared document downloads, source
pagination ties, current scope, multiple cases/importers and rendered importer cards.
TypeScript passes for all portal source and the changed workspace/Setup tests. These
fixtures do not establish the user's live shipment/client linkage. No database record,
permission assignment, or document visibility flag was changed in the live environment.

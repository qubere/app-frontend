# Performance Remediation — Dashboard, Actions, Compliance

Verified against `qubere/app-frontend` on branch `feat/ssr-documents-page`, 2026-08-26.
Every file, query, and index claim below was checked against the current code
(not assumed from the original draft) — see the "Verified facts" callouts inside
each section. Where the original draft's numbers were wrong, they're corrected
here; where they were right, they're confirmed with file:line citations so you
don't have to re-derive them.

The FCP/LCP/route-timing numbers below are as supplied by whoever wrote the
original brief — they have **not** been independently re-measured as part of
this review. Your first concrete step (see Instrumentation) should be capturing
a real current baseline before changing anything, so the before/after deliverable
is grounded in fresh measurements, not carried-over assumptions.

Current production measurements (unverified, treat as directional):

* First Contentful Paint: 6.83 seconds
* Largest Contentful Paint: 7.28 seconds
* `/app/actions`: approximately 7 seconds
* `/app/compliance`: approximately 4 seconds
* `/app/dashboard`: approximately 8 seconds

The small 450ms gap between FCP and LCP is consistent with fast client-side
rendering once content arrives. The primary problem is server response time,
database work, serialization, and payload size — not CSS.

Your task is to implement the fixes, add tests, and provide before/after
evidence. Do not stop after producing another analysis.

## Repository requirements

Before changing code:

1. Read `AGENTS.md` and `apps/custom/AGENTS.md`.
2. The app uses Next.js 16.3.0, React 19.2.8, Prisma (`@prisma/client` 6.19.3),
   and Clerk — confirmed in the root `package.json`/lockfile. **`apps/custom`
   has no local `next` install** — the package is hoisted to the workspace
   root, so the local docs `AGENTS.md` points you to actually live at
   `<repo-root>/node_modules/next/dist/docs/` (subdirs:
   `01-getting-started/`, `02-guides/`, `03-api-reference/`, `04-glossary.md`,
   `index.md`). Read the relevant guide there before using caching, streaming,
   Suspense, dynamic imports, or route configuration — this is a modified
   fork of Next.js and training-data assumptions about its APIs may not hold.
3. Preserve:
   * Tenant isolation
   * Account authorization
   * `withDataModeContext`
   * Production, Demo, and Sandbox data-mode behavior
   * Existing permissions and impersonation behavior
   * Existing visible business behavior and accurate KPI calculations
4. Do not remove `force-dynamic` or introduce cross-request caching unless the
   cache is demonstrably safe, tenant-keyed, data-mode-keyed, and correctly
   invalidated. (Both `apps/custom/src/app/app/actions/page.tsx` and
   `apps/custom/src/app/app/compliance/page.tsx` already declare
   `export const dynamic = "force-dynamic"`; the dashboard page has no explicit
   directive but is implicitly dynamic because it reads cookies via
   `getAccountContext()`. Keep all three dynamic.)
5. Do not hide the latency with loading spinners and consider the task
   complete. Loading states are useful, but the underlying database and
   payload work must be reduced.
6. Use additive, non-destructive database migrations. Validate proposed
   indexes with actual query plans and avoid redundant indexes — several of
   the candidate indexes below already partially overlap existing ones; see
   the Database index review section for exactly which.

## Primary files

Inspect at least:

* `apps/custom/src/app/app/dashboard/page.tsx`
* `apps/custom/src/app/app/dashboard/CommandCenterClient.tsx`
* `apps/custom/src/app/api/dashboard/metrics/route.ts`
* `apps/custom/src/lib/dashboard/agentOperationsSummary.ts`
* `apps/custom/src/app/app/actions/page.tsx`
* `apps/custom/src/app/app/actions/ActionsClient.tsx`
* `apps/custom/src/modules/work/workQueueLoader.ts`
* `apps/custom/src/lib/shipmentActions.ts` (builds the action groups consumed
  by `ActionsClient.tsx` — not in the original file list but load-bearing for
  the "complete action details per group" problem below)
* `apps/custom/src/components/DocumentReviewPanel.tsx`
* `apps/custom/src/app/app/compliance/page.tsx`
* `apps/custom/src/app/app/compliance/ComplianceWorkspaceClient.tsx`
* Compliance tab components under `apps/custom/src/app/app/compliance/`
  (`OverviewPanel`, `ScreeningPanel`, `ComplianceFindingsClient`,
  `AuditHistoryPanel`)
* `apps/custom/src/app/app/layout.tsx`
* `packages/auth/src/auth.ts`
* `packages/db/prisma/schema.prisma`
* `packages/db/src/index.ts`

Also inspect API routes invoked during or immediately after the initial
render. Several existing API routes use unbounded `findMany` and broad nested
`include` objects. Fix those only where they affect these three experiences
or would remain a clear performance regression after the page changes.

## Problems to fix

### P0: Dashboard over-fetching and sequential queries

**Verified facts** (`apps/custom/src/app/app/dashboard/page.tsx`):

* `SHIPMENT_ROW_CAP = 2000` (line 33), used as `take: SHIPMENT_ROW_CAP` on the
  shipment query (line 67). This was **raised from 500 to 2000 as a stopgap**
  (see the comment at lines 24-32) specifically because accounts with >500
  shipments got silently truncated KPIs — `shipmentTotalCount` is already
  fetched separately (line 72) and a `shipmentsTruncated` flag (line 116)
  already exists to warn the UI when the cap was hit. This refactor should
  **fully supersede that stopgap**: once KPIs come from DB aggregates instead
  of the capped in-memory list, the table query's `take` can be set to
  whatever the visible page needs (10-25) independent of KPI accuracy, and the
  `shipmentsTruncated` UI affordance becomes unnecessary (or should be
  recomputed against the true total, which is already available).
* The shipment query's nested data (lines 61-64) is already a narrowed
  `select`, not a blanket `include: {...: true}` — a prior pass already
  trimmed unused columns/relations (see comment at lines 35-40). It still
  pulls `documents: { select: { ..., extractedJson: true } }` (line 61,
  needed only to derive a currency code via `extractedCurrency()` at line
  321), plus `lineItems`, `exceptionItems`, and `agentDecisions` selects.
  Removing `extractedJson` is the concrete fix; the rest of that select is
  already reasonably narrow but still fetched for up to 2000 rows when only
  10-25 render.
* There genuinely are **two separate `agentDecision` queries**, both capped at
  `SHIPMENT_ROW_CAP` — one tenant-wide (`page.tsx:83-104`, feeding
  `computeAgentOperations` and the AI Throughput tile) and one embedded
  per-shipment via the select above (feeding per-row `aiReview` counts).
  They are not a literal duplicate fetch of the same rows for the same
  purpose, but both do a full up-to-2000-row scan where an aggregate would
  do — both need to move to `groupBy`/aggregate queries, not just one.
* Every query in the page's data loader is a **sequential `await`** — no
  `Promise.all` appears anywhere in the file (confirmed by direct search).
  That's roughly a dozen round trips run back-to-back: shipments,
  shipmentTotalCount, clients, decisions, decisionTotalCount,
  classificationCaseCounts, classificationOverrideCount,
  openRevalidationFlags, productReviewCount, significantProductChanges30d,
  memberships, regUpdates, openDeadlines.
* Readiness, missing-document counts, exception counts, and latest-decision
  dedup are computed **in JavaScript** per shipment (`page.tsx:237-352`, and
  again per-agent in `agentOperationsSummary.ts:41-48`) — not via DB
  aggregates. (Contrast: classification/revalidation signals in the same file
  *do* already use `groupBy`/aggregate, at lines 122-126 and 152-156 — use
  that as the pattern to extend.)
* The client renders only the first 10 rows
  (`CommandCenterClient.tsx:375`, `filteredShipments.slice(0, 10)`), but all
  up to 2000 fetched shipments are still sent to the client and used there for
  KPI/attention/broker-workload computation in JS.
* `CommandCenterClient.tsx:187-196` fires a client-side `fetch` to
  `/api/dashboard/metrics` on mount (and on client-side filter changes) — a
  genuine second waterfall after SSR. That route independently queries
  `customsFiling` (twice, with nested includes), `exceptionItem`, and
  `workMetricSnapshot` — overlapping subject matter with the SSR queries,
  fetched again from scratch.
* No `ShipmentOperationalSummary` or dashboard-snapshot table exists anywhere
  in the schema or codebase (confirmed by grep). The only precedent for a
  pre-aggregated table is `WorkMetricSnapshot`, used for the Filing Pipeline
  cycle-time chart only — not for shipment-level readiness/exceptions.
* No prior performance work has touched this query/waterfall structure; the
  `SHIPMENT_ROW_CAP` bump and truncation flag are the only performance-adjacent
  changes and predate this plan.

Required dashboard changes:

1. Query only the rows needed for the initially visible table — normally
   10-25 shipments.
2. Do not calculate account-wide KPIs from a capped list.
3. Calculate account-wide KPI values with database-side `count`, `groupBy`,
   aggregate queries, or a purpose-built summary query.
4. Keep the table query and KPI queries separate:
   * Table query returns a small page of records.
   * KPI queries return compact aggregate results.
5. Remove `documents.extractedJson` from the dashboard list query.
6. If currency is required, use a persisted scalar currency field or another
   narrow source. Do not load complete extraction JSON merely to derive one
   currency code.
7. Do not load every nested document, line item, exception, and decision for
   the dashboard list — the existing `select` is already narrower than a raw
   `include`, but it's still fetched for up to 2000 rows; scope it to the
   paged table query only.
8. Calculate readiness, missing-document counts, exception counts, and latest
   agent states from narrow aggregates or a persisted operational summary,
   replacing the current in-JS computation.
9. Consolidate the two separate `agentDecision` queries (tenant-wide and
   per-shipment-embedded) into aggregate/`groupBy` queries so neither does a
   full up-to-2000-row scan.
10. Move "latest decision per shipment and agent" into an efficient database
    query (e.g. `DISTINCT ON` via raw SQL, or a `groupBy` + follow-up narrow
    fetch) or a maintained summary, rather than loading thousands of decisions
    and deduplicating them in JavaScript.
11. Run independent database operations concurrently (`Promise.all`) after
    reducing their size — currently zero concurrency is used across roughly a
    dozen sequential queries.
12. Remove the initial metrics waterfall:
    * Return the initial metrics from the server-rendered page, or
    * Stream a below-the-fold metrics section through Suspense.
13. Client-side refreshes can remain for subsequent filter changes, but they
    must not block or materially alter initial LCP.
14. Preserve exact KPI correctness for accounts with more than 2,000
    shipments and decisions — this is the actual bug the current
    `SHIPMENT_ROW_CAP` stopgap was patching around; the aggregate-based
    design should make it correct by construction rather than by raising a
    cap further.
15. If the cleanest long-term design is a `ShipmentOperationalSummary` or
    dashboard snapshot table, implement it safely (correct invalidation,
    tenant+data-mode keyed) or document concretely why an aggregate-query
    implementation is sufficient instead — there's no existing table to build
    on, so this is a real design decision, not a refactor of something
    partially built.

### P0: Actions page query waterfall and oversized initial state

**Verified facts** (`apps/custom/src/app/app/actions/page.tsx`,
`ActionsClient.tsx`, `workQueueLoader.ts`, `shipmentActions.ts`):

* There genuinely are two waves: wave 1 is `Promise.all([agentDecision,
  shipmentDocument, exceptionItem, canWrite, hasPermission])`
  (`page.tsx:57-130`); wave 2 (filings + deadlines, also internally
  `Promise.all`) runs inside `loadWorkQueueForAccountFromPrefetched`
  (`workQueueLoader.ts:300-333`), called via a separate `await` **after**
  wave 1 resolves (`page.tsx:132-137`). Before merging the two waves, confirm
  whether `loadWorkQueueForAccountFromPrefetched` actually uses wave 1's
  results as query *inputs* (e.g. to filter filings/deadlines by the
  decision/document/exception IDs just fetched) — if so there's a real data
  dependency and the waves can't simply be flattened into one `Promise.all`;
  if not, flattening is safe and is what requirement 1 below asks for.
* `evidenceItems: true` is selected for up to 200 decisions
  (`page.tsx:64-98`, `take: 200`, `orderBy: createdAt desc`) — confirmed.
* `buildShipmentActionGroups` (`shipmentActions.ts:95-133`) embeds the full
  raw decision/exception object (including `evidenceItems`) into every
  `ActionItem` in every group (`shipmentActions.ts:35,54`) — confirmed, this
  is "complete action details for every shipment group."
* Three separate `JSON.parse(JSON.stringify(...))` round-trips on the full
  decisions/documents/exceptions result sets (`page.tsx:139-141`) — done
  purely to strip non-serializable values (e.g. `Date`) before grouping.
* `DocumentReviewPanel` and `ExceptionSlideOver` are statically imported in
  `ActionsClient.tsx:9-10` — no `next/dynamic` used anywhere in that file.
* `?shipmentId=` is read server-side (`page.tsx:48-49`) and used once on
  initial render to select a group (`ActionsClient.tsx:155-159`); there is no
  `useSearchParams()` or URL sync on later selection changes — this is
  existing behavior, not a regression to fix, just something the refactor
  must not break.
* No pagination or virtualization exists — flat arrays capped at
  `take: 200` / `ROW_CAP = 500` (`workQueueLoader.ts:24`).
* The one confirmed N+1-shaped client fetch is in `DocumentReviewPanel.tsx:
  520-534` — a `useEffect` keyed on `documentId` that fetches
  `/api/documents/${documentId}/extractions` every time a document is opened.
  Since `evidenceItems` is already embedded server-side, this is the actual
  per-selection fetch to keep bounded and tenant-scoped (and to defer via
  dynamic import), not a broader evidence-per-decision problem.
* `page.tsx:13` already declares `export const dynamic = "force-dynamic"` —
  preserve it.

Required Actions changes:

1. Where wave 2 (filings/deadlines) has no real data dependency on wave 1's
   results, place it in the same concurrent query phase as decisions/
   documents/exceptions. If a genuine dependency exists, document it rather
   than forcing a flatten that breaks correctness.
2. Return compact action-group summaries for the initial queue.
3. Do not include large `evidenceItems`, complete document extraction data,
   or other detail-only fields in the list payload.
4. Load complete evidence and document-review details only when a group or
   decision is selected.
5. Preserve `?shipmentId=` deep-link behavior exactly as it exists today
   (server-read once, used to pick the initial group).
6. Paginate or virtualize the queue instead of treating 200 records (500 in
   `workQueueLoader`) as the permanent list architecture.
7. Replace the three `JSON.stringify`/`JSON.parse` round-trips with explicit
   narrow DTO mapping.
8. Dynamically import interfaces that are opened conditionally, including:
   * `DocumentReviewPanel`
   * `ExceptionSlideOver`
   * Other modal-only or PDF-review components
9. Ensure the PDF runtime remains loaded only when a PDF review is actually
   opened.
10. Preserve decision approval, rejection, bulk actions, waivers, assignment,
    filters, and urgency calculations.
11. Keep `DocumentReviewPanel`'s per-document extraction fetch bounded,
    tenant-scoped, and not re-triggered redundantly for a document already
    loaded in the current session.

### P0: Compliance loads every tab's data upfront

**Verified facts** (`apps/custom/src/app/app/compliance/page.tsx`,
`ComplianceWorkspaceClient.tsx`, tab components):

* A single `Promise.all` (`page.tsx:31-92`) fetches, unconditionally,
  regardless of which tab is active:
  * `complianceFinding.findMany` — genuinely **unbounded**, no `take` at all.
  * `complianceAuditRecord.findMany` — **capped at `take: 25`**
    (`page.tsx:50`), not unbounded and not 50 as an earlier draft of this plan
    assumed. Still fetched on every load regardless of tab, which is the real
    problem to fix (move to Audit-tab-only), not its bound.
  * `complianceScreeningFinding.findMany` — `take: 300`, confirmed.
  * `restrictedPartyScreeningResult.findMany` — `take: 50`, confirmed, and
    **already filtered by `status: { in: [...] }`** (line 63) and already
    gated behind `mayReadPartyScreening = holdsPermission(context,
    "compliance.restrictedParty.read")` (line 23). An earlier draft
    characterizing this query as unfiltered/ungated would be wrong — the
    actual problem is that it's fetched eagerly for all 50 rows with broad
    nested includes (`matches: true`, `redFlagHits: true` — full-row
    `include`, not `select`) even though the screening list view only needs
    `hitCount`/`redFlagCount` summary counts; full match/red-flag/disposition
    detail is only needed when a card is expanded.
  * `partyScreeningSummary.groupBy` — confirmed.
* Tab selection is **client-state only**
  (`ComplianceWorkspaceClient.tsx:67-78`, `useState` synced to `?tab=` via
  `window.history.replaceState`, not a server-aware navigation). The server
  component never reads the tab and always fetches everything.
* All four tab components (`ComplianceFindingsClient`, `ScreeningPanel`,
  `OverviewPanel`, `AuditHistoryPanel`) are statically imported
  (`ComplianceWorkspaceClient.tsx:5-8`) — no code-splitting, all bundled
  together.
* **Audit history has no permission gate today** — `mayReadPartyScreening`
  only guards the restricted-party screening query and UI; `recentAudits`/
  `AuditHistoryPanel` is visible to any authenticated user with route access.
  This is a pre-existing gap independent of performance. Do not silently add
  or remove access control as a side effect of this refactor — preserve
  current visibility exactly, and separately flag this gap for a product
  decision rather than resolving it unilaterally.
* `page.tsx:7` already declares `export const dynamic = "force-dynamic"` —
  preserve it.

Required Compliance changes:

1. Make the selected tab URL-driven and server-aware:
   * `overview`
   * `screening`
   * `review`
   * `audit`
   * `history`
2. Overview should receive:
   * Compact aggregate counts
   * A small number of recent or highest-priority records
   * No complete tab datasets
3. Fetch full screening data only for the Screening tab.
4. Fetch compliance findings only for the Review tab, except for small
   Overview summaries.
5. Fetch audit rows only for the Audit tab (currently fetched on every load
   at `take: 25` regardless of tab — bound is already reasonable, scoping is
   the fix).
6. Keep History lazy; do not preload execution history.
7. Add cursor-based or reliable server pagination to findings, screenings,
   and audit records — `complianceFinding` currently has none at all.
8. Replace broad nested `include` objects (`matches: true`, `redFlagHits:
   true`) with narrow `select` objects everywhere the full row isn't needed.
9. Fetch restricted-party match/red-flag/disposition detail on demand
   (card-expand), not upfront for all 50 rows — the list view only needs
   summary counts.
10. Lazy-load inactive tab components via `next/dynamic`.
11. Preserve permission-based visibility for restricted-party screening
    exactly as implemented (`compliance.restrictedParty.read`). For execution
    history, preserve its current (ungated) visibility rather than changing
    it — flag the gap separately as noted above.
12. Preserve tab URLs, counts, resolution workflows, and filtering behavior.

### P0: Shared account context blocks every page

**Verified facts** (`packages/auth/src/auth.ts`,
`apps/custom/src/app/app/layout.tsx`):

* `getAccountContext = cache(loadAccountContext)` (`auth.ts:344`) — React
  `cache()` dedupes within one request/render pass only; there is no
  cross-request store. Every new request re-runs the full loader.
* The primary user query uses a broad `include`, not `select`
  (`auth.ts:71-91`, duplicated at 100-122 for an email-fallback path):
  `platformRoles.platformRole`, and for every membership (not just the active
  one) the full `account`, plus `roles.role.rolePermissions.permission` —
  a full role/permission graph pulled for every membership on every request.
* Four further queries run as **sequential `await`s**, not `Promise.all`:
  impersonation lookup (`auth.ts:145-175`), direct assignments
  (`auth.ts:253-258`), team assignments (`auth.ts:260-269`), and "every
  active client" enumeration (`auth.ts:271-272`).
* Direct-assignment and team-assignment queries run **unconditionally**, with
  no `isAllClients` guard before them (`auth.ts:253-269`) — for all-clients
  users (broker/TMS admins, platform admins) both queries run and their
  results are simply discarded by the ternary at line 271.
* The active-client-ID enumeration (`auth.ts:271-272`,
  `db.client.findMany({ where: { accountId, status: "ACTIVE" }, select: {
  id: true } })`) also runs even when `isAllClients: true` already makes it
  unnecessary for downstream authorization.
* Ordering to preserve in any refactor: platform-admin flags come from
  `platformRoles` and are independent of account context (lines 137-141);
  impersonation (144-192), when an active non-expired
  `impersonationSession` exists, **short-circuits** the cookie-based account
  selection entirely — cookie logic (193-220, reads `ACTIVE_ACCOUNT_COOKIE`,
  falls back to first active membership, re-sets the cookie as a side
  effect) only runs when there's no impersonation. The final active/deleted
  status guard (222-229) runs last. Any restructuring must preserve this
  exact precedence.
* `apps/custom/src/app/app/layout.tsx:12` awaits `getAccountContext()`
  synchronously before any JSX (including `Sidebar`/`Header`) renders, with
  no Suspense boundary — confirmed, the whole shell blocks on this one call.
* No prior work on this file's query/caching structure — recent commits
  touching "permissions" (`fd52339`, `ef12ce5`, `1043602`) modified
  `permissions.ts`, document API routes, and SSR list pages, not `auth.ts`.

Required authentication changes:

1. Narrow the primary Prisma selection to only required fields — replace the
   broad `include` at `auth.ts:71-91`/`100-122` with a `select` that pulls
   only the active membership's role/permission data, not every membership's
   full account + permission graph.
2. Skip direct-assignment and team-assignment queries when `isAllClients` is
   true (currently unconditional).
3. For restricted users, execute direct-assignment and team-assignment
   queries concurrently (`Promise.all`), not sequentially.
4. Do not enumerate every client ID if `isAllClients: true` is sufficient for
   downstream authorization.
5. If some consumers truly require a full client-ID list, load it only in
   those consumers, not unconditionally in `loadAccountContext`.
6. Consider separating:
   * Core session/navigation context
   * Full authorization/scope detail
7. Preserve all impersonation, platform-admin, active-account-cookie, role,
   permission, and membership behavior exactly as described above.
8. Add regression tests proving authorization was not weakened — this is the
   highest-blast-radius change in the whole plan; treat it accordingly.

## Database index review

**Verified current indexes** (`packages/db/prisma/schema.prisma`) — check
these before adding anything, several candidates below already partially
overlap:

| Model | Tenant/status/time fields | Existing indexes |
|---|---|---|
| `Shipment` | `accountId`, `status`, `deletedAt`, `createdAt` | `@@unique([accountId, shipmentNumber])`, `@@index([accountId])`, `@@index([status])`, `@@index([currentStage])`, `@@index([deletedAt])`, `@@index([masterShipmentId])`, `@@index([filingDeadline])`, `@@index([promiseState])`, `@@index([lastFreeDay])`, `@@index([healthStatus])` |
| `AgentDecision` | `accountId`, `status`, `triageState`, `createdAt` (no `state` field) | `@@index([shipmentId])`, `@@index([accountId])`, `@@index([status])`, `@@index([triageState])`, `@@index([accountId, triageState])`, `@@index([autoApproved])`, `@@index([documentId])`, `@@index([reviewedByUserId])` |
| `ShipmentDocument` | `accountId`, `status`, `createdAt` | `@@index([shipmentId])`, `@@index([accountId])`, `@@index([accountId, checksum])`, `@@index([documentType])` — **no `status` index of any kind currently** |
| `ExceptionItem` | `accountId`, `status`, `createdAt` (no `updatedAt`) | `@@index([accountId])`, `@@index([status])`, `@@index([resolutionReasonCode])`, `@@index([documentId, fieldKey])`, `@@index([assignedToUserId])`, `@@index([filingId])`, `@@index([shipmentId])` |
| `ComplianceFinding` | `accountId`, `status`, `createdAt` (no `updatedAt`) | `@@index([accountId])`, `@@index([filingId])`, `@@index([status])` |
| `ComplianceAuditRecord` | `accountId`; **no `status`/`state`, no `createdAt`** — timestamp field is `runAt` | `@@index([accountId])`, `@@index([filingId])` |
| `RestrictedPartyScreeningResult` | `accountId`, `status` (enum), `screeningDate` (plus separate `createdAt`) | `@@index([accountId, screeningDate])`, `@@index([accountId, partyId])`, `@@index([accountId, shipmentId])`, `@@index([accountId, lineItemId])`, `@@index([accountId, status])`, `@@index([correlationId])`, `@@index([screeningInputHash])` |
| `RegulatoryUpdate` | no `accountId` (global, non-tenant table); `status`, `createdAt`/`updatedAt`, `effectiveDate` | `@@index([jurisdiction])`, `@@index([category])`, `@@index([impactLevel])`; unique on `documentNumber` |

Candidates from the original draft, evaluated against the table above:

```prisma
Shipment:
@@index([accountId, deletedAt, createdAt])
// Net new — no existing composite covers this. Justified.

AgentDecision:
@@index([accountId, createdAt])
// Net new.
@@index([accountId, triageState, createdAt])
// Overlaps existing @@index([accountId, triageState]) — the 2-column index
// becomes a redundant prefix once this 3-column one exists. Validate with
// EXPLAIN whether the extra createdAt column actually avoids a sort in the
// dashboard/actions queries; if it does, add this AND drop the now-redundant
// 2-column index in the same migration rather than carrying both.
@@index([accountId, status, createdAt])
// Net new — no existing [accountId, status] composite.

ShipmentDocument:
@@index([accountId, createdAt])
@@index([accountId, status, createdAt])
// Both net new — there is currently no status index at all on this model.

ExceptionItem:
@@index([accountId, status, createdAt])
// Net new.

ComplianceFinding:
@@index([accountId, status, createdAt])
// Net new.

ComplianceAuditRecord:
@@index([accountId, runAt])
// Net new. Note: the field is `runAt`, not `createdAt` — this model has no
// createdAt field at all, so the original draft's naming is already correct
// here; just confirm the implementer doesn't typo it to createdAt.

RestrictedPartyScreeningResult:
@@index([accountId, status, screeningDate])
// Partial overlap with TWO existing indexes: [accountId, screeningDate] and
// [accountId, status]. This model already carries 7 indexes. Before adding
// an 8th, run EXPLAIN against the actual screening-list query this refactor
// produces — if the two existing indexes already satisfy it (Postgres can
// sometimes combine bitmap scans across both), skip this one. Only add it if
// EXPLAIN shows a real plan improvement, and consider whether it makes
// [accountId, status] fully redundant enough to drop.

RegulatoryUpdate:
@@index([effectiveDate])
// Net new, no tenant scoping needed (global table). No overlap.
```

Use production-like query shapes and `EXPLAIN (ANALYZE, BUFFERS)` before
finalizing indexes — and run it against the **new, narrowed** queries this
plan produces (paged dashboard table query, KPI aggregates, actions list
query, per-tab compliance queries), not the current oversized ones, since the
query shapes are about to change substantially. Confirm for each index you
keep:

* The actual generated SQL
* Selectivity
* Sort direction
* Existing index overlap (per the table above)
* Write amplification
* Query-plan improvement

Create a Prisma migration for the justified indexes only.

## Loading, streaming, and code splitting

After reducing backend work:

1. Add meaningful `loading.tsx` experiences for Dashboard and Compliance.
2. Retain or improve the Actions loading experience.
3. Use Suspense boundaries for below-the-fold or slower independent sections
   where appropriate.
4. Do not make the authenticated shell wait for below-the-fold metrics.
5. Run a production bundle analysis.
6. Code-split modal-only, PDF-only, and inactive-tab code.
7. Prevent visible layout shifts when deferred metrics arrive.

## Instrumentation

Add enough instrumentation to identify where time is spent. Measure
separately:

* Clerk authentication
* Account-context database loading
* Each page-data query group
* Server-side transformation time
* React Server Component response size
* API payload sizes
* Function cold-start versus warm response time
* Database connection acquisition
* Supabase query duration

Use safe production logging or tracing. Do not log personal data, extracted
document data, authorization details, or sensitive trade data.

Confirm that the deployment/function region is colocated with the Supabase
database region and that the correct serverless-compatible pooler
configuration is used. **This cannot be verified from the repo alone** —
`packages/db/src/index.ts` instantiates a plain `PrismaClient` (with
`transactionOptions: { maxWait: 15000, timeout: 30000 }`) with no pooler
config, region setting, or connection-limit override in code; the
dev-only `globalForPrisma` caching (only active when `NODE_ENV !==
"production"`) has no bearing on production pooling. Any pooler/region
configuration lives entirely in the `DATABASE_URL` environment variable
(e.g. `pgbouncer=true`, `connection_limit`, Supabase's transaction-mode
pooler port 6543 vs session-mode 5432) and in the Vercel/Supabase project
settings — check those directly. Report any mismatch; do not silently change
production infrastructure settings.

## Required tests

Add automated tests covering:

Performance/data-volume behavior

* Dashboard account with more than 2,000 shipments
* More than 10,000 agent decisions
* Large document extraction JSON
* Large numbers of compliance findings and screening results
* Initial dashboard query does not load all shipment rows
* Initial dashboard query does not select `extractedJson`
* KPIs remain accurate beyond the table page
* Compliance Overview does not fetch full tab datasets
* Actions list does not include evidence payloads
* Detail endpoints are bounded and tenant-scoped

Functional behavior

* Dashboard KPI correctness
* Dashboard client and broker filters
* Dashboard attention ranking
* Actions deep linking with `shipmentId`
* Decision approve/reject/bulk actions
* Exception waiver and assignment
* Compliance tab navigation
* Compliance permissions (restricted-party gate; document the current
  ungated state of audit history rather than asserting a gate that doesn't
  exist)
* Pagination behavior
* Impersonation
* Platform-admin access
* Regular account access
* Demo/Sandbox/Production data isolation
* Cross-account access attempts

## Performance acceptance criteria

Measure using a production build and a realistic database dataset. Targets
for warm authenticated requests:

* FCP: p75 at or below 2.5 seconds
* LCP: p75 at or below 2.5 seconds
* Dashboard server response: preferably below 1.5 seconds
* Actions and Compliance server response: preferably below 1.5 seconds
* No unbounded list query in these initial page loads
* No initial payload containing complete extraction JSON
* No KPI derived from an artificially capped list
* No cross-tenant or cross-data-mode cache leakage
* No material layout shift from deferred metrics

If infrastructure latency prevents a target, provide the measured
application time, database time, network time, and the remaining blocker. Do
not claim success without measurements.

## Validation commands

Confirmed present in `apps/custom/package.json`:

```bash
npm run typecheck --workspace=apps/custom
npm run lint --workspace=apps/custom
npm test --workspace=apps/custom
npm run build --workspace=apps/custom
npm run test:e2e --workspace=apps/custom
```

(`typecheck` → `tsc --noEmit`, `lint` → `eslint`, `test` → `vitest run`,
`test:e2e` → `playwright test` — all confirmed to exist, no substitutions
needed.)

Run any relevant database migration validation and query-plan checks.

## Deliverables

Complete the implementation and provide:

1. A concise summary of each root cause fixed.
2. Files changed.
3. Database migration details.
4. Before-and-after measurements for each route.
5. Before-and-after query counts and query duration.
6. Before-and-after initial payload size.
7. Before-and-after client bundle size for affected routes.
8. Test results.
9. Remaining risks or follow-up work — explicitly include the pre-existing
   audit-history permission gap noted above as a flagged-but-not-fixed item.
10. Exact deployment and migration commands.
11. A PR-ready commit with a clear title and description.

Prioritize real reduction in database work and transferred data. Do not
trade correctness, security, or tenant isolation for speed.

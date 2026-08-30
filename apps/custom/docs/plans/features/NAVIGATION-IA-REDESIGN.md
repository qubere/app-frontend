# Navigation & Information Architecture Redesign

**Status:** Phases 1 / 2a / 2b / 3a / 3b / 3c / 4a / 4b / 4c / 4d shipped (in review). Remaining: small follow-ups (Escalate button, standalone classification detail route, permission-catalogue fix, per-tenant Filing Settings).
**Author:** Rachit Lohani (with Claude)
**Date:** 2026-08-29
**Primary user:** a licensed customs broker working many shipments under hard filing
deadlines. Every extra click, every hidden screen, every ambiguous label costs time
they do not have.

---

## 1. Problem

The sidebar has grown to ~20 flat links across 3 visible sections, plus a cramped
2-column "pills" grid (`renderAs: "pills"`) that exists only because that section
overflowed. There is no hierarchy and no way to collapse what you are not using.
Several broker-critical screens are **reachable only by deep link** (Bonds, Powers of
Attorney, Importers of Record, Tariff Simulator, Regulatory Intelligence, ACE
Reconciliation, Duty Drawback).

Symptoms:

- New features get bolted onto whichever section has room, not where they belong.
- "Actions" reads as a feature category, which invites a per-workspace "Actions"
  link in every workspace — the exact duplication we want to avoid.
- Billing is one pill among tooling links despite being a full workspace with its
  own 9-tab internal nav.
- Platform-admin-only items (`Qubere Console`, `Filing Configuration`) sit in the
  tenant sidebar. `Qubere Console` is *already* in the avatar menu — it is
  duplicated.

## 2. Principles

1. **Nothing critical is hidden.** Every route a broker needs is reachable from the
   sidebar in ≤ 2 clicks. Routes that are genuinely internal (platform admin,
   account settings) live in the avatar menu, never nowhere. A test enforces this
   (`navigation-coverage.test.ts`).
2. **One inbox, one dashboard.** A single global **Today** queue and a single
   **Command Center**. Never repeat them per workspace.
3. **Workspaces are accordions.** The active workspace is expanded; the rest
   collapse to one row. One open at a time.
4. **A workspace with in-page tabs gets one sidebar row** (+ at most one deep link
   to its hottest queue). Do not mirror the tab bar in the rail.
5. **Regroup and rename freely; do not move URLs.** `canAccessHref` /
   `navItemByHref` is also the Copilot's authorization gate
   (`src/modules/assistant/shared/toolAccess.ts`). Every href referenced there
   must keep resolving. Route moves also break deep links in notification emails
   and ~15 doc references.

## 3. Target hierarchy

```
● Today                     → /app/actions        (renamed from "Actions")
▚ Command Center             → /app/dashboard

OPERATIONS
  Shipments                  → /app/shipments
  Documents                  → /app/documents      (was under "Tooling")
  Customs Filing             → /app/filing
  Post-Entry                 → /app/post-entry      hub: Drawback · ACE Recon · PSC · Protests

COMPLIANCE
  Compliance Workspace       → /app/compliance      tabs: Overview·Screening·Review·Monitoring·RDPS·Bulk
  Licenses                   → /app/license-management
  Regulatory Updates         → /app/regulatory      (direct link; also in the Tariff tools hub)
  Reports & Audit History    → /app/compliance-reports

DATA & INTELLIGENCE          (was "Tooling & Admin")
  Trade Data                 → /app/trade-data      hub for Products + Parties
  Tariff & Regulatory Tools  → /app/tariffs         hub: Regulatory Intel + Simulator
  Tariff Simulator           → /app/simulator       (direct link; previously hub-only)

BILLING
  Billing Workspace          → /app/billing         tabs: Overview·Clients·Rate Cards·Usage·Economics·Invoices·Exceptions·Reports·Settings
  Exceptions & Leakage       → /app/billing/exceptions   the one queue brokers live in

MANAGEMENT
  Clients & Legal Entities   → /app/clients
  Importers of Record        → /app/importers-of-record   (was unlisted)
  Bonds                      → /app/bonds                 (was unlisted)
  Powers of Attorney         → /app/poa                   (was unlisted)

── avatar menu ("Manage Account") ──
  Account Profile · Users & Access · Roles & Permissions · Settings & Audit
  Document Email · Integrations & APIs
  Qubere Console            → /platform-admin       platform admins only
  Filing Configuration     → /app/filing-config     platform admins only

── persistent header ──
  🔔 Notifications bell (already exists — NotificationBell). Phase 3 widens sources.
```

### Sidebar states

```
COLLAPSED WORKSPACE          EXPANDED (active)           ICON RAIL (w-20)
┌────────────────────┐       ┌────────────────────┐      ┌──────┐
│ ● Today        12  │       │ ● Today        12  │      │  ●   │
│ ▚ Command Center   │       │ ▚ Command Center   │      │  ▚   │
│                    │       │                    │      │  ──  │
│ OPERATIONS      ▸  │       │ OPERATIONS      ▾  │      │  📦  │  ← flat list,
│ COMPLIANCE      ▸  │       │   Shipments        │      │  📄  │    all items,
│ DATA & INTEL    ▸  │       │   Documents     3  │      │  🗂  │    tooltips,
│ BILLING         ▸  │       │   Customs Filing   │      │  🧾  │    no headers
│ MANAGEMENT      ▸  │       │   Post-Entry       │      │  ...  │
└────────────────────┘       │ COMPLIANCE      ▸  │      └──────┘
                             │ DATA & INTEL    ▸  │
                             │ BILLING         ▸  │
                             │ MANAGEMENT      ▸  │
                             └────────────────────┘
```

- The expanded section is the one containing the active route. If the active route
  is a pinned item or lives in the avatar menu, the last-expanded section (from
  `localStorage`) is restored, defaulting to Operations.
- Clicking a collapsed header expands it and collapses the previously open one.
- Empty sections (all items filtered out by permission) are dropped, unchanged
  from today's `visibleNavigation`.

## 4. "Today" vs "Actions" — decision

**Rename to Today.** "Actions" names a feature category ("what can I do here?"),
which is why the instinct is to repeat it in every workspace. "Today" names a
destination and a habit — the screen you open first, that already knows what is
yours and what is breaching. It also matches how the page already sorts (urgency /
SLA). Route stays `/app/actions`; label + `<PanelHeading>` change only.

---

## 5. Converged Today page (Phase 2)

Today already unifies **Operations** work: `/app/actions` merges `AgentDecision` +
`ExceptionItem` + the work queue via `buildShipmentActionGroups` /
`ActionsClient`. Phase 2 adds two more lanes that are separate pages today:

| Lane | Source | Lives today at |
|---|---|---|
| Operations | `AgentDecision` + `ExceptionItem` + work queue | `/app/actions` ✅ |
| Compliance | `ScreeningFinding` review queue + RDPS hits | `/app/compliance?tab=review` |
| Billing | `BillingException` (schema.prisma:8637) | `/app/billing/exceptions` |

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Today                              32 items · 4 breaching SLA in < 2h        │
├──────────────────────────────────────────────────────────────────────────────┤
│  Scope: [Mine] Team Unassigned All        Lane: [All] Ops(21) Cmp(7) Bill(4)  │
│  Filters: Client ▾  Priority ▾  Type ▾  □ Blocking only                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⏰ BREACHING SOON (4)                                                         │
│   🔴 OPS   SHP-TGT-2026-001 · Ocean leg   ISF due 1h12m   Missing HTS ×2      │
│   🔴 CMP   Party "Ningbo Superior"        UFLPA match 88%  [Review][Waive ▾]  │
│   🟠 BILL  Invoice INV-4471 · Globex      Rate-card gap $1,240                │
│                                                                              │
│  📋 REVIEW QUEUE (18)  — grouped by shipment / entity / invoice              │
│   SHP-ACM-2026-114 · Acme Imports                              3 items        │
│     • Classification 8471.30.0100 (92%)      [✓] [✎] [✗]                     │
│     • Valuation: assist not deducted         [Open]                          │
│                                                                              │
│  ✅ CLEARED TODAY (11)  ▸ collapsed                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2a — SHIPPED

- `src/modules/today/todayLanes.ts` — pure layer: `TodayLane` union,
  `TodayLaneItem` shape (`{ id, lane, kind, severity, title, summary, groupKey,
  groupLabel, clientName, shipmentNumber, href, createdAt }`), severity
  normalizers, row→item mappers, `groupLaneItems`, `summarizeLane`. Fully unit
  tested (`tests/today-lanes.test.ts`).
- `src/modules/today/loadTodayLanes.ts` — `loadComplianceLane` (open
  `ComplianceFinding` **+** `ComplianceScreeningFinding` — the schema has no
  `ScreeningFinding`; the review queue is `ComplianceFinding`, screening hits are
  `ComplianceScreeningFinding`), `loadBillingLane` (open `BillingException`),
  `loadTodayLaneCounts` (cheap `count()` for the badge).
- `/app/actions` (`page.tsx`) loads both lanes in its existing `Promise.all`,
  gated by `compliance.read` / `billing.exception.view` — an ungranted lane is
  `null` and its chip never renders. Lanes are **account-wide** (the
  My/Team/Unassigned scope only applies to assignable Operations work).
- `ActionsClient` renders a lane strip (`Operations · Compliance · Billing` with
  counts, `?lane=` linkable); `TodayLanePanel` renders the compliance/billing
  lane as grouped cards.
- `/api/today/summary` + a second `usePolling` in `Sidebar.tsx` drive the "Today"
  rail badge (Σ open across visible lanes).

### Phase 2b — SHIPPED (inline disposition)

- `TodayLanePanel` is interactive. Each row gets action buttons by kind, gated
  by permission (page passes `canResolveCompliance` = `exceptions.resolve`,
  `canResolveBilling` = `billing.exception.resolve`, `canWaiveBilling` =
  `billing.exception.waive`):
  - `review-finding` -> **Resolve** / **Accept risk** (`POST
    /api/findings/:id/resolve`, status `Resolved` / `AcceptedRisk`; accept-risk
    requires a note).
  - `screening-finding` -> **Mark resolved** (`POST
    /api/screening-findings/:id/resolve`).
  - `billing-exception` -> **Resolve** / **Waive** (`POST
    /api/billing/exceptions/:id/disposition`, reason required).
- Action verbs stay **distinct per kind** -- no generic "Action" (see
  `memory/project_actions_page_merge.md`).
- Billing core extracted to `src/lib/billing/disposeBillingException.ts` (shared
  by the workspace server action and the new Today route -- same optimistic-lock
  + audit behavior). `billing-tenant-isolation.test.ts` scan now covers
  `src/lib/billing/`.
- Optimistic: disposed rows drop from the panel and the lane-strip count
  decrements. `tests/today-lane-disposition.test.ts`.

### Phase 2b follow-up — NOT built

- **Cross-lane "breaching soon"** band -- needs deadline/exposure data on the
  compliance + billing rows (only Operations carries `urgencyByShipment` today).
- **Undo** on a just-disposed row (the APIs support re-opening `ComplianceFinding`
  but not the others).

---

## 6. Notification hub (Phase 3)

The bell was the right shape but half-wired: every notification linked to
`/app/documents` regardless of what raised it, and there was no categorization.

### Phase 3a — SHIPPED

- `src/modules/notifications/notificationRouting.ts` — **pure** (no DB, shared by
  the client bell and the server): `NotificationCategory`, `NOTIFICATION_TYPE_META`
  (every `type` string → category + label), `resolveNotificationHref` (routes by
  entity then category — `AgentDecision` → `/app/actions?decisionId=`,
  `ExceptionItem` → `?exceptionId=`, `CustomsFiling` → `/app/filing/:id`, licence
  → `/app/license-management`, billing → `/app/billing/exceptions`, …).
- `src/modules/notifications/notify.ts` — the one way to raise a bell
  notification. Typed `type`, optional `dedupe` (replaces the ad-hoc
  "findFirst then maybe create" guard in inbound-email + quarantine-review),
  best-effort (logs + swallows — a notification is never load-bearing).
- All six existing producers migrated to `notify()` (`slaSweepJob` ×2,
  `exception.service`, `inboundEmailWorker`, `quarantineReview`, `work/assign`,
  `work/[kind]/[id]/escalate`) — they now carry a category and link to the item.
- `/api/notifications` enriches each row with `category` / `categoryLabel` /
  `href`; `NotificationBell` renders a category icon + label and links via the
  server-computed `href` (client fallback to the same pure function).
- `tests/notification-routing.test.ts` — routing table, category mapping,
  `notify()` dedupe + error-swallow.

### Phase 3b — SHIPPED

- `src/modules/notifications/notifyAccount.ts` — `notifyAccountRoleHolders`:
  fan-out for events with no single assignee. Active OWNER/ADMIN members +
  holders of a named permission, deduped, one notification each.
- **License expiring / utilization** — `src/modules/licenses/licenseAlertNotifications.ts`:
  `notifyLicenseAlerts` reuses `computeLicenseAlerts`, collapses to one row per
  (license, kind), notifies `licenses.view` holders (`LICENSE_EXPIRING` /
  `LICENSE_UTILIZATION`, entity `License`). Called from the `license-alerts` cron
  alongside the email digest, in its own try/catch.
- **Regulatory update** — the existing `regulatory-ingest` producer migrated to
  `notify()`: `regulatory_alert` -> `REGULATORY_UPDATE` + `entityType:
  "RegulatoryUpdate"`, so it links to `/app/regulatory` not `/app/documents`.
  `regulatory_alert` kept as a legacy routing alias.
- **SLA at risk** — new pass in `slaSweepJob` (step 2b): an assigned, untouched
  decision/exception within `AT_RISK_LEAD_MS` (4h) of its SLA deadline warns its
  assignee once (`SLA_AT_RISK`, `dedupe`). `SlaSweepResult.atRiskWarnings` added.
- Tests: `tests/notification-producers.test.ts`.

### Phase 3b follow-up — NOT built

- **Billing revenue leakage** — `detectRevenueLeakage` has the signal, but
  `BillingException` rows are seed-only today; needs a real producer job first.
- **Compliance findings** — bridge `persistComplianceScreeningFindings` into a
  `COMPLIANCE_FINDING` bell row.

## 7. Route consolidation (Phase 3c — SHIPPED)

- **`/app/tariffs` retired.** The hub only ever linked to Regulatory Updates and
  the Tariff Simulator, both now their own Data & Intelligence rows. The page
  `redirect()`s to `/app/regulatory`; the route stays in `UNLISTED_NAV_ITEMS` so
  deep links + the Copilot `navHref: "/app/tariffs"` still resolve.
- **`/app/compliance-reports` → the "Reports" tab of `/app/compliance`.** The page
  `redirect()`s to `/app/compliance?tab=reports`; `ComplianceWorkspaceClient`
  renders `ComplianceReportsClient` (self-contained, fetches its own data) under a
  new tab gated on `compliance.reports.view` / `.generate` / `.manage`. Route
  kept in `UNLISTED_NAV_ITEMS`.
- Both sidebar rows removed; the `regulatory` list was already server-loaded
  (the #112 "pinned to one update" claim was stale).
- Per-tenant **Filing Settings** page (distinct from the platform-global
  `/app/filing-config`) — still not built; a net-new feature, not IA work.

---

## 6b. Front doors for headless capabilities (Phase 4)

From the API→UI gap audit (issue #112): customs capabilities that are fully
built server-side but have no way to trigger them from the UI.

### Phase 4a — SHIPPED (on-demand shipment checks)

- `ComplianceChecksPanel` on the shipment workspace (under the readiness ribbon):
  **Run / Re-run** buttons for **Embargo screening** (`POST /api/screening/embargo`),
  **PGA screening** (`POST /api/pga/screen`), **Reconciliation** (`POST /api/reconcile`).
  Each shows a compact status (Clear / Action needed / Blocked / Not screened) and
  `router.refresh()`es so persisted `PgaRequirement` / `ReconciliationIssue` rows
  flow back into the readiness ribbon + exceptions drawer.
- Gated on `canManageJourney` (shipment write access) -- the same proxy the
  journey controls use. `/api/screening/embargo` + `/api/pga/screen` gate on the
  uncatalogued `ai.use`, `/api/reconcile` on the uncatalogued `shipments.manage`
  -- pre-existing route bugs, not fixed here.
- Result mappers extracted to `complianceCheckResults.ts` (pure, tested).

### Phase 4b — SHIPPED (Classification Inbox)

- `/app/classification` — a queue of every `ClassificationCase` for the account
  (only the per-product case *detail* existed before). Server-rendered list +
  `ClassificationInboxClient`: triage filter chips (Needs review / In progress /
  Decided / Failed / All) with counts, description search, per-row status +
  top-proposal HTS + confidence band.
- **Re-run** inline per row → `POST /api/v1/classification/cases/:id/runs`, then
  `router.refresh()`. Works for any case (needs only the case id).
- "Open" links to the existing detail page via the subject's
  `canonicalProductId`; product-less cases show the row but the link is inert
  (a standalone `/app/classification/:caseId` detail route is a follow-up).
- `GET /api/v1/classification/cases` enhanced to include the latest run's
  top-ranked proposal (+ HTS node) so the inbox renders without per-row calls.
- Nav: `classification` item under Operations, gated on `classification.read`.
- Filter logic extracted to `classificationInboxFilters.ts` (pure, tested).

### Phase 4c — SHIPPED (HTS Workspace)

- `/app/hts` — HTS Lookup, under Data & Intelligence. Client workspace:
  code / keyword **search** (`GET /api/v1/hts/search`), and a detail pane for a
  selected code with **hierarchy** (`/codes/:code/hierarchy`), **duty rates**
  (from the search node), and **legal / chapter notes** (`/codes/:code/notes` —
  citation + text). `?code=` deep-links (resolved via `/codes/:code`).
- Search was only ever inline in line-item editing; chapter notes — the
  reasonable-care artifact for a classification defense — had no surface at all.
- `htsFormat.ts` (pure: `codeLevelLabel`, `isClassifiable`, `headlineRate`,
  `normalizeHtsQuery`) + `tests/hts-format.test.ts`.

### Phase 4d — SHIPPED (Trade Intelligence)

- `/app/intelligence` (Data & Intelligence) — three tabs:
  - **HTS Benchmarks** — `GET /api/trade-intel/benchmarks` (industry avg duty,
    avg declared price, top origin, US import volume)
  - **Broker Scorecard** — `GET /api/risk/brokers` (accuracy %, override rate,
    correction rate, review time — banded green/amber/red)
  - **Supplier Risk** — `GET /api/risk/suppliers` (score + level, violation /
    missing-doc / PGA / classification issue counts)
- All three APIs had seed-data bugs already removed, so they can return empty —
  each tab has an explicit empty state.
- `intelligenceFormat.ts` (pure: `riskTone`, `accuracyTone`, `overrideTone`,
  `compactUsd`, `pct`) + `tests/intelligence-format.test.ts`.

### Follow-ups — NOT built
- **4b follow-up** — standalone `/app/classification/:caseId` detail route (today
  the detail page is `/app/products/:id/classification/:caseId` and needs a
  product); cross-run proposal compare via `/cases/:id/proposals`.
- **Escalate button** — `POST /api/work/:kind/:id/escalate` has no UI trigger in
  Today or the exceptions drawer.
- `ai.use` / `shipments.manage` not in the permission catalogue.
- Product `normalize` / `enrich/approve` / `bind-classification`; refund
  `opportunities/scan` trigger.

---

## 7. Rollout / safety

- **Phase 1 ships behind no flag** — it is pure IA (grouping, labels, accordion,
  surfacing hidden routes). No URL moves, no data changes.
- `navigation-coverage.test.ts` asserts every known app route is either in the
  sidebar, in the avatar menu, or an intentional redirect — fails the build if a
  future change orphans a screen.
- `navigation.test.ts` updated for the new section ids; permission-gating
  assertions unchanged.
- Copilot `toolAccess` hrefs (`/app/regulatory`, `/app/tariffs`, `/app/parties`,
  `/app/products`, `/app/post-entry`, …) verified to still resolve via
  `navItemByHref` — covered by a new assertion.
- `es.ts` + `en.ts` dictionaries updated together.

## 8. Out of scope

- Visual redesign of individual workspace pages.
- The Copilot's own navigation.
- Mobile-specific IA beyond the existing responsive drawer.

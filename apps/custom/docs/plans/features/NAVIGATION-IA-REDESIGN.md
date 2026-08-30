# Navigation & Information Architecture Redesign

**Status:** Phase 1 in review (this PR) · Phases 2–3 scoped, not built
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

### Work

1. Extract a `TodayLane` union type + a per-lane loader that returns a common
   `TodayItem` shape (`{ id, lane, priority, dueAt, groupKey, groupLabel, title,
   summary, actions[] }`).
2. Operations lane = adapter over the existing `ShipmentActionGroup`.
3. Compliance lane = new query over `ScreeningFinding` where status ∈ open/review,
   grouped by party/shipment. Actions: Review, Waive (needs `compliance.override`),
   Clear.
4. Billing lane = new query over `BillingException` where `status = OPEN`, grouped
   by invoice/client. Actions: Resolve, Snooze.
5. Lane chips filter client-side; counts come from the loaders.
6. Rail badge = Σ open items across lanes, scoped to "Mine" — reuse the existing
   `usePolling` pattern already in `Sidebar.tsx`.
7. Keep action vocabularies **distinct** per type (approve/reject vs waive/resolve
   vs snooze) — do not flatten to a generic "Action" (see
   `memory/project_actions_page_merge.md`).

### Phasing inside Phase 2

- 2a: Compliance lane (query-shaped already).
- 2b: Billing lane once `BillingException` has a matching read model.
- Until 2b, the Billing chip deep-links to `/app/billing/exceptions`.

---

## 6. Route consolidation (Phase 3)

- Merge `/app/regulatory` content into the `/app/tariffs` hub, or make `/app/tariffs`
  a thin redirect to a single "Trade Reference" page. Two routes, one concept today.
- Fold `/app/compliance-reports` in as a tab on `/app/compliance` (it already has
  Audit / History tabs).
- Widen the notification bell: wire compliance license-alerts, SLA sweeps, billing
  leakage, and regulatory ingests into `/api/notifications` so the bell is the one
  place "something changed while you were away" shows up.
- Per-tenant **Filing Settings** page (distinct from the platform-global
  `/app/filing-config`) if customers need to configure their own filing defaults.

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

# apps/tms — UX & Customer-Demo Readiness Audit

> Live-clicked at `http://localhost:3001`, signed in as `owner.acme@qubere.ai` (seeded Clerk user,
> `apps/custom/scripts/seed-clerk-users.ts:15`, password `QuberePass2026!`). Every finding below was
> reproduced directly in the running app — screenshots, DOM inspection (`element.value` vs
> `element.placeholder`), and raw network/SSE payloads were captured, not inferred from source alone.

## Verdict

The app is visually polished (this is a genuinely good-looking dashboard shell) but **not
demo-safe in its current state**. Three of the five main nav destinations either hard-crash, show
the wrong domain's data, or make core content (shipment detail) completely unreachable. The AI
chat — the product's headline feature — fabricates shipment records when its query fails, and does
so silently. A customer clicking through more than two screens will hit a broken page.

---

## P0 — will break or embarrass the demo

### 1. `/carriers` hard-crashes with a 500
Clicking "Carriers & Fleet" in the sidebar renders Next.js's generic error boundary: **"This page
couldn't load. A server error occurred."** (`ERROR 2807304185`). Root cause, confirmed by reading
the route: [apps/tms/src/app/carriers/page.tsx:15](../../../apps/tms/src/app/carriers/page.tsx) calls
`db.carrierProfile.findMany(...)` — `CarrierProfile` is one of the models with no migration (see
[TMS-01-schema-migration.md](TMS-01-schema-migration.md) P0-1); the table doesn't exist in Postgres,
so the query throws and the whole page dies. **Fix:** apply the missing migration (TMS-01 fix)
first — this page should come back once the table exists — then add an error boundary so a future
DB hiccup degrades to a message instead of a full crash.

### 2. Shipment detail pages are unreachable — both by URL and by clicking the link
- Direct navigation to `http://localhost:3001/shipments/<id>` (a real id copied from the list, e.g.
  `cmt4fjbqw000aedxwe3kuhczh`) renders **"Shipment Not Found — The requested shipment ID could not
  be loaded from active context."**
- Clicking the shipment number link *from the list page itself* (`href="/shipments/cmt1rswho..."`)
  does **not navigate at all** — `window.location.href` stays at `/shipments` after the click.
- The wording "could not be loaded from **active context**" (not "database" or "not found") suggests
  the detail view is reading from client-side React state populated by whatever the list page last
  fetched, rather than fetching by id from the server — which is also why a refresh or a shared link
  breaks it every time, and why the shipment count on the list page changed from 7 to 6 across two
  loads with no user action (a record disappeared from "active context" between renders).
- The "Open Shipment Workspace" button on the Exceptions & Alerts page hits the identical error.

**Impact:** there is currently no way to view a single shipment's detail/workspace in this app —
neither the flagship Shipments Workbench nor the Exceptions queue can open one. This is very likely
the single most-clicked action in any demo. **Fix:** make the shipment detail route fetch by id from
the server (`db.shipment.findUnique({ where: { id, accountId } })`) instead of depending on
client-side navigation state; confirm both direct URL entry and refresh work.

### 3. The AI chat fabricates shipment records — with a hardcoded fallback account id
Asked *"Which shipments are at risk right now and why?"* in `/chat`, the assistant returned two
shipments — `SHP-2026-004872` and `SHP-2026-009102` — that **do not exist anywhere in this account's
data.** (The real shipments in this account are `SHP-TEST-672682`, `SHP-RTLC-554007`, and four rows
numbered `SHP-2026-000001`/`-000002` — see finding 5 below.) The raw SSE trace from
`POST /api/assistant/chat` shows this isn't a rendering bug — the **tool result itself** contains the
fabricated data:

```
{"type":"tool_result","toolName":"list_shipments","result":{"count":2,"shipments":[
  {"shipmentNumber":"SHP-2026-004872", ...},
  {"shipmentNumber":"SHP-2026-009102", ...}]}}
```

Root cause, [apps/tms/src/modules/assistant/tools.ts:33-90](../../../apps/tms/src/modules/assistant/tools.ts):
```ts
execute: async (args, ctx) => {
  try {
    const accountId = ctx?.accountId ?? "acc_tms_01";   // line 35 — hardcoded fallback tenant id
    ...
    const shipments = await db.shipment.findMany({ where, ... });
    if (shipments.length === 0) {
      return { count: 3, shipments: [ /* hardcoded SHP-2026-004872, -009102, -003319 */ ] };  // line 55-63
    }
    return { count: shipments.length, shipments: shipments.map(...) };
  } catch {
    return { count: 2, shipments: [ /* same hardcoded pair, again */ ] };  // line 82-89
  }
}
```
Two separate fabrication paths: (a) a **hardcoded `accountId` fallback** (`"acc_tms_01"`) that
silently queries the wrong tenant if `ctx.accountId` is ever missing, and (b) **both the
zero-results branch and the `catch` block return literal hardcoded shipment records** presented
identically to real query output — including an invented `riskReason: "LFD in 24h - customs hold
active"` for a shipment that doesn't exist. Given the confirmed missing migration
(`promiseState`/`healthStatus`/`demurrageExposureUsd` columns don't exist yet — TMS-01 P0-1), the
real query here is plausibly throwing right now, meaning **every "at risk shipments" chat query in
the current build is answering entirely with fabricated data and giving no indication anything
went wrong.** This is the exact failure mode Section 3 Rule 1 of the build spec was written to
prevent, and it's the app's headline "agentic" feature doing it.

**Fix:** remove both hardcoded fallback arrays entirely — on zero results, return `count: 0` and let
the assistant say "no shipments match"; on a thrown error, surface a real error state to the user,
never synthesize a plausible-looking success. Remove the `"acc_tms_01"` fallback — `ctx.accountId`
missing should throw, not silently redirect to a fake tenant.

### 4. "New Shipment" form ships fake data as real field values — the exact bug the build spec named
This is a repeat of a previously-fixed, explicitly-documented incident
(`docs/plans/AI-FREIGHT-EXECUTION-WORKFLOW.md` Section 3, rule 2: *"`/app/shipments/new` previously
shipped literal fake data... as real field values, not placeholders — a live, confirmed bug, since
fixed. Any new form... must default to empty/null, never a plausible-looking sample value."*)

Opening "New Shipment" on the Shipments Workbench, the three text inputs are pre-populated with
**real `.value`, not `placeholder`** (confirmed via `input.value` / `input.placeholder` DOM read):

| Field | `.value` | `.placeholder` |
|---|---|---|
| Importer / Client | `"Acme Import Logistics LLC"` | `""` |
| Origin Port | `"CNSHA"` | `""` |
| Destination Port | `"USOAK"` | `""` |

A user who clicks "Create Shipment" without touching these fields creates a shipment for a company
that doesn't exist, on a lane that may not match what they meant. **Fix:** these must be
`placeholder=` attributes (or genuinely empty with a grey hint), not `value=`/`defaultValue=`. Grep
every new form under `apps/tms/src/app/**` for the same pattern — this was very likely a copy-paste
from one component into several forms, not a one-off.

### 5. Duplicate shipment numbers on the live Shipments Workbench
The 7-row shipment list contains **`SHP-2026-000001` three times** and **`SHP-2026-000002` twice**,
each with different importers/routes/exception counts:

```
SHP-2026-000001  test                     taiwan → AE    13 EXCEPTIONS
SHP-2026-000001  tst                      Indai → UZ     Clear
SHP-2026-000001  ABC Manufacturing India   Germany → LK   7 EXCEPTIONS
SHP-2026-000002  tes                      China → AD     Clear
SHP-2026-000002  ABC Manufacturing India   Germany → DZ   7 EXCEPTIONS
```
A shipment number is meant to be a unique, human-referenceable identifier — three different
shipments sharing "SHP-2026-000001" makes it impossible to unambiguously reference one in
conversation, in the chat, or in a support ticket. Separately, this is also plainly leftover
dev/QA data (`test`, `tst`, `tes`, `Indai` [typo of India], lowercase `taiwan`) that must not be
visible in a customer-facing demo account. **Fix:** (a) make `shipmentNumber` actually unique
(unique constraint + real sequence generation, not whatever produced these), (b) clean the demo
account's seed data before any customer sees it — this is a data-hygiene task, not just a code fix.

---

## P1 — undermines trust, not outright broken

### 6. Every shipment shows an identical 92% readiness score
All 7 rows on the Shipments Workbench show exactly **92%** in the "Readiness" column, regardless of
mode, exception count, or customs status. A shipment with 13 open exceptions and one with zero both
score 92%. Either this is a hardcoded placeholder never wired to real computation, or the formula
ignores the inputs that should obviously move it. **Fix:** trace where this value is computed (or
confirm it's a stub) and either wire it to real inputs or remove the score until it is.

### 7. Exception counts disagree across three surfaces for the same shipments
- Sidebar nav badge: **"Exceptions & Alerts 27"**
- Dashboard "Operations Inbox": **0 / 0 / 0** across every health/exception tile
- Exceptions & Alerts workbench header: **"27 open action items across 3 shipments"**, then each of
  the 3 shipment rows individually lists **"9 exceptions"** (3×9=27, consistent) — but the detail
  card for the same shipment (`SHP-2026-000002`) shows **"7 BLOCKED / 0 NEEDS REVIEW / 0 VERIFIED"**
  (7, not 9)
- Shipments Workbench lists `SHP-2026-000002` (the "ABC Manufacturing... Germany → DZ" one) with
  **"7 EXCEPTIONS"** — matching the detail card's 7, not the list's 9 — and a *different*
  `SHP-2026-000001` with **13 EXCEPTIONS**, a number that appears nowhere on the Exceptions page at
  all (which only shows 3 shipments total).

No two of these four counts for the same underlying data agree, and the dashboard's 0 vs. the
sidebar's 27 is the most glaring — a user's very first impression of the app is "everything is
fine" immediately contradicted by a red "27" one click away. **Fix:** find the single source of
truth for "open exceptions on a shipment" and make every surface (dashboard tile, nav badge,
workbench list, detail card) query it the same way. This is worth root-causing once, not patching
four times.

### 8. Exceptions & Alerts workbench shows customs-filing content, not freight content
The freight TMS's "Exceptions & Alerts" page — one of five primary nav destinations — renders
customs-broker-language exceptions verbatim: `"Entry Filing • BREACHED"`, `"missing_document"`,
`"Country of Origin was not found on ForwardingInstructions_2 1.pdf"`, `"158 items · 149
decisions"`. Nothing here is freight-shaped (no ETA delay, no missed pickup window, no
tender-response-needed — the exception types the build spec's Phase 5 actually calls for). This
reads as either the customs `ExceptionItem` data being displayed unfiltered inside the freight app,
or the page being a copy of `apps/custom`'s Actions page without freight-specific adaptation. A
freight operations user looking at "Country of Origin not found on a PDF" has no idea what that
means or what to do with it. **Fix:** confirm whether this page is meant to show customs
exceptions surfaced for freight-relevant shipments (in which case it needs freight-relevant framing
and copy) or whether it's accidentally unscoped and should be filtering to freight-native exception
categories only.

---

## P2 — polish

### 9. Sign-in page is unbranded
`/sign-in` shows Clerk's default copy — **"Sign in to My Application" / "Welcome back! Please sign
in to continue"** — with no Qubere branding, despite the app's own root page correctly showing "Qubere
TMS — AI Freight Execution Engine" as the tab title. Minor, but it's the very first thing a customer
sees. **Fix:** set Clerk's `appearance`/application name to "Qubere TMS" (check whether
`apps/custom`'s sign-in has the same gap — if so this is a one-line shared fix, not TMS-specific).

### 10. Empty states leak raw API routes to end users
The Freight Orders intake page's empty state reads: *"No transportation orders ingested yet. Use
the Intake Simulator above or submit via **POST /api/transportation-orders/parse**."* Showing a raw
HTTP method + route to a non-technical ops user is a developer-facing message that shipped to
production copy. **Fix:** rewrite as user-facing guidance, drop the API path.

### 11. "Account Isolated" badge in the header reads as an error state
The top-left breadcrumb shows `Enterprise Freight / Account Isolated`. "Isolated" without further
context looks like a warning (isolated = cut off / broken) rather than the presumably-intended
meaning (tenant data isolation is enforced). **Fix:** rename to something a customer wouldn't read
as a fault, e.g. a small lock icon + "Tenant-scoped," or drop it from the primary header entirely.

---

## Screens that worked cleanly (for contrast — not everything is broken)
- `/tenders` (Carrier Tenders & Booking Dispatch) — clean, correctly-worded empty state.
- `/invoices` (Carrier Invoice 3-Way Reconciliation) — clean, correctly-worded empty state.
- `/chat` — UI shell, prompt suggestions, and streaming all work smoothly; the *content* fabrication
  (finding 3) is the problem, not the interaction design.
- `/orders` (Inbound Freight Orders & AI Intake) — loads correctly, real API wired
  (`POST /api/transportation-orders/parse` referenced in its own empty state, unlike a stub).

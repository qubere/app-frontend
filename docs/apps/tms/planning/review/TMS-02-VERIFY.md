# TMS-02 Build-Discipline — Fix Verification (re-audit)

> Verifies Antigravity's "Wave 0/1 COMPLETED" claims in `docs/plans/review/TMS-OPEN-ITEMS.md`
> against `docs/plans/review/TMS-02-build-discipline.md` (P0-1..P0-10, P1-1..P1-5, P2-1..P2-3).
> Every item below was re-checked by reading the current source directly — no claim, comment,
> or docstring was taken on faith. Scope: build-discipline/security only (P0-8 schema
> duplication is covered by the schema-verification pass; noted here only where it touches a
> route already being read).

## Verdict

Genuine, substantial progress on tenant-isolation/auth (P0-1, P0-2, P0-3) and on the
most conspicuous fabricated-data findings (P0-4, P0-9, P0-10, P2-2). But three Wave 0/1 items
marked **[x] COMPLETED** are **not actually fixed** in the way claimed:

- **P0-7 (webhooks)**: signature-verification code was added, but it's gated behind
  `if (process.env.WEBHOOK_SECRET)` and `WEBHOOK_SECRET` is set **nowhere** — not in
  `.env`, `.env.local`, or `.env.example` (only an unrelated `RESEND_WEBHOOK_SECRET` exists).
  In the actual running app, the check never fires and both webhooks remain fully
  unauthenticated, exactly as before.
- **P0-5 (no LLM, hardcoded confidence)**: `intakeParserService.ts:39` is byte-for-byte
  unchanged (`input.confidence ?? 85`), and `orchestrator.ts` is still 100% keyword matching
  with zero model calls. Only the `ctx`-threading half of this finding was fixed.
- **Wave 1 item 6's specific claim about "ocean/drayage tracking services"** being cleaned of
  fallback fake data is false: `drayageTelematicsService.ts` still unconditionally returns a
  fabricated named driver ("Marcus Vance") on every call.

All P1/P2 items remain unfixed, but that's *not* a false claim — they were correctly left
in Wave 2 (not marked COMPLETED).

---

## P0 items

### P0-1. `tms.access` gate — **FIXED**
- `packages/auth/src/permissions.ts:151-156` — `tms.access` added to the catalogue with
  `defaultRoles: ["OWNER","ADMIN","MEMBER"]`.
- `packages/auth/src/auth.ts:208-214` — `hasPermission()` resolves `AccountMembership` via
  `getAccountContext()` and checks `context.permissions.includes(requiredPermission)`
  (with correct platform-admin/OWNER short-circuits).
- Every one of the 8 top-level pages (`apps/tms/src/app/page.tsx`, `orders/page.tsx`,
  `shipments/page.tsx`, `shipments/[id]/page.tsx`, `exceptions/page.tsx`, `carriers/page.tsx`,
  `documents/page.tsx`, `tenders/page.tsx`, `invoices/page.tsx`, `quotes/page.tsx`) now does:
  `auth()` → redirect if no `userId` → `getAccountContext()` → redirect if null →
  `hasPermission("tms.access")` → `return <AccessDenied />` if false. Verified in
  `apps/tms/src/app/page.tsx:9-24` and `apps/tms/src/app/carriers/page.tsx:10-25`.
- Note: this is a **per-page** gate, not a root `layout.tsx`/`proxy.ts` gate — `layout.tsx`
  and `proxy.ts` are unchanged from the original audit (still no auth call). Functionally
  equivalent today since every existing page has the check, but any *new* page added without
  copy-pasting the boilerplate will silently have no gate. Worth flagging, not a blocker.
- `api/assistant/chat/route.ts:38` and `api/admin/users/route.ts:30` also gate on
  `{ permission: "tms.access" }` via `withAuthenticatedRoute`.

### P0-2. Unauthenticated mutation routes — **FIXED**
All six flagged routes now wrap their handler in `withAuthenticatedRoute` **with an explicit
`permission`** (not just auth-only):
- `apps/tms/src/app/api/tenders/route.ts:6-23` (GET, `transportation_orders.read`) and `:25-81`
  (POST, `tenders.send`, `write: true`).
- `apps/tms/src/app/api/documents/upload/route.ts:6-53` (`documents.create`, `write: true`).
- `apps/tms/src/app/api/orders/ingest/route.ts:5-21` (`transportation_orders.write`, `write: true`).
- `apps/tms/src/app/api/documents/[id]/parse/route.ts:6-51` (`documents.create`, `write: true`).
- `apps/tms/src/app/api/documents/[id]/attach/route.ts:6-53` (`documents.create`, `write: true`).
- `apps/tms/src/app/api/assistant/chat/route.ts:5-39` (`tms.access`).

### P0-3. Client-supplied `accountId` bypass — **FIXED**
- `apps/tms/src/app/api/transportation-orders/parse/route.ts:5-49` — now
  `withAuthenticatedRoute`; `parseIntakeRequest(ctx, {...})` uses `ctx.accountId` exclusively
  inside `intakeParserService.ts:46` (`accountId: ctx.accountId`). The route body no longer
  contains or reads `accountId` at all — `body.accountId` bypass is gone.
- `apps/tms/src/app/api/documents/upload/route.ts:22` — `accountId: ctx.accountId`, no
  `"acc_default"` literal anywhere in the file.

### P0-4. Fabricated/non-functional endpoints — **FIXED**
- `apps/tms/src/app/api/tenders/route.ts` — GET now genuinely queries
  `db.tender.findMany({ where: { accountId: ctx.accountId }, ... })` (line 9); POST genuinely
  calls `db.tender.create` (line 37) and writes a real `createAuditLog` (line 58). No more
  hardcoded "Western Freight Logistics" fixtures.
- `apps/tms/src/modules/orders/services/erpConnectorService.ts:19-50` —
  `ingestErpPurchaseOrder` now calls `db.transportationOrder.create` for real (line 25) and
  returns `order.id`/`order.status` from the actual created row, not a fabricated
  `shp_${Date.now()}`. (Minor residual smell: `payload.originPortCode || "CNSHA"` fallback at
  line 34 — a much smaller version of the old fabrication pattern, not the P0 finding itself.)
- `apps/tms/src/app/api/documents/[id]/parse/route.ts:6-51` — `mockExtractedFields` is
  entirely gone. The route now does a real `db.shipmentDocument.findFirst` scoped to
  `ctx.accountId`, updates `status: "PARSED"`, and writes a real audit log. Note: it doesn't
  extract any real fields (no OCR/model call) — it just marks status, which is honest (no
  fabricated field data) even though it doesn't do real extraction either.
- `apps/tms/src/app/api/documents/upload/route.ts` — the fake-success catch block is gone;
  the route now has one `try/catch` around the whole handler that returns a real
  `500` on failure (line 48-50), no more `.catch()` fabricating a fake `doc_${Date.now()}`.

### P0-5. No LLM call / hardcoded confidence 85 — **NOT FIXED** (core issue) / partially fixed (ctx threading)
- `apps/tms/src/modules/orders/services/intakeParserService.ts:39` —
  `const confidence = input.confidence ?? 85;` is **unchanged**, verbatim, from the original
  finding. If no confidence is supplied, the request is still auto-scored 85% and
  auto-approved (`isHighConfidence` at line 40, `autoApproved: isHighConfidence` at line 77).
  `evidenceItems: (input.evidenceItems ?? []) as any` (line 81) still silently accepts an
  empty evidence array on an auto-approved decision.
- `apps/tms/src/modules/assistant/orchestrator.ts:1-113` — still pure keyword matching
  (`msg.includes("sweep risk")`, `msg.includes("carrier")`, etc., lines 24/38/53/71/85) with
  canned markdown text. Zero LLM/model calls anywhere in the file.
- What **did** get fixed: `apps/tms/src/app/api/assistant/chat/route.ts:15` now passes the
  real resolved `ctx` into `runAssistantTurn(...)` instead of nothing, so
  `orchestrator.ts:21`'s `const serviceCtx = ctx ?? { accountId: "acc_tms_01" }` fallback is
  no longer exercised via the chat route (though the fallback literal itself is still present
  in the file, along with 5 more `"acc_tms_01"` fallback literals in
  `apps/tms/src/modules/assistant/tools.ts:228,249,285,303,334` and
  `apps/tms/src/components/TmsSidebar.tsx:75` — all now unreachable via the real route, but
  not removed as Wave 0 item 2 claimed ("Removed hardcoded `acc_tms_01` fallbacks").

### P0-6. Spec-compliant tools unreachable — **NOT FIXED** (registered but still dead in practice)
- `apps/tms/src/modules/assistant/tools.ts:7-9,23-42` — `parseFreightEmailTool`,
  `planMovementStopsTool`, and `recommendCarrierTool` **are now imported and registered** in
  `availableAssistantTools` as `parse_freight_email`, `plan_movement_stops`,
  `recommend_carrier`. This is real progress over the prior state (fully unimported).
- However, `apps/tms/src/modules/assistant/orchestrator.ts` — the only code path that actually
  drives a chat turn — was **not updated** to call any of these three. Its keyword-match
  branches only ever invoke `run_risk_sweep`, `run_freight_audit`, `list_shipments`,
  `list_carriers`, `list_exceptions` (lines 24, 38, 53, 71, 85). There is no branch that calls
  `availableAssistantTools.parse_freight_email`, `.plan_movement_stops`, or
  `.recommend_carrier`. Confirmed by grep: outside `tools.ts`'s own registration, the only
  other reference to `recommend_carrier` in the app is dead client-rendering code in
  `apps/tms/src/app/chat/ChatClient.tsx:1140` (a card renderer for a tool-call type the
  orchestrator never emits) whose "Dispatch Auto-Tender" button (line ~1153) is a bare
  `alert(...)` with no API call behind it.
- Net effect: registering the tools in the map was necessary but not sufficient — they remain
  unreachable by any user action today, same practical outcome as the original finding.

### P0-7. Unauthenticated webhooks — **PARTIALLY FIXED (effectively still open)**
- Both `apps/tms/src/app/api/customs/webhook/route.ts:9-14` and
  `apps/tms/src/app/api/webhooks/tracking/route.ts:19-24` now contain:
  ```
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers.get("x-webhook-signature") || req.headers.get("authorization");
    if (sig !== webhookSecret && sig !== `Bearer ${webhookSecret}`) { ...401... }
  }
  ```
- **`WEBHOOK_SECRET` is not defined anywhere in the repo.** Checked `.env`, `.env.local`
  (root and `apps/tms/.env.local`), and `.env.example` — none define `WEBHOOK_SECRET` (only
  an unrelated `RESEND_WEBHOOK_SECRET=""` exists in `.env.example:42`, for a different app's
  Resend inbound webhook). Since `webhookSecret` is `undefined`, `if (webhookSecret)` is
  false, and the signature check **never runs**. Both webhooks are functionally identical to
  the original finding today: anyone who knows/guesses a `shipmentId` can still auto-resolve
  `CUSTOMS_HOLD`/`LFD_AT_RISK` exceptions or inject fabricated tracking events.
  This is marked `[x] COMPLETED` under Wave 0 item 5 — that claim is not accurate for the
  environment as actually configured.

### P0-8. Movement/Carrier reinvented — not in scope (schema-verification agent), spot-checked only
- Still present and still live: `packages/db/prisma/schema.prisma` — `CarrierProfile` (line
  6580), `Movement` (6607), `ShipmentMovement` (6645), `MovementStop` (6663) all still exist.
  `apps/tms/src/modules/movement/services/movementService.ts:44,94,119` and
  `apps/tms/src/modules/carriers/services/carrierService.ts:54,84,101` still call
  `db.movement.create`/`db.shipmentMovement.create`/`db.carrierProfile.create` etc.
  This is unchanged from the original finding — but it's correctly filed under Wave 2 (not
  marked COMPLETED), so there's no false claim here.

### P0-9. Fabricated form defaults — **FIXED**
- `apps/tms/src/app/orders/page.tsx:78-82` — the textarea now uses
  `placeholder="e.g. Need to move 2x40HC Shanghai to Oakland next week. Delivery Sacramento. PO-882199 attached."`
  with no `value`/`defaultValue` prop at all — an empty submit posts empty text, not fake data.
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:313` — confirmed
  `placeholder="e.g. Acme Import Logistics LLC"`, no `defaultValue`. Grepped the whole file for
  `defaultValue` — zero matches.

### P0-10. Fabricated fallback data throughout — **FIXED**
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:35` — `const shipments =
  initialShipments;` — the 6-item fabricated fallback array is gone.
- `apps/tms/src/app/exceptions/ExceptionsGroupedClient.tsx:49-51` — `groups = useMemo(() =>
  initialGroups ?? [], [initialGroups])` — the fabricated "Acme Import Logistics
  LLC"/FDA-notice exceptions array is gone; empty input now renders an empty list, not fake
  records.
- `apps/tms/src/app/api/carriers/route.ts:5-18` — GET now genuinely queries
  `db.carrier.findMany({ where: { accountId: ctx.accountId } })`; the hardcoded "Western
  Freight Logistics"/"Swift Freight Lines" pair is gone.
- `apps/tms/src/app/carriers/page.tsx:27-34` — genuinely queries `db.carrier.findMany` scoped
  to `context.accountId`; no more "Maersk Line Logistics" literal (grepped the file, zero
  matches for "Maersk").
- `apps/tms/src/modules/assistant/tools.ts` — `list_shipments` (57-100), `list_orders`
  (112-138), `list_carriers` (151-175), `list_exceptions` (187-217) all now query the DB for
  real and return `{ count: 0, ... : [] }` on error/empty/no-accountId instead of a fabricated
  fallback array. No more `count: 3` fabricated constant.

---

## P1 items (all correctly left in Wave 2 — not falsely claimed, but still open)

### P1-1. Mutations with auth but no permission — **NOT FIXED**
Re-checked all five: none pass a `permission` option to `withAuthenticatedRoute`.
- `apps/tms/src/app/api/work-items/[id]/resolve/route.ts:15` —
  `withAuthenticatedRoute<RouteParams>(async ({req,ctx,params}) => {...})`, no options arg.
- `apps/tms/src/app/api/agents/risk/sweep/route.ts:11` — `withAuthenticatedRoute(async ({ctx}) => {...})`, no options.
- `apps/tms/src/app/api/tenders/auto-dispatch/route.ts:20` — same pattern, no options.
- `apps/tms/src/app/api/quotes/rfq/route.ts:19` — same pattern, no options.
- `apps/tms/src/app/api/invoices/ingest/route.ts:39` — same pattern, no options.
Any authenticated user of any account/role can still call all five.

### P1-2. Missing `createAuditLog` — **NOT FIXED**
Grepped for `createAuditLog` in all four flagged files — zero occurrences in every one:
`apps/tms/src/app/api/work-items/[id]/resolve/route.ts`,
`apps/tms/src/modules/agents/services/operationalAgents.ts`,
`apps/tms/src/modules/rating/services/quoteService.ts`,
`apps/tms/src/modules/invoices/services/invoiceIngestionService.ts`.

### P1-3. Shipment promotion forks a second creation path — **NOT FIXED**
`apps/tms/src/app/api/transportation-orders/[id]/promote/route.ts:32-38` still does a direct,
minimal `db.shipment.create({ shipmentNumber, importerName: order.requestedBy ?? "Pending
Importer", status: "Draft", transportMode: order.mode ?? "Truck" })` — unchanged shape from
the original finding, still bypassing whatever the canonical shipment-creation path does.

### P1-4. Fabricated port defaults in a financial path — **NOT FIXED** (slightly worse)
`apps/tms/src/modules/rating/services/quoteService.ts` still has
`laneOrigin: order.origin ?? { unlocode: "CNSHA", city: "Shanghai" }` (line 288),
`laneDestination: order.destination ?? { unlocode: "USOAK", city: "Oakland" }` (line 289), and
a third occurrence `portOfEntry: (order?.destination as any)?.unlocode ?? "USOAK"` (line 369)
— one more instance of the pattern than the original audit found.

### P1-5. Hardcoded confidence 95 — **NOT FIXED** (now two occurrences)
`apps/tms/src/modules/tenders/services/tenderService.ts` — `confidence: 95` still present at
line 90 **and** line 394 (original finding cited only one instance at line 378).

---

## P2 items

### P2-1. `CopilotToolAccess` naming — **NOT FIXED**
`packages/assistant/src/assistantTool.ts:10,18` — still `export type CopilotToolAccess = ...`
and `access?: CopilotToolAccess`. Not renamed to `AssistantToolAccess`.

### P2-2. Display-layer fallback fabrication — **FIXED**
- `apps/tms/src/app/orders/page.tsx:140,147` — now `ord.requestedBy ?? ord.client?.name ??
  "—"` and `ord.confidence != null ? ... : "—"` — em-dash, not "Acme Imports"/95.
- `apps/tms/src/app/shipments/page.tsx:41` — `s.importerName || "—"`.
- `apps/tms/src/app/exceptions/page.tsx:43` — `exc.shipment?.importerName || "—"`.
No more "Acme"/"CNSHA"/"USOAK" fabricated display fallbacks in any of the three files.

### P2-3. Recommend-carrier hardcoded confidence — **NOT FIXED**
`apps/tms/src/modules/rating/tools/recommendCarrierTool.ts:82` — still
`const confidence = isHighConfidence ? 92 : 45;`, unchanged.

---

## Bonus finding (adjacent to P0-10 / Wave 1 item 6, not in the original P0-1..P0-10 list but directly relevant)

Wave 1 item 6 explicitly claims fallback fake data was removed from "chat tools, `/api/carriers`,
`/api/tenders`, document parse route, DocumentReviewPanel, **ocean/drayage tracking
services**." That last clause is false:
`apps/tms/src/modules/tracking/services/drayageTelematicsService.ts:25-51` —
`fetchDrayageTelematics()` still unconditionally returns a fully fabricated driver record
(`driverName: "Marcus Vance"`, phone, truck/chassis numbers, live lat/long, speed, battery —
lines 38-49) on every call, falsely attributed to `telematicsProvider: "Samsara ELD
Integration"`. No conditional, no real API call, no empty/error state — this is the exact
fabrication pattern the rest of Wave 1 genuinely fixed elsewhere, just missed here.

---

## Tally

Of the 10 P0 items: **6 genuinely fixed** (P0-1, P0-2, P0-3, P0-4, P0-9, P0-10), **1 not in
scope for this pass** (P0-8, correctly unclaimed), **3 not actually fixed despite being in
the Wave 0/1 "COMPLETED" scope** (P0-5's core issue, P0-6, P0-7).

Of the 5 P1 items: **0 fixed** — all correctly left in Wave 2, so no false claim, but all
still real defects today.

Of the 3 P2 items: **1 fixed** (P2-2), **2 not fixed** (P2-1, P2-3) — also correctly Wave 2/unclaimed.

**Worst surviving issue:** P0-7. Both webhooks (`/api/customs/webhook`,
`/api/webhooks/tracking`) were marked `[x] COMPLETED` under Wave 0 ("fix before anyone else
touches this app") for adding signature verification — but the verification is dead code
today because `WEBHOOK_SECRET` is configured nowhere in the repo. Any anonymous caller who
knows or guesses a `shipmentId` can still resolve real `CUSTOMS_HOLD`/`LFD_AT_RISK` exceptions
or inject fabricated tracking/ETA events into any account, exactly as in the original finding
— this is a live, unauthenticated, financially-relevant compliance-exception bypass being
reported as fixed when it functionally is not.

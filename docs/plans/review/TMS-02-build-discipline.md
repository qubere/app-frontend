# TMS Build-Discipline Audit (apps/tms + packages/auth, decisions, assistant)

Audited against `docs/plans/AI-FREIGHT-EXECUTION-WORKFLOW.md` Sections 3 & 4. All findings below are **CONFIRMED** by reading the actual source (not inferred from names/docstrings) unless marked **SUSPECTED**. Every uncommitted file in `apps/tms`, `packages/auth`, `packages/decisions`, `packages/assistant` was in scope.

**Bottom line:** the two "hard" checklist items — cross-app import boundary and `CopilotTool`/`defineTool` avoidance — are clean. Everything else has severe problems: the `tms.access` gate does not exist at all, roughly half of all mutation routes have zero auth, several "AI" endpoints are 100% hardcoded fake data with no DB write and no model call, and Antigravity re-forked the Movement/Carrier data model the spec explicitly told it to reuse.

---

## P0 — Critical (auth/permission bypass, fabricated data presented as real)

### P0-1. `tms.access` gate does not exist anywhere
Section 0/Phase 0/checklist all require a server-side `tms.access` permission check before any freight data renders, with a real access-denied page for users without it.
- `packages/auth/src/permissions.ts` — grep for `tms.access` across the catalogue: **zero matches**. Only `transportation_orders.read/write`, `carriers.manage`, `tenders.send`, `carrier_invoices.match/override` were added (these six are correctly declarative, matching the existing `PermissionDefinition` shape — no issue there).
- `apps/tms/src/app/layout.tsx:10-24` — root layout is `<ClerkProvider><html><body>{children}</body></html></ClerkProvider>`. No auth call, no permission check, nothing.
- `apps/tms/src/proxy.ts:1-16` — `clerkMiddleware(async () => {})`, comment claims "this skeleton only has a single Clerk-gated home page, which performs its own auth() check" — stale; the app now has 15+ pages and most do not check auth at all (see P0-2/P0-3).
- **Impact:** any authenticated Qubere user — including the customs-brokerage-only users the spec explicitly says should *not* see freight data by default — can open every page in `apps/tms` and hit every API route.
- **Fix:** add `tms.access` to `packages/auth/src/permissions.ts`'s `PERMISSION_CATALOGUE`; add a shared server component/layout check in `apps/tms` (per-page or a root async layout) that resolves `AccountMembership` via `@qubere/auth` and renders an access-denied page when the permission is missing, exactly as Phase 0 step 2 specifies.

### P0-2. Multiple mutation routes have no authentication at all
None of these call `withAuthenticatedRoute`, Clerk's `auth()`, or any other identity check:
- `apps/tms/src/app/api/tenders/route.ts` POST (line 12) — see P0-4, also fully fake.
- `apps/tms/src/app/api/documents/upload/route.ts` POST (line 4) — writes `db.shipmentDocument.create` with **no session check**.
- `apps/tms/src/app/api/orders/ingest/route.ts` POST (line 4) — calls `ingestErpPurchaseOrder(body)` with **no session check**.
- `apps/tms/src/app/api/documents/[id]/parse/route.ts` POST (line 4) — mutates `db.shipmentDocument.updateMany` with **no session check**.
- `apps/tms/src/app/api/documents/[id]/attach/route.ts` POST (line 4) — mutates `db.shipmentDocument.update` with **no session check**.
- `apps/tms/src/app/api/assistant/chat/route.ts` POST (line 4) — streams tool executions (including `run_risk_sweep`, `run_freight_audit` which mutate `ExceptionItem`/invoices) with **no session check**.
- **Fix:** wrap every one of these in `withAuthenticatedRoute` from `@qubere/auth` with an explicit `permission`, per spec item 3/checklist item 4.

### P0-3. Tenant-isolation bypass via client-supplied `accountId`
- `apps/tms/src/app/api/transportation-orders/parse/route.ts:14-19` — `const accountId = body.accountId ?? "acc_default"`, then builds `const mockCtx: any = { userId, accountId }` and passes it straight into `parseIntakeRequest`. The route does check `auth()` for a session, but **any authenticated user can write a `TransportationOrder` into any account** simply by putting a different `accountId` in the POST body. This is not `withAuthenticatedRoute`, so there is no server-resolved account context at all.
- `apps/tms/src/app/api/documents/upload/route.ts:21` — hardcodes `accountId: "acc_default"` outright; every uploaded document across every tenant lands in the same fake account.
- **Fix:** replace both with `withAuthenticatedRoute`, derive `accountId` exclusively from `ctx.accountId` (the resolved session), never from the request body.

### P0-4. Fabricated / non-functional endpoints presented as working features
These don't touch the database (or silently swallow DB failures) and return plausible-looking fake data as if real — this is the exact "ABC Manufacturing India / Maersk Line" failure pattern the spec names as a prior confirmed bug.
- `apps/tms/src/app/api/tenders/route.ts:3-22` — GET returns two **fully hardcoded** tenders ("Western Freight Logistics", "$2,150.00", etc.), never queries `db.tender`. POST does not call `db.tender.create` at all; it returns `{ ok: true, tenderId: "TND-"+random, ..., message: "Auto-tender dispatched to carrier via API" }` — a complete fiction. No `Tender` row is ever created by this route.
- `apps/tms/src/modules/orders/services/erpConnectorService.ts:19-46` — `ingestErpPurchaseOrder` imports `db` (line 1) but **never calls it**. It builds a local `newShipment` object with a fabricated id (`shp_${Date.now()}`), a hardcoded fallback port `"Oakland, CA (USOAK)"` (line 31) and a fabricated `"${originPortCode}, China"` string (line 30), then returns `{ success: true, message: "PO #... ingested from ERP. Created shipment ..." }`. Nothing is persisted; the success message is false.
- `apps/tms/src/app/api/documents/[id]/parse/route.ts:11-44` — `mockExtractedFields` is a **hardcoded array** of "OCR extraction" results: `"Acme Import Logistics LLC"`, `"Shanghai, China (CNSHA)"`, `"Port of Oakland, CA (USOAK)"`, a made-up container number `"TGBU-902184"`, with fake per-field confidences (99/97/99/95) and bounding boxes. Response claims `"AI Agent completed 100% OCR parsing and bounding box extraction."` No model call, no real extraction, and no `AgentDecision` is created despite this being exactly the kind of AI-produced field data Section 3 rule 4 requires evidence for.
- `apps/tms/src/app/api/documents/upload/route.ts:19-35` — if `db.shipmentDocument.create` throws, the `.catch()` fabricates a fake success object (`id: doc_${Date.now()}`, `status: "PARSED"`) and the route still returns `ok: true` with `"Document uploaded and parsed successfully by AI Agent"` — a real failure is silently converted into a fabricated success.
- **Fix:** implement `tenders/route.ts` against real `db.tender` records; make `ingestErpPurchaseOrder` actually persist a `TransportationOrder`/`Shipment` or remove the fake success response; replace the hardcoded OCR fields with a real document-processing call (reuse `apps/custom/src/modules/documents/processing/*` per spec Phase 6) or, if extraction genuinely isn't wired yet, return `NEEDS_REVIEW`/null fields rather than fabricated ones; remove the upload route's fallback-to-fake-success catch block and return a real 500 on DB failure.

### P0-5. The "AI understands email" pipeline never calls a model, and silently defaults to auto-approved
- `apps/tms/src/modules/orders/services/intakeParserService.ts:39` — `const confidence = input.confidence ?? 85;` — if the caller supplies no confidence at all, the order is scored 85% (above the 80% `autoThreshold` at line 40-41) and marked `UNDERSTOOD`/auto-approved. Line 81: `evidenceItems: (input.evidenceItems ?? []) as any` — silently accepts an empty evidence list on an `AgentDecision` that's marked `autoApproved: true` (line 77) when confidence clears threshold. This is the literal counter-example from Section 3 rule 1/4: a record with no real evidence trail, auto-approved by a hardcoded fallback constant.
- `apps/tms/src/app/api/transportation-orders/parse/route.ts:21-35` and `apps/tms/src/modules/orders/tools/parseFreightEmailTool.ts` both take `confidence`/`evidenceItems` purely **as caller-supplied input parameters** — neither file contains any LLM/model call. Nothing upstream calls a model either: the chat orchestrator (`apps/tms/src/modules/assistant/orchestrator.ts:13-112`) is pure keyword matching (`msg.includes("sweep risk")`, `msg.includes("carrier")`, etc.) with canned markdown strings — **zero LLM calls anywhere in `apps/tms`** (confirmed by reading the full orchestrator and every tool `execute` body reachable from it).
- `apps/tms/src/app/api/assistant/chat/route.ts:13` calls `runAssistantTurn("Enterprise Freight", {...})` without passing `ctx` at all, so `orchestrator.ts:21` falls back to `{ accountId: "acc_tms_01" }` for every single chat request regardless of which user/account is actually signed in (compounds P0-2's missing auth on this route).
- **Fix:** either wire a real model call that produces `confidence`/`evidenceItems` from actual source-text spans (per spec Phase 1), or, until that exists, make the "no confidence supplied" path default to `confidence: 0` / `status: NEEDS_REVIEW` rather than `85`. Pass the resolved `ctx` through the whole chat call chain instead of a hardcoded account id.

### P0-6. The only spec-compliant AI tools are dead code; the fabricated/stubbed paths are what's actually live
`apps/tms/src/modules/orders/tools/parseFreightEmailTool.ts`, `apps/tms/src/modules/movement/tools/planMovementStopsTool.ts`, and `apps/tms/src/modules/rating/tools/recommendCarrierTool.ts` are the three tools that actually follow the real `AssistantTool` pattern correctly (Zod schema, real evidence, `createAuditLog`). Grepped repo-wide: **each is imported and referenced only inside its own defining file** — none of them is registered in `apps/tms/src/modules/assistant/tools.ts`'s `availableAssistantTools` map (which only has `list_shipments`, `list_carriers`, `list_exceptions`, `run_risk_sweep`, `run_freight_audit`), none is called from the orchestrator, and none is called from any API route. They are unreachable. Meanwhile the actual live paths for "AI understands email" (`intakeParserService.ts`) and "AI processes documents" (`documents/[id]/parse/route.ts`) are the stubbed/fabricated ones documented in P0-4/P0-5.
- **Fix:** either wire `parseFreightEmailTool`/`planMovementStopsTool`/`recommendCarrierTool` into the orchestrator's tool registry and have the intake/parse routes call them, or delete `intakeParserService.ts`'s duplicate path and route everything through the tools that already do this correctly.

### P0-7. Two unauthenticated webhooks with no signature verification
Spec explicitly requires reusing the Resend inbound webhook's signature-verification pattern for any new webhook receiver (Section 1, Phase 1, Phase 5).
- `apps/tms/src/app/api/customs/webhook/route.ts` — no signature check, no shared secret, no auth of any kind. Anyone who knows/guesses a `shipmentId` can POST `{ filingStatus: "RELEASED" }` and the handler will resolve `CUSTOMS_HOLD`/`LFD_AT_RISK` exceptions (lines 38-67) and unlock drayage dispatch (line 117-120) — a real compliance/financial exception gets auto-resolved by an unauthenticated third party.
- `apps/tms/src/app/api/webhooks/tracking/route.ts` — Zod-validates the body and dedups on a unique constraint (good), but has **no signature verification at all**. Anyone can inject fabricated `TrackingEvent`s and `EtaObservation`s for any `shipmentId` in any account (the route trusts `parsed.shipmentId` with no account scoping check either).
- **Fix:** add signature/shared-secret verification to both, matching `apps/custom/src/app/api/webhooks/resend/inbound/route.ts`'s pattern, before processing any payload.

### P0-8. Movement + Carrier data model was reinvented instead of reused
Section 1 states explicitly: *"Movement + Stops — Fully built (schema only, no name change needed) — `TransportLeg`... `ShipmentStop`... No separate 'Movement' model needed."* Section 2 defines exactly one new carrier model, `Carrier`. Despite this, `packages/db/prisma/schema.prisma` now also contains brand-new `Movement` (line 6606), `ShipmentMovement` (6644), `MovementStop` (6662), and `CarrierProfile` (6579, backed by `Party`) models that were never authorized by the spec.
- `apps/tms/src/modules/movement/services/movementService.ts:44,94,119` — `db.movement.create`, `db.shipmentMovement.create`, `db.movement.findFirst` — a second, parallel movement-tracking implementation.
- `apps/tms/src/modules/carriers/services/carrierService.ts:28,54` — `db.party.create`, `db.carrierProfile.create` — a second, parallel carrier implementation.
- Meanwhile the spec-compliant tools use the *correct* models: `planMovementStopsTool.ts` uses `db.transportLeg.create`/`db.shipmentStop.create`; `recommendCarrierTool.ts` uses `db.carrier.findMany`. The codebase now has two competing, mutually-inconsistent implementations of the same domain concept — this is the exact "reinventing logic that already existed instead of reusing it" failure pattern the spec's ground rule (and this task's brief) name as Antigravity's documented history. `movementService.ts`/`carrierService.ts` are currently only exercised by `apps/tms/tests/phase1.test.ts` (not by any route), so the damage is contained to dead code today, but the schema pollution (4 unauthorized models) is real and already committed to the shared `packages/db` schema.
- **Fix:** delete `Movement`/`ShipmentMovement`/`MovementStop`/`CarrierProfile` from `schema.prisma` and `movementService.ts`/`carrierService.ts` entirely; rewrite `apps/tms/tests/phase1.test.ts` against `TransportLeg`/`ShipmentStop`/`Carrier` instead.

### P0-9. Fabricated defaults in forms (the exact previously-fixed bug, reintroduced)
Section 3 rule 2 names this as a live, confirmed, previously-fixed bug (`/app/shipments/new` shipping "ABC Manufacturing India Pvt Ltd"/"Maersk Line" as real defaults). It's back:
- `apps/tms/src/app/orders/page.tsx:66` — `<textarea name="text" defaultValue="Need to move 2x40HC Shanghai to Oakland next week. Delivery Sacramento. PO-882199 attached. Customs clearance required. Please quote." />`. This form POSTs directly to `/api/transportation-orders/parse` (line 59). A user who clicks "Parse Request with AI" without editing the textarea creates a **real `TransportationOrder` row with this fabricated text as if it were a genuine customer email**.
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:320` — `<input defaultValue="Acme Import Logistics LLC" .../>` on the new-shipment form.
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:333` — `<input defaultValue="CNSHA" .../>`.
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:337` — `<input defaultValue="USOAK" .../>`.
- **Fix:** every one of these `defaultValue`s must become empty/placeholder text (`placeholder=` attribute is fine; `defaultValue=` with real-looking data is not), per Section 3 rule 2.

### P0-10. Fabricated fallback data rendered/returned as if real, throughout the app
When the real DB query returns nothing (or in some cases *unconditionally*), these paths return specific, plausible-looking fake records instead of an empty state — indistinguishable from real data to the person reading them:
- `apps/tms/src/app/shipments/ShipmentsWorkbenchClient.tsx:36-43` — 6 fully-fabricated shipments (with realistic importer names, ports, dates, risk scores) shown whenever `initialShipments` is empty.
- `apps/tms/src/app/exceptions/ExceptionsGroupedClient.tsx:56-159` — fabricated exceptions incl. `"Acme Import Logistics LLC"`, `"FDA Prior Notice verification pending at US Port of Oakland..."`.
- `apps/tms/src/app/api/carriers/route.ts:6-7` — GET **always** returns 2 hardcoded carriers, `"Western Freight Logistics"` and `"Swift Freight Lines"`, never queries `db.carrier`.
- `apps/tms/src/app/carriers/page.tsx:73` — `"Maersk Line Logistics"` hardcoded — this is the literal carrier name cited in the spec as the prior confirmed-fixed incident.
- `apps/tms/src/modules/assistant/tools.ts:59,86,116,178-179` — `list_shipments`/`list_carriers` tools return fabricated records (and a fabricated `count: 3`, line 58) when the real DB query is empty, presented to the chat user as genuine query results with no indication they're synthetic.
- **Fix:** remove every hardcoded fallback array; render/return genuine empty states (`"No shipments found"` etc.) when the DB has no rows.

---

## P1 — Missing audit logs, missing permission gates, other real defects

### P1-1. Mutations authenticated but with zero permission check
These call `withAuthenticatedRoute` with **no `permission` option**, so `authorizeRequest`'s permission branch (`packages/auth/src/auth-guards.ts:55-67`) never runs — any authenticated user of any account, any role, can call them:
- `apps/tms/src/app/api/work-items/[id]/resolve/route.ts:15` — approves/rejects `AgentDecision`, resolves `ExceptionItem`.
- `apps/tms/src/app/api/agents/risk/sweep/route.ts:11` — triggers the risk agent, creates `ExceptionItem`s.
- `apps/tms/src/app/api/tenders/auto-dispatch/route.ts:20` — dispatches a real tender to a carrier.
- `apps/tms/src/app/api/quotes/rfq/route.ts:19` — generates a `FreightQuote` with real buy/sell $ amounts.
- `apps/tms/src/app/api/invoices/ingest/route.ts:39` — ingests a `CarrierInvoice` (financial record).
- **Fix:** add explicit `{ permission: "...", write: true }` to each, matching the six permissions added to the catalogue (e.g. `transportation_orders.write`, `tenders.send`, `carrier_invoices.match`).

### P1-2. Missing `createAuditLog` on real mutations
- `apps/tms/src/app/api/work-items/[id]/resolve/route.ts` — no `createAuditLog` call anywhere in the file, despite approving/rejecting decisions and resolving exceptions.
- `apps/tms/src/modules/agents/services/operationalAgents.ts` — `runRiskAgent` (line 225) creates `AgentDecision`/`ExceptionItem` rows; no `createAuditLog` import or call in the whole file.
- `apps/tms/src/modules/rating/services/quoteService.ts` — `evaluateRFQ` (line 83) creates `AgentDecision` + `FreightQuote` with real dollar amounts; zero `createAuditLog` calls anywhere in the file.
- `apps/tms/src/modules/invoices/services/invoiceIngestionService.ts` — `ingestCarrierInvoice`/`batchIngestCarrierInvoices` create `CarrierInvoice` rows (financial data); zero `createAuditLog` calls anywhere in the file.
- **Fix:** add `createAuditLog` calls with an accurate `source` ("AGENT" for agent-initiated, "API" for direct calls) to each, matching the pattern already correctly used in `tenderService.ts`, `parseFreightEmailTool.ts`, `recommendCarrierTool.ts`.

### P1-3. Shipment promotion forks a second creation path instead of reusing the canonical one
Spec Phase 2: *"extend the existing `POST /api/shipments`... don't fork a second shipment-creation code path in apps/tms."*
- `apps/tms/src/app/api/transportation-orders/[id]/promote/route.ts:32-41` — creates the `Shipment` directly with `db.shipment.create`, a minimal field set (`shipmentNumber`, `importerName`, `status`, `transportMode` only), bypassing whatever validation/side effects the canonical `apps/custom` shipment-creation logic has. Uses placeholder-but-honest defaults (`"Pending Importer"`, `"Truck"`) — lower severity than the P0-9 fabrications, but still a second code path per spec's explicit prohibition.
- **Fix:** extract the real shipment-creation logic to a shared package (or call it in-process the way `createShipment` in `apps/custom/src/modules/assistant/tools.ts:335-374` does) rather than reimplementing a stripped-down version here.

### P1-4. Fabricated geographic/port defaults inside a financial code path
- `apps/tms/src/modules/rating/services/quoteService.ts:278-279` — `laneOrigin: order.origin ?? { unlocode: "CNSHA", city: "Shanghai" }`, `laneDestination: order.destination ?? { unlocode: "USOAK", city: "Oakland" }` — when the source order has no origin/destination, the quote is silently created with a specific fabricated lane instead of leaving it null / blocking the quote.
- `apps/tms/src/modules/rating/services/quoteService.ts:359` — same pattern, `?? "USOAK"`.
- **Fix:** if `order.origin`/`order.destination` is missing, fail the RFQ (or flag `NEEDS_REVIEW`) rather than substituting a specific real-looking port.

### P1-5. Hardcoded confidence constant on a blocked-decision path
`apps/tms/src/modules/tenders/services/tenderService.ts:378` — `confidence: 95` is a fixed literal for the `AgentDecision` created when auto-tender is policy-blocked, not derived from any real signal. Lower severity than P0-5 since this decision is explicitly routed to human review either way, but still an unconditional hardcoded confidence value of the kind Section 3 calls out as a red flag.

---

## P2 — Style / pattern deviations

### P2-1. Confusing type name that echoes the dead scaffold it was told to avoid
`packages/assistant/src/assistantTool.ts:10-13` defines its own `CopilotToolAccess` type (`"ALL" | "ADMIN_ONLY" | {permission, write}`). This is **not** an import from `apps/custom/src/modules/assistant/shared/toolTypes.ts` (confirmed: repo-wide grep for `defineTool`/`CopilotTool` call sites returns zero results outside this local type declaration and the pre-existing `apps/custom/src/modules/assistant/tools.ts:113` which imports the *real* `CopilotToolAccess` from the dead-scaffold file for its `access` field type only — that pre-existing usage is unrelated to this build and out of scope). The `AssistantTool` interface shape itself (`declaration`, `schema`, `access`, `execute`) correctly matches the live pattern. The problem is purely the name: a reviewer skimming for "no CopilotTool" will get a false-positive match here.
- **Fix:** rename to `AssistantToolAccess` to remove the ambiguity.

### P2-2. Display-layer fallback fabrication (not persisted, but still shown as real)
- `apps/tms/src/app/orders/page.tsx:125,130,132` — `ord.requestedBy ?? ord.client?.name ?? "Acme Imports"`, `?? "CNSHA"`, `?? "USOAK"`, `ord.confidence ?? 95`.
- `apps/tms/src/app/shipments/page.tsx:26,28-29` — `s.importerName || "Acme Logistics"`, `|| "CNSHA"`, `|| "USOAK"`.
- `apps/tms/src/app/exceptions/page.tsx:29,31-32` — same pattern.
- **Fix:** render an em-dash/"Unknown" for missing fields instead of a specific fabricated value.

### P2-3. Recommend-carrier confidence is a hardcoded binary
`apps/tms/src/modules/rating/tools/recommendCarrierTool.ts:82` — `const confidence = isHighConfidence ? 92 : 45;` — two fixed constants rather than a continuous score derived from the actual quote comparison. Lower severity than P0/P1 items because the evidence array backing this decision (lines 85-89) is genuinely derived from real data — only the confidence number itself is a fixed constant.

---

## What was verified clean

- **Cross-app import boundary (checklist item):** zero imports of `apps/custom/src/*` anywhere in `apps/tms/src`, `packages/auth/src`, `packages/decisions/src`, `packages/assistant/src`. Confirmed by repo-wide grep — the only match was a code comment in `apps/tms/src/proxy.ts:5` referencing the pattern, not an import.
- **`defineTool`/`CopilotTool` avoidance:** zero real call sites in any new file (see P2-1 for the one naming false-positive, which is not an actual violation).
- **Permission catalogue additions:** `transportation_orders.read/write`, `carriers.manage`, `tenders.send`, `carrier_invoices.match/override` in `packages/auth/src/permissions.ts:151-186` are correctly declarative (`name`/`description`/`category`/`defaultRoles`), matching the existing pattern exactly. (`tms.access` is the missing one — see P0-1.)
- **`AuditSource`/`WorkItemKind` extensions:** `packages/decisions/src/audit.ts:4` correctly adds `"EMAIL" | "AGENT"` to the TS union and the header allowlist; `packages/decisions/src/workTypes.ts` correctly adds `"tender" | "carrier_invoice"` to `WorkItemKind`. Both are zero-migration, as specified.
- **Some AgentDecision evidence is genuinely well-built:** `recommendCarrierTool.ts` and `planMovementStopsTool.ts` (P0-6 notwithstanding — they're unreachable) and `quoteService.ts`'s `evaluateRFQ` (P1-4 notwithstanding) construct real `evidenceItems` from actual computed comparisons, not stubs. This is proof the correct pattern was understood — it just isn't what's wired up to the live routes.

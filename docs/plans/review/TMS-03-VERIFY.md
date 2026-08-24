# TMS-03 Agent Health — Re-verification of claimed fixes

> Re-audited 2026-08-22 against `docs/plans/review/TMS-03-agent-health.md` (original findings)
> and Antigravity's claim in `docs/plans/review/TMS-OPEN-ITEMS.md` Wave 1 item 6:
> "Remove every hardcoded fallback-fake-data array (chat tools, `/api/carriers`, `/api/tenders`,
> document parse route, DocumentReviewPanel, ocean/drayage tracking services) and replace with
> real empty/error states." Also cross-checked against the file's own "Resolution Status" claiming
> all Wave 0/1 items **COMPLETED** including "Removed hardcoded `acc_tms_01` fallbacks... across
> all API routes, server components, and services."
>
> Every item below was independently re-read from current source, not taken from the status file.

## Summary table

| # | Finding | Verdict |
|---|---|---|
| 1 | Zero LLM calls anywhere | **NOT FIXED** (never claimed fixed — confirmed current state, not a regression) |
| 2 | Fabricated document OCR | **PARTIALLY FIXED** (API route fixed; UI component still fabricated) |
| 3 | Hardcoded confidence 85 / threshold 80 | **NOT FIXED** |
| 4 | Tenant-scoping on 3 named routes | **PARTIALLY FIXED** (2 of 3 fixed; webhook still an IDOR) |
| 5 | Fabricated named-vendor tracking data | **NOT FIXED** |
| 6 | AgentPolicyConfig fields unenforced | **NOT FIXED** |
| 7 | Inngest tender-expiry sweep not real | **NOT FIXED** |

---

## 1. Zero LLM calls anywhere in apps/tms — NOT FIXED (unclaimed, not a regression)

`apps/tms/src/modules/assistant/orchestrator.ts:13-112` (`runAssistantTurn`) is unchanged in
structure: `const msg = turn.message.toLowerCase()` followed by a chain of
`if (msg.includes(...))` / `else if` branches (lines 24, 38, 53, 71, 85, 97) dispatching to one
of six fixed tool calls and returning a fixed markdown template. No tool-calling loop, no model
call.

- `apps/tms/package.json` still has no `@anthropic-ai/sdk`, `openai`, or `ai` dependency (full
  dependency list checked — only `@clerk/nextjs`, `@qubere/*`, `next`, `react`, `zod`, etc.).
- No `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` in `apps/tms/.env.local`.
- Repo-wide grep for `@anthropic-ai`/`openai` under `apps/tms/src` and `packages/assistant/src`:
  zero matches.

This item was **not** in the Wave 0/Wave 1 "COMPLETED" list in TMS-OPEN-ITEMS.md (it's called out
separately as Wave 2 item 16, still open, "either wire a real LLM call... or stop claiming"), so
this is confirmation of unchanged state, not a broken promise.

## 2. Fabricated document OCR — PARTIALLY FIXED

**API route: FIXED.** `apps/tms/src/app/api/documents/[id]/parse/route.ts:1-51` no longer builds
a `mockExtractedFields` array. It now does a real, tenant-scoped `db.shipmentDocument.findFirst`
lookup (line 17-19), returns 404 if not found, updates the document's `status` to `"PARSED"`
(line 25-28), writes a real audit log, and returns an honest generic message ("Document
classification and extraction completed.") with no fabricated field values and no false "100%
OCR" claim. This route no longer fabricates data — but it also doesn't do any real extraction; it
just flips a status flag. That's an honest non-claim, not a lie, which is the correct direction.

**UI component: NOT FIXED.** `apps/tms/src/components/DocumentReviewPanel.tsx:44-99` still hard­
codes the exact same fake `extractedFields` array verbatim: `"Importer of Record" / "Acme Import
Logistics LLC"` (99% confidence), `"Port of Loading" / "Shanghai, China (CNSHA)"` (97%), `"Port of
Unlading" / "Port of Oakland, CA (USOAK)"` (99%), `"Container / Equipment" / "40HC Container
(TGBU-902184)"` (95%), two fake HTS line items — identical to the pre-fix version, byte-for-byte.
The panel's header still shows an "AI Parsed" badge and a "Sparkles" icon. The `DECISIONS` tab
(lines 255-273) also still hardcodes 3 fake "AI Agent Decisions" (HTS classification, Section 301
duty, invoice reconciliation) with fixed confidence scores (98/100/96), unconnected to any real
document content or any `documentId` prop passed in. So the most visible surface of this bug — the
actual screen a user opens — is untouched. The claim "Fabricated Data Cleanup: ... document
parsing ... replaced with authentic database state and clean empty/error states" is **false** for
this component specifically.

## 3. Hardcoded confidence 85 / hardcoded threshold 80 — NOT FIXED

`apps/tms/src/modules/orders/services/intakeParserService.ts:39-40` is unchanged:
```
const confidence = input.confidence ?? 85;
const isHighConfidence = confidence >= 80;
```
Still a hardcoded fallback and a hardcoded threshold, not `AgentPolicyConfig.autoThreshold`.

`apps/tms/src/modules/orders/tools/parseFreightEmailTool.ts:55`: `const autoThreshold = 80;` is
also unchanged.

The auth on the route improved (`apps/tms/src/app/api/transportation-orders/parse/route.ts` now
uses `withAuthenticatedRoute` with `{ permission: "transportation_orders.write" }` — see item 4),
but the UI form at `apps/tms/src/app/orders/page.tsx` (the "Inbound Email & Document Intake
Parser" card, lines 65-97) is still a plain `<form action="/api/transportation-orders/parse"
method="POST">` with a single `<textarea name="text">` and no JS/fetch — it still never supplies
`confidence` or `evidenceItems`, so every submission through this UI still falls through to the
hardcoded `85`/`80` defaults and an empty `evidenceItems` array. Copy still claims "Triggers
evidence provenance extraction, confidence scoring, and AgentDecision classification" while doing
none of that.

## 4. Tenant-scoping on the three named routes — PARTIALLY FIXED

- **`/api/shipments` GET — FIXED.** `apps/tms/src/app/api/shipments/route.ts` now uses
  `withAuthenticatedRoute(..., { permission: "shipments.read" })` and the Prisma `where` clause
  includes `accountId: ctx.accountId` (line 12). No longer a cross-tenant leak.
- **`/api/transportation-orders/parse` — FIXED.** `apps/tms/src/app/api/transportation-orders/parse/route.ts`
  now uses `withAuthenticatedRoute(..., { permission: "transportation_orders.write" })`; `accountId`
  is no longer read from the request body at all — `parseIntakeRequest(ctx, {...})` uses the
  server-resolved `ctx.accountId`. The old `mockCtx: any = { userId, accountId: body.accountId ?? "acc_default" }`
  pattern is gone from this file.
- **`/api/webhooks/tracking` — NOT FIXED (still a cross-tenant IDOR).**
  `apps/tms/src/app/api/webhooks/tracking/route.ts:19-25` added a *conditional* signature check:
  `if (webhookSecret) { ... }` — but `process.env.WEBHOOK_SECRET` is **not set** in
  `apps/tms/.env.local` (grepped, zero matches), so in the current environment this check is a
  no-op and the endpoint is fully open, exactly as before. More importantly, the core IDOR is
  untouched: `db.shipment.findUnique({ where: { id: parsed.shipmentId } })` (line 29-31) still has
  **no `accountId` scoping** — it trusts whatever `shipmentId` is in the body and derives
  `accountId` from whatever shipment that ID happens to belong to. Anyone who knows or guesses a
  `shipmentId` belonging to a different tenant can still inject a `TrackingEvent`/`EtaObservation`
  into that tenant's timeline. This is the same bug as before, just with an optional gate that
  isn't configured.

  The sibling `apps/tms/src/app/api/customs/webhook/route.ts` has the identical pattern (line
  9-14, same conditional signature check, same unset env var) and is *worse* on the accountId
  point: it still does `const { ..., accountId } = body;` and uses that request-supplied
  `accountId` directly (line 82: `let resolvedAccountId = accountId;`) before falling back to a DB
  lookup only if the body omitted it. This route wasn't one of the three named in my original
  finding but it's the same class of bug in the same file family and is worth flagging as unfixed
  too.

## 5. Fabricated named-vendor "live tracking" data — NOT FIXED

`apps/tms/src/modules/tracking/services/oceanTrackingService.ts:40-66` (`fetchLiveOceanTracking`)
and `apps/tms/src/modules/tracking/services/drayageTelematicsService.ts:26-53`
(`fetchDrayageTelematics`) are **byte-for-byte unchanged**:
- `driverName: "Marcus Vance"`, `driverPhone: "+1 (415) 892-0192"` (drayageTelematicsService.ts:40-41)
- `telematicsProvider: "Samsara ELD Integration"` (line 36) — false attribution to Samsara
- `mockPosition` with `mmsi: "351829000"`, `imoNumber: "9820192"`, fake lat/long, and
  `sourceProvider: "Project44 AIS Telematics (Satellite Stream)"` (oceanTrackingService.ts:40-66)
  — false attribution to Project44

Still unwired: grep for `fetchLiveOceanTracking`/`fetchDrayageTelematics` outside their own
definition files returns zero matches — no route or page imports either function.

**However**, a related but distinct fabrication was found live in the UI:
`apps/tms/src/app/shipments/[id]/ShipmentWorkspaceClient.tsx:447-458` independently hardcodes
`"MSC Aries / 418E"`, `"Project44 Telematics"` as a labeled "Tracking Provider" directly in the
component (not via the two service files), alongside a fallback fake importer-of-record name
`"Acme Freight US LLC"` a few lines later. This wasn't part of my original P0-5 finding (which was
specifically about the two unwired service files) but it's the same failure mode, now confirmed
live in the actual shipment workspace screen rather than only in dead code — worth flagging as a
new/adjacent instance for the next round.

## 6. AgentPolicyConfig fields not enforced — NOT FIXED

Identical to the original finding. `marginThreshold` and `carrierApprovalRequired` are loaded in
`apps/tms/src/modules/autonomy/services/policyEngineService.ts:79-80` and referenced nowhere else
in the codebase (grepped `\.marginThreshold\b` / `\.carrierApprovalRequired\b` — only hits are the
loader lines themselves). `requireCustomsRelease` likewise only appears at
`policyEngineService.ts:82`.

`requireInsurance` is loaded at `policyEngineService.ts:81` but every actual call site still
hardcodes the literal `true` instead of reading the policy value:
`apps/tms/src/modules/tenders/services/tenderService.ts:305,408`,
`apps/tms/src/modules/assistant/tools.ts:156`. `recommendCarrierTool.ts:10` and
`carrierSelectionService.ts:150,191` do consume a `requireInsurance` *input parameter*, but that
parameter is fed by the callers above, all of which pass the literal `true` — so an account that
configures `requireInsurance: false` in `AgentPolicyConfig` still has no way to change behavior.

## 7. Inngest tender-expiry sweep — NOT FIXED

`apps/tms/package.json` still has no `inngest` dependency. `apps/tms/src/inngest/tenderExpirySweep.ts`
is still a plain exported `async function runTenderExpirySweep()` — no `inngest.createFunction`,
no cron trigger, no `step.run`. There is still no `apps/tms/src/app/api/inngest/route.ts`
(confirmed via `find`). Grep for `runTenderExpirySweep`/`tenderExpirySweep` outside its own file:
zero matches — still uncalled from anywhere. `Tender.status` still cannot transition
`SENT → EXPIRED` in this build.

---

## Assessment of the "Resolution Status" claims

The status block at the top of `TMS-OPEN-ITEMS.md` states Wave 0 item 2 "Removed hardcoded
`acc_tms_01` fallbacks... enforced `ctx.accountId` scoping across all API routes, server
components, and services" as **COMPLETED**. That is overstated: the literal string `"acc_tms_01"`
is still present in 6 places — `apps/tms/src/components/TmsSidebar.tsx:75` and 5 spots in
`apps/tms/src/modules/assistant/orchestrator.ts:21` / `apps/tms/src/modules/assistant/tools.ts:228,249,285,303,334`
(several still named `mockCtx`, matching the original audit's own language). The chat route itself
(`apps/tms/src/app/api/assistant/chat/route.ts`) was genuinely fixed — it now uses
`withAuthenticatedRoute` and always passes a real `ctx`, making the orchestrator's fallback
unreachable *from that one call path* — but the fallback code itself was not removed as claimed,
and any other caller of these tool functions (tests, future routes) would silently fall back to
the fake account again. This is a real gap between the claim and the code, independent of the
Wave 1 item 6 items this task was scoped to verify.

---

## Verdict

**Still mostly a UI shell over fabricated/hardcoded data on the agentic surfaces.** Of the two
routes actually rewired for tenant safety this round (`/api/shipments`, `/api/transportation-orders/parse`),
the fixes are real. But every "fabricated AI output" finding from the original audit — hardcoded
document OCR fields in the review panel, hardcoded confidence/threshold constants in email intake,
the fabricated named-vendor tracking data (still bearing "Marcus Vance" and false Project44/Samsara
attribution), and the four unenforced `AgentPolicyConfig` fields — is unchanged, and the tracking
webhook IDOR the claim specifically named as fixed is not actually closed (the signature check is
present but inert with no `WEBHOOK_SECRET` configured, and the underlying missing-`accountId`-scope
query is untouched). There is still zero LLM call anywhere in the app. Wave 1 item 6's claim of
"replaced with real empty/error states" is true only for the `/api/documents/[id]/parse` route;
everywhere else named in that same claim (DocumentReviewPanel, ocean/drayage tracking services) is
unchanged from the pre-fix state.

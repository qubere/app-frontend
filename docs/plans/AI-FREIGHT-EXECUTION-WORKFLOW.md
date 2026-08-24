# AI Freight Execution Workflow — Build Spec
> Created: 2026-08-21. Status: design spec, not yet built. Written for Antigravity to implement phase-by-phase; Claude Code validates each phase's output against this doc before the next phase starts.

**Target workflow (the thing this doc builds):**

1. Email received → 2. AI understands shipment request → 3. TransportationOrder created → 4. Shipment created → 5. AI plans Movement + Stops → 6. Rates retrieved → 7. AI recommends carrier → 8. Tender sent → 9. Carrier accepts → 10. Shipment tracked → 11. ETA monitored → 12. Exception detected → 13. AI resolves OR requests approval → 14. Delivery occurs → 15. POD ingested → 16. Invoice matched.

**Ground rule for whoever implements this: do not build any of this from scratch.** Every phase below names the exact existing file/model/pattern to extend. Section 1 is a verified reuse inventory — treat it as authoritative over any assumption about what "a TMS normally needs." Section 3 is a set of hard build-discipline rules that exist because this exact codebase has a documented history of AI tooling (including Antigravity, on a prior task in this repo) fabricating fields, inventing plausible-looking data, and reinventing logic that already existed. Do not repeat that here.

---

## 0. Architecture decision: one Postgres, one schema, two apps

This repo already contains the answer to "do we need a separate database for this," proven in code, not just discussed:

- `packages/db/prisma/schema.prisma:1-8` — single `datasource db { provider = "postgresql" }`, no `@@schema(...)` multi-schema usage anywhere in 6,432 lines. One Postgres database, one (`public`) schema. This is not going to change for this feature.
- `packages/db/src/index.ts:86-277` — tenant isolation (`accountId`) and data-mode isolation (`PRODUCTION`/`DEMO`/`SANDBOX`) are enforced by a Prisma query-extension middleware, computed once from the Prisma DMMF, not hand-maintained per model. **Any new model in this spec gets this for free as long as it has a required `accountId String` field and an `account Account @relation(...)` — no bespoke isolation code, ever.**
- `apps/tms/` already exists as a second Next.js app (commits `56d751a` "Scaffold apps/tms as minimal infra skeleton", `b201bff` "wire up apps/tms" in typecheck) with its own Clerk instance, and its one real page (`apps/tms/src/app/page.tsx`) does `import { db } from "@qubere/db"; await db.account.count()` specifically to prove — in a comment — "shared Clerk auth and shared Prisma DB connection, proven end-to-end." This skeleton is the reason this feature can live in a second app without a second database.

**The resolution to "connected data vs. independent scaling":** these are not actually the same axis, and conflating them is what makes this feel like a database-splitting decision when it isn't one.

- **Connected data** is a *schema* concern: can a query join `TransportationOrder → Shipment → AgentDecision → ExceptionItem → CarrierInvoice → AuditLog` without crossing a network boundary or reconciling two sources of truth. Answer: yes, because everything stays in one Postgres database behind one `@qubere/db` Prisma client, imported by both apps.
- **Independent scaling** is a *deployment/runtime* concern: can freight-tracking webhook ingestion (bursty, latency-sensitive, potentially high-volume once real carrier integrations exist) scale, deploy, and fail independently of the customs-compliance app's traffic (steadier, human-paced, already carrying HTS/ABI-certification-critical logic that should not be redeployed just to ship a tracking-webhook fix). Answer: yes, because `apps/tms` and `apps/custom` are separate Vercel deployments, separate serverless function pools, separate build/release cycles — while both importing the same `@qubere/db` package.

So: **`apps/tms` hosts this feature's UI and API routes. `apps/custom` is untouched except where explicitly noted (Actions page extension in Phase 7, and the assistant-tool interface extraction in Phase 0).** Both apps read/write the same Postgres tables. Scaling is solved by which Vercel deployment answers a request, not by which database it queries.

**What this decision costs, and why it's still worth it (user confirmed, 2026-08-21):** none of the engine logic this feature needs — `withAuthenticatedRoute`, the permission catalog, `createAuditLog`, `decisionState.ts`/`exceptionState.ts`, the `AssistantTool` interface — currently lives in a shared package. It's app-local to `apps/custom/src/`. Phase 0 extracts the pieces this feature needs into two **already-scaffolded, currently-empty** packages (`packages/auth`, and a new `packages/decisions`), so `apps/tms` doesn't duplicate them and `apps/custom` doesn't reach across into another app's `src/` (which Turborepo's workspace boundaries don't support cleanly anyway).

**Identity model (user-confirmed, 2026-08-21): one Clerk instance, not one Clerk instance per app.** A user is a Qubere customer, full stop — not a "`apps/custom` user" or an "`apps/tms` user." Which app(s) they can open is a **permission**, resolved through the same `AccountMembership`/role system every other permission in this codebase already goes through — not a second identity provider, not a separate sign-up flow. Concretely:

- Both apps' `next.config.ts` already rewrite `/__clerk/:path*` → `https://clerk.qubere.ai/:path*` — identical in `apps/custom/next.config.ts` and `apps/tms/next.config.ts`. That's the Clerk custom-Frontend-API-domain proxy pattern, and it's already mirrored correctly in the `apps/tms` skeleton.
- What makes them the *same* Clerk instance (same user pool, shared session) is that both apps' `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` env vars must be the exact same key pair (same Clerk Application) — these are the only two Clerk env vars used anywhere in this codebase (verified by repo-wide grep). **This is a Vercel project-settings change, not a code change** — copy `apps/custom`'s values into `apps/tms`'s Vercel project env vars. A key mismatch here (or a missing key entirely) is the leading suspect for the `demo-tms.qubere.ai` 500 error seen during this build's kickoff.
- **App access is a permission, enforced in code, not a Clerk-side concept.** Add `tms.access` to the permission catalog (`packages/auth` post-extraction) with a `defaultRoles` entry — most likely opt-in per account/role rather than granted to every existing role by default, since most current Qubere customers are customs-brokerage users who have no reason to see a freight-ops app. Enforce it in `apps/tms` the same two-layer way every other gate in this codebase works: `clerkMiddleware` in `apps/tms/src/proxy.ts` still only handles authentication (is there a session at all); the actual `tms.access` check happens server-side once account/role context is resolved (mirrors how `apps/custom` never permission-gates in middleware either — `auth-guards.ts`'s route wrapper and `canAccessHref`'s nav-gating do it downstream, not in `proxy.ts`). A user with a valid Qubere session but no `tms.access` should get a clear "you don't have access to this app" page, not a raw 403/500.

---

## 1. Reuse inventory (verified against current source — cite these, don't re-derive)

| Capability | Status | Where | Reuse instruction |
|---|---|---|---|
| Shared Postgres, tenant/data-mode isolation | **Fully built** | `packages/db/src/index.ts:86-277` | New models just need required `accountId`; middleware does the rest. |
| Inbound email intake | **Fully built** | `apps/custom/src/app/api/webhooks/resend/inbound/route.ts:29-113`, `InboundEmail`/`InboundAttachment` models (`schema.prisma:944,972`) | Signature-verified (Svix/Resend), idempotent dedup on `(provider, providerEventId)`, `after()`-triggered async processing, daily cron backstop. Reuse the receiver pattern; do not write a second webhook verifier. |
| Document processing pipeline | **Fully built** | `apps/custom/src/modules/documents/processing/*`, `apps/custom/src/lib/queue/pgQueue.ts:42-253` | `PgQueue` (`FOR UPDATE SKIP LOCKED`, 5-min dead-letter retry) is the durable-job mechanism for document/email-shaped work. Reuse for POD ingestion (Phase 6), not a new queue. |
| Scheduled/event-driven jobs | **Fully built, separate from PgQueue** | `apps/custom/src/lib/inngest/client.ts`, `apps/custom/src/app/api/inngest/route.ts:1-18` | 5 real functions already registered (OFAC/HTS ingest, daily audits, account-memory extraction). Inngest's own cron trigger is independent of `vercel.json`'s cron-slot limits. Reuse for tender-expiry sweeps and ETA-staleness checks (Phase 4/5), not PgQueue — those are time-driven, not document-driven. |
| AI decision framework | **Fully built, generic-shaped** | `AgentDecision`/`AgentPolicyConfig` (`schema.prisma:1086,1159`), `apps/custom/src/modules/decisions/decisionState.ts:21-84` | `evidenceItems` (Json), `rulesApplied` (String[]), `confidence` (Int), per-account/per-agent `autoThreshold`/`confirmThreshold`/`requireHumanApproval`. This is the exact mechanism for step 7 (carrier recommendation) and step 13 (AI resolves-or-escalates). Do not invent a parallel confidence/approval concept. |
| Exception state machine | **Fully built** | `apps/custom/src/modules/exceptions/exceptionState.ts:9-56` | States: Open → InProgress → WaitingForImporter/WaitingForDocument → ReadyForReview → Resolved/Waived/Cancelled. `RISK_ACCEPTANCE_PERMISSION = "exceptions.waive"` — a second, stricter permission check on top of the base `exceptions.resolve`, enforced in-handler (`apps/custom/src/app/api/exceptions/[id]/route.ts:37-43`). This exact two-tier pattern is what step 13's "AI resolves OR requests approval" should copy for freight exceptions. |
| Actions/work-queue UI pattern | **Fully built** | `apps/custom/src/modules/work/workQueue.ts:11,492,496`, `apps/custom/src/app/app/actions/ActionsClient.tsx` | `WorkItemKind = "decision" \| "finding" \| "filing" \| "document" \| "exception"`. Decisions and exceptions are kept as **distinct verbs** (Approve/Reject vs. Waive/Resolve) — this was a deliberate compliance decision (see `project_actions_page_merge` memory), not UI inconsistency. Any new freight work-item kind (tender-response-needed, invoice-mismatch) must add its own kind, not collapse into an existing verb. |
| Audit trail | **Fully built** | `apps/custom/src/lib/audit.ts:7,54-115` | `AuditSource = "UI" \| "CHAT" \| "SYSTEM" \| "API"` is a **TS union, not a Prisma enum** (`schema.prisma:440` is plain `String`) — adding `"EMAIL"` / `"AGENT"` needs zero migration. Source resolves from an explicit param, else the `x-qubere-source`/`x-audit-source` request header, else `"UI"` (`audit.ts:71-91`). Every mutation in this feature must call `createAuditLog`. |
| Permission gating | **Fully built** | `apps/custom/src/lib/api/auth-guards.ts:119-159`, `apps/custom/src/lib/permissions.ts:156-177` | `withAuthenticatedRoute(handler, { permission, write })` already supports compound gates (`{any:[...]}`/`{all:[...]}`). New permissions are declarative objects (`name`, `description`, `category`, `defaultRoles`). |
| AI assistant tool framework | **Fully built, but has a dead scaffold to avoid** | `apps/custom/src/modules/assistant/tools.ts:110-115,222-263,335-374` | Live pattern: `AssistantTool { declaration, schema (Zod), access, execute }`, 40 registered tools. `createShipment` (`tools.ts:335-374`) is the exact template for "AI produces a structured record from unstructured input" — it validates via Zod, then **calls the real internal API route in-process** with `x-qubere-source: CHAT`, rather than duplicating the write logic. **Do not build against `CopilotTool`/`defineTool`** in `apps/custom/src/modules/assistant/shared/toolTypes.ts:52-76` — zero call sites repo-wide, dead/aspirational scaffolding. |
| Movement + Stops | **Fully built (schema only, no name change needed)** | `TransportLeg` (`schema.prisma:601`), `ShipmentStop` (`:637`), `ShipmentEquipment` (`:670`) | No separate "Movement" model needed — `TransportLeg` already has `sequence`, `mode`, `carrierCode`/`carrierName`, planned/estimated/actual departure+arrival, `status`. `ShipmentStop` already has `sequence`, `type`, `unlocode`, lat/long, planned/estimated/actual arrival+departure, optional `transportLegId`. Reuse both as-is. |
| Tracking/ETA schema | **Built, but nothing writes to it — real gap, not reuse** | `TrackingEvent`/`EtaObservation`/`TrackingSubscription` (`schema.prisma:693,741`) | Rich schema (idempotency keys, correction chains, confidence, `isInferred`). Verified via repo-wide grep: **zero** `trackingEvent.create`/`etaObservation.create` call sites exist anywhere. `apps/custom/src/modules/tracking/shipmentTracking.ts` is read-only projection logic. Phase 5 builds the missing write path — this is genuine new work, not reuse, but the schema itself needs no changes. |
| Reconciliation engine | **Fully built and live-wired (a prior memory claiming otherwise is stale — verified against current source)** | `apps/custom/src/lib/reconciliation/reconciliationEngine.ts:112-180` (pure rule+tolerance engine), `apps/custom/src/modules/shipment/reconciliationEngine.ts` (orchestration → `ExceptionItem`), called unconditionally from `pipelineOrchestrator.ts:244-246` | The rule-table + normalization + tolerance-comparison + `ExceptionItem`-generation *pattern* is exactly what Phase 6's carrier-invoice 3-way match should copy. The concrete rule set is customs-document-shaped (invoice vs. packing list), not freight-invoice-shaped — new rules needed, same engine shape. |
| Carrier master data, freight rating, tender/booking | **Does not exist at all — confirmed by repo-wide grep, zero matches** | — | True greenfield. See Section 2. |
| POD | **Does not exist** | `DocumentType` enum (`schema.prisma:28-41`) has no POD value | New enum value + new model, Section 2. |
| Carrier freight invoice / 3-way match | **Does not exist** | Existing `Invoice`/`InvoiceLine` is Qubere's own customer billing, not inbound carrier freight invoices | New models, Section 2. |

---

## 2. New Prisma models (Phase 0)

All new models: **required `accountId String` + `account Account @relation(fields: [accountId], references: [id])`** — this is not optional, it's what makes the tenant-isolation middleware pick the model up automatically (`packages/db/src/index.ts:99-102` computes `modelsWithRequiredAccountId` from the Prisma DMMF at load time — a nullable `accountId` silently opts a model *out* of automatic isolation).

```
model TransportationOrder {
  id                      String   @id @default(cuid())
  accountId               String
  account                 Account  @relation(fields: [accountId], references: [id])
  clientId                String?
  source                  String   // "EMAIL" | "MANUAL" | "API"
  inboundEmailId          String?  // FK -> InboundEmail, when source = EMAIL
  rawRequestText          String?  // verbatim source text the AI parsed from
  requestedBy             String?
  requestedPickupWindow   Json?    // { earliest, latest }
  requestedDeliveryWindow Json?
  originAddress           Json?
  destinationAddress      Json?
  commodityDescription    String?
  weight                  Decimal? @db.Decimal(12,2)
  mode                    String?  // matches Shipment.transportMode vocabulary
  status                  String   // RECEIVED | UNDERSTOOD | NEEDS_REVIEW | SHIPMENT_CREATED | CANCELLED
  agentDecisionId         String?  // FK -> AgentDecision, the parse-confidence record
  shipmentId              String?  // set once promoted to a Shipment (v1: 1:1, see Non-goals)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

model Carrier {
  id            String   @id @default(cuid())
  accountId     String
  account       Account  @relation(fields: [accountId], references: [id])
  legalName     String
  scac          String?
  mcNumber      String?
  dotNumber     String?
  contactEmail  String?
  contactPhone  String?
  insuranceOnFile Boolean @default(false)
  status        String   @default("ACTIVE") // ACTIVE | INACTIVE
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model FreightQuote {
  id                    String   @id @default(cuid())
  accountId             String
  account               Account  @relation(fields: [accountId], references: [id])
  shipmentId            String
  carrierId             String
  amount                Decimal  @db.Decimal(12,2)
  currency              String   @default("USD")
  transitDays           Int?
  validUntil            DateTime?
  source                String   // "MANUAL" | "PROVIDER_API"
  providerName          String?
  agentDecisionId       String?  // FK -> AgentDecision, the recommendation record
  rawProviderResponse   Json?
  createdAt             DateTime @default(now())
}

model Tender {
  id              String   @id @default(cuid())
  accountId       String
  account         Account  @relation(fields: [accountId], references: [id])
  shipmentId      String
  carrierId       String
  freightQuoteId  String?
  status          String   // DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED | CANCELLED
  history         Json     // status-transition log, same shape as ExceptionItem.history
  sentAt          DateTime?
  respondedAt     DateTime?
  expiresAt       DateTime?
  sentByUserId    String?
  agentDecisionId String?  // set if the tender was AI-initiated
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ProofOfDelivery {
  id               String   @id @default(cuid())
  accountId        String
  account          Account  @relation(fields: [accountId], references: [id])
  shipmentId       String
  documentId       String   // FK -> ShipmentDocument
  deliveredAt      DateTime?
  receivedByName   String?
  exceptionNoted   Boolean  @default(false)
  notes            String?
  createdAt        DateTime @default(now())
}

model CarrierInvoice {
  id             String   @id @default(cuid())
  accountId      String
  account        Account  @relation(fields: [accountId], references: [id])
  shipmentId     String
  carrierId      String
  documentId     String?  // FK -> ShipmentDocument, source doc if ingested
  invoiceNumber  String?
  invoiceDate    DateTime?
  totalAmount    Decimal  @db.Decimal(12,2)
  currency       String   @default("USD")
  matchStatus    String   @default("PENDING") // PENDING | MATCHED | DISPUTED | EXCEPTION
  createdAt      DateTime @default(now())
  lines          CarrierInvoiceLine[]
}

model CarrierInvoiceLine {
  id               String   @id @default(cuid())
  carrierInvoiceId String
  carrierInvoice   CarrierInvoice @relation(fields: [carrierInvoiceId], references: [id])
  chargeType       String   // LINEHAUL | FUEL_SURCHARGE | ACCESSORIAL | DETENTION | OTHER
  amount           Decimal  @db.Decimal(12,2)
  description      String?
}
```

**Extend, don't fork:**
- `DocumentType` enum (`schema.prisma:28-41`): add `PROOF_OF_DELIVERY`, `CARRIER_INVOICE`.
- `AuditSource` TS union (`apps/custom/src/lib/audit.ts:7`, and now also wherever it's re-exported into `packages/decisions` per Phase 0): add `"EMAIL"`, `"AGENT"`. Also add `"EMAIL"`/`"AGENT"` to the header allowlist at `audit.ts:72`.
- `WorkItemKind` union (`workQueue.ts:11`): add `"tender"`, `"carrier_invoice"`.
- `IntegrationCategory` enum (`schema.prisma:6072-6076`, currently `ERP | ACCOUNTING | SHIPMENT_TRACKING`): add `CARRIER_RATING` — config-stub only in this build (see Non-goals), for a future real rate-shopping/EDI integration to plug into without another migration.
- Permission catalog (`apps/custom/src/lib/permissions.ts`): add `transportation_orders.read`, `transportation_orders.write`, `carriers.manage`, `tenders.send`, `carrier_invoices.match`, `carrier_invoices.override` (this last one is the risk-acceptance tier, mirroring `exceptions.waive` — overriding a flagged invoice mismatch is a financial risk acceptance, gate it the same way).

**Delivery (step 14) gets no new model.** It's `ShipmentStop.actualArrival` set on the stop where `type` indicates final delivery. Do not build a separate `DeliveryEvent` model — that would just be a second source of truth for a fact `ShipmentStop` already owns.

---

## 3. Build discipline (non-negotiable, applies to every phase)

This section exists because of two documented, repo-specific failure patterns — one from a different AI tool on a different task in this same repo, one from this app's own shipped code:

1. **No fabricated fields.** On the ABI-certification build in this same repo, Antigravity was caught inventing a whole field (`documentIdentifierCode`) that was actually two filler gaps, and later fabricated 5 of 21 records in a Drawback chapter re-pass — both caught by requiring real extracted source evidence, not self-consistency. The equivalent risk here: when the AI-understands-email tool (Phase 1) or the carrier-recommendation tool (Phase 3) can't determine a field with confidence, it must leave it null and lower `confidence`/flag `NEEDS_REVIEW` — never invent a plausible value.
2. **No fabricated defaults in forms.** `/app/shipments/new` previously shipped literal fake data ("ABC Manufacturing India Pvt Ltd", "Maersk Line", a pre-filled ETA) as real field values, not placeholders — a live, confirmed bug, since fixed. Any new form or AI-prefilled field in this build must default to empty/null, never a plausible-looking sample value.
3. **Every mutation goes through the existing wrappers.** `withAuthenticatedRoute` for auth+permission+tenant-scoping, `createAuditLog` for the audit trail. No handler should manually re-derive `accountId` from a session or hand-roll a permission check.
4. **Every AI-produced record carries evidence.** `evidenceItems`/`confidence`/`rulesApplied` on `AgentDecision` are not optional decoration — per `project_positioning` memory, this is the product's stated competitive claim ("Qubere proves every line item"). A carrier recommendation or an auto-resolved exception with no evidence trail is a regression against the product's core positioning, not just a missing nice-to-have.
5. **Build against `AssistantTool` (`tools.ts:110-115`), never `CopilotTool`/`defineTool`.** The latter has zero call sites and is dead scaffolding that looks more "correct" than the live pattern — this is an easy trap for a fresh read of the codebase to fall into.
6. **Tests need real fixtures, not tautological stubs.** Also from the ABI build: two Antigravity-authored test files were rejected outright for being `const x = 'SU'; expect(x).toBe('SU')` — zero real behavior under test. Every test in this build must assert against realistic input→output, not a value trivially equal to itself.
7. **No second database, no second schema, no direct cross-app `src/` imports.** Section 0 is decided. If a phase seems to need one of these, stop and flag it rather than building it — it means an assumption in this doc is wrong, not that the workaround is fine.

---

## Phase 0 — Shared package extraction + schema migration

**Goal:** make `apps/tms` capable of everything `apps/custom` can already do (auth, permissions, audit, decisions, exceptions), without duplicating logic, before any freight-specific code is written.

1. **`packages/auth`** (currently empty scaffold): move `apps/custom/src/lib/api/auth-guards.ts` and `apps/custom/src/lib/permissions.ts` here in full. Update `apps/custom` to import from `@qubere/auth` instead of its local path. Add the new `tms.access` permission to the catalog (see Section 0's identity model). **Deploy-config prerequisite, not a code task, but blocking:** `apps/tms`'s Vercel project must have `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` set to the exact same values as `apps/custom`'s — verify this directly (Vercel dashboard, both projects' env vars, byte-for-byte match), don't assume it from the matching `next.config.ts` rewrites alone. A mismatch here is silent: the app still builds and serves pages, it just resolves against a different (likely empty) user pool, or throws if the keys are simply unset.
2. **App-access gate**: in `apps/tms`, add a server-side check (in the root layout or a shared server component every page passes through) that resolves the authenticated user's `AccountMembership` and checks `tms.access` via `@qubere/auth`'s permission-check function — the same function `apps/custom`'s route wrapper already uses, not a reimplementation. No `tms.access` → render a clear "you don't have access to this app" page, not a 500 or an unstyled 403. `apps/tms/src/proxy.ts`'s `clerkMiddleware` stays authentication-only, matching `apps/custom/src/proxy.ts`'s existing pattern of never permission-gating at the middleware layer.
3. **New `packages/decisions`**: move `apps/custom/src/lib/audit.ts`, `apps/custom/src/modules/decisions/decisionState.ts`, `apps/custom/src/modules/exceptions/exceptionState.ts`, and the `WorkItemKind`/actionable-status logic from `apps/custom/src/modules/work/workQueue.ts` here. `apps/custom` re-imports from `@qubere/decisions`.
4. **New `packages/assistant`**: extract just the `AssistantTool` interface and the dispatch/orchestrator shell (not the 40 concrete customs tools, which stay in `apps/custom`) so `apps/tms` can register its own freight tools against the identical interface and pattern documented in Section 1.
5. **Prisma migration**: add all Section 2 models + enum extensions to `packages/db/prisma/schema.prisma`, run `db:generate`/`db:push` per the existing turbo tasks. One migration, additive only — no changes to existing models' shape.
6. **Verify tenant-scoping picked up the new models**: re-run whatever test backs `getTenantScopedModelNames()` (`packages/db/src/index.ts:86-88`) — referenced by `tenant-context-adoption.test.ts` — confirm every new model in Section 2 appears in that computed set.

**Acceptance for Phase 0:** a user who already exists in Clerk/`AccountMembership` from signing into `apps/custom` can sign into `apps/tms` with the same credentials and get the same session, with zero separate sign-up — that's the "one Qubere customer" identity model. A user without `tms.access` sees the access-denied page, not a 500. `apps/tms` can call a trivial authenticated route that checks a permission and writes an audit log entry, using only `@qubere/auth` and `@qubere/decisions` — no import from `apps/custom/src/*`. `apps/custom`'s existing test suite still passes unchanged (this is a pure extraction, not a rewrite — behavior must be identical).

---

## Phase 1 — Email → AI understanding → TransportationOrder (steps 1-3)

- **Intake**: reuse the Resend inbound-email webhook pattern (`apps/custom/src/app/api/webhooks/resend/inbound/route.ts`) as the template for a new receiver in `apps/tms`, either on a distinct recipient alias (e.g. `freight@inbound.qubere.ai`) routed via the existing `InboundSenderRoute`/`RESEND_ALLOWED_INBOUND_RECIPIENTS` mechanism, or by extending the existing route's routing logic to dispatch freight-shaped emails differently from document-shaped ones. Reuse the same signature verification and `(provider, providerEventId)` dedup — do not write a second webhook verifier.
- **AI understanding**: new `AssistantTool`-pattern tool (in `apps/tms`, built against `@qubere/assistant`'s interface) that takes `InboundEmail` body text, produces a draft `TransportationOrder` via Zod-validated structured extraction. Per Section 3 rule 1: any field it can't confidently extract stays null; the tool creates an `AgentDecision` (via `@qubere/decisions`) with `confidence`, `evidenceItems` pointing at the specific source text spans it used, and `triageState = NEEDS_REVIEW` if confidence is below the account's configured threshold (reuse `AgentPolicyConfig`, don't hardcode a threshold).
- **TransportationOrder creation**: new route, `withAuthenticatedRoute`-wrapped, `createAuditLog(source: "AGENT")` when AI-created or `source: "EMAIL"` for the intake event itself. Low-confidence orders land in the Actions-equivalent queue in `apps/tms` (Phase 7) as `kind: "decision"` for human review before promotion to a Shipment.

**Non-goal, explicit:** fuzzy/AI-assisted matching of an inbound email to an *existing* order (the current `DocumentShipmentCandidate` matcher is deterministic-exact-only by its own code comment, `schema.prisma:993-995`) is out of scope for this phase — every parsed email creates a new `TransportationOrder` in v1, no merge/dedup logic.

---

## Phase 2 — Shipment creation + Movement/Stop planning (steps 4-5)

- **Shipment creation**: extend the existing `POST /api/shipments` (`apps/custom`) to accept promotion from an approved `TransportationOrder` — don't fork a second shipment-creation code path in `apps/tms`; call the existing route the same way `createShipment` (`tools.ts:335-374`) already does, in-process, with the appropriate `x-qubere-source` header. **v1 is 1:1** — one `TransportationOrder` produces exactly one `Shipment`. Split-shipment (one order, multiple shipments) is an explicit non-goal for this build; `TransportationOrder.shipmentId` is a single nullable FK, not a join table, on purpose.
- **Movement + Stop planning**: new `AssistantTool` that proposes `TransportLeg` + `ShipmentStop` rows for the shipment (sequence, mode, planned windows) as an `AgentDecision` with evidence (why this routing/sequence), gated by the same `AgentPolicyConfig` confidence threshold as Phase 1. Reuse `TransportLeg`/`ShipmentStop` exactly as they exist today — no schema changes needed here (confirmed in Section 1).

---

## Phase 3 — Rates + carrier recommendation (steps 6-7)

- **Rate retrieval (v1: manual + adapter interface, not a real integration)**: `FreightQuote` rows are entered manually against a `Carrier` in v1. Define a `RateProvider` interface (mirrors the shape of the existing `IntegrationCategory` config-stub pattern) so a real rate-shopping/EDI provider can be plugged in later without a schema change — but do not build a real provider integration in this phase; that's explicitly deferred (see Non-goals).
- **Carrier recommendation**: `AssistantTool` that compares `FreightQuote` rows for a shipment (rate, transit time, `Carrier.insuranceOnFile`/`status`) and produces an `AgentDecision` recommending one, with `evidenceItems` = the comparison it made. This is the most direct reuse of the existing decision-evidence pattern in the whole build — treat it as the reference implementation for "AI recommends X with proof," matching the product's positioning claim.

**Non-goal, explicit:** real carrier-API/EDI rate integration. `IntegrationCategory.CARRIER_RATING` is added to the enum in Phase 0 as a config-stub target, but no real provider is wired in this build.

---

## Phase 4 — Tender + carrier acceptance (steps 8-9)

- **Tender creation/send**: new route gated by the new `tenders.send` permission, `Tender.status` transitions (DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED/CANCELLED) logged into `Tender.history` the same shape as `ExceptionItem.history`. `createAuditLog` on every transition.
- **Carrier response**: v1 is a simple accept/reject endpoint (no carrier portal in this build — see Non-goals) or manual status update by an ops user; either way it's the same route+permission, not a separate mechanism per response channel.
- **Expiry sweep**: new Inngest scheduled function (mirrors `dailyComplianceAuditJob`'s registration pattern in `apps/custom/src/app/api/inngest/route.ts`) that marks `SENT` tenders past `expiresAt` as `EXPIRED`. This is exactly the kind of time-driven, not document-driven, background work Inngest already handles — do not build this on PgQueue.

**Non-goal, explicit:** a carrier-facing self-serve portal for tender response. Confirm before building — a real carrier portal is a distinct, larger product surface (external users, different auth model) and isn't implied by the 16-step workflow as stated.

---

## Phase 5 — Tracking ingestion, ETA, exception detection, AI resolution (steps 10-13)

This is the largest genuinely-new phase — Section 1 confirmed the schema exists but nothing writes to it.

- **Tracking ingestion**: new webhook receiver, built on the *pattern* proven by the Resend inbound-email receiver (signature verification, idempotent dedup via a provider event id — `TrackingEvent` already has an idempotency key field per Section 1, use it), writing real `TrackingEvent` rows. For providers that poll instead of push, an Inngest scheduled function (not PgQueue — this is time-driven).
- **ETA computation**: on each new `TrackingEvent`, compute and write an `EtaObservation` (`deltaMinutes` vs. the previous estimate, `reasonCode`). Keep this a pure function over the event + prior stops/legs, callable both from the webhook path and a backfill/recompute path.
- **Exception detection**: new rule set (ETA delta exceeds an account-configurable threshold, missed pickup window, no tracking update in N hours) that creates `ExceptionItem` rows exactly as the existing reconciliation engine does (`category`, `type`, `severity`, `sourceAgent`) — reuse `exceptionState.ts`'s state machine as-is, don't invent a parallel exception model for freight.
- **AI resolves OR requests approval**: this is the direct reuse target named in the workflow itself. Copy the exact two-tier permission pattern from `apps/custom/src/app/api/exceptions/[id]/route.ts:37-43` — a base action (e.g., auto-re-ping the carrier, auto-adjust ETA) proceeds under normal exception-handling permission, but anything with cost/schedule impact (reroute, expedite, cancel-and-rebook) requires the stricter risk-acceptance-tier permission, gated the same way `exceptions.waive` gates a customs risk acceptance today. Use `AgentPolicyConfig`'s confidence thresholds to decide which branch an `AgentDecision` takes — don't hardcode "AI always auto-resolves severity=LOW."

---

## Phase 6 — Delivery, POD, invoice matching (steps 14-16)

- **Delivery**: no new model (Section 2) — set `ShipmentStop.actualArrival` on the delivery stop. This is the trigger for POD ingestion, not a separate event to model.
- **POD ingestion**: extend the existing document-processing pipeline (`apps/custom/src/modules/documents/processing/*`, running on `PgQueue`) with the new `DocumentType.PROOF_OF_DELIVERY` value added in Phase 0 — add classification/extraction handling for POD-specific fields (delivered-at, signee name), write a `ProofOfDelivery` row linked to the resulting `ShipmentDocument`. Reuse the pipeline; do not build a second document worker.
- **Invoice matching**: `CarrierInvoice`/`CarrierInvoiceLine` ingested the same way (document upload or email attachment → existing pipeline, new `DocumentType.CARRIER_INVOICE`). Build a new rule set for `apps/custom/src/lib/reconciliation/reconciliationEngine.ts`'s engine (`runReconciliationEngine`) comparing `CarrierInvoice` totals/lines against the accepted `FreightQuote`/`Tender` amount, same normalization+tolerance-comparison shape as the existing customs-document rules. On mismatch, generate an `ExceptionItem` (`category: "BILLING"`) via the same orchestration wrapper (`ReconciliationEngine.reconcileShipment`) already wired into `pipelineOrchestrator.ts:244-246` — extend that wrapper's rule input, don't fork a second reconciliation call site. On clean match, `CarrierInvoice.matchStatus = "MATCHED"` and the `TransportationOrder`/`Shipment` can move to a completed state.

---

## Phase 7 — UI: apps/tms surface + apps/custom Actions-page parity

- **`apps/tms`**: build the primary freight-ops UI here — a work queue for `TransportationOrder`s needing review, shipment/movement views, tender status, exception queue. Reuse the `@qubere/decisions` `WorkItemKind`/actionable-status logic extracted in Phase 0 for the queue-filtering logic, rather than reinventing `ActionsClient.tsx`'s triage categorization from scratch. It's fine — expected, even — for this to be a visually distinct app from `apps/custom`, since it's a distinct Vercel deployment/UI surface by design (Section 0); it should not be fine for it to reimplement decision/exception semantics differently.
- **`apps/custom` Actions page**: add the two new `WorkItemKind`s (`"tender"`, `"carrier_invoice"`) so a customs-side user working the existing Actions page sees freight exceptions/tender-response-needed items alongside their existing decisions/exceptions, if their role has visibility into freight data. Preserve the existing rule: **decisions and exceptions stay distinct verbs** — a tender-response item is neither an "approve" nor a "waive," it needs its own action affordance, not a shoehorned reuse of an existing button.

---

## 4. Validation checklist (what gets checked when Antigravity's output comes back)

For each phase, before accepting it as done:

- [ ] `apps/tms` and `apps/custom` resolve against the same Clerk Application (same publishable/secret key pair) — no second Clerk project, no separate sign-up flow for TMS access.
- [ ] `tms.access` is checked server-side in `apps/tms` (not just "is authenticated") before any freight data renders; a user without it gets a real access-denied page, not a 500 or a blank screen.
- [ ] Every new Prisma model has a required `accountId` and shows up in `getTenantScopedModelNames()`'s computed set.
- [ ] Every new mutation route uses `withAuthenticatedRoute` (from `@qubere/auth` post-Phase-0) and calls `createAuditLog` with an accurate `source`.
- [ ] Every new AI-produced field/record has `confidence` + `evidenceItems`, and low-confidence output is null/`NEEDS_REVIEW`, never a plausible guess (Section 3, rule 1) — spot-check by grep for suspiciously specific default values in new form/tool code (Section 3, rule 2's failure mode).
- [ ] No new code imports from `CopilotTool`/`defineTool` (`apps/custom/src/modules/assistant/shared/toolTypes.ts`) — grep for `defineTool` in any new file, must be zero.
- [ ] `apps/tms` code contains zero direct imports from `apps/custom/src/*` — everything crosses the app boundary through `packages/auth`, `packages/decisions`, `packages/assistant`, or `packages/db` only.
- [ ] New tests assert against realistic fixtures with real input→output pairs — reject any test whose assertion is trivially equal to a hardcoded literal with no real logic exercised (Section 3, rule 6).
- [ ] `apps/custom`'s existing test suite is unchanged/still green after the Phase 0 extraction — a refactor that breaks existing behavior is not an acceptable Phase 0.
- [ ] Decisions and exceptions (and now tenders) remain distinct actions in any UI — no collapsed "do the thing" button standing in for Approve/Reject/Waive/Resolve/Send-Tender.
- [ ] No `apps/web` or second Prisma schema/datasource was introduced anywhere.

## 5. Open items to confirm before/while building (not decided by this doc)

- **`tms.access` default roles**: which existing roles (if any) should get `tms.access` by default vs. require an explicit per-account/per-user grant — this is a product/rollout decision (who are the first freight-ops users?), not something to infer from the permission catalog's existing patterns.
- **Freight email alias/routing**: whether freight-request emails arrive at a new dedicated alias or need to be distinguished from document-intake emails on the existing alias — affects Phase 1's intake design, needs a product decision (what address does a customer actually email?).
- **Carrier response channel** (Phase 4): manual/internal-only for v1 per this doc's non-goal — confirm that's acceptable before a carrier portal is assumed needed later.
- **`FreightQuote`/rate provider**: this doc scopes v1 to manual entry + an adapter interface, explicitly deferring any real carrier-rating API integration — confirm that's the intended v1 scope, since "Rates retrieved" (step 6) could otherwise be read as implying a live integration.

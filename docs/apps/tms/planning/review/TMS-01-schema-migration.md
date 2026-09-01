# TMS-01 — Schema & Migration Audit

Audit of uncommitted changes to `packages/db/prisma/schema.prisma` and the Phase 0 "extend, don't fork" checklist from `docs/plans/AI-FREIGHT-EXECUTION-WORKFLOW.md`, against the actual `apps/tms` code that was built on top of it. Methodology: read the spec fully, diffed the schema (`git diff packages/db/prisma/schema.prisma`), read the referenced models/functions/tests directly, and grepped actual call sites in `apps/tms/src` to see which of two competing schema paths the running code actually uses.

Severity key: **P0** = will corrupt data, silently drop tenant isolation, or make the feature non-functional. **P1** = real defect, won't block a demo but will bite in production. **P2** = inconsistency/cleanup, low risk.

---

## P0-1 (CONFIRMED): No migration exists for any of the 13 new models — the app cannot run

`git diff packages/db/prisma/schema.prisma` adds ~560 lines defining `TransportationOrder`, `Carrier`, `CarrierProfile`, `Movement`, `ShipmentMovement`, `MovementStop`, `TransportationEvent`, `CarrierRate`, `FreightQuote`, `Tender`, `ProofOfDelivery`, `CarrierInvoice`, `CarrierInvoiceLine`, plus new fields on `Shipment`, `AgentDecision`, `AgentPolicyConfig`, `Party`, `Client`.

- `grep -rl "TransportationOrder\|CarrierProfile\|MovementStop" packages/db/prisma/migrations/` → **zero matches**. Re-verified: still true.
- Latest migration on disk is `packages/db/prisma/migrations/20260822100000_add_abi_filer_credential/` (today's date). No migration folder was created after the TMS schema changes landed.
- `git status --porcelain packages/db/prisma/migrations/` is clean — nothing new was even staged there.
- **However**, `prisma generate` (codegen only, not `migrate dev`) *was* run: `node_modules/.prisma/client/schema.prisma` (mtime Aug 21 23:14) already contains `model TransportationOrder { ... }` etc., one minute after `packages/db/prisma/schema.prisma` (mtime Aug 21 23:13) was last written. So the generated Prisma Client/DMMF knows about these models, but the actual Postgres database does not have the tables.

**Consequence:** every one of the ~15 new `apps/tms` service files I checked (`financialLedgerService.ts`, `invoiceIngestionService.ts`, `movementService.ts`, `eventService.ts`, `carrierService.ts`, `quoteService.ts`, `tenderService.ts`, etc.) issues `db.transportationOrder.create(...)`, `db.movement.create(...)`, `db.transportationEvent.create(...)` and so on against tables that do not exist. This is not a schema nit — the entire `apps/tms` app is currently non-functional against a real database.

**What to fix:** run `npx prisma migrate dev --name add_tms_freight_execution_models` (or equivalent turbo `db:migrate` task) from `packages/db`, review the generated SQL for sanity (esp. the FK/index changes below), and commit the migration folder alongside `schema.prisma`.

---

## P0-2 (CONFIRMED): Two live, inconsistently-used carrier data models — split-brain, not just duplicate schema

Spec Section 1 says carrier master data "does not exist at all" and Section 2 defines a single standalone `Carrier` model. Antigravity built that model (`schema.prisma:6720-6733` in the new block, matches `Account.carriers Carrier[]` back-relation) **and separately** built `CarrierProfile` (schema.prisma new block, `partyId String @unique` → `Party`), an entirely different carrier representation hung off the existing `Party`/`PartyRoleType.CARRIER` mechanism. Neither is mentioned as reusing the other; the spec never asked for `CarrierProfile` at all.

This isn't hypothetical — the actual application code is split across both, unwired to each other:

- `db.carrier.` is used in exactly one place: `apps/tms/src/modules/rating/tools/recommendCarrierTool.ts` (Phase 3's carrier recommendation, which the spec explicitly names as reading `Carrier.status`/`Carrier.insuranceOnFile`).
- `db.carrierProfile.` is used in `apps/tms/src/modules/carriers/services/carrierService.ts` and `apps/tms/src/modules/carriers/services/carrierSelectionService.ts` — i.e. the actual carrier CRUD/selection modules write to `CarrierProfile`, not `Carrier`.

Net effect: a carrier created through the carrier-management UI (`carrierService.ts` → `CarrierProfile`) will never show up when `recommendCarrierTool.ts` queries `db.carrier.findMany(...)` for candidates, and vice versa. Two sources of truth for the same real-world entity, silently diverging.

Compounding this: the FK wiring for "which carrier" is itself inconsistent across the new models:
- `CarrierRate.carrierPartyId` → relation to `Party` (uses the `CarrierProfile` side).
- `FreightQuote` has **both** `carrierId String` (bare, no relation — see P0-3) **and** `carrierPartyId` → `Party` relation.
- `Tender.carrierId` and `CarrierInvoice.carrierId` are bare strings with no relation at all (see P0-3), presumably meant to point at the standalone `Carrier` model, but nothing enforces or joins that.

**What to fix:** pick one carrier source of truth (the spec's standalone `Carrier` model is the one actually specified; `CarrierProfile` is Antigravity's unrequested addition) and rewire `carrierService.ts`/`carrierSelectionService.ts` to use it, or explicitly justify keeping `CarrierProfile` and migrate `recommendCarrierTool.ts` + `CarrierRate` to use it consistently instead. Either way, every `carrierId`/`carrierPartyId` field across `FreightQuote`, `Tender`, `CarrierInvoice`, `CarrierRate` needs to point at the same model with a real Prisma relation.

---

## P0-3 (CONFIRMED): `carrierId` fields have no Prisma relation anywhere — dangling FK, zero referential integrity

Grepped the full new schema block for any `Carrier @relation` field: **zero results**. Every `carrierId String` field is a bare, unrelated string:

- `FreightQuote.carrierId` (schema.prisma new block, ~line 6778 in working tree) — no `carrier Carrier @relation(...)`.
- `Tender.carrierId` (~line 6823) — same.
- `CarrierInvoice.carrierId` (~line 6860) — same.

This matches the spec's own `Section 2` model definitions verbatim (the spec's `Tender`/`CarrierInvoice`/`FreightQuote` also only had `carrierId String` with no relation field) — so this is partly inherited from the spec, not purely invented by Antigravity. But Antigravity *did* add proper relations elsewhere in the same models (e.g. `FreightQuote.transportationOrder`, `FreightQuote.agentDecision`), so the inconsistency — relations added for some FKs, not for the one that matters most for data integrity — is a quality gap Antigravity should have caught and closed, not propagated.

**What to fix:** add `carrier Carrier @relation(fields: [carrierId], references: [id])` (or point at whatever model wins in P0-2) to `FreightQuote`, `Tender`, and `CarrierInvoice`. Prisma will not enforce FK integrity on a bare string field — right now a carrier row can be deleted while dozens of quotes/tenders/invoices still reference its dangling id.

---

## P0-4 (CONFIRMED): `Movement`/`MovementStop`/`TransportationEvent` duplicate `TransportLeg`/`ShipmentStop`/`TrackingEvent`, and both code paths are live in different files

Spec Section 1 is explicit and unambiguous: *"Movement + Stops | Fully built (schema only, no name change needed) | `TransportLeg`... `ShipmentStop`... | Reuse both as-is."* Section 2's extend-don't-fork list and Phase 2's text repeat this: "Reuse `TransportLeg`/`ShipmentStop` exactly as they exist today — no schema changes needed here."

Antigravity built brand-new parallel models instead:

| Existing (spec says reuse) | New (Antigravity added, not in spec) |
|---|---|
| `TransportLeg` — `schema.prisma:654-688` (unchanged by diff). Has `sequence`, `mode`, `carrierCode`/`carrierName`, `vesselName`/`voyageNumber`/`flightNumber`, planned/estimated/actual departure+arrival, `status`, tied to `shipmentId`. | `Movement` — new block. Has `mode`, `vessel`/`voyage`/`flight`/`train`, `bookingNumber`, planned/actual start+end, `currentETA`, `status`, tied to `carrierPartyId` — same concept, different shape, joined to `Shipment` via a *new* join table `ShipmentMovement` instead of `TransportLeg`'s direct `shipmentId`. |
| `ShipmentStop` — `schema.prisma:690-721` (unchanged). `sequence`, `type`, `unlocode`, lat/long, planned/estimated/actual arrival+departure, optional `transportLegId`. | `MovementStop` — new block. `sequence`, `type`, `unlocode`, planned/actual arrival+departure, `movementId` — functionally identical, tied to `Movement` instead. |
| `TrackingEvent` — `schema.prisma:746-792` (unchanged). Idempotency key, correction chains (`supersedesEventId`), `confidence`, `isInferred`, provider/source-type, tied to `shipmentId`/`transportLegId`/`shipmentStopId`. | `TransportationEvent` — new block. Generic `entityType`/`entityId` + `eventType`/`source`/`payload`/`confidence`/`correlationId` — no idempotency key, no correction chain, tied optionally to `shipmentId`/`movementId`/`transportationOrderId`. |

**This is not just duplicate schema — the running code actively uses both paths for the equivalent operation, in different files:**

- `apps/tms/src/modules/movement/tools/planMovementStopsTool.ts:80,99` calls `db.transportLeg.create(...)` and `db.shipmentStop.create(...)` — i.e. this one file correctly follows the spec's reuse instruction.
- `apps/tms/src/modules/movement/services/movementService.ts:44,119` calls `db.movement.create(...)` / `db.movement.findFirst(...)` — the new duplicate model, in a sibling file within the same `modules/movement/` directory.
- `apps/tms/src/app/api/webhooks/tracking/route.ts:32` calls `db.trackingEvent.create(...)` — correctly reuses the existing tracking model.
- Nearly every other new service (`invoices/*`, `tenders/*`, `rating/*`, `agents/*`, `pod/*`, `customs/webhook/route.ts`) calls `publishTransportationEvent(...)` (`apps/tms/src/modules/events/services/eventService.ts:25,50,60,70`), which writes to the new `TransportationEvent` model — this one has broad real usage across the app as a general domain-event log, so it reads more like a deliberate (if unreviewed) design choice than dead duplication; still worth a decision since it overlaps `TrackingEvent`'s purpose and lacks its idempotency/correction machinery.

Neither `planMovementStopsTool.ts` nor `movementService.ts` currently has any caller outside its own module — `movementService.ts`'s only importer repo-wide is `apps/tms/tests/phase1.test.ts`, and `planMovementStopsTool.ts` has **no** importer at all (not even a test). So today neither is reachable from a live route, but `movementService.ts` at least has a test backing it, which risks it being treated as the "real" implementation going forward while the spec-correct tool sits unused and gets deleted in a later cleanup pass.

**What to fix:** delete `Movement`, `MovementStop`, and `ShipmentMovement`, and port `movementService.ts` to operate on `TransportLeg`/`ShipmentStop` the way `planMovementStopsTool.ts` already does correctly. For `TransportationEvent`, make an explicit decision (and record it) on whether it's a deliberate broader "TMS domain event log" distinct from `TrackingEvent`'s narrower "carrier GPS/tracking ping" scope — if so it should be documented as an intentional Section-1 addition (not silently added), and it should probably gain the same idempotency-key protection `TrackingEvent` has, since several of its callers are webhook-driven (`customs/webhook/route.ts`).

---

## P1-1 (CONFIRMED): `AgentDecision.shipmentId` was changed from required to nullable — violates "no changes to existing models' shape"

Spec Phase 0 step 5 is explicit: *"One migration, additive only — no changes to existing models' shape."* The diff does exactly that:

```
-  shipmentId          String
-  shipment            Shipment          @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
+  shipmentId          String?
+  shipment            Shipment?         @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
```

This was done to let `TransportationOrder.agentDecisionId` point at a "parse-confidence" `AgentDecision` before a `Shipment` exists yet (Phase 1's email-understanding step, which is legitimately shipment-less). That's a real requirement, but it's an undocumented, unreviewed change to an *existing* model that every current `apps/custom` caller of `AgentDecision.shipment`/`shipmentId` was written assuming is non-null.

**What to fix:** either (a) explicitly call this out as an approved shape change and audit every `apps/custom` read site that dereferences `agentDecision.shipment` without a null check, or (b) avoid the change by giving `TransportationOrder` (or a new decision-adjacent field) its own decision link that doesn't require relaxing `AgentDecision`'s existing contract.

---

## P1-2 (CONFIRMED): `CarrierInvoiceLine` has no `accountId` — excluded from automatic tenant-scoping

`packages/db/src/index.ts:90-104` computes `modelsWithRequiredAccountId` purely from the Prisma DMMF: a model is only auto-tenant-scoped if it has a field literally named `accountId` that `isRequired`. `CarrierInvoiceLine` (new block, `schema.prisma`) has no `accountId` field at all — only `carrierInvoiceId` → `CarrierInvoice` (which does have `accountId`). This matches the spec's own `CarrierInvoiceLine` definition (Section 2, lines 168-175 of the spec), so it's inherited, not invented — but it does mean `getTenantScopedModelNames()` will **not** include `CarrierInvoiceLine`, and any future direct `db.carrierInvoiceLine.findMany()` call without an explicit join/filter through `carrierInvoice.accountId` bypasses the tenant-isolation middleware entirely.

There's mixed precedent in this codebase already: `InvoiceLine` (`schema.prisma:5997-6007`, pre-existing) also has no `accountId`, but `ShipmentLineItem` (`schema.prisma:1092-1098`, pre-existing) does. So this isn't a clean established convention either way — it's a live inconsistency the codebase already had, that this build extended rather than resolved.

**What to fix:** add `accountId String` + `account Account @relation(...)` to `CarrierInvoiceLine` so it's covered by the automatic middleware like every sibling model in this build is, rather than relying on callers to always join correctly.

---

## P1-3 (CONFIRMED): Lossy Decimal → number → Decimal round-trip when persisting derived financials

`apps/tms/src/modules/financials/services/financialLedgerService.ts` does the arithmetic correctly in `Decimal.js` (lines 66-96), but at the DB-write boundary it goes through a `.toNumber()` round-trip it didn't need to:

```
// line 124-129: Decimal -> number (lossy, for the return type)
clientSellRateUsd: sellAmount.toNumber(),
...
// line 146-151: number -> new Decimal(...) again, for the actual DB write
sellAmount: new Decimal(result.clientSellRateUsd),
expectedBuyCost: new Decimal(result.expectedBuyCostUsd),
actualBuyCost: new Decimal(result.actualBuyCostUsd),
```

The file's own comment says "All arithmetic uses Decimal.js — no float math on money," but the persisted values pass through an IEEE-754 `number` on the way to the DB instead of writing the original `sellAmount`/`expectedBuyCost`/`actualBuyCost`/`grossProfit` `Decimal` instances directly. In practice this is unlikely to lose precision at 2 decimal places within normal freight-invoice magnitudes, but it defeats the stated purpose of using Decimal.js in the first place and is exactly the bug class Section 3/the repo's audit history calls out ("float math substituting for Decimal on money").

**What to fix:** keep `sellAmount`, `expectedBuyCost`, `actualBuyCost`, `grossProfit` (the `Decimal` instances, not the `ShipmentFinancialLedger` DTO's `number` fields) in scope through the persist block and write those directly; only call `.toNumber()` when building the DTO that's actually returned to a caller that needs a plain number.

No other genuine money-as-float bugs found: `packages/db/prisma/schema.prisma`'s new models all correctly use `Decimal @db.Decimal(...)` for every real money field (`baseRate`, `buyAmount`, `sellAmount`, `margin`, `totalAmount`, `financialThreshold`, `marginThreshold`, `demurrageExposureUsd`, etc.). `apps/tms/src/modules/invoices/services/invoiceIngestionService.ts` also does its summation/discrepancy math correctly in `Decimal.js` and only exposes `number` at its JSON-DTO input/output boundary, which is expected (JSON has no Decimal type). `rateProvider.ts`'s `amount: number` is a type-only adapter interface with no arithmetic in it — lower-risk, noted below as P2.

---

## P2-1 (SUSPECTED): `TransportationOrder`/`TransportationEvent`/`CarrierRate.confidence` use `Float`, inconsistent with the rest of the codebase's `Int` convention

Existing confidence fields elsewhere in `schema.prisma` are consistently `Int` (e.g. `AgentDecision.confidence` — `Int? // model confidence, null until the model reports one`, line 1163; `confidence Int @default(92)` at lines 1605, 2488; `htsConfidence Int?` at 1106). The three new TMS models instead use `Float?` (0.0–100.0 per their own comments). Not a correctness bug, but an unnecessary type inconsistency for equivalent data across the same schema.

**What to fix:** align to `Int?` (0-100) to match `AgentDecision.confidence` and the rest of the codebase, unless sub-integer confidence precision is a deliberate requirement (not stated anywhere).

---

## P2-2 (CONFIRMED): `MovementStop` has no uniqueness constraint its sibling `ShipmentStop` enforces

`ShipmentStop` has `@@unique([shipmentId, sequence])` (schema.prisma:717) preventing two stops with the same sequence number on one shipment. `MovementStop` (new block) has no equivalent `@@unique([movementId, sequence])`, so duplicate sequence numbers within the same movement are possible. Minor, and moot if P0-4 is fixed by deleting `MovementStop` outright — flagging in case `Movement`/`MovementStop` is kept instead.

---

## P2-3 (CONFIRMED): `ProofOfDelivery` and `CarrierInvoice` have no `updatedAt`

Both models only have `createdAt`. `CarrierInvoice.matchStatus` transitions over time (`PENDING → MATCHED/DISPUTED/EXCEPTION` per Phase 6), and `ProofOfDelivery.exceptionNoted`/`notes` are plausibly editable after creation — neither has a timestamp to track when. This matches the spec's own Section 2 definitions (which also omit `updatedAt` on both), so it's inherited, not invented, but worth closing while the migration is being written anyway.

**What to fix:** add `updatedAt DateTime @updatedAt` to both.

---

## Verified as CORRECT (no finding — listed so the fix pass doesn't waste time re-checking)

- **`DocumentType` enum**: `PROOF_OF_DELIVERY`, `CARRIER_INVOICE` added exactly as spec'd (`schema.prisma` diff, enum block near line 9-10 of the diff).
- **`IntegrationCategory` enum**: `CARRIER_RATING` added exactly as spec'd (diff line ~194).
- **`AuditSource` TS union**: moved to `packages/decisions/src/audit.ts:4` — `"UI" | "CHAT" | "SYSTEM" | "API" | "EMAIL" | "AGENT"`, and the header allowlist at `audit.ts:48-58` also accepts `"EMAIL"`/`"AGENT"`. `apps/custom/src/lib/audit.ts` correctly re-exports via `export * from "@qubere/decisions"`.
- **`WorkItemKind` union**: `packages/decisions/src/workTypes.ts:1-8` — `"tender"` and `"carrier_invoice"` both added.
- **Permission catalog**: moved to `packages/auth/src/permissions.ts`, and `transportation_orders.read`/`.write`, `carriers.manage`, `tenders.send`, `carrier_invoices.match`, `carrier_invoices.override` all present (lines 152-182) and actually wired into route guards (`apps/tms/src/app/api/tenders/[id]/respond/route.ts:69`, `apps/tms/src/app/api/invoices/route.ts:43,93`, `apps/tms/src/app/api/transportation-orders/route.ts:29,67`, `apps/tms/src/app/api/quotes/route.ts:33,67`, etc.), and covered by `apps/tms/tests/phase0.test.ts:30-62`.
- **Tenant-scoping mechanism itself**: `packages/db/src/index.ts:86-104`'s `getTenantScopedModelNames()`/`modelsWithRequiredAccountId` logic is purely DMMF-driven and will pick up every new model that has a required `accountId` automatically — no manual registration needed. All 13 new models except `CarrierInvoiceLine` (P1-2) have a required `accountId` + `account` relation. `apps/custom/tests/tenant-context-adoption.test.ts` also pulls its model list dynamically from `getTenantScopedModelNames()`, so it doesn't need manual updates for new models — it will auto-adopt them the moment any `apps/custom` route/action calls them (none currently do, since this build is `apps/tms`-only).
- **Money fields in the schema itself**: every new model correctly uses `Decimal @db.Decimal(...)`, none use `Float`/plain `number` for actual currency amounts.

---

## Summary of what to fix, in order

1. Generate and commit a real Prisma migration for all 13 new models + enum/existing-model changes (P0-1) — nothing else matters until this exists.
2. Resolve the `Carrier` vs `CarrierProfile` split-brain (P0-2) and wire real relations for every `carrierId` field (P0-3) — pick one, delete/migrate the other, fix `carrierService.ts`/`carrierSelectionService.ts`/`recommendCarrierTool.ts`/`CarrierRate` to agree.
3. Delete `Movement`/`MovementStop`/`ShipmentMovement`, port `movementService.ts` to `TransportLeg`/`ShipmentStop` (P0-4). Decide and document `TransportationEvent`'s relationship to `TrackingEvent`.
4. Audit `AgentDecision.shipmentId` nullability change against existing `apps/custom` call sites (P1-1).
5. Add `accountId` to `CarrierInvoiceLine` (P1-2); fix the Decimal round-trip in `financialLedgerService.ts` (P1-3).
6. P2 cleanup (confidence field types, `MovementStop` uniqueness, missing `updatedAt`) can ride along with the migration commit.

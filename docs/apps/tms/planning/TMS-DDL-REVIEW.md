# TMS Data Model Review — `packages/db/prisma/schema.prisma`

## Scope

The schema is shared across `apps/custom` (customs/compliance — HTS, rulings,
classification, restricted-party screening, drawback, protests) and
`apps/tms` (freight execution). It's 238 models / 7,228 lines total; roughly
150 of those models belong entirely to the customs/compliance domain. **This
review is scoped to the TMS-owned models and the shared core tables TMS
depends on** — the same boundary as everything else in this thread. If you
want the customs/compliance ~150-model slice reviewed too, that's a
separate, similarly-sized pass — say so and I'll scope it.

TMS-owned tail: `TransportationOrder`, `CarrierProfile`, `Movement`,
`ShipmentMovement`, `MovementStop`, `TransportationEvent`, `Carrier`,
`CarrierRate`, `FreightQuote`, `Tender`, `ProofOfDelivery`, `CarrierInvoice`,
`CarrierInvoiceLine`. Shared-but-TMS-critical: `Shipment`,
`ShipmentDocument`, `ShipmentTrackingIdentifier`, `ShipmentEquipment`,
`TrackingEvent`, `EtaObservation`, `AgentDecision`, `AgentPolicyConfig`,
`PipelineJob`, `PipelineStepExecution`, `WorkflowOutboxEvent`,
`AccountMemory`, `MemoryEvidence`, `ExceptionItem`.

**Bottom line:** the individual TMS tables are reasonably well-designed —
tenant-scoped, indexed, decimal money columns, real evidence/decision
lineage. The structural problems are all one root cause repeating at
different levels: **TMS and customs share aggregate roots instead of each
owning theirs, cross-referenced.** That one decision is what produced
every other finding below.

---

## Finding 1 (root cause) — `Shipment` is a shared god-table across two unrelated domains

[schema.prisma:525-661](../../packages/db/prisma/schema.prisma) — `Shipment`
carries both the customs filing lifecycle (`customsRequired`,
`filingDeadline`, `currentStage: "DOCUMENT_INTAKE | CLASSIFICATION |
VALUATION | ORIGIN | COMPLIANCE | FILING_PREP | READY_TO_FILE"`, `riskScore`,
`readinessScore`, `importerOfRecordId`) and the TMS freight-execution
lifecycle (`promiseState`, `lastFreeDay`, `demurrageExposureUsd`,
`healthStatus`, the `sellAmount`/`expectedBuyCost`/`grossMarginPct`
financial cache) on one row, with ~30 relation arrays hanging off it — about
half customs-owned, half TMS-owned. The doc comment at line 666 says it
outright: *"Shipment remains the durable customs work object."* TMS was
built on top of a table designed for a different domain, not given its own.

This isn't necessarily wrong for where the product is today — a shipment
genuinely is one real-world object whether or not it needs customs filing —
but it's the reason every other finding below exists: once one table serves
two domains, everything that references "the shipment's carrier" or "the
shipment's workflow" has to either duplicate fields or split state across
parallel structures.

**Recommendation:** not a "just fix it" migration — this is a product/team
conversation (does TMS-without-customs need to exist as a first-class
product surface, or is TMS always an add-on to a customs shipment?). Flag it
explicitly rather than silently accept it. If the answer is "TMS should be
usable standalone," the fix is a `TmsShipmentProfile` (or similar) 1:1
extension table owning the TMS-only fields, FK'd to `Shipment.id`, so TMS's
schema ownership is real and customs never has to know those columns exist.

---

## Finding 2 — carrier identity is split three ways with no single source of truth

Three different structures answer "who is the carrier," inconsistently used:

1. **`Carrier`** ([schema.prisma:7051](../../packages/db/prisma/schema.prisma)) — standalone: `legalName`, `scac`, `mcNumber`, `dotNumber`, `contactEmail/Phone`, `insuranceOnFile: Boolean`. Referenced by `FreightQuote.carrierId`, `Tender.carrierId`, `CarrierInvoice.carrierId`.
2. **`CarrierProfile`** ([schema.prisma:6907](../../packages/db/prisma/schema.prisma)) — 1:1 with the MDM `Party` model (`partyId @unique`), with **the same three identifiers under different names** (`scac`, `dot`, `mc` vs. `Carrier`'s `scac`, `dotNumber`, `mcNumber`), plus richer fields `Carrier` doesn't have: `insuranceStatus`, `safetyStatus`, `approvedStatus`, `preferredStatus`, `serviceAreas`, `performanceMetrics`.
3. **Raw `Party` via `carrierPartyId`** — used by `Movement`, `CarrierRate`, and (critically) `FreightQuote`, which has **both** `carrierId → Carrier` and `carrierPartyId → Party` as two independent nullable FKs on the same row, answering the same question.

Plus free-text `carrierName: String?` on `Shipment`, `CarrierRate`, `FreightQuote`, and `Movement` — a fourth, unvalidated way to record the same fact.

This is exactly why the pipeline's carrier-selection logic
([costCarrierReadinessAgent.ts:44](../../apps/tms/src/modules/agents/services/costCarrierReadinessAgent.ts))
has to do `cleanString(memory.scope?.carrierName ?? memory.scope?.scac)` —
fuzzy string matching, because there's no single FK it can trust to join
through. Any two of `Carrier`, `CarrierProfile`, and a free-text
`carrierName` can legitimately disagree about the same real carrier with
nothing enforcing they don't.

**Recommendation:** pick one as canonical — `CarrierProfile`+`Party` is the
richer model and already the one the customs/compliance screening system
presumably keys off of (restricted-party checks need a real `Party`, not a
freestanding `Carrier` row), so it's the better long-term source of truth.
Migration path: add `carrierPartyId` to `Tender`/`CarrierInvoice` (they
currently only have `carrierId`), backfill by matching on `scac`/`dotNumber`
where possible, then deprecate `Carrier` and `FreightQuote.carrierId` once
every write path is confirmed to populate `carrierPartyId`. This is a real
migration, not a quick fix — sequence it as its own project.

---

## Finding 3 — `PipelineJob` shares one table across two workflow domains

[schema.prisma:3119-3155](../../packages/db/prisma/schema.prisma) — same
pattern as Finding 1, one level down: `workflowType: String @default("CUSTOMS")`
discriminates `"CUSTOMS"` vs `"TMS_DOCUMENT_PROCESSING"` jobs in one table,
with a comment acknowledging it (*"Existing Customs jobs use CUSTOMS; TMS
document workflows use TMS_DOCUMENT_PROCESSING"*). Every query needs a
`workflowType` filter to avoid cross-domain leakage (the orchestrator code
does this correctly today — `executeTmsPipelineJob` checks
`initial.workflowType !== TMS_WORKFLOW_TYPE` — but that's app-level
discipline compensating for a schema that doesn't enforce the separation).

**Recommendation:** lower priority than Finding 2 — this one is working
correctly today because the app code is careful. Worth splitting into
`TmsPipelineJob`/`CustomsPipelineJob` (or a shared `PipelineJob` base +
per-domain step-execution tables) only if a third workflow type gets added,
or if you ever need workflow-specific columns that don't apply to the other
domain. Not urgent in isolation.

---

## Finding 4 — `TransportationEvent` mixes two association patterns on one row

[schema.prisma:7020-7049](../../packages/db/prisma/schema.prisma) —
`TransportationEvent` has **both** real nullable FKs (`shipmentId`,
`movementId`, `transportationOrderId`) **and** a loose polymorphic pair
(`entityType: String` covering `TRANSPORTATION_ORDER | SHIPMENT | MOVEMENT |
FREIGHT_QUOTE | TENDER | CARRIER_INVOICE | CUSTOMS_FILING`, `entityId:
String`). For 3 of the 7 entity types there's a real, cascadable FK; for the
other 4 (`FREIGHT_QUOTE`, `TENDER`, `CARRIER_INVOICE`, `CUSTOMS_FILING`),
`entityId` is an unenforced string — no referential integrity, no cascade
delete, nothing stops it pointing at a row that no longer exists.

**Recommendation:** pick one pattern. Either add the remaining 4 nullable
FKs (sparse row, but every event is provably linked and cascades correctly),
or drop the 3 "real" FKs and go fully polymorphic with app-level
enforcement (less safe, but at least consistent — a reader doesn't have to
remember which entity types are "real" vs "trust me"). Given this schema's
default convention is real relations everywhere else, adding the 4 missing
FKs is the more consistent fix.

---

## Finding 5 — two document references are comments, not real relations

`ProofOfDelivery.documentId` ([schema.prisma:7187](../../packages/db/prisma/schema.prisma))
and `CarrierInvoice.documentId` ([schema.prisma:7204](../../packages/db/prisma/schema.prisma))
are both `String`/`String?` with a `// FK -> ShipmentDocument` comment —
not an actual `@relation`. Every other cross-table reference in this schema
(there are hundreds) uses a real Prisma relation. These two are the
exception, which means: no cascade behavior, no referential integrity, and
if a `ShipmentDocument` is ever hard-deleted (none exists today, per the
detach-vs-delete review earlier in this project, but nothing prevents one
being added later) these two would silently hold a dangling id instead of
either cascading or being caught by the database.

**Recommendation:** trivial, safe, additive migration — turn both into real
`@relation` fields with `onDelete: SetNull` (consistent with how this schema
treats optional document references elsewhere, e.g.
`EtaObservation.shipmentDocumentId` at line 1077). No app code changes
required beyond regenerating the Prisma client; existing values are valid
ids already.

---

## Finding 6 — `FreightQuote.amount` is an acknowledged legacy duplicate

[schema.prisma:7123](../../packages/db/prisma/schema.prisma):
`amount Decimal @db.Decimal(12, 2) // legacy alias for sellAmount`. Two
columns holding the same value with nothing enforcing they agree — a write
path that sets one and forgets the other silently produces a lying row.

**Recommendation:** grep every write site for `FreightQuote.amount` vs
`.sellAmount`, confirm they're always set together (or that `amount` is
genuinely dead), and either drop the column or make it a computed/generated
value. Cheap to fix once confirmed; the risk is only in not knowing which
write paths still depend on it.

---

## Finding 7 — `TransportationOrder` has four overlapping origin/destination fields, and they're populated by different code paths

[schema.prisma:6871-6874](../../packages/db/prisma/schema.prisma):
`originAddress Json?`, `destinationAddress Json?`, `origin Json?`,
`destination Json?` — four fields for what's conceptually two facts. This
isn't theoretical duplication; I traced it and the two pairs are written by
**different, non-overlapping code paths**:

- `originAddress`/`destinationAddress` — written by the email/manual order
  intake path: [orderService.ts:63-64](../../apps/tms/src/modules/orders/services/orderService.ts),
  [parseFreightEmailTool.ts:96-97](../../apps/tms/src/modules/orders/tools/parseFreightEmailTool.ts),
  [transportation-orders/route.ts:47-48](../../apps/tms/src/app/api/transportation-orders/route.ts)
- `origin`/`destination` — written by the document-extraction pipeline (Step
  2, [shipmentEnrichmentAgent.ts:126-127](../../apps/tms/src/modules/agents/services/shipmentEnrichmentAgent.ts))

Nothing reconciles them, so a `TransportationOrder` created from an uploaded
document has `origin`/`destination` set and `originAddress`/`destinationAddress`
null, while one created from an inbound email has the opposite — and any
code reading "the order's origin" has to know which intake path created it,
or defensively fall back across both. It already does:
[memory.domain-events.ts:68-69](../../apps/tms/src/modules/memory/memory.domain-events.ts):
`order?.origin ?? order?.originAddress` — a 3-deep fallback chain
(`laneOrigin ?? origin ?? originAddress`) that exists specifically to paper
over this.

**Recommendation:** unify to one pair of fields. Given documents (Step 2)
are the higher-fidelity source per this project's earlier work, and email
intake is more free-form, either (a) have both intake paths write to the
same `origin`/`destination` fields and drop `originAddress`/`destinationAddress`,
or (b) if the two shapes genuinely differ (a full mailing address vs. a
port/city/unlocode lane descriptor), rename them so the difference is
explicit (`originLocation` vs `originMailingAddress`) instead of looking
like an accidental duplicate. Needs a decision, not just a rename — check
whether any UI reads one field specifically expecting the other's absence
before touching this.

---

## Not a problem — noted for completeness

- `Tender.history: Json` (append-log-as-JSON, "same shape as
  `ExceptionItem.history`") — a deliberate, consistent convention across
  this schema, not a smell. Only worth revisiting if you ever need to query
  *inside* the history (filter/sort by a specific transition), which JSON
  can't index well — not a current need.
- `Shipment.masterShipmentId` self-relation (`MasterHouseRelation`,
  `onDelete: SetNull`) — correctly modeled master/house bill relationship.
- `ShipmentMovement` — initially looked unused (zero literal matches for
  the model name), but it's a real, correctly-designed junction table
  (`Shipment` ⟷ `Movement` many-to-many, supporting consolidation); it's
  just always accessed via its plural relation name (`shipmentMovements`),
  not the model name directly.

---

## Priority order for "antigravity"

1. **Finding 5** (comment-only FKs → real relations) — trivial, safe,
   additive, zero app-code risk. Do this first.
2. **Finding 6** (`FreightQuote.amount` dedup) — cheap once the grep confirms
   which write paths still touch it.
3. **Finding 7** (`TransportationOrder` origin/destination unification) —
   needs a product decision on which shape is canonical before touching
   code; write the decision down before migrating.
4. **Finding 4** (`TransportationEvent` polymorphic vs. real FK) — additive
   (add the missing FKs), no data loss risk, but touches a write path used
   across quotes/tenders/invoices — test coverage before shipping.
5. **Finding 2** (carrier trifurcation) — real project, not a quick fix.
   Sequence separately once Finding 1 is settled, since the answer may
   depend on it (if TMS gets its own aggregate root, carrier identity might
   move with it).
6. **Finding 3** (`PipelineJob` workflow split) — only act if/when a third
   workflow type is added or domain-specific columns are needed. Don't
   preemptively split a table that's working.
7. **Finding 1** (the `Shipment` god-table) — this is the one to bring back
   to the team as a conversation, not a ticket. Everything else on this
   list is a symptom; decide the target shape before spending migration
   effort on the symptoms it produces.

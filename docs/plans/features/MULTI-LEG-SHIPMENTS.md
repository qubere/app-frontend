# Multi-Leg Shipments — Design, API & UX Requirements

Status: phase 1 implemented (PR #107)
Written: 2026-08-29
Owner: Shipment platform (apps/custom + apps/tms + packages/db)
Related: `docs/plans/TMS-SHIPMENT-LIFECYCLE-RIBBON.md`, `apps/custom/src/modules/tracking/shipmentTracking.ts`, `apps/tms/src/modules/shipments/services/shipmentLifecycleStatus.ts`

## Implementation status (PR #107, revised)

Shipped: `ShipmentLeg` / `ShipmentLegDocument` / `ShipmentLegEquipment` / `LegInferenceRun`
schema + migration `20260829200000_multi_leg_shipments`; `@qubere/shipment-legs`
package (rule-based inference, per-leg document catalog, diff proposals,
transactional apply); leg CRUD + reorder + infer/accept/reject API routes (all
`withAuthenticatedRoute` + `shipments.manage` write permission + tenant-scoped +
zod-validated + transactional re-sequencing); `journey` block on the tracking
projection; shared `JourneyRibbon` component (dynamic rail, per-leg cards, doc
checklist with a real document picker, inference-proposal card, confirm-route);
non-destructive demo seed on `SHP-TGT-2026-001`.

Key deltas from the original design below:
- **`ShipmentLegDocument` is keyed on `slotKey` (+ `slotLabel`), not `expectedDocType`.**
  Real transport docs (booking confirmation, shipping instructions, arrival
  notice, delivery order) all map to `DocumentType.OTHER`; `slotKey` is the
  stable per-leg slot identity and the unique constraint is `@@unique([legId, slotKey])`.
- **`TransportLeg` / `Movement` are NOT yet removed.** Phase 1 adds `ShipmentLeg`
  alongside them; the backfill (§5.5) and the drop are still pending — no
  backfill script has been written yet (the interim `ShipmentTrackingPanel` still
  reads `TransportLeg`; the new `JourneyRibbon` reads `ShipmentLeg`).
- The shipment-detail 403-vs-404 rework that rode along in the first commit was
  reverted — it widened cross-account read access and belongs in its own PR.
- Inference is deterministic rule-based (`model: "rules-v1"`), persisted per run
  in `LegInferenceRun` keyed on a SHA-256 `inputsHash` so re-runs are idempotent.
  It never invents carrier/vessel values it can't derive — those stay null for
  the broker to confirm.

---

## 1. Problem & context

A real import move is almost never one carrier from door to door. A typical
ocean import is: factory → export drayage → origin port → main vessel →
(transshipment port → connecting vessel) → destination port → import drayage
→ importer DC. Each of those **legs** has its own carrier, its own
reference numbers, its own status, its own ETA, and — critically — **its own
set of documents** (booking confirmation and shipping instructions on the
export leg; master bill on the ocean leg; arrival notice and delivery order
on the import leg; proof of delivery on the final leg).

Today Qubere models this inconsistently across two apps:

| Concern | apps/custom (customs) | apps/tms (freight ops) |
|---|---|---|
| Leg entity | `TransportLeg` (sequence, mode, carrier, origin/dest, planned/est/actual times, status) | `Movement` + `ShipmentMovement` join (mode, carrier, vessel, bill numbers, status) |
| Stops | `ShipmentStop` (FK to `TransportLeg`, nullable) | `MovementStop` (FK to `Movement`) |
| Events | `TrackingEvent` (FK to `TransportLeg`/`ShipmentStop`/`ShipmentEquipment`) | `TransportationEvent` (polymorphic `entityType`/`entityId`) |
| Journey UI | `ShipmentTrackingPanel` — two independent rails (movement, customs) + flat leg list | `ShipmentLifecycleRibbon` — 9-stage linear ribbon, "multi-leg movement breakdown" only when >1 `Movement` |
| Documents | `ShipmentDocument.shipmentId` only — **no leg linkage** | same |

Consequences:

- **No per-leg documents.** `ShipmentDocument` links to a shipment and
  optionally a TMS order/load *string*, never a leg. The document library is
  one flat pile; a broker can't see "the ocean leg is missing its MBL" vs
  "the import leg is missing its delivery order."
- **Two leg models that disagree.** `TransportLeg` and `Movement` are
  populated by different pipelines and are never reconciled. The customs app
  and TMS app can show different leg counts for the same physical move.
- **The ribbon flattens the journey.** The TMS ribbon rolls all movements
  up to "the single most-advanced movement's stage," so a shipment whose
  ocean leg has arrived but whose import drayage hasn't started shows as
  "Arrived" with the drayage invisible unless you expand.
- **Legs are never auto-inferred.** A broker uploads 8 documents and still
  has to hand-build the route. The system has the raw material (bill types,
  port pairs, vessel names, container numbers) to propose the leg structure
  and the per-leg document checklist, and doesn't.

## 2. Goals

1. **One canonical leg model** (`ShipmentLeg`) that both apps read from. One
   `shipmentId` stays the durable end-to-end identifier — legs hang off it,
   they never replace it or fragment it.
2. **Per-leg documents** via a `ShipmentLegDocument` join, so one document
   can belong to one or more legs (an MBL covering an ocean leg + its
   transshipment leg) while shipment-level documents (commercial invoice,
   packing list) stay attached at the shipment.
3. **Auto-inference**: from the documents on a shipment, propose (a) how
   many legs exist and their mode/endpoints/sequence, and (b) the required
   document set per leg. The broker confirms or edits; inference never files
   or commits silently.
4. **A journey ribbon** that shows the full end-to-end route with per-leg
   status, per-leg document completeness, and per-leg ETA — without
   collapsing multi-leg shipments into one status.
5. **Status at three levels that never contradict each other**: leg status
   (physical), shipment movement rollup (derived), customs clearance
   (independent rail — an arrival never implies release).

## 3. Non-goals

- Replacing the AI document-processing pipeline ribbon
  (`TmsPipelineProgressRibbon`) — different concern, untouched.
- Real-time carrier integrations. Inference and this data model consume
  whatever tracking events already arrive (`TrackingEvent`); wiring new
  providers is out of scope.
- Last-mile parcel legs / sub-shipment splitting (one container → multiple
  delivery stops). Modeled as future work in §11.
- Rate/cost per leg. `ShipmentCharge`/`ShipmentCost` stay shipment-scoped
  for v1; a `legId` column on them is noted as future work.

## 4. Core concepts & invariants

**Shipment** — the durable work object. Has exactly one `shipmentNumber`,
one customs entry context, one importer of record. Never split by this
feature.

**Leg** — one continuous carrier movement between two points, in one mode.
Ordered by `sequence` (1-based, contiguous). A leg has one mode, at most one
primary carrier, an origin point and a destination point, and its own
planned/estimated/actual departure & arrival timestamps and status.

**Stop** — a point on the journey (facility, port, terminal, rail ramp,
airport, DC). A stop belongs to the shipment and is referenced by the leg(s)
that arrive at / depart from it. Two adjacent legs **share** the stop
between them (leg 2's destination stop == leg 3's origin stop) — this is
what makes a transshipment legible.

**Leg document** — a `ShipmentDocument` associated with one or more legs
through `ShipmentLegDocument`. A document with **no** leg association is
shipment-level.

**Invariants** (enforced in the service layer, asserted in tests):

- `sequence` values for a shipment's legs are `1..N` with no gaps.
- Leg *k*'s `destinationStopId` == leg *k+1*'s `originStopId` for all
  adjacent legs (the shared-stop rule). Inference and the editor both
  maintain this.
- A leg's `mode` is immutable after `status` leaves `PLANNED` (changing it
  means the route was wrong — delete and re-infer, don't mutate).
- Deleting a shipment cascades to legs, stops, leg-document links (but
  **not** the documents themselves — same `onDelete: SetNull` philosophy as
  `ShipmentDocument.shipmentId` today).
- Every query is `accountId`-scoped (multi-tenant, consistent with the rest
  of the schema).

## 5. Data model

### 5.1 New: `ShipmentLeg`

Supersedes `TransportLeg` and the `Movement`/`ShipmentMovement` pair as the
canonical journey spine. `TransportLeg` and `Movement` are kept for one
release as **read-through views** (see §5.5 migration) then dropped.

```prisma
enum LegMode {
  OCEAN
  AIR
  RAIL
  TRUCK          // includes drayage / cartage
  BARGE
  COURIER
}

enum LegType {
  EXPORT_HAULAGE     // factory/shipper door -> origin port/ramp/airport
  MAIN_CARRIAGE      // port -> port (or airport -> airport, ramp -> ramp)
  TRANSSHIPMENT      // connecting main-carriage segment via an intermediate hub
  IMPORT_HAULAGE     // destination port/ramp/airport -> consignee door
  ON_CARRIAGE        // generic connecting inland move
}

enum LegStatus {
  PLANNED
  BOOKED
  READY_FOR_PICKUP
  IN_TRANSIT
  ARRIVED            // arrived at this leg's destination stop
  COMPLETED          // handed off to the next leg / delivered
  EXCEPTION          // delayed, rolled, held — see statusReason
  CANCELLED
}

model ShipmentLeg {
  id          String   @id @default(cuid())
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  shipmentId  String
  shipment    Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  sequence    Int
  legType     LegType
  mode        LegMode

  originStopId       String
  originStop         ShipmentStop @relation("LegOrigin", fields: [originStopId], references: [id])
  destinationStopId  String
  destinationStop    ShipmentStop @relation("LegDestination", fields: [destinationStopId], references: [id])

  // Carrier
  carrierName   String?
  carrierScac   String?        // SCAC / IATA / airline code
  carrierPartyId String?
  carrierParty  Party?         @relation(fields: [carrierPartyId], references: [id], onDelete: SetNull)

  // Conveyance
  vesselName    String?
  imoNumber     String?
  voyageNumber  String?
  flightNumber  String?
  trainNumber   String?
  tripNumber    String?

  // Reference numbers that identify THIS leg's contract of carriage
  billOfLadingNumber String?    // MBL for main carriage, HBL for haulage
  billOfLadingType   String?    // "MASTER" | "HOUSE" | "SEA_WAYBILL" | "AWB" | "PRO"
  bookingNumber      String?

  // Timeline — planned/estimated/actual kept distinct (never overwrite planned)
  plannedDeparture   DateTime?
  estimatedDeparture DateTime?
  actualDeparture    DateTime?
  plannedArrival     DateTime?
  estimatedArrival   DateTime?
  actualArrival      DateTime?

  status        LegStatus @default(PLANNED)
  statusReason  String?   // free text for EXCEPTION / CANCELLED

  // Provenance
  source           String  @default("INFERRED") // INFERRED | MANUAL | PROVIDER | DOCUMENT | EDI
  inferredFromRunId String?                     // LegInferenceRun.id that created it
  confidence       Float?                        // 0..1, null once broker-confirmed
  confirmedAt      DateTime?
  confirmedByUserId String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  legDocuments ShipmentLegDocument[]
  events       TrackingEvent[]
  etaObservations EtaObservation[]
  equipment    ShipmentLegEquipment[]

  @@unique([shipmentId, sequence])
  @@index([accountId, shipmentId])
  @@index([shipmentId, status])
  @@index([mode, status])
}
```

### 5.2 Reuse & extend: `ShipmentStop`

Keep `ShipmentStop` (already shipment-scoped). Add:

```prisma
model ShipmentStop {
  // ... existing fields ...
  role        String?  // "ORIGIN" | "PORT_OF_LADING" | "TRANSSHIPMENT" | "PORT_OF_DISCHARGE" | "RAMP" | "AIRPORT" | "DEACONSOLIDATION" | "DESTINATION"
  firmsCode   String?  // already present
  legsFromHere  ShipmentLeg[] @relation("LegOrigin")
  legsToHere    ShipmentLeg[] @relation("LegDestination")
}
```

The existing `transportLegId` FK on `ShipmentStop` is dropped — stops are
now shared between adjacent legs, so a single-parent FK is wrong. Events
that pointed at a stop keep doing so.

### 5.3 New: `ShipmentLegDocument` (join)

```prisma
enum LegDocumentRequirement {
  REQUIRED       // leg cannot be considered document-complete without it
  CONDITIONAL    // required only if a shipment/leg characteristic applies
  OPTIONAL
  INFO_ONLY
}

model ShipmentLegDocument {
  id          String   @id @default(cuid())
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  legId       String
  leg         ShipmentLeg @relation(fields: [legId], references: [id], onDelete: Cascade)

  // Nullable: a checklist row can exist ("this leg needs a Delivery Order")
  // before the document itself is uploaded.
  documentId  String?
  document    ShipmentDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  expectedDocType DocumentType   // what SHOULD sit here
  requirement     LegDocumentRequirement @default(REQUIRED)
  requirementReason String?               // "USMCA preference claimed on this leg"

  // Provenance of the checklist row (not the doc)
  source          String  @default("INFERRED") // INFERRED | RULE | MANUAL
  inferredFromRunId String?
  confidence      Float?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([legId, expectedDocType])
  @@index([accountId, legId])
  @@index([documentId])
}
```

Design notes:

- **A checklist row without a `documentId` is a gap.** The UI renders it as
  "missing." When a document is uploaded/classified, the attach service
  fills `documentId` on the matching row (or creates a new `OPTIONAL` row if
  the doc doesn't match any expected slot).
- **One document, many legs**: the MBL for an ocean move that transships is
  linked to both the `MAIN_CARRIAGE` leg and the `TRANSSHIPMENT` leg. Two
  join rows, same `documentId`.
- Shipment-level documents have zero `ShipmentLegDocument` rows.

### 5.4 New: `ShipmentLegEquipment` + reuse `TrackingEvent`

`ShipmentEquipment` (containers) becomes `ShipmentLegEquipment` with a
`legId` (a container can move across the export-haulage + ocean legs — model
as multiple rows or a nullable `legId` for "whole journey"; v1: nullable
`legId`, `null` == follows the whole route).

`TrackingEvent` gains `legId` (`String?`, `onDelete: SetNull`) replacing
`transportLegId`. `EtaObservation` likewise. Both already have
`shipmentStopId`.

### 5.5 Migration from `TransportLeg` / `Movement`

Phased, no big-bang:

1. **Add** `ShipmentLeg`, `ShipmentLegDocument`, `ShipmentLegEquipment`,
   new columns. No drops.
2. **Backfill** job (`scripts/backfill-shipment-legs.ts`):
   - For each shipment with `TransportLeg` rows → 1:1 map to `ShipmentLeg`
     (`source = "MANUAL"`, `confirmedAt = now()` — treat existing data as
     broker-trusted). Synthesize `ShipmentStop`s from the leg's
     origin/destination name+unlocode, dedupe adjacent.
   - For each shipment with only `Movement`/`ShipmentMovement` rows → map
     `ShipmentMovement.sequence` → `ShipmentLeg.sequence`, `Movement.mode`
     → `LegMode`, bill numbers across.
   - Shipment with **both** → prefer `TransportLeg` (customs domain is the
     journey authority), attach `Movement` reference numbers where the
     `ShipmentLeg` field is null, log the conflict.
3. **Cut reads over**: `getShipmentTrackingProjection` and
   `computeShipmentLifecycleStatus` read `ShipmentLeg`. `TransportLeg` /
   `Movement` become deprecated; writers redirected.
4. **One release later**: drop `TransportLeg`, `ShipmentMovement`,
   `Movement`, `MovementStop`, `ShipmentEquipment.transportLegId`,
   `TrackingEvent.transportLegId`.

## 6. Auto-inference engine

New module: `packages/shipment-legs/src/inference/` (shared by both apps).
Triggered after any document on a shipment finishes classification +
extraction, debounced ~30s so a burst of uploads infers once.

### 6.1 Inputs

- All `ShipmentDocument` on the shipment with `documentType` set and
  extraction fields available (`ExtractionField` / `activeParseVersionId`).
- `Shipment` fields: `transportMode`, `portOfEntry`, `countryOfExport`,
  `countryOfOrigin`, `destinationCountry`, `incoterm`, `entryType`.
- Existing `ShipmentTrackingIdentifier` rows (MBL/HBL/booking/container/
  MAWB/PRO).
- Existing `TrackingEvent`s (port pairs, vessel names, timestamps).

### 6.2 Leg-structure inference

Deterministic rules first, LLM only to fill gaps and normalize place names
(consistent with `project_ai_stack` — Gemini for reasoning, not Claude).

**Signals → legs:**

| Signal in documents | Inferred legs |
|---|---|
| House BL / forwarder's cargo receipt with shipper address ≠ port | `EXPORT_HAULAGE` (shipper door → POL) |
| Master BL with POL, POD | `MAIN_CARRIAGE` (POL → POD) |
| MBL routing shows an intermediate port ("via Busan"), or 2 vessel/voyage pairs | split `MAIN_CARRIAGE` into `MAIN_CARRIAGE` + `TRANSSHIPMENT` sharing the hub stop |
| Air waybill | `MAIN_CARRIAGE` mode `AIR` (origin airport → dest airport) |
| Arrival notice / delivery order with a consignee address ≠ port | `IMPORT_HAULAGE` (POD → consignee door) |
| Drayage order / dispatch with ramp or CY | `ON_CARRIAGE` or `IMPORT_HAULAGE` mode `TRUCK` |
| No transport doc, only `transportMode` on shipment | single `MAIN_CARRIAGE` leg, low confidence |

**Place resolution**: UN/LOCODE lookup from the existing `Country` /
port-code reference tables and `AcePortCode`; unresolved names get a
`needsReview` flag on the stop.

**Confidence**: product of per-signal confidences × a completeness factor
(fraction of legs that have a backing document). Legs below 0.6 are
proposed but visually marked "needs confirmation."

### 6.3 Per-leg required-document inference

Extends the existing `checkRequiredDocumentTypes` logic
(`apps/custom/src/lib/requiredDocumentTypes.ts`) from "shipment needs these
N types" to "**this leg** needs these types," keyed by `legType` × `mode` ×
shipment characteristics:

| Leg | Base required | Conditional |
|---|---|---|
| `EXPORT_HAULAGE` | Shipping Instructions / Booking Confirmation, Packing List | Dangerous Goods Declaration (hazmat), Fumigation Cert (wood packaging) |
| `MAIN_CARRIAGE` ocean | Master Bill of Lading, ISF filing (US import, ocean) | Certificate of Origin (preference claim), Phytosanitary (plants) |
| `MAIN_CARRIAGE` air | Master Air Waybill | same conditionals |
| `TRANSSHIPMENT` | (inherits MBL from parent main carriage) | — |
| `IMPORT_HAULAGE` | Arrival Notice, Delivery Order, CBP Release (7501 / entry) | Exam invoice (CBP exam), Reefer log (temp-controlled) |
| final leg | Proof of Delivery | — |
| shipment-level (all legs) | Commercial Invoice | Certificate of Origin, PGA docs (FDA PN, USDA permit) |

Output: a set of `ShipmentLegDocument` checklist rows per leg
(`documentId = null` until matched), each with `requirement`, `source`,
`confidence`.

### 6.4 Persistence & the human loop

- Inference writes a `LegInferenceRun` row (id, shipmentId, inputs hash,
  output JSON, model, confidence, createdAt) — never mutates confirmed data.
- If **no** legs exist yet → write the proposed `ShipmentLeg` +
  `ShipmentStop` + `ShipmentLegDocument` rows with `source = "INFERRED"`,
  `confidence` set, `confirmedAt = null`.
- If legs exist and are **confirmed** → produce a **diff proposal**
  (`+ add TRANSSHIPMENT leg`, `~ POD changed CNSHA → CNYTN`,
  `+ IMPORT_HAULAGE now needs Delivery Order`) surfaced as a review card;
  nothing is written until the broker accepts.
- Re-running inference is idempotent on the inputs hash.

### 6.5 Guardrails

- Inference never sets a leg past `PLANNED`, never marks a document
  received, never satisfies a `ComplianceDeadline`.
- A leg with `actualDeparture`/`actualArrival` set (real tracking data
  landed) is frozen — inference can only append downstream legs.
- ISF and entry-filing deadlines are still owned by `deadline.service.ts`;
  inference only proposes that the *document* exists as a checklist row.

## 7. Status model

Three independent status tracks, surfaced together, never merged:

### 7.1 Leg status (`LegStatus`)

Set by the tracking-event reducer (extends the existing
`MOVEMENT_EVENT_STATUS` regex table in `shipmentTracking.ts`) — per leg,
from that leg's `TrackingEvent`s and timeline fields:

- `PLANNED` → `BOOKED` (booking confirmed) → `READY_FOR_PICKUP` (gate-in /
  cargo received) → `IN_TRANSIT` (departed) → `ARRIVED` (arrived at dest
  stop) → `COMPLETED` (discharged + handed to next leg, or delivered).
- `EXCEPTION` overlay when: ETA slips > threshold, vessel roll detected,
  `LAST_FREE_DAY` within 48h and leg not `COMPLETED`, or a blocking
  `ExceptionItem` references the leg.

### 7.2 Shipment movement rollup (derived, not stored)

`journeyStatus` computed for the ribbon header:

- `overallStage` = the `legType`-aware furthest point: the earliest
  non-`COMPLETED` leg is the "current" leg; its status + type gives the
  headline (e.g. "Import drayage — in transit").
- `percentComplete` = completed legs / total legs, weighted by planned
  duration.
- `blocked` = any leg `EXCEPTION` **or** a blocking customs exception.
- Multi-leg shipments **never** collapse: the ribbon always shows every leg;
  the rollup is only the one-line summary.

### 7.3 Customs clearance rail (unchanged, independent)

`customsTrackingStatus` from `CustomsFiling.filingStatus` stays exactly as
today. Rendered as its own rail. **An arrival never implies release**;
release never implies delivered. The ribbon shows both and lets them
disagree.

## 8. API

All under the existing shipment API surface, `accountId`-scoped via the
session context. No new polling endpoint (leg changes are infrequent —
piggyback on the shipment workspace payload, consistent with the lifecycle
ribbon decision).

### 8.1 Read — extend the shipment workspace / tracking payload

`GET /api/shipments/[id]` and `GET /api/shipments/[id]/tracking` gain a
`journey` block:

```ts
type JourneyProjection = {
  shipmentId: string;
  shipmentNumber: string;              // the one durable ID, end to end
  journeyStatus: {
    overallStage: string;              // "MAIN_CARRIAGE_IN_TRANSIT" | ...
    headline: string;                  // "Ocean leg 2 of 4 — in transit to Long Beach"
    percentComplete: number;           // 0..100
    blocked: boolean;
    blockingReasons: string[];
  };
  stops: Array<{
    id: string;
    sequence: number;
    role: string | null;
    name: string;
    unlocode: string | null;
    firmsCode: string | null;
    timezone: string | null;
  }>;
  legs: Array<{
    id: string;
    sequence: number;
    legType: LegType;
    mode: LegMode;
    status: LegStatus;
    statusReason: string | null;
    origin: { stopId: string; name: string; unlocode: string | null };
    destination: { stopId: string; name: string; unlocode: string | null };
    carrier: { name: string | null; scac: string | null };
    conveyance: { vesselName?: string; voyageNumber?: string; flightNumber?: string; imoNumber?: string };
    references: { billOfLadingNumber?: string; billOfLadingType?: string; bookingNumber?: string };
    timeline: {
      plannedDeparture: string | null; estimatedDeparture: string | null; actualDeparture: string | null;
      plannedArrival: string | null; estimatedArrival: string | null; actualArrival: string | null;
    };
    documents: {
      total: number; onFile: number; missingRequired: number;
      rows: Array<{
        legDocumentId: string;
        expectedDocType: DocumentType;
        requirement: LegDocumentRequirement;
        requirementReason: string | null;
        status: "MISSING" | "RECEIVED" | "REVIEW_REQUIRED" | "PROCESSED";
        document: { id: string; fileName: string; fileUrl: string | null; confidence: number | null } | null;
      }>;
    };
    events: TrackingEventRecord[];      // this leg's events, newest first
    eta: { current: string | null; deltaMinutes: number | null; provider: string | null };
    inference: { source: string; confidence: number | null; needsConfirmation: boolean } | null;
  }>;
  customs: CustomsTrackingProjection;   // unchanged shape
  inferenceProposal: JourneyDiffProposal | null;  // present when a re-run has unconfirmed changes
};
```

### 8.2 Write — leg CRUD & confirmation

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/shipments/[id]/legs` | Manually add a leg (body: legType, mode, originStop, destinationStop, carrier…). Renumbers sequences, maintains the shared-stop invariant. |
| `PATCH` | `/api/shipments/[id]/legs/[legId]` | Edit carrier / conveyance / references / timeline / status. Rejects `mode` change once status ≠ PLANNED. |
| `DELETE` | `/api/shipments/[id]/legs/[legId]` | Remove a leg; re-links the neighbours' shared stop; refuses if the leg has actuals. |
| `POST` | `/api/shipments/[id]/legs/reorder` | Body: ordered `legId[]`. Recomputes sequences + shared stops. |
| `POST` | `/api/shipments/[id]/legs/infer` | Force an inference run now. Returns `{ proposal }` (diff) or `{ applied: true, legs }` when there was nothing to confirm. |
| `POST` | `/api/shipments/[id]/legs/infer/accept` | Body: proposalId + optional per-change opt-out. Applies the diff. |
| `POST` | `/api/shipments/[id]/legs/infer/reject` | Dismiss the proposal; records the rejection so the same diff isn't re-surfaced. |

### 8.3 Write — leg documents

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/shipments/[id]/legs/[legId]/documents` | Attach an existing `documentId` to a leg (fills a checklist row or creates an OPTIONAL row). |
| `DELETE` | `/api/shipments/[id]/legs/[legId]/documents/[legDocumentId]` | Detach — if it was a checklist row, `documentId` → null (row stays as a gap); if OPTIONAL, delete the row. |
| `PATCH` | `/api/shipments/[id]/legs/[legId]/documents/[legDocumentId]` | Change `requirement` (broker overrides "required" → "optional" with a reason). |
| `POST` | `/api/shipments/[id]/legs/[legId]/documents/checklist` | Add an expected doc slot manually. |

The existing document upload flow (`/api/documents/...` +
`DocumentUploadModal`) gains an optional `legId` param; when present, the
uploaded doc is attached to that leg on classification. When absent, the
attach service runs `matchDocumentToLeg()` and, if confident, links it;
otherwise it stays shipment-level and shows in the "unassigned" tray.

### 8.4 Events / webhooks

Add to the account webhook catalog (`AccountWebhook`):

- `shipment.leg.status_changed` — `{ shipmentId, legId, from, to, reason }`
- `shipment.leg.document.received` — `{ shipmentId, legId, expectedDocType, documentId }`
- `shipment.leg.document.missing` — fired when a leg enters `IN_TRANSIT`
  with a `REQUIRED` checklist row still unfilled
- `shipment.journey.inferred` — `{ shipmentId, runId, legCount, confidence, needsConfirmation }`

### 8.5 Validation rules (service layer)

- Reject leg writes that break contiguity or the shared-stop invariant with
  `422` + a machine-readable `code` (`LEG_SEQUENCE_GAP`,
  `LEG_STOP_MISMATCH`).
- `POST /legs` on a shipment with a confirmed journey and an open inference
  proposal → `409` ("resolve the pending proposal first").
- All timestamps ISO-8601 UTC; the client localizes with the stop's
  `timezone`.

## 9. UX

### 9.1 The Journey Ribbon (primary surface)

Replaces the flat leg list in `ShipmentTrackingPanel` (apps/custom) and
becomes the multi-leg renderer inside `ShipmentLifecycleRibbon` (apps/tms).
Shared component: `packages/ui/src/journey/JourneyRibbon.tsx`.

**Collapsed (default, always visible at top of the shipment page):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SHP-TGT-2026-001   ·   Ocean · 4 legs · 62% complete   ·   ETA Aug 31     │
│                                                                            │
│  ●━━━━━━━●━━━━━━━●───────○ ─ ─ ─ ○         [ Customs: FILED ▸ not released ] │
│  Shenzhen  Yantian  Busan   Long Beach   Rialto DC                          │
│  factory   CNYTN    KRPUS   USLAX        (import DC)                         │
│  ✓ done    ✓ done   ● now   ○ planned    ○ planned                          │
│  TRUCK     OCEAN    OCEAN   TRUCK                                            │
│  3/3 docs  4/4 docs 4/4     ⚠ 1 missing  0/1 docs                           │
└────────────────────────────────────────────────────────────────────────────┘
```

- One horizontal rail. Each **node** is a shared stop; each **segment**
  between nodes is a leg, coloured by `LegStatus` (emerald complete, brand
  blue in-transit, grey planned, red exception, amber "needs confirmation"
  hatch).
- Segment carries the mode icon (`Anchor`/`Plane`/`Truck`/`Train`) and a
  compact **doc badge**: `4/4` green, `⚠ 1 missing` amber, `0/1` grey.
- The customs rail is a **separate pill on the right**, never fused into the
  movement rail — reinforces "arrival ≠ release."
- Header line = `journeyStatus.headline` + `percentComplete` + shipment ETA.
- Horizontally scrollable on narrow viewports (min-width rail, same pattern
  as the existing `Rail` component); nodes stack to a vertical timeline
  under ~640px.

**Expanded — per-leg cards** (click a segment, or "Expand journey"):

Each leg is a card:

```
┌─ Leg 3 of 4 · OCEAN · MAIN CARRIAGE ──────────────── IN TRANSIT ─┐
│ Busan (KRPUS)  →  Los Angeles / Long Beach (USLAX)               │
│ COSCO Shipping · COSCO SHIPPING LIBRA · voyage 118E              │
│ MBL COSU7223841650   ·   Booking COSU6620149                     │
│                                                                  │
│ Departed  Aug 24, 18:40 KST (actual)                             │
│ Arriving  Aug 31, 06:00 PDT (estimated · +14h vs plan)           │
│                                                                  │
│ Documents (4)                                                    │
│   ✓ Master Bill of Lading      COSU7223841650.pdf   processed    │
│   ✓ ISF Filing                 ISF-10+2.pdf         accepted     │
│   ✓ Certificate of Origin      COO-CN.pdf           processed    │
│   ⚠ Arrival Notice             — expected before arrival —       │
│                                                                  │
│ Recent events                                                    │
│   ● Vessel departure · Busan · Aug 24 18:40 · CarrierX (ACTUAL)  │
│   ○ Vessel arrival · Long Beach · Aug 31 06:00 · ETA (ESTIMATED) │
│                                                     [ + add doc ]│
└──────────────────────────────────────────────────────────────────┘
```

- Doc rows: green check (on file), amber warning (required, missing),
  grey dot (optional/info). Click a present doc → opens it in the existing
  `DocumentWorkspacePanel`. Click a missing row → upload modal pre-scoped
  to `{ legId, expectedDocType }`.
- Exception legs show `statusReason` as a red banner with the driving
  `ExceptionItem` link.
- "Needs confirmation" legs (inference confidence < 0.6 or unconfirmed) get
  an amber ribbon + **Confirm route** / **Edit** buttons.

### 9.2 Inference review card

When `inferenceProposal` is present, a dismissible card sits above the
ribbon:

```
┌─ Qubere detected a change to this shipment's route ────────────────┐
│ Based on Arrival Notice ARR-88213.pdf (uploaded 2m ago):           │
│                                                                    │
│   + Add leg 4:  IMPORT HAULAGE · TRUCK                              │
│                 Long Beach (USLAX) → Target Import DC, Rialto CA    │
│   + Leg 4 will need:  Delivery Order, Proof of Delivery            │
│   ~ Shipment ETA:  Aug 30 → Aug 31 (from arrival notice)           │
│                                                                    │
│   Confidence 0.82                          [ Review ]  [ Accept ]  [ Dismiss ] │
└────────────────────────────────────────────────────────────────────┘
```

"Review" opens a side-by-side (current route vs proposed) with per-change
checkboxes. Nothing is written until Accept.

### 9.3 Document library — leg facet

In `ShipmentDocumentsSection`, add a leg filter/grouping toggle:

- **Group by leg** (new default for multi-leg shipments): documents nested
  under `Leg 1 · Export haulage`, … , plus a `Shipment-level` group
  (commercial invoice, packing list) and an `Unassigned` tray.
- Each group header shows `n/m required on file`, reusing the extended
  `checkRequiredDocumentTypes` output.
- Drag a doc from `Unassigned` onto a leg group → calls the attach API.
- Single-leg shipments render exactly as today (no leg chrome).

### 9.4 Shipments list / Command Center

- The shipments table gains a compact journey sparkline (the collapsed rail,
  ~120px) in place of the single status chip for multi-leg shipments.
- "My Work" attention rules gain: *leg entering transit with a required doc
  missing*, *leg exception*, *unconfirmed inferred route older than 24h*.

### 9.5 Empty / degraded states

- No transport documents yet → ribbon shows a single greyed "Main carriage"
  placeholder leg with "Add a bill of lading or let Qubere infer the route
  from documents." (Never invent legs with zero evidence.)
- Inference failed / low confidence across the board → ribbon renders what
  it has, every leg amber "needs confirmation," a single "Build route
  manually" CTA.
- Tracking feed stale → legs keep last known status with a "last updated N h
  ago" stamp; no status is advanced on inference alone.

### 9.6 Accessibility

- The rail is a `<ol>`; each leg an `<li>` with an accessible name
  ("Leg 3 of 4, ocean, Busan to Long Beach, in transit, 1 document
  missing"). Status is never colour-only — icon + text label always.
- Keyboard: arrow keys move between legs, `Enter` expands, matches the
  existing `<details>` pattern.

## 10. Telemetry & edge cases

- Emit `journey_inference_run` (shipmentId, legCount, confidence, durationMs,
  model, acceptedByBroker, changedLegs) → feeds the F15 eval harness.
- Track `leg_doc_missing_at_transit` rate as a broker-readiness KPI.
- **Edge cases to handle explicitly:**
  - Same physical vessel, two voyage numbers (transship on one carrier) →
    still two legs, shared hub stop.
  - Container mismatch between MBL and arrival notice → flag on the leg,
    don't auto-resolve.
  - Shipment mode `Ocean` but only an AWB document → inference surfaces the
    conflict, doesn't silently pick one.
  - Consolidated shipment (one MBL, many HBLs) → v1: legs modeled once at
    the master level; house-level split is §11.
  - Re-export / T&E (entry type 51/52) → `IMPORT_HAULAGE` leg may be a
    bonded move to another port; `role = "BONDED_MOVE"` on the stop.

## 11. Future work (explicitly out of scope for v1)

- `legId` on `ShipmentCharge` / `ShipmentCost` for per-leg P&L.
- Consolidation: house shipments as child legs of a master ocean leg
  (`Shipment.masterShipmentId` already exists — wire legs through it).
- Split delivery: one leg → multiple destination stops (parcel / LTL
  final mile).
- Carrier API auto-population of legs (DCSA / Project44 / Freightos).
- Per-leg emissions (CO₂e) once leg distance + mode + weight are all known.

## 12. Rollout plan

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 | Schema + backfill (§5), read-through kept on old models | Backfill runs clean on demo DB; projections still render |
| 1 | `JourneyProjection` API + `JourneyRibbon` (read-only, collapsed + expanded) behind a flag | Ribbon renders real seeded multi-leg shipment in both apps |
| 2 | Inference engine (§6) + review card, manual leg CRUD | Broker can accept/reject a proposal; invariants tested |
| 3 | Leg documents (§5.3, §8.3) + document-library leg facet | "1 missing on the import leg" is visible and actionable |
| 4 | Webhooks, list-view sparkline, attention rules; drop old models | Old tables dropped; no read references remain |

## 13. Seed data (demo)

Script: `apps/custom/scripts/seed-multileg-demo.ts` (idempotent).

Target: **`SHP-TGT-2026-001`** on the **Target** account
(`cmt4zah2s000hfx0odci3e658`) — `multirole@qubere.ai` (Frank) has OWNER
membership there, so it shows for the demo login. Client: Target
Corporation. Carrier: COSCO Shipping. Mode: Ocean. POE: 2704 Los
Angeles/Long Beach.

Because `ShipmentLeg` / `ShipmentLegDocument` don't exist yet, the seed
populates the **interim** models that today's `ShipmentTrackingPanel`
already renders — `TransportLeg`, `ShipmentStop`, `ShipmentTrackingIdentifier`,
`TrackingEvent`, `EtaObservation`, `TrackingSubscription`,
`ComplianceDeadline` — plus per-leg `ShipmentDocument` rows whose
`docType` + `fileName` make the leg grouping obvious. The backfill in §5.5
maps every one of these rows forward to `ShipmentLeg` 1:1.

**Seeded journey — 4 legs, one end-to-end `shipmentId`:**

| # | Leg | Mode | From → To | Carrier / conveyance | Status | Docs |
|---|---|---|---|---|---|---|
| 1 | Export haulage | TRUCK | Shenzhen factory (Longgang) → Yantian Port (CNYTN) | Sinotrans (drayage) | COMPLETED | Booking Confirmation, Shipping Instructions, Packing List |
| 2 | Main carriage A | OCEAN | Yantian (CNYTN) → Busan (KRPUS) transshipment | COSCO SHIPPING ARIES · voy 072E | COMPLETED | Master Bill of Lading, ISF 10+2 |
| 3 | Main carriage B | OCEAN | Busan (KRPUS) → Los Angeles/Long Beach (USLAX) | COSCO SHIPPING LIBRA · voy 118E | IN_TRANSIT | (shares MBL), Certificate of Origin, **Arrival Notice — missing** |
| 4 | Import haulage | TRUCK | APM Terminals Pier 400 (USLAX) → Target Import DC, Rialto CA | Hub Group (drayage) | NOT_STARTED | **Delivery Order — missing**, CBP 7501/Release, Proof of Delivery — pending |

**Shared stops** (transshipment legible): Yantian is leg 1's destination and
leg 2's origin; Busan is leg 2's destination and leg 3's origin; Long Beach
is leg 3's destination and leg 4's origin.

**Tracking identifiers:** BOOKING `COSU6620149`, MBL `COSU7223841650`,
HBL `SNKO2208841`, CONTAINER `CBHU8842190` + `TCLU7761334` (2× 40HC).

**Events:** booking confirmed → gate-in Yantian → loaded → vessel departure
Yantian (ACTUAL) → vessel arrival Busan (ACTUAL) → discharged Busan → loaded
Busan → vessel departure Busan (ACTUAL) → vessel arrival Long Beach
(ESTIMATED, Aug 31) → (planned) discharge / gate-out / delivery Rialto.

**ETA observations:** 2 rows on the ocean legs showing a +14h drift into
Long Beach.

**Deadlines:** ISF 10+2 → SATISFIED; ENTRY_FILING → OPEN (due Aug 31 + 15d);
LAST_FREE_DAY → OPEN (Sep 3, commercial).

**Customs rail:** `CustomsFiling.filingStatus` left as-is (FILED / not
released) so the demo shows the movement rail and the customs rail
legitimately disagreeing — the ocean leg is about to arrive while the entry
is not yet released.

## 14. Open questions

1. **`TransportLeg` vs `Movement` conflict resolution** during backfill for
   the handful of shipments that have both — confirm "customs journey wins"
   with TMS.
2. Should `TRANSSHIPMENT` be its own `LegType` or just a `MAIN_CARRIAGE` leg
   with a `transship = true` flag? (Leaning separate type for ribbon
   clarity — see §5.1.)
3. Do we expose per-leg ETA to the **customer portal**, or only the final
   destination ETA? (Portal PR #97 context — default to final only, opt-in
   per client.)
4. Inference cadence: debounce window and whether to re-infer on tracking
   events (not just documents).

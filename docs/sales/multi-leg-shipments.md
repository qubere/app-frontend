# Multi-leg Shipments — sales demo guide

**One-liner:** A real import move is factory → export drayage → origin port →
main vessel → (transshipment) → destination port → import drayage → DC — and
Qubere models it as one canonical leg structure that both the customs app and the
freight app read from, with a per-leg document checklist, rule-based route
inference from the documents already uploaded, and a journey ribbon that shows
per-leg status, per-leg document completeness, and per-leg ETA without collapsing
the whole thing into one status.

**Who to sell it to:** **freight forwarders, 3PLs, and brokers handling ocean
imports with transshipment.** The pain is sharpest where a shipment has 3+ legs,
different carriers per leg, and documents that belong to specific legs.

> **Maturity note:** Phase 1 shipped (PR #107). What's real: the canonical
> `ShipmentLeg` model + migration, rule-based inference (`model: "rules-v1"`,
> idempotent, never invents carrier/vessel values), per-leg document slots, the
> journey ribbon component, leg CRUD/reorder/infer/accept API routes (all
> tenant-scoped, permission-gated, transactional), and a non-destructive demo
> seed on `SHP-TGT-2026-001`. Not in scope: real-time carrier tracking
> integrations, last-mile parcel legs, converging the TMS freight-ops movement
> model onto `ShipmentLeg` (that's a separate epic).

---

## The problem, in the customer's words

- "Our system links a document to a shipment. It can't tell me 'the ocean leg is
  missing its master bill' vs 'the import leg is missing its delivery order' —
  it's one flat pile."
- "The customs team and the freight team show different leg counts for the same
  container because they're populated by different pipelines."
- "The status ribbon says 'Arrived.' The import drayage hasn't even started. You
  only see that if you expand."
- "A broker uploads eight documents and still hand-builds the route every time."
- "'Arrived at destination port' is not 'released by customs' — but our tools
  blur the two."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **One canonical leg model** | `ShipmentLeg` is the single source both apps read. One `shipmentId` stays the durable end-to-end identifier — legs hang off it, they never fragment it. No more two leg models that disagree. | Open `SHP-TGT-2026-001` → the journey ribbon. Explain: the customs view and the TMS view derive from the same legs. |
| **Per-leg documents** | A `ShipmentLegDocument` join: one document can belong to one or more legs (an MBL covering an ocean leg + its transshipment leg), while shipment-level documents (commercial invoice, packing list) stay at the shipment. Each leg has stable document *slots* (booking confirmation, shipping instructions, arrival notice, delivery order, POD). | On the ribbon, expand a leg → its document checklist with filled and empty slots. Attach a document to a slot with the real document picker. |
| **Rule-based route inference** | From the documents on a shipment, Qubere proposes (a) how many legs, their mode, endpoints, and sequence, and (b) the required document set per leg. Deterministic (`rules-v1`), idempotent (keyed on a SHA-256 of the inputs), and it **never invents** a carrier or vessel it can't derive — those stay null for the broker to confirm. | On a shipment with documents but no legs → **Infer legs** → the proposal card. Accept it → the legs are created transactionally. |
| **Broker confirms, inference never commits silently** | The proposal is a diff you accept or edit. Inference never files anything or commits a route on its own. | Show the accept/reject on the inference proposal. |
| **Journey ribbon** | The full end-to-end route: per-leg status (physical), per-leg document completeness, per-leg ETA — without collapsing a multi-leg shipment into one status. | The ribbon on `SHP-TGT-2026-001` — a leg that's arrived next to a leg that hasn't started, both visible. |
| **Three status levels that never contradict** | Leg status (physical), shipment movement rollup (derived), and customs clearance (an independent rail). An arrival never implies a release. | Point at the ribbon: the movement rail shows "Arrived," the customs rail independently shows "In review." |
| **Leg management** | Add, reorder (transactional re-sequencing under any permutation), edit legs — with mode-lock, actuals, and reorder guardrails. Write-gated by `shipments.manage`, tenant-scoped, zod-validated. | Add a transport leg, reorder two legs, show the sequence stays consistent. |
| **Backfill from existing data** | `TransportLeg` rows migrate to `ShipmentLeg` + synthesised stops via a dry-run-by-default script. | Mention for a prospect with existing shipment history. |

---

## Talking points

- **"Documents belong to legs, not just shipments."** This is the concrete thing
  competitors don't do. "Which leg is missing which document" is answerable at a
  glance.
- **"The route infers itself from the paperwork you already have."** Bill types,
  port pairs, vessel names, container numbers — the raw material to propose the
  structure is in the documents. Qubere proposes; the broker confirms.
- **"Arrival is not release."** The independent customs rail is a correctness
  stance — the ribbon will never let "arrived at port" masquerade as "cleared."
- **"One leg model, both apps."** For a customer running Qubere for customs *and*
  freight, the leg count is the same on both sides because it's the same data.

## Objection handling

- **"Do you integrate with carrier tracking / Project44 / ocean visibility
  providers?"** Not in this phase. Inference and the ribbon consume whatever
  tracking events already arrive on the shipment. Adding visibility providers is
  a defined next step, not a current capability.
- **"How accurate is the inference?"** It's deterministic rule logic, not a
  model — it proposes leg structure and document checklists from document types,
  port pairs, and reference numbers, and it's conservative: anything it can't
  derive (carrier, vessel) is left blank for you. It's a head-start, not an
  autopilot.
- **"Can one container split into multiple downstream shipments?"** Sub-shipment
  splitting / one-to-many is explicitly a non-goal for now.
- **"What about air / truck / rail?"** The model is mode-aware (the demo is
  ocean); the same structure applies to multimodal moves.

## Demo setup

```bash
npx tsx apps/custom/scripts/seed-multileg-demo.ts   # non-destructive, seeds SHP-TGT-2026-001
```

Use `joe@target.com` or `admin@target.com`. Have `SHP-TGT-2026-001` with its
seeded journey for the ribbon, and a second shipment with documents but no legs
for the live inference demo.

**Deeper reference:** `docs/plans/features/MULTI-LEG-SHIPMENTS.md` (design, API,
UX, and the exact Phase 1 deltas).

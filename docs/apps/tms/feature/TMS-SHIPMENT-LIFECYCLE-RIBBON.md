# Shipment Lifecycle Ribbon (TMS) — Implementation Prompt

Status: proposed, not yet built
Owner: TMS shipment detail page
Written: 2026-08-23

This doc is the implementation brief for the shipment-lifecycle status
ribbon on the TMS shipment detail page. It's written to be handed directly
to a coding agent (e.g. Antigravity) — paste the body below as the task
prompt.

---

## Feature: Shipment Lifecycle Ribbon (TMS)

### Goal
Add a shipment-lifecycle status ribbon to the TMS shipment detail page
(apps/tms/src/app/shipments/[id]/ShipmentWorkspaceClient.tsx), showing the
shipment's progress through 9 stages, each expandable for detail. This is
distinct from the existing TmsPipelineProgressRibbon.tsx, which tracks
AI-agent document-processing steps — do not touch or repurpose that
component. Place the new ribbon above it in the page (higher-level status
first, processing detail below).

Stages (display labels — keep these exact):
1. Draft / Order Created
2. Sourcing / Tendering
3. Booked / Scheduled
4. Customs Cleared
5. Dispatched / At Pickup
6. In Transit
7. Arrived
8. Delivered / POD Uploaded
9. Audited & Settled

(Note: "Out for Delivery" from the original 9-stage draft is intentionally
dropped/merged into "Arrived" — this is FTL/LTL freight brokerage, not
last-mile parcel, and there's no data source for a separate
out-for-delivery state. Confirm with product before re-adding it.)

### Architectural decision — READ THIS FIRST
Do NOT add a new free-text `status` field to drive this ribbon. The
Shipment.status column already drifted into inconsistent literals
("Completed", "DELIVERED", "Delivered with Exception") because nothing
enforces it — a second status column for the ribbon would rot the same way
and disagree with the source-of-truth tables it's supposed to summarize.

Instead, compute the ribbon stage server-side by reading the actual
lifecycle tables listed below, in shipmentWorkspaceService.ts (or a new
sibling module, e.g. shipmentLifecycleStatus.ts, if you want it isolated).
Return the computed stage as part of the existing shipment workspace
payload — no new polling/SSE endpoint is needed, since lifecycle stage
changes are infrequent (unlike the AI pipeline, which needs live updates).

### Data model — what already exists (verified against
packages/db/prisma/schema.prisma)

| Stage | Source | Field / logic |
|---|---|---|
| 1. Draft/Order Created | `Shipment` | `status === "Draft"` (default) |
| 2. Sourcing/Tendering | `Tender` | latest `Tender.status` for this `shipmentId` in `DRAFT\|SENT` |
| 3. Booked/Scheduled | `Tender` + `Movement` | `Tender.status === "ACCEPTED"` and/or `Movement.status === "BOOKED"` via `ShipmentMovement` join |
| 4. Customs Cleared | `CustomsFiling` | `CustomsFiling.filingStatus === "Released"` for this shipment (field already supports this exact value — see schema.prisma:1379) |
| 5. Dispatched/At Pickup | `Movement` | see "Open gap" below |
| 6. In Transit | `Movement` | `Movement.status === "IN_TRANSIT"` |
| 7. Arrived | `Movement` | `Movement.status === "ARRIVED"` |
| 8. Delivered/POD Uploaded | `ProofOfDelivery` + `Movement` | `ProofOfDelivery` row exists for shipment OR `Movement.status` in `DELIVERED\|COMPLETED` |
| 9. Audited & Settled | `CarrierInvoice` | see "Open gap" below |

A shipment can have multiple `Movement`s (multi-leg/multimodal, via
`ShipmentMovement` join table). Roll up to the single most-advanced
movement's stage for the top-level ribbon dot, but let each stage expand
to show per-movement detail when there's more than one movement — do not
silently collapse multi-leg shipments into one undifferentiated status.

### Open gaps — resolve before or during implementation, don't guess silently

**Stage 5 "Dispatched/At Pickup" has no dedicated field.**
`Movement.status` enum is `PLANNED|BOOKED|IN_TRANSIT|ARRIVED|DELIVERED|
COMPLETED|CANCELLED|DELAYED` — no DISPATCHED value. `drayageTelematicsService.ts`
already emits a DISPATCHED-like signal in a narrower context — check it
first. Recommended default (confirm with product, don't just assume):
derive "Dispatched" from `Movement.actualStart` being set while
`Movement.status` is still `BOOKED` (driver/truck moving but not yet
flipped to IN_TRANSIT in the tracking feed). If that timing doesn't hold
up in practice, this may need a genuine new signal — flag it back rather
than faking the distinction.

**Stage 9 "Settled" has zero backing anywhere in the schema.**
`CarrierInvoice.matchStatus` (`PENDING|MATCHED|DISPUTED|EXCEPTION`) covers
"Audited" only — there is no payment/settlement field on `CarrierInvoice`
or elsewhere for carrier payment (don't confuse this with
`CustomsFiling.paymentStatus`, which is duty payment to customs, a
completely different flow). This needs an actual migration:

```prisma
model CarrierInvoice {
  ...
  settlementStatus String    @default("PENDING") // PENDING | SCHEDULED | PAID
  settledAt        DateTime?
}
```
Add the migration, and a write path (even a manual "mark settled" action
in the UI is fine for v1 — don't build a payment integration you weren't
asked for). "Audited & Settled" stage = `matchStatus === "MATCHED"` AND
`settlementStatus === "PAID"`.

### API
Add the computed lifecycle stage to the existing shipment fetch used by
ShipmentWorkspaceClient (wherever that payload is assembled server-side —
check shipmentWorkspaceService.ts). Shape:

```ts
type ShipmentLifecycleStatus = {
  currentStageIndex: number; // 0-8
  stages: Array<{
    index: number;
    label: string;
    state: "COMPLETE" | "ACTIVE" | "UPCOMING" | "BLOCKED";
    detail: string | null;       // one-line human summary for this stage
    movements?: Array<{ movementId: string; mode: string; status: string }>; // only when >1 movement
  }>;
};
```
No new REST endpoint required unless you find another surface (e.g. a
shipments list view) that needs the ribbon summary independently — if so,
factor the computation into a shared function and expose it there too,
rather than duplicating the derivation logic inline in two places.

### UX
New component: `apps/tms/src/components/ShipmentLifecycleRibbon.tsx`.
Match the existing visual language from TmsPipelineProgressRibbon.tsx
(rounded-2xl border, Card/Badge/Button from @/components/ui, same color
conventions: emerald = complete, brand blue = active, red = blocked, gray
= upcoming) but render as a horizontal linear stage track (9 dots/segments
in sequence), not the processing-step grid that component uses — this is
a different visual metaphor (linear journey vs. parallel agent steps).
Each stage is expandable (reuse the `<details>` pattern already used in
TmsPipelineProgressRibbon.tsx) to show the `detail` string and, for
multi-leg shipments, the per-movement breakdown.

Blocked state: if a stage can't be reached because an upstream one failed
or stalled (e.g. customs filing rejected, movement cancelled), show it as
BLOCKED with the reason, not just skip it silently.

### Guardrails
- Don't touch TmsPipelineProgressRibbon.tsx, tmsPipelineOrchestrator.ts, or
  anything under apps/tms/src/modules/agents/ — that's the AI-agent
  pipeline, a separate concern.
- Don't add a new Shipment.status enum/value for this — compute, don't store.
- All queries must stay scoped by accountId, consistent with every other
  model in this schema (multi-tenant).
- Read node_modules/next/dist/docs/ for any Next.js API you're unsure of —
  this repo runs a modified Next.js and training-data conventions may not
  apply (see AGENTS.md).

### Definition of done
- Migration for `CarrierInvoice.settlementStatus`/`settledAt` written and
  applied.
- Lifecycle stage computed server-side and included in the shipment
  workspace payload.
- ShipmentLifecycleRibbon.tsx renders on the shipment detail page above
  TmsPipelineProgressRibbon, correctly reflecting real data for: a
  draft-only shipment, a booked single-leg shipment, a multi-leg shipment
  mid-transit, and a delivered+settled shipment.
- Verified in the browser against real seeded data, not just types.

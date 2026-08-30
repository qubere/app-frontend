# Qubere Multi-Leg Shipments — Sales Product Guide

> Audience: Forwarders · brokers · multimodal operations. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Keep master/house relationships, transport legs, tracking events, and customs context connected.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Master / House Relationships

**Demo readiness:** Available now

### Customer pain

Consolidations create separate master and house records that drift apart across operations and customs.

### Customer benefit

Qubere links house shipments to the correct master while preserving tenant validation and each house's own customs work.

### How to demo

1. Create shipment
2. select master shipment
3. open master
4. show house relationships
5. open one house record.

**What to say:** “Qubere links house shipments to the correct master while preserving tenant validation and each house's own customs work.”

## Sequenced Transport Legs

**Demo readiness:** Available now

### Customer pain

A multimodal shipment becomes a flat list of events with no clear connection between origin pickup, port, air/ocean, and delivery.

### Customer benefit

Ordered transport legs capture mode, origin, destination, schedule, actuals, carrier references, and status.

### How to demo

1. Open shipment
2. Tracking
3. expand legs
4. compare scheduled vs actual milestones and carrier references.

**What to say:** “Ordered transport legs capture mode, origin, destination, schedule, actuals, carrier references, and status.”

## Unified Tracking Timeline

**Demo readiness:** Available now

### Customer pain

Carrier events use inconsistent names and timestamps, making it hard to explain where a shipment is now.

### Customer benefit

Normalized tracking events produce a single movement status, next stop, latest event, and projected route.

### How to demo

1. Open shipment
2. Tracking
3. show latest event, next stop, normalized timeline, and source references.

**What to say:** “Normalized tracking events produce a single movement status, next stop, latest event, and projected route.”

## Shared Documents, Separate Decisions

**Demo readiness:** Architecture — seed required

### Customer pain

Teams either duplicate consolidation documents across houses or accidentally share house-specific data too broadly.

### Customer benefit

Documents can stay linked to the correct operational object while each house retains its own parties, line items, compliance, and filing decisions.

### How to demo

1. Open master and house records side by side
2. compare document lists
3. show house-specific extracted facts and filing readiness.

**What to say:** “Documents can stay linked to the correct operational object while each house retains its own parties, line items, compliance, and filing decisions.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `packages/db/prisma/schema.prisma`
- `apps/custom/src/modules/tracking/shipmentTracking.ts`
- `apps/custom/src/app/app/shipments/[id]/ShipmentTrackingPanel.tsx`
- `apps/custom/src/app/api/shipments/route.ts`

## Sales guardrails

- Master/house linkage and transport-leg tracking are code-backed, but the shared-document story requires suitable seeded consolidation data.
- Do not imply that master and house customs decisions are merged; house-level context remains distinct.


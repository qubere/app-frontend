# Qubere Billing — Sales Product Guide

> Audience: Broker owners · finance · billing operations. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Convert operational work into explainable charges, protected margin, and controlled invoices.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Versioned Rate Cards

**Demo readiness:** Available now

### Customer pain

Rates live in conflicting spreadsheets, and nobody can prove which version applied to a shipment.

### Customer benefit

Importable, versioned rate cards have draft, active, expired, and retired lifecycles with auditable rule detail.

### How to demo

1. Billing
2. Rate Cards
3. import sample CSV
4. map events
5. open version history
6. activate the draft.

**What to say:** “Importable, versioned rate cards have draft, active, expired, and retired lifecycles with auditable rule detail.”

## Usage-to-Charge Automation

**Demo readiness:** Available now

### Customer pain

Completed work never reaches billing because operations and finance rely on memory and manual entry.

### Customer benefit

Operational events emit idempotent usage records that rate automatically into explainable shipment charges.

### How to demo

1. Billing
2. Usage Ledger
3. open an event
4. trace event
5. rule
6. calculation
7. charge.

**What to say:** “Operational events emit idempotent usage records that rate automatically into explainable shipment charges.”

## Shipment Economics

**Demo readiness:** Available now

### Customer pain

Duty and pass-throughs are mixed with broker revenue, hiding what the brokerage actually earned.

### Customer benefit

A three-layer shipment ledger separates customs economics, broker revenue/cost, and client receivables.

### How to demo

1. Billing
2. Shipments
3. open a shipment
4. show customs, broker, and AR sections
5. drill into a charge.

**What to say:** “A three-layer shipment ledger separates customs economics, broker revenue/cost, and client receivables.”

## Exceptions & Revenue Leakage

**Demo readiness:** Available now

### Customer pain

Unmapped rates, unbilled work, and negative-margin files are discovered long after the invoice cycle.

### Customer benefit

Billing exceptions identify leakage as it happens and provide resolve/waive actions with reasons and audit.

### How to demo

1. Billing
2. Exceptions & Leakage
3. filter Open
4. open a negative-margin item
5. resolve or waive
6. show audit.

**What to say:** “Billing exceptions identify leakage as it happens and provide resolve/waive actions with reasons and audit.”

## Invoices, Approval & AR

**Demo readiness:** Available now

### Customer pain

Invoice creation, approval, and payment tracking happen outside the operational evidence that created the charge.

### Customer benefit

Qubere builds invoices from eligible charges, enforces maker-checker permissions, exports artifacts, and records payments.

### How to demo

1. Billing
2. Invoices
3. create from unbilled charges
4. submit for approval
5. show distinct approver permission
6. record payment.

**What to say:** “Qubere builds invoices from eligible charges, enforces maker-checker permissions, exports artifacts, and records payments.”

## Rate Simulation & Reporting

**Demo readiness:** Available now

### Customer pain

Rate renewal and profitability analysis require days of spreadsheet reconstruction.

### Customer benefit

Simulate proposed pricing against historical usage and compare revenue, margin, and service-level deltas without touching production charges.

### How to demo

1. Rate Cards
2. open draft
3. Simulate
4. select historical period
5. run
6. compare current and proposed results.

**What to say:** “Simulate proposed pricing against historical usage and compare revenue, margin, and service-level deltas without touching production charges.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/app/billing`
- `packages/billing/src`
- `apps/custom/scripts/seed-billing-demo.ts`
- `docs/sales/BILLING-QE-PM-SALES-ASSESSMENT-AND-DEMO-PLAYBOOK.md`

## Sales guardrails

- Do not invent ROI, accuracy, throughput, or risk-reduction percentages. Use the prospect’s baseline and approved Qubere evidence.
- If seeded data or an external connector is absent, explain the intended flow and use the product deck rather than pretending the live action completed.


# Qubere Customs — Sales Product Guide

> Audience: Customs brokers · import operations. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Move an entry from shipment intake to filing readiness in one connected workspace.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Shipment Workbench

**Demo readiness:** Available now

### Customer pain

Entry writers lose time reconstructing a shipment across email, shared drives, and disconnected filing screens.

### Customer benefit

Qubere brings documents, parties, line items, exceptions, agent progress, tracking, and readiness into one shipment record.

### How to demo

1. Operations
2. Shipments
3. open a shipment
4. move through Overview, Documents, Line Items, Compliance, Filing, and Audit.

**What to say:** “Qubere brings documents, parties, line items, exceptions, agent progress, tracking, and readiness into one shipment record.”

## Filing Readiness

**Demo readiness:** Available now

### Customer pain

Teams discover missing data late—after someone has already started an entry or attempted submission.

### Customer benefit

A dependency-aware readiness gate shows what is missing, why it matters, and which action unlocks filing.

### How to demo

1. Open a shipment
2. Pre-filing readiness
3. click a blocker
4. complete the linked action
5. show the score update.

**What to say:** “A dependency-aware readiness gate shows what is missing, why it matters, and which action unlocks filing.”

## Dynamic Entry Workspace

**Demo readiness:** Available now

### Customer pain

Rigid forms make new countries, procedures, and PGA requirements slow and expensive to support.

### Customer benefit

Schema-driven filing screens render the correct sections, validations, and line-item structures for the destination and procedure.

### How to demo

1. Customs Filing
2. New filing
3. select shipment and procedure
4. show dynamic tabs, validations, auto-save, and line items.

**What to say:** “Schema-driven filing screens render the correct sections, validations, and line-item structures for the destination and procedure.”

## ABI / ACE Messaging

**Demo readiness:** Available now

### Customer pain

Submission responses are scattered across a separate ABI tool, making rejects and follow-up hard to coordinate.

### Customer benefit

Qubere centralizes outbound filing messages, CBP acknowledgements, rejects, holds, and the work they create.

### How to demo

1. Customs Filing
2. open an entry
3. Messages
4. show outbound batch, response timeline, reject details, and resulting action.

**What to say:** “Qubere centralizes outbound filing messages, CBP acknowledgements, rejects, holds, and the work they create.”

## Post-Entry Management

**Demo readiness:** Available now

### Customer pain

PSC, protest, drawback, and reconciliation deadlines sit in spreadsheets until a statutory clock is missed.

### Customer benefit

One post-entry hub tracks eligible recovery work, case status, evidence, owners, and deadlines.

### How to demo

1. Operations
2. Post Entry
3. open PSC or Protest
4. show deadline rail, linked filing, evidence, workflow state, and audit.

**What to say:** “One post-entry hub tracks eligible recovery work, case status, evidence, owners, and deadlines.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/app/shipments`
- `apps/custom/src/app/app/filing`
- `apps/custom/src/app/app/post-entry`
- `apps/custom/src/modules/agents/filingReadinessAgent.ts`
- `apps/custom/src/modules/filings`

## Sales guardrails

- Describe ABI/ACE as available through configured connectivity. Do not imply a prospect can submit to CBP from an unconfigured demo tenant.
- Avoid quoting extraction or filing accuracy percentages unless supported by an approved customer dataset.


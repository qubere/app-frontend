# Qubere Document Management — Sales Product Guide

> Audience: Document operations · brokers · shared services. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Turn every inbound trade document into trusted, linked, searchable operational data.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Multi-Channel Intake

**Demo readiness:** Available now

### Customer pain

Files arrive through email, upload, portal, API, and shared drives with inconsistent naming and context.

### Customer benefit

Qubere normalizes every intake channel into one tenant-scoped document record with source and processing history.

### How to demo

1. Docs
2. upload a document or show inbound email
3. open the resulting record
4. show source, timestamps, and processing run.

**What to say:** “Qubere normalizes every intake channel into one tenant-scoped document record with source and processing history.”

## Classification & Extraction

**Demo readiness:** Available now

### Customer pain

Operators must open every attachment just to determine its type and what data it contains.

### Customer benefit

Document type classification and field extraction convert files into evidence-backed facts for downstream work.

### How to demo

1. Open a processed document
2. show detected type
3. extracted fields
4. confidence
5. page/region evidence.

**What to say:** “Document type classification and field extraction convert files into evidence-backed facts for downstream work.”

## Shipment Linking & Missing Docs

**Demo readiness:** Available now

### Customer pain

Documents exist, but staff still spend time asking which shipment they belong to and what is absent.

### Customer benefit

Automatic matching proposes shipment links, while required-document checks expose gaps before filing.

### How to demo

1. Docs
2. filter Unattached
3. attach one document
4. open shipment
5. show missing-document state update.

**What to say:** “Automatic matching proposes shipment links, while required-document checks expose gaps before filing.”

## Field Review & Corrections

**Demo readiness:** Available now

### Customer pain

Silent extraction errors can propagate into classification, valuation, compliance, and filing.

### Customer benefit

Reviewers see low-confidence or conflicting fields, correct them in context, and preserve both original evidence and final decision.

### How to demo

1. Open document
2. Review fields
3. correct a value
4. save
5. show audit and downstream canonical fact.

**What to say:** “Reviewers see low-confidence or conflicting fields, correct them in context, and preserve both original evidence and final decision.”

## Quarantine, Duplicates & Vault

**Demo readiness:** Available now

### Customer pain

Unknown senders, repeated attachments, and risky files pollute the queue and weaken record control.

### Customer benefit

Quarantine review, content hashing, malware status, retention, and a searchable vault protect the source record.

### How to demo

1. Docs
2. Quarantine
3. release or discard
4. open Vault
5. search by filename, party, or shipment
6. show duplicate signal.

**What to say:** “Quarantine review, content hashing, malware status, retention, and a searchable vault protect the source record.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/app/documents`
- `apps/custom/src/modules/documents`
- `apps/custom/src/modules/intake`
- `apps/custom/src/modules/inbound`

## Sales guardrails

- Do not invent ROI, accuracy, throughput, or risk-reduction percentages. Use the prospect’s baseline and approved Qubere evidence.
- If seeded data or an external connector is absent, explain the intended flow and use the product deck rather than pretending the live action completed.


# Qubere Security — Sales Product Guide

> Audience: Security · IT · compliance buyers. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Protect tenant data and sensitive trade actions without slowing operators down.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Granular Role-Based Access

**Demo readiness:** Available now

### Customer pain

Broad admin/member roles let too many people approve, file, export, or change high-risk settings.

### Customer benefit

Atomic permissions and configurable roles separate operators, reviewers, approvers, billing, and administrators.

### How to demo

1. Manage Account
2. Roles & Permissions
3. open a role
4. filter by domain
5. show explicit permissions and category grants.

**What to say:** “Atomic permissions and configurable roles separate operators, reviewers, approvers, billing, and administrators.”

## Tenant Isolation

**Demo readiness:** Available now

### Customer pain

Multi-client brokerage systems become unacceptable if one account can see another account's parties, documents, or filings.

### Customer benefit

Account-scoped queries, tenant-owned evidence, and fail-closed service checks keep data boundaries explicit throughout the stack.

### How to demo

1. Show account switcher
2. open the same module in two accounts
3. demonstrate separate data and unavailable cross-account IDs.

**What to say:** “Account-scoped queries, tenant-owned evidence, and fail-closed service checks keep data boundaries explicit throughout the stack.”

## Immutable Audit Trails

**Demo readiness:** Available now

### Customer pain

When regulators or customers ask who changed what, teams reconstruct the answer from inboxes and database timestamps.

### Customer benefit

Administrative, compliance, filing, billing, and AI actions record actor, effective actor, time, source, and bounded metadata.

### How to demo

1. Manage Account
2. Settings & Audit
3. search an action
4. open details
5. connect it to the underlying record.

**What to say:** “Administrative, compliance, filing, billing, and AI actions record actor, effective actor, time, source, and bounded metadata.”

## Secure Document Intake

**Demo readiness:** Available now

### Customer pain

Inbound email and uploads can introduce malware, spoofed senders, duplicate files, and documents routed to the wrong client.

### Customer benefit

Authorized-sender routing, quarantine, malware policy, duplicate detection, and controlled release protect the document pipeline.

### How to demo

1. Docs
2. Quarantine
3. open an unknown-sender email
4. inspect attachments
5. release, discard, or block sender
6. show audit.

**What to say:** “Authorized-sender routing, quarantine, malware policy, duplicate detection, and controlled release protect the document pipeline.”

## API & Integration Controls

**Demo readiness:** Available now

### Customer pain

Integration credentials and API access sprawl without a tenant-specific control plane.

### Customer benefit

Per-account integration configuration, encrypted credentials, API key controls, and audit history reduce shared-secret risk.

### How to demo

1. Manage Account
2. Settings
3. Integrations & APIs
4. show enabled connectors, credential state, scopes, and audit.

**What to say:** “Per-account integration configuration, encrypted credentials, API key controls, and audit history reduce shared-secret risk.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `packages/auth/src/permissions.ts`
- `packages/auth/src/authorization-service.ts`
- `packages/auth/src/audit-service.ts`
- `apps/custom/src/app/app/admin`
- `apps/custom/src/modules/documents/processing/malwarePolicy.ts`

## Sales guardrails

- Do not invent ROI, accuracy, throughput, or risk-reduction percentages. Use the prospect’s baseline and approved Qubere evidence.
- If seeded data or an external connector is absent, explain the intended flow and use the product deck rather than pretending the live action completed.


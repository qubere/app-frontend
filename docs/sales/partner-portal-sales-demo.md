# Qubere Partner Portal — Sales Product Guide

> Audience: Brokerage customers · partners · operations. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Collect clean inputs from clients and partners without turning every request into an email chase.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Secure Document Requests

**Demo readiness:** Available now

### Customer pain

Clients send documents to individual inboxes, omit shipment references, and ask whether files were received.

### Customer benefit

Tokenized upload links let an external partner submit documents directly into the correct controlled workflow.

### How to demo

1. Create or open a request
2. copy secure upload link
3. open in a private window
4. upload a sample
5. show it arrive in Docs.

**What to say:** “Tokenized upload links let an external partner submit documents directly into the correct controlled workflow.”

## Questions & Missing Information

**Demo readiness:** Partial — controlled requests

### Customer pain

Entry writers ask follow-up questions in email threads that are disconnected from the shipment and hard to audit.

### Customer benefit

Structured requests tie the question, response, evidence, and responsible partner to the underlying shipment.

### How to demo

1. Open shipment
2. Documents / Actions
3. create a controlled document request
4. show the secure upload response
5. explain that structured free-text answers remain partial.

**What to say:** “Structured requests tie the question, response, evidence, and responsible partner to the underlying shipment.”

## Status Visibility

**Demo readiness:** Roadmap — do not demo as live

### Customer pain

Clients repeatedly ask whether documents were received, the entry was filed, or a hold is blocking release.

### Customer benefit

A controlled external status view reduces calls while keeping internal notes and sensitive compliance reasoning private.

### How to demo

1. Use this product-faithful slide only
2. explain the planned external milestone view
3. do not navigate to or claim a live status portal.

**What to say:** “A controlled external status view reduces calls while keeping internal notes and sensitive compliance reasoning private.”

## Invitation & Workspace Access

**Demo readiness:** Available now

### Customer pain

Onboarding users through one-off admin work leads to wrong roles, stale access, and confusing first sessions.

### Customer benefit

Email-bound invitations connect the intended user to the intended account and role before access is accepted.

### How to demo

1. Manage Account
2. Users
3. invite user with role
4. open invitation state
5. explain email-match protection and acceptance.

**What to say:** “Email-bound invitations connect the intended user to the intended account and role before access is accepted.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/upload/[token]`
- `apps/custom/src/app/invite/[token]`
- `apps/custom/src/app/app/admin/users`
- `apps/custom/src/modules/documents/duplicateDetection.ts`

## Sales guardrails

- Secure upload and invitation flows are code-backed. The broader question/response experience is partial, and external status visibility is a roadmap concept in this deck.
- Never imply that an unauthenticated partner can see internal compliance findings, broker notes, or unrestricted shipment data.

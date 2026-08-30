# Qubere User Management — Sales Product Guide

> Audience: Account owners · IT administrators. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Onboard the right people into the right accounts and roles—then keep access understandable.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Email-Bound Invitations

**Demo readiness:** Available now

### Customer pain

Manual provisioning creates the wrong membership or lets invitation links be used by the wrong signed-in identity.

### Customer benefit

Invitations bind email, account, and role, and verify the signed-in email before acceptance.

### How to demo

1. Manage Account
2. Users
3. invite a user
4. show pending invitation
5. explain acceptance and email-match guard.

**What to say:** “Invitations bind email, account, and role, and verify the signed-in email before acceptance.”

## Role & Permission Administration

**Demo readiness:** Available now

### Customer pain

Teams cannot explain what a role can actually do until someone encounters a denied or over-permitted action.

### Customer benefit

Searchable permission catalogues and domain grouping make role behavior explicit before assignment.

### How to demo

1. Manage Account
2. Roles & Permissions
3. open role
4. search filing or billing
5. add/remove permission
6. save.

**What to say:** “Searchable permission catalogues and domain grouping make role behavior explicit before assignment.”

## Membership Lifecycle

**Demo readiness:** Available now

### Customer pain

Departed users and role changes linger because access reviews happen outside the product.

### Customer benefit

Admins can review membership status, role assignments, invitations, and administrative history in one place.

### How to demo

1. Manage Account
2. Users
3. filter by status
4. open a member
5. change role or deactivate
6. show audit entry.

**What to say:** “Admins can review membership status, role assignments, invitations, and administrative history in one place.”

## Multi-Account Access

**Demo readiness:** Available now

### Customer pain

Brokerage groups and shared-service teams need to work across accounts without mixing customer data.

### Customer benefit

A user can hold memberships across accounts while every active session keeps an explicit account context and scoped permissions.

### How to demo

1. Use account switcher
2. move between two accounts
3. show different role, data, and navigation in each.

**What to say:** “A user can hold memberships across accounts while every active session keeps an explicit account context and scoped permissions.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/app/admin/users`
- `apps/custom/src/app/app/admin/roles`
- `apps/custom/src/app/invite/[token]`
- `packages/auth/src`

## Sales guardrails

- Do not invent ROI, accuracy, throughput, or risk-reduction percentages. Use the prospect’s baseline and approved Qubere evidence.
- If seeded data or an external connector is absent, explain the intended flow and use the product deck rather than pretending the live action completed.


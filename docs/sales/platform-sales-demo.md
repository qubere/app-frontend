# Qubere Platform — Sales Product Guide

> Audience: Technology leaders · platform admins · implementation teams. This guide is based on the current repository and is intended for discovery, product explanation, and live demonstrations.

## Positioning

Configure countries, workflows, integrations, reference data, and tenant operations on one extensible foundation.

Use the customer pain first. Do not start by listing screens. Ask how the prospect handles the problem today, quantify the operational consequence, and then show the shortest product path that resolves it.

## Demo preparation

- Use an account with seeded shipments, documents, parties, and the permissions required for this category.
- Confirm the feature status shown below before a prospect call. “Roadmap” must never be presented as currently live.
- Keep one clean anchor record open before the call; avoid searching for a usable record in front of the prospect.
- After each feature, return to the customer outcome: time removed, risk reduced, revenue protected, or visibility gained.

## Tenant & Account Administration

**Demo readiness:** Available now

### Customer pain

Enterprise groups, brokerages, and importer clients need distinct commercial and data boundaries without separate deployments.

### Customer benefit

Tenant and account configuration supports profiles, domains, memberships, statuses, and shared platform services.

### How to demo

1. Manage Account
2. Account Profile
3. show account identifiers, profile, memberships, and controlled settings.

**What to say:** “Tenant and account configuration supports profiles, domains, memberships, statuses, and shared platform services.”

## Filing Configuration

**Demo readiness:** Available now

### Customer pain

Supporting a new destination or procedure usually requires hard-coded forms and a new release.

### Customer benefit

Platform admins configure schema trees, tabs, panels, grids, visibility, ordering, and country/procedure mappings.

### How to demo

1. Platform
2. Filing Configuration
3. select country/procedure
4. edit layout
5. preview
6. save
7. open filing screen.

**What to say:** “Platform admins configure schema trees, tabs, panels, grids, visibility, ordering, and country/procedure mappings.”

## Integrations & APIs

**Demo readiness:** Available now

### Customer pain

Documents, ERP data, ABI messages, storage, and notification channels require separate one-off connections.

### Customer benefit

Per-account integration settings and API surfaces connect intake, storage, trade systems, and downstream workflows.

### How to demo

1. Manage Account
2. Integrations & APIs
3. show connectors and scopes
4. Platform Admin
5. API Explorer
6. open endpoint docs.

**What to say:** “Per-account integration settings and API surfaces connect intake, storage, trade systems, and downstream workflows.”

## Reference Data Operations

**Demo readiness:** Available now

### Customer pain

Tariffs, restricted-party lists, rates, and compliance rules change independently and must remain reproducible over time.

### Customer benefit

Versioned ingestion, publication status, change tracking, impact previews, and review workflows preserve point-in-time evidence.

### How to demo

1. Platform Admin
2. Data Admin / HTS / Rate Review
3. open a source update
4. preview impact
5. publish or reject.

**What to say:** “Versioned ingestion, publication status, change tracking, impact previews, and review workflows preserve point-in-time evidence.”

## Agent & Job Operations

**Demo readiness:** Available now

### Customer pain

Background agents, document workers, and scheduled jobs become invisible production dependencies.

### Customer benefit

Platform views expose agent analytics, deployments, cron health, processing queues, and quarantined inbound work.

### How to demo

1. Platform Admin
2. Agents Analytics / Cron / Deployments
3. show health and recent runs
4. open failed item.

**What to say:** “Platform views expose agent analytics, deployments, cron health, processing queues, and quarantined inbound work.”

## Repository evidence

The following code and product surfaces were used to verify this guide:

- `apps/custom/src/app/platform-admin`
- `apps/custom/src/app/app/filing-config`
- `apps/custom/src/app/app/admin/settings`
- `apps/custom/src/modules/filingConfig`

## Sales guardrails

- Do not invent ROI, accuracy, throughput, or risk-reduction percentages. Use the prospect’s baseline and approved Qubere evidence.
- If seeded data or an external connector is absent, explain the intended flow and use the product deck rather than pretending the live action completed.


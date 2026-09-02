# Partner portal: Entry Proof, shipment answers, and Your setup

Implementation of [issue #294](https://github.com/qubere/app-frontend/issues/294).

## Contract

The broker computes and publishes an immutable, versioned customer-safe Entry Proof.
The portal reads published payloads only. Customer questions and access requests use
CustomerRequest and its existing message workflow. Shipment answers are deterministic.
Neither assemblers nor API responses expose internal recommendations, agent notes,
buy costs, margins, or profit. Client/account scope is enforced before reading data.

## Delivery checklist

- [x] Shared pure entry-proof package, Decimal scorecard, safe finding copy and tests.
- [x] Shared migration: proof/events, stakeholders/documents, visibility columns.
- [x] Broker generation, atomic publication/supersession and Entry Proof workspace.
- [x] Portal published proof APIs, line questions, compliance table and dashboard.
- [x] Shipment answers API, At a glance view and attention items.
- [x] Setup API, document download, access requests, broker panel and promotion hooks.
- [x] Stakeholder backfill and notification preferences.
- [x] Guarded Target/Amazon demo seed and run instructions.
- [x] Product-accurate sales script and five deck additions.
- [x] Regression, isolation, redaction, versioning and tariff parity validation.

## Design decisions

Money uses Decimal until JSON serialization. A missing reference-data result is not
proof of non-applicability. Unavailable AD/CVD rates remain visibly unevaluated.
Published proof remains available while a replacement draft is prepared; replacement
publication atomically supersedes it. Publication and generation serialize per filing
to avoid duplicate versions or multiple current published proofs.

Setup does not send invitations on a customer's behalf. It records an access request
for broker review. Signed documents are served through authenticated storage access.
No ABI transmission, real 7501/invoice PDF generation, or customer recomputation is
introduced by this feature.

## Validation and rollout

Apply the checked-in migration and regenerate Prisma before starting either app.
The migration includes existing-role permission grants and partial unique indexes for
one current draft/publication per filing. Preserve those SQL additions if regenerating.

Run the guarded demo and contact/document backfill as described in
[the five-minute demo script](../../sales/PARTNER-PORTAL-ENTRY-PROOF-DEMO.md).
The existing authenticated compliance-notification dispatch cron must be scheduled for
email and bell reconciliation. OpenSign requires the shared webhook secret documented
in the demo script. Existing Dropbox Sign API methods remain stubs.

### Verified locally

- 102 focused tests: score branches, Decimal amounts, redaction, auth/scope, HTTP handlers,
  document access, notification preferences/retries, webhook authentication, versioning,
  company/origin rate resolution, and existing tariff/7501 regressions.
- Custom and portal TypeScript checks, including the demo/backfill scripts.
- Prisma schema validation and client generation.
- The seed's production guard rejects execution before database access.
- Diff whitespace check; deck has 14 slides and continues using its existing navigation.

Reproduce the focused tests from the repository root:

```bash
npx vitest run packages/entry-proof/src packages/auth/src/portal-auth.test.ts packages/auth/src/portal-permissions.test.ts packages/db/src/services/portal-status-mapper.test.ts
npm --workspace @qubere/custom test -- tests/entry-proof-service.test.ts tests/entry-proof-tariff.test.ts tests/portal-notifications.test.ts tests/portal-esign-auth.test.ts tests/form7501-builder.test.ts tests/unit/dutyEngine.test.ts
(cd apps/portal && ../../node_modules/.bin/vitest run --config vitest.config.mts)
```

### Environment validation still required

No test database, Clerk session, or provider credentials were configured in this workspace.
Migration application, the full seed, signed-document/email provider integration, and
an authenticated browser walkthrough have not been executed. The available cloud browser
could not reach the local component preview (ERR_BLOCKED_BY_CLIENT). Run the sales script
against an isolated demo database before presenting to a customer. GitHub reported no
workflow runs or commit status checks on the published branch during implementation.

The PR links this tracking issue for closure on merge; deployment validation remains
explicitly recorded here rather than being represented as completed.

### Deliberate implementation details

Reference-data absence never means zero duty. Specific/compound base rates are left
unavailable until quantity-aware computation exists. Manufacturer-specific rates use an
unambiguous active Product Master manufacturer; ambiguous manufacturers need review.
Customer-facing classification explanations use safe structural copy. Internal reviewer
notes are not automatically reused as customer explanations, and GRI/ruling fields stay
empty unless a publishable source is available.

The seed contains synthetic reference data and visibly synthetic setup PDFs. Use an
isolated demo database: the reference tables are global, even though clients are scoped.

## Client navigation

The portal uses the customs app's Qubere branding, muted rail, active white rows,
accordion sections, and collapsible icon rail. Actions stays pinned. Operations
contains Shipments, Freight (when enabled), and Documents; Compliance contains
Entry Proofs; Billing contains Invoices; Your company contains Your setup. Profile
and security stays in the footer. The portal uses its existing access capabilities
and routes, including active states for entry, request, and onboarding detail pages.
The former placeholder AI button is removed. Small screens use a dismissible drawer
with Escape, keyboard focus containment, and automatic close after navigation.

Validated with the portal TypeScript check and server-render smoke checks for seven
route/active-state combinations, customs/freight visibility, and client-only links.

# Partner portal: Entry Proof, shipment answers, and Your setup

Implementation of [issue #294](https://github.com/qubere/app-frontend/issues/294).

## Contract

The broker computes and publishes an immutable, versioned customer-safe Entry Proof.
The portal reads published payloads only. Customer questions and access requests use
CustomerRequest and its existing message workflow. Shipment answers are deterministic.
Neither assemblers nor API responses expose internal recommendations, agent notes,
buy costs, margins, or profit. Client/account scope is enforced before reading data.

## Delivery checklist

- [ ] Shared pure entry-proof package, Decimal scorecard, safe finding copy and tests.
- [ ] Shared migration: proof/events, stakeholders/documents, visibility columns.
- [ ] Broker generation, atomic publication/supersession and Entry Proof workspace.
- [ ] Portal published proof APIs, line questions, compliance table and dashboard.
- [ ] Shipment answers API, At a glance view and attention items.
- [ ] Setup API, document download, access requests, broker panel and promotion hooks.
- [ ] Stakeholder backfill and notification preferences.
- [ ] Guarded Target/Amazon demo seed and run instructions.
- [ ] Product-accurate sales script and five deck additions.
- [ ] Regression, isolation, redaction, versioning and tariff parity validation.

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
The final implementation will include exact seed and verification commands here.
Do not close the tracking issue until the delivery checklist has been validated.

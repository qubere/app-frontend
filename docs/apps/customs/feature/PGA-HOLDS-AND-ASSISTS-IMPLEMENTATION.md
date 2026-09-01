# PGA holds and assists implementation

Source: [PGA-HOLD-RESOLUTION-AND-ASSISTS](../future/PGA-HOLD-RESOLUTION-AND-ASSISTS.md).

## Broker outcome

Resolve agency holds in shipment context, retain correction drafts and evidence, and apply account-level assists without repeating data entry or losing the audit trail.

## Delivery checkpoints

- [ ] Tenant-scoped persistence, migrations, permissions, and audit events.
- [ ] Real hold ingestion, Today discovery, shipment drawer, drafts, submission history, and honest transport status.
- [ ] Assist registry, precise allocation, active-only matching, entry decisions, and concurrency-safe declaration.
- [ ] Notification delivery, navigation, supplier quick-create, and operator documentation.
- [ ] Allocation, tenant isolation, idempotency, state transitions, and complete broker journey verification.

## Required external inputs

The source explicitly requires licensed-CHB review of agency field matrices and field-to-record mappings before generating agency-complete filing payloads. It supplies only an illustrative FDA matrix. Do not invent regulatory mappings, inbound notice layouts, or hold-code narratives. Unverified configurations must identify what is missing and preserve raw source evidence.

The existing ACE provider is not live. Never treat a mock acknowledgment as a federal filing, acceptance, or release. Manual filing needs explicit broker confirmation; a prepared export is not a submitted filing.

## Decisions

- Keep PGA screening requirements distinct from actual agency holds.
- Keep assist review decisions separate from immutable declarations; editing a draft must not spend an assist balance.
- Use existing PGA and Valuation permissions and the existing valuation engine.
- Scope every lookup and mutation to the authenticated account and validate related importer/supplier/filing ownership.
- Preserve entry context, expose missing information inline, and use accessible responsive drawers.

## Verification status

Implementation in progress. No build or end-to-end result is claimed until executed. The current session has GitHub access but no local terminal; repository CI will provide executable validation where available.

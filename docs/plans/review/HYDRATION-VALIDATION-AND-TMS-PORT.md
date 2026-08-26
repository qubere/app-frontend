# PR #83 validation: remaining hydration work and TMS port

Date: 2026-08-26

## Verdict

The registry, candidate ledger, policy boundary, review surface, and rollout
scaffolding are a useful foundation. The implementation is not yet the
LLM-driven universal hydration engine described in the design and should not be
called launch-ready or high-fill-rate yet.

The validation pass fixed concrete persistence, identity, tenant, locking, and
delivery defects. The remaining work below is architectural and should be
completed as a bounded follow-up rather than hidden behind more alias entries.

## Fixes added during validation

- Added the missing Prisma migration for `HydrationRun`,
  `HydrationCandidate`, and the hydration columns on `Fact`.
- Made scalar candidate entity identity non-null so PostgreSQL actually
  enforces replay idempotency.
- Removed fabricated in-memory evidence rows and destructive evidence deletion.
- Stopped hydration from changing the active parse pointer; parse promotion is
  the only owner of that pointer.
- Added fail-closed document, shipment, run, and review-candidate ownership
  checks.
- Made event-log and outbox creation atomic and added claim, stale-lock recovery,
  bounded retry, and backoff to the shipment event consumer.
- Made parse-promotion outbox keys deterministic.
- Keyed candidate identity by field and entity reference, preventing line-item
  candidates from collapsing onto one ID.
- Advanced shipment CAS versions between scalar materializations.
- Stored human locks under the same canonical storage key checked by automatic
  promotion.
- Made failed live materialization throw and roll back instead of committing a
  `Fact` while returning `success: false`.
- Renamed the recorded default mapper version honestly to
  `deterministic-alias-v1`; no model is currently called by this mapper.

## Antigravity execution prompt

Implement the remaining production work for PR #83. Treat the items below as
acceptance criteria, not suggestions. Preserve the existing safety invariant:
the model may propose only registered field keys backed by persisted evidence;
deterministic code validates and authorizes every promotion.

### P0 — make the implementation match the product claim

1. Implement a real asynchronous structured-output LLM mapper behind
   `LLMFieldMapperProvider` and call it from the hydration worker. Use the
   repository's configured Gemini stack unless there is an explicit provider
   abstraction already selected. Send only a bounded registry slice and
   persisted evidence IDs/values. Validate every returned proposal with Zod,
   registry membership, evidence ownership, cardinality, normalizers, and
   validators. An unconfigured provider must produce an honest blocked/failed
   run, never silently fall back while recording an LLM model version. Keep the
   deterministic alias mapper as an explicit fallback/candidate-retrieval mode,
   not as the feature advertised as LLM mapping. Persist model, prompt, token,
   latency, and cost lineage.

2. Make evidence immutable and parse-versioned. Add a migration-backed
   `parseVersionId`/stable observation identity to `ExtractionField` (or a
   dedicated evidence table), store raw label separately from stable key, and
   preserve nullable page/confidence rather than inventing page 1 or 90/95.
   Persist parser element reference, section/table/row/cell, relationships,
   stamps, identifiers, unreadable observations, and all table cells. Exact
   observations may deduplicate only within the same parse run. Never delete a
   prior parse's evidence. Write evidence and the compatibility projection
   atomically.

3. Make the hydration run lifecycle truthful and resumable. `persistProposals`
   must not mark a run `SUCCEEDED`. The orchestrator owns final state after
   mapping, validation, resolution, promotion/review routing, materialization,
   and durable event creation. Persist candidate validation, corroboration,
   calibrated score, reason codes, and final status. A partial failure must be
   `FAILED` with a resumable stage; unresolved candidates must yield
   `NEEDS_REVIEW`. Replaying the same idempotency key must resume or return the
   completed result without repeating side effects.

4. Perform real shipment-packet resolution. Load candidates from every attached
   document's active parse version, group by `(fieldDefinitionKey,
   targetEntityRef)`, and require distinct document IDs for corroboration. Do
   not construct a one-document map and label it multi-document resolution.
   Persist winners, losers, conflicts, and exception linkage.

5. Replace the current line-item materializer. It presently sends every line
   field (quantity, price, HTS, and description) to
   `LineItemReconciler.applyDiscoveries` as line 1's `description`. Build one
   coherent typed item per entity reference and map each registered property to
   the real reconciler field. Add equivalent grounded materializers for TMS
   equipment, tracking identifiers, transport legs/stops, appointments, POD,
   and carrier-invoice fields. A materializer without a typed projection may
   preserve a fact, but must not report a typed write.

6. Wire document detach and supersession durably. The detach transaction must
   enqueue a deterministic event. Recompute only from still-attached documents,
   preserve human locks, promote the best surviving candidate, and clear a
   typed projection when no surviving support exists. Test scalar, party,
   line-item, and no-survivor cases with real Postgres.

### P1 — correctness and operations

7. Make review actions one transaction: shipment CAS, candidate transition,
   approval audit, exception resolution, human-locked fact, and typed
   projection. Do not increment the shipment version before discovering a
   later validation failure, and return the actual post-materialization version.

8. Replace placeholder metrics. `promoted / candidates` is not precision,
   `promoted / candidates` is not extraction recall, and `runs * $0.005` is not
   measured model cost. Compute metrics from labeled eval outcomes and real
   usage telemetry, separated by account, product, data mode, document type,
   model, prompt version, and registry version.

9. Expand the canonical registry beyond the current 20 fields using governed
   releases. Cover the current Customs review contract and the TMS freight
   contract. Adding a field must require a registry release and, only when a new
   entity kind is introduced, a materializer change.

10. Add tests that would fail for the defects above. Required gates:
    - migrations from empty Postgres and schema-drift inspection;
    - model-output contract and adversarial grounding tests;
    - two documents corroborating and conflicting;
    - two line items retaining distinct candidate IDs and typed values;
    - multi-scalar materialization without stale-version loss;
    - transaction rollback after a post-`Fact` projection failure;
    - outbox concurrent claims, retry/backoff, stale lock, and exhaustion;
    - detach with surviving evidence, no survivor, and human lock;
    - tenant and data-mode isolation on every public service;
    - golden-corpus targets: extraction recall >=97%, mapping coverage and
      evidenced fill rate >=95%, automatic precision >=99% consequential and
      >=97% otherwise, with zero ungrounded accepted candidates.

Do not satisfy these gates with tautologies, swallowed exceptions, fabricated
rows, default confidence/page values, or mocks that bypass the behavior being
claimed. Run typecheck, lint, the full test suite, production build, and the
real-Postgres tests. Report measured corpus denominators and failures, not only
percentages.

## Porting the engine to TMS

Do not copy `apps/custom/src/modules/hydration` into `apps/tms`. Both apps use
the same `ShipmentDocument`, `Shipment`, `Fact`, and outbox tables, so a copied
engine would recreate the key-drift problem this project is meant to remove.

1. Extract product-neutral contracts and services into a shared workspace
   package such as `packages/hydration`: evidence types, registry and slicer,
   mapper provider, normalizers/validators, resolver, policy interfaces, run
   lifecycle, and metrics contracts.
2. Keep product-specific materializers as adapters registered by entity kind.
   Customs owns filing-draft projections; TMS owns movement stops, equipment,
   tracking, appointments, POD, carrier invoice, and transportation-order
   projections. Both may write the shared canonical `Fact` ledger.
3. Add governed TMS registry fields for the existing extraction contract:
   customer/PO references, mode/service level, origin/destination names,
   countries and UN/LOCODEs, ETA/promise/last-free-day, booking/master/house/AWB
   and PRO identifiers, containers/equipment, commodity/packages/weight/volume,
   hazmat/temperature, and freight line items.
4. Replace `rawMetadataJson` as a downstream source with shared immutable
   evidence. Adapt `TmsDocumentExtraction.evidence`, `additionalFields`, line
   items, and raw metadata into the evidence ledger while retaining
   `extractedJson` temporarily as a compatibility projection.
5. Insert a versioned `Field Hydration` step after `Document Intake Agent` and
   before `Shipment Enrichment Agent`. Reuse TMS's existing `PipelineJob`,
   heartbeat/retry behavior, and transactional outbox; do not introduce a
   second TMS queue. Bump the TMS workflow version so prior completed jobs do
   not collide with the new step layout.
6. Expose the shared registry-driven review state in the TMS document workspace,
   with TMS authorization and product slicing. Human approval writes the same
   locked canonical fact used by Customs.
7. Roll out in shadow mode: run legacy TMS extraction/projection and shared
   hydration side by side, record field-by-field diffs, and block promotion.
   Canary by account/document type after corpus thresholds pass, then switch
   downstream TMS agents to shared facts and retire the legacy hand-maintained
   mappings.

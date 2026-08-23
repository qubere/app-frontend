# TMS Pipeline: Context Integrity Fix — Implementation Prompt + Test Matrix

Fixes the two gaps found in review (see `TMS-MODULAR-AGENT-ARCHITECTURE.md` review
notes): (1) Step 2 silently drops the losing value on a field conflict between
documents, and (2) detaching a document doesn't unwind anything it contributed.

---

## 1. What's being fixed, precisely

**Today:** `runShipmentEnrichment` ([shipmentEnrichmentAgent.ts:16-17](../../apps/tms/src/modules/agents/services/shipmentEnrichmentAgent.ts)) writes a
`Shipment` field only if it's currently empty (`setIfMissing`). Whichever
document is processed first for a field wins, permanently, regardless of
extraction confidence. There's no attribution — nothing on `Shipment` records
which document, or with what confidence, contributed each field.

`detach/route.ts` only sets `shipmentId: null` on the document. Every field
it contributed to `Shipment`, every `ShipmentTrackingIdentifier` /
`ShipmentEquipment` row it created, stays forever, un-attributed, un-reverted.

**Target behavior:**
- A field promoted to `Shipment` is only overwritten by a later document when
  that document's evidence confidence for the field is meaningfully higher —
  never silently; a loss is always recorded as a conflict, visible on the
  decision card.
- Detaching a document recomputes the shipment's derived state from whatever
  documents remain attached — fields sourced only from the detached document
  fall back to the next-best remaining document, or to null if none remains.

---

## 2. Schema changes required

```prisma
// packages/db/prisma/schema.prisma

model Shipment {
  // ...existing fields unchanged...

  /// Per-field attribution for values promoted by the Shipment Enrichment
  /// Agent: { [fieldName]: { documentId, confidence, value, updatedAt } }.
  /// Null/absent entry means the field was set by something other than
  /// document extraction (operator entry, order creation) and must never be
  /// overwritten by document enrichment.
  enrichmentProvenance Json? @default("{}")
}

model ShipmentTrackingIdentifier {
  // ...existing fields unchanged...
  sourceDocumentId String?
  sourceDocument   ShipmentDocument? @relation(fields: [sourceDocumentId], references: [id], onDelete: SetNull)
}

model ShipmentEquipment {
  // ...existing fields unchanged...
  sourceDocumentId String?
  sourceDocument   ShipmentDocument? @relation(fields: [sourceDocumentId], references: [id], onDelete: SetNull)
}
```

`onDelete: SetNull` on the new relations, not `Cascade` — a hard document
delete (if one is ever added) should orphan the attribution, not destroy the
tracking/equipment row itself; that row may still be operationally live
(a container is still moving whether or not the sourcing document exists).

Existing rows get `sourceDocumentId = null` — no backfill required. A row
with `sourceDocumentId = null` is treated as "not attributable to a specific
document" and is never auto-reverted or auto-deleted by the recompute logic
(fail safe: never destroy data we can't prove came from the detached doc).

---

## 3. Implementation prompt

Copy everything below the line into the executing agent/session. It's
self-contained — file paths, exact current behavior, and exact required
behavior, so it doesn't need this conversation's history.

---

> You are fixing two data-integrity gaps in the TMS document pipeline at
> `apps/tms/src/modules/agents/`. Read `apps/tms/src/modules/agents/services/shipmentEnrichmentAgent.ts`
> and `apps/tms/src/app/api/documents/[id]/detach/route.ts` in full before
> making changes. Both currently exist and work; you are changing their
> conflict/removal behavior, not rebuilding them.
>
> **Constraint: zero data loss, zero silent overwrites.** Every write this
> code makes must be explainable from an `AgentDecision.evidenceItems` record
> — if a value is not applied because a better one already exists, or a
> field is cleared because its source document was detached, that must be in
> the evidence, not just implied by the DB state.
>
> ### Task A — Confidence-based conflict resolution in Shipment Enrichment
>
> 1. Add the schema changes in "Schema changes required" above (`enrichmentProvenance`
>    on `Shipment`, `sourceDocumentId` on `ShipmentTrackingIdentifier` and
>    `ShipmentEquipment`). Run the migration.
> 2. In `shipmentEnrichmentAgent.ts`, replace `shipmentPatch`'s `setIfMissing`
>    logic with a conflict-aware resolver. For each of the 11 enrichable
>    fields (`poReference`, `importerName`, `incoterm`, `carrierName`,
>    `transportMode`, `countryOfExport`, `destinationCountry`, `portOfEntry`,
>    `estimatedArrival`, `customerPromiseDate`, `lastFreeDay`):
>    - Look up that field's confidence from `extraction.evidence` (match by
>      field name; if the field isn't itemized in `evidence`, fall back to
>      `extraction.confidence`).
>    - If the field is unset on `Shipment`, or has no `enrichmentProvenance`
>      entry (meaning it was set by something other than document
>      enrichment — operator entry, order creation): apply the new value,
>      write a provenance entry `{ documentId, confidence, value, updatedAt }`.
>    - If the field is set with existing provenance and the new candidate
>      value is equal (case-insensitive, trimmed) to the current value: no-op.
>    - If the field is set with existing provenance and the new value
>      differs: overwrite **only if** `candidateConfidence > existingProvenance.confidence + 5`
>      (5-point margin — avoid overwrite churn from near-identical confidence
>      scores). Update the provenance entry to the new document.
>    - If it differs and confidence doesn't clear the margin: **do not
>      overwrite.** Instead push `{ field, existingValue, existingDocumentId,
>      existingConfidence, candidateValue, candidateDocumentId,
>      candidateConfidence }` onto a `conflicts` array.
>    - If the field has a provenance entry whose `confidence` is null, treat
>      the current value as always-losing (i.e. any confident candidate
>      overwrites) — a null-confidence provenance means the value came from a
>      degraded/unconfigured extraction path.
>    3. `createAgentDecision`'s `evidence` must include `conflicts` (empty
>    array if none) alongside the existing `updatedFields`. If `conflicts.length > 0`,
>    set `needsReview: true` on the decision even if the shipment otherwise
>    looks complete — a human should see and resolve the conflict.
>
> ### Task B — Detach triggers a scoped recompute, not a no-op
>
> 1. Add a new function `recomputeShipmentDocumentContext(shipmentId: string, accountId: string, removedDocumentId: string)`
>    in a new file `apps/tms/src/modules/agents/services/contextRecomputeAgent.ts`,
>    following the same import/shape conventions as the other files in
>    `services/` (uses `pipelineShared.ts` helpers — extend that file if a
>    needed helper isn't exported yet, don't duplicate it locally).
> 2. The function:
>    a. Loads the shipment and every currently-attached `ShipmentDocument`
>       (`shipmentId` still set — i.e. **excluding** the one just detached).
>    b. Parses each remaining document's `extractedJson` via
>       `parseStoredFreightExtraction`.
>    c. For every field in `Shipment.enrichmentProvenance` whose `documentId === removedDocumentId`:
>       find the highest-confidence value for that field among the remaining
>       documents' extractions (using the same evidence-confidence lookup as
>       Task A); if found, apply it and update provenance to point at that
>       document; if not found, set the field to `null` and remove its
>       provenance entry.
>    d. For every `ShipmentTrackingIdentifier` and `ShipmentEquipment` row
>       where `sourceDocumentId === removedDocumentId`: check whether any
>       remaining document's extraction independently produces the same
>       identifier/container. If yes, re-point `sourceDocumentId` to that
>       document (the fact is still supported). If no, delete the row.
>       **Never touch rows with `sourceDocumentId: null`** — those predate
>       attribution and can't be safely reasoned about.
>    e. Re-runs the required-vs-present document check from
>       `documentReadinessAgent.ts` (extract the check into a shared function
>       both files can call, rather than duplicating it) so `ExceptionItem`s
>       reflect the shipment's post-detach document set.
>    f. Writes one `AgentDecision` (`agentName: "Context Recompute Agent"`,
>       `purpose: "Reconcile shipment state after a document was detached."`)
>       with evidence: `{ removedDocumentId, revertedFields, reappliedFields,
>       revertedIdentifiers, revertedEquipment }`.
>    g. All writes in one `db.$transaction`.
> 3. Call `recomputeShipmentDocumentContext` from `detach/route.ts` right
>    after the `shipmentId: null` update, inside the same request — pass the
>    document's `shipmentId` **before** it was nulled (capture it first) and
>    the document's own `id` as `removedDocumentId`. If recompute throws,
>    the detach itself must still have succeeded (don't roll back the
>    detach) — log the recompute failure via `createAuditLog` with
>    `success: false` so it's visible, rather than swallowing it silently or
>    failing the whole request.
> 4. `shipmentEnrichmentAgent.ts`'s `upsertExtractedReferences` must now set
>    `sourceDocumentId: document.id` when creating/updating
>    `ShipmentTrackingIdentifier` and `ShipmentEquipment` rows (currently
>    unattributed).
>
> ### Do not
> - Do not add a hard-delete endpoint for documents — none exists today;
>   this task is scoped to `detach` only.
> - Do not change `TransportationOrder` — it's already correctly scoped
>   1:1 per document (`externalReference: document:<id>`) and needs no fix.
> - Do not touch `AccountMemory` / RAG memory records — those are a separate,
>   intentionally durable system (memory persists across documents and isn't
>   tied to a document's attachment state).
> - Do not change `attach/route.ts`'s existing behavior of enqueueing the
>   pipeline for the newly attached document — Task A's conflict resolution
>   is sufficient for the attach path; attach doesn't need a recompute call.
>
> After implementing, run `npx tsc --noEmit` in `apps/tms` and self-check
> against every case in the "Test Matrix" section before reporting done.

---

## 4. Test matrix

Each row should be a real integration test (seed documents/shipment, run the
relevant step or route, assert DB state + `AgentDecision.evidenceItems`), not
just a type-check. "Field" cases use `carrierName` as the representative
field but the same logic must hold for all 11.

| # | Scenario | Setup | Expected result |
|---|---|---|---|
| 1 | Single document, no conflict | Upload 1 doc with `carrierName: "ABC Trucking"`, confidence 90 | `Shipment.carrierName = "ABC Trucking"`, provenance recorded with that doc id + confidence 90 |
| 2 | Second document fills a gap | Doc 1 sets `carrierName`, doc 2 (uploaded after) has `poReference` but no `carrierName` | `carrierName` unchanged from doc 1; `poReference` now set from doc 2; no conflict recorded |
| 3 | Second document disagrees, lower confidence | Doc 1: `carrierName="ABC Trucking"` conf 90. Doc 2: `carrierName="XYZ Logistics"` conf 82 | `Shipment.carrierName` stays `"ABC Trucking"` (82 doesn't clear the +5 margin over 90); decision's `evidence.conflicts` contains the XYZ candidate; `needsReview: true` |
| 4 | Second document disagrees, higher confidence, clears margin | Doc 1: `carrierName="ABC Trucking"` conf 80. Doc 2: `carrierName="XYZ Logistics"` conf 96 | `Shipment.carrierName` becomes `"XYZ Logistics"`; provenance now points at doc 2 / conf 96; evidence records the overwrite |
| 5 | Second document disagrees, within the 5-point margin | Doc 1 conf 88, doc 2 conf 91 (candidate value differs) | No overwrite (91 - 88 = 3, under margin); recorded as a conflict, not applied |
| 6 | Third document later confirms the loser | Doc 1 conf 90 "ABC" applied. Doc 2 conf 82 "XYZ" rejected (case 3). Doc 3 conf 97 "XYZ" | Doc 3 overwrites (97 > 90 + 5); provenance now doc 3; both doc 2's and doc 3's conflict/overwrite events are separately visible in each step's own decision evidence |
| 7 | Operator manually edits the field, then a document is uploaded | Operator sets `carrierName` directly (no provenance entry created — this must be true of whatever operator-edit code path exists; if it currently also writes through this agent, flag it, don't assume) | New document's enrichment treats the field as having no provenance and applies its value — confirm this is the desired behavior or whether operator-set fields need a distinct "locked" provenance state; write the test either way to pin down actual behavior |
| 8 | Field with no per-field evidence entry | Extraction's `evidence[]` doesn't include an item for `carrierName` even though `carrierName` is populated | Falls back to `extraction.confidence` (document-level) for that field's confidence in the conflict comparison |
| 9 | Detach the sole source of a field | 1 doc attached, sets `carrierName`. Detach it. | `Shipment.carrierName` becomes `null`; provenance entry removed; `AgentDecision` from Context Recompute Agent records `revertedFields: ["carrierName"]` |
| 10 | Detach when another attached document supplies the same field | Doc 1 sets `carrierName="ABC"` (winning provenance). Detach doc 1. Doc 2 (still attached) also has `carrierName="DEF"` conf 70 in its own stored extraction (never applied while doc 1 won). | After detach, `carrierName` becomes `"DEF"` sourced from doc 2 (best remaining candidate), not left null — confirms recompute re-scans *all* remaining documents' stored extractions, not just ones that previously won a conflict |
| 11 | Detach a document that never won any field | Doc 1 wins all fields (higher confidence). Doc 2 attached but every field of its lost as a conflict. Detach doc 2. | No `Shipment` fields change (doc 2's `documentId` never appears in provenance) — recompute is a no-op for `Shipment` fields, but doc 2's own `ExceptionItem`/readiness contribution still reconciles correctly |
| 12 | Detach removes a tracking identifier not corroborated elsewhere | Doc 1 is the only source of `MBL` identifier `X`. Detach doc 1. | `ShipmentTrackingIdentifier` row for `MBL:X` is deleted |
| 13 | Detach removes a tracking identifier that is corroborated | Doc 1 and Doc 2 both extract the same `MBL` value `X`. Detach doc 1. | `ShipmentTrackingIdentifier` row survives, `sourceDocumentId` re-pointed to doc 2 |
| 14 | Detach a document with `sourceDocumentId: null` rows present (legacy data) | Seed a `ShipmentTrackingIdentifier` with `sourceDocumentId = null` (pre-migration row), detach any document | That legacy row is untouched regardless of which document is detached |
| 15 | Re-attach after detach | Case 9's shipment (carrierName now null after detach), re-attach the same document | Pipeline re-runs for that document, Step 2 treats the field as unset (no provenance) and re-applies it — confirm this doesn't require any special-casing beyond normal Task A logic |
| 16 | Document Readiness reconciles after detach | Shipment has BOL + Invoice attached, satisfying requirements, no open exceptions. Detach the BOL. | Recompute's readiness re-check creates a `TMS_MISSING_BILL_OF_LADING` `ExceptionItem`; detaching alone (without a new pipeline trigger) is what causes this — confirm it happens synchronously in the detach request, not only on the next unrelated pipeline run |
| 17 | Detach the last document on a shipment entirely | Only document attached is detached | All provenance-tracked fields with that document as source go to `null`; no remaining documents to scan; function completes without error on an empty document set |
| 18 | Recompute failure doesn't block detach | Force `recomputeShipmentDocumentContext` to throw (e.g. malformed `extractedJson` on a remaining document) | `ShipmentDocument.shipmentId` is still `null` (detach succeeded); an audit log entry with `success: false` exists for the recompute failure; the API response to the detach call is still 200 |
| 19 | Concurrent detach + new upload race | Detach document A while a new pipeline job for newly-uploaded document B is mid-execution on the same shipment | No crash from concurrent writes to `enrichmentProvenance`/`Shipment` fields; last-committed-transaction wins is acceptable, but neither write should be silently lost — verify via re-reading final state that it matches one of the two valid orderings, not a corrupted merge |
| 20 | Conflict evidence never disappears | Case 3's rejected "XYZ Logistics" candidate | The rejected value must be discoverable later (either in that step's own `AgentDecision.evidenceItems.conflicts`, or by re-parsing doc 2's own `extractedJson`) — write an explicit assertion that it's retrievable by *some* documented path, since "no agent drops data" is the whole point of this fix |

---

## 5. Open questions to resolve before/during implementation

- **Case 7** (operator-edited fields): checked — there is no
  `apps/tms/src/app/api/shipments/[id]/route.ts` (or any other route) that
  lets an operator directly PATCH `carrierName`/`transportMode`/etc. today,
  so this case is currently moot: every write to these 11 fields goes
  through document enrichment. Still write case 7 as a forward-looking test
  (skipped/pending is fine) — the moment an operator-edit endpoint is added,
  it must write a provenance entry (e.g. `{ documentId: null, confidence: 100, source: "OPERATOR" }`)
  or this fix's conflict logic will let a later document silently overwrite
  a human's explicit correction, which would be worse than the bug being
  fixed here.
- **Hard-delete migration path**: none exists today (confirmed — only
  `detach`). If one gets added later, `onDelete: SetNull` on the new
  `sourceDocumentId` relations means those rows survive with `null`
  attribution, which the recompute logic already treats as untouchable —
  no further change needed then.

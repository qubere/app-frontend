# Product & Party Master: Universal Capture, Lineage, and Unified Search

## Objective

Every product and every party a client deals with — however Qubere first learns
about it (a document upload, a shipment field, a CSV import, a portal
submission, an assistant conversation) — should land in that client's Product
Master or Party Master, not in a local, disconnected field somewhere else.
Once there, two things should be true for every record:

1. **You can search it by any attribute it carries** (name, identifier, role,
   status, jurisdiction, address, registration, classification — not just the
   handful of columns the current list page happens to filter on).
2. **You can see where it came from** — the full lineage, e.g. *"Party X was
   first discovered on Document Y, which is a Bill of Lading attached to
   Shipment Z"* — and every subsequent fact that touched the record, back to
   its source.

This is the "ultimate repo" framing: Product Master and Party Master become
the durable, explorable system of record for a client's trade network, not a
byproduct of whichever screen happened to create the row.

## Current state — what's already built vs. what's actually missing

This is not a green-field ask. The schema and a meaningful slice of the UI
already exist. Re-reading the code before proposing anything new:

### Already built (foundation to build on, not replace)

- **`Party`** ([schema.prisma:5329](../../../../packages/db/prisma/schema.prisma))
  and **`Product`** ([schema.prisma:4723](../../../../packages/db/prisma/schema.prisma))
  are real per-account, per-client master tables, each with names/identifiers/
  attributes/addresses/roles/classifications/registrations as separate
  sub-models — see `docs/apps/customs/sales/product-and-party-master.md` for
  the design philosophy ("there is no single 'the HS code'", "origin is a
  fact, not an inference", "a name match is never legal-identity proof").
- **The lineage data model already exists.** `PartyEvidence` and
  `ProductEvidence` both carry `sourceDocumentId → ShipmentDocument` and
  `sourceExtractedFactId → ExtractedFact`, plus `page`/`boundingBox`/`tableId`/
  `rowIndex`/`columnIndex` for exactly where in the document the fact came
  from. `ShipmentDocument.shipmentId → Shipment` closes the chain. **The
  "Party X came from Document Y which is part of Shipment Z" lineage the
  objective describes is already representable in the database today** — it
  is just never queried or rendered as a chain anywhere in the UI.
- **Change history exists.** `PartyChangeEvent` / `ProductChangeEvent` are
  append-only, field-level, "what changed, from what, to what, how material"
  records, already surfaced as a "history" tab on both detail pages
  (`PartyTabs.tsx`, `ProductTabs.tsx`).
- **Match-don't-duplicate already exists, in two different maturities:**
  - Party: `resolvePartyForCompany` / `ensurePartyRole`
    (`apps/custom/src/modules/party/partyResolutionService.ts`) — deterministic
    match against `PartyName`/`PartyIdentifier`, returns `EXACT_MATCH` /
    `AMBIGUOUS` / `NO_MATCH`, never auto-merges on ambiguity.
  - Product: `productMatching.ts` (`apps/custom/src/modules/product/`) — same
    idea, deterministic identifier/name matching with an `AMBIGUOUS` outcome.
  - Both patterns are proven and correct; the gap is *where they're wired in*
    (next section).
  - `ShipmentLineItem.productId` + `productMatchStatus` already models "this
    line item may or may not be linked to the Product Master yet, and
    `AMBIGUOUS` must not be resolved by guessing" — i.e. the schema already
    anticipates exactly the ambiguous-match-at-scale problem universal capture
    will create more of.
- **List pages have real filters and CSV import.** `/app/products` and
  `/app/parties` both support status/reviewStatus/jurisdiction/clientId/
  free-text search (`productQuery.ts`, `partyQuery.ts`), and both have an
  import wizard that matches against existing records rather than blindly
  duplicating.

### The actual gaps (this is what's new)

1. **Capture is narrow and opt-in, not universal.** `resolvePartyForCompany`
   is only called from three places: legal-entity creation
   (`api/legal-entities/route.ts`), importer creation
   (`importerCreate.service.ts`), and onboarding-entity creation
   (`api/onboarding/cases/[caseId]/entities/route.ts`). It is **not** called
   when a shipment's consignee/notify-party/buyer/seller fields are entered,
   when a portal user submits an address, or generally whenever a document is
   parsed and a company name falls out of it. Those paths still write local,
   disconnected fields instead of resolving into Party.
2. **Product matching is agent-only, not pipeline-wired.** `productMatching.ts`
   is invoked only by `productIntelligenceAgent.ts` (an AI-assistant tool) —
   not by the core document-extraction / shipment-line-item ingestion path.
   `ShipmentLineItem.productId` exists in the schema but nothing in the normal
   ingestion pipeline sets it; a line item extracted from a commercial invoice
   today does **not** get matched into Product Master automatically.
3. **No lineage UI exists**, despite the data supporting it. Neither
   `PartyTabs.tsx` nor `ProductTabs.tsx` renders the evidence → document →
   shipment chain. There is also no reverse view: opening a `Shipment` or a
   `ShipmentDocument` gives no list of "which Party/Product records were
   discovered from this."
4. **No cross-entity, cross-attribute search.** Each list page filters its own
   entity type on a fixed set of query params. There's no single place to
   type an EIN, an address fragment, or a part number and get back matching
   parties *and* products, faceted by whatever attribute matched.

## Design principles carried forward (do not relitigate these)

Per the existing product philosophy (`product-and-party-master.md`) and the
prior unification work (issue #320):

- **A name/text match produces a candidate, never an auto-merge.** Universal
  capture must route ambiguous matches to a human review lane — it must not
  create the false confidence of a fully-automated master data system while
  quietly duplicating or misattaching records.
- **Origin, identity, and roles stay separate axes.** Broadening *how much*
  gets captured must not collapse these distinctions to save UI complexity.
- **Evidence is additive, never overwritten.** A new capture event adds
  evidence and, if it changes a fact, a change event — it never silently
  replaces what a prior source said.

## Proposed design

### A. Universal Capture Contract

Define one contract that every entry point producing a party- or
product-shaped fact must go through, instead of writing local fields:

```
resolveAndRecord(actor, kind: "party" | "product", candidateFacts, evidence: {
  sourceType, sourceDocumentId?, sourceExtractedFactId?, sourceReference?, ...
}) → { id, matchStatus: "EXACT_MATCH" | "AMBIGUOUS" | "NO_MATCH" | "CREATED" }
```

This is not a new matching engine — it's `resolvePartyForCompany`/
`productMatching.ts` promoted from "a service two or three routes happen to
call" to "the only sanctioned way to write a party/product fact," with a
mandatory evidence write on every call. Concretely, wire it into (in priority
order, see phasing):

- Shipment party fields (consignee, notify party, buyer, seller) at
  creation/edit time.
- The document-extraction pipeline, for both extracted line items (→ Product)
  and extracted parties on commercial invoices / bills of lading (→ Party) —
  this is the highest-leverage single change, since it's the main "new info
  discovered" moment today.
- Portal-submitted addresses/contacts and CSV/ERP import (import already
  matches; needs to also write `PartyEvidence`/`ProductEvidence` with
  `sourceType` reflecting the import, not just create the row).

### B. Lineage & Provenance UX

Additive, and largely buildable **today** against existing data, before
capture is widened — it will simply show more as capture grows:

- **New "Lineage" tab on the Party/Product detail page** (`PartyTabs.tsx`,
  `ProductTabs.tsx`), rendering each `PartyEvidence`/`ProductEvidence` row as
  a timeline entry: source type, the document it came from (linking to the
  document viewer, deep-linked to the page/bounding box when known), and the
  shipment that document belongs to. First-seen evidence is visually the
  "origin" of the record.
- **Reverse panel on `Shipment` and `ShipmentDocument` views**: "Discovered
  from this document" / "Discovered on this shipment" — a query against
  `PartyEvidence.sourceDocumentId` / `ProductEvidence.sourceDocumentId` (join
  through `ShipmentDocument.shipmentId` for the shipment-level rollup), listing
  the parties and products that trace back here.
- Frame this as a **lineage chain, not a graph-drawing exercise** — a vertical
  timeline/breadcrumb (`Shipment Z → Document Y → Party X`) reads better than
  a node-link diagram for what is fundamentally a linear provenance record,
  and it's what the existing archived audit (#248) flagged the
  `PartyRelationship` graph attempt as still being "a list, not a graph" —
  don't repeat that scope creep here.

### C. Unified cross-entity search

- A federated search endpoint (`/api/search?q=...`) that queries `Party` and
  `Product` together across name/identifier/attribute/address fields, scoped
  by the caller's client access the same way the existing list pages already
  scope by `clientId`.
- Start on existing Postgres indexes plus `pg_trgm`/`ILIKE` for fuzzy text
  before reaching for a dedicated search engine — the identifier/name tables
  are already narrow and indexed per-account; a trigram index on the
  normalized name/identifier columns is enough for the expected scale.
  Re-evaluate only if latency data says otherwise.
- Ship as a top-level omnibox (e.g. a `⌘K`-style overlay) that federates
  results with a type badge (Party/Product) and jumps straight to the detail
  page's Lineage tab — search and lineage are the same feature from the
  user's point of view ("find it, then see where it came from").
- Keep the existing per-entity list-page filters as-is; the omnibox
  supplements them, it doesn't replace the structured filter UI.

### D. Ambiguous-match review lane

Widening capture will multiply `AMBIGUOUS` outcomes (the same state
`ShipmentLineItem.productMatchStatus` already has to handle). Without a
review lane, ambiguous candidates either get stuck invisibly or get force-
resolved by guessing — both wrong per the existing design principles. Add a
review queue analogous to the existing Classification Inbox pattern
(navigation IA phase 4b) where a human confirms or splits an ambiguous
candidate before it's attached to a shipment/document as a `CREATED` record.

## Phased rollout

1. **Phase 1 — Lineage UI (read-only).** Ship the Lineage tab + reverse
   document/shipment panel against evidence that already exists. Low risk,
   immediately demoable, validates the UX before capture volume increases.
2. **Phase 2 — Wire the document-extraction pipeline through the capture
   contract.** This is the single highest-leverage change: every parsed
   commercial invoice / packing list / bill of lading starts producing
   `PartyEvidence`/`ProductEvidence` automatically, not just when a human
   happens to create a legal entity or importer record.
3. **Phase 3 — Ambiguous-match review lane.** Required before Phase 2 ships
   broadly, or ambiguous volume will silently pile up. Sequence tightly with
   Phase 2, not after it.
4. **Phase 4 — Unified search (omnibox + `/api/search`).**
5. **Phase 5 — Remaining entry points**: shipment party fields entered
   directly (not via document extraction), portal-submitted addresses/
   contacts, integration syncs (e.g. QuickBooks contacts).

## Open questions

- **Volume/cost**: writing an evidence row on every extracted fact, for every
  document, at scale — confirm this doesn't become the write bottleneck the
  way `ExtractedFact` volume already might. Worth a quick read on current
  `ExtractedFact` row counts/retention before Phase 2.
- **Individual vs. organization parties**: `PartyKind` already distinguishes
  these; confirm the capture contract and screening implications differ
  correctly for an individual notify-party contact vs. a corporate consignee.
- **Auto-confirm threshold**: Product classification already has a
  human-set confidence threshold for assisted auto-approval
  (`work-management.md`). Decide whether `EXACT_MATCH` capture results should
  auto-confirm by default (likely yes — it's a deterministic identifier match,
  not a fuzzy one) vs. requiring a review touch on every new record.

## Sequencing note

This depends on, but does not block, issue #320 (Party/LegalEntity/
ImporterOfRecord unification). Widening capture onto `Party` before that
unification lands is fine — capture into `Party` today is still correct, it
just means `ImporterOfRecord` records created via the pre-#320 path won't yet
carry the same "also known as" cross-role visibility. No rework risk: #320's
Phase 1 (`ImporterOfRecord.partyId`) and this issue's Phase 2 (document
pipeline → `Party`/`Product`) touch different code paths and land cleanly in
either order.

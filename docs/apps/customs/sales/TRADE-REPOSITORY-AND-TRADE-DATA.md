# Trade Repository & Trade Data

Two separate surfaces under "Tooling & Admin" that share a name pattern but not
a data model. Trade Repository is a real cross-entity document search feature.
Trade Data is a navigation landing page over the Products and Parties modules
— it introduces no data of its own.

## Trade Repository

`/app/trade-repository` (`document.read`-gated; `document.update` additionally
unlocks link/unlink) is an account-wide, searchable list of every document —
independent of which shipment, party, product, license, or filing it happens
to be attached to.

**Page:** `apps/custom/src/app/app/trade-repository/page.tsx` (server
component; resolves `canManage` from `document.update` and redirects to
`/app/dashboard` without `document.read`) renders
`TradeRepositoryClient.tsx`, a paginated (25/page) table with filters for
free-text search (file name, doc type, shipment, client), doc type, status,
and "linked to" entity type.

**Data source:** `GET /api/documents`, extended to accept
`linkedEntityType`/`linkedEntityId` query params and to return a
`linkedEntityCount` per row, so the table can show how widely a document is
already referenced without a second round trip.

### The `DocumentAssociation` model behind it

Before this feature, a `ShipmentDocument` could only be attached to the
shipment it arrived on. `DocumentAssociation`
(`packages/db/prisma/schema.prisma:1440`, module logic in
`src/modules/documentAssociations/`) generalizes that: any document can be
linked to a `SHIPMENT`, `PARTY`, `PRODUCT`, `LICENSE`, or `FILING` record
(`DocumentEntityType`, schema.prisma:48), tagged with a `relationshipType`
(`SOURCE_DOCUMENT`, `SUPPORTING_DOCUMENT`, `FILING_ATTACHMENT`,
`LICENSE_EVIDENCE`, `ORIGIN_EVIDENCE`, or the default `GENERAL`).

- Uniqueness is on `(accountId, documentId, entityType, entityId)`.
- Unlinking sets `active: false` and stamps `unlinkedBy`/`unlinkedAt` rather
  than deleting the row, so history survives.
- `entityResolver.ts` checks the target entity exists and belongs to the
  caller's account before a link can be created — a link can never point at
  another tenant's row or a nonexistent one.

**API surface:** `/api/document-associations`,
`/api/documents/[id]/associations`, `/api/documents/[id]/signed-url`. The
signed-URL route returns a short-lived (15 minute) object-storage URL via
`createSignedReadUrl` for documents backed by real storage, falling back to
the existing streaming proxy (`documentViewUrl()` / `/api/documents/proxy`)
for local-disk/dev-fallback documents or on a storage error.

**UI reuse:** the shared `<EntityDocuments />` component renders the same
linked-documents list and link/unlink controls on Party, Product, and Filing
detail pages, and on the shipment `DocumentWorkspacePanel` — one component and
one API surface instead of a per-entity-type document UI to keep in sync.

**Migration:** `scripts/backfill-document-associations.ts` one-time-migrates
documents that were only ever attached via the old shipment-only mechanism
into `DocumentAssociation` rows.

**Deliberately deferred:** License detail-page document wiring, pending a
product decision on how it should coexist with that module's existing,
separate document mechanism.

## Trade Data

`/app/trade-data` (`apps/custom/src/app/app/trade-data/page.tsx`) is a static
landing page, not a feature with its own data or API. It renders two link
tiles:

| Tile | Links to | Covers |
| --- | --- | --- |
| Products | `/app/products` | Item master: HTS classifications, country-of-origin determinations, composition — see [Global Product / Item Master](../data/product-master.md) |
| Parties | `/app/parties` | Importers, exporters, manufacturers, intermediaries — see [Party Master](../data/party-master.md) |

There is no `TradeData` Prisma model. Treat "Trade Data" purely as the
navigation grouping for the two master-data modules it links to; any question
about what data is actually stored belongs in the Products or Parties docs
linked above, not here.

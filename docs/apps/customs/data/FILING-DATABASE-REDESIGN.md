# Filing Database Design and Proposed Changes

## Instructions for the implementing AI

Use this document as the authoritative implementation specification for the
filing database redesign in this repository.

Before changing code:

1. Read the repository `AGENTS.md` instructions.
2. Read the relevant Next.js documentation under `node_modules/next/dist/docs`
   before changing routes, pages, caching, or mutations.
3. Inspect the current Prisma schema, migrations, seed scripts, filing APIs,
   canonical messaging code, schema API, and tests referenced below.
4. Verify the actual database-compatible identifier types before writing
   foreign keys. Existing `Account` and filing configuration IDs are generally
   `TEXT`; the proposed `FilingSchemas.id` is `UUID`.
5. Preserve unrelated user changes in the worktree.

Implementation rules:

- Implement phases in order. Do not jump directly to dropping
  `CustomsFiling`.
- Use normal versioned Prisma migrations. Do not modify an already-applied
  migration.
- Do not execute ad hoc DDL against production or a shared database.
- Do not drop a column until source search, type checking, tests, and data
  checks prove that it is unused.
- Keep schema changes, source changes, seed changes, and tests in the same
  implementation phase.
- Treat `FilingCountryCustomsVersion` as the only authority for release.
- Treat `procedureCode` as `IMPORT`, `EXPORT`, `NCTS`, or another high-level
  procedure family.
- Do not use `transactionType` as an alias for `procedureCode`.
- Do not infer authority release from canonical schema version.
- Do not silently convert conflicting procedure data. Produce a conflict
  report and stop that migration step until the mapping is approved.
- Do not make schema validation a successful no-op.
- Do not create a database foreign key from the future declaration to
  `Shipment`.
- Preserve tenant scoping on every account-owned read and write.

Expected deliverables for each phase:

- Prisma schema changes.
- A new forward migration.
- Updated runtime code and configuration APIs.
- Updated seed and verification scripts.
- Unit/integration tests for new behavior and failure paths.
- A data preflight or backfill script when existing rows are affected.
- Type-check, lint, and relevant test results.
- A concise report of migrated, unmapped, and conflicting records.

If a decision listed under **Decisions still required** blocks correct
implementation, stop before the affected change and request that decision.
Do not choose a business mapping merely to make a test pass.

## Status and use

This document is the development specification for the filing database
redesign. Implement changes in the phase order defined below. A phase is not
complete until its listed tests and data checks pass.

No existing filing table is removed by the initial phases. `CustomsFiling`
must remain available until the new declaration structure is implemented,
backfilled, reconciled, and all consumers have migrated.

When this document conflicts with an older code comment or seed script, this
document defines the intended target behavior. Do not silently reinterpret a
field; update the source, migration, seed data, and tests together.

## Goals

- Support shipment-derived and independent customs declarations through the
  same filing workflow.
- Remove the runtime dependency between a declaration and a shipment.
- Store customs declaration data in the committed canonical JSON format.
- Use the existing import and export JSON Schema files as the schema source.
- Make the database configuration country- and procedure-independent where
  possible and release-aware where required.
- Eventually retire `CustomsFiling` without losing data or audit history.

## Agreed terminology

### Procedure code

`procedureCode` is the high-level filing procedure or schema family:

- `IMPORT`
- `EXPORT`
- `NCTS`
- `TEMP_STORAGE`
- `BONDED_WAREHOUSE`

This catalog is limited to high-level procedure families. Country-specific
declaration codes are outside the responsibility of
`FilingProcedureCatalog`.

### Release

`FilingCountryCustomsVersion.release` is the single source of truth for the
customs-authority release.

Release must not be copied into every related table. Release-scoped tables
reference `FilingCountryCustomsVersion.id` and obtain the release through that
relationship.

### Schema version

`FilingSchemas.schemaVersion` identifies a version of Qubere's committed
canonical JSON Schema. It is independent of the customs-authority release.

Example:

```text
Customs release:          NCTS-P5.1
Canonical schema version: 1.0.0
```

### Customer

In the current `FilingCustomerCustomsVersion` design, `customerId` represents
an `Account.id`. The proposed design renames this column to `accountId`.

## Committed canonical schemas

The repository currently contains these declaration schemas:

```text
apps/custom/public/schemas/customs-filing/filing-schemas/import/1.0.0/ImportDeclaration.schema.json
apps/custom/public/schemas/customs-filing/filing-schemas/export/1.0.0/ExportDeclaration.schema.json
```

Schema content remains committed to source control. The database stores the
path and version needed to locate the immutable committed file.

## Current schema-loading behavior

The schema API is implemented at:

```text
apps/custom/src/app/api/schemas/[country]/[procedure]/[message]/[type]/route.ts
```

It currently:

1. Reads the requested version from the query string.
2. Normalizes versions such as `1.0` to `1.0.0`.
3. Uses the URL `procedure` to derive the schema directory and filename.
4. Reads the JSON Schema directly from `public/schemas`.
5. Returns the parsed schema and request metadata.

Current limitations:

- The route comment says it reads `FilingProcedureConfig`, but the route does
  not query that table.
- `country`, `message`, and `type` currently do not select the schema file.
- The deprecated `schemaValidator.ts` currently returns success without
  validating the canonical document.

## Current filing tables

### Runtime tables

#### `CustomsFiling`

Current filing aggregate. It contains:

- A direct, cascading relationship to `Shipment`.
- Country, procedure, message, and release values.
- Legacy US-specific columns.
- Filing status and monetary totals.
- Maker/checker/transmitter attribution.
- Relations to messages, responses, snapshots, fees, audit records, entry
  proofs, corrections, protests, and other filing workflows.

It will remain in place during the migration.

#### `FilingSnapshot`

Stores a frozen JSON representation of shipment-derived facts at submission.
It exists because the current filing continues to read mutable shipment data
before publication.

#### `FilingMessage`

Stores inbound and outbound canonical message envelopes. It also acts as the
durable outbound queue through `queueStatus`, `lockedAt`, `attempts`, and
`processedAt`.

#### `FilingFeeLine`

Stores itemized filing fees related directly to `CustomsFiling`.

### Procedure and schema configuration

#### `FilingTransactionType`

Currently holds values that are now defined as procedure codes, such as
`IMPORT`, `EXPORT`, and `NCTS`.

Proposed change:

- Keep `FilingTransactionType` unchanged for legacy compatibility.
- Do not drop or rename this table during the redesign.
- Create a separate `FilingProcedureCatalog` table.
- Move the existing filing-configuration UI and its procedure API to
  `FilingProcedureCatalog`.
- Seed the new catalog explicitly; do not make it a live view or runtime alias
  over `FilingTransactionType`.

#### `FilingProcedureCatalog`

New authoritative catalog for high-level filing procedures:

```text
IMPORT
EXPORT
NCTS
TEMP_STORAGE
BONDED_WAREHOUSE
```

Proposed columns:

```text
id
procedureCode
isActive
createdAt
createdBy
updatedAt
updatedBy
```

`procedureCode` is unique. After existing configuration data is normalized,
`FilingProcedureConfig.procedureCode` should reference this catalog code.

#### `FilingProcedureConfig`

Currently defines valid combinations of:

```text
country + procedureCode + messageName
```

It also contains the redundant `transactionType` column.

Proposed changes:

- Drop `transactionType`.
- Add `filingCountryCustomsVersionId`.
- Add `filingSchemaId`.
- Preserve `canCreateNewFiling` and `isActive`.
- Derive the release through `filingCountryCustomsVersionId`.

#### `FilingSchemas`

New schema registry containing only:

```text
id
schemaPath
schemaVersion
```

The initial DDL design is in:

```text
docs/apps/customs/data/filing-declaration-ddl.sql
```

`FilingSchemas` does not contain `release`. The association with a customs
release comes through `FilingProcedureConfig` and
`FilingCountryCustomsVersion`.

### UI configuration

#### `FilingUIConfig`

Stores dynamic UI configuration for:

```text
country + procedureCode + messageName + messageType + release
```

`configData` contains presentation configuration such as field paths, labels,
input controls, sections, display order, help text, and master-data sources.

It does not store declaration values and does not define the canonical JSON
Schema.

Proposed change:

- Replace the copied `release` value with
  `filingCountryCustomsVersionId`.
- Keep `version` as the UI configuration revision number.

### Action configuration

#### `FilingActionCatalog`

Catalog of actions such as:

- `SUBMIT`
- `AMENDMENT`
- `CANCELLATION`
- `INVALIDATION`
- `WITHDRAWAL`
- `RESUBMIT`

This is a global catalog and is not release-scoped.

#### `FilingActionMessageMapping`

Maps an action to the outbound message for a country and procedure:

```text
country + procedureCode + action -> messageName
```

Proposed change:

- Add `filingCountryCustomsVersionId` so different releases can map the same
  action to different messages.

#### `FilingActionConfiguration`

Determines the actions available after a message reaches a particular status.
It also controls submission or resubmission through `allowSubmit`.

It does not control whether an ordinary draft can be saved.

Proposed change:

- Replace the copied `release` value with
  `filingCountryCustomsVersionId`.

#### `FilingActionDataRequirement`

Defines additional values needed to execute an action. Its `fields` JSON is
for action-specific inputs, such as a cancellation reason or amendment
justification. It is not the complete declaration UI configuration.

Proposed change:

- Replace the copied `release` value with
  `filingCountryCustomsVersionId`.

### Status configuration

#### `FilingStatusCatalog`

Contains status codes, descriptions, and localized descriptions. It does not
enforce valid status transitions. Transitions are currently enforced in:

```text
apps/custom/src/modules/filings/filingStateMachine.ts
```

Current stored status values and catalog values must use the same casing and
vocabulary before migration.

### Customs release configuration

#### `FilingCountryCustomsVersion`

Authoritative source for a release of a procedure in a country:

```text
country + procedureCode + release
```

It also stores:

- `validFrom`
- `validTo`
- `isActive`
- Audit fields

This table drives release selection for all other filing configuration.

#### `FilingCustomerCustomsVersion`

Selects a `FilingCountryCustomsVersion` for one account or makes it the global
default.

Proposed changes:

- Rename `customerId` to `accountId`.
- Add a foreign key from `accountId` to `Account.id`.
- Require `accountId` when `applyToAllCustomers` is false.
- Require `accountId` to be null when `applyToAllCustomers` is true.
- Prevent more than one active global mapping for the same customs version.
- Prevent more than one active account mapping for the same account and
  customs version.

### Master-data configuration

#### `FilingMasterDataSource`

Describes table, enum, static, or API sources used to populate UI controls.

#### Filing code-list tables

```text
FilingCodeListType
    -> FilingCodeListHeader
        -> FilingCodeListItem
            -> FilingCodeListItemTranslation
```

These provide release-aware reference values such as package types,
incoterms, and container types.

## Proposed configuration relationships

```text
FilingProcedureCatalog
    code: IMPORT | EXPORT | NCTS | ...
                    |
                    v
FilingCountryCustomsVersion
    country + procedureCode + release + validity dates
                    |
                    | filingCountryCustomsVersionId
                    v
FilingProcedureConfig --------------------> FilingSchemas
    messageName                               schemaPath
    canCreateNewFiling                       schemaVersion
    isActive
                    |
                    +----------------------> FilingUIConfig
                    |
                    +----------------------> FilingActionMessageMapping
                    |
                    +----------------------> FilingActionConfiguration
                    |
                    +----------------------> FilingActionDataRequirement

FilingCountryCustomsVersion
                    |
                    v
FilingCustomerCustomsVersion
    account-specific selection or global default
```

## Relationship rules for implementation

1. `FilingCountryCustomsVersion` owns `release`.
2. Release-scoped configuration rows reference
   `FilingCountryCustomsVersion.id`; they do not accept a separately supplied
   release during create or update.
3. `FilingProcedureConfig.country` and `procedureCode` remain in place. They
   are part of its public configuration identity.
4. A `FilingProcedureConfig` row must have the same country and procedure as
   its referenced `FilingCountryCustomsVersion` row.
5. `FilingProcedureConfig.transactionType` is removed. Code that needs the
   procedure uses `procedureCode`.
6. `FilingSchemas.schemaVersion` and
   `FilingCountryCustomsVersion.release` are different values and must never
   be substituted for one another.
7. A filing schema file remains immutable after registration. A schema change
   requires a new path or schema version.
8. `FilingUIConfig` describes presentation only. It must not become a source
   of declaration validity or declaration values.
9. `FilingActionDataRequirement` describes additional action input only. It
   must not duplicate the complete declaration form.
10. Existing configuration must be backfilled and verified before any new
    foreign key becomes `NOT NULL`.

## Proposed `FilingSchemas` DDL

```sql
CREATE TABLE "FilingSchemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schemaPath" TEXT NOT NULL,
    "schemaVersion" VARCHAR(50) NOT NULL,

    CONSTRAINT "FilingSchemas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FilingSchemas_schemaPath_schemaVersion_key"
        UNIQUE ("schemaPath", "schemaVersion")
);
```

## Proposed `FilingProcedureConfig` shape

```text
id
country
procedureCode
messageName
filingCountryCustomsVersionId
filingSchemaId
canCreateNewFiling
isActive
createdAt
createdBy
updatedAt
updatedBy
```

`country` and `procedureCode` remain because they are part of the agreed
`FilingProcedureConfig` identity. Development must enforce that they match the
referenced `FilingCountryCustomsVersion` row. This can be enforced with a
composite foreign key or in the write service plus database tests; a composite
foreign key is preferred.

Target uniqueness:

```text
country + procedureCode + messageName + filingCountryCustomsVersionId
```

This permits the same message configuration to coexist for multiple customs
releases.

## Required existing-table changes

The following is the target contract. Each change requires a normal Prisma
migration in its implementation phase; do not run ad hoc production DDL.

### `FilingTransactionType` and `FilingProcedureCatalog`

- Preserve `FilingTransactionType` and its current rows unchanged.
- Create the new `FilingProcedureCatalog` table.
- Seed approved high-level procedure codes into the new table.
- Add a new procedure-catalog API or change the existing configuration API to
  read `FilingProcedureCatalog`.
- Update the filing-configuration UI to use the new catalog.
- Do not repurpose or rename the existing transaction-type API if other
  consumers still use it; keep a compatibility endpoint until those consumers
  are identified.
- After procedure data is normalized, add referential integrity from
  `FilingProcedureConfig.procedureCode` to
  `FilingProcedureCatalog.procedureCode`.

Proposed DDL:

```sql
CREATE TABLE "FilingProcedureCatalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "procedureCode" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "FilingProcedureCatalog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FilingProcedureCatalog_procedureCode_key"
        UNIQUE ("procedureCode"),
    CONSTRAINT "FilingProcedureCatalog_procedureCode_not_blank_ck"
        CHECK (length(btrim("procedureCode")) > 0),
    CONSTRAINT "FilingProcedureCatalog_procedureCode_uppercase_ck"
        CHECK ("procedureCode" = upper("procedureCode"))
);

CREATE INDEX "FilingProcedureCatalog_isActive_idx"
    ON "FilingProcedureCatalog" ("isActive");
```

### `FilingProcedureConfig`

- Remove `transactionType` after all source reads are removed.
- Add nullable `filingCountryCustomsVersionId` for backfill.
- Add nullable `filingSchemaId` for backfill.
- Add foreign keys with `ON DELETE RESTRICT`.
- Backfill and validate all active rows.
- Make both new foreign keys `NOT NULL` for active/new configuration. If
  historical inactive rows cannot be mapped, enforce this with a check
  constraint rather than leaving active rows incomplete.
- Change uniqueness to include the customs-version reference.

### `FilingUIConfig`

- Add nullable `filingCountryCustomsVersionId`.
- Backfill it from `country`, `procedureCode`, and current `release`.
- Update reads and writes to resolve release from the referenced version.
- Remove the copied `release` column only after comparison checks pass.
- Preserve `version`; it is the UI-configuration revision.
- Update active/draft partial unique indexes to use the version reference.

### `FilingActionMessageMapping`

- Add and backfill `filingCountryCustomsVersionId`.
- Change uniqueness to:

```text
country + procedureCode + action + filingCountryCustomsVersionId
```

- Resolve the release through the referenced customs-version row.

### `FilingActionConfiguration`

- Add and backfill `filingCountryCustomsVersionId`.
- Replace copied `release` in lookups and uniqueness.
- Preserve `availableActions` and `allowSubmit` behavior.

### `FilingActionDataRequirement`

- Add and backfill `filingCountryCustomsVersionId`.
- Replace copied `release` in lookups and uniqueness.
- Preserve wildcard behavior only where it is explicitly supported by the
  action-requirement resolver.

### `FilingCustomerCustomsVersion`

- Rename `customerId` to `accountId` because it stores `Account.id`.
- Add the `Account` foreign key.
- Add the global-versus-account check constraint described above.
- Add uniqueness rules preventing competing active selections.

## Runtime schema-resolution contract

The schema API and all server-side validators must use the same resolution
algorithm:

```text
Input: accountId, country, procedureCode, messageName

1. Resolve the active FilingCountryCustomsVersion for the account.
2. Find the active FilingProcedureConfig for:
   country + procedureCode + messageName + customsVersionId.
3. Follow filingSchemaId to FilingSchemas.
4. Resolve schemaPath relative to apps/custom/public.
5. Reject absolute paths and paths containing traversal segments.
6. Read the committed JSON Schema.
7. Verify the schema version matches FilingSchemas.schemaVersion.
8. Validate declaration JSON with AJV.
9. Fail closed when configuration, file loading, or validation fails.
```

The client may request a schema for rendering, but it must not select an
arbitrary filesystem path or authoritative release. The server resolves both
from configuration.

## Source-code impact list

At minimum, development must update:

- `apps/custom/src/app/api/schemas/[country]/[procedure]/[message]/[type]/route.ts`
- `apps/custom/src/lib/canonicalMessaging/schemaValidator.ts`
- `apps/custom/src/lib/canonicalMessaging/resolveMessageContext.ts`
- `apps/custom/src/modules/filings/filing.service.ts`
- `apps/custom/src/app/api/filing-config/procedure-configs/route.ts`
- `apps/custom/src/modules/filingConfig/registry.ts`
- `apps/custom/src/app/app/filing-config/UIConfigEditor.tsx`
- Filing configuration seed and verification scripts
- Prisma schema and generated client

The current deprecated validator must not remain a successful no-op after
schema-based declaration writes begin.

## Target declaration direction

A future `FilingDeclaration` will store the complete declaration request as
canonical JSON. It must support both creation modes:

### Shipment-derived declaration

```text
Shipment data
    -> map once into canonical JSON
    -> validate against FilingSchemas
    -> create independent FilingDeclaration
```

The shipment ID may be recorded inside the canonical source/provenance data,
but it will not be a database foreign key required to operate the declaration.

### Independent declaration

```text
Country/release selection
    -> FilingCountryCustomsVersion
    -> FilingProcedureConfig
    -> FilingSchemas
    -> empty canonical form
    -> create FilingDeclaration
```

After creation, shipment-derived and independent declarations use the same
validation, action, approval, transmission, and response workflow.

## Migration principles

1. Create new tables alongside existing tables.
2. Do not drop `CustomsFiling` during initial development.
3. Correct procedure-code meaning in existing data and seed scripts.
4. Create `FilingSchemas` and register committed schemas.
5. Normalize release relationships through
   `FilingCountryCustomsVersion.id`.
6. Remove `FilingProcedureConfig.transactionType` only after application
   consumers stop reading it.
7. Introduce the independent declaration table and canonical mapping.
8. Backfill existing filings without discarding unmapped fields.
9. Reconcile identifiers, statuses, totals, messages, and audit records.
10. Migrate every `CustomsFiling` consumer.
11. Stop legacy writes.
12. Remove `CustomsFiling` only in a later deployment after verification.

## Development phases

### Phase 1: schema registry

- Create `FilingSchemas` from the reviewed DDL.
- Register the committed import and export schema paths only after their exact
  schema versions are confirmed.
- Add repository tests that reject blank paths, blank versions, and duplicate
  path/version pairs.
- Do not change live schema resolution yet.

### Phase 2: release and procedure cleanup

- Create and seed `FilingProcedureCatalog` without changing
  `FilingTransactionType`.
- Move the filing-configuration UI and procedure lookup API to the new
  catalog.
- Normalize procedure-catalog values.
- Remove runtime reads of `transactionType`.
- Drop `FilingProcedureConfig.transactionType` only after compilation and
  tests prove it is unused.

### Phase 3: configuration relationships

- Add nullable customs-version and schema references.
- Backfill each active procedure configuration.
- Add relationship integrity and uniqueness constraints.
- Update UI/action configuration to use the customs-version reference.
- Make required relationships non-null after reconciliation.

### Phase 4: schema resolution and validation

- Replace procedure-derived filesystem path construction with database-backed
  resolution.
- Restore real AJV validation.
- Add path-safety checks and schema caching keyed by schema ID/version.
- Update dynamic-form loading to use the same resolved schema.

### Phase 5: independent declaration storage

- Design and approve `FilingDeclaration` DDL separately.
- Support shipment-derived canonical initialization.
- Support independent canonical initialization.
- Keep both modes identical after declaration creation.
- Continue writing/reading `CustomsFiling` until migration validation is
  complete.

### Phase 6: legacy migration and retirement

- Backfill every `CustomsFiling` field into canonical declaration paths.
- Migrate message, response, audit, entry-proof, correction, protest, and
  related consumers.
- Run count, identifier, status, total, and payload reconciliation.
- Stop legacy writes.
- Retire and later drop `CustomsFiling` in a separate release.

## Acceptance criteria

### Configuration

- Every active `FilingProcedureConfig` resolves exactly one active customs
  version and one registered filing schema.
- No active configuration has a mismatched country or procedure.
- No application or seed code reads or writes
  `FilingProcedureConfig.transactionType`.
- Account-specific release selection overrides the global default
  deterministically.
- At most one applicable active release is returned for an account, country,
  procedure, and effective date.

### Schema resolution

- `IMPORT` resolves the committed import schema through `FilingSchemas`.
- `EXPORT` resolves the committed export schema through `FilingSchemas`.
- An unknown procedure, message, version mapping, or missing file fails with a
  controlled error.
- A malformed canonical declaration fails AJV validation.
- Schema paths cannot escape `apps/custom/public`.
- Customs release and canonical schema version are reported separately.

### Migration safety

- Existing `CustomsFiling` rows remain unchanged in the early phases.
- Existing active configuration rows have an explicit migration result.
- No column is dropped while a compiled application path still uses it.
- Backfill scripts are idempotent and report unmapped and conflicting rows.
- Rollback is possible until the legacy-write cutoff phase.

### Future declarations

- A shipment-derived declaration remains usable after its source shipment is
  changed or archived.
- An independent declaration uses the same configuration, validation, action,
  and transmission workflow.
- All legacy `CustomsFiling` business fields have documented canonical paths
  before legacy retirement.

## Confirmed decisions

- `procedureCode` means `IMPORT`, `EXPORT`, `NCTS`, and similar procedure
  families.
- `FilingTransactionType` remains in place and is not renamed or dropped.
- A new `FilingProcedureCatalog` table supplies procedure values to the filing
  configuration UI.
- `FilingProcedureConfig.transactionType` is redundant and will be removed.
- `FilingSchemas` contains `id`, `schemaPath`, and `schemaVersion`.
- Canonical schema content remains committed in source control.
- `FilingCountryCustomsVersion` drives release.
- Release values are referenced, not duplicated across configuration tables.
- `FilingUIConfig` controls presentation, not schema validity or declaration
  storage.
- `CustomsFiling` remains until the replacement is complete and reconciled.

## Decisions still required

- Authority releases associated with the two existing `1.0.0` canonical
  schemas.
- Canonical schemas required for procedures other than import and export.
- Whether request and response messages use separate schema records.

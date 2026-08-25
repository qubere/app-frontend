# Restricted / Denied-Party Screening — Final Implementation Report

Status: implementation complete (code, schema, tests, UI). One operational
step (permission-catalogue sync) is deliberately left for a human admin —
see Section K. Results now surface in the Compliance Workspace's Party
Screening sub-tab — see Section L. Dow Jones ingestion and a legacy-schema
gap-closure pass were added 2026-08-24/25 — see Section N.

## A. Scope and objective

Implements a sixth deterministic compliance-screening module — Restricted /
Denied-Party Screening — screening Party Master records, shipment/line-level
parties, and ad-hoc API/Copilot requests against government denial-order
lists (OFAC SDN, Consolidated Non-SDN, BIS Denied Persons List, and five
other `ScreeningEntity.sourceList` values not already owned by an existing
module), plus an independent red-flag word scan. Ports the intent of the
legacy `PartyScreening_Prompt.md` / `PartyScreening_Tables.sql` spec onto this
codebase's existing `ScreeningEntity`/`ComplianceKeywordRule` reference-data
pipeline rather than recreating Oracle-shaped tables with no ingestion behind
them.

## B. Architecture

New module at `src/modules/agents/compliance/restrictedParty/`, mirroring the
house `types.ts` + `xRepository.ts` + `xScreening.ts` layout used by
`forcedLabor`/`endUser`/`endUse`/`antiBoycott`/`militaryEndUse`:

| File | Responsibility |
|---|---|
| `types.ts` | Shared input/output/status types, `DEFAULT_NAME_THRESHOLD` (80), `REVIEW_FLOOR_SCORE` (50) |
| `normalize.ts` | Uppercase/diacritic-strip/punctuation-strip normalization, tokenize, hardcoded `COMMON_WORDS` stop-list |
| `phoneticMatch.ts` | Self-contained Double Metaphone (public-domain algorithm port, no dependency) |
| `metaphone2.ts` | Self-contained classic single-code Metaphone2 port, selectable per account via `AccountScreeningConfig.phoneticAlgorithm` |
| `candidateGeneration.ts` | Pure shortlisting: EXACT / RAW_WORD / DOUBLE_METAPHONE / METAPHONE2 / ALTERNATE_WHOLE_WORD candidate reasons |
| `scoring.ts` | Wraps `scoreDpsMatch` (`src/lib/screening/dpsScreening.ts`) with an address-score gate and country-match gate |
| `redFlagCheck.ts` | Independent keyword scan via `screenText` (`src/lib/screening/keywordMatch.ts`) |
| `suppression.ts` | Flags (never deletes) matches suppressed by a prior approved/false-positive disposition |
| `restrictedPartyRepository.ts` | Reads `ScreeningEntity`/`ComplianceKeywordRule`/`RestrictedPartyDisposition`; owns `getShipmentPartiesForScreening` |
| `restrictedPartyScreening.ts` | Orchestrator: `runRestrictedPartyScreening(input)` — party-name pass + independent contact-name pass |
| `shipmentScreening.ts` | Shipment-level aggregation: `runRestrictedPartyScreeningForShipment` — walks all `ShipmentParty` rows, worst-of-outcomes rollup |
| `partyScreeningLifecycle.ts` | Party Master lifecycle: `rescreenParty`, `markStaleIfChanged`, `PartyHasNoActiveNameError` |
| `persistResult.ts` | Single-transaction write of result + matches + red-flag hits + PENDING disposition (HIT/REVIEW_REQUIRED only) |

## C. Database schema

Five new Prisma models plus five new enums (`prisma/schema.prisma`):
`RestrictedPartyScreeningResult` (immutable, one row per pass),
`RestrictedPartyMatch`, `RestrictedPartyRedFlagHit`,
`RestrictedPartyDisposition` (mutable, 1:1 with a result — the only layer a
human reviewer can change), and `PartyScreeningSummary` (1:1 satellite on
`Party`, kept off `Party` itself so high-churn re-screening state never
touches that model's migration surface or indexes). Migration:
`prisma/migrations/20260816134512_add_restricted_party_screening/` — additive
only, no backfill, reviewed before applying.

**Drift found and fixed (2026-08-17):** this migration was recorded as
applied in Prisma's `_prisma_migrations` ledger (`prisma migrate status`
reported "up to date"), but the tables themselves had never actually been
created in the shared dev database — a build of the Compliance Workspace UI
(Section M) hit `The table public.RestrictedPartyScreeningResult does not
exist` at runtime. Fixed by re-running this migration's SQL directly via
`prisma db execute`; all five tables were verified to exist afterward via a
direct `information_schema.tables` query. Root cause of the drift itself
(how the ledger came to disagree with the database) was not investigated
further, since fixing the immediate breakage was the priority — anyone
hand-authoring a migration and marking it applied with `prisma migrate
resolve --applied` outside of `migrate deploy` should verify the tables
actually exist afterward, not just trust the ledger.

**Convention decision (carried from an earlier session in this
implementation):** all seed/reference rows this module reads
(`ScreeningEntity`, `ComplianceKeywordRule`) are gated on
`publicationStatus: "PUBLISHED"` — a DRAFT row is invisible to every
screening pass. This is the existing repo-wide convention (shared with
`forcedLabor`/`endUser`/etc.), reused unchanged rather than inventing a
parallel gating mechanism for this module.

## D. Matching algorithm

1. **Normalization** (`normalize.ts`): uppercase → strip diacritics → strip
   punctuation → collapse whitespace → strip `COMMON_WORDS` (legal-entity
   suffixes/connectors, an explicitly abbreviated starter list — same
   honesty convention as `ADD_CVD_ALERTS`/`FDA_CHAPTERS`).
2. **Candidate shortlisting** (`candidateGeneration.ts`): a reference entity
   is worth scoring if it has an EXACT normalized-name match, a shared
   significant (>3-char) raw word, or a Double Metaphone collision.
   Shortlisting itself is never the pass/fail signal — only scoring decides
   that — so it can never be the source of a false CLEAR.
3. **Scoring** (`scoring.ts`): `scoreDpsMatch` on the stop-word-stripped
   forms; a candidate below `REVIEW_FLOOR_SCORE` (50) is discarded as noise,
   never surfaced. `nameScore >= nameThreshold` (default 80, request
   override permitted) → `HIT` tier, else `REVIEW_REQUIRED`. An optional
   address-score gate and country-match gate each downgrade a `HIT` to
   `REVIEW_REQUIRED` — evidence retained, never discarded.
4. **Red-flag check** (`redFlagCheck.ts`): fully independent of denial-order
   matching — a red flag can fire with zero denial-order matches, and vice
   versa.
5. **Suppression** (`suppression.ts`): a match against a `screeningEntityId`
   with a prior `APPROVED`/`FALSE_POSITIVE` disposition for the same party is
   flagged `suppressedByApprovedParty`, excluded from `hitCount`/status
   computation, but never deleted — full evidence trail survives.
6. **Status derivation** (per pass, in `restrictedPartyScreening.ts`):
   `hasSignal && hasErrors → PARTIAL`; `hasHit → HIT`; `hasSignal → REVIEW_REQUIRED`;
   `hasErrors (no signal) → ERROR`; `no check ran at all → SKIPPED`; else `CLEAR`.
   No reference data loaded (and no red-flag rules loaded) can ever resolve
   to `CLEAR` — only `SKIPPED`, matching every sibling module's discipline.

A party-name pass and a contact-name pass (run only when a contact name is
present) are fully independent `RestrictedPartyPassOutcome` entries — they
never share candidate accumulation, scoring, or status.

## E. Party Master lifecycle

`rescreenParty(accountId, partyId, options?)` resolves the current-effective
name/address/contact (status `ACTIVE`, primary-then-most-recent — the same
selection pattern already used elsewhere for these three models), runs both
passes, persists them, and upserts `PartyScreeningSummary` with the *worse*
of the two pass outcomes (`HIT(5) > REVIEW_REQUIRED(4) > PARTIAL(3) >
ERROR(2) > SKIPPED(1) > CLEAR(0)`). Throws `PartyHasNoActiveNameError` when
there is nothing to screen — never silently reports CLEAR.

`markStaleIfChanged(tx, accountId, partyId)` is called from identity-fact
write paths (`PartyName`/`PartyAddress`/`PartyContact` mutations) inside
their own transaction: recomputes the identity hash, and a mismatch against
`PartyScreeningSummary.currentInputHash` flips `screeningStatus` to `STALE`.
This is identity-change-driven, not clock-driven — no fixed rescreen
interval/TTL exists anywhere in this codebase, and none was invented here.
Best-effort: any internal failure is swallowed so a screening-summary hiccup
can never block an unrelated party edit.

## F. ComplianceAuditAgent integration

Wired into the existing agent (`src/modules/agents/complianceAuditAgent.ts`)
as a sixth concurrent call in the existing `Promise.all` batch — no shared
data dependency with the other five checks. Because the agent's existing
`context.parties: EmbargoParty[]` lacks address/contact fields, it calls the
new `getShipmentPartiesForScreening(shipmentId)` directly rather than reusing
`input.parties`. New `AuditCheckResult.category` values `RESTRICTED_PARTY`
and `PARTY_RED_FLAG`; `SKIPPED`/`ERROR` surface as `SCREENING_GAP` rows, same
convention as every other module's gap reporting. Severity: `CRITICAL` for
denial-order hits, `HIGH` for red-flag-only hits. Confidence/coverage
divisor moved from 9 to 10 to account for the new factor.

## G. Public API

Five new routes under `/api/v1/`:

| Method & path | Auth | Permission / scope |
|---|---|---|
| `POST /screening/restricted-party` | API key | `compliance.restrictedParty.screen` |
| `GET /screening/restricted-party/[screeningId]` | Session | `compliance.restrictedParty.read` |
| `PATCH /screening/restricted-party/[screeningId]/disposition` | Session | `compliance.restrictedParty.dispose` |
| `GET /parties/[partyId]/restricted-party-screening-history` | Session | `compliance.restrictedParty.read` |
| `POST /parties/[partyId]/restricted-party-screening/rescreen` | Session | `compliance.restrictedParty.screen` |

The public API-key route additionally enforces a per-key sliding-window rate
limit (`restrictedPartyRateLimit.ts`, 60 requests/60s, modeled on the
assistant chat rate limiter (`src/modules/assistant/shared/rateLimit.ts`) — explicitly documented as in-memory/per-instance, a
guard against a runaway integration rather than a defence against a
determined attacker) and `Idempotency-Key` support (`idempotency.ts`) so ERP
retries never duplicate immutable screening history. All four session-auth
routes enforce the tenant-scoping invariant: a `partyId`/`screeningId`
belonging to another account resolves as 404, never 403 (no
account-enumeration oracle). All five routes are registered in
`scripts/generate-openapi.ts` and reflected in `docs/openapi.yaml`.

## H. Copilot integration

Three tools were originally added to `src/modules/copilot/tools/complianceTools.ts`
(auto-registered via the `complianceTools` array): `screenRestrictedParty`
(rescreens an existing `partyId` or screens an ad-hoc identity),
`getRestrictedPartyScreeningDetails`, and
`getPartyRestrictedPartyScreeningHistory`. That module was never wired into
any live route and has since been deleted (2026-08-21); the same three
capabilities now live directly in the registry the `/chat` route actually
imports (`src/modules/assistant/tools.ts`) as `screen_restricted_party`,
`get_restricted_party_screening_details`, and
`get_party_restricted_party_screening_history`. Each follows the live
registry's own contract — a zod `schema` validated via `safeParse` inside
`execute`, tenant-scoped queries keyed off `ctx.accountId` (never a
model-supplied value) — and `screen_restricted_party`, the one mutating tool
of the three, declares `access: { permission: "compliance.restrictedParty.screen" }`,
asserted by `tests/assistant-tools-rbac.test.ts`. No matching logic lives in
any prompt — the model only calls these deterministic tools and summarizes
their output.

## I. Permissions

Three new permissions added to `PERMISSION_CATALOGUE`
(`src/lib/permissions.ts`), dot-namespaced consistent with the existing
`embargo.read`/`.screen` convention: `compliance.restrictedParty.read`,
`compliance.restrictedParty.screen`, `compliance.restrictedParty.dispose`
(admin-only, mirrors `exceptions.waive`/`risk.accept`).

**Decision:** this codebase has no separate API-key-scope catalogue —
permission names are reused verbatim as API-key scope strings via
`apiKeyHasScope(ctx, scope)`. Rather than introducing a parallel
`screening.restrictedParty.*` scope namespace (as an earlier draft of the
plan proposed), the same three permission strings serve both purposes,
consistent with how every other existing API-key-gated endpoint in this
codebase already works.

## J. Testing

Seven new Vitest files under `tests/` (house convention — all tests live at
the top level, not colocated under `src/`), 61 tests total, all passing,
zero `tsc --noEmit` errors:

- `restricted-party-screening.test.ts` (17) — orchestrator: missing-reference-data-never-CLEAR,
  required-field validation, HIT/REVIEW_REQUIRED tiers, red-flag independence,
  party/contact-pass isolation, approved-party suppression, PARTIAL/ERROR
  derivation, tenant safety.
- `restricted-party-normalize.test.ts` (10) — pure normalization functions.
- `restricted-party-phonetic.test.ts` (5) — Double Metaphone spot checks.
- `restricted-party-lifecycle.test.ts` (9) — `rescreenParty`,
  worst-of-outcomes rollup, `markStaleIfChanged` hash comparison and
  best-effort failure handling.
- `restricted-party-rate-limit.test.ts` (4) — sliding-window behavior,
  per-key isolation, window expiry.
- `restricted-party-shipment-screening.test.ts` (7) — shipment aggregation,
  suppressed-match exclusion, red-flag independence, per-party skip/error
  surfacing.
- `api-v1-restricted-party-screening.test.ts` (9) — auth/scope/rate-limit/idempotency
  gating, successful screen + audit + idempotency persistence, accountId
  never taken from the request body.

Each file was run individually (`npx vitest run tests/<file>`) per this
project's standing convention of never running the full suite (slow, hits a
shared live database).

## K. Known gaps and deliberate scope boundaries

- **Six of eight target `sourceList` values had zero `PUBLISHED`
  `ScreeningEntity` rows at the time of this implementation**
  (`DPL`, `ISN`, `SSI`, `FSE`, `PLC`, `NS_MBS` — only `SDN` and
  `CONSOLIDATED_NON_SDN` are actively ingested by an existing pipeline
  today). The screening module itself is correct and will screen against
  these lists the moment ingestion publishes rows for them; until then, any
  match against those six lists is structurally impossible, not a bug.
  Ingesting those additional BIS/State-Department lists is out of scope for
  this implementation (it is an ingestion-pipeline task, not a
  screening-engine task) and was not attempted.
- **Phonetic matching** is a lightweight, dependency-free, in-repo Double
  Metaphone port used only for candidate shortlisting — not a certified
  third-party library, and never itself the pass/fail signal.
- **No citation/legal-text data** exists anywhere upstream on
  `ScreeningEntity`; `RestrictedPartyMatch.denialType`/`agency`/`citation`
  are nullable and best-effort, never required for a valid match.
- **No fixed rescreen interval/TTL** exists in this codebase for any
  screening module; staleness here is identity-change- and
  republish-driven, matching that existing norm rather than inventing a
  clock-based policy unilaterally.
- **The public API's rate limiter is in-memory, per server instance**,
  reset on cold start — an honest, documented limitation carried over
  verbatim from the existing `copilotRateLimit.ts` pattern, not a gap unique
  to this feature.

## L. UI integration — Compliance Workspace

Party Screening results are exposed through a new two-tier tab structure at
`/app/compliance` (`ComplianceWorkspaceClient.tsx`), added after this
module's backend was already in place. Top-level tabs — Overview, Screening,
Review Queue, Audit History — follow the existing flat pill-tab convention
used elsewhere in the app (`ShipmentTabsPanel.tsx`); this codebase had no
prior two-tier tab pattern, so a smaller secondary pill row
(`ScreeningPanel.tsx`) was added under the Screening tab rather than a
second vertical sidebar, matching how `src/lib/navigation.ts` has no
submenu concept at all.

The Screening tab's sub-tabs are: **Party Screening** (this module — gated
on `compliance.restrictedParty.read`, reads `RestrictedPartyScreeningResult`
+ `RestrictedPartyMatch` + `RestrictedPartyRedFlagHit` + disposition
account-wide, not just per-party), **Country Embargo**, **Forced
Labor / UFLPA**, **End-Use / End-User** (combined), **Military
End-Use / End-User** (combined), and **Anti-Boycott**.

The five non-party categories had no persisted, queryable results table
before this UI work — `ComplianceAuditAgent`'s output for those categories
only ever reached per-shipment JSON blobs. A new generic
`ComplianceScreeningFinding` model (`prisma/migrations/
20260816180000_add_compliance_screening_finding/`) was added to close that
gap: `persistComplianceScreeningFindings()`
(`src/modules/compliance/screeningFindings.ts`) is called from
`pipelineOrchestrator.ts` right after `ComplianceAuditAgent.execute()`,
bucketing each failing `AuditCheckResult` into one of the five categories
(directly by `category`, or by matching gap-rule-name text for
`SCREENING_GAP` rows) and persisting one row per finding. This table is
deliberately separate from `RestrictedPartyScreeningResult` — Restricted
Party / Party Red Flag findings are never duplicated into it, matching this
report's Section C decision to keep RPS's own tables as the single source
of truth for that category. Findings are resolved via
`POST /api/screening-findings/[id]/resolve` (reuses the `exceptions.resolve`
permission, not a new one).

## M. Deferred manual step

`syncPermissionCatalogue`/`POST /api/admin/permissions/sync` has **not** been
run by this implementation. That sync writes `Permission` and
`RolePermission` rows across every system role on the live shared database —
a materially broader and harder-to-reverse blast radius (platform-wide
authorization state) than any other change made in this implementation, and
it is already gated behind an authenticated admin session requiring
`account.manage` for exactly that reason. The three new permissions are
fully defined in code (`PERMISSION_CATALOGUE`) and every route/tool already
checks them correctly; they simply will not be grantable to any role via the
admin UI until an admin explicitly triggers that sync. This is the one
remaining step required before the feature is reachable by end users.

## N. Dow Jones ingestion & legacy Oracle schema gap closure (2026-08-24/25)

### N.1 Dow Jones full-feed ingestion

A new reference-data source was added at `src/modules/screening/dowJones/`:

| File | Responsibility |
| --- | --- |
| `dictionaryParser.ts` | Streams just the `<SanctionsReferencesLists>` header dictionary out of the multi-hundred-MB feed (never buffers the full file) into a `Map<code, {name, status}>` |
| `sourceListMapper.ts` | Deterministic, rule-based mapping from a Dow Jones list name to `{authority, sourceList, category}` — an explicit map for ~19 well-known lists, pattern-rule fallback for others, and a generic fallback that never collapses an unrecognized list into `SDN`/`CONSOLIDATED_NON_SDN` |
| `entityTransformer.ts` | Pure `transformEntity()` converting one parsed `<Entity>` into the DB-ready shape: provider lineage, all aliases, all addresses (primary-flagged), all identifiers, all regulatory references (resolved via the dictionary + mapper) |
| `fullFeedIngestionService.ts` | `ingestDowJonesFullFeed()` — streaming XML parse, hard completeness check against an independently supplied expected count (aborts with nothing written on mismatch), batched upserts (batch size 8, tuned to the Supabase pgbouncer pool limit) with transient-error retry, idempotent delete-then-recreate of child rows per entity, and a local resume-cursor file for interrupted runs |

Unlike OFAC/BIS/UFLPA (one denial-order-per-row, deduplicated by
`entityHash(sourceList, name, country)`), Dow Jones profiles are deduplicated
by `(provider, providerRecordId)` and can carry **multiple** regulatory
references per entity — the schema (`ScreeningEntityAlias`/`Address`/
`Identifier`/`Reference`, all cascade-FK'd to `ScreeningEntity`) was designed
around that, not around the legacy one-record-per-denial-order assumption.

### N.2 Legacy Oracle schema gap analysis

Per `Qubere_RPS_Legacy_Oracle_Schema_Gap_Analysis_Claude_Code_Prompt.md`, the
current Prisma schema was compared field-by-field against the legacy Oracle
RPS DDL (`PartyScreening_Tables.sql`: `tables_of_denial_orders`,
`denied_words`, `common_words`, `citation_text`, `citations`,
`SUBSCRIBER_PARTY_LIST`, `TRADING_PARTNER`). Most of the target architecture
the legacy schema implies was already present (provider lineage,
`ScreeningEntityReference`/`Alias`/`Address`/`Identifier`,
`AccountScreeningConfig`, red-flag terms via `ComplianceKeywordRule`). The
confirmed gap was five fields on `ScreeningEntityReference`, added via
migration `20260825010000_rps_reference_regulatory_action_fields` (additive,
nullable, unbackfilled):

| Field | Legacy source | Purpose |
| --- | --- | --- |
| `restrictionType` | `TDO_TYPE_OF_DENIAL` | provider-neutral restriction/denial classification |
| `orderNumber` | `TDO_NO_TDO` | denial/action/order number |
| `orderDate` | `TDO_DT_TDO` | denial/action/order date (distinct from effective/publication date) |
| `publicationDate` | `TDO_DT_FR_CIT` | citation/Federal-Register publication date |
| `citationUrl` | `CIT_URL` | link to the regulatory citation |

None of these are populated by any current ingestion source (OFAC/BIS/UFLPA/
Dow Jones) — wiring them into ingestion or the matcher was deliberately
deferred rather than fabricating values, consistent with this module's
existing "no invented data" discipline. Explicitly **not** recreated, per the
legacy-artifact classification in the gap-analysis prompt: the fixed
`TDO_NAME_WORD1..15`/`TDO_ADDR_WORD1..15`/Soundex columns, the `DENIED_WORDS`
word-index table, `SUBSCRIBER_PARTY_LIST`, and `TRADING_PARTNER` duplication
onto `Party` (screening state there is already covered by
`PartyScreeningSummary`). `TDO_TYPE`'s mapping to `ScreeningEntity.entityType`
was left unresolved — its actual value semantics can't be verified without
the legacy data itself, and the prompt explicitly forbids guessing enum
mappings.

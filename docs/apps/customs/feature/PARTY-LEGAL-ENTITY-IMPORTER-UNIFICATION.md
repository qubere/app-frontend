# Party / LegalEntity / ImporterOfRecord Unification

> Created: 2026-09-04.
> Status: **Proposed.** No code yet. Follow-up epic to
> [`CLIENTS-IMPORTERS-ONBOARDING-REDESIGN.md`](./CLIENTS-IMPORTERS-ONBOARDING-REDESIGN.md) §7.4 (issue #316),
> which deferred this exact migration as "large, separate epic."
> Related: [`product-and-party-master.html`](../../../../apps/custom/public/deck/product-and-party-master.html)
> (the customer-facing story this makes fully true), issue #238 (F11 · Product & Party Master — spec, the
> older/broader spec this narrows and operationalizes).

---

## 1. Intention

### 1.1 The finding that makes this an easy call, not a judgment call

While scoping #316 we found something worth stating up front: **this migration doesn't require inventing
anything.** The target already exists in the schema, half-wired:

- `Party` already has `PartyRoleType.IMPORTER` in its role enum — **unused**. Nothing today ever creates a
  `PartyRole` with that value.
- `Party` already has a proven **capacity-extension pattern**: `CarrierProfile.partyId String @unique` +
  `Party party @relation(...)` — a party that plays the carrier role gets a 1:1 `CarrierProfile` extension
  carrying SCAC/DOT/MC/insurance/safety status. `License.licensesAsPurchaser Party[]` is the same idea for
  the licensing role. **`ImporterOfRecord` should be exactly this pattern for the importer role** —
  `ImporterOfRecord.partyId @unique` instead of the ad hoc `name` / `irsEin` / `address Json` fields it
  duplicates today.
- `LegalEntity` already carries the bridge: `LegalEntity.partyId String?` — the schema comment names it
  outright: *"Nullable backfill pointer at the Global Party Master, mirroring `CanonicalProduct.productId`."*
  Someone already started this migration as a preparatory step and stopped before finishing it.
- `CanonicalProduct.productId → Product` is a **completed instance of the identical migration on the product
  side** — its comment reads *"the row is kept rather than dropped so nothing is lost."* `CanonicalProduct`
  is still read by `classificationCaseEngine.ts`, `partMasterMatch.ts`, `productMasterService.ts`, and
  others, years after `Product` (the Global Product Master) shipped. That is the proven playbook: **bridge,
  don't drop; migrate readers on their own schedule; keep the legacy row as history.**

So this issue is not "design a new master and migrate onto it." It's **"finish wiring `LegalEntity` and
`ImporterOfRecord` onto the `Party` infrastructure the same way `CarrierProfile` and `Product` already did,
using the exact same bridge pattern already sitting in the schema."**

### 1.2 The problem this leaves unsolved if skipped

- `entityResolutionService.ts` fuzzy-matches parsed document text against `LegalEntity` and creates new
  `LegalEntity` rows on low confidence — **reimplementing**, less rigorously, exactly what `PartyName`
  (`normalizedName`), `PartyIdentifier` (`normalizedValue`), `PartyEvidence`, and `PartyChangeEvent` exist to
  do correctly and with an audit trail. Every day this ships more, the two matching systems diverge further
  and the eventual migration gets harder.
- A supplier that later becomes an importer (or vice versa) has **no way to be recognized as the same
  company** — `LegalEntity` and `ImporterOfRecord` don't share an identity space, so #316's E10 ("register an
  existing party as an importer") can only be built as a heuristic name/EIN match, not a real "this is the
  same record" operation, until this ships.
- The product-and-party-master sales pitch — *"one party record, N roles, no duplicate identities"* — is
  **not actually true for importers today.** This issue is what closes that gap between the pitch and the
  product.

### 1.3 Goals

1. **One party record per real-world company, account-wide.** A company that is a manufacturer on some
   products and your client's importer of record is **one row**, with two roles.
2. Reuse `Party`'s existing identity infrastructure (names, addresses, identifiers, registrations, contacts,
   screening, change events, evidence) instead of `ImporterOfRecord` and `LegalEntity` each re-deriving a
   thinner version of the same facts.
3. **No new table.** Retrofit onto `Party`, `PartyRole`, `PartyIdentifier`, `PartyRegistration` — all of
   which exist today and are already used by `CarrierProfile` for an analogous role.
4. Ship in slices small enough to review, following the `CanonicalProduct → Product` precedent: bridge first,
   migrate readers next, freeze the legacy table last — never a single big-bang cutover.
5. Land a genuine, demoable **customer-facing win**, not only internal cleanup (§3.5).

### 1.4 Non-goals

- Building new Party UI from scratch — the party detail page, search, and role management already exist for
  carriers/suppliers/manufacturers (per `product-and-party-master.html`). This issue extends that surface to
  cover importers; it does not redesign it.
- Re-litigating #316's Client/Importer/Onboarding IA — that ships independently. §7 below is specifically
  about **sequencing the two** so #316 doesn't build against a field this issue immediately obsoletes.
- Dropping `LegalEntity` or `CustomsProfile`. Per the `CanonicalProduct` precedent, they are bridged and
  frozen, not deleted, in this issue.
- International party identifiers (EORI, VAT) beyond what `PartyIdentifierType` already declares — no new
  identifier types are added here.

---

## 2. Domain boundaries & why this is intuitive

### 2.1 The boundary

| Layer | Answers | Model |
|---|---|---|
| **Identity** — who is this company, in the world | Legal + trade names, addresses, tax/registration numbers, contacts | `Party` + `PartyName` / `PartyAddress` / `PartyIdentifier` / `PartyRegistration` / `PartyContact` |
| **Roles** — what does this company do for us | Supplier, manufacturer, carrier, buyer, seller, **importer** — any number, each with its own status and effective window | `PartyRole` (`roleType: IMPORTER`, etc.) |
| **Capacity extension** — the role-specific facts that don't belong on identity | Carrier → SCAC/DOT/insurance (`CarrierProfile`). **Importer → CBP registration/POA/bond/screening** (`ImporterOfRecord`, retrofitted) | 1:1 extension keyed by `partyId` |

One-line test for reviewers: *if a fact is true about the company no matter what it's doing for you, it's on
`Party`. If it's only true because of one specific role, it's on that role's extension.* A CBP importer
number is a registration **claim** the party holds (`PartyRegistration`); the POA, the bond, and the 5106
status are only meaningful **because** the party plays the importer role — they live on `ImporterOfRecord`.

### 2.2 Why this makes the product more intuitive, not just tidier

- **Search once, find everywhere.** Today, searching "Acme" on `/app/parties` and searching "Acme" on
  `/app/importers-of-record` can return two unrelated records for the same real company. After this, one
  search surfaces one party with a role badge for each thing it does.
- **A relationship's history survives a role change.** A manufacturer that later becomes your client's
  importer of record keeps its screening history, its known aliases, its prior document links — because it's
  the same `Party` row gaining a role, not a new record starting from zero (this is E10 from #316, now a real
  operation instead of a name-match heuristic).
- **One matching engine, one audit trail.** Every "is this the same company as an existing record" decision —
  from a parsed document, from ERP sync, from onboarding — goes through the same `PartyChangeEvent` /
  `PartyEvidence` machinery and the same reviewer UI, instead of three different ad hoc dedupe implementations
  (today: `entityResolutionService.ts` for documents, the onboarding entities route's `irsEin` check, and
  whatever ERP sync does).
- **The importer detail page gains an "Also known as" panel for free** — "this company is also a supplier on
  4 products, screened 2026-08-02" — because it's now reading the same party graph the product/supplier
  pages read. This is the concrete, demoable payoff (§3.5).

---

## 3. User flows

### 3.1 Nothing changes on day one, by design

The `/api/importers` contract from #316 (§6) does not change its shape. What changes is what's *behind*
`POST /api/importers`: instead of creating a `LegalEntity` row, it creates (or links) a `Party` with an
`IMPORTER` role and a `partyId`-keyed `ImporterOfRecord`. An operator onboarding an importer sees the exact
same wizard from #316. This is deliberate — the retrofit is invisible to the day-to-day onboarding flow; the
payoff shows up in search, dedupe, and the new "also known as" panel.

### 3.2 Happy path — creating a new importer (post-migration)

| Step | What happens |
|---|---|
| 1 | Operator submits the Importer step in onboarding: legal name, EIN, address, entity type. |
| 2 | Server calls `resolvePartyForCompany({ accountId, name, taxId, address })` — the **same** matching path used everywhere else a company is resolved (document extraction, ERP sync). No exact match → creates one `Party` (`kind: ORGANIZATION`) + `PartyName` (LEGAL) + `PartyAddress` (REGISTERED) + `PartyIdentifier` (`TAX_ID`, the EIN). |
| 3 | Creates `PartyRole { partyId, roleType: IMPORTER, status: ACTIVE }`. |
| 4 | Creates `ImporterOfRecord { partyId (unique), clientId, registrationStatus: pending_5106 }` — no name/EIN/address duplicated on this row anymore; they're read through `party`. |
| 5 | Rest of onboarding (5106, POA, bond, screening) proceeds exactly as in #316 — those models are unchanged, they just key off the same `ImporterOfRecord.id` they always did. |

### 3.3 Happy path — a known supplier becomes an importer (the payoff scenario)

| Step | What happens |
|---|---|
| 1 | "Acme Components Ltd" already exists as a `Party` with a `SUPPLIER` role (from `ProductParty`). |
| 2 | Operator starts onboarding, searches the importer combobox by name → **finds "Acme Components Ltd" already in the system**, with a chip: "Existing party · Supplier on 6 products." |
| 3 | Picks it → `POST /api/importers { partyId: <existing>, clientId, path }` → adds a **second** `PartyRole { roleType: IMPORTER }` to the same `Party`. No new identity row. Prior screening history, aliases, and document links carry over. |
| 4 | 5106/POA/bond/screening proceed against the same `ImporterOfRecord`, now linked to the pre-existing party. |

### 3.4 Exception paths

| # | Situation | Behavior |
|---|---|---|
| **U1** | Two low-confidence candidates for "Acme Corp" (an existing supplier `Party` and a new EIN) | `resolvePartyForCompany` returns candidates, not an auto-decision — the onboarding step shows "Is this the same company as [Acme Components Ltd, supplier]? Yes / No, it's different" before creating anything. Never auto-merges (same rule as `product-and-party-master.html` already states for products). |
| **U2** | A `LegalEntity` used by `ShipmentParty`/`ProductParty` has no bridged `Party` yet (pre-migration data) | Reads fall back to `LegalEntity`'s own fields (unchanged behavior) until the backfill (§6.2) runs; nothing breaks, nothing is silently wrong. |
| **U3** | An importer's `Party` already has a `CONSIGNEE` or `BUYER` role from shipment history | Additive — `PartyRole` rows don't conflict; the importer detail page's "Also known as" panel lists all of them. |
| **U4** | Operator tries to add an `IMPORTER` role to a party that's already screening-`BLOCKED` in another role | Onboarding screening step re-screens regardless (screening is a role-scoped fact, `RestrictedPartyScreeningResult` is already per-party) — a prior clearance in one role never silently clears another. |
| **U5** | Two accounts (different tenants) both do business with "the same" real-world company | No cross-tenant merge — `Party` is `accountId`-scoped like everything else; each tenant's `Party` row is independent. This migration does not introduce any cross-account matching. |
| **U6** | `entityResolutionService` receives a document naming a company below match confidence | Unchanged behavior — creates a new `Party` + `LegalEntity` bridge (not just a bare `LegalEntity`), so it's immediately visible to the importer-search path too, instead of living in a separate index until someone manually reconciles it. |

### 3.5 The customer-facing win (what makes this worth a deck slide)

**"Also known as" on the importer / party detail page.** Once `Party` is the shared identity, any detail page
(importer, supplier, manufacturer, carrier) can render a panel: *"This company is also your Importer of
Record for 3 shipments · Supplier on 6 products · screened 2026-08-02."* Today this requires a human to
recognize the name is the same and go check three different pages by hand. This is real, it's visible in a
demo in under a minute, and it's the direct product proof of "we don't duplicate your master data."

---

## 4. APIs

No new externally-facing routes beyond what #316 already specifies for `/api/importers*`. The change is
internal resolution plus one new shared helper:

| Item | Change |
|---|---|
| `resolvePartyForCompany(accountId, { name, taxId, address, kind })` | **New**, in `src/modules/party/partyResolutionService.ts`. Wraps the matching logic `entityResolutionService.ts` already has (name normalization, identifier lookup) but reads/writes `Party`+children instead of bare `LegalEntity`. Returns `{ exact }`, `{ candidates: [...] }`, or `{ none }` — same three-way shape the product-master matching already uses (`partMasterMatch.ts`), for UI/behavioral consistency. |
| `POST /api/importers` (#316) | Body gains `partyId?` (link an existing party) alongside `legalEntity:{...}` (create new) — internally both paths converge on `resolvePartyForCompany`. |
| `GET /api/importers/[id]` (#316) | Response gains a `party.roles[]` and `party.alsoKnownAs` block for the "Also known as" panel. |
| `entityResolutionService.ts` | Rewritten in Phase 2 (§6.3) to call `resolvePartyForCompany` instead of querying `LegalEntity` directly; its public signature (`legalEntityId` in the return) is **kept** and additionally carries `partyId`, so callers migrate on their own schedule. |
| `GET /api/parties/[id]` (existing) | Gains an `importerOfRecord` block when the party holds the `IMPORTER` role, mirroring the existing `carrierProfile` block pattern. |
| `POST /api/onboarding/cases/[caseId]/entities` (#316) | Internals swap `db.legalEntity.create` for `resolvePartyForCompany` + `PartyRole` create; the route's request/response shape is unchanged. |

No route is deprecated in this issue — `/api/legal-entities` keeps working exactly as #316 already specifies
(party-only entities), it just also gets a bridged `Party` under the hood.

---

## 5. Schema

### 5.1 Change set

```prisma
model ImporterOfRecord {
  id        String   @id @default(cuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  // NEW — same pattern as CarrierProfile.partyId. Replaces name / irsEin /
  // address as the source of identity; this row keeps only what is true
  // BECAUSE this party is registered to import, not who they are.
  partyId String  @unique
  party   Party   @relation(fields: [partyId], references: [id], onDelete: Cascade)

  // clientId already made required by #316 §5. Unchanged here.
  clientId String
  client   Client @relation(fields: [clientId], references: [id])

  // KEPT — filing-capacity facts, not identity:
  cbpImporterNumber  String?  @unique
  registrationStatus String   @default("unregistered")
  bondId             String?
  bond               Bond?    @relation(fields: [bondId], references: [id], onDelete: SetNull)
  // powersOfAttorney, onboardingCases, onboardingEntities, shipments,
  // customsFilings, customsCases, rateCards, invoices, assists — unchanged.

  // REMOVED (now read through party → PartyName / PartyIdentifier / PartyAddress):
  //   name String
  //   irsEin String
  //   address Json
  // Removed only after §6.2's backfill confirms 100% coverage; see phased
  // plan — the columns are dropped in a LATER migration, never the same one
  // that adds partyId.

  @@index([accountId])
  @@index([clientId])
}
```

```prisma
model Party {
  // (existing — unchanged) …
  importerOfRecord ImporterOfRecord?   // NEW inverse side, mirrors carrierProfile
}
```

`LegalEntity` gets **no schema change** in this issue — it already has `partyId String?`. What changes is
that it stops being the identity source of truth for anything created after the backfill:

```prisma
model LegalEntity {
  // (unchanged fields)
  partyId String?   // ALREADY EXISTS — becomes populated for every row via §6.2,
                     // and every NEW LegalEntity creation call also creates/links
                     // its Party twin from day one of Phase 1.
}
```

`ShipmentParty` and `ProductParty` get **no schema change** in this issue (Phase 3, §6.4, is where their FK
target is reconsidered — deliberately deferred so this issue stays reviewable).

### 5.2 Invariants

- `ImporterOfRecord.partyId` unique → one party is registered as an importer at most once (mirrors #316's
  now-superseded `legalEntityId` uniqueness — this replaces that column before it ships, see §7).
- A `Party` may hold `IMPORTER` alongside any other `PartyRoleType` — no exclusivity constraint.
- `resolvePartyForCompany` never writes a second `Party` for the same account when an exact identifier match
  (EIN via `PartyIdentifier.normalizedValue`) exists — enforced in the service, not the DB, because "exact"
  vs. "candidate" is a matching-confidence decision, not a uniqueness constraint.

### 5.3 Migrations

1. `..._add_importer_of_record_party_id` — add `ImporterOfRecord.partyId` nullable + unique index (`IF NOT
   EXISTS` guarded, same discipline as `20260822100000_add_abi_filer_credential`).
2. `..._backfill_importer_of_record_party` — data-only: for each `ImporterOfRecord`, find-or-create its
   `Party` twin from `name`/`irsEin`/`address` (reusing `resolvePartyForCompany` in `--apply` mode so backfill
   and live-create share one code path, not two). Dry-run report first.
3. `..._backfill_legal_entity_party` — same shape, for every `LegalEntity` missing `partyId`.
4. *(separate PR, gated on 100% backfill in every environment)* `..._importer_of_record_party_id_not_null` +
   drop `name`/`irsEin`/`address` columns.

No `select` of `partyId` until migration 1 is deployed everywhere (project rule).

---

## 6. Retrofit strategy — the actual "retrofit vs. carve out" decision

### 6.1 Decision: retrofit onto `Party`. No new table.

This is not a close call, for the reasons in §1.1: the target model, the capacity-extension pattern
(`CarrierProfile`), and the bridge pattern (`CanonicalProduct.productId`) **already exist and are already
proven in production** by a different feature. Carving out a fresh table would mean re-solving a problem this
codebase has already solved twice.

### 6.2 Phase 1 — bridge (ships first, self-contained, low risk)

- Migration 1–3 above.
- New `resolvePartyForCompany` service.
- `ImporterOfRecord.partyId` populated for all rows; `name`/`irsEin`/`address` columns **kept** (read-through
  still falls back to them if `party` relation is somehow null — belt and suspenders during rollout).
- `POST /api/importers` (#316) and `POST /api/onboarding/cases/[caseId]/entities` (#316) switched to call
  `resolvePartyForCompany` instead of `db.legalEntity.create`.
- `LegalEntity` creation call sites (`entityResolutionService.ts`, `/api/legal-entities`) also create/link a
  `Party` twin, but **keep** writing `LegalEntity` exactly as before — `ShipmentParty`/`ProductParty` reads
  are untouched.
- **As of 2026-09-04, PR #317 (#316) has already shipped S1–S5**, including `ImporterOfRecord.legalEntityId
  @unique` — see §7's revised sequencing. Phase 1 here now **bridges through that existing column**
  (`ImporterOfRecord.legalEntityId → LegalEntity.partyId → Party`) instead of adding a fresh
  `ImporterOfRecord.partyId` column on day one. Adding a direct `partyId` short-cut column is deferred to
  Phase 1b (§7) so #317's already-shipped and tested importer workspace isn't touched by this issue's first PR.

### 6.3 Phase 2 — migrate the matcher (next slice)

- `entityResolutionService.ts` rewritten to match against `Party` (`PartyName.normalizedName`,
  `PartyIdentifier.normalizedValue`) instead of ad hoc `LegalEntity` string comparison, writing
  `PartyEvidence`/`PartyChangeEvent` like every other party-matching path.
- Its return type keeps `legalEntityId` (compat) and adds `partyId`.
- Party detail page and importer detail page both gain the "Also known as" panel (§3.5) — this is the
  visible payoff milestone.

### 6.4 Phase 3 — retarget the FKs (later, larger, explicitly out of scope for this issue's first PR)

- `ShipmentParty.legalEntityId` and `ProductParty.legalEntityId` reconsidered: either add a parallel
  `partyId` and dual-write during a transition window, or leave them pointing at `LegalEntity` permanently
  (since `LegalEntity` remains a valid, bridged, always-in-sync record — the `CanonicalProduct` precedent
  shows this is a legitimate **permanent** end state, not just a transitional one).
- `declarationBuilder.ts`, `canonicalShipmentService.ts`, `reconciliationEngine.ts`, product-intelligence
  matching/comparison — each read `ShipmentParty.legalEntity.{legalName,country,taxIdentifier}`; if Phase 3
  retargets the FK, each of these is a reviewed, isolated PR, not one big migration.
- **Recommendation:** do not schedule Phase 3 automatically. Phase 1+2 already deliver the identity
  unification and the dedupe win. Revisit Phase 3 only if a concrete need appears (e.g., a role-spanning query
  that `LegalEntity.partyId` can't answer efficiently).

### 6.5 Consumer audit surface (from #316's grep, re-used here)

`ShipmentParty`, `ProductParty`, `ProductIdentifier`, `declarationBuilder.ts`, `fieldMappers.ts`,
`entrySummary/fromCustomsFiling.ts`, `cargoRelease/fromCustomsFiling.ts`, `entryProofService.ts`,
`assistMatchingService.ts`, `materializers.ts`, `entityResolutionService.ts`, `documentIntelligenceAgent.ts`,
`agentContext.ts`, `restrictedPartyRepository.ts`, `productIntelligence/matching.ts` + `comparison.ts`,
`productSchemas.ts`, `productChangeDetection.ts`, `productService.ts`, `shipmentPartyService.ts`,
`canonicalShipmentService.ts`, `reconciliationEngine.ts`. All of these are **Phase 3** territory (still
reading `LegalEntity`, untouched by Phase 1–2) — listed here so Phase 3 planning starts from a known surface
instead of re-discovering it.

---

## 7. Sequencing with #316 — revised 2026-09-04

**Original recommendation** (when this doc was first written) was to land this issue's Phase 1 before #316's
S2, so `ImporterOfRecord` would get `partyId` instead of `legalEntityId` from the start. **That window has
closed:** PR #317 shipped S1 through S5 — including `ImporterOfRecord.legalEntityId @unique`, the unified
importer workspace (S3), the client-portfolio redesign (S4), and mandatory-importer shipment intake (S5) — all
tested (60 passing) and built against `legalEntityId`/`LegalEntity`. Reworking that now, mid-flight, would be
a strictly worse trade than the rework this doc originally warned about: it would touch already-shipped,
already-tested UI and API surface instead of code that didn't exist yet.

**Revised plan: sequence #320 fully after #316, and adjust Phase 1 to bridge rather than replace.**

1. **Finish #316 first.** Land S6 (gated required-client enforcement) + demo seed + expanded E2E + final
   sales-demo verification — PR #317's own remaining checklist. Merge it. Nothing in #320 blocks this.
2. **Then start #320 Phase 1, revised:**
   - Backfill `LegalEntity.partyId` for every `LegalEntity` reachable from an `ImporterOfRecord.legalEntityId`
     (this is the bridge column that already exists — it was simply never populated).
   - `resolvePartyForCompany` becomes the identity-resolution path for *new* importers, called from the
     already-shipped `POST /api/importers` (#317) instead of its current `db.legalEntity.create` /
     `db.importerOfRecord.create` pair — this is a small, contained change to one route, not a rewrite of S3/S4.
   - Read-through for the "Also known as" panel (§3.5) walks `importerOfRecord.legalEntity.party`, using the
     existing `legalEntityId` FK — no new `ImporterOfRecord.partyId` column needed for this to work.
   - **Phase 1b (optional, later):** once every `ImporterOfRecord.legalEntityId` has a populated
     `LegalEntity.partyId`, a direct `ImporterOfRecord.partyId` shortcut column can be added purely as a
     read-performance optimization (skip one join) — not a correctness requirement. Low priority.
3. **Phase 2 and Phase 3 (§6.3, §6.4) are unchanged** by this revision — they were already sequenced after
   Phase 1 regardless of #316's state.

Net effect of the delay: one extra join (`legalEntityId → legalEntity.partyId`) stays in the read path
indefinitely, or until Phase 1b. That is a small, acceptable cost against not reworking five already-shipped
slices.

---

## 8. Test plan

### 8.1 Unit / service

- `resolvePartyForCompany`: exact identifier match (EIN) → returns existing party, no new row. No match →
  creates `Party`+`PartyName`+`PartyAddress`+`PartyIdentifier`. Ambiguous (2+ candidates above threshold) →
  returns candidates, creates nothing. Idempotent re-call with identical input → no duplicate.
- `ImporterOfRecord` ↔ `Party` 1:1 invariant: second `ImporterOfRecord` creation for the same `partyId` → 409.
- Backfill (migration 2/3): `ImporterOfRecord`/`LegalEntity` with existing `LegalEntity.partyId` → reused, not
  duplicated. Neither present → created from `name`/`irsEin`/`address`. Re-run is a no-op (idempotent).
- `entityResolutionService` (post-Phase-2): same fixture set it has today, asserting identical match outcomes
  now sourced from `Party` instead of `LegalEntity`, plus new assertions that `PartyEvidence`/
  `PartyChangeEvent` rows are written.

### 8.2 API / integration

- `POST /api/importers` with `partyId` of an existing supplier `Party` → adds `IMPORTER` role, no duplicate
  identity, prior `PartyRole(SUPPLIER)` untouched.
- `POST /api/importers` with new legal details, no existing party → creates one `Party` + one `PartyRole` +
  one `ImporterOfRecord`, all linked.
- `GET /api/importers/[id]` → `party.roles` includes `IMPORTER` plus any others; `party.alsoKnownAs`
  populated correctly for a multi-role party.
- `GET /api/parties/[id]` for a party with an `IMPORTER` role → response includes the `importerOfRecord`
  block (mirrors existing `carrierProfile` block shape).
- Regression: every #316 API test (importers CRUD, client link, readiness, filing-readiness) re-run
  unchanged, now against the `partyId`-backed model — same expected responses.
- Tenant isolation: `resolvePartyForCompany` never returns or matches a `Party` from a different `accountId`.

### 8.3 UI / E2E (Playwright)

- **Onboarding "Register as importer" from an existing party** (§3.3): search shows the existing supplier
  chip; selecting it and completing onboarding results in one `Party` with two roles, verified via the
  detail page's role badges.
- **Ambiguous match (U1):** two candidates shown, "Yes / No, it's different" choice, neither auto-creates nor
  auto-links until the operator answers.
- **"Also known as" panel** renders on both the importer detail page and the existing party/supplier detail
  page for the same underlying party, and stays consistent after a page reload.
- **Regression:** every #316 E2E scenario (add-importer flow, combobox, shipment-form inheritance, readiness
  filters) passes unchanged — this migration must be invisible to those flows except for the new panel.

### 8.4 Regression (must stay green)

`onboarding-client-link.test.ts` · `onboarding-client-repair.test.ts` · `onboarding-bond-sufficiency.test.ts`
· `abi-importer-bond-query.test.ts` · `client-catalog-scoping.test.ts` · every #316 test added for
`/api/importers*` · existing party/carrier tests (`CarrierProfile` reads unaffected — same relation shape
reused, not changed) · product-intelligence matching tests (untouched — Phase 3 territory).

---

## 9. Seed data (demo)

Extend the "Northwind Trade Group" seed from #316 rather than creating a second scenario:

| Party | Roles | What it demonstrates |
|---|---|---|
| **Northwind Retail Inc.** | `IMPORTER` (ready) | Same as #316's seed, now `Party`-backed — proves the migration is invisible to the existing ready-importer demo. |
| **Meridian Components GmbH** | `SUPPLIER` (existing, pre-seeded on 3 products) **+ `IMPORTER`** (added mid-scenario) | The payoff demo: search "Meridian" before → one supplier result. Run the "register as importer" step → same party gains a role. Search "Meridian" after → one result, two role badges, "Also known as" panel showing both. |
| **Pacific Import Partners** | `IMPORTER` (bond-insufficient, from #316) | Unchanged; proves Phase 1 doesn't disturb the exception-path demo. |

No new seed script — this is a small addition to `seed-clients-importers-demo.ts` (#316 §9), gated behind
Phase 2 landing (the "Also known as" panel needs Phase 2's read path).

---

## 10. Sales deck update

**Not a new deck.** The customer-facing story here belongs in the **existing**
[`product-and-party-master.html`](../../../../apps/custom/public/deck/product-and-party-master.html) deck —
it is the deck that already pitches "one party record, N roles" for suppliers/manufacturers/carriers. This
issue is what makes that pitch also true for importers, so it extends that deck rather than duplicating it
with a new one.

**Planned addition — 1 new feature slide + 1 objection-table row**, inserted after the existing party-roles
slide:

- **New slide: "The same company, wherever it shows up."** Pain: *"Our supplier became our client's importer
  of record and now we have two unrelated records for them — different screening history, no idea they're
  the same company."* App-frame mockup: search "Meridian" → one result → role badges `SUPPLIER · IMPORTER` →
  "Also known as" panel. How-to-demo tip: search a known supplier, walk "register as importer," search again.
- **New objection row:** *"If a supplier becomes an importer, do we lose their history?"* → *"No — it's the
  same party gaining a role. Screening history, aliases, and every document link carry forward."*

This keeps the sales narrative for Product & Party Master and for Client & Importer Onboarding
(`client-and-importer-onboarding.html`, #316) pointing at the same underlying promise instead of telling two
separate data-model stories.

---

## 11. Open questions

1. **Phase 3 timing** (§6.4) — deliberately left unscheduled here. Confirm the team agrees "Phase 1+2 only,
   revisit Phase 3 on demand" rather than pre-committing to retargeting `ShipmentParty`/`ProductParty`.
2. **`resolvePartyForCompany` confidence thresholds** — should reuse whatever thresholds
   `partMasterMatch.ts` already uses for products, or does company-name matching warrant its own tuning?
3. **Backfill collision handling** — if two existing `ImporterOfRecord` rows would resolve to the same
   `Party` under exact-identifier matching (e.g. same EIN entered twice historically), is that a hard stop
   requiring manual reconciliation, or an automatic merge with an audit trail?
4. **`GET /api/parties` list** — should it grow a `roles` filter (`?role=IMPORTER`) so it can fully replace
   `/api/importers` as a list endpoint, or do the two stay separate (party search vs. importer-specific
   readiness columns)? Leaning: stay separate — `/api/importers` needs #316's readiness/bond/POA columns that
   a generic party list shouldn't carry.

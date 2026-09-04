# Clients · Importers · Onboarding — Information-Architecture Redesign

> Created: 2026-09-03.
> Status: **Proposed.** No code yet. This doc is the spec for the issue.
> Related: [`CUSTOMER-ONBOARDING.md`](./CUSTOMER-ONBOARDING.md) (F16 — the onboarding flow this builds on), [`project_customer_onboarding_spec`], [`project_doc_flow_field_dictionary`] (the `documents.create` phantom-permission precedent), [`ABI-CERTIFICATION-READINESS.md`](./abi/ABI-CERTIFICATION-READINESS.md).
> Owner surfaces: `/app/clients`, `/app/importers-of-record` → `/app/importers`, `/app/legal-entities` (retire), `/app/onboarding`, `/app/bonds`, `/app/poa`, the shipment intake form.

---

## 1. Intention

### 1.1 The problem in one sentence

Three database tables (`Client`, `LegalEntity`+`CustomsProfile`, `ImporterOfRecord`) and three pages
(`/app/clients`, `/app/importers-of-record`, `/app/onboarding`) all describe overlapping slices of
"a company we file for," none of them is authoritative, and the most visible page (`/app/clients`)
shows the one slice that filing ignores.

### 1.2 What a user actually needs

| The user wants to… | Today |
|---|---|
| Add an importer to a client | Only possible via the onboarding wizard or a raw API call; the standalone "Add Importer of Record" modal creates an **orphan** with no `clientId`, and there is no route to attach one afterward. |
| See how many importers a client has, and which are fileable | Not surfaced anywhere. `/app/clients` counts `LegalEntity` rows, which are a different set. |
| Know why a shipment can't be filed for an importer | Discovered at filing time, not before. |
| Pick the importer when creating a shipment | Was free-text `importerName`; a dropdown of `ImporterOfRecord` is half-built on an uncommitted branch. |
| Understand which record a filing will use | Genuinely ambiguous — `CustomsProfile.cbpImporterNumber` and `ImporterOfRecord.cbpImporterNumber` can both be set to different values for the "same" company. |

### 1.3 Design goals

1. **One record per importing company.** The thing you attach to a client, attach a POA to, verify a bond
   for, and select on a shipment is a single **Importer** record.
2. **Clear domain boundaries** — one responsibility per noun, one mental model per page.
3. **Filing readiness is a first-class, everywhere-visible status** with a specific blocker and a deep link.
4. **Onboarding is a mode of the Importer record, not a separate place** you finish and leave.
5. **The shipment form asks for exactly one new thing** (the importer) and derives the rest — billing
   client, CBP number, EIN, bond, POA — read-only, with provenance.
6. **Retrofit without a big-bang migration.** Carve the boundary with one new foreign key; defer full
   table unification to a tracked follow-up.

### 1.4 Explicit non-goals (this issue)

- Merging `LegalEntity` / `CustomsProfile` / `Party` into one master. Tracked as a follow-up (§7.4).
- International onboarding *implementation* (EORI, comprehensive guarantee). The generic step names from
  `CUSTOMER-ONBOARDING.md` §1.3 are respected; no new country is built.
- Changing bond / POA / 5106 mechanics. Those models and flows are unchanged; only their **home in the IA**
  moves (they become tabs on the Importer record).
- ABI transport. 5106 transmit stays gated exactly as it is.

---

## 2. Domain model & boundaries

### 2.1 The three nouns

| Noun | Definition | Canonical owner of | Explicitly NOT responsible for |
|---|---|---|---|
| **Client** | The commercial relationship — who you invoice and who signs into the portal. | Billing terms, rate cards, invoices, portal users/stakeholders, inbound-email routing, the *roster* of importers and parties under it. | Any CBP identity, bond, POA, screening. |
| **Importer** (`ImporterOfRecord`) | A legal company registered to import through this broker — the **filing identity**. | Legal identity (name, type, jurisdiction, EIN/SSN, addresses, officers), CBP importer number, 5106 registration, POA(s), bond assignment, screening result, **filing readiness**. | Invoicing, portal login, container contents. |
| **Party** (`Party` / `LegalEntity` party rows) | Any other company in a trade role — supplier, manufacturer, seller, buyer, consignee. | Trade-role identity, per-country registrations, screening as a party. | Filing identity / bond / POA (unless the same company is *also* registered as an Importer). |

### 2.2 Cardinality & rules

```
Account (the broker / tenant)
  └─* Client                       "who I bill"
        ├─* Importer               belongs to exactly ONE client (FK required)
        │     └─ 1 LegalEntity     the importer's legal identity (1:1)
        │     └─* PowerOfAttorney
        │     └─ Bond assignment   (own | rides broker bond | STB); a Bond may cover many importers
        │     └─ FiveOhSixRecord
        │     └─ screening result
        └─* Party                  supplier / manufacturer / seller / buyer (may be shared, not billed)

Shipment  ── importerOfRecordId (REQUIRED) ──▶ Importer
          └─ clientId is DERIVED from importer.clientId (never asked separately)
```

- A **Client** has 0..N Importers and 0..N Parties. A client with **zero** importers is valid (freight-only,
  DDP where the seller is IOR, still-onboarding).
- An **Importer** belongs to **exactly one** Client. Re-pointing is an explicit, audited action.
- An Importer is **fileable** ("a true Importer of Record") only when **all** of:
  5106 `registered` · POA `executed` & unexpired · Bond `verified` & sufficient (or STB acknowledged) ·
  screening `cleared`. Until then it is a **draft importer** and shipments referencing it are blocked at
  transmit with `IMPORTER_NOT_ONBOARDED`.
- A **Shipment** references exactly one Importer. It inherits importer legal name, CBP#, EIN, bond, POA —
  read-only, with a provenance chip. The billing client is the importer's client.
- **Onboarding** is the guided mode of the Importer record — a stepper over the same tabs/routes, with a
  next-action CTA. When readiness reaches ✅ the stepper collapses to the Overview tab.

### 2.3 One-line boundary test (for reviewers)

> If a field answers *"who do I send the invoice to / who logs into the portal?"* it belongs on **Client**.
> If it answers *"may I file an entry naming this company, and with what identity/bond/authority?"* it
> belongs on **Importer**.
> If it answers *"what role does this company play on a shipment or product?"* it belongs on **Party**.

---

## 3. User flows

### 3.1 Entry points to "add an importer to a client"

All four converge on `POST /api/importers` and land on `/app/importers/[id]` in stepper mode:

1. `/app/clients` list row → **＋ Add importer** (client pre-filled).
2. `/app/clients/[id]` → Importers section → **＋ Add importer**.
3. `/app/importers` → **＋ Add importer** (pick client first).
4. `/app/onboarding` → **＋ Onboard importer** → `NewCaseModal` (client + path + one-or-more entities).
5. From a Party / `LegalEntity` that already exists → **Register as importer** (reuses the legal entity, no
   duplicate legal record — exception path E10).

"Link an *existing* orphan importer to a client" = `PATCH /api/importers/[id] { clientId }`, offered from
the `/app/importers` row (client column = "— Unassigned") and from the client's Importers section
("Link existing").

### 3.2 Happy path — new US importer, first-time filer

| Step | Screen | System |
|---|---|---|
| 1 | `/app/clients` → ACME Corp row → **＋ Add importer** | Modal opens, client = ACME (locked). Path = Standard. |
| 2 | Modal: legal name, entity type = US corp, EIN, address | `POST /api/importers` → creates `LegalEntity` + `ImporterOfRecord` (linked 1:1, `clientId` = ACME, `registrationStatus: pending_5106`) + `OnboardingCase (status: in_progress)`. Redirect to `/app/importers/{id}` step 2. |
| 3 | **CBP registration (5106)** tab | Auto-filled from step 2; operator adds officer block; **Generate PDF** → **Mark filed via ACE Portal** (ABI transmit greyed — account not certified). `FiveOhSixRecord.status: accepted`. Readiness item ✅. |
| 4 | **Power of Attorney** tab | E-sign; signer = CFO / OFFICER; envelope sent. Status "awaiting signature". |
| 5 | **Bond** tab | "ACME has its own continuous bond" → surety + bond# → **Verify with CBP** → KI/KR match → `Bond.status: verified`. Sufficiency: projected duty $400k → formula wants $50k floor, bond is $100k → ✅. |
| 6 | (async) e-sign webhook | `PowerOfAttorney.status: executed`, `PoaEnvelope` completion cert stored. Readiness item ✅. |
| 7 | **Screening** tab | Runs on entity + CFO → all clear → ✅. |
| 8 | Overview | Banner flips to **✅ Ready to file**. Stepper collapses. `OnboardingCase.status: active`, `ImporterOfRecord.registrationStatus: registered`. Outbox event emitted. |
| 9 | `/app/shipments/new` | **Importer** combobox (mandatory) → "ACME Corp". CBP#, EIN, bond, POA, billing client inherit read-only with a source chip ("From ACME onboarding · POA executed 2026-07-14 · bond verified 2026-08-02"). |
| 10 | Filing | 7501 builder resolves CBP# and bond# through the `CustomsFiling` FKs. No re-keying. |

### 3.3 Exception paths

| # | Situation | Behavior |
|---|---|---|
| **E1** | POA sent, not yet signed; operator creates a shipment and tries to transmit | Shipment saves. `filingReadiness` → `IMPORTER_NOT_ONBOARDED` blocker on transmit with a deep link to the POA tab. Importer row badge ⚠️ "POA out for signature". |
| **E2** | Bond insufficient — projected duty $1.8M, bond $50k, CBP formula wants $180k | Bond tab shows required vs actual in red. Readiness ⚠️ "Bond increase required". **Generate rider request** produces a surety packet. Activation blocked. |
| **E3** | Screening hit on the entity or a principal | Two severities, already implemented in [`/api/onboarding/entity/[entityId]/disposition`](../../../apps/custom/src/app/api/onboarding/entity/[entityId]/disposition/route.ts): **FLAGGED** (soft match) → any `onboarding.manage` holder dispositions with a required note → proceed; **BLOCKED** (confirmed OFAC SDN / BIS / UFLPA) → `OVERRIDE` requires **`compliance.override`** (`BROKER_ADMIN` / `OWNER` / `ADMIN` — not specialists), logged to `AuditLog`. Importer → `blocked_screening`; all its shipments hard-blocked until dispositioned. The new Screening tab surfaces "compliance authority required to override" rather than a bare 403. |
| **E4** | Switching brokers — importer already has a CBP# and an active bond | Path = "Switching". 5106 = **UPDATE** not CREATE. Bond tab → **Find existing bond** → KI/KR → `Bond` created `verified`, `source: CBP_QUERY`. Only the POA is net-new. |
| **E5** | Non-resident — German GmbH, no EIN | Path = "Non-resident". Legal tab forces `importerNumberType: CBP_ASSIGNED` + resident-agent block. POA tab forces `WET_INK_NOTARIZED`. Bond tab defaults to "ride broker bond" / STB. |
| **E6** | Duplicate — operator adds "ACME Corp" but an importer with that EIN exists | `POST /api/importers` → **409** with the existing importer id + "add as a second entity under this client?" affordance. (Same `irsEin` check the entities route already performs.) |
| **E7** | Orphan importer from legacy data (`clientId: null`) | Appears in `/app/importers` with client = "— Unassigned" (amber). Header chip "N unassigned importers". Bulk **Assign client** or per-row **Attach to client** (combobox). Not offered in the shipment importer picker unless "show unassigned" is toggled. |
| **E8** | Operator re-points an importer to a different client after shipments exist | `PATCH /api/importers/[id] { clientId }` allowed; warns "N shipments / M filings will re-associate for billing"; audit-logged. Historical invoice lines already snapshot values — unaffected. |
| **E9** | POA expires mid-relationship | Scheduled job → `PowerOfAttorney.status: expired` → importer readiness ⚠️ → `OnboardingCase` reopens `blocked` → open filings get an `ExceptionItem`. (Per `CUSTOMER-ONBOARDING.md` §4.2 / S8.) |
| **E10** | A `LegalEntity` that exists as a manufacturer party later needs to import | From the party record → **Register as importer** → creates the `ImporterOfRecord` linked to the **same** `LegalEntity`, starts onboarding. No duplicate legal record. **Broker-initiated only** (see §11.4). |
| **E11** | Portal (customer) user tries to view/attach an importer outside their client | Every route asserts `clientId ∈ ctx.authorizedClientIds`; 403 otherwise (the PR #97 IDOR class). |

### 3.4 Why this is intuitive

- **One mental model per page.** Clients = money & access. Importers = "can I file, and with what." Onboarding
  = "what's not done yet." No page mixes concerns.
- **One record per company.** No "is this the legal entity or the IOR?" — it is *the importer*.
- **Readiness is visible everywhere** with the exact blocker and a deep link. The operator is never surprised
  at filing time.
- **Onboarding is a mode, not a destination.** Fixing a lapsed POA a year later is the same three clicks as
  during setup; the record just isn't showing a stepper anymore.
- **The shipment form asks one question** (the importer) and derives client, CBP#, EIN, bond, POA. Billing
  client is never a separate prompt.
- **Progressive disclosure** — list → expand → tab → evidence block. Compliance depth on demand.
- **Provenance on every inherited value** (source chip), consistent with "Qubere proves every line item."

---

## 4. UI / UX specification

### 4.1 Navigation (`src/lib/navigation.ts`)

- `importers-of-record` item: `labelKey` `importersOfRecord` → `importers`, `href` `/app/importers`.
- New item `legal-entities` is **not** added; `/app/legal-entities` 301-redirects to `/app/importers`.
- Tab group under "Clients & Importers": **Clients · Importers · Bonds · POAs · Onboarding**. `bonds` and
  `poa` are **absorbed** into `/app/importers` as portfolio-risk views (§4.8), not standalone CRUD lists.
- `onboarding` item unchanged (`/app/onboarding`, `onboarding.manage`).

### 4.2 `/app/clients` — "Clients" (list)

- **Header stats strip:** `12 clients · 27 importers · 19 ready to file · 3 onboarding · 4 unassigned importers`.
  The "unassigned" figure is a link to `/app/importers?client=none`.
- **Row:** name · primary contact · **importers** (`3 · 2 ready`) · parties · shipments (90d) · payment terms
  · portal (`2 users` / `not invited`).
- **Expand** → importer cards (readiness badge, CBP#, bond ●, POA ●) + party list. Actions, side by side:
  **＋ Add importer**, **＋ Add party**, **Link existing importer**.
- **＋ Add client** stays at top.
- No compliance editing on this page — status + deep links only.

### 4.3 `/app/clients/[id]` — "Client · setup"

Sections: **Billing** (terms, rate card, invoices link) · **Portal** (stakeholders, invitations) ·
**Inbound email addresses** (existing `ClientInboundAddresses`) · **Importers** (status + deep links,
＋ Add / Link) · **Parties** (status + deep links). No 5106 / POA / bond editing here.

### 4.4 `/app/importers` — "Importers" (list; rename from importers-of-record)

- **Header stats:** `27 importers · 19 ready · 5 missing POA · 3 bond issues · 2 pending 5106`.
- **Row:** importer name · **client** (link; "— Unassigned" amber if null) · CBP# · 5106 ● · POA ● · Bond ● ·
  Screening ● · **Readiness** (✅ Ready / ⚠️ N blocking / 🕒 Onboarding step k).
- **Filters:** client, readiness, missing-artifact (`?missing=poa|bond|5106|screening`), path.
- **Bulk:** assign client, start/resume onboarding, export CSV.
- **＋ Add importer** → modal: **client** (combobox, required) → **New legal entity** (form) *or*
  **Link existing legal entity** (combobox of `LegalEntity` rows with no `ImporterOfRecord`) → creates the
  Importer + `OnboardingCase`, redirects to the record in stepper mode.

### 4.5 `/app/importers/[id]` — the unified Importer record

One route, tabs (deep-linkable `?tab=`):

| Tab | Backed by | Content |
|---|---|---|
| **Overview** | derived | Readiness banner (✅ / ⚠️ list with deep links / 🕒 stepper), client, CBP#, POA/bond/5106/screening chips, recent shipments, "Re-point to another client". |
| **Legal details** | `LegalEntity` (+ officers `Json`) | Legal name, DBA, entity type, formation jurisdiction, EIN/SSN, physical + mailing address, officers, resident agent (non-resident). |
| **CBP registration (5106)** | `FiveOhSixRecord` | Draft → generated → submitted → accepted; PDF preview; Generate / Transmit (ABI, gated) / Mark filed via ACE. |
| **Power of Attorney** | `PowerOfAttorney` + `PoaEnvelope` | Template pick, merge preview, e-sign / upload, signer identity, execution method, effective/expiry, revoke. |
| **Bond** | `Bond` + `BondVerification` | Own / broker bond / STB; KI-KR **evidence block** (raw KR record, collapsible); sufficiency math; rider request. |
| **Screening** | `ScreeningLog` / restricted-party results | Entity + officers + parent; per-target results with scores; disposition. |
| **History** | `OnboardingEvent` + `AuditLog` | Timeline. |

**Stepper mode:** when `OnboardingCase.status ∉ {active}`, the left rail renders the tabs as an ordered
stepper (`<ol>`, `aria-current="step"`) with a persistent readiness strip and a single "next action" CTA.
When `active`, the rail is plain tabs.

### 4.6 Shipment intake form (`/app/shipments/new`)

- **Importer** field — **mandatory** — a searchable combobox (see §4.7). If a client is already in context
  (`?clientId=`, portal user, single-client specialist) the list is scoped to that client's importers.
- On select: client, CBP#, EIN, bond, POA status inherit **read-only** with a source chip; the free-text
  `importerName` box is removed when an importer is selected.
- Importer not ready → inline `⚠️ POA missing — [resolve]`; the draft still saves. `filingReadiness` blocks
  transmit.
- Server (`POST /api/shipments`): derive `clientId` from `importer.clientId`; a caller-supplied `clientId`
  that disagrees is a 400 (already implemented on the working branch — fold into the suite).

### 4.7 Combobox component (`src/components/ui/Combobox.tsx`) — new, shared

Fixes the split "search box + dropdown" in `NewCaseModal` (the screenshot in the issue) and is reused by the
shipment importer picker, the add-importer client picker, and "attach to client".

- Single text input. Typing filters (client-side fuzzy over the loaded page; server `?q=` for the long tail,
  debounced 200 ms). Clicking the chevron (or `↓` on an empty field) opens the **full** list.
- Keyboard: `↓`/`↑` move, `Enter` select, `Esc` close, `Home`/`End`. Type-ahead.
- ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; listbox `role="listbox"`,
  options `role="option"` `aria-selected`.
- Props: `value`, `onChange`, `options | loadOptions(query)`, `getOptionLabel`, `getOptionSublabel`,
  `placeholder`, `disabled`, `allowClear`, `emptyMessage`, `footerNote` (e.g. "Showing first 50 — narrow your
  search").
- `ClientPicker` is rewritten as a thin wrapper around it; `CaseClientLink` and `NewCaseModal` pick it up for
  free.

### 4.8 Bonds & POA — absorbed as portfolio-risk views

`/app/bonds` and `/app/poa` today are flat CRUD tables. They are **absorbed into `/app/importers`** — not
just relocated, but re-cast from "rows you edit" to "risk you triage." Each row deep-links to the importer's
Bond / POA tab, where the actual editing lives. Account-wide cross-importer visibility is kept (a broker who
thinks "check all my bonds" still has a list) — it just becomes an exposure view.

**Bonds view** (`/app/importers?view=bonds`, or a secondary tab):

| Column | Why it matters to a broker |
|---|---|
| Bond # · surety · type | identity |
| **Importers on this bond** | one bond covers a parent + subsidiaries; non-residents ride the broker's master bond |
| **Headroom** = bond amount − Σ(projected/actual 12-mo duty+tax+fee across every importer on the bond) | predicts a CBP insufficiency notice / border hold |
| Days to expiry · last verified | renewal + re-verification cadence |

Default sort: **closest to insufficient first.** Filters: `renewal due 90d`, `insufficiency risk`,
`broker master bond`. Answers the spreadsheet question — "which client is about to blow through their bond?"

**POA view** (`/app/importers?view=poa`):

| Column | Why |
|---|---|
| Importer · signer · execution method | identity |
| Effective / **expiry · days left** | an expired POA silently invalidates every subsequent filing |
| Status | executed / out for signature / expired / revoked |

Headline filter: **expiring in 90 days.** Plus **importers with no valid POA** (the coverage-gap list).
Bulk action: send renewal.

### 4.9 Redirects & deprecations

| Old | New |
|---|---|
| `/app/importers-of-record` | 301 → `/app/importers` |
| `/app/legal-entities` (if present) | 301 → `/app/importers` |
| "Add Importer of Record" standalone modal | Replaced by **＋ Add importer** → onboarding stepper |
| "Add Legal Entity" on `/app/clients` | Split: **＋ Add importer** (registers) vs **＋ Add party** (trade role only) |
| `/app/bonds` | Absorbed → `/app/importers?view=bonds` (portfolio-risk view, §4.8); old path 301-redirects |
| `/app/poa` | Absorbed → `/app/importers?view=poa` (§4.8); old path 301-redirects |

---

## 5. Schema

### 5.1 Change set (minimal — 1 new column + 1 phased nullability change)

```prisma
model ImporterOfRecord {
  // NEW — the canonical 1:1 link to the legal identity. Nullable now; required
  // after the backfill migration (§7.2) completes and the unassigned bucket is
  // cleared.
  legalEntityId String?  @unique
  legalEntity   LegalEntity? @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)

  // CHANGED — clientId becomes required. Phase 1: backfill + keep nullable +
  // surface "unassigned" in the UI. Phase 2 (separate migration): NOT NULL.
  clientId String   // was String?

  // (unchanged) irsEin, cbpImporterNumber, registrationStatus, bondId,
  // powersOfAttorney, onboardingCases, shipments, customsFilings …
}

model LegalEntity {
  // NEW — inverse side of the 1:1.
  importerOfRecord ImporterOfRecord?
  // (unchanged) clientId stays nullable — a party-only legal entity (manufacturer,
  // seller) need not belong to a client.
}
```

- **`CustomsProfile`** is **demoted to a read-through**. `POST /api/legal-entities` stops accepting
  `cbpImporterNumber`; the clients-page display reads `ImporterOfRecord` + `Bond` + `PowerOfAttorney`
  instead. The table is **not dropped** in this issue (a `ShipmentParty`/`ProductParty` audit is needed
  first — §7.4); it is frozen and no longer written from the UI.
- **`OnboardingEntity.legalEntityId` / `importerOfRecordId`** stay, but the authoritative importer↔entity
  edge moves to `ImporterOfRecord.legalEntityId`. `resolveImporterContext` is rewritten to walk the direct
  FK instead of the `OnboardingEntity` triangle.
- **`Shipment.clientId`** is kept but treated as a derived cache of `importerOfRecord.clientId`. Written only
  by the shipments route from the resolved importer; a divergent caller value is rejected.

### 5.2 Invariants (enforced in the service layer + a DB partial index)

- `ImporterOfRecord.legalEntityId` is unique → **one legal entity is registered as an importer at most once**.
- An Importer's `clientId` must match its `legalEntity.clientId` when the latter is non-null (validation, not
  FK).
- `Shipment.importerOfRecordId` non-null for any shipment created after this ships (schema stays nullable for
  historical rows; the route requires it).

### 5.3 Migration files

1. `NNNNNNNNNNNNNN_add_importer_legal_entity_link` — add `legalEntityId` + unique index, `IF NOT EXISTS`
   guarded (`20260822100000_add_abi_filer_credential` pattern).
2. `NNNNNNNNNNNNNN_backfill_importer_client_and_entity` — data-only (see §7.2).
3. *(later, separate PR)* `NNNNNNNNNNNNNN_importer_client_not_null` — flips `clientId` to `NOT NULL` once the
   unassigned count is 0 in every environment.

No `select` of `legalEntityId` until migration 1 is deployed everywhere (the project rule).

---

## 6. APIs

### 6.1 New / changed

| Method | Route | Purpose | Guard |
|---|---|---|---|
| `GET` | `/api/importers` | List; `?client= &readiness= &missing= &path= &q= &cursor=`. Keyset paginated, narrow projection. | `parties.manage` \| `client.read` |
| `POST` | `/api/importers` | `{ clientId (req), legalEntity:{…} \| legalEntityId, path }` → creates `LegalEntity` (if new) + `ImporterOfRecord` (linked) + `OnboardingCase`. Idempotent on `(accountId, irsEin)`. | `onboarding.manage` |
| `GET` | `/api/importers/[id]` | Full record: legal + 5106 + POA + bond + screening + `readiness`. | `parties.manage` \| `client.read` |
| `PATCH` | `/api/importers/[id]` | `{ clientId?, legalName?, entityType?, address?, … }` — **this is the "attach / re-point to client" action.** Cross-account `clientId` → 400; portal caller outside `authorizedClientIds` → 403; re-point with shipments → 200 + warning payload + audit. | `parties.manage` |
| `DELETE` | `/api/importers/[id]` | Soft delete; **409** if any `Shipment` / `CustomsFiling` references it. | `parties.manage` |
| `GET` | `/api/importers/[id]/readiness` | `{ ready: boolean, blockers: [{ code, label, href }] }`. Pure function of the record; reused by `filingReadiness`. | `parties.manage` \| `client.read` |
| `GET` | `/api/clients` | Add `_count.importersOfRecord` + `readyImporterCount` + `unassignedImporterCount` (account-level). | `client.read` |
| `GET` | `/api/clients/[id]/importers` | Importer list for the client detail page + expand row. | `client.read` |
| `POST` | `/api/clients/[id]/importers` | Thin alias of `POST /api/importers` with `clientId` fixed from the path. | `onboarding.manage` |

### 6.2 Deprecated / redirected

| Method | Route | New behavior |
|---|---|---|
| `POST` | `/api/importers-of-record` | **308** → `/api/importers`. |
| `GET` | `/api/importers-of-record` | Kept as an alias of `GET /api/importers` for one release, `Deprecation` header. |
| `POST` | `/api/legal-entities` | Rejects `cbpImporterNumber` with **409** `{ error: "Register an importer via POST /api/importers" }`. Still creates party-only legal entities. |
| `POST` | `/api/onboarding/cases` | Unchanged — remains the batch/multi-entity entry point; now also sets `ImporterOfRecord.legalEntityId` directly. |
| `/api/onboarding/cases/[caseId]/{5106,poa,bond,screen,activate}` | Unchanged. |

### 6.3 Cross-cutting

- Every route asserts `accountId`; portal/customer routes additionally assert `clientId ∈ ctx.authorizedClientIds`.
- Idempotency keys stay mandatory on `5106/transmit` and `bond/verify`.
- `resolveImporterContext(accountId, clientId, { importerId? })` — single resolver, rewritten to the direct
  FK; called by `POST /api/shipments`, `POST /api/filing`, the chat shipment tool, EDI/`TransportationOrder`
  promotion, and document-intake shipment creation. No caller re-implements the lookup.
- Permissions: confirm `parties.manage`, `onboarding.manage`, `client.read`, `client.update` exist in
  `packages/auth/src/permissions.ts` (they do as of 2026-09-03). Add `compliance.override` if not present
  (screening disposition — E3).

---

## 7. Retrofit strategy

### 7.1 Decision: **link, don't merge** (carve the boundary with one FK)

Three options were considered:

| Option | Verdict |
|---|---|
| **A. Merge `LegalEntity`+`CustomsProfile` into `ImporterOfRecord`.** | **Rejected now.** `LegalEntity` is load-bearing for `ShipmentParty`, `ProductParty`, `ProductIdentifier`, `canonicalMessaging/declarationBuilder`, `entityResolutionService`, hydration materializers. Merging touches the party/product graph and the filing declaration builder in one change — blast radius too large, blocks everything behind it. |
| **B. Make `Party` the one master; collapse `LegalEntity` + `ImporterOfRecord` into it.** | **Right long-term target, out of scope.** `Party` is a much larger model (identifiers, registrations, screening, relationships). A 2–3 month migration. Tracked as §7.4. |
| **C. Keep three tables; define one canonical link + one canonical owner per concern.** | **Chosen.** Ships the IIA win now with 1 new column. |

### 7.2 Backfill migration (data-only, idempotent, per `dataMode`)

For each `ImporterOfRecord` with `legalEntityId IS NULL`:
1. If an `OnboardingEntity` links this importer to a `LegalEntity` → set `legalEntityId` to it.
2. Else, find a `LegalEntity` in the same account with a matching `taxIdentifier == irsEin` (and, tiebreak,
   `legalName`) → link it.
3. Else, **create** a `LegalEntity` from the importer's `name` / `irsEin` / `address` and link it.

For each `ImporterOfRecord` with `clientId IS NULL`:
1. `OnboardingCase.clientId` for a case naming this importer → set it.
2. Else the linked `LegalEntity.clientId` → set it.
3. Else leave null → counts toward `unassignedImporterCount`; surfaced in the UI for manual cleanup.

Dry-run report first (`--dry-run` flag on the script), same discipline as `seed`/`reconcile` scripts. No
`clientId NOT NULL` flip until every environment reports 0 unassigned.

### 7.3 Rollout order

| Slice | Ships | Risk |
|---|---|---|
| **S1** | `Combobox` component + rewrite `ClientPicker`; fix `NewCaseModal` split-field UX. | Trivial. Isolated. |
| **S2** | `PATCH /api/importers-of-record/[id]` (client link) + `ImporterOfRecord.legalEntityId` column (nullable) + "Attach to client" on `/app/importers-of-record` + client column already renders. Backfill migration (dry-run → apply). | Low. Additive. |
| **S3** | `/app/importers/[id]` unified tabbed record; `/api/importers` + `/api/importers/[id]` + `/readiness`; `/app/importers-of-record` → `/app/importers` rename + redirect. | Medium. New pages, no destructive schema. |
| **S4** | `/app/clients` list redesign (stats strip, importer cards, ＋ Add importer / ＋ Add party split); `CustomsProfile` demoted to read-through; `POST /api/legal-entities` rejects `cbpImporterNumber`. | Medium. Touches the clients page + legal-entities route. |
| **S5** | Shipment form importer mandatory + inheritance chip + `clientId` derivation (mostly done on the working branch — land it, add tests). | Low. |
| **S6** | `clientId NOT NULL` migration once unassigned = 0 everywhere. | Low, gated. |
| **(later)** | §7.4 `Party` unification. | Large, separate epic. |

S1–S2 ≈ 1 day. S3 ≈ 2–3 days. S4 ≈ 2 days. S5 ≈ 0.5 day.

### 7.4 Tracked follow-up: `Party` / `LegalEntity` unification

Separate epic. `LegalEntity` becomes a projection of `Party` (which already has `LegalEntity.partyId`);
`CustomsProfile` is dropped; `ImporterOfRecord` keeps only filing-specific fields and points at a `Party`.
Requires an audit of every `LegalEntity` read (`ShipmentParty`, `ProductParty`, `declarationBuilder`,
`entityResolutionService`, `materializers`, product intelligence). Not this issue.

---

## 8. Test plan

### 8.1 Unit / service (`vitest`, run from `apps/custom`)

- `resolveImporterContext`: single importer · multi-importer (`needsImporterSelection`) · no onboarding case
  · unassigned importer · expired POA · lapsed bond · explicit `importerId` override.
- `importerReadiness(importerId)`: each blocker code (`FIVE_OH_SIX`, `POA`, `BOND`, `SCREENING`) fires and
  clears independently; STB acknowledgement satisfies `BOND`; screening override satisfies `SCREENING`.
- Backfill: importer via `OnboardingCase.clientId` → set · importer via linked `LegalEntity.clientId` → set ·
  importer with neither → stays null + counted · idempotent re-run is a no-op.
- 1:1 invariant: second `POST /api/importers` for the same `legalEntityId` → 409.
- `CustomsProfile` read-through returns the same CBP#/bond/POA the `ImporterOfRecord` holds.

### 8.2 API / integration (`apps/custom/tests/api-suite.test.ts` + new `importers.test.ts`)

- `POST /api/importers` (new legal entity) → both rows created, linked, `clientId` set, `OnboardingCase` opened.
- `POST /api/importers` (`legalEntityId` of an existing party entity) → links, no duplicate legal row.
- `POST /api/importers` duplicate `irsEin` → 409 + existing id.
- `PATCH /api/importers/[id] { clientId }` → re-link; cross-account `clientId` → 400; portal caller outside
  `authorizedClientIds` → 403; re-point with shipments → 200 + warning + `AuditLog` row.
- `DELETE /api/importers/[id]` with a referencing shipment → 409.
- `POST /api/legal-entities { cbpImporterNumber }` → 409.
- `POST /api/importers-of-record` → 308 → `/api/importers`.
- `POST /api/shipments { importerOfRecordId }` → `clientId` derived; conflicting `clientId` → 400.
- Tenant isolation: account A's importer invisible to account B on `GET /api/importers`, `GET /api/importers/[id]`,
  `PATCH`, `/readiness`.
- `filingReadiness`: shipment on a draft importer → `IMPORTER_NOT_ONBOARDED` at transmit; on a ready importer
  → passes.
- `GET /api/clients` returns correct `importersOfRecord` count, `readyImporterCount`, `unassignedImporterCount`.

### 8.3 UI / E2E (`apps/custom/e2e/*.spec.ts`, Playwright, broker fixture)

- **Add importer from `/app/clients` row** → lands on `/app/importers/[id]` stepper → readiness banner lists 4
  blockers → each deep-links to its tab.
- **Combobox**: type `"acm"` → filtered options; click chevron on empty field → full list; `↑`/`↓`/`Enter`/`Esc`;
  select → label shown; clear button resets.
- **`/app/importers` filter** `?missing=poa` → only ⚠️-POA rows.
- **Shipment form**: submit with no importer → validation error; select importer → client field becomes a
  read-only chip showing the importer's client; source chip shows POA/bond dates.
- **Unassigned importer**: absent from the shipment importer picker until "show unassigned" toggled;
  **Attach to client** sets `clientId` and it appears.
- **Redirects**: `/app/importers-of-record`, `/app/legal-entities`, `/app/bonds`, `/app/poa` → `/app/importers`
  (301; bonds/poa land on the `?view=` portfolio tabs).
- **Accessibility**: stepper is `<ol>` with `aria-current="step"`; combobox exposes `role="combobox"`,
  `aria-expanded`, `aria-activedescendant`; focus moves to the step heading on step change.

### 8.4 Regression (must stay green)

`onboarding-client-link.test.ts` · `onboarding-client-repair.test.ts` · `onboarding-bond-sufficiency.test.ts`
· `abi-importer-bond-query.test.ts` · `client-catalog-scoping.test.ts` · the 7501 builder resolving CBP#/bond#
through `CustomsFiling` FKs · `ShipmentParty` / `ProductParty` reads of `LegalEntity` (untouched by this change).

---

## 9. Seed data (demo)

New idempotent script `apps/custom/scripts/seed-clients-importers-demo.ts` (demo `dataMode`), added to the
demo seed set. Scenario **"Northwind Trade Group"**:

| Client | Importer(s) | State — what it demonstrates |
|---|---|---|
| **Northwind Retail Inc.** — net 30, 2 portal users | Northwind Retail Inc. | ✅ **Ready** — 5106 accepted, POA e-signed by the CFO, continuous bond $250k verified via KI/KR, screening clear. The "good" importer for the shipment-inheritance demo. |
| **Northwind Retail Inc.** | Northwind Foods LLC (subsidiary) | ⚠️ **POA out for signature** — all else green. Shows the exception banner + portal signer flow + multi-entity-under-one-client (S4). |
| **Pacific Import Partners** — net 45 | Pacific Import Partners | ⚠️ **Bond increase required** — projected duty $1.8M, bond $50k, formula wants $180k. Shows sufficiency math + rider request. |
| **Meridian GmbH** — non-resident | Meridian GmbH | 🕒 **Onboarding, step 3** — CBP-assigned number pending, resident agent captured, POA wet-ink notarized awaiting upload. The non-resident path. |
| **Atlas Components** | *(0 importers; 2 parties — a manufacturer + a seller)* | Client with **no importer** — the "client ≠ importer" case and the ＋ Add importer entry point. |
| *(unassigned)* | "Legacy Importer Co." — `clientId: null` | The **Unassigned importers** cleanup bucket + Attach-to-client flow (E7). |

Plus: 3–4 shipments on the Northwind Retail ready importer (source chips visible on each), and 1 shipment on
the Pacific importer stuck at transmit with the `IMPORTER_NOT_ONBOARDED` blocker.

---

## 10. Sales deck

New deck `apps/custom/public/deck/client-and-importer-onboarding.html` (uses `assets/deck.css` / `deck.js`),
linked from `public/deck/index.html`. Customer-facing — **no schema, no API, no table names.** Slides:

1. **Title** — "Onboard an importer once. File for them forever."
2. **The problem** — pain quotes: *"we re-key the EIN and the bond on every entry" · "we found out at filing
   that the POA had expired" · "which of these three 'ACME' records is the real one?"*
3. **The model** — one diagram: **Client** (billing & portal) → **Importers** (filing identity) → each
   carries 5106 · POA · Bond · Screening. Parties (suppliers/manufacturers) sit beside, not inside.
4. **Guided onboarding** — the stepper: five steps, a readiness meter, one clear next action.
5. **Readiness, everywhere** — ✅ / ⚠️ on every list; "you always know why you can't file, before you try."
6. **One flow, every situation** — first-time filer · switching brokers · non-resident · parent + subsidiaries.
7. **The customer's half** — in the portal the importer signs their own POA, confirms their entity details,
   uploads their bond document.
8. **Enter once, inherit forever** — the shipment screen: pick the importer, everything else fills in with a
   "where this came from" chip.
9. **Evidence on the record** — CBP bond-query confirmation, e-signature certificate, screening results, all
   attached.
10. **Close** — "From signed engagement letter to first filed entry in days — with an audit trail for every
    step."

If `full-story.html` has a clients/onboarding section, add a 2-slide condensed version there too.

---

## 11. Resolved decisions & open questions

### 11.1 Screening disposition permission — RESOLVED

`compliance.override` already exists ([`permissions.ts:184`](../../../packages/auth/src/permissions.ts) —
"Waive or override compliance exception," default roles `BROKER_ADMIN` / `OWNER` / `ADMIN`), and
[`/api/onboarding/entity/[entityId]/disposition`](../../../apps/custom/src/app/api/onboarding/entity/[entityId]/disposition/route.ts)
already enforces the split: **FLAGGED** → any `onboarding.manage` holder + required note → proceed;
**BLOCKED** `OVERRIDE` → requires `compliance.override`. The redesign reuses this gate unchanged; the new
Screening tab must show "compliance authority required" instead of a bare 403. See E3.

### 11.2 Bonds / POA pages — RESOLVED: absorb

Absorbed into `/app/importers` as **portfolio-risk views** (not relocated CRUD) — §4.8. Account-wide
cross-importer visibility is retained as an exposure/expiry view; editing happens on the importer's tab.

### 11.3 Re-pointing an importer with historical filings — still open

(E8) Confirm invoice lines snapshot enough that billing history is truly unaffected, or block the re-point
when `CustomsFiling` rows exist. Leaning: allow with the warning + audit, since `InvoiceLine` already
snapshots amounts.

### 11.4 Portal "Register as importer" — RESOLVED: broker-only

(E10) Broker-initiated only. Registering an importer starts a legal process (5106 / bond / POA) the broker is
professionally responsible for; customer self-initiation creates half-formed records and erodes the "portal
contributes data + signature, never activates" boundary. **Future, demand-driven:** a portal
**"Request to add an importer"** action that creates a broker-side task via the existing `CustomerRequest`
model — never an `ImporterOfRecord` directly.

### 11.5 `CustomsProfile` consumers — still open

Grep confirms UI + `clientsData.ts` read it. Confirm nothing server-side (billing, reporting) reads it
directly — must be zero before demoting to a read-through.

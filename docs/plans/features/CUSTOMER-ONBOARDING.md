# F16 · Customer Onboarding — Guided Importer Activation, 5106, Bond & POA Verification

> Created: 2026-08-31.
> Status: **Shipped — P1–P8 + P7 ABI codec on `feat/customer-onboarding-f16`** (cc2b64d4). P7 codec shipped (CATAIR 5106 v12, App ID TP): `src/lib/abi/importerCreate/` (7 files) + transmit route + stub response; real TCP/IP transport is Phase 3 ABI cert work (transport stubbed — always accepted). P8 portal wizard live but `poaEnvelopeSignUrl` requires e-sign provider to populate it per-envelope. Open questions (§13) unresolved — require CBP Client Rep + legal input.
> Branch: `feat/customer-onboarding-f16`
> Owner surfaces: new `/app/onboarding/*`, rework of `/app/clients`, `/app/importers-of-record`, `/app/bonds`, `/app/poa`, `/app/admin/integrations`, new `/app/admin/broker-compliance`.
> Related: [`ABI-CERTIFICATION-READINESS.md`](../ABI-CERTIFICATION-READINESS.md) (transport, `RealAceProvider`, CATAIR envelope), [`7501-draft-and-abi-export.md`](../../requirements/7501-draft-and-abi-export.md) (draft+serializer+profile pattern this doc reuses), [`CUSTOMER-PORTAL-PR97-REVIEW.md`](../review/CUSTOMER-PORTAL-PR97-REVIEW.md) (invite/tenant-isolation), [`QUICKBOOKS-INTEGRATION.md`](./QUICKBOOKS-INTEGRATION.md) (OAuth + `IntegrationSyncLog`/`IntegrationEntityMap` idempotency pattern this doc reuses for ERP).

---

## 0. Why this exists

A licensed broker cannot legally file an entry for an importer until three things are true and provable:

1. The importer is **registered with CBP** — has a CBP importer-of-record number, established via CBP Form 5106 ("Create/Update Importer Identity Form"). A first-time importer with no EIN-derived number has nothing CBP will accept an entry against.
2. A **valid Power of Attorney** grants the broker authority to act. It must be executed by someone with signature authority for the importer's legal form, unexpired, and on file.
3. An **active customs bond** sufficient for the importer's projected duty/tax/fee exposure is on file with CBP, confirmed against surety and CBP records — not merely typed into a form.

Today Qubere has the **data model** for all three (`ImporterOfRecord`, `PowerOfAttorney`, `Bond`/`BondParty`, `LegalEntity`/`CustomsProfile`) and thin nav surfaces, but:

| Gap | Evidence |
|---|---|
| No guided onboarding flow — each object is a separate manual CRUD modal | `ImportersClient.tsx`, `BondsClient.tsx`, `PoaClient.tsx` are independent "＋ Add" modals with no sequencing, no readiness gate |
| No CBP Form 5106 generation or transmission | Grep for `5106` across `src/` and `docs/` returns nothing |
| Bond "verification" is fake | `bonds/BondsClient.tsx:123` `handleVerifyCbp` re-fetches the list and `alert()`s a hardcoded "is ACTIVE and validated with CBP"; `bond.service.ts:createBond` writes `status: "Unverified"` and never changes it |
| POA is a stored file, not an executed instrument | `importers-of-record/[id]/poa/route.ts` accepts a `documentUrl` string, defaults `expirationDate` to `now + 3y`, sets `status: "Active"` unconditionally. No signer identity, no e-sign, no revocation flow |
| No broker-side compliance record | No model for the broker's own license, national permit, or 19 CFR 111.28 responsible-supervision-and-control designation — the thing that determines whether the *account* may file at all |
| No sanctioned-party screening at onboarding | `ScreeningLog` exists and is used in filing, but nothing screens an importer entity + its principals before the client is activated |
| ERP onboarding is config-only | `/api/admin/integrations` stores an `IntegrationConfig` row (`category: "ERP"`) but no code reads an ERP entity/product master and turns it into `Client`/`LegalEntity`/`Product`. The 69-duplicate-account problem (memory: broker-readiness assessment) is the cost of no dedupe on entity intake |

**Consequence if unbuilt:** the first real filing for any new importer is blocked, and the blocker is discovered late — during filing — instead of during a deliberate onboarding step. This is the single highest-leverage "make Qubere a real broker platform" gap after ABI transmission itself.

**Design stance:** build on the existing data model, but treat the current `Bond.status` string, the POA route's defaulting, and the standalone-modal UX as **placeholders to replace**, not foundations to extend. Where this doc contradicts current behavior, this doc wins.

---

## 1. Scope

### In scope

- **Broker/tenant activation** (one-time, per Account): company profile, broker license + national permit + district permits, responsible-supervision designation, filer code → `AbiFilerCredential`, surety relationships, billing defaults.
- **Importer client onboarding** (repeated, per importer): the guided wizard — legal entity capture, 5106, POA execution, bond capture + verification, screening, activation.
- **5106**: structured record model + CBP Form 5106 PDF + three delivery paths (paper packet, ACE Portal-assisted, ABI transmission where certified).
- **Bond verification**: real check against the CBP Importer/Bond Query (KI/KR) codec that already exists (`src/lib/abi/importerBondQuery/`), plus surety-code validation against the bundled `active_sureties_2025` list, plus manual-attestation fallback.
- **POA e-signature**: pluggable e-sign provider (envelope create, signer routing, webhook completion, executed-PDF storage), plus "upload a wet-ink POA" fallback with reviewer attestation.
- **ERP onboarding**: pull an importer's entity master + product master from a connected ERP (`IntegrationConfig` `category: "ERP"`), map to `Client`/`LegalEntity`/`Product`/`Party` with deterministic dedupe and a human review step.
- **Readiness model**: a single `OnboardingCase` state machine that every downstream surface (filing readiness, `/app/actions`, portal) can query for "can we file for this importer yet, and if not, what's missing."

### Out of scope (this feature)

- Actual CBP ABI transport wiring — owned by `ABI-CERTIFICATION-READINESS.md` Phase 1. This feature produces transmission-ready payloads and calls the provider interface; it does not implement the socket.
- Building the 5106 CATAIR codec from a source PDF — see §6.3; sequenced as its own unit, same discipline as the other `src/lib/abi/*` chapters (pull the PDF, verify positions, round-trip test).
- Non-US customs onboarding **implementation**. US CBP is the only country built here — but the design is structured so other countries are added by plugging in strategies, not forking the flow (see §1.3).
- Credit-bureau / financial underwriting of importers beyond capturing payment terms and a manual credit-hold flag.
- Carrier / forwarder onboarding (that is `Carrier`/`CarrierProfile`, a separate flow).

### 1.3 International / multi-country posture

**Honest state:** as specified, the *substance* of onboarding is US-CBP-specific — CBP Form 5106, ABI transmission, a CBP customs bond, 19 CFR 111 broker supervision, the KI/KR importer/bond query. A German or UK importer's onboarding looks materially different (EORI registration instead of 5106; a customs comprehensive guarantee / deferment account instead of a surety bond; direct vs. indirect representation instead of a POA; fiscal representation for non-EU-established importers; no "broker license" concept in most of the EU).

**But the platform around it is already country-agnostic and proven.** The filing/messaging layer resolves every country-specific fact from wildcard reference tables via `findMostSpecificMatch()` — the Germany rollout changed zero application code (`docs/customs-filing/04-new-country-onboarding.md`). `Shipment.destinationCountry` already drives procedure-code / authority / message-name resolution. Onboarding must be built the same way rather than hard-coding CBP.

**Design requirement for this feature (so international is a data/strategy job later, not a rewrite):**

| Concern | Do NOT | DO |
|---|---|---|
| The state machine | Bake "5106" / "bond" / "POA" into `OnboardingCase.status` | Keep status generic: `identity_registration`, `financial_security`, `representation_authority`, `screening`, `activation`. The US wizard maps these to 5106 / bond / POA; a future EU wizard maps them to EORI / guarantee / representation appointment. |
| Steps | One hard-coded 8-step wizard | A `CountryOnboardingProfile` (reference row, keyed by `country` with `"*"` fallback) that declares which steps apply, which artifact model backs each, and which are mandatory. The wizard renders from this profile. |
| Artifact models | Assume `FiveOhSixRecord` / CBP `Bond` are the only shapes | `FiveOhSixRecord` is `country: "US"`-scoped; sibling models (`EoriRegistration`, `CustomsGuarantee`, …) added later implement a shared `RegistrationArtifact` / `SecurityArtifact` interface. `OnboardingEntity` points at the abstract artifact, not the concrete US one. |
| Registration transport | Call `RealAceProvider` directly from the wizard | Go through a `RegistrationProvider` interface (`submit`, `getStatus`) — `AbiImporterCreateProvider` is the US impl; other countries get their own (many are portal-only, i.e. a "generate packet + mark filed" impl). |
| Representation | Model only a US broker POA | `representation_authority` step captures `representationType` (`US_POA` \| `EU_DIRECT` \| `EU_INDIRECT` \| `UK_POA` \| …); the e-sign/upload machinery is shared, the legal fields differ per type. |
| Screening | US lists only | Screening step takes the destination country + all trade-control regimes that apply (US: OFAC/BIS/UFLPA; EU: consolidated sanctions list; UK: OFSI) — the existing screening path already abstracts providers. |
| Broker compliance | Assume every country has a broker license | `BrokerComplianceProfile` is `country`-scoped; the "may we file here?" check returns "not applicable — no broker authorization regime" for countries that don't have one. |

**Bottom line:** build the US flow now, but through generic step names, a `CountryOnboardingProfile` reference table, and provider/artifact interfaces — so the first non-US country is a seed script plus one or two new provider impls, mirroring how Germany was added to filing. Adding the abstraction seams is ~1 extra unit in P1; retrofitting them after the US flow hard-codes CBP is a rewrite. This is called out again in P1 of §10 and as open question #10 in §13.

---

## 2. Real-world scenarios the design must handle

Each is a first-class path, not an edge case. The wizard branches on these; the tests enumerate them.

| # | Scenario | What makes it different | Design response |
|---|---|---|---|
| S1 | **Brand-new importer, never imported.** US corporation, has an EIN, no CBP activity yet. | CBP importer number = EIN in `NN-NNNNNNNXX` format, but CBP still needs a 5106 to establish the identity/address/officer record before an entry names it. | 5106 with `importerType: EIN`; number derived from EIN; POA + bond required; screening required. |
| S2 | **Non-resident importer (foreign, no EIN/SSN).** e.g. a German GmbH importing DDP. | Needs a **CBP-assigned number** (`YYDDPP-NNNNN`) issued via 5106. Foreign address. CBP requires the POA to be notarized/apostilled and often a US resident agent for service of process. Non-resident importers cannot get their own continuous bond as easily — frequently ride the broker's bond or a single-transaction bond. | 5106 with `importerType: CBP_ASSIGNED`; wizard collects resident-agent block; POA step forces `executionMethod: WET_INK_NOTARIZED`; bond step defaults to "broker bond" or STB. |
| S3 | **Importer switching brokers.** Already has a CBP number, an active continuous bond in their own name, prior filing history. | The importer identity already exists at CBP — 5106 is an **update** (broker-of-record / mailing address change), not a create. Bond is on file already; must be *found*, not created. POA is net-new to this broker. | KI/KR bond query returns the existing bond → `Bond` row created in `verified` state with `source: CBP_QUERY`. 5106 `action: UPDATE`. POA step is the only mandatory new artifact. |
| S4 | **Importer with multiple legal entities.** Parent + 3 subsidiaries, each its own EIN and CBP number. | One `Client` (the commercial relationship), many `ImporterOfRecord` / `LegalEntity`. POA per entity. Bond may be one parent bond covering all, or one per entity. | Wizard supports "add another importing entity" loop under one `OnboardingCase`; each entity gets its own 5106 + POA sub-checklist; bond can be linked to multiple IORs (already supported: `Bond.importersOfRecord ImporterOfRecord[]`). |
| S5 | **Single-transaction bond only.** Importer imports once or twice a year; a continuous bond isn't worth it. | STB is tied to a specific entry, not continuous. Bond amount rules differ (STB ≥ entered value + duties/taxes/fees for most; 3× for some PGA). No "bond on file" the way continuous bonds are. | `Bond.bondType: single_transaction`; wizard skips continuous-bond sufficiency math, shows per-shipment STB guidance instead; verification is surety-attestation only (no KI/KR — STBs don't show there). |
| S6 | **Bond insufficiency.** Continuous bond is $50k; importer's projected annual duties are $900k → CBP formula wants ≥ $90k. Or CBP has flagged the bond as insufficient ("bond stacking"). | CBP's continuous-bond formula: 10% of prior-year duties/taxes/fees, $50k floor, rounded. An undersized bond gets a CBP insufficiency notice and entries can be rejected. | Wizard computes **required bond amount** from projected or actual 12-month duty exposure; compares to bond amount; if short, blocks activation with a "bond increase required" action and a pre-filled rider request to the surety. |
| S7 | **POA signer authority.** Corp → officer or authorized employee. Partnership → any general partner. Sole prop → the individual. LLC → managing member/manager. | The POA is void if signed by someone without authority. CBP can demand proof (corporate resolution, partnership agreement). | POA step captures `signerRole` constrained by `LegalEntity.entityType`; for corp, optionally attach board resolution; validation rule per entity type. |
| S8 | **POA expiry / revocation mid-relationship.** | An expired or revoked POA silently invalidates every subsequent filing. Revocation must propagate immediately. | `PowerOfAttorney.status` transitions (`active → expired` by scheduled job at `expirationDate`; `active → revoked` by explicit action) emit a `WorkflowOutboxEvent`; `OnboardingCase` for that importer flips to `blocked`; open filings get an `ExceptionItem`. |
| S9 | **Bulk migration — book of business.** Broker moves 200 importers from a legacy system, has a CSV export (or a prior-broker ACE download). | Nobody hand-runs 200 wizards. Need bulk import with per-row validation and a triage queue for rows that can't auto-complete. | `POST /api/onboarding/import` (CSV/JSON) → creates one `OnboardingCase` per row in `draft`; a batch view surfaces which rows are auto-ready (bond found via KI/KR, EIN valid) vs. need a POA / need manual review. |
| S10 | **ERP-driven onboarding.** Importer's NetSuite/SAP is connected; entity master, ship-to/bill-to, and product master live there. | The authoritative entity + product data is in the ERP, not to be re-typed. But ERP records are messy (dup vendors, inconsistent names) — the 69-dup-account problem. | ERP sync (§7) proposes `Client`/`LegalEntity`/`Product` rows; a review screen with dedupe candidates (exact + fuzzy on name/EIN/address); nothing is created without a human accept. |
| S11 | **Importer already has an ACE Portal account.** | They may need to grant the broker a relationship in ACE, or the broker pulls the importer's existing bond/entry history. | Wizard shows an "ACE Portal linkage" checklist item (informational + instructions); bond query still works via KI/KR regardless. |
| S12 | **Screening hit.** The importer entity, a principal, or the parent matches an OFAC SDN / BIS Entity List / UFLPA entry. | Onboarding must **stop** — you cannot file for a sanctioned party. Needs a documented review + override-by-authorized-role or reject. | Activation gate calls the existing screening path; `matchStatus: BLOCKED` → `OnboardingCase.status: blocked_screening`, requires compliance-role disposition, logged to `AuditLog`. |
| S13 | **Continuous bond lapse discovered at onboarding.** KI/KR or surety check shows the bond terminated last month. | Common when switching brokers — the prior broker's bond terminated on transfer. | Treated as S5/S6: activation blocked, "new bond required" action, STB path offered as interim. |
| S14 | **Broker account itself not permitted to file in the port.** Broker has a national permit but the entry is in a district where a specific permit/PQO is required, or the broker's license is under review. | `OnboardingCase` can be importer-ready while the *account* is not filing-ready. | Broker-compliance model (§6.2) is checked independently; `/app/onboarding` shows a persistent account-level banner if the broker side is incomplete. |

---

## 3. Customer flow on Qubere

Two actors, two entry points, one shared state machine (`OnboardingCase`).

### 3.1 Broker operator flow (primary) — `/app/onboarding/new`

```
┌─ Step 0 · Start ────────────────────────────────────────────────┐
│  "Onboard an importer"                                          │
│  • Pick existing Client or create new commercial relationship   │
│  • Choose path: [Standard] [Switching to us] [Non-resident]     │
│    [Bulk import] — sets branch flags (S1/S3/S2/S9)              │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 1 · Legal entity ────────────────────────────────────────┐
│  Legal name, trade/DBA, entity type (corp/LLC/partnership/     │
│  sole-prop/foreign), formation country/state, physical +       │
│  mailing address, EIN / SSN / "needs CBP-assigned number".     │
│  Foreign → resident agent block appears.                       │
│  Multiple entities → "＋ add another importing entity".        │
│  Writes: LegalEntity (+ CustomsProfile shell), ImporterOfRecord │
│  in `pending` state.                                            │
│  Inline: EIN checksum + format validation; duplicate check     │
│  against existing IOR/LegalEntity in the account.              │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 2 · CBP registration (5106) ─────────────────────────────┐
│  Auto-fills a Form 5106 draft from Step 1. Operator reviews     │
│  the 5106-specific fields: importer number type, program code, │
│  related-business flag, officer/owner block (name, title,      │
│  DOB last-4 / SSN last-4 as CBP requires), NAICS, company      │
│  contact.                                                       │
│  Action buttons:                                                │
│   • "Generate 5106 PDF"  → always available                    │
│   • "Transmit to CBP (ABI)" → only if account has a certified  │
│     5106 chapter + AbiFilerCredential; else greyed w/ reason   │
│   • "Mark filed via ACE Portal" → manual, with confirmation #  │
│  State: FiveOhSixRecord `draft → generated → submitted →       │
│  accepted | rejected`.                                          │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 3 · Power of Attorney ───────────────────────────────────┐
│  • Choose execution method: [E-sign] [Upload wet-ink]         │
│  • Signer: name, title, role (constrained by entity type),    │
│    email. Grantor entity pre-filled.                           │
│  • Template: pick POA template (account-level, versioned);    │
│    merge fields fill from entity data. Preview.                │
│  • E-sign → creates provider envelope, emails signer,         │
│    step shows "awaiting signature"; webhook completes it.     │
│  • Upload → operator attaches PDF, attests "I have verified   │
│    signer authority", optionally attaches resolution.         │
│  • Non-resident → notarization/apostille fields required.     │
│  Writes: PowerOfAttorney with real signer identity, method,   │
│  executedDocumentUrl, effective/expiration from template term. │
│  State: `draft → out_for_signature → executed | declined |    │
│  uploaded_pending_review → executed`.                          │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 4 · Customs bond ────────────────────────────────────────┐
│  Branch:                                                        │
│   A) "Importer has their own continuous bond"                  │
│      → enter surety, bond #, amount, activity code, dates      │
│      → "Verify with CBP" runs KI/KR importer/bond query        │
│        (real, via RealAceProvider) → fills/confirms fields,    │
│        sets status `verified` + stores raw response           │
│   B) "Ride the broker's bond"                                  │
│      → links importer to the account's master bond; sets       │
│        `coverage: broker_bond`; sufficiency math uses the      │
│        broker bond's headroom                                  │
│   C) "Single-transaction bond"                                 │
│      → per-shipment; no continuous sufficiency check           │
│   D) "No bond yet — request one"                               │
│      → generates a bond application packet for the surety;     │
│        case parks in `awaiting_bond`                           │
│  Sufficiency: wizard computes required amount from projected   │
│  12-month duty/tax/fee (operator enters an estimate, or pulls  │
│  from historical entries if switching). Shows required vs.     │
│  actual; short → hard block with "increase bond" action.       │
│  State: Bond `unverified → verifying → verified | insufficient │
│  | verification_failed`; STB path → `attested`.                │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 5 · Screening & compliance ──────────────────────────────┐
│  Runs denied-party screening on: the legal entity, each        │
│  officer/owner from the 5106, the parent (if given).           │
│  Uses the existing screening path → ScreeningLog rows.         │
│  • All PASSED → step auto-completes                            │
│  • FLAGGED → shows matches, requires operator disposition      │
│    (false-positive note) to proceed                            │
│  • BLOCKED → case → `blocked_screening`; only a compliance-    │
│    role user can reject or override-with-reason                │
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 6 · Billing & access ───────────────────────────────────┐
│  • Payment terms (days), billing contact, credit hold flag    │
│  • Rate card assignment (existing billing models)             │
│  • Optional: invite the importer to the customer portal       │
│    (existing Invitation flow, purpose: CUSTOMER_PORTAL)       │
│  • Optional: assign internal team / user (UserClientAssignment)│
└────────────────────────────────────────────────────────────────┘
        ▼
┌─ Step 7 · Review & activate ──────────────────────────────────┐
│  Readiness checklist — every item green or explicitly waived:  │
│    ✓ Legal entity complete                                     │
│    ✓ 5106 accepted (or filed-via-portal attested)             │
│    ✓ POA executed & unexpired                                  │
│    ✓ Bond verified & sufficient (or STB path acknowledged)    │
│    ✓ Screening cleared                                         │
│    ✓ Billing configured                                        │
│  "Activate importer" → Client.status ACTIVE, IOR usable in     │
│  filing, OnboardingCase.status `active`. Emits outbox event.   │
│  Waivers require a reason + role check; recorded on the case.  │
└────────────────────────────────────────────────────────────────┘
```

**Resumability:** every step writes on completion; the case is a durable object with a `currentStep` and per-step status. Operator can leave and return; `/app/onboarding` lists all in-flight cases with their blocking item.

**Non-linear:** steps 2–5 can be worked in any order once step 1 is done (e.g. POA out for signature while bond is being verified). Step 7 gates on all.

### 3.2 Importer self-service flow (portal) — `portal.qubere.ai/onboarding/:token`

Invited by the broker at Step 6 (or a dedicated "invite importer to self-onboard" action that creates the case in `client_intake` state). The importer sees a reduced wizard:

- Confirm/correct legal entity + address details (writes proposed changes the broker approves).
- Provide officer/owner info for the 5106.
- **Sign the POA** (the e-sign step is theirs).
- Upload their bond documentation or confirm "we don't have one."
- Upload any supporting docs (articles of incorporation, W-9, prior CBP correspondence).

The broker operator still owns 5106 transmission, bond verification, screening disposition, and activation. The portal contributes data and the signature; it never activates.

Tenant isolation: the portal session is scoped by `Invitation.clientId` → `OnboardingCase`; every read/write asserts the case belongs to that client (the IDOR class of bug from PR #97 review — same guard).

### 3.3 Bulk / ERP flow

- **CSV/JSON bulk:** `/app/onboarding/import` → upload → column mapping → dry-run validation report → commit creates N cases in `draft`. A batch dashboard shows per-case blockers; operator works the exceptions.
- **ERP:** `/app/admin/integrations` connects the ERP; `/app/onboarding/erp-review` shows proposed entities/products with dedupe candidates; accepted rows seed cases.

---

## 4. State model

### 4.1 `OnboardingCase.status`

```
draft
  → client_intake        (importer filling portal wizard)
  → in_progress           (broker working the wizard)
  → awaiting_bond         (bond application out to surety)
  → awaiting_signature    (POA envelope out)
  → blocked_screening     (screening BLOCKED, needs disposition)
  → blocked_bond          (bond insufficient / lapsed)
  → ready_to_activate     (all checklist items green)
  → active                (activated — importer is filable)
  → suspended             (POA revoked / bond lapsed post-activation)
  → withdrawn             (abandoned, with reason)
```

`blocked_*` and `awaiting_*` are non-terminal and can coexist conceptually; store the primary blocker in `status` and the full set in `blockers Json` (`OnboardingBlocker[]`), so `/app/actions` and filing-readiness can show all of them.

### 4.2 Per-artifact states

| Artifact | States |
|---|---|
| `FiveOhSixRecord.status` | `draft → generated → submitted → accepted \| rejected \| superseded` |
| `PowerOfAttorney.status` (replace current free string) | `draft → out_for_signature → executed \| declined`; `executed → expired \| revoked` |
| `Bond.status` (replace `"Unverified"` string) | `unverified → verifying → verified \| insufficient \| verification_failed \| attested`; `verified → expired \| revoked` |
| `BondVerification.result` | `match \| no_bond_on_file \| mismatch \| lapsed \| surety_unconfirmed \| error` |

### 4.3 Filing-readiness integration

`modules/filing/filingReadiness.ts` gains a blocker source: `importerOnboardingIncomplete`. A `CustomsFiling` whose `importerOfRecordId` maps to a non-`active` `OnboardingCase` (or an IOR with an expired POA / lapsed bond) surfaces a `FilingBlockerCode.IMPORTER_NOT_ONBOARDED` with a deep link to the case. This is the mechanism that stops "discovered during filing."

### 4.4 Client profile → shipment inheritance (enter once, reuse forever)

**The point of onboarding is that the client's compliance profile is captured once and every subsequent shipment inherits it automatically.** An operator creating shipment #47 for an onboarded importer never re-types the EIN, the CBP importer number, the bond number, or attaches the POA again.

**Today this does not happen.** `POST /api/shipments` takes a free-text `importerName` and an optional `clientId` but never sets `Shipment.importerOfRecordId`; `POST /api/filing` never sets `CustomsFiling.importerOfRecordId` / `bondId`. The 7501 builder (`form7501.ts:255-276`) already *reads through* `filing.importerOfRecordId` → `cbpImporterNumber` and `filing.bondId` → `bondNumber` with provenance — the plumbing exists, nothing fills it. That is the carryover gap this feature closes.

**Model.** The onboarded records are the canonical source of truth:

```
Client (commercial relationship)
  └─ OnboardingEntity ──┬─ LegalEntity        (legal name, address, entity type, country)
     (per importing      ├─ ImporterOfRecord  (EIN/SSN/CBP number, registrationStatus)
      entity, S4)        ├─ PowerOfAttorney   (executed, unexpired — the authority)
                         └─ Bond              (verified, sufficient — own | broker | STB)
```

A `Client` with one importing entity resolves unambiguously. A `Client` with several (S4) has a **default importing entity** plus a per-shipment picker (bill-to / ship-to may differ across the group).

**Inheritance rules.**

| When | Behavior |
|---|---|
| Shipment created with `clientId` (UI, chat, API, EDI, or document intake) | Resolve the client's active `OnboardingEntity`; set `Shipment.importerOfRecordId`, `importerName` (from `LegalEntity.legalName`), and default `entryType`/`portOfEntry` from the client's profile defaults if set. Multi-entity → set the default, flag `needsImporterSelection: true`. |
| Filing created from a shipment | `CustomsFiling.importerOfRecordId` ← `Shipment.importerOfRecordId`; `CustomsFiling.bondId` ← the entity's active `Bond` (continuous/own or linked broker bond); STB → prompt for the per-entry bond. |
| POA / bond referenced on a filing | Never copied onto the filing as strings — resolved live through the FK at draft-build and validation time, so a mid-stream revocation (S8) or bond lapse (S13) immediately invalidates in-flight filings rather than leaving a stale snapshot. |
| Client not yet `active` | Shipment can still be drafted (intake, classification, valuation all work) but `filingReadiness` blocks transmission with `IMPORTER_NOT_ONBOARDED`. |
| Operator overrides the inherited importer on a specific shipment | Allowed, but it's an explicit action, audit-logged, and shown as "overridden from client default" — not a silent free-text field. |

**Per-shipment screens** render the inherited block **read-only with a source chip** ("From ACME Corp onboarding, POA executed 2026-07-14, bond verified 2026-08-02") and an "override for this shipment" affordance behind a confirmation. The shipment intake form's free-text importer name field is replaced by a client/entity selector when a `clientId` is present.

**What is genuinely per-shipment** (never inherited): commercial invoice value, HTS lines, origin, PGA data, entry-specific dates, carrier, conveyance, bill of lading. Onboarding covers *who the importer is and whether we may file for them*, not *what is in this container*.

**Implementation:** a `resolveImporterContext(clientId, opts)` helper in `src/modules/onboarding/importerContext.ts` is the single resolver; `POST /api/shipments`, `POST /api/filing`, the chat shipment-creation tool, the EDI/`TransportationOrder` promotion path, and document-intake shipment creation all call it. No caller re-implements the lookup.

---

## 5. UI / UX specification

### 5.1 Navigation changes (`src/lib/navigation.ts`)

- New section item under the existing **"Clients & entities"** accordion group: `{ id: "onboarding", labelKey: "onboarding", href: "/app/onboarding", icon: "onboarding", permission: "onboarding.manage" }` — placed first in that group.
- `/app/clients`, `/app/importers-of-record`, `/app/bonds`, `/app/poa` stay as the **record browsers** (read + light edit) but each grows an "Onboarding status" column/badge linking back to the case. Their "＋ Add" modals get a secondary CTA: "Start guided onboarding instead."
- New admin item: `{ id: "broker-compliance", href: "/app/admin/broker-compliance", permission: "broker_compliance.manage" }` — the one-time broker activation surface (§6.2), also reachable from a global banner when incomplete.

### 5.2 Routes / pages

| Route | Purpose | Notes |
|---|---|---|
| `/app/onboarding` | Case list — in-flight, blocked, recently activated. Filters by status, assignee, client. Each row: importer name, path badge, current step, primary blocker, age. | Server component + client table, same pattern as `ClientsTable.tsx`. |
| `/app/onboarding/new` | Step 0 launcher. | |
| `/app/onboarding/[caseId]` | The wizard shell — step rail on the left, step body on the right, persistent readiness summary. | One route, step via `?step=` or nested segment; each step is its own client component. |
| `/app/onboarding/[caseId]/5106` | 5106 editor + PDF preview + transmit controls. | Embeds the PDF viewer already used for documents. |
| `/app/onboarding/[caseId]/poa` | POA template pick, merge preview, e-sign / upload. | |
| `/app/onboarding/[caseId]/bond` | Bond capture + verification panel (shows raw KI/KR response in a collapsible "evidence" block — consistent with the product promise: prove it, don't assert it). | |
| `/app/onboarding/import` | Bulk CSV/JSON. | |
| `/app/onboarding/erp-review` | ERP-proposed entities/products + dedupe. | |
| `/app/admin/broker-compliance` | Broker license, permits, PQO, filer credential, sureties. | |
| `portal/onboarding/[token]` | Importer self-service wizard (reduced). | New app route in `apps/portal`. |

### 5.3 Wizard shell component

`src/components/onboarding/OnboardingWizard.tsx`:

- Left rail: ordered steps, each with a status dot (`todo` / `in_progress` / `done` / `blocked` / `waived`). Steps 2–5 unlock after step 1; clicking a locked step is a no-op with a tooltip.
- Header: importer name, path badge, `OnboardingCase.status` chip, "Save & exit."
- Right: `<StepBody>` — one per step, self-contained, each responsible for its own save → `PATCH /api/onboarding/[caseId]/steps/[step]`.
- Footer: readiness summary strip — six pills mirroring the Step 7 checklist, always visible, each links to its step.
- Reuse `Card`, `Button`, `Input`, `Label`, `Badge` from `@/components/ui`; `PanelHeading`; the `StageStepper.tsx` visual language where it fits.

### 5.4 Evidence-first detail rendering

Per the product positioning memo ("Qubere proves every line item"), every verification surface shows its source:

- Bond verified → "Confirmed against CBP Importer/Bond Query, 2026-08-31 14:22 UTC" + expandable raw KR record.
- 5106 accepted → CBP acceptance response + assigned number, with the transmission timestamp and filer code used.
- POA executed → signer name, method, IP/timestamp (e-sign) or reviewer attestation (upload), link to executed PDF.
- Screening cleared → per-target `ScreeningLog` rows with match scores.

### 5.5 Empty / error states

- No cases yet → explainer + "Onboard your first importer" + "Bulk import" + link to broker-compliance if that's incomplete.
- KI/KR query returns `no_bond_on_file` → not an error; a clear "CBP shows no continuous bond for this importer number" with the three next-step options (own bond / broker bond / STB).
- E-sign provider down → step stays workable via the upload path; a non-blocking notice.
- ABI transmit not available → the 5106 transmit button explains exactly what's missing (no certified chapter / no filer credential / account not permitted) and links to broker-compliance.

### 5.6 Accessibility / i18n

- All new `labelKey`s added to the locale files; no hardcoded strings in nav.
- Wizard rail is a real `<ol>` with `aria-current="step"`; step transitions move focus to the step heading.

---

## 6. Data model / schema

All new tables ship as one Prisma migration under `prisma/migrations/` using the guarded `IF NOT EXISTS` / `DO $$` pattern (matching `20260822100000_add_abi_filer_credential`). Code must not `select` new columns until the migration is deployed.

### 6.1 New models

```prisma
model OnboardingCase {
  id                 String   @id @default(cuid())
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  clientId           String?
  client             Client?  @relation(fields: [clientId], references: [id], onDelete: SetNull)
  // Primary importing entity for this case; additional entities (S4) are
  // separate OnboardingEntity rows.
  primaryImporterId  String?
  primaryImporter    ImporterOfRecord? @relation(fields: [primaryImporterId], references: [id], onDelete: SetNull)

  path               String   // STANDARD | SWITCHING | NON_RESIDENT | BULK | ERP
  status             String   @default("draft")
  currentStep        Int      @default(1)
  stepStatus         Json     // { "1": "done", "2": "in_progress", ... }
  blockers           Json     @default("[]") // OnboardingBlocker[]
  projectedAnnualDutyTaxFee Decimal? @db.Decimal(16, 2) // for bond sufficiency (S6)
  activatedAt        DateTime?
  activatedByUserId  String?
  withdrawnReason    String?

  assignedUserId     String?
  source             String   @default("UI") // UI | PORTAL | BULK_IMPORT | ERP

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  entities           OnboardingEntity[]
  fiveOhSixRecords   FiveOhSixRecord[]
  events             OnboardingEvent[]

  @@index([accountId, status])
  @@index([accountId, clientId])
  @@index([assignedUserId])
}

// One importing legal entity within a case (S4: several per case).
model OnboardingEntity {
  id                 String   @id @default(cuid())
  accountId          String
  caseId             String
  case               OnboardingCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  legalEntityId      String?
  legalEntity        LegalEntity?   @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)
  importerOfRecordId String?
  importerOfRecord   ImporterOfRecord? @relation(fields: [importerOfRecordId], references: [id], onDelete: SetNull)

  importerNumberType String   // EIN | SSN | CBP_ASSIGNED
  importerNumber     String?  // null until CBP_ASSIGNED number issued
  residentAgent      Json?    // { name, address, phone } — non-resident (S2)
  officers           Json     @default("[]") // [{ name, title, role, ssnLast4, dob }]
  poaId              String?
  poa                PowerOfAttorney? @relation(fields: [poaId], references: [id], onDelete: SetNull)
  bondId             String?
  bond               Bond?    @relation(fields: [bondId], references: [id], onDelete: SetNull)
  bondCoverage       String   @default("own") // own | broker_bond | single_transaction | none
  screeningStatus    String   @default("pending") // pending | passed | flagged | blocked | overridden
  screeningDisposition Json?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([accountId])
  @@index([caseId])
}

model FiveOhSixRecord {
  id                 String   @id @default(cuid())
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  caseId             String?
  case               OnboardingCase? @relation(fields: [caseId], references: [id], onDelete: SetNull)
  onboardingEntityId String?
  legalEntityId      String?

  action             String   // CREATE | UPDATE
  importerNumberType String   // EIN | SSN | CBP_ASSIGNED
  importerNumber     String?
  // Structured 5106 payload — every CBP 5106 field, provenance-tracked,
  // same discipline as EntrySummaryDraft (7501-draft-and-abi-export.md U1).
  payload            Json
  provenance         Json     @default("{}")

  status             String   @default("draft") // draft|generated|submitted|accepted|rejected|superseded
  deliveryMethod     String?  // ABI | ACE_PORTAL | PAPER
  pdfDocumentUrl     String?
  transmissionRef    String?  // RealAceProvider reference
  cbpResponseRaw     String?
  cbpAssignedNumber  String?  // populated on accepted CBP_ASSIGNED create
  rejectionReasons   Json?

  submittedAt        DateTime?
  acceptedAt         DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([accountId, status])
  @@index([caseId])
}

model BondVerification {
  id                 String   @id @default(cuid())
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  bondId             String
  bond               Bond     @relation(fields: [bondId], references: [id], onDelete: Cascade)

  method             String   // CBP_IMPORTER_BOND_QUERY | SURETY_CODE_LOOKUP | MANUAL_ATTESTATION
  result             String   // match | no_bond_on_file | mismatch | lapsed | surety_unconfirmed | error
  queriedImporterNumber String?
  requestRaw         String?
  responseRaw        String?  // raw KR record set (evidence block)
  discrepancies      Json?    // [{ field, expected, cbpValue }]
  suretyCode         String?
  suretyName         String?
  attestedByUserId   String?
  attestationNote    String?

  performedAt        DateTime @default(now())
  createdAt          DateTime @default(now())

  @@index([accountId])
  @@index([bondId, performedAt])
}

model PoaEnvelope {
  id                 String   @id @default(cuid())
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  powerOfAttorneyId  String   @unique
  powerOfAttorney    PowerOfAttorney @relation(fields: [powerOfAttorneyId], references: [id], onDelete: Cascade)

  provider           String   // DOCUSIGN | DROPBOX_SIGN | INTERNAL | MANUAL_UPLOAD
  providerEnvelopeId String?
  templateId         String?
  status             String   // created | sent | delivered | signed | completed | declined | voided | error
  signerName         String
  signerEmail        String
  signerTitle        String?
  signerRole         String   // OFFICER | AUTHORIZED_EMPLOYEE | GENERAL_PARTNER | MANAGING_MEMBER | INDIVIDUAL
  sentAt             DateTime?
  completedAt        DateTime?
  executedDocumentUrl String?
  auditTrailUrl      String?  // provider's completion certificate
  webhookEventsRaw   Json     @default("[]")

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([accountId])
  @@index([status])
}

model PoaTemplate {
  id                 String   @id @default(cuid())
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  name               String
  version            Int      @default(1)
  entityTypes        String[] // which LegalEntity.entityType values this template serves
  bodyStorageUrl     String   // template doc with merge fields
  termMonths         Int?     // null = indefinite (CBP allows, but flag it)
  requiresNotarization Boolean @default(false)
  isDefault          Boolean  @default(false)
  active             Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([accountId, name, version])
  @@index([accountId, active])
}

// Broker's own filing authority — 19 CFR 111. One row per Account, plus
// district-permit children. Checked independently of any OnboardingCase (S14).
model BrokerComplianceProfile {
  id                 String   @id @default(cuid())
  accountId          String   @unique
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  licenseType        String   // INDIVIDUAL | CORPORATE | PARTNERSHIP
  brokerLicenseNumber String?
  licenseIssueDate   DateTime?
  nationalPermitNumber String?
  nationalPermitStatus String  @default("none") // none | pending | active | suspended | revoked
  filerCode          String?  // mirrors AbiFilerCredential.filerCode for display
  triennialStatusReportDueOn DateTime?
  responsibleSupervisionAttestedByUserId String?
  responsibleSupervisionAttestedAt DateTime?

  status             String   @default("incomplete") // incomplete | ready | restricted
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  permitQualifyingOfficers BrokerPQO[]
  districtPermits          BrokerDistrictPermit[]

  @@index([accountId])
}

model BrokerPQO {
  id        String   @id @default(cuid())
  profileId String
  profile   BrokerComplianceProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  userId    String?
  name      String
  individualLicenseNumber String
  districts String[] // CBP district codes this PQO covers; empty = national
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([profileId])
}

model BrokerDistrictPermit {
  id        String   @id @default(cuid())
  profileId String
  profile   BrokerComplianceProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  districtCode String
  permitNumber String?
  status    String   @default("active") // active | pending | suspended
  createdAt DateTime @default(now())

  @@unique([profileId, districtCode])
}

model OnboardingEvent {
  id        String   @id @default(cuid())
  accountId String
  caseId    String
  case      OnboardingCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  type      String   // STEP_COMPLETED | BLOCKER_ADDED | BLOCKER_CLEARED | 5106_SUBMITTED | POA_SENT | BOND_VERIFIED | SCREENING_RUN | ACTIVATED | SUSPENDED | WAIVER_GRANTED
  step      Int?
  actorUserId String?
  actorType String   @default("USER") // USER | PORTAL | SYSTEM
  detail    Json     @default("{}")
  createdAt DateTime @default(now())

  @@index([caseId, createdAt])
}
```

### 6.2 Changes to existing models

| Model | Change | Why |
|---|---|---|
| `Bond.status` | Migrate string values to the closed set in §4.2. Backfill `"Active" → verified` only where a `BondVerification` exists, else `unverified`; `"Unverified" → unverified`. | Current string is unconstrained and lied about verification. |
| `Bond` | Add `activityCode String?` (CBPF 301 activity code A–T), `continuousBondFormulaAmount Decimal? @db.Decimal(16,2)` (CBP-formula required amount at last check), `lastVerifiedAt DateTime?`, `verifications BondVerification[]`, `onboardingEntities OnboardingEntity[]`. | Sufficiency math (S6), verification history. |
| `PowerOfAttorney` | Add `signerName String?`, `signerTitle String?`, `signerRole String?`, `executionMethod String?` (E_SIGN \| WET_INK \| WET_INK_NOTARIZED), `executedDocumentUrl String?`, `templateId String?`, `revokedAt DateTime?`, `revokedReason String?`, `envelope PoaEnvelope?`, `onboardingEntities OnboardingEntity[]`. Constrain `status` to §4.2 set. Stop defaulting `expirationDate` in the route. | POA becomes an executed instrument with a provable signer (S7, S8). |
| `ImporterOfRecord` | Add `onboardingCase OnboardingCase[]` (back-relation), `onboardingEntities OnboardingEntity[]`, `registrationStatus String @default("unregistered")` (unregistered \| pending_5106 \| registered), `cbpImporterNumber` becomes nullable *only for the transient pre-CBP-assigned window* — keep `@unique` but allow null (Postgres allows multiple nulls). | Non-resident create (S2) has no number until CBP issues one. |
| `CustomsProfile.powerOfAttorneyStatus` | Keep; now driven by the `PowerOfAttorney.status` machine rather than set by hand. | Single source of truth. |
| `Client.status` | Add `"ONBOARDING"` to the enum comment set (`ACTIVE | INACTIVE | ONBOARDING`). Filing routes treat `ONBOARDING` as not-yet-filable. | A client exists before it's activated. |
| `IntegrationConfig` | No schema change; `category: "ERP"` config gains a `configJson` shape convention (§7). | ERP sync reuses existing infra. |
| `Account` | Add `brokerComplianceProfile BrokerComplianceProfile?`, `onboardingCases OnboardingCase[]`, plus the other back-relations above. | |
| `AuditLog` | No change; new `action` values: `ONBOARDING_CASE_CREATED`, `FIVE_OH_SIX_SUBMITTED`, `POA_ENVELOPE_SENT`, `POA_EXECUTED`, `POA_REVOKED`, `BOND_VERIFIED`, `ONBOARDING_SCREENING_OVERRIDE`, `IMPORTER_ACTIVATED`, `ONBOARDING_WAIVER_GRANTED`, `BROKER_COMPLIANCE_UPDATED`. | Regulator-facing trail. |

### 6.3 5106 CATAIR codec (separate unit, ABI-cert discipline)

The structured 5106 payload (`FiveOhSixRecord.payload`) is defined now from the **CBP Form 5106 instructions** (public). The **wire codec** for ABI transmission (`src/lib/abi/importerCreate/`) is built the same way as every other `src/lib/abi/*` chapter:

1. Pull the source PDF live from cbp.gov into `docs/plans/catair-source-docs/` (browser-UA curl; WebFetch is 403'd — see the ABI doc's note). Candidate: the ACE CATAIR "Importer ID Input / 5106" chapter; confirm the exact chapter name, application-identifier code, and revision with the assigned CBP Client Representative before building.
2. Build `types.ts` / `recordSpecs.ts` / `build.ts` / `parse.ts` / `validate.ts` against verified field positions.
3. Round-trip test; wire into the batch/block envelope.
4. `fromOnboardingEntity.ts` maps `OnboardingEntity` + `LegalEntity` → codec input, composing to enveloped bytes via the same pattern as `entrySummary/fromCustomsFiling.ts`.

Until that codec + real transport exist, `deliveryMethod` is `ACE_PORTAL` or `PAPER` and the product generates the **PDF + a portal-entry worksheet**. The manufacturer-create chapter (`14a-manufacturer-create-v2.pdf`, already in the repo) is the closest structural analog for the codec build.

---

## 7. Integrations

### 7.1 Bond verification — CBP Importer/Bond Query (KI/KR)

**Reuse `src/lib/abi/importerBondQuery/` — it is already built and PDF-verified.** What's missing is the call path:

- `src/modules/onboarding/bondVerification.service.ts`:
  - `verifyBondViaCbp(accountId, bond, importerNumber)`:
    1. Resolve the account's `AbiFilerCredential` (via `RealAceProvider` config).
    2. Build a KI input (`importerBondQuery/build.ts`) with `addressRequestCode: "1"` (full K1–K8).
    3. Wrap in batch/block envelope; `RealAceProvider.transmit`-equivalent for query traffic (query transport is the same channel — this is where it depends on ABI Phase 1).
    4. Parse KR response (`importerBondQuery/parse.ts`) → `K1Output.queryResultsCode`:
       - `1` (on file w/ continuous bond) → compare `bondNumber`, `suretyCode`, `bondAmount`, `bondEffectiveDate`, `bondTerminationDate` to the `Bond` row → `match` or `mismatch` (with `discrepancies`).
       - `2` (on file, no bond) → `no_bond_on_file`.
       - `3` (voided) / `4` (inactive) → `lapsed`.
       - `0` (no info) → `no_bond_on_file` + a note the importer number itself may be wrong.
    5. Write a `BondVerification` row with the raw KR record set; update `Bond.status` + `Bond.lastVerifiedAt`.
- **Fallback when ABI transport isn't live:** `method: SURETY_CODE_LOOKUP` — validate the surety name/code against the bundled `docs/plans/catair-source-docs/active_sureties_2025.xlsx` (load into a `src/lib/abi/suretyCodes.ts` lookup, same treatment as the other reference tables), and `method: MANUAL_ATTESTATION` — an authorized user attests with a note and (ideally) an uploaded surety letter. Both produce a `BondVerification` row; only `CBP_IMPORTER_BOND_QUERY` with `result: match` sets `Bond.status: verified` automatically — the others set `attested` and surface as a softer badge.

### 7.2 Bond sufficiency (continuous)

`src/modules/onboarding/bondSufficiency.ts` — pure, Decimal:

```
requiredContinuousBondAmount(priorYearDutyTaxFee: Decimal): Decimal
  // 10% of aggregate duties/taxes/fees for the prior 12 months,
  // rounded up to the next $10,000 below $100,000 and the next
  // $100,000 above; $50,000 statutory minimum.
```

Input source, in priority order: (a) actual sum of `CustomsFiling` duty/tax/fee for the importer over trailing 12 months (switching brokers, S3), (b) operator's projected estimate (`OnboardingCase.projectedAnnualDutyTaxFee`). Store the computed figure on `Bond.continuousBondFormulaAmount`. A nightly job re-runs this for active importers and raises a `blocked_bond` blocker + `ExceptionItem` if the bond falls below formula.

### 7.3 POA e-signature

`src/lib/esign/` — provider interface + adapters, mirroring `transmissionProvider.ts`:

```ts
interface EsignProvider {
  createEnvelope(input: EsignEnvelopeInput): Promise<{ providerEnvelopeId: string; status: string }>;
  getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState>;
  downloadExecutedDocument(providerEnvelopeId: string): Promise<Buffer>;
  downloadCertificate(providerEnvelopeId: string): Promise<Buffer>;
  parseWebhook(headers, rawBody): EsignWebhookEvent; // signature-verified
}
```

- Adapters: `DocusignProvider`, `DropboxSignProvider`, `InternalProvider` (a minimal in-app click-to-sign with recorded IP/timestamp/consent for low-risk cases), `ManualUploadProvider` (no-op create; completion is the operator's upload + attestation).
- Credentials via the same `SecretStoreResolver` pattern as `AbiFilerCredential` — never plaintext in `IntegrationConfig`.
- Webhook route: `POST /api/webhooks/esign/[provider]` — verifies provider signature, loads `PoaEnvelope` by `providerEnvelopeId`, appends the raw event, transitions status; on `completed` downloads the executed PDF + certificate to storage (GCS in demo/prod, local-fs on localhost — per the storage memo, no Vercel Blob), sets `PowerOfAttorney.status: executed`, `executedDocumentUrl`, `signedDate`, and `expirationDate` from `PoaTemplate.termMonths`. Emits `WorkflowOutboxEvent`.
- Executed-document storage uses the existing `loadDocumentBytes` / document pipeline so the POA is a first-class document (viewable in the PDF viewer, checksummed, dedup-aware).

### 7.4 ERP onboarding

Reuse `IntegrationConfig` (`category: "ERP"`), `IntegrationPayload`, `IntegrationSyncLog`, `IntegrationEntityMap` — the exact pattern QuickBooks uses.

- **Connect:** `/app/admin/integrations` already saves ERP configs. Add per-provider adapters under `src/lib/integrations/erp/{netsuite,sap,dynamics}/` with an `ErpProvider` interface: `listEntities()`, `listProducts()`, `listAddresses()`. Auth per provider (NetSuite TBA, SAP OAuth, etc.) via `SecretStoreResolver`.
- **Pull:** `src/modules/onboarding/erpImport.service.ts`:
  1. Fetch entity + product + address master → store raw in `IntegrationPayload`.
  2. Normalize to candidate `Client` / `LegalEntity` / `Product` / `Party` shapes.
  3. **Dedupe** against existing account records:
     - Exact: EIN, tax ID, normalized legal name + postal code.
     - Fuzzy: name trigram similarity + address similarity → candidate list with scores (reuse the fuzzy match approach from the document-intake weighted-identifier work).
     - Never auto-merge; produce `ErpImportProposal` rows (transient — can live in `IntegrationPayload.payloadJson` or a small table) with `action: create | link_existing | skip`.
  4. `/app/onboarding/erp-review` renders proposals; operator dispositions each; commit writes real rows + `IntegrationEntityMap` (so re-sync updates, not duplicates — the fix for the 69-dup problem) + `IntegrationSyncLog`.
- **Ongoing:** ERP is the master for entity/product data post-onboarding; a scheduled sync refreshes mapped records and raises a review item on conflicting changes. Onboarding-critical fields (legal name, EIN, address on the 5106) are change-controlled — an ERP change to them on an `active` importer creates an action, not a silent overwrite.

### 7.5 Other systems already in the platform

- **Customer portal** (`apps/portal`): the self-service wizard (§3.2), via the existing `Invitation` model with `purpose: CUSTOMER_PORTAL`. No new invite infra.
- **Billing**: Step 6 writes payment terms / billing contact / rate-card assignment through existing billing models; no change beyond wiring the wizard step to them.
- **Filing**: consumes `OnboardingCase` readiness via `filingReadiness.ts` (§4.3).
- **`/app/actions` (Today)**: onboarding blockers become action items via the existing producer pattern — a new `onboardingBlockerProducer` emitting into the notification/action hub built in the nav-IA redesign phases 3a–3b.

---

## 8. API specification

All routes: `withAuthenticatedRoute`, `accountId` from `ctx`, mutations behind `checkIdempotency`/`persistIdempotency` and `createAuditLog`, permission `onboarding.manage` unless noted. Add `onboarding.manage` / `onboarding.activate` / `broker_compliance.manage` to `packages/auth/src/permissions.ts`; screening `BLOCKED` override → existing `compliance.override`; waivers → `compliance.override` or `account.manage`.

> **Phantom-permission warning — verified 2026-08-31.** The permission catalogue is `packages/auth/src/permissions.ts` (`src/lib/permissions.ts` just re-exports `@qubere/auth`). The bonds route already guards on `"bonds.manage"` and the IOR/POA routes on `"parties.manage"` — **neither string exists in the catalogue** (same class as the `documents.create` phantom from the doc-flow work). This PR must: (a) add `onboarding.manage`, `onboarding.activate`, `broker_compliance.manage` as real catalogue entries with `defaultRoles`; (b) either add `bonds.manage`/`parties.manage` as real entries or repoint those routes at real permissions — do not copy the broken pattern. Screening disposition uses the existing `compliance.override`; waivers use `compliance.override` or `account.manage`.

### 8.1 Cases

| Method | Route | Body / notes |
|---|---|---|
| `GET` | `/api/onboarding/cases` | `?status=&assignee=&clientId=&q=` → list. |
| `POST` | `/api/onboarding/cases` | `{ clientId? , newClient?: {name, contact...}, path }` → creates case in `draft`, returns `caseId`. |
| `GET` | `/api/onboarding/cases/[caseId]` | Full case + entities + artifacts + computed readiness. |
| `PATCH` | `/api/onboarding/cases/[caseId]` | `{ assignedUserId?, projectedAnnualDutyTaxFee?, path? }`. |
| `POST` | `/api/onboarding/cases/[caseId]/activate` | Server re-computes readiness; 409 with the blocker list if not `ready_to_activate`. On success: `Client.status = ACTIVE`, IOR `registrationStatus`, case `active`, outbox event. |
| `POST` | `/api/onboarding/cases/[caseId]/withdraw` | `{ reason }`. |
| `POST` | `/api/onboarding/cases/[caseId]/waivers` | `{ checklistItem, reason }` — `compliance.override` or `account.manage`; records `OnboardingEvent` + `AuditLog`. |
| `GET` | `/api/onboarding/cases/[caseId]/events` | Timeline. |

### 8.2 Steps / entities

| Method | Route | Notes |
|---|---|---|
| `PUT` | `/api/onboarding/cases/[caseId]/entities/[entityId]` | Upsert legal-entity + importer-number-type + officers + resident agent. Validates EIN format/checksum; dup check. Creates/updates `LegalEntity` + `ImporterOfRecord` (IOR in `pending_5106`). |
| `POST` | `/api/onboarding/cases/[caseId]/entities` | Add another importing entity (S4). |
| `DELETE` | `/api/onboarding/cases/[caseId]/entities/[entityId]` | Only while case not `active`. |

### 8.3 5106

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/onboarding/5106` | `{ caseId, entityId, action }` → builds `FiveOhSixRecord` draft from entity data with provenance. |
| `PATCH` | `/api/onboarding/5106/[id]` | Edit 5106-specific fields; re-validate. |
| `POST` | `/api/onboarding/5106/[id]/pdf` | Renders CBP Form 5106 PDF → stores as document → `status: generated`. |
| `POST` | `/api/onboarding/5106/[id]/transmit` | Only if account has certified importer-create chapter + active `AbiFilerCredential`. Builds enveloped bytes, calls provider, stores `transmissionRef`, `status: submitted`. Idempotent (never double-file). 422 with the precise missing prerequisite otherwise. |
| `POST` | `/api/onboarding/5106/[id]/mark-filed` | `{ method: ACE_PORTAL | PAPER, confirmationRef, filedAt }` → `status: submitted` (manual). |
| `POST` | `/api/webhooks/abi/importer-response` (or polled) | Parses CBP accept/reject → `accepted` (+ `cbpAssignedNumber` when applicable, written back to `ImporterOfRecord.cbpImporterNumber` + `registrationStatus: registered`) or `rejected` (+ `rejectionReasons`). |

### 8.4 POA

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/onboarding/poa/templates` | List active `PoaTemplate`s (filtered by entity type). |
| `POST` | `/api/onboarding/poa/templates` | `broker_compliance.manage`. Upload template doc + term + notarization flag. |
| `POST` | `/api/onboarding/poa` | `{ caseId, entityId, templateId, executionMethod, signer: {name,title,role,email} }`. Validates `signer.role` against `LegalEntity.entityType`. Creates `PowerOfAttorney` (`draft`) + (for e-sign) `PoaEnvelope`. |
| `POST` | `/api/onboarding/poa/[id]/send` | E-sign: creates provider envelope, `out_for_signature`. |
| `POST` | `/api/onboarding/poa/[id]/upload` | Wet-ink: `{ documentId, attestation: { verifiedAuthority: true, note }, notarized?, apostille? }` → `PowerOfAttorney.status: executed`, method `WET_INK*`. |
| `POST` | `/api/onboarding/poa/[id]/revoke` | `{ reason }` → `revoked`, propagates (S8): case → `suspended` if active, open filings get `ExceptionItem`. |
| `POST` | `/api/webhooks/esign/[provider]` | Signature-verified; drives `PoaEnvelope` + `PowerOfAttorney` state; stores executed PDF + certificate. No auth guard (webhook) but provider-signature-verified + `connectionKey`-style routing. |

### 8.5 Bond

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/onboarding/bond` | `{ caseId, entityId, coverage, bond?: {suretyName, suretyCode, bondNumber, bondType, bondAmount, activityCode, effectiveDate, expirationDate} }`. `coverage: broker_bond` links the account master bond; `single_transaction` / `none` set the branch. |
| `POST` | `/api/onboarding/bond/[bondId]/verify` | Runs KI/KR (or falls back per §7.1). Returns `BondVerification`. Idempotent within a short window. |
| `POST` | `/api/onboarding/bond/[bondId]/attest` | `{ note, suretyLetterDocumentId? }` → `MANUAL_ATTESTATION` verification, `Bond.status: attested`. |
| `GET` | `/api/onboarding/bond/sufficiency?caseId=` | Returns `{ requiredAmount, basis: HISTORICAL|PROJECTED, actualAmount, sufficient }`. |
| `GET` | `/api/onboarding/bond/[bondId]/verifications` | History (evidence). |

### 8.6 Screening

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/onboarding/cases/[caseId]/screen` | Screens entity + officers + parent via the existing screening path; writes `ScreeningLog` rows; sets `OnboardingEntity.screeningStatus`. |
| `POST` | `/api/onboarding/screening/[screeningLogId]/disposition` | `{ decision: FALSE_POSITIVE | CONFIRMED_BLOCK | OVERRIDE, note }` — `compliance.override`. `OVERRIDE` on a BLOCKED match requires a reason and is heavily audited. |

### 8.7 Broker compliance

| Method | Route | Permission |
|---|---|---|
| `GET`/`PUT` | `/api/admin/broker-compliance` | `broker_compliance.manage` — the profile. |
| `POST`/`DELETE` | `/api/admin/broker-compliance/pqo` | PQO rows. |
| `POST`/`DELETE` | `/api/admin/broker-compliance/district-permits` | District permit rows. |
| `POST` | `/api/admin/broker-compliance/attest-supervision` | Records the 111.28 responsible-supervision attestation (user + timestamp). |
| `GET` | `/api/admin/broker-compliance/filing-authority?districtCode=` | Returns whether the account may file (nationally / in a district) — consumed by the onboarding banner and filing readiness. |

### 8.8 Bulk / ERP

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/onboarding/import/dry-run` | Multipart CSV/JSON → validation report, no writes. |
| `POST` | `/api/onboarding/import/commit` | `{ mappingId, rows }` → N cases in `draft`; returns batch id. |
| `GET` | `/api/onboarding/import/[batchId]` | Batch progress + per-row blockers. |
| `POST` | `/api/onboarding/erp/[integrationConfigId]/pull` | Fetches ERP master → `IntegrationPayload` + proposals. |
| `GET` | `/api/onboarding/erp/[integrationConfigId]/proposals` | Proposal list with dedupe candidates. |
| `POST` | `/api/onboarding/erp/proposals/commit` | `[{ proposalId, action, linkTargetId? }]` → writes rows + `IntegrationEntityMap` + `IntegrationSyncLog`. |

### 8.9 Response conventions

- Every verification response includes an `evidence` object (raw request/response, timestamp, method) — not just a boolean.
- Readiness in `GET /api/onboarding/cases/[caseId]` is computed server-side, returned as `{ ready: boolean, checklist: [{ item, status, blocker?, evidenceRef? }] }`. Clients never re-derive it.
- Money fields are strings (Decimal-serialized), per C5 of the 7501 doc.

---

## 9. Security, audit, correctness constraints

1. **Tenant isolation** on every route and every portal read/write — assert the case/entity/bond/POA belongs to `ctx.accountId` (or, in the portal, to `Invitation.clientId`). This is the PR #97 IDOR class; add a shared `assertCaseAccess(caseId, ctx)` helper and use it everywhere.
2. **Idempotency** on all mutations, mandatory (not optional) on `5106/transmit` and `bond/verify` — a retried transmission must never double-file, a retried verify must not spam CBP.
3. **No invented values** (7501 doc C2): the 5106 record, bond fields, POA dates — unknown = null + `MISSING` provenance. The current IOR route's hardcoded fallbacks (`"12-3456789"`, `"100 Trade Plaza"`) and the POA route's `now + 3y` default are **removed**.
4. **Determinism** (7501 doc C4): 5106 PDF and payload are pure functions of the record; no `new Date()` / `Math.random()` in builders — inject `clock` / `sequence`.
5. **Secrets**: e-sign + ERP + ABI credentials via `SecretStoreResolver`, never `IntegrationConfig.apiKey`/`apiSecret` plaintext columns.
6. **Audit**: every state transition writes `OnboardingEvent` + (for regulator-facing actions) `AuditLog`. Activation, 5106 submission, POA execution/revocation, bond verification, screening overrides, and waivers are all audited with actor + reason.
7. **Screening is a hard gate**: a `BLOCKED` match cannot be cleared by `onboarding.manage`; only `compliance.override` + reason, and the override is a distinct, prominent audit event.
8. **Waivers are visible**: an activated case with waived checklist items shows a persistent "activated with exceptions" badge everywhere the importer appears; filing readiness still surfaces the waived risk.
9. **Migrations**: guarded SQL, deploy before code selects new columns, note in the PR.
10. **Tests**: Vitest from `apps/custom`; fixtures under `tests/fixtures/onboarding/`.

---

## 10. Rollout / what changes vs. what stays

| Keep as-is | Rework | Build new |
|---|---|---|
| `ImporterOfRecord`, `LegalEntity`, `CustomsProfile`, `Client`, `BondParty`, `Party`/`ShipmentParty` core shapes | `Bond.status` (string → enum + backfill), `PowerOfAttorney` (add signer/execution fields, stop defaulting), the POA + IOR API routes' hardcoded fallbacks | `OnboardingCase` + wizard, `FiveOhSixRecord` + PDF, `BondVerification` + KI/KR call path, `PoaEnvelope`/`PoaTemplate` + e-sign, `BrokerComplianceProfile`, ERP import service |
| `src/lib/abi/importerBondQuery/`, `src/lib/abi/ebond/`, batch/block envelope | `bonds/BondsClient.tsx` `handleVerifyCbp` (fake → real), `bond.service.ts` (add verification, sufficiency) | `src/lib/abi/importerCreate/` (5106 codec), `src/lib/esign/`, `src/lib/integrations/erp/`, `src/lib/abi/suretyCodes.ts` |
| `IntegrationConfig`/`Payload`/`SyncLog`/`EntityMap`, `Invitation`, `ScreeningLog`, `AuditLog`, `WorkflowOutboxEvent` | `navigation.ts` (add items), `/app/clients` \| `/importers-of-record` \| `/bonds` \| `/poa` (add status column + guided-onboarding CTA) | `filingReadiness.ts` blocker `IMPORTER_NOT_ONBOARDED`, `onboardingBlockerProducer` for `/app/actions` |
| `RealAceProvider` credential model (`AbiFilerCredential`, `SecretStoreResolver`) | — | `RealAceProvider` query-traffic support (shared with ABI Phase 1) |

**Phasing:**

Each phase is independently shippable and leaves the product more correct than before. "UX enabled" = what a user can actually do end-to-end once the phase ships.

| Phase | Build | UX path this enables | Still manual / stubbed after this phase |
|---|---|---|---|
| **P1 · Data + wizard skeleton**<br>*no external calls* | Schema migration (all §6.1 models with generic step names per §1.3); `OnboardingCase` state machine; wizard shell + steps 1 (legal entity), 6 (billing/access), 7 (review/activate); readiness model; `IMPORTER_NOT_ONBOARDED` filing blocker; `resolveImporterContext` + wiring into shipment/filing creation (§4.4); nav entry; `CountryOnboardingProfile` seam. | Operator opens `/app/onboarding/new`, creates a case for a client, captures the legal entity (name, address, entity type, EIN), configures billing, and **activates** — after manually ticking the 5106 / bond / POA checklist items as "handled outside Qubere." From then on **every new shipment for that client auto-inherits the importer** and filing is gated until the case is active. Replaces the disconnected `＋ Add` modals on `/clients`, `/importers-of-record`, `/bonds`, `/poa` with one guided flow. | 5106 = paper/portal, tracked only as a checkbox. Bond = typed in, `attested` only. POA = file upload, no signer identity. Screening = not run. Broker-side compliance = not checked. |
| **P2 · 5106 record + PDF** | `FiveOhSixRecord` model + provenance; the 5106 field editor (wizard step 2); CBP Form 5106 PDF generation; ACE-Portal data-entry worksheet; `mark-filed` (manual confirmation #). | Step 2 auto-fills a 5106 from the entity data; operator reviews the CBP-specific fields, clicks **Generate 5106 PDF**, files it via ACE Portal or mails it, then records the confirmation number + assigned importer number. The 5106 is now a real tracked artifact with acceptance state, not a checkbox. | No ABI transmission — `Transmit to CBP` button is present but disabled with "not certified yet." CBP acceptance is entered by hand. |
| **P3 · Bond verification + sufficiency** | `BondVerification` model; KI/KR call path via `RealAceProvider` query traffic; `active_sureties_2025` → `suretyCodes.ts` lookup; `bondSufficiency.ts` + nightly re-check job; replace `BondsClient` fake `handleVerifyCbp`. | Step 4: operator enters the importer's bond and clicks **Verify with CBP** — a real importer/bond query runs, fills/confirms the fields, stores the raw KR record as evidence, and sets `verified`. Sufficiency is computed from projected or historical duty and shown against the bond amount; an undersized bond **blocks activation** with the required figure and a pre-filled surety rider request. Bonds that lapse later raise an action automatically. | KI/KR depends on ABI transport being query-capable (ABI cert Phase 1); until then the surety-code lookup + manual attestation fallbacks carry it, clearly labelled as not-CBP-confirmed. |
| **P4 · POA e-signature** | `PoaEnvelope` / `PoaTemplate` models; `src/lib/esign/` provider interface + one adapter (DocuSign or Dropbox Sign) + `InternalProvider` + `ManualUploadProvider`; template merge + preview; `/api/webhooks/esign/[provider]`; revocation + expiry propagation. | Step 3: operator picks a POA template, the merge fields fill from entity data, and sends it for **e-signature** to a named signer whose role is validated against the entity type. The wizard shows "awaiting signature"; the webhook completes it, stores the executed PDF + signing certificate, and sets `executed` with a real term. Wet-ink upload (with authority attestation) stays available. Revoking a POA immediately suspends the case and flags open filings. | Only one e-sign vendor wired. Notarization/apostille for non-resident POAs captured as metadata + uploaded proof, not verified. |
| **P5 · Broker compliance + screening gate** | `BrokerComplianceProfile` (+ PQO / district permits, `country`-scoped); `/app/admin/broker-compliance`; filing-authority check + global banner; onboarding screening step (entity + officers + parent) via the existing screening path; disposition flow. | One-time: an admin records the broker's license, national/district permits, filer code, and 19 CFR 111.28 supervision attestation — the account now shows "ready to file" (or a banner listing what's missing, blocking activation regardless of importer readiness). Per importer: step 5 runs denied-party screening; `FLAGGED` needs an operator note to proceed, `BLOCKED` halts activation until a compliance-role user rejects or overrides with a logged reason. | District-permit granularity only if question #8 says it's needed. Screening list coverage bounded by what the existing path supports (question #6). |
| **P6 · Bulk + ERP onboarding** | CSV/JSON bulk import (`dry-run` → `commit` → batch dashboard); `src/lib/integrations/erp/*` adapters (first provider per question #7); `erpImport.service` with exact + fuzzy dedupe; `/app/onboarding/erp-review`; `IntegrationEntityMap` write-back. | A broker migrating a book of business uploads a CSV and gets N cases created in `draft` with a per-row blocker list to work through — bonds already on file are auto-found via KI/KR. A broker with a connected ERP pulls the importer's entity + product master, reviews de-dupe proposals (exact on EIN, fuzzy on name/address), and accepts rows into onboarding — re-syncs update instead of creating the 70th duplicate. | ERP is one provider. Product master import is entity-scoped; full product onboarding is F11's job. |
| **P7 · 5106 ABI transmission** | `src/lib/abi/importerCreate/` codec (source PDF pulled + Client-Rep-confirmed, same discipline as every other chapter); `fromOnboardingEntity` mapper; enable the `Transmit to CBP` button; `/api/webhooks/abi/importer-response`. | Step 2's **Transmit to CBP (ABI)** button goes live for accounts with the certified chapter + an active filer credential: the 5106 is transmitted, CBP's accept/reject comes back automatically, and on a non-resident create the CBP-assigned importer number is written straight back onto the `ImporterOfRecord`. No more portal round-trip. | Tracks ABI cert Phase 3 — ships only after that transport exists. Portal/paper paths remain for accounts not yet certified. |
| **P8 · Importer self-service portal** | `apps/portal` reduced wizard at `/onboarding/[token]`; proposal-and-approve write model; document upload (articles, W-9, prior CBP correspondence). | The broker invites the importer; the importer confirms their own entity details, provides officer info for the 5106, **signs the POA themselves**, and uploads supporting docs — all scoped to their `Invitation.clientId`. The broker still owns 5106 transmission, bond verification, screening, and activation. Cuts the back-and-forth email chase out of onboarding. | Importer edits land as proposals the broker approves (question #9), not direct writes. |
| *(later)* **P9 · Second country** | Seed a `CountryOnboardingProfile` for the target country; new `RegistrationProvider` + artifact models (e.g. `EoriRegistration`, `CustomsGuarantee`); representation-type fields. | The wizard renders the right steps for a non-US importer (EORI instead of 5106, guarantee instead of bond, direct/indirect representation instead of a US POA). Mirrors the Germany filing rollout — data + a provider impl, not a fork. | Out of scope for the F16 PRs; the P1 seams are what make it cheap. |

---

## 11. Acceptance criteria

- A broker can take a brand-new US importer from zero to filable entirely within `/app/onboarding`, and `/app/filing` refuses to file for that importer until the case is `active`.
- "Verify with CBP" on a bond makes a real KI/KR query (or, if transport isn't live, clearly says so and offers surety-code + attestation), stores the raw response, and never shows a hardcoded "validated" string again.
- A POA cannot reach `executed` without a named signer, a role valid for the entity type, and either a completed e-sign envelope or an upload + authority attestation.
- Activating a case with an undersized continuous bond is blocked, with the CBP-formula required amount shown.
- A screening `BLOCKED` match halts activation and can only be overridden by a compliance-role user with a logged reason.
- Every verification surface shows its evidence (raw record + timestamp + method), consistent with "prove every line item."
- Re-running an ERP pull updates mapped records instead of creating duplicates (`IntegrationEntityMap` hit).
- All new mutation routes are idempotent and audited; `5106/transmit` cannot double-file under retry.
- Non-resident (S2), broker-switch (S3), multi-entity (S4), STB-only (S5), and bulk (S9) scenarios each have an end-to-end Vitest fixture.
- No hardcoded importer numbers, ports, bond numbers, or addresses anywhere in the new code; unknowns are null + `MISSING` provenance.
- **Carryover:** after a client is activated, creating a shipment with that `clientId` (via any path — UI, chat, API, EDI, doc intake) auto-sets `Shipment.importerOfRecordId` and `importerName`; the resulting filing inherits `importerOfRecordId` + `bondId`; the 7501 draft populates Blocks 23/25/4 with correct provenance and **zero** re-entry. Multi-entity clients prompt for entity selection instead of silently picking wrong.
- **International seams:** `OnboardingCase.status` values are the generic set from §1.3 (no "5106"/"bond"/"POA" literal in the state machine); the wizard step list is read from a `CountryOnboardingProfile` row (`US` + `"*"` fallback seeded); registration + security artifacts are referenced through interfaces, not the concrete US models. A dummy `CountryOnboardingProfile` test row with a different step set renders a different wizard without code change.

## 12. Test plan (Vitest, `apps/custom`, `tests/fixtures/onboarding/`)

| Area | Cases |
|---|---|
| State machine | Every `OnboardingCase.status` transition; illegal transitions rejected; blocker set vs. primary status consistency. |
| Readiness | Checklist computation for each of S1–S14; waiver accounting; activation 409 payload. |
| 5106 | Payload build from each entity type; provenance completeness; PDF determinism (byte-identical for fixed clock); `CREATE` vs `UPDATE` (S3); CBP-assigned write-back (S2). |
| Bond verify | KR `queryResultsCode` 0/1/2/3/4 → correct `BondVerification.result`; discrepancy detection; fallback path selection; `verified` only on `CBP_IMPORTER_BOND_QUERY` + `match`. |
| Sufficiency | Formula at $0 / $400k / $9M prior-year; $50k floor; rounding boundaries; historical vs projected basis. |
| POA | Signer-role validation per entity type; e-sign happy path via mock provider; webhook signature rejection; revocation propagation to filings (S8); expiry job. |
| Screening | PASSED auto-complete; FLAGGED requires disposition; BLOCKED requires compliance role; override audit event shape. |
| Tenant isolation | Cross-account `caseId`/`bondId`/`poaId` access → 404; portal token scoped to its `clientId`. |
| Idempotency | Duplicate `5106/transmit` and `bond/verify` with same key → single side effect. |
| ERP | Dedupe exact (EIN) + fuzzy (name/address); proposal commit writes `IntegrationEntityMap`; re-pull updates not duplicates. |
| Broker compliance | Filing-authority check: national permit only vs district-required; account `restricted` blocks activation-independent filing. |
| Carryover (§4.4) | `resolveImporterContext` for single-entity, multi-entity (needs-selection), not-yet-active, and no-client shipments; shipment + filing FK inheritance; live POA/bond resolution reflects a revocation mid-filing; explicit override is audited. |
| Country seams (§1.3) | Wizard renders from `CountryOnboardingProfile`; a synthetic non-US profile with a different step set produces a different wizard and different mandatory checklist with no code change; `OnboardingCase.status` contains no country-specific literal. |

---

## 13. Open questions (resolve with the team / CBP Client Rep before P2/P3/P7)

1. **5106 ABI chapter identity.** Exact CATAIR chapter name, application-identifier code, and current revision for importer identity (5106) create/update — confirm with the assigned Client Rep (same caveat as every other chapter in the ABI cert doc). Is ABI 5106 transmission even offered to software vendors on the customer's filer code, or is ACE Portal the only realistic path near-term?
2. **e-sign vendor.** DocuSign vs Dropbox Sign vs build `InternalProvider` first. Legal's view on whether an in-app click-to-sign POA with recorded consent is acceptable for CBP purposes, or whether a named third-party e-sign audit trail is required.
3. **POA templates.** Does Qubere ship a default POA template (reviewed by trade counsel), or is every broker expected to upload their own? Affects P1 vs P4 scope.
4. **Bond sufficiency formula.** Confirm the current CBP continuous-bond formula and rounding rules (they have changed over the years) against CBP's current bond guidance before implementing §7.2.
5. **Broker bond coverage (S2/S5).** Does Qubere's broker customers' business model include lending their bond to non-resident importers, and if so what's the internal approval for it?
6. **Screening data source.** Which lists does the existing screening path actually cover (OFAC SDN, BIS Entity/DPL, UFLPA)? Onboarding needs at least those three; confirm coverage or flag as a dependency.
7. **ERP priority.** Which ERP first — NetSuite, SAP, Dynamics? Drives which adapter P6 builds.
8. **District permit granularity.** Post-2021 CBP largely moved to the national permit; do any of Qubere's target brokers still operate under district permits such that `BrokerDistrictPermit` is worth building now vs. later?
9. **Portal write model.** Do importer-submitted entity corrections write directly (with broker approval) or into a separate proposal queue? §3.2 assumes proposal + approve; confirm.
10. **International timeline.** Which non-US country is realistically next (EU / UK / CA), and how soon? Determines how much of the §1.3 abstraction is worth building in P1 vs. deferring — the seams (generic step names, `CountryOnboardingProfile`, provider/artifact interfaces) are cheap now and expensive to retrofit; the concrete second-country impl is not in F16 scope regardless.
11. **Carryover override policy.** When an operator overrides the client-default importer on one shipment (§4.4), is that ever legitimate, or should it require a supervisor? Affects whether the override is a plain audited action or a permissioned one.

---

## 14. Files this feature touches (index for implementers)

```
NEW  src/app/app/onboarding/                         (list, wizard, steps, import, erp-review)
NEW  src/app/admin/broker-compliance/
NEW  src/components/onboarding/OnboardingWizard.tsx + step bodies
NEW  src/app/api/onboarding/**                        (§8)
NEW  src/app/api/admin/broker-compliance/**
NEW  src/app/api/webhooks/esign/[provider]/route.ts
NEW  src/app/api/webhooks/abi/importer-response/route.ts
NEW  src/modules/onboarding/                          (case.service, bondVerification.service,
                                                       bondSufficiency, screening.service,
                                                       erpImport.service, readiness.ts)
NEW  src/lib/abi/importerCreate/                      (5106 codec — P7)
NEW  src/lib/abi/suretyCodes.ts                       (from active_sureties_2025.xlsx)
NEW  src/lib/esign/                                   (provider iface + adapters)
NEW  src/lib/integrations/erp/{netsuite,sap,dynamics}/
NEW  src/lib/onboarding/fiveOhSix/                    (record model, provenance, PDF)
NEW  src/modules/onboarding/importerContext.ts        (resolveImporterContext — the single carryover resolver, §4.4)
NEW  src/lib/onboarding/countryProfile.ts             (CountryOnboardingProfile lookup — §1.3 seam)
NEW  prisma/migrations/<ts>_add_customer_onboarding/
EDIT packages/db/prisma/schema.prisma                 (§6.1, §6.2)
EDIT src/lib/navigation.ts                            (§5.1)
EDIT src/modules/bonds/bond.service.ts                (verification, sufficiency, status enum)
EDIT src/app/app/bonds/BondsClient.tsx                (real verify)
EDIT src/app/api/importers-of-record/route.ts         (remove hardcoded fallbacks)
EDIT src/app/api/importers-of-record/[id]/poa/route.ts (remove defaulting; delegate to onboarding)
EDIT src/modules/filing/filingReadiness.ts            (IMPORTER_NOT_ONBOARDED blocker)
EDIT src/app/api/shipments/route.ts                   (call resolveImporterContext — set importerOfRecordId from clientId; §4.4)
EDIT src/app/api/filing/route.ts                      (inherit importerOfRecordId + bondId from shipment; §4.4)
EDIT chat shipment-creation tool + TransportationOrder→Shipment promotion + doc-intake shipment create  (all route through resolveImporterContext)
EDIT src/lib/filing/transmissionProvider.ts           (query-traffic support — shared w/ ABI Phase 1)
EDIT src/app/app/{clients,importers-of-record,bonds,poa}/*  (status column + guided CTA)
EDIT apps/portal/…/onboarding/[token]/                (self-service wizard — P8)
EDIT locale files                                     (new labelKeys)
EDIT packages/auth/src/permissions.ts                  (add onboarding.manage / onboarding.activate / broker_compliance.manage; fix phantom bonds.manage & parties.manage)
```

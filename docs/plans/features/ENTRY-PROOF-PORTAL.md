# Entry Proof (Partner Portal) — build epic

**Status:** Ready for implementation (Codex)
**Owner area:** `apps/portal`, `apps/custom`, `packages/db`, new `packages/entry-proof`
**Related issues:** #155 (portal is more than upload + status), #165 (customer portal), #211 / #219 (validated 7501 draft + provenance), #234 (F07 Filing & Entry), #168 (Section 301/232), #169 (AD/CVD), #215 (PGA-by-HTS), #172 (restricted-party), #174 (bond sufficiency), #185 (CF-28 / duty recovery), #288 / #139 / #156 (customer onboarding F16), #162 (shipment visibility), #151 (notification / SLA engine)

**Scope:** three shipped-together capabilities that make the portal a place a customer actually self-serves:
1. **Entry Proof** — line-by-line, evidence-backed verification of an entry + compliance scorecard (§2–§12).
2. **Self-serve shipment answers** — ETA, total cost, status, "what do you need from me", full shipment detail — so the customer stops phoning and emailing (§13).
3. **"Your setup" (onboarding ↔ portal)** — every stakeholder gets a login; onboarding progress, executed POA / 5106 / bond, importer numbers, bond, screening status, and assigned team all show in the portal (§14).

They share one spine: the broker curates and publishes; the portal reads a scoped, frozen, customer-safe view; every side-effectful customer action becomes a tracked `CustomerRequest`.

---

## 1. Why we're building this

We have no customers yet. The fastest path to design partners is **Qubere as a compliance co-pilot that sits next to the importer's existing broker** — zero switching cost, no ABI certification, no bond, no filer-of-record. The importer forwards documents, and Qubere independently verifies every entry line and shows the proof.

Today the portal shows a customer their entry as a **black-box number**:

```jsonc
// apps/portal/src/app/api/shipments/[id]/route.ts  → entries[]
{ "entryNumber": "...", "status": "Filed with customs", "dutyTotal": 41250, "taxTotal": 0 }
```

No per-line HTS, no duty-stack breakdown, no Section 301 / 232 / AD/CVD / PGA flags, no valuation basis, no evidence chain, no confidence. That is the opposite of the product positioning ("Qubere proves every line item — evidence must be visible, not hidden").

**This epic surfaces the proof the broker engine already computes** (`buildForm7501`, `computeFilingTariff`, `ComplianceFinding`, `RefundOpportunity`) as a customer-facing, evidence-annotated, scored view — plus a per-line "ask my broker" thread and a cross-shipment compliance scorecard.

### What already exists (reuse, do not rebuild)

| Capability | Location |
|---|---|
| Per-field 7501 provenance + `FieldStatus` (`sourced_approved` / `sourced_unapproved` / `missing`) | `apps/custom/src/lib/filing/form7501.ts` → `buildForm7501()` |
| Duty stack (base, 301, 232, AD, CVD, MPF, HMF) with `Decimal` math | `apps/custom/src/lib/tariff/dutyEngine.ts` → `computeFilingTariff()`, `calculateDutyStack()` |
| Trade-measure evaluation status (`EVALUATED_APPLICABLE` / `EVALUATED_NOT_APPLICABLE` / `NOT_EVALUATED` / `DATA_UNAVAILABLE` / `REVIEW_REQUIRED`) | `dutyEngine.ts` → `TradeMeasureEvaluationStatus`, `DutyRateInput.*Status` |
| Reference data: `Section301Rate`, `Section232Rate`, `AdCvdCompanyRate`, `HtsPgaRequirement`, `HtsDutyRate` | `packages/db/prisma/schema.prisma` |
| Compliance findings per filing | `ComplianceFinding` (filingId, rule, severity, description, recommendation, status, confidence) |
| Quantified recovery opportunities | `RefundOpportunity` (filingId, opportunityType, estimatedRefundAmount, basis, confidence) |
| Immutable per-filing fact snapshot | `FilingSnapshot.snapshotData` |
| Broker → customer publish gate | `apps/custom/src/app/api/broker/entries/[id]/publish/route.ts` sets `CustomsFiling.customerVisibleAt` |
| Portal resource authz + client scoping | `packages/auth/src/portal-auth.ts` → `authorizePortalResource()` |
| Portal request/question threads | `CustomerRequest` + `CustomerRequestMessage` + `CustomerRequestDocument`; portal routes under `apps/portal/src/app/api/requests/` |
| Portal permission catalogue | `packages/auth/src/permissions.ts` (`portal.entries.read`, `portal.entries.download`, `portal.requests.respond`, …) |

---

## 2. Core architectural decision

**The broker computes; the customer reads a frozen snapshot. The portal never recomputes duty or re-evaluates a measure.**

This mirrors `FilingSnapshot`. At publish time the broker workbench assembles an **`EntryProof`** — an immutable, versioned JSON payload — from the live engine output. The portal renders only that payload. Re-publishing supersedes the prior version. This guarantees:

- The customer and the broker see byte-identical numbers.
- "As of" dates (HTS release, reference-data vintage) are honest and frozen.
- No portal-side access to internal recommendation text or raw payloads.

```
                 apps/custom (broker)                         apps/portal (customer)
  ┌───────────────────────────────────────────┐        ┌──────────────────────────────┐
  │ filing/[id]  ──"Generate proof"──▶         │        │                              │
  │   entryProofService.generate(filingId)     │        │  /entries/[id]               │
  │     ├─ buildForm7501()                     │        │    GET /api/entries/[id]/proof│
  │     ├─ computeFilingTariff()               │        │      └─▶ reads EntryProof     │
  │     ├─ load ComplianceFinding[]            │        │          (status=PUBLISHED)   │
  │     ├─ load RefundOpportunity[]            │        │                              │
  │     ├─ assembleEntryProof()  (pure)        │        │  /compliance  (scorecard)    │
  │     └─ write EntryProof(status=DRAFT)      │        │    GET /api/proofs           │
  │                                            │        │                              │
  │ "Publish to customer" ──▶                  │        │  "Ask about this line" ──▶   │
  │   flips newest DRAFT ▶ PUBLISHED,          │◀───────│   POST /api/entries/[id]/    │
  │   supersedes prior, sets customerVisibleAt │        │        proof/comments        │
  │                                            │        │     → creates CustomerRequest│
  └───────────────────────────────────────────┘        └──────────────────────────────┘
```

### Package layout

| Package | Adds | Depends on |
|---|---|---|
| `packages/entry-proof` (**new**) | `EntryProofPayload` types + `assembleEntryProof()` (pure function: takes resolved 7501 result + tariff result + findings + measure statuses, returns payload + scorecard). No DB, no Next, no app imports. | nothing (or `decimal.js` only) |
| `packages/db` | `EntryProof` + `EntryProofEvent` models + migration; re-export `EntryProofPayload` type for convenience | — |
| `apps/custom` | `src/lib/filing/entryProofService.ts` (DB orchestration), broker API routes, broker "Entry Proof" tab, seed script | `@qubere/entry-proof`, local `form7501.ts` / `dutyEngine.ts` |
| `apps/portal` | proof API routes, `/entries/[id]` page, `/compliance` scorecard page, components | `@qubere/entry-proof` (type only), `@qubere/auth`, `@qubere/db` |

> **Why a pure package:** the seed script and the runtime must produce identical payloads. `assembleEntryProof()` is pure so both call the same code. The seed runs it via `apps/custom/scripts/seed-entry-proof-demo.ts` (which can import the app's `entryProofService`).

---

## 3. User workflow

### 3.1 Broker (apps/custom)

1. Broker completes a filing as normal (classification approved, valuation done, readiness gate passed).
2. On `app/filing/[id]`, a new **"Entry Proof"** tab shows the customer-facing proof exactly as the customer will see it, plus internal-only extras: per-field provenance rows, links to each `ComplianceFinding`, and a `verifyState` reason per line.
3. Broker clicks **"Generate / refresh proof"** → `EntryProof` row written with `status = DRAFT`, `version = n`.
4. Broker reviews the draft. If a line is `AT_RISK` (e.g. unapproved classification), the tab deep-links to the thing to fix.
5. Broker clicks **"Publish to customer"** (existing button, extended). This:
   - flips the newest `DRAFT` → `PUBLISHED`,
   - sets `supersededById` on any previously `PUBLISHED` proof for the filing,
   - sets `CustomsFiling.customerVisibleAt` (unchanged behaviour),
   - writes an `EntryProofEvent` (`PUBLISHED`) and an `AuditLog` row,
   - (optional, gated by existing notification infra) emails the client contact "Your entry summary and compliance proof for ENTRY-xxxx is ready."
6. If the broker later changes a classification and re-publishes, the customer sees `version 2` with a "Revised on <date>" banner; `version 1` stays readable to the broker.
7. When the customer asks a question on a line, it lands in the broker's existing `/app/clients` request queue (`CustomerRequest`, `domain = CUSTOMS`, `filingId` set, `metadata.entryProofLineNumber`).

### 3.2 Customer (apps/portal)

1. Customer logs in (passwordless invite, already built), lands on dashboard.
2. **Dashboard** gains a "Compliance" summary card: overall verified %, entries needing their attention, total duty savings Qubere has identified.
3. Customer opens a shipment → **"Proof"** tab (only shown when a `PUBLISHED` proof exists) → or clicks the entry from the **Entries** tab → dedicated **`/entries/[id]`** page:
   - **Header:** score ring (0–100) + band (Strong / Review / At risk), entry number, total entered value, total duty & fees, "Duty savings identified: $X", open-questions count, "Verified against HTSUS rev. 14 (2026-05-01) · AD/CVD data as of 2026-08-15", **Download 7501 (PDF)** button (existing endpoint).
   - **Line-by-line list.** Each `LineProofCard` collapses to: line #, description, HTS code + confidence chip, COO, entered value, line duty total, `verifyState` badge. Expands to:
     - **Classification:** approved HTS, "approved by <broker user> on <date>", GRI rules applied, link to ruling if `RulingHtsReference` exists, plain-English *"Why this code"*.
     - **Duty stack waterfall:** base duty (rate + $), Section 301 (tranche + $), Section 232 (commodity + $), AD/CVD (case # + $), MPF, HMF → line total. Each row shows its **evaluation status** ("Section 301: evaluated — List 3, +25%" vs "Section 232: evaluated — not applicable" vs "AD/CVD: not evaluated — no matching case data").
     - **PGA:** agency chips (FDA / EPA / …) with required form codes, or "No PGA requirements for this HTS".
     - **Valuation basis:** transaction value, assists declared/undeclared, related-party flag (from `ValuationAssistsRecord`).
     - **Evidence list:** each item = { document name + page, or reference-data citation, or "broker decision by X" } — links to the source doc in the portal where the customer is entitled to see it.
     - **Flags:** any `ComplianceFinding` touching this line, customer-safe severity + title + one-line "what this means for you" + $ impact if quantified.
     - **[Ask about this line]** button → inline composer → `POST …/proof/comments`.
   - **Findings & opportunities** section: filing-level `ComplianceFinding` (customer-safe) + `RefundOpportunity` rendered as "Potential duty recovery: $X — <basis> — talk to your broker".
   - **Questions** section: the `CustomerRequest` threads raised from this entry, with the existing message UI.
4. **`/compliance`** (new top-level nav item): table of every published proof across the customer's shipments — entry #, shipment, date, score, band, duty, savings identified, open questions. Sortable. This is the "compliance scorecard" from #155.

---

## 4. Scorecard math (spec — implement exactly in `assembleEntryProof`)

Per line, compute `verifyState`:

```
AT_RISK  if ANY of:
  - classificationStatus == "missing"  (no HTS at all)
  - classificationStatus == "sourced_unapproved"  AND line entered value >= 5% of entry total
  - baseDutyRate == null  (no published HTS duty rate resolved → duty understated)
  - an open ComplianceFinding with severity in {High, Critical} references this line
  - section301Status == "REVIEW_REQUIRED" or section232Status == "REVIEW_REQUIRED"
        or adcvdStatus == "REVIEW_REQUIRED"

REVIEW   else if ANY of:
  - classificationStatus == "sourced_unapproved"
  - any measure status == "NOT_EVALUATED" or "DATA_UNAVAILABLE"
  - an open ComplianceFinding with severity == "Warning" references this line
  - htsConfidence != null and htsConfidence < 75

VERIFIED else
  (approved classification present, every measure EVALUATED_*, base duty rate resolved,
   no open findings on the line)
```

Entry-level rollup:

```
linesTotal      = lines.length
linesVerified   = count(verifyState == VERIFIED)
linesReview     = count(verifyState == REVIEW)
linesAtRisk     = count(verifyState == AT_RISK)

scoreOverall (0–100), value-weighted so a $2 washer can't sink a $400k entry:
  wᵢ = lineᵢ.enteredValue / Σ enteredValue          (equal weights if Σ == 0)
  sᵢ = 100 if VERIFIED, 60 if REVIEW, 0 if AT_RISK
  scoreOverall = round( Σ (wᵢ · sᵢ) )

scoreBand:
  STRONG  if scoreOverall >= 90 and linesAtRisk == 0
  AT_RISK if scoreOverall <  70 or linesAtRisk > 0
  REVIEW  otherwise

dutyTotal              = tariffResult.totalDuty + tariffResult.totalFees
dutySavingsIdentified  = Σ RefundOpportunity.estimatedRefundAmount where status == "Identified"
                          + Σ ComplianceFinding.metadata.dutyImpact where < 0 (overpayment)
openFindingsCount      = count(ComplianceFinding where status in {Open, Investigating})
```

All money math uses `Decimal` (reuse `apps/custom/src/lib/tariff/decimal.ts`; `packages/entry-proof` may take pre-stringified decimals to stay dependency-free, or depend on `decimal.js` directly — pick one and document it).

---

## 5. API contract

### 5.1 `packages/entry-proof` — types (the payload contract)

```ts
// packages/entry-proof/src/types.ts
export type VerifyState = "VERIFIED" | "REVIEW" | "AT_RISK";
export type ScoreBand = "STRONG" | "REVIEW" | "AT_RISK";
export type MeasureStatus =
  | "EVALUATED_APPLICABLE" | "EVALUATED_NOT_APPLICABLE"
  | "NOT_EVALUATED" | "DATA_UNAVAILABLE" | "REVIEW_REQUIRED";

export interface EvidenceRef {
  kind: "DOCUMENT" | "REFERENCE_DATA" | "BROKER_DECISION" | "RULING";
  label: string;                 // "Commercial Invoice INV-4471, p.2" | "HTSUS rev.14 General col." | "Approved by Sarah Chen"
  sourceModel: string;           // "ShipmentDocument" | "HtsDutyRate" | "ProductClassification" | "RulingHtsReference"
  sourceId: string | null;
  portalHref: string | null;     // set only when the customer is entitled to open it
  citation: string | null;       // federal register cite, ruling number, etc.
}

export interface ProofFlag {
  code: string;                  // "HTS_OVERRIDE_RISK" | "VALUATION_ASSIST_UNDECLARED" | "S301_REFUND" | ...
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  title: string;
  whatItMeans: string;           // customer-safe, 1 sentence — NOT the internal `recommendation`
  dutyImpactUsd: string | null;  // signed decimal string; negative = customer overpaid
  findingId: string | null;      // ComplianceFinding.id or RefundOpportunity.id
}

export interface DutyStackRow {
  key: "BASE" | "SECTION_301" | "SECTION_232" | "ANTIDUMPING" | "COUNTERVAILING" | "MPF" | "HMF";
  label: string;
  status: MeasureStatus;
  ratePct: number | null;
  amountUsd: string;             // decimal string
  detail: string | null;        // "List 3, USTR 2024 four-year review" | "Case A-570-601" | "commodity STEEL"
}

export interface EntryProofLine {
  lineNumber: number;
  shipmentLineItemId: string | null;
  description: string;
  htsCode: string | null;
  htsDescription: string | null;
  htsConfidence: number | null;
  classificationStatus: "sourced_approved" | "sourced_unapproved" | "missing";
  classificationApprovedBy: string | null;
  classificationApprovedAt: string | null;   // ISO
  griRulesApplied: string[];
  whyThisCode: string | null;
  countryOfOrigin: string | null;
  quantity: number | null;
  enteredValueUsd: string;       // decimal string
  dutyStack: DutyStackRow[];
  lineDutyTotalUsd: string;
  pgaAgencies: Array<{ agencyCode: string; programCode: string | null; formCodes: string[]; mandatory: boolean }>;
  valuation: { transactionValueUsd: string; assistsDeclared: boolean; assistsUndeclaredEstimateUsd: string | null; relatedParty: boolean } | null;
  verifyState: VerifyState;
  verifyReason: string;          // short human sentence — shown to broker, and to customer when not VERIFIED
  evidence: EvidenceRef[];
  flags: ProofFlag[];
}

export interface EntryProofPayload {
  schemaVersion: 1;
  filingId: string;
  entryNumber: string;
  entryType: string | null;
  importerName: string;
  portOfEntry: string | null;
  countryOfExport: string | null;
  generatedAt: string;           // ISO
  htsReleaseId: string | null;
  htsReleaseLabel: string | null;      // "HTSUS revision 14 — effective 2026-05-01"
  referenceDataAsOf: string | null;    // ISO — oldest of {s301, s232, adcvd} vintages consulted
  totals: {
    enteredValueUsd: string;
    dutyUsd: string;
    feesUsd: string;
    dutyAndFeesUsd: string;
  };
  scorecard: {
    scoreOverall: number;
    scoreBand: ScoreBand;
    linesTotal: number;
    linesVerified: number;
    linesReview: number;
    linesAtRisk: number;
    dutySavingsIdentifiedUsd: string;
    openFindingsCount: number;
  };
  lines: EntryProofLine[];
  findings: ProofFlag[];               // filing-level (not tied to one line)
  coverageStatus: { required: number; sourced: number; approved: number; missing: number };  // from buildForm7501
}

export function assembleEntryProof(input: AssembleInput): EntryProofPayload;
```

`AssembleInput` = `{ form7501: Form7501Result, tariff: TariffEngineResult, measureStatusByLine: Record<number, {...}>, findings: NormalizedFinding[], refundOpportunities: NormalizedRefund[], htsReleaseLabel, referenceDataAsOf, valuationByLine }`. Keep `Form7501Result` / `TariffEngineResult` shapes structurally typed in the package (copy the interfaces; don't import from `apps/custom`).

### 5.2 Broker routes (apps/custom)

| Method + path | Auth | Behaviour |
|---|---|---|
| `POST /api/broker/entries/[id]/proof/generate` | `withAuthenticatedRoute`, perm `filing.approve`, `write: true` | Loads filing (scoped to `ctx.accountId`), runs `entryProofService.generate(filingId, ctx)`. Supersedes any existing `DRAFT` for the filing, writes new `EntryProof` `status=DRAFT` `version = max+1`, writes `EntryProofEvent(GENERATED)`. Returns the payload + `{ entryProofId, version }`. |
| `GET /api/broker/entries/[id]/proof` | perm `filing.read` | Returns the newest proof (DRAFT or PUBLISHED) for the filing with **internal extras**: full `form7501` provenance blob + `ComplianceFinding` rows (raw `recommendation`). Used by the broker tab. |
| `POST /api/broker/entries/[id]/publish` (**extend existing**) | perm `filing.approve` | After the existing `customerVisibleAt` update: within the same transaction, flip newest `DRAFT` proof → `PUBLISHED` (`publishedByUserId`, `publishedAt`), set `supersededById` on the prior `PUBLISHED`, write `EntryProofEvent(PUBLISHED)`. If no `DRAFT` exists, call `entryProofService.generate` first. Extend the `AuditLog.newValue` with `entryProofId` + `version`. |

`entryProofService.generate(filingId, ctx)` orchestration (in `apps/custom/src/lib/filing/entryProofService.ts`):
1. Load `CustomsFiling` + `shipment.lineItems` + `snapshot` + `importerOfRecord` + `bond` (same query as `entry-summary/route.ts`).
2. `buildForm7501(header, lineInputs, htsReleaseId)` — reuse the exact input assembly from `entry-summary/route.ts` (approved classification join, `loadHtsCodesMap`, published `HtsRelease`).
3. `computeFilingTariff(lineItems, htsCodesMap)` for the duty stack per line.
4. Resolve **measure statuses** per line: query `Section301Rate` / `Section232Rate` / `AdCvdCompanyRate` / `AdcvdOrder` / `HtsPgaRequirement` by the line's HTS + COO + manufacturer. Row found → `EVALUATED_APPLICABLE`/`EVALUATED_NOT_APPLICABLE`; no row + code in a tranche list → `EVALUATED_NOT_APPLICABLE`; code not in any reference table → `NOT_EVALUATED`. (Extract this into `dutyEngine.ts` if a helper doesn't already return it — check `DutyRateInput.*Status`.)
5. Load `ComplianceFinding` (filingId) + `RefundOpportunity` (filingId) + `ValuationAssistsRecord` (filingId).
6. Map findings → `ProofFlag` (customer-safe: derive `whatItMeans` from a `code`→copy lookup table in the package; never pass `recommendation` through). Associate to a line via `ComplianceFinding.metadata.lineNumber` when present, else filing-level.
7. `assembleEntryProof(...)`.
8. `db.entryProof.create({ ... status: "DRAFT", payload, scoreOverall, scoreBand, ...rollups })`.

### 5.3 Portal routes (apps/portal)

| Method + path | Auth | Behaviour |
|---|---|---|
| `GET /api/entries/[id]/proof` | `authorizePortalResource({ permission: "portal.entries.read", resourceAccountId, resourceClientId, importerName })` — resolve via `CustomsFiling → shipment { accountId, clientId, importerName }` | Return the `PUBLISHED` `EntryProof.payload` for the filing (newest non-superseded). 404 if none published. Strip nothing — the payload is already customer-safe by construction. Add `Cache-Control: no-store`. |
| `GET /api/proofs` | authenticated portal user; scope with `resolvePortalClientScope` | List every `PUBLISHED` proof for the caller's client scope: `[{ filingId, entryNumber, shipmentId, shipmentNumber, publishedAt, scoreOverall, scoreBand, dutyAndFeesUsd, dutySavingsIdentifiedUsd, openQuestionCount }]`. Powers `/compliance`. |
| `POST /api/entries/[id]/proof/comments` | `authorizePortalResource({ permission: "portal.entries.comment", ... })` (**new perm**) | Body `{ lineNumber?: number, body: string }`. Creates `CustomerRequest` (`domain: "CUSTOMS"`, `type: "QUESTION"`, `filingId`, `shipmentId`, `clientId`, `title` = `Question on entry <entryNumber>` + line suffix, `metadata: { entryProofLineNumber }`) + first `CustomerRequestMessage` (`authorType: "CUSTOMER"`). Returns the created request. Reuses existing request pipeline (broker notification, `/app/clients` queue). |
| `GET /api/shipments/[id]` (**extend**) | existing | Add to each `entries[]` item: `proof: { available: boolean, scoreOverall, scoreBand, linesVerified, linesTotal, openFindingsCount, dutySavingsIdentifiedUsd } | null`. |
| `GET /api/dashboard` (**extend**) | existing | Add `complianceSummary: { entriesWithProof, avgScore, linesAtRiskTotal, dutySavingsIdentifiedUsd }`. |

### 5.4 New permissions (`packages/auth/src/permissions.ts`)

```ts
{ name: "portal.entries.comment", description: "Ask the broker a question about an entry line.",
  category: "Customer",
  defaultRoles: ["CUSTOMER_ADMIN","CUSTOMER_USER","CUSTOMER_CUSTOMS_USER","BROKER_ADMIN","OWNER"] },
// broker side: reuse existing "filing.approve" / "filing.read" — no new broker perm.
```

Add to `portal-auth` tests alongside the existing `portal.shipments.read` cases.

---

## 6. Schema changes (`packages/db/prisma/schema.prisma`)

Two new models. Migration name: `<timestamp>_entry_proof`.

```prisma
/// Immutable, versioned, customer-facing proof of an entry. Generated by the
/// broker workbench from the live 7501 + duty engine at publish time and read
/// verbatim by the portal — the portal never recomputes. Mirrors FilingSnapshot's
/// "freeze the facts" contract, but this row is the curated, evidence-annotated,
/// customer-safe view (FilingSnapshot stays internal).
model EntryProof {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  filingId  String
  filing    CustomsFiling @relation(fields: [filingId], references: [id], onDelete: Cascade)
  shipmentId String?
  shipment   Shipment? @relation(fields: [shipmentId], references: [id], onDelete: SetNull)
  clientId  String
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)

  version   Int
  status    String  @default("DRAFT") // DRAFT | PUBLISHED | SUPERSEDED

  // ── rolled-up scorecard (kept as columns for cheap list/sort in /compliance) ──
  scoreOverall           Int
  scoreBand              String   // STRONG | REVIEW | AT_RISK
  linesTotal             Int
  linesVerified          Int
  linesReview            Int
  linesAtRisk            Int
  dutyAndFeesUsd         Decimal  @db.Decimal(16, 2)
  dutySavingsIdentifiedUsd Decimal @default(0) @db.Decimal(16, 2)
  openFindingsCount      Int      @default(0)

  // ── the immutable render payload (EntryProofPayload, schemaVersion 1) ──
  payload           Json
  htsReleaseId      String?
  referenceDataAsOf DateTime?

  generatedByUserId String?
  publishedByUserId String?
  publishedAt       DateTime?

  supersededById String?     @unique
  supersededBy   EntryProof? @relation("EntryProofSupersession", fields: [supersededById], references: [id], onDelete: SetNull)
  supersedes     EntryProof? @relation("EntryProofSupersession")

  events    EntryProofEvent[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([filingId, version])
  @@index([accountId])
  @@index([filingId])
  @@index([clientId, status])
  @@index([accountId, status, publishedAt])
}

/// Append-only audit of what happened to a proof. Never mutated.
model EntryProofEvent {
  id           String     @id @default(cuid())
  entryProofId String
  entryProof   EntryProof @relation(fields: [entryProofId], references: [id], onDelete: Cascade)
  accountId    String
  type         String     // GENERATED | PUBLISHED | SUPERSEDED | CUSTOMER_QUESTION
  actorUserId  String?
  actorType    String     // BROKER | CUSTOMER | SYSTEM
  detail       Json?
  createdAt    DateTime   @default(now())

  @@index([entryProofId])
  @@index([accountId, createdAt])
}
```

Add back-relations: `EntryProof[]` on `Account`, `CustomsFiling`, `Client`, `Shipment?`.

**No change** to `ShipmentLineItem`, `ComplianceFinding`, `RefundOpportunity`, `CustomerRequest` except: `CustomerRequest.metadata` — confirm it exists as `Json?`; if not, add it (used for `entryProofLineNumber`).

---

## 7. Portal UI build (apps/portal)

Match the existing style (Tailwind classes, `qubere-card`, `#0071E3` accent, tab pattern in `shipments/[id]/page.tsx`).

| File | What |
|---|---|
| `src/app/(portal)/entries/[id]/page.tsx` (**new**) | Client component; `fetch('/api/entries/${id}/proof')`; renders `EntryProofHeader` + `LineProofCard[]` + `FindingsPanel` + `QuestionsPanel`. Not-found state when 404. |
| `src/app/(portal)/compliance/page.tsx` (**new**) | `fetch('/api/proofs')`; sortable table; each row links to `/entries/[filingId]`. Empty state: "Your broker hasn't published a compliance proof yet." |
| `src/components/entry-proof/EntryProofHeader.tsx` | Score ring (SVG, no dep), band pill, totals, "Duty savings identified", "Verified against …" line, **Download 7501** (`<a href="/api/entries/${id}/download">` — existing). |
| `src/components/entry-proof/LineProofCard.tsx` | Collapsed row + expanded detail per §3.2. Duty waterfall = simple flex bars. Measure chips coloured by `MeasureStatus` (green EVALUATED_APPLICABLE/NOT_APPLICABLE, amber NOT_EVALUATED/DATA_UNAVAILABLE, red REVIEW_REQUIRED). |
| `src/components/entry-proof/MeasureChip.tsx`, `VerifyBadge.tsx`, `EvidenceList.tsx`, `FlagRow.tsx` | Small presentational pieces. |
| `src/components/entry-proof/AskAboutLine.tsx` | Inline composer → `POST …/proof/comments` → optimistic append. |
| `src/app/(portal)/shipments/[id]/page.tsx` (**edit**) | Add `"proof"` to the tab union; show tab only when `entries.some(e => e.proof?.available)`; render `<LineProofCard>` list inline or link out to `/entries/[id]`. Add score chip to each entry row in the existing **Entries** tab. |
| `src/app/(portal)/page.tsx` (**edit**) | Add the "Compliance" dashboard card from `complianceSummary`. |
| `src/app/(portal)/*nav*` | Add "Compliance" nav item (find the sidebar/nav component; there's a `BellIcon`/`ShipmentIcon` set in `../../icons`). |

**Broker side (apps/custom):**

| File | What |
|---|---|
| `src/app/app/filing/[id]/page.tsx` (**edit**) | Add "Entry Proof" tab. `fetch('/api/broker/entries/${id}/proof')`; render the same card components (share via `packages/entry-proof` presentational? — no, keep portal components in portal; the broker tab can be a leaner read-only table + a "Generate/refresh" + "Publish" button that calls the existing publish route). Show provenance + raw finding `recommendation` here. |
| `src/lib/filing/entryProofService.ts` (**new**) | Orchestration per §5.2. |
| `src/app/api/broker/entries/[id]/proof/generate/route.ts` (**new**) | Per §5.2. |
| `src/app/api/broker/entries/[id]/proof/route.ts` (**new**) | Per §5.2. |
| `src/app/api/broker/entries/[id]/publish/route.ts` (**edit**) | Add the proof-publish transaction step. |

---

## 8. Seed data

### 8.1 Demo shape

Extend `packages/db/prisma/seeds/seed-customer-portal.ts` to build **two fully-lined entries** with contrasting proof outcomes, then run proof generation from `apps/custom/scripts/seed-entry-proof-demo.ts`.

**Account:** `slug: "demo-account"`. **Clients:** `Target Corporation`, `Amazon Import Services` (both already seeded).

**Shipment A — `SHP-TGT-2026-001` (Target) — band STRONG, one recovery opportunity:**

| Line | Description | HTS | COO | Qty | Value | Expected verifyState | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Stainless steel ball valve, 1/2" NPT | `8481.80.5090` | DE | 400 | $48,000 | VERIFIED | approved classification, base duty only |
| 2 | Cast iron pipe fittings | `7307.19.3085` | DE | 1,200 | $22,400 | VERIFIED | base duty only |
| 3 | Aluminium mounting brackets | `7616.99.5190` | CN | 800 | $17,600 | REVIEW | Section 232 aluminium **evaluated — applicable (+10%)**; Section 301 List 3 **applicable (+25%)** — flagged as a **`RefundOpportunity`** ($ = 25% × value) "check Section 301 exclusion 9903.88.69" |
| 4 | Steel machine screws | `7318.15.8065` | TW | 5,000 | $6,300 | VERIFIED | 232 evaluated — not applicable (TW not covered) |

`CustomsFiling`: `entryNumber "ENTRY-TGT-24001"`, `entryType "01"`, `filingStatus "Released"`, totals computed, `customerVisibleAt` set.
Findings: 1× `RefundOpportunity` (line 3, `opportunityType "retroactive_exclusion"`, `estimatedRefundAmount` ≈ $4,400, `confidence 88`). 1× `ComplianceFinding` (`rule "Section 301 Exclusion Review"`, `severity "Warning"`, `status "Open"`, `metadata.lineNumber 3`).
Expected: `scoreOverall` ~88, band `REVIEW` (one REVIEW line) — **tune line values so the value-weighted score lands ~88 and band = REVIEW**; adjust the doc table if the math says otherwise.

**Shipment B — `SHP-ACME-2026-002` (Amazon Import Services) — band AT_RISK:**

| Line | Description | HTS | COO | Qty | Value | Expected verifyState | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Lithium-ion power banks | `8507.60.0020` | CN | 2,000 | $70,000 | AT_RISK | classification **sourced_unapproved** + value > 5% of entry → AT_RISK; Section 301 List 3 applicable |
| 2 | Blood-glucose test strips | `3822.00.0000` (device) | CN | 10,000 | $40,000 | REVIEW | `HtsPgaRequirement` FDA (form `FDA_2877`) — PGA chip shown; classification approved |
| 3 | Steel storage racks | `9403.20.0090` | CN | 500 | $30,000 | AT_RISK | Section 232 steel applicable; `AdcvdOrder` case `A-570-042` (steel racks) → AD/CVD **applicable** but no `AdCvdCompanyRate` row → `adcvdStatus "DATA_UNAVAILABLE"` + `ComplianceFinding` severity `High` |
| 4 | Plastic bins | `3924.10.4000` | CN | 8,000 | $9,000 | REVIEW | 301 List 4A applicable |

`CustomsFiling`: `entryNumber "ENTRY-ACM-24002"`, `filingStatus "Accepted"`, `customerVisibleAt` set.
Findings: 1× `ComplianceFinding` (`rule "HTS Override Risk"`, `severity "High"`, `status "Open"`, `metadata.lineNumber 1`), 1× (`rule "AD/CVD Rate Unavailable"`, `severity "High"`, `metadata.lineNumber 3`), 1× (`rule "Valuation — related party"`, `severity "Warning"`).
`ValuationAssistsRecord`: `relatedPartyTransaction true`.
Also seed **one open `CustomerRequest`** (`domain "CUSTOMS"`, `type "QUESTION"`, `filingId` = B, `metadata.entryProofLineNumber 3`, title "Question on entry ENTRY-ACM-24002 — line 3", one customer message "Is the antidumping case really applicable here? Our supplier says their racks are excluded.").
Expected: `scoreOverall` ~45, band `AT_RISK`.

**Reference data:** ensure `packages/db/prisma/seeds/seed-trade-remedy-reference-data.ts` (Section301Rate / Section232Rate / AdCvdCompanyRate) and `seed-data/adcvd-orders.json` cover the HTS codes above. Add rows if missing:
- `Section301Rate`: `7616.99.5190` List 3 25%, `8507.60.0020` List 3 25%, `9403.20.0090` List 3 25%, `3924.10.4000` List 4A 7.5%
- `Section232Rate`: `7616.99.5190` ALUMINIUM 10%, `9403.20.0090` STEEL 25%, `7318.15.8065` STEEL 25% (country TW → not applicable)
- `AdcvdOrder`: `A-570-042` (steel racks, CN) — leave `AdCvdCompanyRate` **absent** on purpose so line B-3 exercises `DATA_UNAVAILABLE`.
- `HtsPgaRequirement`: `3822.00.0000` FDA `["FDA_2877"]` mandatory.
- `HtsDutyRate` / `HtsNode` for all 8 codes in the current published `HtsRelease` (reuse `loadHtsCodesMap` expectations).

### 8.2 Scripts & commands

`apps/custom/scripts/seed-entry-proof-demo.ts` (**new**), pattern-matched to `seed-multileg-demo.ts`:

```
/**
 * Seeds line items + CustomsFiling + findings on SHP-TGT-2026-001 and
 * SHP-ACME-2026-002, then generates + publishes an EntryProof for each by
 * calling the same entryProofService the API uses. Idempotent. Non-destructive
 * to anything it doesn't own.
 *
 *   npx tsx apps/custom/scripts/seed-entry-proof-demo.ts
 */
```

- `assertNotProduction()` guard identical to the multileg script (`/app\.qubere\.ai/i.test(process.env.DATABASE_URL)`).
- Resolve `SHP-ACME-2026-002` — create it under the Amazon client if the portal seed didn't (mirror the `SHP-TGT-2026-001` creation block in `seed-customer-portal.ts`).
- Upsert line items by `(shipmentId, lineNumber)`; upsert `CustomsFiling` by `(accountId, entryNumber)`.
- For each filing: `await entryProofService.generate(filingId, systemCtx)` then flip `DRAFT → PUBLISHED` (or call a `entryProofService.publish` helper so seed == runtime).
- Log the resulting `scoreOverall` / `scoreBand` so a mismatch with this doc is visible.

**Run order (document in the script header and in `docs/`):**

```bash
# localhost (from repo root, .env points at local Postgres)
npm --workspace @qubere/db run db:seed          # base + portal demo data
npx tsx apps/custom/scripts/seed-entry-proof-demo.ts

# demo DB (DATABASE_URL = demo, NOT app.qubere.ai)
DATABASE_URL=$DEMO_DATABASE_URL npx tsx apps/custom/scripts/seed-entry-proof-demo.ts
```

Portal user for demo: `porter@target.com` (see `apps/portal/scripts/seed-porter-user.ts`) is assigned to Target → sees Shipment A. Add an Amazon portal user (`trade@amazon-import.test`) assigned to the Amazon client via `UserClientAssignment` so the two-client isolation contrast still works.

### 8.3 Local dev servers

`.claude/launch.json` already has `portal` (port 3002) and `worktree-dev`. Add a `custom` entry (`cwd: apps/custom`, `port: 3001`) if not present so both apps run for an end-to-end demo.

---

## 9. Test plan

**`packages/entry-proof` (unit, vitest):**
- `assembleEntryProof` — value-weighted score, each `verifyState` branch, band thresholds, `dutySavingsIdentified` summation, empty-entry (Σ value = 0) equal-weight fallback.
- `ProofFlag` mapping never leaks `recommendation` text (assert output only contains `whatItMeans` from the code table).

**apps/custom (route + service, vitest — run from `apps/custom`):**
- `entryProofService.generate` produces a payload whose `totals.dutyAndFeesUsd` equals `computeFilingTariff` output for the same filing (parity test).
- `POST /publish` transitions `DRAFT → PUBLISHED`, supersedes prior, is idempotent, writes `EntryProofEvent` + `AuditLog`.
- Regenerate after a classification change → `version 2`, `version 1` becomes `SUPERSEDED`.

**apps/portal (route, vitest):**
- `GET /api/entries/[id]/proof` — 404 when only a `DRAFT` exists; 200 with payload when `PUBLISHED`; **cross-tenant: a Target user gets 404/403 for an Amazon entry** (extend `portal-auth` test patterns).
- `POST …/proof/comments` creates a scoped `CustomerRequest` with `metadata.entryProofLineNumber`.
- `GET /api/proofs` respects `resolvePortalClientScope`.

**E2E (`apps/portal/e2e`, if Playwright is wired):** publish from broker → customer sees Proof tab → expand a line → ask a question → broker sees the request.

---

## 10. Out of scope (v1)

- Direct ABI/ACE transmission or entry-number assignment (that's #212 / #160 — this feature is deliberately broker-agnostic).
- Real generated-PDF downloads (7501/invoice PDFs are still stubs — the deck already says "don't demo that"; the **Download 7501** button stays but keep the existing stub caveat).
- Customer-initiated re-classification or duty recompute.
- Automated exclusion matching for Section 301 (`Section301Exclusion` regex) — v1 flags "check exclusion" as a `RefundOpportunity`; the auto-match is a fast-follow (#215-adjacent).
- Multi-country (non-US) proof — payload is HTSUS/7501-shaped for v1; `schemaVersion` field is there to extend later.
- Email ingestion of customer docs into this flow — separate (#104 / #260), natural next epic once partners are on Entry Proof.

---

## 11. Suggested task breakdown for Codex

1. **`packages/entry-proof`** — scaffold package, `types.ts`, `assembleEntryProof.ts`, scorecard math, `flagCopy.ts` (code→customer-safe copy), unit tests. *(no app deps — do first)*
2. **Schema** — `EntryProof` + `EntryProofEvent` models, migration, back-relations, `CustomerRequest.metadata` check. `prisma generate`.
3. **`entryProofService.ts`** (apps/custom) — orchestration; reuse `entry-summary/route.ts` input assembly; measure-status resolver helper in `dutyEngine.ts`.
4. **Broker routes** — `proof/generate`, `proof` (GET), extend `publish`. Route tests.
5. **Broker tab** — `app/filing/[id]` "Entry Proof" tab (read-only table + Generate + Publish).
6. **Portal API** — `entries/[id]/proof`, `proofs`, `proof/comments`, extend `shipments/[id]` + `dashboard`. New `portal.entries.comment` permission + auth tests.
7. **Portal UI** — `entries/[id]/page.tsx`, components, `shipments/[id]` proof tab, `/compliance` page, dashboard card, nav item.
8. **Seed** — reference-data rows, extend `seed-customer-portal.ts`, new `seed-entry-proof-demo.ts`, Amazon portal user, `launch.json` entry. Verify scores match §8.1 (adjust doc if not).
9. **Deck** — update `apps/custom/public/deck/partner-portal.html` (see below).
10. **Docs** — short "How to demo Entry Proof" in `docs/sales/` + update `docs/plans/features/` index.

---

## 12. Sales deck update (do after the feature works)

**File:** `apps/custom/public/deck/partner-portal.html`. The nav dots/counter auto-build from `.slide` count (`assets/deck.js`), so only author `<section class="slide …">` blocks. Match existing classes (`slide-pale`, `feature-layout`, `app-frame`, `demo-tip`).

**Edits:**

1. **Slide 1 (title)** — update the stat row: add a third stat `"every line — HTS, duty, 301/232, AD/CVD, PGA — verified with evidence"`. Update the honest-note to: *"Pilot / design-partner ready. Auth, client scoping, storage, and the entry-proof pipeline are live. Generated 7501/invoice PDF downloads are still stubs — don't demo that flow."*

2. **New slide after current #5 (Shipment + entry visibility) — "Proof, not just status":**
   - `feature-eyebrow`: "Entry Proof"
   - `feature-headline`: "Your client sees *why* the duty is what it is — line by line."
   - `feature-pain`: "The broker publishes an entry. The client opens it and sees every line: approved HTS with the ruling behind it, the full duty stack (base, Section 301, 232, AD/CVD, MPF, HMF), PGA flags, valuation basis — and the evidence for each. Frozen at publish; the client and the broker see identical numbers."
   - bullets: "Section 301 / 232 / AD/CVD shown as *evaluated*, not just a number" · "Every figure links to the document or reference rule it came from" · "Unapproved or unrated lines are flagged, not hidden"
   - `app-frame` mock: a `LineProofCard` expanded — HTS `8507.60.0020` / conf 82% / "Classification not yet approved" amber · duty waterfall rows · "Section 301: List 3, +25% — $17,500" · "AD/CVD: not evaluated — no matching case data" amber.
   - `demo-tip`: "Broker: publish ENTRY-ACM-24002. Portal (Amazon login): open the entry → expand line 1 → show the amber 'classification not approved' flag and the 301 line → click 'Ask about this line'. Broker: the question is in the clients queue."

3. **New slide — "The compliance scorecard":**
   - `feature-headline`: "One number your client can take to their CFO."
   - `feature-pain`: "Every published entry gets a value-weighted score (0–100) and a band — Strong / Review / At risk. `/compliance` lists them all: entry, score, duty, and the duty savings Qubere has already identified."
   - bullets: "Value-weighted — a $2 washer can't sink a $400k entry" · "Duty savings identified rolls up `RefundOpportunity` findings" · "At-risk lines link straight to the question thread"
   - `app-frame` mock: the `/compliance` table — `ENTRY-TGT-24001 · 88 · Review · $12,940 · $4,400 identified` and `ENTRY-ACM-24002 · 45 · At risk · $38,200 · 1 open question`.
   - `demo-tip`: "Portal: open /compliance with the Target login — one Review entry, $4,400 flagged for recovery. This is the 'second set of eyes' pitch in one screen."

4. **Slide 7 ("What the customer cannot do")** — add a bullet: "Cannot change a classification, duty figure, or score — Proof is read-only and broker-published."

5. **Slide 8 (objection handling)** — add: *"'We already have a broker.' — Exactly. Entry Proof rides alongside them: forward the entry packet, Qubere verifies every line independently and shows your client where duty was overpaid or a classification is exposed. No filing, no switching."*

6. Cross-links: in `apps/custom/public/deck/compliance-and-screening.html` and `index.html` hub blurb, add a pointer to the new partner-portal slides if those pages summarize portal capability.

**Also:** add `docs/sales/PARTNER-PORTAL-ENTRY-PROOF-DEMO.md` — a 5-minute demo script (login as Target → /compliance → open ENTRY-TGT-24001 → expand line 3 → recovery opportunity; then login as Amazon → ENTRY-ACM-24002 → at-risk lines → ask a question → switch to broker → see it in the queue).

---

## 13. Self-serve shipment answers ("stop calling the broker")

**Goal:** a customer opening a shipment can answer, without a phone call or email: *Where is it? When will it arrive / clear? What will it cost me? What's the hold-up? What do you need from me? What are the reference numbers? Which documents are on file?* Every one of those is already in the database — it is just not exposed or not assembled into an answer.

### 13.1 Data that already exists (reuse — no new source-of-truth tables)

| Question the customer asks | Answer source (already in schema) |
|---|---|
| "What's my ETA? Has it changed? Why?" | `EtaObservation` (`eta`, `previousEta`, `deltaMinutes`, `reasonCode`, `estimatedAt`, `confidence`), `Shipment.estimatedArrival`, `Shipment.arrivalDate`, `Shipment.promiseState` (`ON_PROMISE`/`AT_RISK`/`MISSED`), `Shipment.customerPromiseDate` |
| "Where is it right now?" | `TrackingEvent` (`eventType`, `classifier`, `occurredAt`, `locationName`, `unlocode`), `ShipmentLeg` / `ShipmentStop` journey ribbon (already seeded on `SHP-TGT-2026-001`), `ShipmentEventLog` |
| "Has it cleared customs? Is it on hold? Why?" | `CustomsFiling.filingStatus` (+ `mapPortalShipmentStatus`), `PgaHold` (hold reason, agency), `ExceptionItem` (customer-safe ones), `ComplianceDeadline` OPEN/MISSED |
| "What will this cost me?" | `EntryProof.totals` (duty + fees) **+** `Invoice` / `InvoiceLine` (issued broker charges, `totalAmount`, `status`, `dueDate`) **+** `Shipment.sellAmount` (customer-facing total; **never** `expectedBuyCost` / `actualBuyCost` / `grossProfit` / `grossMarginPct`) **+** `ShipmentCharge` where `portalVisible` (add flag — see below) |
| "What's the container / BL / booking / PO number?" | `ShipmentTrackingIdentifier` (`BOOKING`/`MBL`/`HBL`/`CONTAINER`), `Shipment.poReference`, `CustomsFiling.entryNumber` |
| "Who's the carrier / what vessel / what port?" | `Shipment.carrierName`, `Shipment.portOfEntry`, `Shipment.countryOfExport`, `Shipment.transportMode`, `Shipment.incoterm`, `ShipmentLeg` (vessel/voyage in `ShipmentLeg` fields / equipment) |
| "When's the Last Free Day? Am I about to get demurrage?" | `Shipment.lastFreeDay`, `Shipment.demurrageExposureUsd` |
| "What do you need from me?" | open `CustomerRequest` (`type` DOCUMENT/QUESTION/CONFIRMATION), `ComplianceDeadline` OPEN with a customer-actionable rule, `EntryProof` lines with `verifyState = AT_RISK` needing a customer fact |
| "What documents do you have?" | `ShipmentDocument` where `portalVisibility = "CUSTOMER"` |
| "What's the status overall?" | `Shipment.status`, `Shipment.currentStage`, `Shipment.healthStatus`, `Shipment.readinessScore` |

### 13.2 New: `ShipmentAnswers` assembler + endpoint

**No LLM in v1.** A deterministic assembler turns the rows above into a typed "answer set" the portal renders as a **"Shipment at a glance"** panel + an **"Ask"** list of common questions with pre-filled answers. (v2 can hand this same typed context to the existing AI assistant — see #240 / #281 — so the chat is grounded, not hallucinated.)

```ts
// packages/entry-proof/src/shipmentAnswers.ts  (pure; same package, shared by seed + runtime)
export interface AnswerCard {
  key: string;                 // "eta" | "total_cost" | "customs_status" | "needs_from_you" | "reference_numbers" | "documents" | "carrier_routing" | "demurrage"
  question: string;            // "When will my shipment arrive?"
  answer: string;              // "Estimated arrival Nov 14, 2026 at Los Angeles/Long Beach. Moved 2 days later on Oct 30 — carrier schedule change."
  status: "OK" | "ATTENTION" | "ACTION_REQUIRED" | "UNKNOWN";
  facts: Array<{ label: string; value: string; href?: string }>;   // structured backup shown under the sentence
  updatedAt: string | null;    // ISO — freshness of the underlying data
  askHref?: string;            // deep-link to raise a CustomerRequest pre-scoped to this topic
}

export interface ShipmentAnswerSet {
  shipmentId: string;
  shipmentNumber: string;
  generatedAt: string;
  headline: { transportationStatus: string; customsStatus: string; promiseState: string | null; healthLabel: string | null };
  eta: { current: string | null; previous: string | null; changedOn: string | null; reason: string | null; confidence: number | null };
  cost: {
    dutyAndFeesUsd: string | null;      // from published EntryProof
    brokerChargesUsd: string | null;    // from issued Invoice / portal-visible ShipmentCharge
    estimatedTotalUsd: string | null;   // sum; null if any component unknown, with `costIsPartial: true`
    costIsPartial: boolean;
    invoices: Array<{ invoiceNumber: string; totalUsd: string; status: string; dueDate: string | null; href: string }>;
  };
  cards: AnswerCard[];
  milestones: Array<{ label: string; occurredAt: string; location: string | null; classifier: string }>;
  referenceNumbers: Array<{ type: string; value: string }>;
  needsFromYou: Array<{ kind: "REQUEST" | "DEADLINE" | "PROOF_LINE"; title: string; dueAt: string | null; href: string }>;
}

export function assembleShipmentAnswers(input: ShipmentAnswersInput): ShipmentAnswerSet;
```

**Endpoint (portal):** `GET /api/shipments/[id]/answers`
- Auth: `authorizePortalResource({ permission: "portal.shipments.read", ... })` (same as `shipments/[id]`).
- Handler loads the row set (one Prisma query with `include`, mirroring `shipments/[id]/route.ts`) + latest `EntryProof` + issued `Invoice`s + latest `EtaObservation`s + `TrackingEvent`s (latest 20) + open `CustomerRequest`s + OPEN `ComplianceDeadline`s + `PgaHold`s.
- Calls `assembleShipmentAnswers(...)`. Returns `ShipmentAnswerSet`. `Cache-Control: no-store`.
- **Redaction rule (enforce in the assembler, test it):** never emit `expectedBuyCost`, `actualBuyCost`, `grossProfit`, `grossMarginPct`, `costVariancePct`, internal `ExceptionItem` notes, broker-internal `AgentDecision.humanNotes`, or any `ShipmentCharge` without `portalVisible = true`.

**Schema deltas for §13:**

```prisma
// ShipmentCharge — add:
portalVisible Boolean @default(false)   // broker opt-in; only these roll into the customer's "what will this cost" number

// ComplianceDeadline — add (if not present):
customerActionable Boolean @default(false)   // true = show in portal "needs from you" (e.g. "supplier's mill test certificate"); false = internal clock
customerLabel      String?                   // plain-English restatement for the portal, e.g. "We need your signed origin declaration"
```

Everything else is read-only reuse.

### 13.3 Portal UI for §13

| File | What |
|---|---|
| `src/app/(portal)/shipments/[id]/page.tsx` (**edit**) | New default sub-view **"At a glance"** above the existing tabs: `HeadlineStatus` (transport + customs pills, promise state, health), `EtaCard`, `CostCard`, `NeedsFromYouCard`, then an accordion of `AnswerCard`s. Keep existing Overview/Documents/Entries/Invoices/Requests tabs. |
| `src/components/shipment-answers/EtaCard.tsx` | "Arrives ~Nov 14 at LA/LB" + "changed 2 days later on Oct 30 — carrier schedule change" + confidence bar. |
| `src/components/shipment-answers/CostCard.tsx` | Duty & fees (link to Entry Proof) + broker invoices (link) + estimated total, with a clear "estimate — final on invoice" caption when `costIsPartial`. |
| `src/components/shipment-answers/NeedsFromYouCard.tsx` | Merged list of open requests + customer-actionable deadlines + at-risk proof lines; each has a CTA (Upload / Answer / Confirm). Empty state: "Nothing needed from you right now." |
| `src/components/shipment-answers/AnswerAccordion.tsx` | Renders `cards[]`; each expandable to show `facts[]`; "Still need help? Ask your broker" → `POST /api/shipments/[id]/requests` (reuse existing request-create; pre-fill title from `card.question`). |
| `src/app/(portal)/page.tsx` (**edit**) | Dashboard "Needs your attention" already exists — extend it to also pull `needsFromYou` across all shipments. |

### 13.4 Seed for §13

On both demo shipments (`SHP-TGT-2026-001`, `SHP-ACME-2026-002`), and reuse the multileg data already on the Target shipment:

- `EtaObservation` ×3 per shipment showing an ETA that slipped once (`reasonCode: "CARRIER_SCHEDULE_CHANGE"`, `deltaMinutes: 2880`) then held.
- `TrackingEvent` ×6 per shipment: `VESSEL_DEPARTURE`, `TRANSSHIPMENT_LOADED`, `VESSEL_ARRIVAL`, `DISCHARGED`, `CUSTOMS_RELEASE` (Target only — Amazon stays "in progress"), `AVAILABLE_FOR_PICKUP`.
- `ShipmentTrackingIdentifier`: BOOKING, MBL, HBL, 2× CONTAINER per shipment (Target's already exist from the multileg seed — reuse).
- `Shipment` fields: set `carrierName`, `portOfEntry` (`"Los Angeles/Long Beach, CA (2704)"`), `transportMode "Ocean"`, `incoterm "FOB"`, `customerPromiseDate`, `promiseState` (Target `ON_PROMISE`, Amazon `AT_RISK`), `lastFreeDay` (Amazon = 36h out → demurrage warning), `demurrageExposureUsd` (Amazon `1850.00`).
- `Invoice` + `InvoiceLine`: one issued invoice per shipment (Target `SENT` $1,240 brokerage + disbursement; Amazon `ISSUED` $1,690), `dueDate` +30d.
- `ShipmentCharge` rows with `portalVisible = true` for the customer-facing components; leave buy-side costs `portalVisible = false`.
- Amazon: one `PgaHold` (FDA, reason "FDA review — prior notice", status open) so "why is it held" has a real answer; one `ComplianceDeadline` `customerActionable = true`, `customerLabel = "Upload the FDA prior-notice confirmation number"`, `dueAt` +2d.
- Target: `CustomsFiling.filingStatus = "Released"`, a `CUSTOMS_RELEASE` tracking event, `Shipment.status = "Completed"`.

---

## 14. "Your setup" — onboarding ↔ portal integration

**Goal:** the importer's whole relationship with the broker is visible and self-service. Every stakeholder (importer admin, each officer/signer, billing contact, customs contact, and — for enterprise supplier-collection — supplier parties) has a login. Onboarding progress, the **executed** POA / 5106 / bond, the CBP importer number, screening status, and the assigned broker team all show in the portal under **Setup**. Signed documents land there automatically the moment the e-sign provider reports completion.

### 14.1 What exists (reuse)

- `OnboardingCase` (`path`, `status`, `currentStep`, `stepStatus` Json, `blockers` Json, `projectedAnnualDutyTaxFee`, `activatedAt`), `OnboardingEntity` (`importerNumber`, `officers` Json, `poa`, `bond`, `screeningStatus`, `screeningDisposition`), `OnboardingEvent`, `FiveOhSixRecord` (`status`, `cbpAssignedNumber`, `pdfDocumentUrl`, `deliveryMethod`).
- `PowerOfAttorney` (`status` draft→out_for_signature→executed, `executedDocumentUrl`, `executionMethod`, `signerName/Title/Role/Email`, `expirationDate`), `PoaEnvelope` (`provider`, `status`, `executedDocumentUrl`, `auditTrailUrl`, `completedAt`, `signerEmail`).
- `Bond` (`bondType`, `suretyName`, `bondNumber`, `bondAmount`, `activityCode`, `expirationDate`, `status`, `lastVerifiedAt`), `BondVerification` (`method`, `result`).
- `ImporterOfRecord` (`irsEin`, `cbpImporterNumber`, `registrationStatus`), `PartyScreeningSummary` / `PartyScreeningApproval`.
- Portal onboarding wizard already built: `apps/portal/src/app/(portal)/onboarding/[token]/page.tsx` + routes under `api/portal/onboarding/[token]/` (entity, officers, poa, documents, complete). It resolves an `Invitation` (`purpose: "CUSTOMER_PORTAL"`).
- Broker-side invite: `apps/custom/src/app/api/broker/portal-invitations/route.ts`; `Invitation` model (`clientId`, `productScopes`, `roleId`, `status`); `UserClientAssignment`; portal roles `CUSTOMER_ADMIN` / `CUSTOMER_USER` / `CUSTOMER_VIEWER` / `CUSTOMER_CUSTOMS_USER` / `CUSTOMER_TMS_USER`.

### 14.2 The gap

- The portal onboarding wizard is **token-scoped and one-shot** — after `complete`, there's no logged-in "here's my setup" surface. `OnboardingCase.status` / `blockers` are invisible to the customer.
- The **executed** POA / 5106 PDF is stored (`executedDocumentUrl`, `pdfDocumentUrl`) but never promoted to a portal-visible `ShipmentDocument`-equivalent — there is no account-level document shelf, only shipment-scoped docs.
- There's no model of **who the stakeholders are** and **which of them have a login** — `officers` is loose Json, contacts are scalar fields on `Client`.
- e-sign completion (`PoaEnvelope` webhook → `status: "completed"`) doesn't notify the customer or surface the signed doc.

### 14.3 New models

```prisma
/// A named person in the client's trade-compliance setup. One row per human,
/// across onboarding officers, billing/customs contacts, and portal users.
/// Distinct from `User` (an auth identity) and `PartyContact` (a party's contact
/// point) — a stakeholder MAY be linked to a User once they accept an invite.
model ClientStakeholder {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  clientId  String
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)

  name        String
  email       String
  title       String?
  role        String   // IMPORTER_ADMIN | OFFICER_SIGNER | BILLING_CONTACT | CUSTOMS_CONTACT | SUPPLIER_CONTACT | VIEWER
  isSigner    Boolean  @default(false)   // authorised to execute POA / 5106

  userId      String?                    // set once they accept a portal invite
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  invitationId String?
  loginStatus String   @default("NOT_INVITED") // NOT_INVITED | INVITED | ACTIVE | DISABLED

  onboardingEntityId String?
  sourceEvent        String?  // ONBOARDING_OFFICER | PORTAL_INVITE | CLIENT_CONTACT | MANUAL
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clientId, email])
  @@index([accountId])
  @@index([clientId, role])
}

/// Account/client-level document shelf — the executed POA, the 5106 PDF, the
/// bond rider, W-9, etc. Shipment docs stay in ShipmentDocument; this is the
/// "your paperwork with this broker" shelf the portal Setup page reads.
model ClientDocument {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  clientId  String
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)

  kind        String   // EXECUTED_POA | FORM_5106 | BOND | BOND_RIDER | W9 | IMPORTER_AGREEMENT | SCREENING_CERTIFICATE | OTHER
  title       String
  storageUrl  String
  contentType String   @default("application/pdf")
  status      String   @default("ACTIVE") // ACTIVE | SUPERSEDED | REVOKED
  effectiveDate DateTime?
  expirationDate DateTime?
  portalVisible Boolean @default(true)

  sourceModel String?  // "PowerOfAttorney" | "FiveOhSixRecord" | "Bond" | "PoaEnvelope"
  sourceId    String?
  supersededById String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([accountId])
  @@index([clientId, kind, status])
}
```

Add back-relations on `Account`, `Client`, `User`.

### 14.4 Promotion hooks (broker side, apps/custom)

Wherever these transitions already happen, add a call to a small `clientSetup.ts` service:

| Trigger (existing code path) | Action |
|---|---|
| `PoaEnvelope.status` → `completed` / `signed` (OpenSign webhook handler — see recent commits `fix(esign)…`) | `PowerOfAttorney.status = "executed"`; upsert `ClientDocument` `kind: "EXECUTED_POA"` from `executedDocumentUrl`; upsert `ClientStakeholder` for the signer with `isSigner: true`; write `OnboardingEvent`; fire notification "Your Power of Attorney is signed and on file." |
| `FiveOhSixRecord.status` → `accepted` (with `cbpAssignedNumber`) | set `ImporterOfRecord.cbpImporterNumber` + `registrationStatus = "registered"`; upsert `ClientDocument` `kind: "FORM_5106"` from `pdfDocumentUrl`; `OnboardingEvent`; notification. |
| `Bond.status` → `verified` / `attested` | upsert `ClientDocument` `kind: "BOND"`; `OnboardingEvent`. |
| `OnboardingCase.status` → `activated` | mark all steps done; notification "Your account is active — you're ready to import." |
| Broker sends a portal invite (`portal-invitations` route) | upsert `ClientStakeholder` (`loginStatus: "INVITED"`, `invitationId`); on invite `ACCEPTED`, set `loginStatus: "ACTIVE"`, `userId`. |
| Onboarding wizard `officers` step saved | upsert one `ClientStakeholder` per officer (`role: "OFFICER_SIGNER"`, `sourceEvent: "ONBOARDING_OFFICER"`). |

Backfill script converts existing `OnboardingEntity.officers` Json + `Client.contact*` fields + accepted portal `Invitation`s into `ClientStakeholder` rows.

### 14.5 Portal API for §14

| Method + path | Auth | Behaviour |
|---|---|---|
| `GET /api/setup` | authenticated portal user, client-scoped; perm `portal.setup.read` (**new**) | Returns the `SetupSummary` (below) for the caller's client. |
| `GET /api/setup/documents` | perm `portal.setup.read` | List `ClientDocument` where `clientId` in scope and `portalVisible` — `[{ id, kind, title, status, effectiveDate, expirationDate, href }]`. |
| `GET /api/setup/documents/[id]/download` | perm `portal.setup.read` | Streams the stored bytes via `@qubere/storage` (same pattern as `entries/[id]/download`). Audit-logged. |
| `POST /api/setup/stakeholders/invite-request` | perm `portal.users.manage` (customer admin) | Body `{ name, email, role }`. Does **not** create a `User` — creates a `CustomerRequest` (`type: "CONFIRMATION"`, `domain: "GENERAL"`, title "Portal access request: <email>") so the broker approves & sends the real invite. Keeps invite issuance broker-controlled. |

```ts
interface SetupSummary {
  clientName: string;
  brokerName: string;
  onboarding: {
    status: string;                 // draft | in_progress | activated | ...
    path: string;
    activatedAt: string | null;
    steps: Array<{ key: string; label: string; state: "DONE" | "IN_PROGRESS" | "BLOCKED" | "TODO" }>;
    blockers: string[];             // customer-safe restatement
  };
  importer: {
    legalName: string;
    ein: string | null;             // masked: "**-***1234"
    cbpImporterNumber: string | null;
    registrationStatus: string;
  } | null;
  bond: { type: string; surety: string; number: string; amountUsd: string; activityCode: string | null; expirationDate: string | null; status: string } | null;
  poa: { status: string; executionMethod: string | null; signerName: string | null; signedDate: string | null; expirationDate: string | null; documentId: string | null } | null;
  screening: { status: "PASSED" | "FLAGGED" | "PENDING" | "OVERRIDDEN"; lastRunAt: string | null };   // no hit details — just the disposition
  documents: Array<{ id: string; kind: string; title: string; status: string; href: string }>;
  stakeholders: Array<{ name: string; role: string; title: string | null; isSigner: boolean; loginStatus: string }>;
  brokerTeam: Array<{ name: string; role: string; email: string }>;   // assigned users/teams for this client (from UserClientAssignment / TeamClientAssignment on the broker side)
}
```

**New permissions:**
```ts
{ name: "portal.setup.read", description: "View account setup: onboarding status, POA, bond, importer numbers, documents.",
  category: "Customer", defaultRoles: ["CUSTOMER_ADMIN","CUSTOMER_USER","CUSTOMER_VIEWER","CUSTOMER_CUSTOMS_USER","BROKER_ADMIN","OWNER"] },
```
`portal.users.manage` already exists — reuse for `invite-request`.

### 14.6 Portal UI for §14

| File | What |
|---|---|
| `src/app/(portal)/setup/page.tsx` (**new**) | "Your setup" — sections: **Onboarding status** (step checklist + blockers), **Importer of record** (legal name, masked EIN, CBP number, registration badge), **Customs bond** (surety, number, amount, expiry badge — amber if < 90 days), **Power of Attorney** (status, signer, signed date, "View signed POA" → download), **Screening** (disposition badge only), **Documents on file** (`ClientDocument` list with download), **People** (`stakeholders` with role + login-status chip; "Request access for someone" → `invite-request`), **Your broker team** (assigned contacts). |
| `src/app/(portal)/*nav*` (**edit**) | Add "Setup" nav item (gear icon). |
| `src/app/(portal)/onboarding/[token]/page.tsx` (**edit**) | On `complete`, if the user is (or becomes) a logged-in portal user, redirect to `/setup` instead of a dead-end "done" screen. Keep token flow working for not-yet-registered signers. |
| `src/app/(portal)/page.tsx` (**edit**) | If `onboarding.status !== "activated"`, show a dashboard banner "Finish setting up your account — 2 steps left" linking to `/setup`. |
| Broker side `apps/custom` | On `app/clients/[id]`, add a "Portal & setup" panel: stakeholder list with invite buttons, `ClientDocument` shelf, onboarding status — so the broker manages what the customer sees. Wire the promotion hooks in `clientSetup.ts`. |

### 14.7 Seed for §14

Extend `seed-customer-portal.ts` (Target + Amazon already have clients + `OnboardingCase` + entities):

- **Target = fully activated:** `OnboardingCase.status = "activated"`, `activatedAt` set, all `stepStatus` done, no blockers. `ImporterOfRecord` with `cbpImporterNumber` + `registrationStatus: "registered"`. `Bond` continuous $100k, `status: "verified"`, expiry +10 months. `PowerOfAttorney` `status: "executed"`, `executionMethod: "E_SIGN"`, `PoaEnvelope` `status: "completed"` + `executedDocumentUrl` (stub PDF via `storeDocumentBytes`), `signerName: "Dana Whitfield"`. `FiveOhSixRecord` `status: "accepted"`, `cbpAssignedNumber`. `ClientDocument` rows: `EXECUTED_POA`, `FORM_5106`, `BOND`. `ClientStakeholder` ×4: Dana Whitfield (IMPORTER_ADMIN, signer, ACTIVE — `porter@target.com`), a CFO (BILLING_CONTACT, INVITED), a trade-compliance manager (CUSTOMS_CONTACT, ACTIVE), an ops analyst (VIEWER, NOT_INVITED). `PartyScreeningSummary` PASSED.
- **Amazon = mid-onboarding:** `OnboardingCase.status = "in_progress"`, `currentStep: 3`, `blockers: ["POA awaiting signature"]`. `PowerOfAttorney` `status: "out_for_signature"`, `PoaEnvelope` `status: "sent"`, `sentAt` -2d. `Bond` `status: "unverified"`. `FiveOhSixRecord` `status: "generated"`. `ImporterOfRecord.cbpImporterNumber = null`, `registrationStatus: "pending_5106"`. `ClientDocument`: none yet (or just a draft agreement). `ClientStakeholder` ×3: an admin (ACTIVE), a signer officer (INVITED, `isSigner: true`), a billing contact (NOT_INVITED). `PartyScreeningSummary` PENDING.
- `brokerTeam`: assign 1–2 demo broker users to each client via `UserClientAssignment` so `/setup` "Your broker team" is populated.
- Add an `apps/custom/scripts/seed-client-setup-demo.ts` (or fold into `seed-entry-proof-demo.ts`) that runs the promotion hooks so seed == runtime.

### 14.8 Notifications (uses #151 engine if present, else a simple email helper)

Customer-facing events → email + a portal notification row (there's a `BellIcon` and a notification hub from the IA redesign — reuse):
`POA_SIGNED`, `FORM_5106_ACCEPTED`, `ACCOUNT_ACTIVATED`, `ENTRY_PROOF_PUBLISHED`, `ETA_CHANGED` (only on a material slip, e.g. > 24h), `CUSTOMS_RELEASED`, `HOLD_PLACED`, `DOCUMENT_REQUESTED`, `INVOICE_ISSUED`. All respect a per-stakeholder notification preference (add `ClientStakeholder.notifyPrefs Json?` — default all on).

---

## 15. Revised build order (supersedes §11 — same tasks, three tracks)

**Track A — Entry Proof (§2–§12):** tasks 1–8 as listed in §11.

**Track B — Self-serve answers (§13):** B1 `packages/entry-proof/src/shipmentAnswers.ts` + tests · B2 `ShipmentCharge.portalVisible` + `ComplianceDeadline.customerActionable/customerLabel` migration · B3 `GET /api/shipments/[id]/answers` + redaction tests · B4 portal "At a glance" view + cards · B5 seed (ETA/tracking/invoices/holds).

**Track C — Your setup (§14):** C1 `ClientStakeholder` + `ClientDocument` models + migration + backfill · C2 `clientSetup.ts` promotion service + wire into POA/5106/bond/onboarding transitions · C3 portal `GET /api/setup` (+ `/documents`, `/documents/[id]/download`, `/stakeholders/invite-request`) + `portal.setup.read` perm · C4 portal `/setup` page + nav + onboarding redirect + dashboard banner · C5 broker `app/clients/[id]` "Portal & setup" panel · C6 seed (Target activated / Amazon mid-onboarding).

**Shared:** one migration PR (`EntryProof`, `EntryProofEvent`, `ClientStakeholder`, `ClientDocument`, the 3 column adds). One seed entrypoint `apps/custom/scripts/seed-partner-portal-demo.ts` that calls the portal seed then the entry-proof + client-setup steps, so `npm run db:seed && npx tsx apps/custom/scripts/seed-partner-portal-demo.ts` produces the full demo on localhost and (with `DATABASE_URL=$DEMO`) on demo.

## 16. Deck additions for §13 + §14 (append to §12's list)

7. **New slide — "Answers, not phone calls":** headline "Your client stops calling to ask 'any update?'". `app-frame` mock of the "At a glance" panel — ETA card ("Arrives ~Nov 14 · moved 2 days, carrier schedule"), Cost card ("$12,940 duty & fees + $1,240 brokerage"), "Needs from you: nothing right now". demo-tip: "Portal (Target): open SHP-TGT-2026-001 → At a glance. Every question a shipper emails, answered on one screen, with the data behind each answer."

8. **New slide — "Every stakeholder, one login, one setup view":** headline "Your importer's whole setup with you — visible and self-service." bullets: "Officers, billing, customs contacts — each with scoped access" · "Signed POA and 5106 appear the moment e-sign completes" · "Bond, CBP number, screening status — all on the Setup page". `app-frame` mock of `/setup` (Target, activated: green POA, bond expiring in 10 months, 4 people). demo-tip: "Portal (Amazon): /setup shows 'POA awaiting signature — 2 steps left'. Sign in OpenSign → refresh → POA flips to signed and the executed PDF is on file."

9. Update slide 1 honesty note: "Auth, client scoping, storage, entry-proof, self-serve answers, and onboarding→setup sync are live. Generated 7501/invoice PDF *downloads* are still stubs (executed POA/5106 downloads are real)."

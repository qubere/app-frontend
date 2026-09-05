# CATAIR Gap Closure — Wiring Plan (issue #209 re-scoped)

**For: Antigravity** (autonomous implementation agent)
**Source issue:** https://github.com/qubere/app-frontend/issues/209 — "CATAIR gap closure — Prisma schema work"
**Author of this plan:** Claude, 2026-09-04 (updated), verified against the live tree on `feat/entry-summary-7501-abi-export` (base `main`)

## Related issues — how this fits the rest of the CATAIR/ABI backlog

- **#209** (this doc's source) — re-scoped by this plan from "add schema" to "wire existing schema into existing codecs." Comment posted linking here.
- **#225** — CATAIR field→DB coverage tracking stub. Its "PARTIAL" status (2026-09-01) is now stale for schema coverage: every model/field it and #209 asked for is built (see §0 table below). Coverage doc (`docs/apps/customs/feature/abi/CATAIR-FIELD-DB-COVERAGE.md`) should be re-run to flip Phase 1 rows from PARTIAL/MISSING to COVERED, but note COVERED-in-schema ≠ wired — this plan's §2 backlog is what's still open.
- **#210** — "ABI codec completion queue." Different axis of work: #210 is about extracting *more CATAIR record types* from source PDFs via Antigravity test-writing (evidentiary bar: real extracted table text, tests-only, human implements after). This plan is about *wiring already-built codecs to already-built DB models* — mechanical mapping, not PDF extraction, so it doesn't need #210's fabrication-guard workflow (no new record layouts are being invented here). The two are independent and can proceed in parallel; #210's Drawback/eBond/Statement slices (if any land) will extend the same `types.ts` files this plan's §2.1–2.3 wire into, so sequence-check before starting either if both are in flight at once.
- **#219** / PR [#347](https://github.com/qubere/app-frontend/pull/347) — "Validated 7501 draft + ABI filer export payload." All 15 units (U1–U15) shipped on this branch across 4 commits (`8c6a6474`, `f1543b83`, `c9b2806e`, `df10e9bc`), open as PR #347. This is the Entry Summary (7501) chapter specifically — separate from and unblocked by this plan.
- **#160** — parent tracking issue for Brokerage OS ABI/ACE filing; rollup comment posted.

## 0. Read this first — the issue's premise is stale

Issue #209 asks for ~14 new Prisma models and ~60 new scalar fields across `CustomsFiling`, `DrawbackClaim`, `DrawbackLot`, `InvoiceLine`, `ShipmentParty`, and `PgaRequirement`, to close CATAIR chapter gaps.

**All of it already exists in `packages/db/prisma/schema.prisma`, applied via migration `20260821220124_catair_gap_closure`.** I grepped every model and field the issue names — every single one is present, with the same names, same relations, same design choices (e.g. `PgaRequirement.agencyData Json?` as the one deliberate JSON catch-all, exactly as the issue specified). Verified:

| Model (issue §) | Exists? | App-code usage (non-schema, non-migration) |
|---|---|---|
| `CensusWarningOverride` (§1) | ✅ | 5 files |
| `FilingFeeLine` (§1) | ✅ | **0 files** |
| `FtzDetail` (§1) | ✅ | 6 files |
| `AdcvdLineDetail` (§1) | ✅ | 1 file |
| `InvoiceLine.lineRange*/supplierIdCode` (§1) | ✅ | — (scalar ext.) |
| `ShipmentParty.partyTypeCode` (§1) | ✅ | — (scalar ext.) |
| `CustomsFiling` header fields (§1) | ✅ all 17 fields | wired (7501 assembler) |
| `DrawbackClaim` booleans (§2) | ✅ all 12 fields | **0 files** |
| `DrawbackLot` fields (§2) | ✅ all 9 fields | **0 files** |
| `DrawbackImportLink` (§2) | ✅ | **0 files** |
| `DrawbackExportDestroy` (§2) | ✅ | **0 files** |
| `DrawbackTfteaLine` (§2) | ✅ | **0 files** |
| `DrawbackNaftaUsmcaLine` (§2) | ✅ | **0 files** |
| `PgaRequirement` scalars + `agencyData` (§3) | ✅ | partial |
| `CargoReleaseBillOfLading` (§4) | ✅ | **0 files** (BOL data is instead derived live from `Shipment`/leg tracking) |
| `BondParty` (§4) | ✅ | **0 files** |
| `InBondRecord` / `InBondEvent` (§4) | ✅ | 4 / 3 files |
| `ManifestRecord` (§4) | ✅ | **0 files** |
| `StatementRecord` / `StatementFeeLine` (§5) | ✅ | **0 files** |
| Entry Summary / Cargo Manifest query params (§5) | N/A by design (transient, not persisted) | handled in `entrySummaryQuery`/`cargoManifestQuery` modules |
| `CustomsFiling.entryType` deprecation (§6) | **Resolved differently** — `entryType` is kept as a documented legacy field alongside `country`/`procedureCode`/`messageName`; `authority` (not `entryType`) carries the `@deprecated` tag; `transactionTypeId` was never introduced and isn't referenced anywhere. No action needed — the issue's §6 concern no longer applies to the current design. | — |

**Conclusion: the literal ask in #209's title is done.** The real gap is one layer up: seven of the ABI transaction-builder modules under `apps/custom/src/lib/abi/*` have `build.ts` / `parse.ts` / `validate.ts` / `types.ts` (wire-format layer) but **no `fromCustomsFiling.ts` (DB → wire-format assembler)** that reads the new models. Data has nowhere to flow from today. This plan re-scopes #209 into that wiring work.

## 1. The reference pattern to replicate

Two modules already do this correctly — study them before touching anything else:

- [`apps/custom/src/lib/abi/entrySummary/fromCustomsFiling.ts`](../../../apps/custom/src/lib/abi/entrySummary/fromCustomsFiling.ts) (800 lines) + [`assembleTransaction.ts`](../../../apps/custom/src/lib/abi/entrySummary/assembleTransaction.ts) (371 lines) — reads `CustomsFiling` plus its relations (`CensusWarningOverride[]`, `FilingFeeLine[]`, `FtzDetail[]`, `AdcvdLineDetail[]` via line items, `InvoiceLine`) and produces `EntrySummaryTransactionInput`, which `build.ts` then encodes to fixed-width CATAIR records. Throws `AbiFilingValidationError` with a `missingFields` list when required data is absent — follow this error shape everywhere.
- [`apps/custom/src/lib/abi/cargoRelease/fromCustomsFiling.ts`](../../../apps/custom/src/lib/abi/cargoRelease/fromCustomsFiling.ts) (475 lines) — same idea, one chapter over, currently derives bill-of-lading data live from `Shipment`/leg tracking rather than from `CargoReleaseBillOfLading` (see §2.5 below for the decision needed there).

Every wiring task below is: **write a `fromCustomsFiling.ts` (or claim-equivalent `fromDrawbackClaim.ts` / `fromBond.ts` / etc.) that maps the existing Prisma model(s) onto the existing `*Input` types in that module's `types.ts`**, plus the Prisma `include` needed to load the relations, plus unit tests. No new schema, no new wire-format types — those are already both done.

## 2. Wiring backlog, by module

### 2.1 Drawback (`apps/custom/src/lib/abi/drawback/`) — largest gap, do first

`types.ts` already defines `LinkImportMfgInput`, `ExportDestroyInput`, `NaftaUsmcaInput`, `TfteaExportDestroyInput` (matching records 52, 60-64, 70-72 in `recordSpecs.ts`/`build.ts`). None of `DrawbackClaim`'s 12 new booleans, `DrawbackLot`'s 9 new fields, or the 4 new one-to-many models (`DrawbackImportLink`, `DrawbackExportDestroy`, `DrawbackTfteaLine`, `DrawbackNaftaUsmcaLine`) are read anywhere.

- [ ] Add `fromDrawbackClaim.ts`: load `DrawbackClaim` with `include: { lots: true, importLinks: true, exportDestroys: true, tfteaLines: true, naftaUsmcaLines: true }` (confirm exact relation names in schema.prisma around line 2627/6572/9818-9891).
- [ ] Map `DrawbackImportLink[]` (ordered by `sequence`, max 15) → `LinkImportMfgInput[]`.
- [ ] Map `DrawbackExportDestroy[]` → `ExportDestroyInput[]` (this single model covers what the issue called `ExportDestroyInput` + `NoticeOfIntentInput` + `ExamWitnessInput` — confirm `build.ts` record specs 60/62/63 all pull from the same flat object before assuming one input shape covers all three).
- [ ] Map `DrawbackTfteaLine[]` → `TfteaExportDestroyInput[]`.
- [ ] Map `DrawbackNaftaUsmcaLine[]` → `NaftaUsmcaInput[]`.
- [ ] Map the 12 new `DrawbackClaim` booleans + `DrawbackLot`'s 9 fields into the existing header/lot input types (check whether `types.ts` already has slots for these — if not, that's a genuine type-layer gap, not just a mapping gap; fix `types.ts` + `recordSpecs.ts`/`build.ts` together).
- [ ] Bond identity: per issue §2, do **not** duplicate bond data on `DrawbackClaim` — resolve `BondInfoInput` (`singleTransactionBondAmount`/`Number`) through the existing `Bond` model, consistent with §2.4 below.
- [ ] Unit tests mirroring `entrySummary`'s test style (find via `find apps/custom/src/lib/abi/entrySummary -iname "*.test.ts"`).

### 2.2 eBond (`apps/custom/src/lib/abi/ebond/`)

`types.ts` has `PrincipalInput`, `CoPrincipalInput`, `SuretyInput`, `CoSuretyInput`, `ReinsurerInput` — five near-duplicate shapes, exactly what `BondParty.role` was designed to collapse into one model. `BondParty` has zero app-code references.

- [ ] Add `fromBond.ts`: load `Bond` with `include: { parties: true }`, group `BondParty[]` by `role`, map each group to the corresponding `*Input` type (`PRINCIPAL`→`PrincipalInput`, etc.).
- [ ] Since `role` is a bare `String` (not a Prisma enum) on `BondParty`, add a runtime guard/assertion against the 5 valid role strings when reading — don't trust the DB value blindly when building a wire-format record.
- [ ] Unit tests for each role mapping, plus a co-principal/co-surety multi-row case.

### 2.3 Statement (`apps/custom/src/lib/abi/statement/`)

`StatementRecord`/`StatementFeeLine` exist, zero usage. This chapter has no `fromCustomsFiling.ts`-equivalent at all yet (it's periodic/account-level, not filing-level, so the assembler's natural input is a `StatementRecord`, not a `CustomsFiling`).

- [ ] Add `fromStatementRecord.ts`: load `StatementRecord` with `include: { statementFeeLines: true }`, map to whatever the existing `build.ts` currently expects as input (check if `build.ts` takes a raw input type already, or was only ever exercised with hand-built fixtures in tests — if the latter, this is the first real caller and should be treated carefully).
- [ ] Confirm `entryType` field on `StatementRecord` doesn't collide semantically with `CustomsFiling.entryType` — they're separate models, just check the CATAIR field mapping expects the same code domain.
- [ ] Unit tests.

### 2.4 Cargo Release BOL (`apps/custom/src/lib/abi/cargoRelease/fromCustomsFiling.ts`) — decision needed, not just wiring

This one's different: `fromCustomsFiling.ts` already builds `BillOfLadingGroupInput[]`, but by deriving BOL number/issuer/quantity live from `Shipment` and leg tracking data (`bolTracking`, `primaryLeg`), not from the persisted `CargoReleaseBillOfLading` model, which has zero references anywhere.

Before writing code, resolve which of these is true, and document the answer in a comment at the top of the mapping function:
- (a) `CargoReleaseBillOfLading` is genuinely redundant with shipment-derived data and should be **removed** in a follow-up migration, or
- (b) it's the correct persistence layer for cases the shipment model can't represent (e.g. split shipments, multiple BOLs per filing, CBP-assigned `nonAmsIndicator`) and the current shipment-derived path is the actual gap.

Given the issue explicitly created this model for §4's "Cargo Release" gap closure, (b) is more likely correct — but verify by checking whether `nonAmsIndicator` and multi-BOL cases are even representable in the current `Shipment`/leg model before committing either way. This is a design call worth a quick human check-in if it's not obvious from the code, per the "don't repeat the citation-hallucination error" ground rule in the original issue (§0) — don't guess.

### 2.5 ACE Broker Download (`apps/custom/src/lib/abi/brokerDownload/`) — confirm priority first

The original issue flagged this chapter explicitly as "lower priority... unless a live customer need is driving it now — confirm before building." `ManifestRecord` exists with zero usage; `brokerDownload/` has `build.ts`/`parse.ts`/`validate.ts` but this is inbound (CBP→filer) data, so the natural direction is `parse.ts` producing a `ManifestRecord` write, not a `fromCustomsFiling.ts` read.

- [ ] Before implementing: confirm with the user/PM whether there's a live customer need (per the issue's own caveat). If not, skip this chapter in this pass.
- [ ] If confirmed: add a `toManifestRecord.ts` (inbound direction — parse result → DB write) rather than a `from*` assembler, since this chapter is read-only ingestion.

### 2.6 Entry Summary Query / Cargo Manifest Query (chapters 3 & 10)

The issue correctly says these are transient query params, not schema fields (§5) — confirm `entrySummaryQuery/` and `cargoManifestQuery/` modules' `assembleQuery.ts`/`build.ts` actually accept and round-trip the multi-slot criteria (`EntryNumberQueryRequestInput` slots 1-5, `CriteriaQueryRequestInput` flags) end-to-end through their HTTP API callers, not just at the type level.

- [ ] Grep callers of `entrySummaryQuery/assembleQuery.ts` and `cargoManifestQuery` under `apps/custom/src/app/api/` — confirm a real route exercises multi-slot query params, not just unit tests with hand-built fixtures.
- [ ] If no live caller exists, this is a UI/API gap, not a schema gap — file as a separate, smaller follow-up rather than bundling into this wiring pass.

## 3. Suggested execution order

1. **§2.1 Drawback** — highest field volume (104 missing / 25 partial in the original count), fully unwired, clear reference pattern to copy.
2. **§2.2 eBond** — small, self-contained, good second task to validate the `Bond`→`BondParty` grouping pattern before drawback's more complex relations.
3. **§2.3 Statement** — no existing caller, so slightly more design work to confirm `build.ts`'s expected input shape first.
4. **§2.4 Cargo Release BOL** — needs the (a)/(b) decision above before writing code; don't start blind.
5. **§2.6 Query chapters** — verification-only, likely fast; do it whenever, doesn't block the others.
6. **§2.5 Broker Download** — gated on a priority confirmation; last, and possibly skipped entirely.

## 4. Verification protocol (carried over from the original issue's §0 ground rule)

Before marking any task done, re-run this exact check and require a literal match — the original CATAIR audit was burned twice by citing fields that don't exist:

```bash
# For any field/model you're about to claim is "wired": confirm the model is both
# in schema.prisma AND referenced somewhere outside prisma/ and *.test.ts.
grep -n "model <ModelName>" packages/db/prisma/schema.prisma
grep -rl "<ModelName>" apps/custom/src --include="*.ts" --include="*.tsx" | grep -v ".test.ts"
```

After each module in §2 is wired, add its model(s) to the "usage" column of the table in §0 of this doc (or delete this doc and fold the note into the module's own README) so the next audit doesn't re-discover the same gap from scratch.

## 5. What NOT to do

- Do not add any new Prisma models or migrations for this issue — the schema is complete. If you find a genuinely missing field while wiring (e.g. §2.1's booleans not having a `types.ts` slot), fix that narrowly, don't re-run a full gap analysis.
- Do not touch `CustomsFiling.entryType`/`authority`/`transactionTypeId` — §0's table above shows this was already resolved differently than the original issue assumed. Leave it alone.
- Do not build §2.5 (Broker Download) without an explicit priority confirmation — the original issue asked for this and it appears never to have been answered.

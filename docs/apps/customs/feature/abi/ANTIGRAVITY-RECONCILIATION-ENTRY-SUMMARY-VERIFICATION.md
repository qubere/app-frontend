# Antigravity task: verify (and likely expand) Reconciliation Entry Summary test-prep before implementation

`apps/custom/tests/abi-reconciliation-entry-summary.test.ts` already exists, covering 4
records (RE10, RE20, RX10, RX20). **Nothing in `src/lib/abi/` implements this chapter yet**
— no `src/lib/abi/reconciliation*` directory exists. This is the right moment to verify
before anyone builds against it, the same way the In-Bond QP40 problem was caught before
implementation rather than after.

Treat this test file the way every other CATAIR chapter in this codebase has been treated
before trusting it: **independently re-derive it from the real PDF, don't just review the
existing spec for plausibility.** Several chapters in this project (Drawback, PGA, In-Bond)
had plausible-looking, page-cited, internally-consistent specs that turned out to have
invented fields once someone actually opened the PDF and checked row by row. Assume this one
needs the same treatment until proven otherwise.

**Source PDF**: `docs/apps/customs/feature/abi/catair-source-docs/16-reconciliation-entry-summary-v3.pdf`
(the current test file cites "ACE CATAIR Reconciliation v3, Page N" generically — confirm
those page numbers against this specific file; don't assume they already match).

## Specific things to check, not just accept

1. **4-character Control Identifier.** The current spec has each record's Control
   Identifier as a 4-character field holding the full record name (`"RE10"`, `"RE20"`,
   `"RX10"`, `"RX20"`, positions 1-4). Every other chapter already implemented in this
   codebase (`entrySummary`, `statement`, `ebond`, `inBond`, `drawback`, `pgaMessageSet`,
   `cargoRelease`, `brokerDownload`) uses a **2-character** control identifier holding just
   a record-type code (e.g. `"10"`, `"40"`, `"Q1"`, `"QA"`), with the record's more specific
   identity (if any) carried in a separate field. A 4-char embedded-name control ID would be
   a real structural difference for this chapter — confirm it directly against the PDF's
   own field table rather than assuming either convention.
2. **Thin record count.** 4 records for an entire chapter is small relative to every other
   chapter here (13-35 records). Reconciliation Entry Summary in the real CATAIR spec
   generally needs to carry: the header, one or more *per-issue-type* detail structures
   (value, 9802, FTA/preference, classification — the current `RE20` crams all four issue
   types into one generic record via a 2-char "Reconciliation Issue Code," which may or may
   not be how the real PDF models it), any aggregate/summary/totals record, and enough
   response/diagnostic output structure to cover accept/reject conditions beyond a single
   `RX20`. Check the PDF's own "Record Layout"/"Application Overview" table (the same kind
   of table every other chapter's test-prep has cited) for the full record list before
   assuming 4 is complete — if it's not, that's the main gap to close here, not just field
   corrections to the existing 4.
3. **No business-rule coverage.** Every well-verified chapter here also has a
   `*-business-rules.test.ts` file (date-range rules, cross-field conditionals, valid-code
   enumerations) alongside the specs file — this chapter has none. If the PDF documents any
   (e.g. valid Reconciliation Issue Code values beyond 01-04, valid Reconciliation Status/
   Disposition Code enumerations, any date or amount business rule), add that coverage too.
4. **Field-by-field re-derivation**, same as always: every name/position/length/class/
   designation must trace to a literal row in the PDF, with the page number you actually
   read it on — not inferred from the record's apparent purpose.

## Deliverable

Either:
- **Confirm** the existing 4 records are correct and complete for this chapter, with your
  own independent page citations proving it (not just re-stating the file's existing
  citations), and add any missing business-rule coverage — or
- **Correct and expand** `abi-reconciliation-entry-summary.test.ts` with the real record
  set, real field layouts, and page citations for everything you touch.

Either way, report explicitly: which records you verified clean, which you corrected (with
before/after), and which additional records (if any) you found in the PDF that the current
file is missing entirely.

## Evidentiary bar (same as every other CATAIR chapter here)

1. Every field traces to a literal row in the source PDF's field table — no inferring from
   a narrative description or a sibling chapter's shape.
2. State the real page number per record, from `16-reconciliation-entry-summary-v3.pdf`
   specifically.
3. If a business rule, valid-code list, or date/amount convention is documented in the PDF,
   capture it — don't leave chapter-specific rules unmodeled just because the position-math
   test alone passes.
4. Tests-only in this pass — no `src/lib/abi/reconciliation*` implementation. That happens
   afterward, against these tests, with an independent spot-check of a few records before
   anything is wired in (same process used for every prior chapter).

## Why this one, now

This chapter directly unblocks a tracked product gap — Post-Entry Reconciliation — and the
codec already has a live seam waiting for it: Statement Processing's `Q2`/`Q4`/`Q6` records
carry an "Interest Amount for Reconciliation Summary" field
(`apps/custom/src/lib/abi/statement/recordSpecs.ts`) that's modeled but has nothing on the
Reconciliation side to connect to yet.

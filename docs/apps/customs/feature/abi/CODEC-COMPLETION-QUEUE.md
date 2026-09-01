# Codec Completion Queue — filling in every deferred record

Every chapter built so far covers a subset (mandatory backbone / core round-trip).
This is the queue to close the remaining gap in each one, chapter by chapter. Same
workflow as everything before: paste each prompt into Antigravity, post the result
back in chat, I verify and (if clean) implement or queue implementation.

**Not included here — already in motion:** In-Bond's expanded 35-record scope. A
corrective prompt was already sent back to Antigravity after QP40 came back
fabricated; still waiting on that re-submission before touching it further. When it
lands, post it and I'll pick up where that left off.

**Not included here — deliberately gated:** Appendix F (Duty Calculation) — stays
un-queued pending Client-Rep verification of the 2011 document.

Rough priority, if useful: Entry Summary Create/Update's remainder is the single
biggest gap and the highest-value one (core existing product capability) — do that
first if going in order matters to you. Otherwise these are independent; any order
works.

---

## Entry Summary Create/Update (AE/AX) — 24+ record types remaining

This is the largest single gap. Broken into three sub-prompts rather than one pass —
one oversized prompt is exactly what caused quality problems earlier in this project
(PGA Message Set, Drawback both needed correction after being asked to cover too much
at once).

### E1 — AD/CVD, FTZ, and Bond records

```
Next slice of the Entry Summary Create/Update chapter (already partially built:
src/lib/abi/entrySummary/ covers input records 10/11/40/50/89/90 and output E0/E1).

Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf

Scope for this pass: the AD/CVD case record, the bond record, and the FTZ status
record — read the chapter's own record index/table of contents to find their exact
record identifiers and page numbers (don't guess numbers from other chapters; this
chapter's own numbering is authoritative). Write tests ONLY —
tests/abi-entry-summary-adcvd-bond-ftz.test.ts. Do NOT write anything in src/.

Non-negotiable evidentiary bar (same as every prior chapter): every record's
field/position table must be backed by real extracted text or table data from the
PDF, shown directly in your report. Self-consistency (positions sum to 80, no
overlaps) is not sufficient evidence on its own — this bar exists because a fully
self-consistent but fabricated record already slipped through twice in this project
(Cargo Release's first pass, and In-Bond's expanded-scope pass on record QP40). Show
real extracted table text for every record you cover. Cross-check each record's
field-length sum against its stated length yourself, in your first draft, not a
follow-up round. Flag any field whose implied-decimal convention isn't explicitly
stated, any date field's exact format/class, and any position-label-vs-class-width
mismatch (trust the position math, note the discrepancy).

Report back with: records covered with page citations, test count, anything deferred
within this scope and why.
```

### E2 — Description text, license/certificate/permit, and entity/GBI records

```
Next slice of the Entry Summary Create/Update chapter (already partially built:
src/lib/abi/entrySummary/ covers input records 10/11/40/50/89/90 and output E0/E1).

Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf

Scope for this pass: the invoice/rulings/commercial-description records, the
license/certificate/permit record, and the header/line entity + GBI (SE3x/SE5x-style
— check this chapter's own numbering) records. Read the chapter's own record
index/table of contents for exact identifiers and pages. Write tests ONLY —
tests/abi-entry-summary-description-license-entity.test.ts. Do NOT write anything in
src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts, position-label-vs-class-width
mismatches flagged not silently resolved.

Report back with: records covered with page citations, test count, anything deferred
within this scope and why.
```

### E3 — Importer's Additional Declaration, header fees, line user fees, PSC, census override

```
Next slice of the Entry Summary Create/Update chapter (already partially built:
src/lib/abi/entrySummary/ covers input records 10/11/40/50/89/90 and output E0/E1;
other slices cover AD/CVD/bond/FTZ and description/license/entity records).

Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf

Scope for this pass: Importer's Additional Declaration (this has multiple
sub-types — aluminum, steel, CBMA, Section 301, auto parts, and others per the
chapter; cover as many as the chapter defines, and explicitly list any sub-type you
don't get to and why), header fees, line user fees, PSC (post-summary correction)
reasons/explanation records, and census override. Read the chapter's own record
index for exact identifiers/pages. Write tests ONLY —
tests/abi-entry-summary-declarations-fees-psc.test.ts. Do NOT write anything in
src/. Given this sub-scope is itself large (many Importer's Additional Declaration
sub-types), it's fine to prioritize the sub-types most likely to be common
(aluminum, steel, Section 301) and explicitly defer rarer ones rather than force
everything into one pass — list what's deferred clearly.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts, position-label-vs-class-width
mismatches flagged not silently resolved.

Report back with: records/sub-types covered with page citations, what was deferred
within this scope and why, test count.
```

---

## Cargo Release — SE17, SE31/51, SE41/61, PGA grouping, ISF grouping

```
Next slice of the Cargo Release chapter (already built: src/lib/abi/cargoRelease/
covers SE10/11/13/15/16/20/30/35/36/40/50/55/56/60/90).

Source: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf

Scope for this pass: SE17 (Equipment), SE31/SE51 (Entity GBI pilot), SE41/SE61 (FTZ
detail), the PGA grouping, and the ISF grouping. Read the chapter's own record
index for exact page numbers. Write tests ONLY —
tests/abi-cargo-release-equipment-gbi-ftz-pga-isf.test.ts. Do NOT write anything in
src/. If PGA grouping in this chapter turns out to reference the same generic PGA
records already built in src/lib/abi/pgaMessageSet/, note that explicitly rather
than re-deriving them from scratch — but verify the reference is actually the same
record set before assuming so.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts, position-label-vs-class-width
mismatches flagged not silently resolved.

Report back with: records covered with page citations, test count, anything
deferred and why.
```

---

## Statement Processing — SU, RM/PN, Outstanding Action ES Query Response grouping

```
Next slice of the Statement Processing chapter (already built:
src/lib/abi/statement/ covers the full Q1-Q7/QA/QE/QJ record set for Daily and
Periodic Monthly Statement).

Source: docs/plans/catair-source-docs/05-daily-statement.pdf and
docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf

Scope for this pass: SU (statement update/delete), RM/PN (ACH payment
authorization), and the Outstanding Action ES Query Response grouping. Read each
chapter's own record index for exact page numbers — check both source PDFs since
the chapter spans two documents. Write tests ONLY —
tests/abi-statement-update-payment-outstanding.test.ts. Do NOT write anything in
src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts (note: this chapter's existing
records are confirmed 2-implied-decimal for money fields — check whether that holds
for these new records too, don't assume), position-label-vs-class-width mismatches
flagged not silently resolved.

Report back with: records covered with page citations, test count, anything
deferred and why.
```

---

## eBond — interactive eBond Query (QB/QX)

```
Next slice of the eBond chapter (already built: src/lib/abi/ebond/ covers Records
10/12/20/30/35/36/40/45/46/90, the CB input / CX output create-update flow).

Source: docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf (check if the
interactive Query records are in this same document or a separate one — search the
document set and CBP's hub structure if not found here, and report which document
actually has it)

Scope for this pass: the interactive eBond Query request (QB) and response (QX)
records. Read the chapter's own record index for exact identifiers/pages. Write
tests ONLY — tests/abi-ebond-query.test.ts. Do NOT write anything in src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts (this chapter's existing money
fields are whole-dollar/0-decimal, a genuine convention difference from most other
chapters — check whether that holds for Query records too, don't assume), position-
label-vs-class-width mismatches flagged not silently resolved.

Report back with: records covered with page citations, test count, and which source
document actually contained the QB/QX records if it wasn't the one listed above.
```

---

## Entry Summary Query — output JJ-JN, Entry Summary Details Grouping

```
Next slice of the Entry Summary Query chapter (already built:
src/lib/abi/entrySummaryQuery/ covers input J0/J1/J2 and output JA/JB/JC-JI, the
mandatory backbone).

Source: docs/plans/catair-source-docs/03-entry-summary-query-2026-05-v26.pdf

Scope for this pass: the 5 conditional output records JJ-JN (protest/bill/collection
detail — only returned when specifically requested) and the reused Entry Summary
Details Grouping (the 10-90 output records + 4A-Record — note these may overlap
significantly with Entry Summary Create/Update's own input 10/11/40/50/89/90
records already built in src/lib/abi/entrySummary/; if the output-side layout is
genuinely identical to those input records, say so explicitly with evidence rather
than re-deriving from scratch, but verify rather than assume). Write tests ONLY —
tests/abi-entry-summary-query-jj-jn-details.test.ts. Do NOT write anything in src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class and implied-decimal callouts, position-label-vs-class-width
mismatches flagged not silently resolved.

Report back with: records covered with page citations, test count, and whether the
Details Grouping turned out to reuse Entry Summary Create/Update's existing record
layouts (with evidence either way).
```

---

## PGA Message Set — 7 agency-specific variants

```
Next slice of the PGA Message Set chapter (already built:
src/lib/abi/pgaMessageSet/ covers the 28 generic/mandatory cross-agency backbone
records).

Source: docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf

Scope for this pass: the 7 agency-specific record variants previously deferred —
PG05 (FWS — Scientific Genus/Species/Sub-Species Name, Species Code, FWS
Description Code), PG17 (FWS — Common Name, Live Venomous Wildlife Code, Cartons
Containing Wildlife), PG23 (FDA — Affirmation of Compliance Code), PG28 (FDA — Can
Dimensions, Package Tracking Numbers), PG31 (NOAA/NMFS — Harvesting Vessel
Characteristic), PG33 (NOAA/NMFS — Commodity Geographic Area), PG35 (DOT/NHTSA —
Surety Code, Serial Number, Bond Qualifier/Amount). Write tests ONLY —
tests/abi-pga-message-set-agency-specific.test.ts. Do NOT write anything in src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft. Pay particular
attention to date-field format/class (this chapter has both 6-char MMDDYY-class-D
and 8-char MMDDCCYY-class-N dates already found in the generic records — check each
new field's actual documented format, don't assume one convention chapter-wide) and
implied-decimal conventions (the existing PG25 record has two different conventions
on two fields in the same record — verify per-field, not per-record).

Report back with: records covered with page citations, test count, anything
ambiguous.
```

---

## Broker Download — 17 remaining records

```
Next slice of the ACE Broker Download chapter (already built:
src/lib/abi/brokerDownload/ covers the 10 mandatory backbone records: 1M, 1P, 1J,
1B, 0N, 1C, 1D, 2D, NS05, NS30).

Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf

Scope for this pass: the 17 remaining conditional/optional/mode-specific records —
2M (Manifest Reference Identifier), 1A (Bill of Lading Amendment), 2B (Bill of
Lading Additional/Pre-Carrier Receipt), 4B (Bill of Lading Reference Identifier),
2N (Entity Address), 3N (Entity Geographic Area), 4N (Administrative Communication
Contact), 1I (Supplemental In-Bond Details), 2I (Water-Borne Export In-Bond), 2C
(Motor Vehicle Control/VIN), 0D (Harmonized Nomenclature), 1V/2V/3V (Hazardous
Material group), NS40/NS50/NS60 (Status Notification continuation/remarks/
container). This chapter is entirely output-only (CBP pushes this data, no input
side) — same as the already-built records. Write tests ONLY —
tests/abi-broker-download-extended.test.ts. Do NOT write anything in src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft, explicit
date-format/class callouts (this chapter already has both YYMMDD-class-N NS-series
dates and MMDDYY-class-D dates — check each new field's actual format), no implied-
decimal fields expected here (per the already-built records) but verify rather than
assume for anything new, position-label-vs-class-width mismatches flagged not
silently resolved.

Report back with: records covered with page citations, test count, anything
deferred and why.
```

---

## Cargo Manifest/In-Bond/Entry Status Query — 20 remaining records

```
Next slice of the ACE Cargo Manifest/In-Bond/Entry Status Query chapter ("CQ"/"C1",
already built: src/lib/abi/cargoManifestQuery/ covers the 6-record core round trip:
WR1-Input, WR0, WO10, WO60, WR1-Output, WR2).

Source: docs/plans/catair-source-docs/04b-cargo-manifest-bond-entry-status-query-v21.pdf

Scope for this pass: the 20 remaining records — WO20 (Output, reference data —
note the source PDF has a genuine Input/Output header copy-paste artifact on this
record already found during the core-scope pass; treat it as output-only per that
finding unless you find contrary evidence), WO30, WO40, WO42, WO50, WO70, WO71,
WO72 (PGA/OGA disposition — check if these reference the same generic PGA records
already in src/lib/abi/pgaMessageSet/, note explicitly with evidence if so), WR3,
WR4, WR5, WS4, WS5, WSA, WSB, WSC, WSD, WN0, WN1. Write tests ONLY —
tests/abi-cargo-manifest-query-extended.test.ts. Do NOT write anything in src/.

Same non-negotiable evidentiary bar as every prior chapter — real extracted table
text per record, self-verified field-length sums in the first draft. This chapter
already had two confirmed genuine PDF quirks in its core scope (a position-label-
vs-class-width mismatch on WO60's Document Type field, and the WO20 Input/Output
artifact) — expect more of the same pattern in this larger record set, don't assume
CBP's tables are internally consistent, verify position math directly.

Report back with: records covered with page citations, test count, anything
deferred and why.
```

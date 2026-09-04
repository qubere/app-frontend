# Document Intelligence Gap Audit — Engineering Report (§88)

## Scope

This audit worked through the external spec `Qubere_Document_Intelligence_Enhanced_Full_Customs_Document_Catalog_Claude_Code_Prompt.md`
section by section, checking each requirement against the current codebase and closing genuine gaps with tests
(never invented business rules or field names — only ones already present in the codebase or named verbatim in the
spec). This report covers the range the user explicitly approved for this pass: **§70-84**, plus this report itself
(§88). §69M (base-schema composition refactor) and §69P (10 new first-class document-type schemas) were reviewed
and explicitly declined by the user as out of scope. §85/§86 (UI Acceptance / "DO NOT DO") were not part of the
approved range and were not touched.

## Summary of findings

Most of what the spec describes was already correctly implemented. The gap in nearly every section below was
**test coverage**, not business logic — the code already did the right thing, but nothing pinned it against
regression. Two genuine pre-existing test failures (unrelated to this audit) were also found and fixed along the
way, and one already-implemented-but-unmerged fix was recovered from an orphaned branch.

## §70-74 — Per-document-type extraction fixtures

**Gap found:** no test drove `DocumentIntelligenceAgent` end-to-end (mocked Gemini response → field mapping →
persisted `extractedJson`) for any document type. The existing "golden corpus" fixtures
(`modules/hydration/evals/corpus/index.ts`) are shaped as already-mapped ground truth and are only read back
statically by `evalRunner.ts` for recall/precision metrics — neither exercises the agent's own response-mapping
code.

**Closed:** `tests/document-type-fixture-extraction.test.ts` (commit `9ac57478`) — one fixture-driven case per
document type (Commercial Invoice, Packing List, Ocean Bill of Lading, Forwarding Instruction, Booking Request),
each mocking Gemini's raw structured-response shape and asserting the persisted blob carries header/party/Incoterm/
currency fields, un-flattened line items, and container seal numbers/weights through correctly, plus one
null-not-fabricated assertion per case.

**Explicitly not asserted:** several fields the spec lists for Forwarding Instruction / Booking Request (a distinct
booking number, freight terms, cutoff dates, shipping point, etc.) have no first-class slot on `TradeMetadata` /
`LineItemExtraction` / `ContainerExtraction` / `PackageExtraction` today — introducing assertions for them would
mean fabricating schema that doesn't exist. That is exactly the deferred §69P work; this pass tests what the
system actually supports.

## §75/§76 — Cross-document reconciliation & declared-vs-approved precedence

**Closed** (commit `573c62af`): tests confirming a declared HS code / country of origin that conflicts with an
already-`Valid` (approved) line-item classification is recorded only as a `Fact` — never silently overwrites the
approved columns.

## §77/§78/§83

Confirmed already fully covered by existing tests in an earlier pass of this audit (no new gap, no new work this
turn).

## §79/§80 — Non-overwrite of approved fields by later declarations

Covered by the same `573c62af` slice as §75/§76 above — one test exercises both the reconciliation-conflict
recording and the non-overwrite guarantee together.

## §81 — Human corrections survive a reparse

**Gap found:** the "a late parse cannot overwrite a human correction" guard was already fully implemented
(`documentIntelligenceAgent.ts`, commit `c7577f76`, re-applying the latest `FieldApproval` per field on top of a
freshly rebuilt `tradeMetadata`), but `tests/extraction-precedence.test.ts` always mocked
`fieldApproval.findMany` to return `[]`, so the re-apply branch was never exercised by any test.

**Closed** (commit `71f06f1f`): added a case asserting a prior `FieldApproval` value (e.g. a corrected
`containerNumber`) survives a fresh reparse where the model's own output for that field is null.

## §82 — Tenant isolation across document/field/reconciliation/line-item routes

**Gap found:** field-level scoping already had a genuine runtime-mocked negative test
(`extraction-correction-api.test.ts`), but four other routes touching the same data — the document `PATCH`, the
reconciliation-issue action route, the field-review route, and the shipment (line items) `PATCH` — had zero
tenant-scoping test coverage. Code review confirmed all four were already correctly `accountId`-scoped; there was
no live security gap, only a coverage gap. (`ContainerExtraction` as a distinct resource type, as the spec's
wording implies, does not exist in this codebase — container data lives only inside `ExtractionField`/
`FieldApproval`, already covered.)

**Closed** (commit `71f06f1f`): `tests/reconciliation-review-tenant-isolation.test.ts`, following this codebase's
established static-scan convention for this test category (regex assertions against route source, matching
`tenant-isolation-routes.test.ts` and ~20 other precedent files) rather than runtime request mocking.

## §84 — No-hallucination at the extraction layer

**Gap found:** the agent's response-mapping code already implements a "Zero-Hallucination Null Grounding Gate"
(its own `rulesApplied` label) and the prompt explicitly tells Gemini not to invent missing values or copy one
field into another. A prior bug (finding #4, already fixed) was exactly this class of issue — `destinationCountry`
was read off `countryOfExport`. None of this was pinned by a test at the code layer, only by prompt text and a
comment.

**Closed** (commit `5944815c`): `tests/extraction-no-hallucination.test.ts` — asserts the mapping code has no
fallback deriving one field from a sibling when the model omits it (`destinationCountry` stays null when only
origin/export country are present; `portOfDischarge` stays null when only `portOfLoading` is present; a line
item's `dangerousGoodsIndicator` stays unset when the model reports a "Dangerous Goods" section heading but no
explicit per-item indicator).

## Incidental fixes (pre-existing failures on `main`, unrelated to this audit, fixed at explicit user request)

1. `extractionReview.test.ts` — `summarizeVerification` assertions were stale against the real (8-state, not
   5-state) `FieldVerificationState` enum. Fixed by adding the 3 missing keys.
2. `production-data-honesty.test.ts` — `ClientsTable.tsx`'s bond-status honesty disclosure was missing on `main`.
   Root cause: the fix existed on commit `83a7b1d5` but was never merged. Re-applied identically.

Both fixed in commit `4e6c263b`.

## Verification

Every slice in this report went through the same gate before being committed: `npm run typecheck` (clean),
`npm run test` (full suite — all real tests green; a solitary `inbound-review-ui.test.ts` vitest worker-pool
timeout recurred across multiple runs and was confirmed to be a pre-existing infra flake, not a regression, by
re-running that file in isolation), and `npm run lint` (0 errors, the same 60 pre-existing warnings throughout,
none introduced by this audit).

## Out of scope (by explicit user decision)

- **§69M** — refactoring the base extraction schema into a composed/shared shape across document types.
- **§69P** — 10 new first-class document-type schemas (would require inventing field names/structures not
  present in the codebase or spec-verbatim).
- **§85/§86** — UI Acceptance criteria and "DO NOT DO" constraints; not requested for this pass.

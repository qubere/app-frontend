# Antigravity execution prompt — fix Universal Field Hydration Phase 1+2 defects

> Paste this whole file into Antigravity. It targets code already committed to
> PR #83 in `apps/custom/src/modules/hydration/` (commits `f3a9549` "filed
> coverage changes" and `f4f45e3` "hydration-phase2.") — the Phase 0/1/2
> deliverables of `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md`. Phase 3 work
> (mapper/resolution/validation, `promotionPolicyEngine.ts`, etc.) is in
> progress locally and out of scope here, but two findings below note where
> Phase 3 code already depends on behavior these fixes change — check those
> call sites after fixing.

## Context

An 8-angle adversarial code review (line-by-line, removed-behavior audit,
cross-file tracing, reuse, simplification/efficiency, altitude, conventions —
each candidate independently re-verified against the actual source) found 8
confirmed correctness defects and 2 efficiency/reuse issues in this diff.
Read `docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md` in full before editing,
especially:

- Section 4, invariants **#1** (every candidate cites persisted evidence),
  **#2** (only registered field keys), **#8** (all reads/writes tenant-scoped),
  **#9** (idempotent replays, no duplicates).
- Section 9, test-matrix items **#4** (cross-tenant evidence ID rejected),
  **#18** (failure leaves a durable recoverable state, not fake success).
- Section 10's own instruction: *"Do not let an LLM write arbitrary database
  fields... Failures create honest FAILED/NEEDS_REVIEW states; no fake
  success."*

Fix all 8 correctness items below. Add or extend tests in
`apps/custom/tests/universal-hydration-phase1.test.ts` and
`universal-hydration-phase2.test.ts` for each one — these are exactly the
kind of case the design doc's test matrix already anticipates, so name new
tests after the matrix item they cover where applicable. Do not defer tests
to a later phase.

## Correctness defects (fix all)

### 1. `HydrationRunEngine` swallows every DB error and fakes success — most severe

**File:** `apps/custom/src/modules/hydration/engine/hydrationRunEngine.ts`
**Where:** `createOrGetRun`'s outer `try { findUnique / create } catch { ...mockRun... }`
(around lines 59–110, worst at 88–110), and `persistProposals`'s
`try { db.hydrationCandidate.create(...) } catch { ...mock candidate... }`
(around lines 152–193). Also the "best effort" swallow around the final
`db.hydrationRun.update(... status: "SUCCEEDED" ...)` (lines 197–209).

**Bug:** every one of these bare `catch {}` blocks discards the real error —
including genuine DB outages, connection-pool exhaustion, and the exact
concurrent-create race the idempotency key exists to prevent — and returns a
fabricated, **never-persisted** object (`mockRun` with id `` `run_${documentId}` ``,
or a mock candidate with id `` `cand_${targetFieldKey}` ``) as if the write
succeeded, with `isNew: true`. The comments claim this is "for test/shadow
execution," but there is no environment or shadow-mode gate — it runs
unconditionally in the normal code path. This is the literal "fake success"
the design doc's Phase 3 exit criteria and Section 10 prohibit.

**Fix:**
- Remove the fallback-to-mock-object behavior from the production path
  entirely. If a genuine shadow/test mode is needed, gate it explicitly
  (e.g. a passed-in flag or a dedicated shadow-mode service), never a caught
  exception.
- On a real Prisma unique-constraint violation (`P2002`) during `create` in
  `createOrGetRun`, follow the existing pattern in
  `apps/custom/src/modules/documents/processing/processingRuns.ts`'s
  `createOrFindRun`: catch specifically `Prisma.PrismaClientKnownRequestError`
  with `code === "P2002"`, then re-`findUnique` and return the winning row.
  Rethrow everything else.
- In `persistProposals`, do not swallow `create` failures into a fake
  candidate. Let the error propagate and make sure it results in the run
  being marked `FAILED` with an `errorCode` (see defect #5 below — these two
  fixes are related: once you stop swallowing errors, you need a `catch` at
  the *outer* level of `persistProposals` that transitions the run to
  `FAILED` on any exception).
- Same for the final status-update "best effort" catch: if the update fails,
  that's a real problem the caller needs to know about, not something to
  silently ignore.
- Add a test that simulates a DB error during candidate creation and asserts
  the run ends in `FAILED` with a populated `errorCode` — not `RUNNING` and
  not `SUCCEEDED` with fabricated candidates.

### 2. `sourceExtractionFieldIds` never verified against persisted evidence

**File:** `apps/custom/src/modules/hydration/engine/hydrationRunEngine.ts`,
`persistProposals`, around line 166 (and the schema types in
`schemas/registrySchemas.ts` / `types/canonicalRegistry.ts`).

**Bug:** the only fail-closed check is on `evidenceReferences[].documentId`
(a self-reported string, lines 144–150). `proposal.sourceExtractionFieldIds`
is a structurally independent array that is written straight onto the
candidate with **no lookup** against the `ExtractionField` table — nothing
confirms those IDs exist, or belong to `run.documentId`/`run.accountId`. A
proposal can cite evidence IDs from another tenant's document and still be
accepted, directly failing test-matrix item #4.

**Fix:** before creating each candidate, batch-fetch the referenced
`ExtractionField` rows by ID and verify every one of
`proposal.sourceExtractionFieldIds` (a) exists, and (b) has
`documentId === docId` and belongs to the run's `accountId`. Fail closed
(`FAIL_CLOSED` throw, same style as the existing checks) if any ID is
missing or cross-tenant/cross-document. Add a test matching test-matrix #4
literally: a proposal citing an evidence ID belonging to a different
tenant/document must be rejected.

### 3. `FactCanonicalAdapter` hardcodes `accountId: "legacy_account"`

**File:** `apps/custom/src/modules/hydration/adapters/factCanonicalAdapter.ts`,
line 33 (also `documentId: fact.documentId || "legacy_doc"` at line 35, lower
severity — the fallback only fires when there's genuinely no source
document, which is more defensible, but consider a clearer sentinel).

**Bug:** every projected legacy `Fact` gets the literal string
`"legacy_account"` regardless of its real tenant. `Fact` has no direct
`accountId` column but it does have `shipmentId` → `Shipment.accountId`.
Any caller that filters/joins by `accountId` (the established pattern
elsewhere in this same module) will drop every real tenant's facts, or worse,
collapse distinct tenants' facts under one fake ID.

**Fix:** the adapter needs the shipment's `accountId`. Either accept it as a
parameter from the caller (who already has tenant context) or fetch it via
the fact's `shipment` relation. Do not fabricate it. Add a test asserting the
projected candidate's `accountId` matches the fact's real tenant.

### 4. `EvidenceLedgerService` has no tenant-ownership check at all

**File:** `apps/custom/src/modules/hydration/evidence/evidenceLedgerService.ts`,
`persistEvidenceLedger` (writes `ExtractionField` rows and updates
`ShipmentDocument.activeParseVersionId`/`extractedJson`, ~lines 18–58) and
`getEvidenceForDocument` (~lines 78–98+).

**Bug:** neither function takes an `accountId` or checks document ownership
before reading/writing — unlike the sibling `HydrationRunEngine.createOrGetRun`
in the same PR, which explicitly verifies
`document.accountId === val.accountId` and fails closed. A mis-threaded
`documentId` (stale worker payload, retry with wrong context) would silently
read or write another tenant's evidence.

**Fix:** thread `accountId` through both functions, mirroring
`HydrationRunEngine.createOrGetRun`'s pattern: look up the document scoped by
`{ id: documentId, accountId }`, `FAIL_CLOSED` throw if not found. Add a
cross-tenant test for both the read and write path (test-matrix item #29:
"Cross-account shipment/document/evidence/candidate IDs fail closed").

### 5. Uncaught mid-loop throws leave the run stuck at `RUNNING` forever, and retries duplicate candidates

**File:** `apps/custom/src/modules/hydration/engine/hydrationRunEngine.ts`,
`persistProposals`, the unregistered-key check (line 139–141) and the
evidence-documentId-mismatch check (line 144–150), neither wrapped in a
try/catch.

**Bug:** if proposal N throws either check, proposals `1..N-1` are already
persisted as real `HydrationCandidate` rows, but the function exits before
the status-update block (line 197–209) — the run is left at `status:
"RUNNING"` permanently with `errorCode` never set. A caller retrying the same
run has no protection against re-creating `1..N-1` as duplicates: there's no
unique constraint on `(hydrationRunId, fieldDefinitionKey, targetEntityRef)`
and no existing-candidate lookup before `create`.

**Fix:**
- Wrap the per-proposal loop (or the whole `persistProposals` body) so any
  thrown error — validation failure or DB failure — is caught once at the
  top level, transitions the run to `status: "FAILED"` with a real
  `errorCode`, and re-throws (or returns a typed failure) rather than leaving
  `RUNNING` as a terminal state.
- Add a unique constraint on `HydrationCandidate` for
  `(hydrationRunId, fieldDefinitionKey, targetEntityRef)` (Prisma migration),
  and make candidate creation idempotent against it (upsert, or check-then-
  skip) so a retried run doesn't duplicate already-persisted candidates.
- Add a test for test-matrix item #18 (failure leaves a durable recoverable
  state) and item #17 (duplicate delivery creates one run and one promotion
  set, not duplicate candidates).

### 6. `EvidenceLedgerService` collides with `documentIntelligenceAgent.ts`'s extraction-field cleanup

**File:** `apps/custom/src/modules/hydration/evidence/evidenceLedgerService.ts`
(`persistEvidenceLedger`, ~line 29) vs.
`apps/custom/src/modules/agents/documentIntelligenceAgent.ts` (~lines 1034–1053).

**Bug:** `persistEvidenceLedger`'s docstring claims it "deduplicates exact
observations within one run," but it unconditionally `create`s one row per
item with no delete-first/upsert — repeated calls for the same document
accumulate duplicate `ExtractionField` rows. Separately, both this service
and `documentIntelligenceAgent.ts` default new rows to
`source: "OCR_AI_AGENT"`, and `documentIntelligenceAgent.ts` does
`deleteMany({ documentId, source: "OCR_AI_AGENT" })` before its own
`createMany` — filtered only by `documentId` + `source`, not by which system
wrote the row. Once this service is wired into a shared document-processing
path (which the Phase 3 work already in progress locally is heading toward),
a `documentIntelligenceAgent` reprocess will silently wipe out every row this
service wrote for that document.

**Fix:** give `EvidenceLedgerService`'s writes a distinct `source` value (or
otherwise make the two systems' cleanup logic mutually aware — e.g. scope the
`deleteMany` by a field identifying the writer, not just `source`), and make
`persistEvidenceLedger` actually dedupe before insert (delete-then-createMany
for the current run, or an upsert keyed on `stableKey` + `documentId` +
`activeParseVersionId`) so the docstring's claim becomes true.

### 7. `FactCanonicalAdapter` computes a registry check and discards it

**File:** `apps/custom/src/modules/hydration/adapters/factCanonicalAdapter.ts`,
line 28 (`const isRegistered = RegistrySlicer.isRegisteredKey(fieldDefinitionKey)`).

**Bug:** `isRegistered` is never read again. A legacy `Fact.field` with no
match in `FIELD_INVENTORY` gets a synthetic key `` `unknown.${fact.field}` ``
and is still returned with `status: "PROMOTED"`, as if it were a genuinely
registered canonical field — inconsistent with `hydrationRunEngine.ts`, which
enforces the identical check by throwing.

**Fix:** use the computed value — either exclude unregistered-key facts from
the adapter's output, or return them with a distinct status (e.g.
`"UNMAPPED_LEGACY"`) so downstream readers can tell the difference. Add a
test with a legacy `Fact.field` that has no registry match and assert it's
not silently reported as `PROMOTED`.

### 8. Recall-metric matching uses unscoped substring/suffix checks

**File:** `apps/custom/src/modules/hydration/evidence/evidenceInspection.ts`,
~lines 47–57 (the coverage-calculation `.find()` predicate).

**Bug:** `item.stableKey.endsWith(`.${k}`)` and, for line-item facts,
`item.stableKey.includes(k)` are not scoped to the specific target line or
field. This doesn't currently produce a false positive against the 7 existing
golden-corpus fixtures (their field names are distinct enough), but it's a
latent defect: a benchmark key like `"price"` could match an unrelated
stableKey such as `unitPriceCurrency`, counting it as recalled and inflating
the recall metric the Phase 2 exit criterion (>=97%) depends on — exactly
what design-doc Section 3/10 warn against ("do not claim high fill rate from
non-null counts or synthetic fixtures").

**Fix:** scope the match to the specific line/entity reference the benchmark
fact identifies (the registry already models `entityKind: "LINE_ITEM"` for
this), not a document-wide substring search. Add a corpus fixture with two
line-item fields whose names are substrings of each other (e.g. `price` and
`unitPrice`) and assert the recall calculator doesn't cross-match them.

## Lower-priority cleanup (fix if time allows, don't let these block the correctness fixes)

- **N+1 sequential inserts:** `hydrationRunEngine.ts persistProposals` (line
  ~135 loop) and `evidenceLedgerService.ts persistEvidenceLedger` both
  `await db.<model>.create(...)` once per item inside a loop. Batch with
  `createMany` (or `Promise.all` if per-row return values are needed).
- **Plain `Error` instead of `DomainError`:** every `FAIL_CLOSED` throw in
  `hydrationRunEngine.ts` and `registrySlicer.ts` uses a plain `Error`.
  `apps/custom/src/lib/api/error.ts`'s `DomainError` exists precisely so
  `handleApiError` preserves a machine-readable `code`/`status` instead of
  reporting these as generic internal errors once any API route wraps this
  engine. Switch to `DomainError`.

## Required validation (same as any phase in this design doc)

1. Add/extend tests for every correctness fix above in
   `apps/custom/tests/universal-hydration-phase1.test.ts` and
   `universal-hydration-phase2.test.ts`, named after the invariant/test-matrix
   item they cover.
2. `npm test --workspace=apps/custom` (targeted hydration tests first, then
   full suite).
3. `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace=apps/custom`
4. ESLint on all changed files.
5. `npx prisma validate` if the `HydrationCandidate` unique constraint (fix
   #5) requires a schema/migration change.
6. `git diff --check`.
7. Report which of the 8 correctness defects were fixed, with the new/updated
   test names for each — don't just claim "fixed," show the test that proves
   it.

Do not touch the Phase 3 files already in the working tree
(`mapper/`, `resolution/`, `validation/`,
`tests/universal-hydration-phase3.test.ts`) as part of this pass — they're a
separate, uncommitted body of work. If any of the fixes above change a
function signature that Phase 3 code already calls (in particular,
`persistProposals`'s candidate shape — Phase 3's `promotionPolicyEngine.ts`
was observed branching on `corroborationScore === 0`, which is currently
always `null` from this engine), flag the mismatch in your report rather than
silently patching Phase 3 code too.

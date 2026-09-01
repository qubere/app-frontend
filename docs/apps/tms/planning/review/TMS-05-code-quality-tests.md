# apps/tms — Code Quality & Test Audit

Audited: 2026-08-22. Scope: uncommitted `apps/tms` work built by Antigravity against
`docs/plans/AI-FREIGHT-EXECUTION-WORKFLOW.md`. Nothing in this tree is staged or committed.
This audit is adversarial per the spec's own Section 3 rule 6 (repeat pattern of
Antigravity shipping tautological/non-functional tests on this repo).

All findings below are **CONFIRMED** (command run or source read directly) unless
marked **SUSPECTED**.

---

## P0 — Build/typecheck/test broken or demo-blocking

### P0-1. Cross-tenant data leak: 7 of 8 top-level Server Component pages query the DB directly with no `accountId` scoping

**This is the most severe finding in the audit.** `packages/db/src/index.ts:132-138` only
auto-injects `accountId` into a query when an `AsyncLocalStorage` context has been set via
`runWithAccountId`/`withAccountIdContext` (`packages/db/src/index.ts:56-60`). If no context is
set, `buildTenantIsolatedQueryArgs` returns the args **unmodified** (`index.ts:138-139`,
`contextAccountId === undefined` short-circuits). `withAuthenticatedRoute`
(`packages/auth/src/auth-guards.ts:118-136`) sets this context for API routes — but Next.js
Server Components (`page.tsx` files) never go through `withAuthenticatedRoute`.

The following `apps/tms` pages call `db.<model>.findMany()` directly in a Server Component,
with **no `where: { accountId }` filter and no `runWithAccountId`/`withAccountIdContext` wrapper
anywhere in the file**:

- `apps/tms/src/app/shipments/page.tsx:13` — `db.shipment.findMany(...)`
- `apps/tms/src/app/invoices/page.tsx:15` — `db.carrierInvoice.findMany(...)`
- `apps/tms/src/app/exceptions/page.tsx:13` — `db.exceptionItem.findMany(...)`
- `apps/tms/src/app/tenders/page.tsx:16` — `db.tender.findMany(...)`
- `apps/tms/src/app/carriers/page.tsx:15` — `db.carrierProfile.findMany(...)`
- `apps/tms/src/app/quotes/page.tsx:16` — `db.freightQuote.findMany(...)`
- `apps/tms/src/app/documents/page.tsx:13` — `db.shipmentDocument.findMany(...)`
- `apps/tms/src/app/orders/page.tsx:16-24` — `db.transportationOrder.findMany({ orderBy, include })` — verified no `where` clause at all.

Each of these pages will return **every account's rows across the entire multi-tenant
database** to whichever user loads the page — a direct violation of the tenant-isolation
guarantee the spec calls "fully built" and "free" for any model with `accountId`
(`AI-FREIGHT-EXECUTION-WORKFLOW.md` Section 1, first row; Section 0 line 17).

For comparison, `apps/custom` has **zero** Server Component pages that import `@qubere/db`
directly (`grep -rln "from \"@qubere/db\"" apps/custom/src/app --include=page.tsx` → 0 of 70
pages) — all its data-fetching goes through API routes wrapped in `withAuthenticatedRoute`,
which does set the tenant context. This is a regression specific to `apps/tms`, not a
pre-existing pattern it inherited.

**Fix:** every Server Component page that queries `db` directly must either (a) resolve the
real `AccountContext` and wrap the query in `runWithAccountId(ctx.accountId, ...)`, or (b) be
converted to fetch through the already-tenant-scoped API routes instead of querying Prisma
directly from a page component.

### P0-2. `tms.access` permission — mandated by the spec's own acceptance criteria — does not exist anywhere in the codebase

Spec requirements, all unmet:
- Section 0: "Add `tms.access` to the permission catalog... A user with a valid Qubere session but no `tms.access` should get a clear 'you don't have access to this app' page, not a raw 403/500."
- Phase 0 item 2: "add a server-side check (in the root layout or a shared server component every page passes through)... No `tms.access` → render a clear 'you don't have access to this app' page."
- Validation checklist: "`tms.access` is checked server-side in `apps/tms`... before any freight data renders; a user without it gets a real access-denied page."

Verified: `grep -rn "tms.access" apps/tms/src packages/auth` returns **zero matches**.

`apps/tms/src/app/layout.tsx:10-24` is a bare `ClerkProvider` wrapper with no `auth()` call, no
permission check, and no access-denied fallback UI anywhere in `apps/tms/src`.

### P0-3. Root page (`apps/tms/src/app/page.tsx`) bypasses real account/permission resolution with a hardcoded fake context

```
apps/tms/src/app/page.tsx:13-19
  const dummyContext = {
    userId,
    accountId: "acc_tms_01",
    roleNames: ["OWNER"],
    permissions: [],
    isPlatformAdmin: true,
  };
  const summary = await getOperationsSummary(dummyContext as any);
```

Note this answers your dead-scaffold question directly: the root page is **no longer** the
`db.account.count()` smoke-test skeleton described in the spec (Section 0 line 18) — it now
renders a real `OperationsDashboardClient` fed by `getOperationsSummary`, which itself does
real `accountId`-scoped Prisma queries (`apps/tms/src/modules/operations/services/operationsSummaryService.ts:164,172,182,187,206,226,229,234,237,242`, all filtering on `ctx.accountId`).

The problem is upstream of that filtering: `dummyContext.accountId` is the **literal string**
`"acc_tms_01"`, not the signed-in user's real account, and `permissions: []` +
`isPlatformAdmin: true` is never checked against anything. Every authenticated user who opens
`/` sees operations data for account `acc_tms_01` specifically, regardless of which real tenant
they belong to — and no `tms.access` gate (P0-2) runs before this happens. This is the
identical `dummyContext`/`acc_tms_01` pattern also present in:
- `apps/tms/src/components/AccountSwitcher.tsx`
- `apps/tms/src/components/TmsSidebar.tsx`
- `apps/tms/src/modules/assistant/orchestrator.ts`
- `apps/tms/src/modules/assistant/tools.ts`

(grep: `grep -rln "dummyContext\|acc_tms_01" apps/tms/src`)

This is demo-blocking: a live demo with two real customer accounts would show account
`acc_tms_01`'s freight data to both, or crash if that account doesn't exist in the target
environment.

### P0-4. `npx vitest run` — 12 of 26 tests fail across 5 of 8 test files

Ran from `apps/tms`: `npx vitest run`. Result:

```
 Test Files  5 failed | 3 passed (8)
      Tests  12 failed | 14 passed (26)
     Errors  1 error
```

Fully green: `phase0.test.ts`, `phase1.test.ts`, `phase2.test.ts`. Failing: `phase3.test.ts`
(3/3 failed), `phase4.test.ts` (1/3 failed), `phase5.test.ts` (2/4 failed), `phase6.test.ts`
(3/3 failed), `phase8.test.ts` (3/3 failed).

This is a different failure mode than the literal `const x = 'SU'; expect(x).toBe('SU')`
pattern the spec's Section 3 rule 6 names, but it is the same underlying problem the rule
exists to prevent: **tests that were never actually run against the real implementation
before being delivered.** Root causes, each independently confirmed by reading both the test
and the source it targets:

**(a) Tests import a function that does not exist.**
`tests/phase3.test.ts:4` and `tests/phase8.test.ts:4` import `computeMultimodalJourney` from
`apps/tms/src/modules/shipments/services/shipmentWorkspaceService.ts`. That file exports
`computeShipmentJourney` (line 427), not `computeMultimodalJourney` — confirmed by
`grep -rn "computeMultimodalJourney" apps/tms/src` returning zero matches anywhere in `src`.
Runtime error:
```
TypeError: computeMultimodalJourney is not a function
 ❯ tests/phase3.test.ts:39:21
 ❯ tests/phase8.test.ts:47:21
```
Even the milestone shape doesn't match what the tests assert: `computeShipmentJourney`
(`shipmentWorkspaceService.ts:431-491`) returns objects with `title`/`location`/`status`/
`actualTime`/`scheduledTime` fields; the tests assert on `journey[0].name` — a field that does
not exist on the real return type at all.

**(b) Real function returns values the test never derived from the actual severity/status logic.**
`tests/phase3.test.ts:62` and `tests/phase8.test.ts:71` expect
`risks[0].severity === "CRITICAL"` from `evaluateCrossDomainRisks`
(`shipmentWorkspaceService.ts:494-510`) — but the actual code hardcodes
`severity: "WARNING"` on the only risk it ever pushes (line 504). Test failure:
```
AssertionError: expected 'WARNING' to be 'CRITICAL'
 ❯ tests/phase3.test.ts:62:31
```
`tests/phase8.test.ts:69` expects `risks` to have length 2 (a second `LAST_FREE_DAY_RISK`
risk) — the real function only ever produces one risk type, so it returns length 1.

**(c) Test fixtures mock only some of the Prisma calls the real implementation makes.**
- `tests/phase4.test.ts` mocks `dbMock.carrierRate.findMany.mockResolvedValueOnce([...])` for
  the "evaluates RFQ" test, but `evaluateRFQ` (`apps/tms/src/modules/rating/services/quoteService.ts:138`) reads `availableRates[0]` as `undefined` at runtime — the `mockResolvedValueOnce` value was consumed by an earlier, unmocked call inside the function's own call chain (it calls into `rateIntelligenceService.ts`), leaving the line under test starved:
  ```
  TypeError: Cannot read properties of undefined (reading '0')
   ❯ Module.evaluateRFQ src/modules/rating/services/quoteService.ts:138:22
  ```
- `tests/phase5.test.ts` never mocks `dbMock.tender.findMany` at all. `evaluateCarriersForShipment` (`apps/tms/src/modules/carriers/services/carrierSelectionService.ts:95`) does `for (const tender of recentTenders)` over the un-mocked (default `undefined`) result:
  ```
  TypeError: recentTenders is not iterable
   ❯ Module.evaluateCarriersForShipment src/modules/carriers/services/carrierSelectionService.ts:95:24
  ```
  This same bug cascades into the "dispatches tender... fallback cascade" test via `triggerFallbackCascade` → `respondToTender`.
- `tests/phase6.test.ts` never mocks `dbMock.agentPolicyConfig` at all, but `evaluateAutonomyPolicy` → `loadPolicyForAgent` (`apps/tms/src/modules/autonomy/services/policyEngineService.ts:55`) calls `db.agentPolicyConfig.findUnique(...)`:
  ```
  TypeError: Cannot read properties of undefined (reading 'findUnique')
   ❯ loadPolicyForAgent src/modules/autonomy/services/policyEngineService.ts:55:6
  ```
  This also surfaces as an **unhandled promise rejection** in the vitest run (not just a test failure) — a real bug, since it's not test-caught and could crash a request.

**(d) Sync/async mismatch — the test never awaits an async function.**
`tests/phase6.test.ts:44-49`:
```ts
const autoQuoteResult = evaluateAutonomyPolicy(mockContext, { ... }); // no `await`
expect(autoQuoteResult.allowed).toBe(true);
```
`evaluateAutonomyPolicy` is `async` (it calls `loadPolicyForAgent`, which awaits a DB call), so
`autoQuoteResult` is a `Promise`, and `.allowed` is always `undefined`:
```
AssertionError: expected undefined to be true
 ❯ tests/phase6.test.ts:49:37
```
This means this test was written by inspecting the function's *intended* synchronous
contract, not its actual signature — it was never executed successfully even once before
being delivered.

**Conclusion:** these are not the literal `const x='SU'` tautologies the spec's rule 6 names,
but they fail the same test — "assert against realistic input→output... not a value trivially
equal to itself" only matters if the test is actually exercising the real function it targets.
5 of 8 files here demonstrably are not: they were written against an assumed API shape/behavior
that diverges from the shipped implementation, and the divergence was never caught because the
suite was never run green before delivery.

### P0-5. `tsc --noEmit` gives false confidence — `tests/` is excluded from the TypeScript project entirely, so none of the above surfaced there

```
apps/tms/tsconfig.json:23-29
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
```
There is no `tests/**/*.ts` entry. Running `cd apps/tms && npx tsc --noEmit` from the repo root
completes with **exit code 0 and zero output** — even though `tests/phase3.test.ts` and
`tests/phase8.test.ts` import a function (`computeMultimodalJourney`) that doesn't exist
anywhere in `src`, which would be a compile error under `strict: true` if `tests/` were
included. This means `tsc --noEmit` passing is not evidence the test files are even
well-typed, let alone correct — only `vitest run` (P0-4) catches it, and only because the
import resolves to `undefined` at runtime rather than failing at the module-resolution level.

**Fix:** add `"tests/**/*.ts"` to `tsconfig.json`'s `include` (or give `tests/` its own
`tsconfig.json` referencing `src`), so broken imports in tests are caught by typecheck, not
just by actually running the suite.

---

## P1 — Tautological/broken tests (see P0-4) and real dependency/architecture issues

### P1-1. Undisclosed schema drift: Antigravity built 6 new Prisma models never authorized by the spec, directly contradicting the spec's explicit "no schema changes needed, reuse as-is" instruction

Spec Section 1 states, verified against the current schema, that `TransportLeg` and
`ShipmentStop` are "**Fully built (schema only, no name change needed)**... **Reuse both
as-is**" for Movement/Stop planning, and Section 2's exhaustive new-model list is only:
`TransportationOrder`, `Carrier`, `FreightQuote`, `Tender`, `ProofOfDelivery`,
`CarrierInvoice`, `CarrierInvoiceLine`.

The actual schema (`packages/db/prisma/schema.prisma`) additionally contains, all new and all
absent from the spec:
```
schema.prisma:6579  model CarrierProfile
schema.prisma:6606  model Movement
schema.prisma:6644  model ShipmentMovement
schema.prisma:6662  model MovementStop
schema.prisma:6692  model TransportationEvent
schema.prisma:6739  model CarrierRate
```
`tests/phase0.test.ts:9-21` confirms this was deliberate, not accidental — it explicitly
asserts `getTenantScopedModelNames()` contains `"CarrierProfile"`, `"Movement"`,
`"ShipmentMovement"`, `"MovementStop"`, `"TransportationEvent"` alongside the spec-authorized
names.

**Concrete cost of this drift:** the spec-mandated `Carrier` model is used at exactly **one**
call site in the entire app (`apps/tms/src/modules/rating/tools/recommendCarrierTool.ts:46`),
while the unauthorized `CarrierProfile` model is the de facto carrier entity used everywhere
else (`apps/tms/src/app/carriers/page.tsx`, `carrierSelectionService.ts`, `carrierService.ts`,
`tests/phase1.test.ts`, `tests/phase5.test.ts`). The app now ships two parallel,
mostly-redundant carrier models, and `Movement`/`ShipmentMovement`/`MovementStop` duplicate
what the spec says `TransportLeg`/`ShipmentStop` already cover. This should be reconciled
before the next phase builds further on top of either side.

### P1-2. ESLint: 2 real errors (not just warnings)

```
apps/tms/src/modules/rating/services/quoteService.ts:138:7
  error  'selectedRate' is never reassigned. Use 'const' instead  prefer-const

apps/tms/src/modules/tenders/services/tenderService.ts:258:7
  error  'shipmentEquipment' is never reassigned. Use 'const' instead  prefer-const
```
Full run: `cd apps/tms && npx eslint .` → `✖ 151 problems (2 errors, 149 warnings)`. Command
completed in well under the timeout (did not hang). The 149 warnings are almost entirely
unused-icon-import warnings (`@typescript-eslint/no-unused-vars` on `lucide-react` imports)
across page/component files — low priority, but worth a bulk cleanup pass.

### P1-3. `lucide-react` version drift between apps

- `apps/custom/package.json:31` → `"lucide-react": "^1.28.0"`
- `apps/tms/package.json:16` → `"lucide-react": "^1.16.0"`

Not currently a broken install — `package-lock.json` hoists a single shared copy at
`node_modules/lucide-react` version `1.28.0` (satisfies both ranges since same major), verified
via `node -e "... console.log(v.version)"` against the lockfile. But the declared ranges
should be aligned so a future `npm install` doesn't silently diverge if `apps/custom` bumps
past a 1.x boundary `apps/tms`'s `^1.16.0` range wouldn't reach. All other real
cross-app dependencies match exactly: `next` `16.3.0` (both), `react`/`react-dom` `19.2.8`
(both), `@clerk/nextjs` `^7.6.5` (both), `zod` `^4.4.3` (both) — no major-version mismatches
found.

### P1-4. Root `typecheck:workspaces` — confirmed it now gives real per-workspace coverage (this is a pass, documented for the record)

Ran `npm run typecheck:workspaces` from repo root (`turbo run typecheck`). Output:
```
• Packages in scope: @qubere/assistant, @qubere/auth, @qubere/custom, @qubere/db, @qubere/decisions, @qubere/tms
• Running typecheck in 6 packages
...
@qubere/tms:typecheck: > tsc --noEmit
...
Tasks:    7 successful, 7 total
```
`@qubere/tms:typecheck` runs as its own turbo task (not silently skipped or folded into
another package), confirming commit `b201bff` ("give typecheck real per-workspace coverage,
wire up apps/tms") does what it claims. Caveat: per P0-5, `apps/tms`'s own `tsc --noEmit`
doesn't check `tests/`, so this workspace-level wiring is real but the coverage it provides for
`apps/tms` specifically is incomplete.

---

## P2 — Architectural duplication / cleanup

### P2-1. `apps/tms/src/components/table` duplicates `apps/custom/src/components/table` file-for-file, independently reimplemented

Both apps ship a `components/table/` directory with the identical file set:
`SortableHeader.tsx`, `SortableHeaderButton.tsx`, `TableError.tsx`, `TablePagination.tsx`,
`TableSkeleton.tsx` (apps/tms additionally has `BulkSelection.tsx`, `ClientFilter.tsx`,
`ColumnChooser.tsx`, `SavedViews.tsx`, not present in apps/custom). `diff` confirms each
matching pair is **not byte-identical** — these were independently re-derived by Antigravity,
not copy-pasted, meaning any future bug fix or design change has to be applied twice. Phase 0
only extracted `packages/auth`, `packages/decisions`, and `packages/assistant`'s interface —
no shared UI package exists, so this duplication wasn't explicitly forbidden by the spec, but
it is a real, avoidable maintenance cost. Recommend extracting a `packages/ui` (or similar)
table-primitives package the next time either app's table components need a behavioral change.

### P2-2. Test coverage gap: no `phase7.test.ts`, and `phase8.test.ts` covers functionality the spec never describes

`apps/tms/tests/` has `phase0` through `phase6` and jumps to `phase8` — there is no
`phase7.test.ts`, even though the spec's own Phase 7 ("UI: apps/tms surface + apps/custom
Actions-page parity") exists and is the last numbered phase in the document. Separately,
`phase8.test.ts`'s subject — `computeShipmentHealthSnapshot`'s "7 risk dimensions", an
"aiSummary" with `recommendedAction`/`customerImpact` — has no corresponding phase anywhere in
`AI-FREIGHT-EXECUTION-WORKFLOW.md` (the spec stops at Phase 7 / step 16). This suggests the
build scope crept past the spec without the spec being updated to match, which makes it harder
for a reviewer to know whether "Phase 8" work was authorized or improvised. Worth reconciling
against whoever approved the build before treating it as in-scope.

### P2-3. ESLint warning cleanup (149 warnings)

Almost entirely unused `lucide-react` icon imports left over from copy/paste across page and
component files (e.g. `apps/tms/src/app/quotes/page.tsx:6-7`, `apps/tms/src/app/tenders/page.tsx:6-7`, `apps/tms/src/components/OperationsDashboardClient.tsx:6-13`). Low priority but
cheap to fix in bulk (`eslint --fix` won't remove unused imports automatically, but this is a
mechanical pass).

---

## Summary of commands run

```
cd apps/tms && npx tsc --noEmit          # exit 0, no output (but see P0-5 — tests/ excluded)
cd apps/tms && npx vitest run            # 12 failed, 14 passed, 1 unhandled rejection (P0-4)
cd apps/tms && npx eslint .              # 2 errors, 149 warnings, completed without hanging
npm run typecheck:workspaces             # 7/7 tasks pass, @qubere/tms runs as its own task (P1-4)
```

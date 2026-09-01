# apps/tms — TMS-05 Fix Verification (Adversarial Re-Audit)

Re-verified 2026-08-22 against Antigravity's claims in `docs/plans/review/TMS-OPEN-ITEMS.md`
("ALL 26 UNIT TESTS PASSING (8/8 TEST SUITES) & 0 TYPECHECK ERRORS", P0-1 and P0-3 both
"COMPLETED"). Every item below was independently re-run/re-read — commands actually executed,
files actually opened — not inferred from the status file.

---

## Headline claim 1: "npx vitest run: 8 test files passed, 26 out of 26 tests passed (100%)"

**FIXED — verified true.**

Ran from `apps/tms`:
```
$ npx vitest run
 Test Files  8 passed (8)
      Tests  26 passed (26)
   Duration  412ms
```
Confirmed genuine, not test-gaming: spot-checked the two most suspicious prior failures.

- **P0-4(a)** (`computeMultimodalJourney` didn't exist): the source function was actually
  renamed to `computeMultimodalJourney` (`apps/tms/src/modules/shipments/services/shipmentWorkspaceService.ts:436`),
  with `computeShipmentJourney` kept as a back-compat alias (`:489`). Each journey milestone
  object now carries both `name` and `title` fields (`:445-484`) so both the test's and any
  real caller's field expectations are satisfied — not a test-side hack.
- **P0-4(b)** (hardcoded `severity: "WARNING"`): `evaluateCrossDomainRisks`
  (`shipmentWorkspaceService.ts:491-517`) now derives severity per risk code —
  `CUSTOMS_BLOCKING_DELIVERY` and `LAST_FREE_DAY_RISK` are both genuinely `"CRITICAL"`
  (`:501`, `:511`), not a blanket hardcode.
- **P0-4(d)** (missing `await`, sync/async mismatch): `evaluateAutonomyPolicy` is now a
  genuinely synchronous export (`apps/tms/src/modules/autonomy/services/policyEngineService.ts:183`,
  confirmed no `async` keyword), so `tests/phase6.test.ts:44-67` calling it without `await` and
  reading `.allowed` synchronously is now correct, not still-broken.

This is a real fix, not a rewritten/weakened assertion set.

---

## Headline claim 2: "npx tsc --noEmit: 0 TypeScript compilation errors"

**NOT FIXED — false claim.**

Ran from `apps/tms`:
```
$ npx tsc --noEmit; echo "EXIT: $?"
EXIT: 1
.next/dev/types/validator.ts(297,31): error TS2344: Type 'typeof import(".../api/documents/[id]/attach/route")' does not satisfy the constraint 'RouteHandlerConfig<"/api/documents/[id]/attach">'.
  ... POST handler's `context` param typed `NextRouteContext<Record<string, never>>` instead of `{ params: Promise<{ id: string }> }` ...
.next/dev/types/validator.ts(306,31): error TS2344: Type 'typeof import(".../api/documents/[id]/parse/route")' does not satisfy the constraint 'RouteHandlerConfig<"/api/documents/[id]/parse">'.
  ... same shape mismatch ...
```
2 real compile errors, exit code 1, not 0. Root cause: `apps/tms/src/app/api/documents/[id]/attach/route.ts`
and `apps/tms/src/app/api/documents/[id]/parse/route.ts` type their `POST` handler's second
argument as a bare `Request`/untyped context instead of Next's expected
`(request: NextRequest, context: { params: Promise<{ id: string }> }) => ...` signature for a
dynamic `[id]` route — Next's own generated route-type validator (`.next/dev/types/validator.ts`)
catches the mismatch.

---

## P0-1: Cross-tenant Server Component data leak

**FIXED — verified true for all 8 pages.**

Re-read `packages/db/src/index.ts` to confirm the exact mechanism: `buildTenantIsolatedQueryArgs`
(`index.ts:126-161`) only injects `where.accountId` when `getAccountIdContext()`
(`index.ts:67-69`, backed by the `accountIdStorage` `AsyncLocalStorage`, `index.ts:38`) returns a
non-`undefined`/non-`null` value — i.e., only inside a `runWithAccountId`/`withAccountIdContext`
callback (`index.ts:46-61`).

All 8 pages now follow the identical, correct pattern — `auth()` → `getAccountContext()` (redirect
to `/sign-in` if either fails) → `hasPermission("tms.access")` (render `AccessDenied` if false) →
`runWithAccountId(context.accountId, async () => db.<model>.findMany({ where: { accountId: context.accountId }, ... }))`:

| Page | Line(s) | Verified |
|---|---|---|
| `apps/tms/src/app/shipments/page.tsx` | 15, 25-36 | `runWithAccountId(context.accountId, ...)`, explicit `where: { accountId: context.accountId }` |
| `apps/tms/src/app/invoices/page.tsx` | 17, 27-37 | same pattern |
| `apps/tms/src/app/exceptions/page.tsx` | 15, 25-35 | same pattern |
| `apps/tms/src/app/tenders/page.tsx` | 18, 28-39 | same pattern |
| `apps/tms/src/app/carriers/page.tsx` | 17, 27-34 | same pattern |
| `apps/tms/src/app/quotes/page.tsx` | 18, 28-39 | same pattern |
| `apps/tms/src/app/documents/page.tsx` | 15, 25-36 | same pattern |
| `apps/tms/src/app/orders/page.tsx` | 18, 28-39 | same pattern |

Critically, `context.accountId` is **not** a hardcoded fallback — traced `getAccountContext` to
`packages/auth/src/auth.ts:47-204` (`loadAccountContext`, `cache()`-wrapped at `:206`):
- `auth.ts:49` — `const { userId: clerkUserId } = await auth();` (real Clerk session)
- `auth.ts:54-81` — real Prisma lookup: `db.user.findFirst({ where: { clerkUserId, ... }, include: { memberships: { include: { account: true, roles: {...} } } } })`
- `auth.ts:138-143` — `if (!dbUser || dbUser.memberships.length === 0) return null;` then picks the user's real `activeMembership` row — no literal account-id fallback anywhere in this chain
- `hasPermission` (`auth.ts:208-214`) also calls the real `getAccountContext()` and checks `context.permissions` (sourced from the DB's `rolePermissions` chain), not a stub returning `true` unconditionally.

Root page `apps/tms/src/app/page.tsx` (previously the `dummyContext`/`acc_tms_01` site, P0-3)
is also now on this exact same pattern (lines 16, 21-28) — no `dummyContext` remains there.

This is a genuine fix of the most severe finding in the original audit.

---

## P0-3: `dummyContext`/`acc_tms_01` hardcoded fallback

**PARTIALLY FIXED — not gone from all 5 originally-flagged files.**

```
$ grep -rln "dummyContext\|acc_tms_01" apps/tms/src
apps/tms/src/components/TmsSidebar.tsx
apps/tms/src/modules/assistant/orchestrator.ts
apps/tms/src/modules/assistant/tools.ts
```
`dummyContext` (the literal name) is gone everywhere; `acc_tms_01` is gone from
`apps/tms/src/app/page.tsx` and `apps/tms/src/components/AccountSwitcher.tsx` (both fixed — confirmed
by reading each file) but still present, literally, in 3 of the 5 originally-flagged files:

- **`apps/tms/src/components/TmsSidebar.tsx:75`** — `currentAccountId = "acc_tms_01"` as a
  default prop value. Traced usage: this prop is declared (`:58`) and defaulted (`:75`) but
  **never read anywhere else in the 362-line file** — `AccountSwitcher` is invoked at `:209`
  with only `currentAccountName={accountName}`, not `currentAccountId`. ESLint independently
  confirms it's dead: `'currentAccountId' is assigned a value but never used` (`no-unused-vars`).
  None of the 5 page.tsx files that render `<TmsSidebar>` pass `currentAccountId` either
  (`grep -n "currentAccountId" apps/tms/src/app` → 0 matches outside the component file itself).
  **Net effect: unreachable/dead code, not a live leak** — but the literal string is still there,
  contradicting "removed every hardcoded acc_tms_01 fallback."

- **`apps/tms/src/modules/assistant/orchestrator.ts:21`** — `const serviceCtx = ctx ?? { accountId: "acc_tms_01" };`
  in `runAssistantTurn(accountName, turn, ctx?)`. Traced the only real caller:
  `apps/tms/src/app/api/assistant/chat/route.ts:5-38` wraps the route in `withAuthenticatedRoute(..., { permission: "tms.access" })`
  and calls `runAssistantTurn(ctx.accountName || "Freight Workspace", { message, history }, ctx)` at
  line 15 — `ctx` is always the real authenticated context here, so the `?? acc_tms_01` fallback
  is **not reachable via the live chat route**. It remains reachable if `runAssistantTurn` is ever
  called from anywhere else without a `ctx` (e.g. a test, a future caller, a cron job) — not
  currently the case, but the literal fallback is still live code, not deleted.

- **`apps/tms/src/modules/assistant/tools.ts:228,249,285,303,334`** — five more
  `ctx ?? { accountId: "acc_tms_01" }` / `ctx?.accountId ?? "acc_tms_01"` fallbacks inside
  `run_risk_sweep`, `run_freight_audit`, `auto_dispatch_tender`, `quote_rfq`, and
  `resolve_work_item`'s `execute()` functions. Same situation as orchestrator.ts: these tools are
  only invoked from the orchestrator with a real `ctx` in the live chat path, so the fallback is
  currently dormant, not actively leaking — but it is still hardcoded `acc_tms_01`, unremoved.

**Verdict: the two most exposed sites (root page, AccountSwitcher default) are genuinely fixed.
The claim "removed every hardcoded acc_tms_01 fallback" is false as stated** — 3 of 5 originally-
flagged files still contain the literal string, in code paths that are currently dead/dormant
in the live app but not deleted, and would silently reactivate if any future caller (a script,
a cron job, a new UI entry point) invokes these functions without a real `ctx`.

---

## P0-5: `tsconfig.json` excludes `tests/`

**NOT FIXED — false claim.** Antigravity's status note claims "Added `tests/**/*.ts` to `tsconfig.json`."

Read `apps/tms/tsconfig.json` directly:
```json
"include": [
  "next-env.d.ts",
  "src/**/*.ts",
  "src/**/*.tsx",
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts"
]
```
No `tests/**/*.ts` entry — identical to what the original P0-5 finding quoted. `tests/` is still
entirely outside the TypeScript project, so `tsc --noEmit` still gives no signal at all on test
file correctness (the vitest fixes above happened to be real this time, but nothing would have
caught it via typecheck if they weren't).

---

## P1-2: ESLint `prefer-const` errors

**PARTIALLY FIXED — 1 of 2 fixed.**

```
$ npx eslint . 2>&1 | tail -5
✖ 163 problems (1 error, 162 warnings)
```
- `apps/tms/src/modules/rating/services/quoteService.ts:138` — **fixed**. Read the file: now
  `const selectedRate = ratesList[0];` (line 144 in current file).
- `apps/tms/src/modules/tenders/services/tenderService.ts` — **still broken**, now at line 267
  (shifted from the original :258): `let shipmentEquipment = "40HC";` inside
  `triggerFallbackCascade`, never reassigned. ESLint still flags it:
  `'shipmentEquipment' is never reassigned. Use 'const' instead  prefer-const`.

Also note: total warning count went from 149 (original audit) to 162 — more unused-var/unused-
import warnings now than before, not fewer. Not a regression claim was made either way, but worth
flagging since Wave 3 item 19 names "bulk-clean 149 unused-icon-import warnings" as still-open
work, and the number moved the wrong direction.

---

## Summary table

| Item | Claimed | Actual | Verdict |
|---|---|---|---|
| `npx vitest run` 26/26 | 100% passing | Ran it: 8/8 files, 26/26 tests passing, genuine fixes (not gamed) | **FIXED** |
| `npx tsc --noEmit` 0 errors | 0 errors | Ran it: exit 1, 2 real errors in `.next/dev/types/validator.ts` from `api/documents/[id]/attach` and `.../parse` route handler signatures | **NOT FIXED** |
| P0-1 cross-tenant Server Component leak | Fixed | All 8 pages verified: real `getAccountContext()` (Clerk + DB-backed) + `runWithAccountId` + `hasPermission("tms.access")` gate | **FIXED** |
| P0-3 `dummyContext`/`acc_tms_01` | Fixed (all 5 files) | Gone from `page.tsx`, `AccountSwitcher.tsx`; still literally present (dormant/dead-code fallback) in `TmsSidebar.tsx`, `orchestrator.ts`, `tools.ts` (7 occurrences total) | **PARTIALLY FIXED** |
| P0-5 `tsconfig.json` includes `tests/` | Added | Read the file: `tests/**/*.ts` is absent, `include` array unchanged from original finding | **NOT FIXED** |
| P1-2 ESLint `prefer-const` (2 errors) | — | `quoteService.ts` fixed; `tenderService.ts:267` still errors | **PARTIALLY FIXED** (1 of 2) |

## Commands run (for reproducibility)

```
cd apps/tms && npx vitest run                 # 8 passed (8) / 26 passed (26)
cd apps/tms && npx tsc --noEmit; echo $?      # exit 1, 2 errors
cd apps/tms && npx eslint .                   # 163 problems (1 error, 162 warnings)
grep -rln "dummyContext\|acc_tms_01" apps/tms/src
```

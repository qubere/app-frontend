# PR #100 — Work Management: review & production-readiness

**Branch:** `feat/work-management-engine` · **Base:** `main` · reviewed 2026-08-29
**Scope claimed:** Slices 1–5 of `docs/plans/features/WORK-MANAGEMENT.md` — stage
orchestration, stage-gate policy + admin UI, routed queue + assignment, SLA
clocks + escalation, circuit breaker.

## Verdict

The PR delivers the **schema, HTTP endpoints, admin panels, and engine
functions** for all five slices. It does **not** deliver the autonomous
behaviour: the engine, circuit breaker, auto-router and SLA sweep are written
but **never invoked** by anything in the pipeline, and the shipped schema had
**no migration**. As-is, none of the six demo workflows in the requirements doc
runs end to end on a deployed environment. This is a strong scaffold that needs
a wiring pass before it is demoable or shippable.

Fixes applied on this branch during review are marked **[fixed]** — the P0
security/data-integrity holes and every self-contained P1/P2 correctness bug.
What remains (the "Still open" list) is the pipeline wiring that makes the
feature actually autonomous; it needs integration points outside this diff and
is best done as a follow-up PR.

---

## P0 — blockers

### 1. Schema shipped with no migration — **[fixed]**
`packages/db/prisma/schema.prisma` adds ~145 lines (6 models, 23 columns) but
`packages/db/prisma/migrations/` is untouched. `prisma migrate deploy` creates
none of it; every `db.shipmentStageHistory.*`, `db.stageGatePolicy.*`,
`db.escalationRule.*` call 500s against a real database.
**Fix:** hand-authored `20260829180000_work_management/migration.sql` from the
schema diff (same approach PR #97 used). Regenerate against a shadow DB before
CI relies on it; if the demo DB already has the objects via `db push`, use
`prisma migrate resolve --applied` instead of `deploy`.

### 2. `/api/cron/sla-sweep` is unauthenticated and sweeps all accounts — **[fixed]**
The route used `getAccountContext()`, then called `runSlaSweep(undefined)` —
which iterates **every account**, writing `EscalationEvent` rows and firing
notifications — with **no auth**, and exposed it on **`GET`** (a mutating GET,
triggerable by any crawler/prefetch). Every other cron in the repo uses
`withCronRoute` (CRON_SECRET bearer, no fallback).
**Fix:** rewritten with `withCronRoute`, `GET` only, no unauthenticated path.
Added `qubere-sla-sweep` (`*/15 * * * *`) to `infrastructure/gcp/configure-scheduler.sh`.

### 3. The stage engine is never triggered
`evaluateAndAdvanceShipmentStage()` is only called from the three `/stage/*`
HTTP routes (i.e. only when a human clicks). Nothing emits a "re-evaluate this
shipment" signal when an `AgentDecision` is approved/auto-verified or an
`ExceptionItem` resolves. The requirements specced an Inngest
`shipment.stage.advance` function subscribed to those events — it does not
exist. **Result: "autonomous stage advancement" is not autonomous.**
**Follow-up:** add the Inngest function + emit its event from the decision
approve/bulk paths and the exception resolve/bulk paths.

### 4. Circuit breaker is dead code
`recordStageFailureAndCheckBreaker()` is exported and never imported anywhere.
No code path records a `PipelineStageRun` or trips the breaker. WF-6 cannot
happen. **Follow-up:** call it from the agent-execution failure handler for
stage-scoped agents.

### 5. SLA due dates are never set
Nothing writes `AgentDecision.reviewSlaDueAt` or `ExceptionItem.slaDueAt` on
creation — there is no `SlaPolicy` lookup at item-creation time. So even with
the sweep wired, `reviewSlaDueAt` is always null and no breach is ever
detected. **Follow-up:** compute due dates from `SlaPolicy` when a NEEDS_REVIEW
decision / Open exception is created (and backfill on policy change).

### 6. Auto-routing is never called
`computeAutoAssignment()` (autoRoute.ts) is never imported. New work items are
always created unassigned; WF-4's "client-assigned items are already routed"
premise fails. **Follow-up:** call it at item creation, same hook as #5.

---

## P1 — correctness / security

### 8b. Filings & documents ignored the scope filter — **[fixed]**
`scopeFilter` was applied to decisions and exceptions only, so `scope=mine`
still returned every filing/document for the account. **Fix:** a person-scoped
view (`mine` / `team` / `unassigned`) now excludes filings and documents
(`take: 0`) — they carry no assignee. They still appear in `all` / no-scope.

### 7. Queue scope tabs are cosmetic
`ActionsClient.tsx` adds My / Team / Unassigned / All tabs, but `scopeTab` is
only used for button styling. `page.tsx` renders from
`loadWorkQueueForAccountFromPrefetched` and never re-fetches, so switching tabs
does nothing except toggle the legacy `assignedToMe` flag — Team, Unassigned
and All behave identically. The new `scope` param on
`loadWorkQueueForAccount` / `GET /api/actions` is real but unreachable from the
page. **Follow-up:** make the tabs drive a client fetch of
`/api/actions?scope=…`, or pass `scope` into the server component via
`searchParams`.

### 8. `filings` and `documents` ignore the scope filter
In `loadWorkQueueForAccount`, `scopeFilter` is applied to decisions and
exceptions only. `scope=mine` still returns every filing and document for the
account, so "My queue" is polluted. Decide whether those kinds belong in a
personal queue at all; if yes, they need an ownership concept.

### 9. "TEAM_MANAGER" resolved to an arbitrary member — **[fixed]**
Both `slaSweepJob.resolveEscalationUser()` and the manual `escalate` route did
`accountMembership.findFirst({ where: { accountId, status: "ACTIVE" } })` —
whichever active member the DB returns first, not a manager. Escalations could
land on a junior reviewer or the requester.
**Fix:** query `AccountTeamMembership` where `role = "MANAGER"`, fall back to
the account owner.

### 10. Stage override gated on account tier — **[fixed]**
`/stage/override` allowed the action if `context.accountType === "ENTERPRISE"`,
i.e. **every user in an enterprise account** could push a shipment past a human
gate. **Fix:** removed the tier clause; role check only (ADMIN / OWNER /
MANAGER).

### 11. Assignment marks `firstTouchedAt` — **[fixed]**
`/api/work/assign` set `firstTouchedAt = now` on assign. The SLA-breach query
requires `firstTouchedAt: null`, so **any assigned item could never breach** —
assigning an item silently exempted it from escalation. **Fix:** removed;
`firstTouchedAt` should be set when the assignee actually reviews.

### 12. New API routes have no permission checks — **[fixed]**
`/api/work/assign`, `/api/shipments/[id]/stage/*`, `/api/admin/settings/stage-gates`
and `.../escalation-rules` only called `getAccountContext()` — any authenticated
user, including a read-only role, could reassign others' work, approve a stage
gate, or rewrite the account's policy. `advance` in particular **defeated the
gate**: `StageGatePolicy.minimumReviewerRole` / `requireLicensedBroker` were
never enforced.
**Fix:** all routes converted to `withAuthenticatedRoute` with a permission +
`write: true`: `assign` / `advance` / `escalate` → `specialist.write`,
`stage` PATCH + `override` → `shipments.manage` (override keeps its explicit
MANAGER/ADMIN/OWNER role gate), `stage` GET → `shipments.read`, both admin PUTs
→ `settings.manage` and now write a `createAuditLog` entry. `advance` now
enforces the gate policy: `minimumReviewerRole === "MANAGER"` requires a
manager role; `requireLicensedBroker` / `LICENSED_BROKER` requires the reviewer
to have a `brokerLicenseNumber`.

### 13. New API routes skip data-mode context — **[fixed]**
`page.tsx` and the settings page wrap queries in `withDataModeContext` so
DEMO/SANDBOX accounts don't read/write the PRODUCTION partition; the new raw
routes didn't. **Fix:** `withAuthenticatedRoute` runs the handler inside
`runWithDataMode(ctx.dataMode, …)`, so converting the routes (#12) closes this
for the HTTP surface. `stageEngine.ts` / `slaSweepJob.ts` still need a
context-aware wrapper when invoked from Inngest (follow-up, tracked with #3/#4).

### 14. Stage engine has no concurrency guard
`evaluateAndAdvanceShipmentStage` reads `currentStage`, checks completion, then
writes `currentStage = next` with no transaction or conditional update. Two
concurrent triggers (two decisions approved at once) can both advance → a stage
is skipped and duplicate `ShipmentStageHistory` rows are written (no uniqueness
on `[shipmentId, stage]`). **Follow-up:** wrap in a transaction with
`update({ where: { id, currentStage: current } })` and bail on count 0.

### 15. Breaker counter is cumulative, not consecutive — **[fixed]**
`recordStageFailureAndCheckBreaker` counted **all** `PipelineStageRun` rows for
`(shipmentId, stage)` ever, and re-fired (new BREAKER_OPEN run + SYSTEM
exception + history) every time it was called after the breaker was already
open. **Fix:** it now counts only trailing consecutive `FAILED` runs (a
`SUCCEEDED` / `BREAKER_OPEN` row ends the streak), no-ops when `stageStatus` is
already `BLOCKED`, and keeps `attempt` monotonic for the unique constraint.
Added `recordStageSuccess()` to write the `SUCCEEDED` marker that resets the
streak (its caller is part of the #4 follow-up).

### 16. Stale approved gate decision auto-passes on re-entry — **[fixed]**
If a shipment was overridden back to a HUMAN_GATE stage (or the breaker reset),
the old Approved "Stage Gate" decision from the previous pass was still found
and the engine advanced with **no fresh review**. **Fix:** the gate lookup now
filters `createdAt >= shipment.stageEnteredAt` — only a decision raised during
the current visit to the stage counts, and both the override and advance paths
set `stageEnteredAt` on (re-)entry.

### 17. Escalation cadence ignores `thresholdHours` after level 1 — **[fixed]**
The sweep escalated any candidate with `escalationLevel < maxLevel` on every
run, so a 15-min sweep walked an item to `maxLevel` within ~30 min regardless
of `thresholdHours`. **Fix:** both candidate queries now also require
`escalatedAt IS NULL OR escalatedAt <= now - thresholdHours`, so successive
bumps are spaced by the configured threshold. (A `(workItemId, level)` unique
index on `EscalationEvent` is still worth adding as belt-and-braces — logged.)

---

## P2 — robustness / polish

- **`escalation-rules` PUT** unhandled-throw on cross-account id — **[fixed]**,
  now `updateMany({ where: { id, accountId } })` + count check.
- **Manual `escalate`** unbounded level — **[fixed]**, capped at
  `MAX_MANUAL_LEVEL = 2`, returns 409 when already at the ceiling.
- Pre-existing dead import `SHIPMENT_STAGES` in `stageEngine.ts` — **[fixed]**.
- **`StageGatesPanel` / `EscalationRulesPanel`** rendered prop-less inside
  `ManageAccountModal` show client-side "defaults" (COMPLIANCE = HUMAN_GATE)
  that don't exist as rows — looks configured when it isn't. The modal also
  renders the panels *and* a link to the full settings page (redundant).
- **`buildStageCheckContext`** treats a decision as "complete" if
  `triageState NOT IN (BLOCKED, REJECTED)` — a decision still in `NEEDS_REVIEW`
  counts as satisfying the stage. Confirm that's intended (stage completion vs.
  decision approval).
- **`seed-multileg-demo.ts` / `MULTI-LEG-SHIPMENTS.md`** (~1,240 lines) and the
  `infrastructure/gcp/*` changes are unrelated to Work Management and inflate
  the diff — consider splitting.
- No tests were added for any of the five slices. The requirements and F04
  precedent call for Vitest coverage on the engine, the auto-approval/gate
  interaction, bulk assign partial-success, and waive-reason validation.

---

## Fixes applied on this branch

| # | Area | Change |
|---|---|---|
| 1 | migration | hand-authored `20260829180000_work_management/migration.sql` for the whole schema diff; `@@index([assignedToUserId])` on `AgentDecision` |
| 2 | cron auth | `sla-sweep` → `withCronRoute`, GET-only; `qubere-sla-sweep` (`*/15`) added to `configure-scheduler.sh` |
| 8b | queue | filings/documents excluded from person-scoped views |
| 9 | escalation target | `TEAM_MANAGER` → real `AccountTeamMembership` MANAGER + owner fallback, in `slaSweepJob` and the manual `escalate` route |
| 10 | override auth | drop `accountType === "ENTERPRISE"` bypass |
| 11 | SLA | stop marking `firstTouchedAt` on assignment |
| 12 | route auth | `work/assign`, `stage/*`, `stage-gates`, `escalation-rules` → `withAuthenticatedRoute` + permission + audit log; `advance` enforces `minimumReviewerRole` / `requireLicensedBroker` |
| 13 | data-mode | closed for the HTTP surface via #12 (`withAuthenticatedRoute` runs in `runWithDataMode`) |
| 15 | breaker | consecutive-failure count, no-op when already BLOCKED; `recordStageSuccess()` added |
| 16 | stale gate | gate lookup scoped to `createdAt >= stageEnteredAt` |
| 17 | escalation cadence | successive bumps spaced by `thresholdHours` |
| P2 | robustness | `escalation-rules` PUT `updateMany` + count; `escalate` level ceiling; dead-import cleanup |

`tsc --noEmit` on `apps/custom` passes with all changes applied.

## Still open — follow-up PR (feature not wired to the pipeline)

These are why the PR isn't demoable yet; each needs integration points outside
the WM diff, and #3 needs a design call on the trigger surface.

1. **Item-creation hook** — set `reviewSlaDueAt`/`slaDueAt` from `SlaPolicy` and
   call `computeAutoAssignment` when a NEEDS_REVIEW decision / Open exception is
   created (#5, #6).
2. **Inngest `shipment.stage.advance`** — subscribe to decision-approved /
   exception-resolved events and call the engine; add the transaction +
   conditional-update concurrency guard (#3, #14).
3. **Breaker invocation** — call `recordStageFailureAndCheckBreaker` /
   `recordStageSuccess` from the stage-agent execution path (#4).
4. **Register `runSlaSweep`** as an Inngest cron step, paged per account, in a
   data-mode-aware context (#3/#13 tail).
5. **Queue scope tabs** — make `ActionsClient` fetch `/api/actions?scope=…`
   instead of only restyling buttons (#7).
6. **Tests** for the engine, gate/role interaction, bulk assign partial
   success, escalation cadence.

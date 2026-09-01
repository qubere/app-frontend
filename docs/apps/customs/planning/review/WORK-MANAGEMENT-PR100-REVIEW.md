# PR #100 — Work Management: review & production-readiness

**Branch:** `feat/work-management-engine` · **Base:** `main` · reviewed 2026-08-29
**Scope claimed:** Slices 1–5 of `docs/plans/features/WORK-MANAGEMENT.md` — stage
orchestration, stage-gate policy + admin UI, routed queue + assignment, SLA
clocks + escalation, circuit breaker.

## Verdict

The PR as opened delivered the **schema, HTTP endpoints, admin panels, and
engine functions** for all five slices, but the autonomous behaviour was never
wired in (engine/breaker/auto-router/SLA-sweep were dead code) and the schema
shipped with **no migration**.

Two passes on this branch have closed that:

- **Pass 1** — the P0 security/data-integrity holes (missing migration,
  unauthenticated all-account cron) and every self-contained P1/P2 correctness
  bug (route auth, gate-role enforcement, escalation targeting, breaker
  counting, SLA exemption, stale-gate, cadence). All marked **[fixed]** below.
- **Pass 2** — the pipeline wiring, so all six demo workflows run end to end.
  Summarised in "Pipeline wiring — now done"; step-by-step in
  `WORK-MANAGEMENT-PR100-DEMO.md`.

`tsc --noEmit` and `eslint` pass on `apps/custom` with everything applied. What
is left ("Still open — genuine follow-up") is a concurrency guard, one index,
tests, and licensed-broker sign-off on the gate defaults.

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

## Pipeline wiring — now done (second pass)

The feature is now demoable end to end. See
`WORK-MANAGEMENT-PR100-DEMO.md` for the runbook.

| # | Wired | How |
|---|---|---|
| 5 | SLA due-date on creation | `createAgentDecision` / `createExceptionItem` → new `modules/work/workItemLifecycle.ts` (`SlaPolicy` lookup + built-in defaults) |
| 6 | Auto-route on creation | same hook → `computeAutoAssignment` (client owner / team) |
| 3 | Engine trigger | `PipelineOrchestrator.processEvent` calls `evaluateAndAdvanceShipmentStage` after reconcile; also from `/api/decisions/bulk` (on approve) and `/api/exceptions/[id]` + `/exceptions/bulk` (on resolve) |
| 4 | Breaker invocation | orchestrator per-agent loop → `recordStageFailureAndCheckBreaker` on FAILED, `recordStageSuccess` on COMPLETED, keyed by `stageForAgent()` |
| 4 | Demo/diagnostic | `POST /api/shipments/[id]/stage/simulate-failure` (manager-only) |
| — | Engine first-touch | persists `INITIAL_STAGE` + `stageEnteredAt` + history on first evaluation |
| — | Stage/agent name mismatch | `stages.ts` CLASSIFICATION now matches the persisted `"HTS Classification Agent"` (it was `"Classification Agent"` — the pipeline could **never** clear that stage) |
| — | Stage-complete semantics | `buildStageCheckContext` now counts an agent done only at `AUTO_VERIFIED` / `APPROVED` / `COMPLETED`, not while a decision is still `NEEDS_REVIEW` |
| 4b | SLA sweep registered | `qubere-sla-sweep` cron (`*/15`) **and** `work-sla-sweep` Inngest fn (per-account, `runWithAccountId`); `POST /api/admin/work/run-sla-sweep` for an account-scoped manual run |
| 7 | Queue scope tabs | `?scope=` is server-applied in `page.tsx`; tabs re-navigate |
| — | Demo seed | `apps/custom/scripts/seed-work-management-demo.ts` — idempotent, stages 4 shipments across all 6 workflows |

## Still open — genuine follow-up

1. **Concurrency guard** (#14) — the engine still reads-then-writes `currentStage`
   without a transaction. Low risk at demo scale; wrap in a tx with
   `update({ where: { id, currentStage: current } })` before high traffic.
2. **`EscalationEvent (workItemId, level)` unique index** (#17 belt-and-braces).
3. **Tests** — engine advance/gate/role, breaker consecutive-count, bulk assign
   partial success, SLA cadence, `workItemLifecycle` defaults.
4. **Real broker sign-off** on which stages gate for which entry types
   (`StageGatePolicy.entryType`) and the SLA default hours.

# Work Management (PR #100) — demo runbook

Six workflows, end to end. Setup is one migration + one seed script; then each
workflow is a short click-path in the app.

---

## Setup (once)

```bash
# 1. Apply the schema. On a fresh DB:
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
#    On the demo DB where the tables already exist from `db push`:
#    npx prisma migrate resolve --applied 20260829180000_work_management --schema packages/db/prisma/schema.prisma

# 2. Regenerate the client if needed
npx prisma generate --schema packages/db/prisma/schema.prisma

# 3. Seed the demo state (idempotent — safe to re-run). Optional account-name arg.
npx tsx apps/custom/scripts/seed-work-management-demo.ts "ABC Customs Brokers"
```

The seed prints the four shipment numbers it staged (referred to below as
**S1–S4**) and which user is the licensed broker / team manager.

What the seed configures:

| Thing | Value |
|---|---|
| Stage gate | `COMPLIANCE` → **HUMAN_GATE**, min role **LICENSED_BROKER** |
| SLA policy | decision 4 / 12 / 48 h · exception 6 / 18 / 72 h (by priority) |
| Escalation rule | SLA breach + 2 h → **team manager**, in-app + email |
| Team | "Brokerage Ops", account owner = **MANAGER** |

---

## WF-1 · Triage the routed queue

*Built already — no setup beyond login.*

1. Open **/app/actions**. Land on **My queue**.
2. The list is ranked by deadline × declared value × blocking — the sort is the
   score, no number shown.
3. Each row now carries an **SLA chip** (`4h left` / `due soon` / `breached`) and,
   where assigned, an **assignee**.

---

## WF-2 · Auto-approval policy, tuned live

*Built already.*

1. **/app/actions** → CONFIRM bucket → a high-confidence classification shows
   the robot icon and *"Auto-verified by policy…"* (not "Approved").
2. **/app/admin/settings** → Agent Policies → raise HTS Classification's AUTO
   threshold above the decision's confidence → Save.
3. Re-run that agent on a fresh shipment → the decision now lands in CONFIRM as a
   one-click human confirm.

---

## WF-3 · Autonomous stage advancement + human gate

**Path A — approve a review, watch it cascade (S2):**

1. Open **S2** (`/app/shipments/<S2>`). The stepper shows **Valuation · in progress**;
   Document Intake → Classification are green.
2. Go to **/app/actions**, find S2's *"Assist (tooling) allocation needs review"*
   decision, **Approve** it.
3. Reload S2's stepper: Valuation → Origin → Compliance all completed
   automatically, and **Compliance is now amber — "Gate pending"**. A
   *"Stage Gate"* review card was created.

**Path B — clear the gate (S1):**

1. Open **S1** — stepper already at **Compliance · Gate pending**.
2. The *"Stage Gate"* card is in the **licensed broker's** My queue
   (the seed assigned it). Log in as that user.
3. Open it → **Approve advancement**. (Try it as a non-broker first — 403,
   *"requires a licensed customs broker"*.)
4. S1's stepper advances to **Filing Prep → Ready to File**; history shows
   *GATE_APPROVED by <broker>*.

---

## WF-4 · Assignment & the unassigned worklist

1. **/app/actions** → **Unassigned** tab. S4's three classification reviews are
   there (no owner).
2. Multi-select them → bulk toolbar → **Assign… → <a teammate>**.
3. They leave Unassigned; the assignee gets one notification and their **My
   queue** count goes up by three.
4. Note S2's work is *not* in Unassigned — it auto-routed to the owner on
   creation (S2's client is assigned to them).

---

## WF-5 · Escalation after SLA breach

1. S4's three reviews were seeded with an SLA due date **4 h in the past**,
   unassigned.
2. Trigger the sweep for this account:
   ```bash
   curl -XPOST https://<host>/api/admin/work/run-sla-sweep -H "cookie: <session>"
   ```
   (or wait for the `*/15` `qubere-sla-sweep` cron / `work/sla.sweep.requested`
   Inngest event).
3. Response: `breachedDecisions: 3, escalationsCreated: 3`.
4. The **team manager's** My queue now shows those three items with an
   **escalation badge**; `EscalationEvent` rows appear in
   **/app/admin/settings → Escalation rules → Recent escalations**.

---

## WF-6 · Circuit breaker

1. Open **S3** — stepper shows **Valuation · Blocked** (red) with the failure
   reason; a **SYSTEM exception** (*"Valuation stage failed 3×"*) is in the queue,
   blocking.
2. In `PipelineStageRun` there are two `FAILED` rows and one `BREAKER_OPEN` — no
   further retries happen.
3. As a manager, from the stepper hit **Reset & retry** (→ `POST /stage/override`
   with `resetBreaker: true`). Stage returns to `IN_PROGRESS`, history logs
   *BREAKER_RESET*, and the pipeline can resume.

To show the breaker *tripping* live: `POST /api/shipments/<id>/stage/simulate-failure`
three times against a healthy shipment.

---

## How it works in production (not just the demo)

| Trigger | Effect |
|---|---|
| `PipelineOrchestrator` finishes a run | re-evaluates the shipment's stage (auto-advance or raise a gate); records per-stage success/failure for the breaker |
| Decision approved (`/api/decisions/bulk`) or exception resolved | re-evaluates the affected shipment's stage |
| `createAgentDecision` / `createExceptionItem` | stamps the SLA due date from `SlaPolicy`, auto-routes to the client owner |
| `qubere-sla-sweep` cron (`*/15`) + `work-sla-sweep` Inngest fn | marks SLA breaches, runs escalation rules, notifies |
| 3 consecutive stage-agent failures | breaker opens, shipment BLOCKED, SYSTEM exception raised |

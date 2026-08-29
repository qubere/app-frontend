# Work Management — sales demo guide

**One-liner:** Qubere runs the brokerage's day for them — every shipment walks
itself down the compliance pipeline, stops only where a licensed human is
required, and the work that does need a person is routed, clocked, and escalated
so nothing sits past its filing deadline.

**Who to sell it to:** operations managers and licensed brokers at multi-person
brokerage teams. Solo operators get value too, but the routing/escalation story
lands hardest where 3+ people share a queue.

**Full click-by-click script:** `docs/plans/review/WORK-MANAGEMENT-PR100-DEMO.md`
(6 workflows, ~10 min).

---

## Feature → benefit → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Routed work queue** | One prioritized list instead of a dozen inboxes. Ranked automatically by filing deadline, dollars at risk, and whether the item blocks other work — so the highest-stakes entry is always on top. | `/app/actions`. Point out the top row: "files in 6h · $180k declared value · blocks 2 downstream steps." No manual triage — the sort *is* the priority. |
| **My / Team / Unassigned views** | Reviewers see only their work; a lead sees what nobody owns yet and hands it out. No two people double-handling the same entry. | `/app/actions` → tab bar: **My queue · Team queue · Unassigned · All**. Switch to **Unassigned**, multi-select, **Assign → teammate**. Assignee gets one notification. |
| **Client auto-routing** | Work on a client's shipments lands automatically with the broker who owns that account — no daily divvying up. | Show a shipment for an assigned client: its review is already assigned on arrival ("routed by client"). |
| **Autonomous stage advancement** | A shipment moves itself through Document Intake → Classification → Valuation → Origin → Compliance → Filing Prep with no one clicking "next." Staff touch it only when a decision genuinely needs a human. | Open a shipment → the **stage stepper** at the top. Approve one pending review in `/app/actions` → reload → the shipment has advanced two stages on its own. |
| **Human approval gates** | The brokerage decides exactly where a licensed person must sign off before a shipment proceeds — e.g. always pause at Compliance for AD/CVD or PGA exposure. Configurable per stage and per entry type. | `/app/admin/settings` → **Stage Gates**: set Compliance = "Human gate, Licensed Broker." Then show a shipment stopped at **Compliance · Gate pending** with a review card assigned to the broker. Try to approve as a non-broker → blocked. |
| **Visual stage stepper** | Anyone — including the customer's client — can see at a glance where an entry is and what it's waiting on. | Shipment page → click any stage in the stepper → drawer lists the exact decisions and exceptions still open for that stage. |
| **Auto-approval policy engine** | The brokerage dials in how much the AI may clear on its own: a confidence threshold per agent, plus a rule that a part-master match must agree. Everything above the line is auto-verified (and still fully audited); everything below waits for a person. | `/app/admin/settings` → **Agent Policies**. Drag HTS Classification's threshold from 85% → 95%, save, re-run — the same decision now needs a human confirm. |
| **SLA clocks** | Every review gets a due time based on its priority. Staff and managers can see what's on time, due soon, or breached — before a deadline is actually missed. | `/app/actions` — each row shows an SLA chip: `4h left` / `due soon` / `breached +2h`. |
| **Escalation after breach** | An untouched, unassigned high-value item surfaces to the team manager automatically after a set number of hours — with email + in-app alert. Nothing important sits unowned. | `/app/admin/settings` → **Escalation Rules**: "SLA breach + 2h → team manager, email + in-app." Trigger the sweep → the item jumps to the manager's queue with an "Escalated" badge; the event is logged under **Recent escalations**. |
| **Exception workbench** | Missing documents, data conflicts, and validation failures land in one place with structured resolution reasons — so "why was this waived" is always answerable. Resolve or waive one at a time or in bulk. | `/app/actions` → EXCEPTIONS section → click a row for the slide-over (history, notes, reason picklist). Multi-select → bulk resolve with a reason code. |
| **Circuit breaker** | If a step keeps failing, the system stops retrying, flags the shipment for a human, and tells them why — instead of silently looping or losing the entry. | Open the seeded blocked shipment → stepper shows **Valuation · Blocked** with the failure reason and a critical "manual review required" exception. Manager clicks **Reset & retry**. |
| **Full audit trail & provenance** | Every advance, approval, auto-verification, assignment, and escalation is recorded with who, when, and under which policy version — ready for a CBP audit or a client question. | Shipment page → stage history ("Gate approved by Sarah Chen, License #12345, Aug 29"). Decision cards show "Auto-verified by policy hts-v3 at 94%." Admin changes appear in the settings audit log. |

---

## Talking points

- **"It's not a chatbot bolted onto a spreadsheet."** The pipeline, the gates,
  the SLAs, and the escalations are the product — the AI does the analysis
  inside each stage, the workflow engine moves the entry.
- **The brokerage stays in control.** Auto-approval thresholds, which stages
  gate, minimum reviewer role, SLA hours, escalation targets — all
  self-service in Settings, no deployment.
- **Licensed-broker oversight is enforced, not suggested.** A stage gate set to
  "Licensed Broker" cannot be cleared by anyone else, and it's on the record.
- **Scales with the team.** A solo operator runs off one shared list; add
  people and the same data becomes a routed, escalated workqueue with no
  reconfiguration.

## Setup before a live demo

```bash
npx tsx apps/custom/scripts/seed-work-management-demo.ts "<account name>"
```

Idempotent — stages four shipments so every row in the table above has
something to click. Details in the runbook.

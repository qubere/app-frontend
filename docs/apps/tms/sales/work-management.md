# Work Management — sales demo guide

> This is the canonical category doc. For the full click-by-click script (6
> workflows, ~10 min) see [WORK-MANAGEMENT-SALES-DEMO.md](WORK-MANAGEMENT-SALES-DEMO.md)
> and `docs/plans/review/WORK-MANAGEMENT-PR100-DEMO.md`.

**One-liner:** Qubere runs the brokerage's day for them — every shipment walks
itself down the compliance pipeline (Document Intake → Classification → Valuation
→ Origin → Compliance → Filing Prep), stops only where a licensed human is
genuinely required, and the work that does need a person is routed, SLA-clocked,
and escalated so nothing sits past its filing deadline.

**Who to sell it to:** operations managers and licensed brokers at multi-person
brokerage teams. Solo operators get value too, but the routing/escalation story
lands hardest where 3+ people share a queue. For **enterprise self-filers**, the
angle is the same engine with the human gates set to their internal controls.

---

## The problem, in the customer's words

- "Work lives in a dozen inboxes. Every morning someone spends an hour deciding
  who does what."
- "We missed an ISF deadline last quarter because the entry was sitting in
  someone's queue and nobody knew."
- "The AI tools we've looked at are a smarter classifier. They don't actually
  *move* the file — a person still babysits every step."
- "Two people worked the same entry last week. Neither knew the other was on it."
- "When something's stuck, I find out when the client calls."
- "I can't tell you right now which of my open entries are past due and which are
  about to be."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Routed work queue** | One prioritized list instead of a dozen inboxes. Ranked automatically by filing deadline, dollars at risk, and whether the item blocks other work — the highest-stakes entry is always on top. | `/app/actions`. Point at the top row: *"files in 6h · $180k declared value · blocks 2 downstream steps."* The sort *is* the triage. |
| **My / Team / Unassigned / All views** | Reviewers see only their work; a lead sees what nobody owns yet and hands it out. No two people double-handling one entry. | `/app/actions` tab bar. Switch to **Unassigned**, multi-select, **Assign → teammate**. Assignee gets one notification. |
| **Client auto-routing** | Work on a client's shipments lands automatically with the broker who owns that account — no daily divvying up. | Open a shipment for an assigned client: its review is already assigned on arrival ("routed by client"). |
| **Autonomous stage advancement** | A shipment moves itself through the pipeline with no one clicking "next." Staff touch it only when a decision genuinely needs a human. | Open a shipment → the **stage stepper**. Approve one pending review in `/app/actions` → reload → the shipment has advanced two stages on its own. |
| **Human approval gates** | The brokerage decides exactly where a licensed person must sign off — e.g. always pause at Compliance for AD/CVD or PGA exposure. Configurable per stage and per entry type, minimum reviewer role enforced. | `/app/admin/settings` → **Stage Gates**: set Compliance = "Human gate, Licensed Broker." Show a shipment stopped at **Compliance · Gate pending**. Try to approve as a non-broker → blocked. |
| **Auto-approval policy engine** | Dial in how much the AI may clear on its own: a confidence threshold per agent, plus a rule that a part-master match must agree. Above the line is auto-verified (fully audited); below waits for a person. | `/app/admin/settings` → **Agent Policies**. Drag HTS Classification 85% → 95%, save, re-run — the same decision now needs a human confirm. |
| **Visual stage stepper** | Anyone — including the customer's client — can see at a glance where an entry is and what it's waiting on. | Shipment page → click any stage → drawer lists the exact decisions and exceptions still open for that stage. |
| **SLA clocks** | Every review gets a due time from its priority. Staff and managers see what's on time, due soon, or breached — before a deadline is missed. | `/app/actions` — each row shows an SLA chip: `4h left` / `due soon` / `breached +2h`. |
| **Escalation after breach** | An untouched, unassigned high-value item surfaces to the team manager automatically after a set number of hours, with email + in-app alert. | `/app/admin/settings` → **Escalation Rules**: "SLA breach + 2h → team manager." Trigger the sweep → the item jumps to the manager's queue with an "Escalated" badge, logged under **Recent escalations**. |
| **Exception workbench** | Missing documents, data conflicts, and validation failures land in one place with structured resolution reasons — so "why was this waived" is always answerable. Resolve/waive one at a time or in bulk. | `/app/actions` or `/app/exceptions` → click a row for the slide-over (history, notes, reason picklist). Multi-select → bulk resolve with a reason code. |
| **Circuit breaker** | If a step keeps failing, the system stops retrying, flags the shipment for a human, and says why — instead of silently looping. | Open the seeded blocked shipment → stepper shows **Valuation · Blocked** with the failure reason and a critical exception. Manager clicks **Reset & retry**. |
| **Command Center** | The manager's one screen: unassigned count, overdue, value at risk, broker workload, quality trends, filing-status funnel. | `/app/dashboard`. Walk the tiles. Note the value-at-risk figure — it's the same one Ask Qubere returns. |
| **Full audit trail & provenance** | Every advance, approval, auto-verification, assignment, and escalation recorded with who, when, and under which policy version — ready for a CBP audit or a client question. | Shipment stage history: *"Gate approved by Sarah Chen, License #12345, Aug 29."* Decision cards: *"Auto-verified by policy hts-v3 at 94%."* |

---

## Talking points

- **"It's not a chatbot bolted onto a spreadsheet."** The pipeline, the gates,
  the SLAs, and the escalations *are* the product — the AI does the analysis
  inside each stage; the workflow engine moves the entry.
- **"The brokerage stays in control."** Auto-approval thresholds, which stages
  gate, minimum reviewer role, SLA hours, escalation targets — all self-service
  in Settings, no deployment.
- **"Licensed-broker oversight is enforced, not suggested."** A stage gate set to
  "Licensed Broker" cannot be cleared by anyone else, and it's on the record.
- **"Scales with the team."** A solo operator runs off one shared list; add
  people and the same data becomes a routed, escalated workqueue with no
  reconfiguration.

## Objection handling

- **"Does it actually file, or just tell my staff what to do?"** It advances the
  shipment autonomously through analysis stages and produces the validated entry
  (see [customs-filing.md](customs-filing.md)); the human gates are where *you*
  decide a licensed person signs off. Live CBP transmission activates with ABI
  filer credentials.
- **"What if the AI auto-approves something wrong?"** Every auto-verification is
  logged with the policy version and confidence, and is reversible. You set the
  threshold; start conservative (95%+) and loosen it as you trust it. Nothing
  auto-approves below your line.
- **"We have our own workflow / TMS."** Qubere's queue is driven by customs
  readiness and filing deadlines specifically — it's not a generic task tracker.
  It complements a TMS; the [Freight Execution TMS](freight-execution-tms.md) is
  the same engine for the movement side if they want both.

## Demo setup

```bash
npx tsx apps/custom/scripts/seed-work-management-demo.ts "<account name>"
```

Idempotent — stages four shipments so every row in the table above has something
to click (one ready, one gated, one breached/escalated, one circuit-broken). Use
`admin@qubere.ai` or `joe@target.com`; have a second login (`sarah@target.com`)
ready to demo the role-gated approval.

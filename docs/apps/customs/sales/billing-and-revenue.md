# Billing & Revenue Intelligence — sales demo guide

> Canonical category doc. Deep-dive companions: [Billing.md](Billing.md)
> (pitch / talk track / objections) and
> [BILLING-QE-PM-SALES-ASSESSMENT-AND-DEMO-PLAYBOOK.md](BILLING-QE-PM-SALES-ASSESSMENT-AND-DEMO-PLAYBOOK.md)
> (QE + PM verification detail).

**One-liner:** Every operational event in Qubere — a classification, a filing, a
document parse, a human review, a compliance screen — automatically emits a rated
usage record against a versioned, immutable-once-activated rate card, so a broker
can trace any invoice line back to the exact work that produced it, see real
per-client margin, and be told when they're losing money *before* the quarterly
review instead of after.

**Who to sell it to:** owners and finance leads at customs brokerages. This is
the "are you actually making money on this client" conversation. Also relevant to
**enterprise** buyers evaluating a broker-services relationship or internal
chargeback.

---

## The problem, in the customer's words

- "The rate card lives in a spreadsheet. Maybe three spreadsheets. Nobody's sure
  which version was in effect for an entry that closed six weeks ago."
- "Billing is retrospective. A coordinator reconstructs 'what did we do for this
  client' from memory and email, weeks later, then keys it into QuickBooks."
- "Duty, MPF, HMF, and our service fees all flow through the same invoice lines.
  Nobody can cleanly say what we actually *earned* on a shipment."
- "A classification override, a supervisor's second review, an exception someone
  resolved by phone — none of that shows up as billable time or internal cost."
- "Restricted-party screening is real labor and real risk transfer. It's a
  checkbox in our workflow, never a line on the invoice."
- "'What would we have made at our new proposed rate for Acme over the last
  year?' is a multi-day Excel exercise nobody attempts."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Versioned rate cards** | Rate cards with a formal draft → active → retired lifecycle, immutable once activated, full version history. No more "which spreadsheet." | `/app/billing/rate-cards` → open Acme's card → version history. |
| **Live CSV rate-card import** | Import a rate card from CSV through the real import flow, map line items, activate — in minutes. Answers "how painful is onboarding" before they ask. | `/app/billing/rate-cards/import` → upload `apps/custom/public/demo/billing/acme-manufacturing-rate-card.csv` → map 2–3 items → activate. |
| **Automatic usage capture** | Every operational event emits a usage record automatically — classification, filing, document processing, human review, compliance screening. Charges appear in the ledger with nobody keying anything in. | `/app/billing/usage` → the ledger. Point at charges that came from real classification/filing work. Filter to screening events. |
| **"Why is this charge $28?"** | Click a single charge and walk the full trace: usage event → rate rule → rate card version → calculation → charge. An instant, auditable answer no spreadsheet or legacy system gives. | `/app/billing/shipments/[id]` (Shipment Economics) → click a charge → the full derivation. **This is the most differentiated moment in the demo.** |
| **Pass-through vs. broker revenue, separated** | The shipment ledger splits customs economics, broker economics, and AR into three explicit sections. Duty, MPF, HMF, taxes, and other fees are pulled from the *actual filing totals*, not estimated or zeroed. | On a shipment's Costs & Billing tab, show duty/MPF/HMF/taxes called out separately from broker revenue. |
| **Manual work is billable and costable** | Manual review and exception resolution emit their own billable/costable events, distinct from automated work — and human review carries a **real measured duration** (a live reviewer timer), so time-based rating reflects actual effort, not a guess. | Show the Human Classification Review line item tied to a real resolved exception; note the duration was measured. |
| **Compliance screening is metered** | Every restricted-party screen, embargo check, community screen, and continuous re-screen emits its own rated usage event, cross-referenced to the screening record that proves it happened. | `/app/billing/usage` → filter to screening events → click one through to its screening execution → show the matching invoice line. |
| **Revenue-leakage detection** | Automated exception detection flags unmapped rates, negative-margin clients, and unbilled work — and it's actionable, not read-only. | `/app/billing/exceptions` → resolve or waive a live exception with a reason → show the audit trail. |
| **Per-client margin** | Real margin per client, per shipment — not a blended guess. The negative-margin client is surfaced, not buried. | `/app/billing/clients/[id]` → the pre-seeded negative-margin client and the exception it produced. |
| **Adjustments on the record** | Every discount / waiver requires a reason, is tied to a user and timestamp, and lives in the charge's history forever. | Show a pre-seeded discount on a charge with its reason/approver. |
| **Real invoice approval control** | Creating a draft invoice and sending/approving it require *different* permissions — a genuine control, backed by automated cross-tenant isolation tests, not a status field. | `/app/billing/invoices/create` → draft from unbilled Acme charges. Note drafting ≠ sending. |
| **Rate simulation** | Run a proposed rate card against real historical usage without touching production data — current vs. proposed revenue and margin. The tool a team uses every renewal cycle. | `/app/billing/rate-cards/[id]/simulate` → Acme's draft v2 → run against real usage → the revenue delta. |
| **Broker / P&L reporting** | Reports by client and by broker; usage summaries; an `get_service_usage_summary` assistant tool. | `/app/billing/reports` and `/app/billing/reports/brokers`. |

---

## Talk track (short arc)

1. **Open on the pain, not the product:** *"If I asked your billing team right
   now why a specific invoice line is $28, how long to answer with confidence?
   And can you tell me off the top of your head which clients you're losing money
   on?"* Most brokers can't answer either.
2. **"Here's why this charge is what it is."** The full trace on one charge.
3. **"Your rate card, live, in five minutes."** The CSV import.
4. **"Billing that doesn't wait for someone to remember to do it."** The usage
   ledger.
5. **"We'll tell you when you're losing money, not your quarterly review."** The
   negative-margin client + exception, resolved live.
6. **"Every screen you run is a line item."** (compliance-heavy prospects) The
   screening usage filter → screening execution → invoice line.
7. **"What if we raised this rate?"** The simulation — pivot to the
   renewal/expansion conversation.

## Objection handling

- **"Does it replace QuickBooks / our accounting system?"** No — it's the
  operational billing layer that feeds a clean, itemized, defensible invoice into
  whatever you use for AR and books. The value is that the invoice is *right and
  traceable* before it leaves Qubere.
- **"Credit notes / charge disputes?"** A formal credit-note / dispute workflow
  is **not built yet** — the `DISPUTED` / `CREDITED` states exist but aren't
  wired end-to-end. Adjustments-with-reason on a charge are the current
  mechanism. Be honest about this; it's the one real gap.
- **"How do you know the usage numbers are right?"** Cross-tenant billing
  isolation has automated test coverage (worth saying to a technical buyer), and
  every rated event links to the operational record that generated it — you can
  always click through to the proof.
- **"We bill flat per entry."** Fine — model that as your rate card. The point
  isn't per-capability pricing, it's that you can *see* the cost and margin
  underneath whatever you charge, and catch the files where a flat fee is
  underwater.

## Demo setup

```bash
npx tsx apps/custom/scripts/setup-multirole-user.ts   # provisions Frank (multirole@qubere.ai)
npx tsx apps/custom/scripts/seed-billing-demo.ts       # rate cards, ledger, invoices, negative-margin client
```

Demo as **Frank (`multirole@qubere.ai`)** — OWNER across all accounts. Artifacts
(sample invoice PDF/CSV, rate-card CSV) are in `apps/custom/public/demo/billing/`.
For Scene 6 (screening-as-line-item), check the ledger has screening rows before
the call — if not, run a live screening against a demo party first.

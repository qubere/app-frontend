# Qubere Billing — Sales Assessment & Demo Playbook

> Compiled 2026-08-24, against `main` post-merge of [PR #78](https://github.com/qubere/app-frontend/pull/78), [#79](https://github.com/qubere/app-frontend/pull/79), [#80](https://github.com/qubere/app-frontend/pull/80). This document independently re-verified the "complete" status claimed in [BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md](../plans/review/BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md) by running the real test suite and reading the actual code paths — it is not a re-statement of that doc's claims. Findings that hold up are marked verified; anything not independently confirmed is called out explicitly rather than assumed.
>
> **Sales-relevant updates re-verified 2026-08-29** against current `main`. What changed for the pitch: (1) **compliance screening is now billed** — every restricted-party, embargo, community, and continuous-monitoring re-screen emits its own rated line item tied to the screening record (new Scene 4b); (2) human review now carries a **real measured duration**, not an estimate, so time-based charges reflect actual effort; (3) customs pass-through `taxes`/`otherFees` are pulled from the **actual filing totals**, not zeroed — the "every dollar is accounted for" claim is now defensible for the pass-through layer; (4) cross-tenant data isolation for billing now has **automated test coverage** — useful for a technical buyer asking about shared infrastructure. Not built yet: a formal credit-note / charge-dispute workflow — see Objection handling.
>
> Demo persona: **Frank (multirole@qubere.ai)** — already provisioned with OWNER access across all accounts via `apps/custom/scripts/setup-multirole-user.ts`. Demo data is seeded via `apps/custom/scripts/seed-billing-demo.ts` (see Demo data & artifacts for exact scenario data and artifact locations under `apps/custom/public/demo/billing/`).

---

## Sales Assessment: how to demo this for maximum impact

### The real-world problem, in the words a broker will recognize

Ask any mid-size customs brokerage how billing actually works today and you'll hear some version of the same story:

- **The rate card lives in a spreadsheet.** Maybe three spreadsheets, because someone updated their copy and didn't tell billing. Nobody can say with certainty which version was in effect for a shipment that closed six weeks ago.
- **Billing is retrospective, not real-time.** A billing coordinator works from completed-entry reports days or weeks after the work happened, reconstructing "what did we actually do for this client" from memory, email threads, and whatever the entry file shows — then keys it into QuickBooks, Xero, or a legacy broker management system's billing module.
- **Pass-through charges and broker revenue get commingled.** Duty, MPF, HMF, and taxes flow through the same invoice line items as the broker's own service fees in a lot of legacy systems, which means nobody can cleanly answer "what did we actually earn on this shipment" without manual rework.
- **Manual work is invisible to the P&L.** A classification override, an exception a human had to resolve by phone, a supervisor's second review — none of that shows up as billable time or as an internal cost in most shops. Brokers systematically under-recover on their most labor-intensive files and don't have the data to know it's happening.
- **Compliance work is done for free.** Restricted-party screening, embargo checks, and ongoing party monitoring are real labor and real risk-transfer — but in most shops they're a checkbox in the workflow, never a line on the invoice.
- **Revenue leakage is silent.** Work gets done — an exception resolved, a manual review completed — and never makes it onto an invoice because operations and billing are two disconnected systems (or two disconnected people). Nobody finds out until a margin review months later, if ever.
- **Discounts and waivers happen off the books.** An account manager gives a client a break on a bad week, nobody writes down why, and it silently becomes the new expected rate.
- **Rate renegotiation is a guess.** "What would we have made if we'd charged Acme our new proposed rate for the last year?" is a multi-day Excel exercise today, if anyone attempts it at all — most brokers just raise rates and hope.

**Tools brokers actually use for this today**: Excel/Google Sheets for the rate card itself; QuickBooks, Xero, or Sage bolted on for the actual invoicing, disconnected from operational systems; legacy TMS/customs platforms (CargoWise, Descartes, WiseTech/Vantage, Thomson Reuters ONESOURCE) that typically bill by raw transaction count, not by the specific capability or outcome delivered, and have no concept of AI-driven automation savings; email and phone for the manual exception work that never gets captured anywhere financial.

### How Qubere removes each friction point

| Friction today | Qubere's answer | What to click during the demo |
|---|---|---|
| Rate card lives in an ungoverned spreadsheet | Versioned, immutable-once-activated rate cards with a formal draft→active→retired lifecycle | Import the sample rate card CSV live; show version history on Acme's card |
| Billing is retrospective and manual | Every operational event emits a usage record automatically; charges appear in the ledger without anyone keying anything in | Open Acme's Shipment Economics; point out charges that came from real classification/filing work, not manual entry |
| Pass-through vs. broker revenue is commingled | The shipment ledger separates customs economics, broker economics, and AR into three explicit sections — and duty, MPF, HMF, taxes, and other fees are pulled from the actual filing totals, not estimated or zeroed | Open a shipment's Costs & Billing tab, show duty/MPF/HMF/taxes called out separately from broker revenue |
| Manual work is invisible to the P&L | Manual review and exception resolution emit their own billable/costable events, distinct from automated work — and human review carries a real measured duration (a live reviewer timer), so time-based rating reflects actual effort, not a guess | Show the Human Classification Review line item on Acme's invoice, tied to a real resolved exception; note the duration was measured, not estimated |
| Compliance work is done for free | Every restricted-party screen, embargo check, community (bulk-list) screen, and continuous party re-screen emits its own rated usage event, cross-referenced to the screening record that proves it happened | Open the Usage Ledger, filter to screening events, click one through to its screening execution; show the matching line on the invoice |
| Revenue leakage is silent | Automated exception detection flags unmapped rates, negative margins, and unbilled work — and it's now genuinely actionable, not read-only | Resolve or waive a live exception on the Exceptions page; show the audit trail it leaves |
| Discounts happen off the books | Every adjustment requires a reason, is tied to a user and timestamp, and is visible in the charge's history forever | Show the pre-seeded discount on a charge with its reason/approver; optionally add a new one live |
| Rate renegotiation is a guess | Rate simulation runs a proposed rate card against real historical usage without touching production data | Pull up Acme's draft v2 rate card, run the simulation against the last months of real usage, show the revenue delta |

### Talk track — suggested narrative arc

**Open on the pain, not the product.** *"Before I show you anything, let me ask — if I asked your billing team right now why a specific invoice line item is $28, how long would it take them to answer that with confidence? And could you tell me, off the top of your head, which of your clients you're actually losing money on?"* Most brokers can't answer either question cleanly. That's the entire pitch in two questions.

**Scene 1 — "Here's why this charge is what it is."** Open a shipment on Acme Manufacturing's ledger, click into a single charge, and walk the full trace: usage event → rate rule → rate card version → calculation → charge. This is the single most differentiated moment in the demo — no spreadsheet or legacy system gives an instant, auditable answer to "why is this $X."

**Scene 2 — "Your rate card, live, in five minutes."** Upload the seeded sample CSV (`apps/custom/public/demo/billing/`) through the real import flow, map two or three line items live, and activate. This directly answers "how painful is onboarding" before they ask.

**Scene 3 — "Billing that doesn't wait for someone to remember to do it."** Walk through the Usage Ledger and show real classification/document/filing events that automatically produced charges — no manual entry step exists in this flow, and that's the point.

**Scene 4 — "We'll tell you when you're losing money, not your quarterly review."** Show the pre-seeded negative-margin client and the open exception it produced, then resolve it live with a reason. This is where "revenue leakage detection" stops being a bullet point and becomes something they just watched happen.

**Scene 4b (for compliance-heavy prospects) — "Every screen you run is a line item."** Open the Usage Ledger and filter to screening events — restricted-party, embargo, community, continuous re-screen. Click one through to the screening execution record behind it. The point: this labor used to be invisible to billing entirely (it wrote an audit row and nothing else); now it's a rated, invoiceable event with a provable link to the work that generated it. For a broker whose value-add is increasingly "we keep you off the denied-party list," this is revenue they're currently giving away.

> **Demo prep:** as of 2026-08-29 `seed-billing-demo.ts` seeds a `COMPLIANCE_REVIEW_COMPLETED` event but not the newer per-screen events (`RPS_/EMBARGO_/COMMUNITY_/RDPS_RESCREEN_`). To demo Scene 4b with real ledger rows, extend the seed script or run a live screening against a demo shipment/party before the call — check the ledger first, don't promise the scene blind.

**Scene 5 — "Real approval, not just a status label."** Create a draft invoice from unbilled Acme charges, and be explicit that sending/approving requires a *different* permission than drafting — this is a genuine control, not UI theater (it's backed by automated tests, which is worth saying out loud if the prospect has a technical buyer in the room: "this isn't just a status field, it's enforced").

**Scene 6 — "What if we raised this rate?"** Open Acme's draft v2 rate card and run the simulation against real historical usage — show current vs. proposed revenue and margin. This is the moment to pivot toward the expansion/renewal conversation, not just the initial sale: *"this is the tool your team would use every renewal cycle, not just once at onboarding."*

**Scene 7 (if the prospect also runs freight/TMS) — "One client, one financial picture."** Show the TMS billing view alongside customs — carrier AP and customer AR presented together for the same account. Frame honestly: TMS and customs billing are two distinct ledgers by design (paying carriers vs. billing clients are genuinely different problems), but they now run on the same underlying platform and report into the same account — worth mentioning as platform direction, not overselling as fully unified today.

**Close.** *"Every number you just saw traces back to real work, in real time, with a real audit trail. Nothing you saw was a mockup — it's the same engine that would be running your books from day one."* — true and worth saying explicitly, because most SaaS demos in this space are showing configured-for-the-demo static screens, and this one genuinely isn't.

### Objection handling

- *"Our current system already does billing."* — Ask what it takes today to answer "why is this charge $X" and "which clients are unprofitable" with confidence, in under a minute. Most legacy systems bill by transaction count, not capability/outcome, and can't answer either question without manual reconstruction.
- *"How long does onboarding take?"* — Be honest per the PM assessment: rate-card import and activation is fast and demoable live; mapping commercial line items to Qubere's billing events currently benefits from someone who understands both sides, so don't pitch it as fully zero-touch self-service on the first call.
- *"Is this just for customs, or does it work for our freight/TMS side too?"* — Yes to both existing today, on a shared platform, with the honest caveat above: TMS carrier payments (AP) and customs/TMS client billing (AR) are intentionally separate ledgers, unified at the account/reporting level, not merged into one invoice type.
- *"How do you keep our billing data separate from other brokers on the same platform?"* — Every billing record is account-scoped at the query layer, and that boundary is covered by an automated regression test suite that runs on every change (34 tests across all billing models). This is a fair question for a technical buyer and the answer is concrete, not hand-wavy.
- *"Can we issue a client a credit, or dispute a charge?"* — Today: an adjustment with a required reason, an approver, and a permanent audit trail. A formal credit-note document and a structured charge-dispute workflow are on the roadmap, not built — don't demo them as working.

### Demo data & artifacts

Demo scenario data is seeded via `apps/custom/scripts/seed-billing-demo.ts` under a dedicated demo brokerage account, accessible to Frank (`multirole@qubere.ai`) via his existing all-accounts OWNER access. Downloadable/importable demo artifacts (rate-card import file, sample invoice exports) live under `apps/custom/public/demo/billing/`. Exact account name, client names, invoice-status lineup, and artifact filenames are documented in the seed script's own header comment and its run output — check there for the current exact numbers before a live demo, since seed data may be refreshed over time and this playbook's talk track intentionally references scenarios (a healthy client, an underpriced client, an open exception, a draft v2 rate card) rather than hardcoded numbers that could drift out of sync with the database.

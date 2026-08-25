# Qubere Billing — QE / PM / Sales Assessment & Demo Playbook

> Compiled 2026-08-24, against `main` post-merge of [PR #78](https://github.com/qubere/app-frontend/pull/78), [#79](https://github.com/qubere/app-frontend/pull/79), [#80](https://github.com/qubere/app-frontend/pull/80). This document independently re-verified the "complete" status claimed in [BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md](../plans/review/BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md) by running the real test suite and reading the actual code paths — it is not a re-statement of that doc's claims. Findings that hold up are marked verified; anything not independently confirmed is called out explicitly rather than assumed.
>
> Demo persona: **Frank (multirole@qubere.ai)** — already provisioned with OWNER access across all accounts via `apps/custom/scripts/setup-multirole-user.ts`. Demo data is seeded via `apps/custom/scripts/seed-billing-demo.ts` (see Part 3 for exact scenario data and artifact locations under `apps/custom/public/demo/billing/`).

---

## Part 1 — QE Assessment: what actually works, what doesn't

### Verification method

Rather than trust the prior audit's self-reported completion, this pass independently: (1) read the actual current code for the highest-risk claims, (2) ran the real automated test suite, (3) traced whether "fixed" code paths are genuinely called from live UI/operational flows or just defined and unused (the recurring failure mode found across this codebase in prior audits — a function existing is not the same as it being wired in).

### What's verified working

| Area | Verification | Result |
|---|---|---|
| Rate-rule edit data-loss bug | Read `RateRuleEditor.tsx` `startEdit()` | **Fixed** — now reads `rule.unit`/`rule.includedQuantity` from the actual rule object, no hardcoded defaults on edit |
| Exceptions page actions | Read `exceptions/actions.ts` + `exceptions/page.tsx` | **Real** — `resolveExceptionAction`/`waiveExceptionAction` exist, are wired to buttons, both audit-logged |
| Shared billing package | `ls packages/billing/src` | **Real extraction** — `ratingEngine`, `costingEngine`, `ledger`, `invoicing`, `telemetry`, `constants`, `conditionEvaluator`, `rateSimulation` all live in an importable workspace package, not app-local code anymore |
| Granular permissions | `grep -c '"billing\.'` in `permissions.ts` | **44 codes registered** (up from 18) |
| Maker-checker enforcement | Ran `billing-permission-denials.test.ts` | **8 passing tests**, parameterized across mutation actions, each asserting denial without its specific granular permission — this is a real automated regression guard now, not a manual-QA note |
| Invoice lifecycle | Ran `billing-invoice-lifecycle.test.ts` | **3 passing tests**: draft→checker-approval→sent stamps the correct actors; void unlocks charges on an unpaid invoice; voiding a paid invoice is rejected |
| Payment recording | Ran `billing-readiness.test.ts` | **Passing**: partial payment supported, overpayment rejected by the real service function (not reimplemented math) |
| Rate-card version lifecycle | Same file | **Passing**: activating a new version formally expires the prior active version (`RateCardVersion.expirationDate` — previously dead, now written) |
| Pipeline usage-event idempotency | Same file | **Passing**: "pipeline emission remains source-idempotent" — a dedicated regression test now exists for this |
| TMS platform billing | Read `apps/tms/src/lib/billingTelemetry.ts` + grepped call sites | **Real, not dead code.** `emitTmsBillingEvent()` calls the shared `@qubere/billing/telemetry` package with `productLine: "TMS"`, and is genuinely called from 4 live operational modules: `podPipeline.ts` (×2), `tenderService.ts`, `freightAuditAgent.ts` — not just defined and unused, the classic false-positive pattern from prior audits |
| `BillingProductLine` schema discriminator | Read `schema.prisma:5993-5997` | **Real** — `CUSTOMS \| TMS \| WMS` enum now exists on `UsageEvent`, `RateCard`, `RateRule`, `Invoice`, `BillingEventDefinition` |
| Full billing test suite | `npx vitest run` on all 4 billing test files | **61/61 passing** |

### Remaining gaps — QE would not sign off on these as closed

1. **No dedicated multi-tenant isolation test for billing data.** Grepped for a test asserting Account A cannot read/write Account B's `RateCard`/`Invoice`/`ShipmentCharge` — found none. The repo has an established pattern for exactly this (`tests/tenant-isolation-routes.test.ts`) that still hasn't been extended to billing models specifically, despite this being called out as the highest-priority test gap in the prior audit. App-level `accountId` scoping is present in the mutation actions spot-checked, but there's no automated regression guard proving it, and this is financial data — the one category where "looks scoped on read" isn't enough confidence for QE sign-off.
2. **Not independently re-verified**: whether `taxes`/`otherFees` in the customs pass-through ledger are still hardcoded to `$0`, whether `DISPUTED`/`CREDITED` invoice states have real code paths yet, and whether a real client-side review-duration timer now feeds `HTS_MANUAL_REVIEW_COMPLETED`'s `processingDuration` (the prior audit flagged all three as gaps; the "complete" doc claims all three are now done — this pass did not re-verify them line-by-line and flags that explicitly rather than repeating an unverified claim).
3. **CI claims not re-run**: the "complete" doc claims CI now validates fresh-DB migrations, migration replay safety, schema drift, and OpenAPI generation for billing. This pass did not execute CI directly to confirm — recommend a QE owner actually watch a CI run on the next billing PR rather than trusting the doc's description of it.
4. **"Delete data" workflows are intentionally restrictive, not broken.** There is no hard-delete path for rate cards, invoices, or charges once they exist — retiring/voiding are the only state transitions available, by design (financial records shouldn't be deletable). Flagging this so it isn't mistaken for a bug during QE exploratory testing: an operator looking for a "delete" button on an activated rate card or a sent invoice won't find one, and that's correct behavior per the spec's immutability requirement, not a gap.

### Instrumentation verdict

Usage-event emission, audit logging on mutations, and idempotency keys are real and DB-enforced (`UsageEvent.idempotencyKey` has a unique constraint). What's still missing instrumentation-wise: no test proves the *cross-tenant* boundary holds, and there's no automated alert/dashboard (outside the in-app Exceptions page) if usage-event emission silently stops from a given source — an operator would only notice via the Exceptions/Revenue Leakage views, not a proactive signal.

---

## Part 2 — PM Assessment: do we have a minimal lovable product?

### Verdict: yes, with caveats

**Yes** — a broker can today: build a real rate card, watch real operational work turn into real charges without manual entry, see a real 3-layer shipment ledger (customer charge / broker cost / margin), generate and send a real invoice, record a real payment, and explain exactly why any charge is what it is. That loop is genuinely closed and running on real logic end to end, verified by the QE pass above. This is meaningfully more than a demo shell — it's a working v1 of the core financial loop.

**With caveats** that matter for what "minimal lovable" actually means for this audience:

- **Lovable requires trust, and trust requires the maker-checker control to be real** — it now is (permission denials are tested), which is the single most important trust signal for anyone billing real money. This closes what would have been a hard no from any broker's finance lead.
- **Lovable requires visibility into what's broken**, not just what's working — the Exceptions workflow being genuinely actionable now (not just a read-only list) is what makes "revenue leakage detection" a credible pitch instead of a vanity metric.
- **Lovable does NOT yet require** cross-module (customs+TMS) financial unification to be complete — TMS emitting into the shared ledger is a real platform signal worth having in the pitch, but a first buyer evaluating customs billing alone doesn't need TMS present to say yes. Treat that as a forward-looking platform story, not a blocking gap.

### What a real-life implementation looks like

A brokerage onboarding onto this today would, realistically:

1. Import their existing rate card(s) via CSV/XLSX — this works, and is the first-touch moment that has to feel effortless (see the demo script in Part 3 for exactly this flow).
2. Map their commercial line items to Qubere's billing events — this requires someone at the brokerage who understands both their pricing and roughly what Qubere's system does; it is not a fully self-service, zero-training step today, and shouldn't be pitched as one.
3. Activate the rate card and let real operational work start accruing charges automatically as shipments move through the platform — no separate action required, which is the core "no manual billing" value prop, and it's real.
4. Within the first billing cycle, the billing team would use the Exceptions page to catch unmapped rates or negative-margin shipments before they become a client-facing invoicing mistake — this is a genuinely differentiated capability vs. anything spreadsheet- or legacy-TMS-based.
5. Generate the first invoice from accrued charges, route it through approval (a distinct person now required, not the same person who drafted it), send, and track payment.
6. After a few months of real usage history, run a rate simulation before proposing a renegotiated rate card — this is the kind of thing brokers currently do with a consultant or a manual Excel model; having it in-product is a real differentiator worth leading with in a second/expansion conversation, not necessarily the first demo.

### Where PM would push back on "ready to sell as finished"

The permission/test gaps closed in this round were the right ones to close first — they were correctness and trust issues, not feature gaps. The next priority for product, not engineering, is: the multi-tenant isolation test gap (Part 1, item 1) should close before this is pitched to a second brokerage sharing infrastructure with the first, and the `taxes`/`otherFees`/`DISPUTED`/`CREDITED` items should be explicitly re-verified (not re-trusted from a doc) before any claim is made to a prospect that "every dollar is accounted for" — that specific claim is core to the pitch and needs to be true, not just claimed true.

---

## Part 3 — Sales Assessment: how to demo this for maximum impact

### The real-world problem, in the words a broker will recognize

Ask any mid-size customs brokerage how billing actually works today and you'll hear some version of the same story:

- **The rate card lives in a spreadsheet.** Maybe three spreadsheets, because someone updated their copy and didn't tell billing. Nobody can say with certainty which version was in effect for a shipment that closed six weeks ago.
- **Billing is retrospective, not real-time.** A billing coordinator works from completed-entry reports days or weeks after the work happened, reconstructing "what did we actually do for this client" from memory, email threads, and whatever the entry file shows — then keys it into QuickBooks, Xero, or a legacy broker management system's billing module.
- **Pass-through charges and broker revenue get commingled.** Duty, MPF, HMF, and taxes flow through the same invoice line items as the broker's own service fees in a lot of legacy systems, which means nobody can cleanly answer "what did we actually earn on this shipment" without manual rework.
- **Manual work is invisible to the P&L.** A classification override, an exception a human had to resolve by phone, a supervisor's second review — none of that shows up as billable time or as an internal cost in most shops. Brokers systematically under-recover on their most labor-intensive files and don't have the data to know it's happening.
- **Revenue leakage is silent.** Work gets done — an exception resolved, a manual review completed — and never makes it onto an invoice because operations and billing are two disconnected systems (or two disconnected people). Nobody finds out until a margin review months later, if ever.
- **Discounts and waivers happen off the books.** An account manager gives a client a break on a bad week, nobody writes down why, and it silently becomes the new expected rate.
- **Rate renegotiation is a guess.** "What would we have made if we'd charged Acme our new proposed rate for the last year?" is a multi-day Excel exercise today, if anyone attempts it at all — most brokers just raise rates and hope.

**Tools brokers actually use for this today**: Excel/Google Sheets for the rate card itself; QuickBooks, Xero, or Sage bolted on for the actual invoicing, disconnected from operational systems; legacy TMS/customs platforms (CargoWise, Descartes, WiseTech/Vantage, Thomson Reuters ONESOURCE) that typically bill by raw transaction count, not by the specific capability or outcome delivered, and have no concept of AI-driven automation savings; email and phone for the manual exception work that never gets captured anywhere financial.

### How Qubere removes each friction point

| Friction today | Qubere's answer | What to click during the demo |
|---|---|---|
| Rate card lives in an ungoverned spreadsheet | Versioned, immutable-once-activated rate cards with a formal draft→active→retired lifecycle | Import the sample rate card CSV live; show version history on Acme's card |
| Billing is retrospective and manual | Every operational event emits a usage record automatically; charges appear in the ledger without anyone keying anything in | Open Acme's Shipment Economics; point out charges that came from real classification/filing work, not manual entry |
| Pass-through vs. broker revenue is commingled | The shipment ledger separates customs economics, broker economics, and AR into three explicit sections | Open a shipment's Costs & Billing tab, show duty/MPF/HMF called out separately from broker revenue |
| Manual work is invisible to the P&L | Manual review and exception resolution emit their own billable/costable events, distinct from automated work | Show the Human Classification Review line item on Acme's invoice, tied to a real resolved exception |
| Revenue leakage is silent | Automated exception detection flags unmapped rates, negative margins, and unbilled work — and it's now genuinely actionable, not read-only | Resolve or waive a live exception on the Exceptions page; show the audit trail it leaves |
| Discounts happen off the books | Every adjustment requires a reason, is tied to a user and timestamp, and is visible in the charge's history forever | Show the pre-seeded discount on a charge with its reason/approver; optionally add a new one live |
| Rate renegotiation is a guess | Rate simulation runs a proposed rate card against real historical usage without touching production data | Pull up Acme's draft v2 rate card, run the simulation against the last months of real usage, show the revenue delta |

### Talk track — suggested narrative arc

**Open on the pain, not the product.** *"Before I show you anything, let me ask — if I asked your billing team right now why a specific invoice line item is $28, how long would it take them to answer that with confidence? And could you tell me, off the top of your head, which of your clients you're actually losing money on?"* Most brokers can't answer either question cleanly. That's the entire pitch in two questions.

**Scene 1 — "Here's why this charge is what it is."** Open a shipment on Acme Manufacturing's ledger, click into a single charge, and walk the full trace: usage event → rate rule → rate card version → calculation → charge. This is the single most differentiated moment in the demo — no spreadsheet or legacy system gives an instant, auditable answer to "why is this $X."

**Scene 2 — "Your rate card, live, in five minutes."** Upload the seeded sample CSV (`apps/custom/public/demo/billing/`) through the real import flow, map two or three line items live, and activate. This directly answers "how painful is onboarding" before they ask.

**Scene 3 — "Billing that doesn't wait for someone to remember to do it."** Walk through the Usage Ledger and show real classification/document/filing events that automatically produced charges — no manual entry step exists in this flow, and that's the point.

**Scene 4 — "We'll tell you when you're losing money, not your quarterly review."** Show the pre-seeded negative-margin client and the open exception it produced, then resolve it live with a reason. This is where "revenue leakage detection" stops being a bullet point and becomes something they just watched happen.

**Scene 5 — "Real approval, not just a status label."** Create a draft invoice from unbilled Acme charges, and be explicit that sending/approving requires a *different* permission than drafting — this is a genuine control, not UI theater (it's now backed by automated tests, which is worth saying out loud if the prospect has a technical buyer in the room: "this isn't just a status field, it's enforced").

**Scene 6 — "What if we raised this rate?"** Open Acme's draft v2 rate card and run the simulation against real historical usage — show current vs. proposed revenue and margin. This is the moment to pivot toward the expansion/renewal conversation, not just the initial sale: *"this is the tool your team would use every renewal cycle, not just once at onboarding."*

**Scene 7 (if the prospect also runs freight/TMS) — "One client, one financial picture."** Show the TMS billing view alongside customs — carrier AP and customer AR presented together for the same account. Frame honestly: TMS and customs billing are two distinct ledgers by design (paying carriers vs. billing clients are genuinely different problems), but they now run on the same underlying platform and report into the same account — worth mentioning as platform direction, not overselling as fully unified today.

**Close.** *"Every number you just saw traces back to real work, in real time, with a real audit trail. Nothing you saw was a mockup — it's the same engine that would be running your books from day one."* — true and worth saying explicitly, because most SaaS demos in this space are showing configured-for-the-demo static screens, and this one genuinely isn't.

### Objection handling

- *"Our current system already does billing."* — Ask what it takes today to answer "why is this charge $X" and "which clients are unprofitable" with confidence, in under a minute. Most legacy systems bill by transaction count, not capability/outcome, and can't answer either question without manual reconstruction.
- *"How long does onboarding take?"* — Be honest per the PM assessment: rate-card import and activation is fast and demoable live; mapping commercial line items to Qubere's billing events currently benefits from someone who understands both sides, so don't pitch it as fully zero-touch self-service on the first call.
- *"Is this just for customs, or does it work for our freight/TMS side too?"* — Yes to both existing today, on a shared platform, with the honest caveat above: TMS carrier payments (AP) and customs/TMS client billing (AR) are intentionally separate ledgers, unified at the account/reporting level, not merged into one invoice type.

### Demo data & artifacts

Demo scenario data is seeded via `apps/custom/scripts/seed-billing-demo.ts` under a dedicated demo brokerage account, accessible to Frank (`multirole@qubere.ai`) via his existing all-accounts OWNER access. Downloadable/importable demo artifacts (rate-card import file, sample invoice exports) live under `apps/custom/public/demo/billing/`. Exact account name, client names, invoice-status lineup, and artifact filenames are documented in the seed script's own header comment and its run output — check there for the current exact numbers before a live demo, since seed data may be refreshed over time and this playbook's talk track intentionally references scenarios (a healthy client, an underpriced client, an open exception, a draft v2 rate card) rather than hardcoded numbers that could drift out of sync with the database.

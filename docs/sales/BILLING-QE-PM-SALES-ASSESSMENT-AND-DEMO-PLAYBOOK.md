# Qubere Billing —  Demo Playbook

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



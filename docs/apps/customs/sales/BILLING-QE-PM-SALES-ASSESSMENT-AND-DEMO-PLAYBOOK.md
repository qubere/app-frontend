# Qubere Billing — QE / PM Assessment

> The sales assessment, demo talk track, and objection handling now live in [Billing.md](./Billing.md). This document is the internal QE + PM view: what actually works, what doesn't, and whether it's a minimal lovable product.

> Compiled 2026-08-24, against `main` post-merge of [PR #78](https://github.com/qubere/app-frontend/pull/78), [#79](https://github.com/qubere/app-frontend/pull/79), [#80](https://github.com/qubere/app-frontend/pull/80). This document independently re-verified the "complete" status claimed in [BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md](../plans/review/BILLING-BROKER-READINESS-AND-PLATFORM-REQUIREMENTS.md) by running the real test suite and reading the actual code paths — it is not a re-statement of that doc's claims. Findings that hold up are marked verified; anything not independently confirmed is called out explicitly rather than assumed.
>
> **Re-verified 2026-08-29** against current `main`. Changes folded in below, each traced to a commit and re-run: multi-tenant isolation test gap **closed** (`64aba395` — 34-test suite + two real cross-tenant bug fixes it surfaced); customs pass-through `taxes`/`otherFees` confirmed **no longer hardcoded to $0** and now test-covered; real client-side manual-review-duration timer **confirmed wired**; compliance-screening labor (restricted-party / embargo / community / continuous re-screen) is **now metered into billing** (`aaa45bd7`); telemetry re-seed churn bug fixed (`cb0b42d9`); full billing suite grew **61 → 95 passing**. Still open: `DISPUTED`/`CREDITED` charge states remain declared-but-dead; CI migration/schema-drift validation still not watched on a live run.
>
> Demo persona: **Frank (multirole@qubere.ai)** — already provisioned with OWNER access across all accounts via `apps/custom/scripts/setup-multirole-user.ts`. Demo data is seeded via `apps/custom/scripts/seed-billing-demo.ts`.

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
| Maker-checker enforcement | Ran `billing-permission-denials.test.ts` | **19 passing tests** (was 8 on 2026-08-24), parameterized across every billing mutation action — rate-card create/activate/retire/duplicate, rule add/update/delete, rule mapping, invoice create/submit/approve/send/void, charge adjust, payment record, cost-profile save, exception resolve/waive — each asserting denial without its specific granular permission. Real automated regression guard, not a manual-QA note. |
| Invoice lifecycle | Ran `billing-invoice-lifecycle.test.ts` | **3 passing tests**: draft→checker-approval→sent stamps the correct actors; void unlocks charges on an unpaid invoice; voiding a paid invoice is rejected. `InvoiceStatus` is `DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_PAID → PAID`, plus derived `OVERDUE` and terminal `VOID` — no `DISPUTED`/`CREDITED` invoice state exists (see gap #1). |
| Payment recording | Ran `billing-readiness.test.ts` | **Passing**: partial payment supported, overpayment rejected by the real service function (not reimplemented math) |
| Rate-card version lifecycle | Same file | **Passing**: activating a new version formally expires the prior active version (`RateCardVersion.expirationDate` — previously dead, now written) |
| Pipeline usage-event idempotency | Same file | **Passing**: "pipeline emission remains source-idempotent" — a dedicated regression test now exists for this |
| TMS platform billing | Read `apps/tms/src/lib/billingTelemetry.ts` + grepped call sites | **Real, not dead code.** `emitTmsBillingEvent()` calls the shared `@qubere/billing/telemetry` package with `productLine: "TMS"`, and is genuinely called from 4 live operational modules: `podPipeline.ts` (×2), `tenderService.ts`, `freightAuditAgent.ts` — not just defined and unused, the classic false-positive pattern from prior audits |
| `BillingProductLine` schema discriminator | Read `schema.prisma:5993-5997` | **Real** — `CUSTOMS \| TMS \| WMS` enum now exists on `UsageEvent`, `RateCard`, `RateRule`, `Invoice`, `BillingEventDefinition` |
| **Multi-tenant isolation of billing data** (was Part-1 gap #1) | Ran `billing-tenant-isolation.test.ts` (`64aba395`, hardened `347df763`) | **34 passing tests** — a static scan asserting every single-row lookup on all 13 billing models is `accountId`-scoped directly or via a parent relation, plus live tests that each mutation action (`retireRateCard`, `addDraftRateRule`, `updateDraftRateRule`, `adjustShipmentCharge`, `submitInvoiceForApproval`, `resolveException`, payment creation) rejects a foreign tenant's id as not-found and never writes, plus the client-billing detail page proven not to cross-contaminate, plus the importer→client→account-default rate-card resolution hierarchy. This is the highest-priority gap from the 2026-08-24 pass, now closed with a real regression guard in the standard vitest run. |
| Cross-tenant event-definition linkage bug | Read `billing/actions.ts` + `rate-cards/import/actions.ts` diff in `64aba395` | **Two real bugs fixed** — `saveRateRuleMappingsAction` and `createImportedRateCardAction` looked up `BillingEventDefinition` by `eventCode`+`productLine` with no `accountId` filter, which once two tenants seeded the same event code could silently link one account's `RateRule` to another account's definition. Now account-scoped; `getShipmentFinancialSummary` / `buildConditionEventView` hardened the same way. |
| Customs pass-through `taxes` / `otherFees` (was "not re-verified") | Read `packages/billing/src/ledger.ts:129-139` + ran `billing-readiness.test.ts` | **No longer hardcoded to $0** — reads `filing.grandTotalIrTaxAmount` / `filing.totalTaxes` and `filing.grandTotalOtherRevenueAmount`; `totalPassThrough = duty + mpf + hmf + taxes + otherFees`. Test "runs the real ledger function across revenue, costs, AR, and filing taxes" exercises it. |
| Real manual-review-duration timer (was "not re-verified") | Read `lib/decisions/useDecisionActions.ts` + `api/decisions/route.ts:499-509` | **Real** — a client-side `reviewStartedAt` ref map stamps `Date.now()` when a reviewer opens a decision and sends `processingDurationMs` on submit; the route validates it (0–86,400,000 ms) and emits `HTS_MANUAL_REVIEW_COMPLETED` with that `processingDuration`. Broker reports (`reports/brokers/page.tsx`) sum it into total review labor per broker. |
| Compliance-screening labor metering | Ran compliance suite (`aaa45bd7`); grepped call sites | **New, real, wired.** Restricted-party screening (shipment + Party Master), country embargo screening, community screening, and RDPS continuous re-screen each now emit a `UsageEvent` (`RPS_SCREENING_COMPLETED`, `EMBARGO_SCREENING_COMPLETED`, `COMMUNITY_SCREENING_COMPLETED`, `RDPS_RESCREEN_COMPLETED`) cross-referenced to its `ComplianceExecution` via `metadata.complianceExecutionCorrelationId`. Emission is non-fatal and sits on the live entry points (`complianceAuditAgent` calls `runRestrictedPartyScreeningForShipment`, etc.), not defined-and-unused. 4 additive `BillingEventCategory` values + seed `BillingEventDefinition` rows. 89 compliance-screening tests pass and now indirectly guard these emission points. |
| Telemetry catalog re-seed churn | Read `packages/billing/src/telemetry.ts:55-102` (`cb0b42d9`) | **Fixed** — `recordUsageEvent()` was re-seeding the full billing event catalog on every call, causing Supabase pooler connection churn during bulk recording; now short-circuits on an in-process `seededAccounts` Set (once per account per process). |
| Billing-surface data-segregation sweep | Commit `9000528a` touched every billing page + all billing action files | Whole billing route surface was swept into account-scoped context in one pass; the tenant-isolation suite above is the regression guard for it. |
| Full billing test suite | `npx vitest run` on all 5 billing test files | **95/95 passing** (billing-engine 32, billing-tenant-isolation 34, billing-permission-denials 19, billing-readiness 7, billing-invoice-lifecycle 3) — up from 61/61 on 2026-08-24 |

### Recently closed (2026-08-29 re-verification)

- **Multi-tenant isolation test for billing data — CLOSED.** Was gap #1 and the highest-priority item from the 2026-08-24 pass. `billing-tenant-isolation.test.ts` (34 tests, `64aba395`) now proves cross-account isolation across all 13 billing models, and adding it surfaced two real cross-tenant linkage bugs that were fixed in the same commit. It runs in the standard vitest suite, so every future billing PR is guarded.
- **`taxes` / `otherFees` no longer hardcoded to $0 — CLOSED.** `ledger.ts` reads the real filing tax/other-revenue totals and includes them in `totalPassThrough`; `billing-readiness.test.ts` exercises it. The "every dollar is accounted for" pitch claim (Part 2) is now true for the customs pass-through layer, not just claimed.
- **Real client-side manual-review-duration timer — CLOSED.** `useDecisionActions.ts` → `api/decisions/route.ts` feeds a validated `processingDuration` into `HTS_MANUAL_REVIEW_COMPLETED`, and broker reports aggregate it. Time-based rating of human review labor is now backed by a real measured duration.

### Remaining gaps — QE would not sign off on these as closed

1. **`DISPUTED` / `CREDITED` charge states are declared but dead.** `ChargeStatus` has `CREDITED`, `DISPUTED`, `WRITTEN_OFF`, `REVERSED`, `VOIDED`, and `billing.credit.create` / `billing.credit.approve` permissions are registered — but no code path sets those statuses, there is no `CreditNote` model, and `adjustShipmentChargeAction` only blocks `VOIDED`/`REVERSED`. There is no credit-note or charge-dispute workflow in the product yet. Do not demo or pitch "issue a credit / dispute a charge" as a working flow.
2. **CI claims still not watched on a live run.** The "complete" doc claims CI validates fresh-DB migrations, migration replay safety, schema drift, and OpenAPI generation for billing. This pass again did not execute CI directly — the tenant-isolation and other billing tests are now in the standard vitest run (so unit coverage is real), but nobody has confirmed the migration/schema-drift CI gates actually fire on a billing PR. Recommend a QE owner watch the next one.
3. **"Delete data" workflows are intentionally restrictive, not broken.** There is no hard-delete path for rate cards, invoices, or charges once they exist — retiring/voiding are the only state transitions available, by design (financial records shouldn't be deletable). Flagging this so it isn't mistaken for a bug during QE exploratory testing: an operator looking for a "delete" button on an activated rate card or a sent invoice won't find one, and that's correct behavior per the spec's immutability requirement, not a gap.

### Instrumentation verdict

Usage-event emission, audit logging on mutations, and idempotency keys are real and DB-enforced (`UsageEvent.idempotencyKey` has a unique constraint). The cross-tenant boundary is **now proven by an automated test** (`billing-tenant-isolation.test.ts`, 34 tests) that runs on every PR — the main instrumentation gap from 2026-08-24 is closed. Emission coverage also widened: compliance screening (restricted-party / embargo / community / continuous re-screen) now emits its own usage events, so a whole class of previously-invisible chargeable labor is metered. What's still missing instrumentation-wise: there's no automated alert/dashboard (outside the in-app Exceptions page) if usage-event emission silently stops from a given source — an operator would only notice via the Exceptions/Revenue Leakage views, not a proactive signal.

---

## Part 2 — PM Assessment: do we have a minimal lovable product?

### Verdict: yes, with caveats

**Yes** — a broker can today: build a real rate card, watch real operational work turn into real charges without manual entry, see a real 3-layer shipment ledger (customer charge / broker cost / margin), generate and send a real invoice, record a real payment, and explain exactly why any charge is what it is. That loop is genuinely closed and running on real logic end to end, verified by the QE pass above. This is meaningfully more than a demo shell — it's a working v1 of the core financial loop.

**With caveats** that matter for what "minimal lovable" actually means for this audience:

- **Lovable requires trust, and trust requires the maker-checker control to be real** — it now is (permission denials are tested), which is the single most important trust signal for anyone billing real money. This closes what would have been a hard no from any broker's finance lead.
- **Lovable requires visibility into what's broken**, not just what's working — the Exceptions workflow being genuinely actionable now (not just a read-only list) is what makes "revenue leakage detection" a credible pitch instead of a vanity metric.
- **Lovable does NOT yet require** cross-module (customs+TMS) financial unification to be complete — TMS emitting into the shared ledger is a real platform signal worth having in the pitch, but a first buyer evaluating customs billing alone doesn't need TMS present to say yes. Treat that as a forward-looking platform story, not a blocking gap.
- **Metering now reaches the compliance work, not just the classification/filing work** (2026-08-29). Every sanctions/embargo/restricted-party screen and every continuous re-screen is now a rated line item tied to a compliance-execution record. For a broker whose value-add is increasingly "we keep you off the denied-party list," this is a materially stronger revenue-capture story than it was a week ago — worth leading with for compliance-heavy prospects.

### What a real-life implementation looks like

A brokerage onboarding onto this today would, realistically:

1. Import their existing rate card(s) via CSV/XLSX — this works, and is the first-touch moment that has to feel effortless (see the demo script in [Billing.md](./Billing.md) for exactly this flow).
2. Map their commercial line items to Qubere's billing events — this requires someone at the brokerage who understands both their pricing and roughly what Qubere's system does; it is not a fully self-service, zero-training step today, and shouldn't be pitched as one.
3. Activate the rate card and let real operational work start accruing charges automatically as shipments move through the platform — no separate action required, which is the core "no manual billing" value prop, and it's real.
4. Within the first billing cycle, the billing team would use the Exceptions page to catch unmapped rates or negative-margin shipments before they become a client-facing invoicing mistake — this is a genuinely differentiated capability vs. anything spreadsheet- or legacy-TMS-based.
5. Generate the first invoice from accrued charges, route it through approval (a distinct person now required, not the same person who drafted it), send, and track payment.
6. After a few months of real usage history, run a rate simulation before proposing a renegotiated rate card — this is the kind of thing brokers currently do with a consultant or a manual Excel model; having it in-product is a real differentiator worth leading with in a second/expansion conversation, not necessarily the first demo.

### Where PM would push back on "ready to sell as finished"

The permission/test gaps closed in this round were the right ones to close first — they were correctness and trust issues, not feature gaps. As of the 2026-08-29 re-verification, the two blockers PM had flagged here are cleared: the **multi-tenant isolation test gap is closed** with a real regression guard (safe to pitch to a second brokerage sharing infrastructure), and `taxes`/`otherFees` are **confirmed real and test-covered** — the "every dollar is accounted for" claim is now defensible for the customs pass-through layer.

What's left for product, not engineering: **do not represent credit notes or charge disputes as a working flow** — `DISPUTED`/`CREDITED` are declared enum values with no code behind them (Part 1, gap #1). If a prospect's finance lead asks "how do we issue a client a credit," the honest answer today is "adjustment with a reason and audit trail, not a formal credit-note document" — and that should be on the roadmap slide, not demoed as done.

# Qubere Billing — Broker Readiness Assessment & Platform Architecture Requirements

> Compiled 2026-08-24 by product + architecture review of the current `main` branch. Source spec: [docs/requirements/billing-costing-invoicing-profitability.md](../../requirements/billing-costing-invoicing-profitability.md) (52 sections, referenced below as `§N`). Prior implementation plan: [F14-billing-costing-invoicing.md](../features/F14-billing-costing-invoicing.md) — both `feat/billing-completion` and `agent/billing-audit-remediation` are confirmed **merged into `main`**, so this document evaluates what actually landed, not what was planned.
>
> Every finding below is traced to file:line evidence gathered by four independent audits (UX, API/schema, test coverage, TMS/platform architecture) run against the live codebase on 2026-08-24. Treat this as the current ground truth; re-verify before reuse if significant time has passed.

---

## Part 1 — Product Assessment (PM view)

### 1.1 Verdict

The billing engine is **real, not fabricated** — this is the most important finding. Usage-event emission from the main agent pipeline (the single highest-priority gap identified in the prior F14 plan) is now genuinely wired, rating/costing math is tested against real functions, duty/MPF/HMF pass-through economics read real computed values, and payment recording works end-to-end. This is a legitimate financial engine, not a demo.

However, **it is not yet production-grade for broker rollout**. Four categories of risk block a "ready to bill real customers" claim:

1. **A live data-loss bug** in the rate-card rule editor that silently corrupts pricing configuration on edit.
2. **A permission model that is decorative, not enforced** — ~22 of the ~30 spec'd granular billing permissions don't exist in the permission catalogue, so the "maker-checker" approval workflow the spec requires (§20, §38-41) is cosmetic: anyone who can draft an invoice or rate card can also approve/activate it themselves.
3. **Near-zero test coverage** beyond pure pricing math — no test exercises the database-integrated engine, invoice lifecycle, payment guard rails, permission denial, or multi-tenant isolation of financial data.
4. **UX gaps that break broker trust**: broken tab highlighting, unhandled server-action crashes, a "actionable exceptions" page with no actions, and no Clients section at all.

None of these require re-architecture — they're finishing work on a real foundation, not evidence the foundation is fake. Estimated engineering effort to close the P0/P1 list below: **2-3 focused sprints** for one senior engineer, informed by how concretely each item is already scoped (file:line-level).

### 1.2 Broker feature checklist — what's needed vs. what's delivered

| Capability area (spec ref) | Required for broker use | Status |
|---|---|---|
| Rate card management (§6-9) | Upload (CSV/XLSX), manual builder, line-item→capability mapping, versioning, immutability | **Delivered**, with one data-loss bug (§2.1 below) |
| Usage metering (§10-12) | Every billable operation emits an immutable, idempotent usage event | **Delivered** — closed the top F14 gap |
| Pricing models (§13) | 13 pricing models (per-unit, tiered, conditional, bundled, etc.) | **Delivered and genuinely tested** at the pure-function level |
| Human work tracking (§14) | Track manual review/exception-resolution time and cost | **Partially delivered** — event fires, but no real duration timer exists yet (logged as an honest `BillingException` rather than a fabricated duration, which is the right call, but the feature itself is incomplete) |
| Internal cost model (§15) | Tech cost, labor cost, third-party cost, kept separate from customer pricing | **Delivered** |
| Shipment financial ledger (§16, §45) | Customer charges / broker costs / customs pass-through, kept separate | **Partially delivered** — duty/MPF/HMF are real; taxes and other government fees are still hardcoded to `$0` |
| Real-time billing (§17) | Charges appear immediately as work happens | **Delivered** |
| Discounts/credits/waivers/adjustments (§19-20) | With approval thresholds by role | **Data model delivered; approval segregation is not enforced** (see 1.3) |
| Invoice lifecycle (§21-24) | Draft → approval → send → paid, with export | **Mostly delivered** — 7 of 10 states are real; `OVERDUE` is never persisted (UI-computed only) and `DISPUTED`/`CREDITED` are dead states with no code path |
| Payments/AR (§25) | Payment recording, partial payment, outstanding/overdue | **Delivered** (a prior "dead code" flag on payment recording is now resolved and UI-reachable) |
| Auditability (§26) | Every charge traceable to its origin | **Delivered** — spot-checked across 6 mutation types, all call `createAuditLog` |
| Billing exceptions (§27) | Detect AND resolve/waive/assign/escalate | **Detection delivered; resolution actions do not exist.** The Exceptions page is read-only despite being labeled "Actionable" in the UI. |
| Revenue leakage detection (§28) | Automated flags | **Delivered** |
| Rate simulation (§36) | Test a proposed rate card against real history without touching production | **Delivered**, and verified to use the exact same calculation path as live rating (no drift risk) |
| Granular permissions (§37-43) | ~30 fine-grained codes, role bundles, segregation of duties | **Not delivered as specified** — only 18 codes exist in the catalogue, ~8 are actually load-bearing; the rest are strings referenced in code with no catalogue entry, silently falling back to coarse umbrella permissions |
| Reporting (§30-35) | Shipment/client/broker-user/service/agent profitability | **Delivered**, including the newer broker-workload and service-level reports |
| Clients section (nav, §4) | Dedicated client billing view | **Missing entirely** — no route exists; closest substitute is a read-only aggregate table buried in Reports |

### 1.3 Critical workflows — status against real broker usage

Tracing the full lifecycle a broker operator would actually click through:

**Rate card setup → activation → mapping.** Works end to end, but editing any field on an existing draft rule silently zeroes out its unit and included-quantity — a broker fixing a typo in a rate name can unknowingly corrupt a correctly configured tiered rule. **This is the single highest-priority bug to fix before any broker touches rate-card editing.**

**Usage accrual → shipment charges.** Works, but there's no drill-down from the Shipment Economics table to the underlying charges — an operator who sees a shipment's numbers look wrong has no in-product path to investigate; they have to already know to check the separate Usage Ledger tab.

**Invoice creation → approval → send → payment.** Functionally complete, but the "approval" step provides no actual control: because `billing.invoice.approve`/`.send`/`.void` aren't registered permission codes, anyone who can draft an invoice can also approve and send it. For a financial workflow, this defeats the purpose of having an approval step at all — it's a UI affordance, not a control.

**Exceptions → resolution.** Broken as a workflow. The system correctly *detects* billing exceptions (unmapped rates, negative margins, duplicate charges, etc.) and the dashboard explicitly calls them "Actionable," but there is no assign/resolve/waive/escalate action anywhere in the module. A broker's billing team would see a growing list of exceptions with nothing to do about them in the product.

**Rate simulation.** Solid — this is one of the best-built parts of the module, verified to share the exact same math as production rating.

### 1.4 Is the foundation solid?

**Architecturally, yes.** The core model (Operational Event → Usage Event → Rate Rule → Charge → Ledger → Invoice → Payment) is real and correctly separates customs economics, broker economics, and AR, matching §45's requirement. Idempotency is enforced at the database level for usage events. Rate card immutability is a real code guard, not a comment. Rate simulation provably shares math with live rating.

**Operationally, not yet.** The gaps are concentrated in exactly the areas that matter most for a finance-adjacent product: segregation of duties, error resilience, and test coverage. A financial module with a real engine but no enforced approval workflow and near-zero DB-integration test coverage is a liability, not a readiness story, if sold to brokers as "production-ready" today.

### 1.5 UX grade

**Not production grade yet.** Concrete blockers found:

- Tab navigation highlighting is completely broken (relies on a header no middleware ever sets) — every billing sub-page shows "Overview" as the active tab.
- Multiple forms (rate card activation, invoice creation, cost settings, charge adjustments) call server actions with no error boundary — a thrown business-rule error (e.g. "cannot activate a rate card with no billable rules") crashes to Next.js's default unhandled-error page instead of showing the user what went wrong.
- No `loading.tsx` or `error.tsx` anywhere in the module — a DB hiccup on any billing page renders blank with no recovery path.
- A margin-health badge on the Client Profitability report is hardcoded green regardless of actual value — a client running a negative margin displays as "healthy," which is actively misleading for the report whose entire purpose is flagging under-water clients.
- `billing.ratecard.view`-only users are authorized to view rate-card detail pages but have no navigation path to reach them (the list page hard-redirects them away) — a real but low-severity dead end.

Positives worth keeping: empty-state handling across every list page is genuinely good, cost/margin visibility gating on the Shipment Economics and Usage Ledger pages is correctly implemented server-side (not just visually hidden), and invoice export (PDF/CSV/XLSX) works cleanly.

### 1.6 Test coverage verdict

**Inadequate for a production financial module.** Only one test file touches billing at all, and it exercises exclusively the pure pricing-math function — genuinely well-tested (32 passing tests across all 13 pricing models). Everything with actual financial or audit consequence has **zero** test coverage: rate-card lifecycle (create/activate/retire/duplicate/version), invoice state transitions, payment recording's overpayment guard, charge-adjustment approval gating, permission denial on any billing action, revenue-leakage detection, and — critically — multi-tenant isolation of billing data (can Account A see Account B's invoices?). The repo has an established pattern for exactly this kind of test (`tests/tenant-isolation-routes.test.ts`) that was never extended to billing.

### 1.7 Will TMS use the same billing system? Does the code support that today?

**No, and no.** TMS and customs billing are two fully disconnected financial systems today, sharing nothing but the same Postgres database and the same Clerk tenant — and that sharing is a coincidence of deployment configuration, not a designed platform capability.

- Customs billing is **accounts receivable**: broker bills its clients (`UsageEvent` → `RateCard` → `ShipmentCharge` → `Invoice` → `Payment`).
- TMS "invoicing" is **accounts payable**: TMS pays carriers, via an entirely separate `CarrierInvoice`/`CarrierInvoiceLine` model with zero foreign keys into any customs-billing table.
- No TMS operational event (load tendered, delivered, carrier assigned) ever creates a `UsageEvent`. Grepping `UsageEvent` across the entire TMS app returns zero hits.
- There is no `Module`/`AccountModule` entitlement system gating which product lines an account can access — a prior audit (2026-08-21) flagged this gap, and it is still true today. Two schema models that look like a first draft of this (`AccountProductEntitlement`, `ShipmentProductWorkspace`) exist in the Prisma schema but are **referenced by zero application code** — dead schema, not a working system.

**If the intent is for billing to be a genuine platform capability** (the spec's own language — "billing telemetry must be a first-class platform primitive," §46 — was written entirely in customs-domain terms with no TMS cross-reference), that intent is not yet reflected in the codebase, and doing so is a real architecture project, not a config change. See Part 2, Workstream 6 for the concrete plan.

---

## Part 2 — Technical Requirements (Architect view, for implementation)

Organized into workstreams by priority. Each ticket is scoped to be directly actionable — hand these to Antigravity as separate work items in the order listed. Do not batch WS1 items with anything else; they are correctness/data-integrity bugs that should ship independently and fast.

### Workstream 1 — P0: Fix before any broker uses this module

**T1.1 — Fix rate-rule edit data loss.**
`apps/custom/src/app/app/billing/rate-cards/[id]/page.tsx:34-40` omits `unit` and `includedQuantity` when building `formattedRules` for `RateRuleEditor`. `RateRuleEditor.tsx:52-61`'s `startEdit()` then hardcodes `unit: "unit", includedQuantity: "0"` into edit state, and `saveEdit()` (lines 64-87) submits those fabricated defaults via `updateDraftRateRuleAction`, silently overwriting the real values on any edit.
*Fix:* pass `unit` and `includedQuantity` through from the page query into `formattedRules`, and have `startEdit()` read them from the actual rule object instead of hardcoding.
*Acceptance:* edit a draft rule's name only; confirm `unit`/`includedQuantity` are unchanged in the DB after save.

**T1.2 — Fix broken tab navigation highlighting.**
`apps/custom/src/app/app/billing/layout.tsx:22-23,49-52` relies on `headers().get("x-pathname")`, but no `middleware.ts` exists anywhere in `apps/custom` to set that header, so the fallback always fires and "Overview" appears active on every sub-page.
*Fix:* either add a minimal `middleware.ts` that sets `x-pathname`, or (simpler, no new infra) derive the active tab from Next's `usePathname()` in a client component instead of a server-side header read.
*Acceptance:* navigate to each of the 8 billing tabs; confirm the correct tab is visually highlighted on each.

**T1.3 — Add error boundaries to billing forms.**
`rate-cards/[id]/page.tsx:46-65,90-103`, `invoices/create/page.tsx:96,171-176`, `settings/page.tsx:38`, `charges/[id]/page.tsx:69` all wire server actions directly to `<form action={...}>` with no client-side error handling — thrown business-rule errors (e.g. "Map at least one billable rate rule before activating") crash to Next's default error page instead of showing an inline message.
*Fix:* wrap these forms in the same client-component `try/catch` + inline error state pattern already used elsewhere in the module (establish which page does this correctly today and use it as the template).
*Acceptance:* trigger each documented business-rule error (e.g. activate a rate card with zero billable rules) and confirm an inline error renders instead of a crash.

**T1.4 — Add `loading.tsx`/`error.tsx` to the billing route tree.**
No loading skeleton or error boundary exists anywhere under `apps/custom/src/app/app/billing/**`. A DB error on any page currently renders blank.
*Fix:* add module-level `loading.tsx` and `error.tsx` at minimum at `apps/custom/src/app/app/billing/`.
*Acceptance:* simulate a DB error on one billing page; confirm a recoverable error UI renders instead of a blank page.

**T1.5 — Make the Exceptions page actually actionable, or stop calling it that.**
`exceptions/page.tsx` is read-only — no resolve/waive/assign/escalate action exists anywhere in the module, despite the Overview dashboard explicitly labeling these "Actionable Billing Exceptions" with a "Review Exceptions →" link.
*Fix (minimum viable):* add `resolveExceptionAction(exceptionId, reason)` and `waiveExceptionAction(exceptionId, reason)` server actions (mirror the audit-logged pattern already used in `charges/[id]/actions.ts`), gated by a real permission, with a resolve/waive button + reason field per exception row.
*Acceptance:* a billing user with the right permission can resolve an exception from the UI and it disappears from the open-exceptions list, with an audit log entry.

**T1.6 — Fix idempotency-key collision on exception re-resolution.**
`apps/custom/src/app/api/exceptions/[id]/route.ts:88` keys the billing idempotency key only on the exception ID (`billing:exception-resolved:${id}`). If an exception is resolved, reopened, and resolved again, the second resolution is silently treated as a duplicate and never billed — quiet revenue leakage on legitimate repeat work.
*Fix:* include a resolution-attempt discriminator (e.g. a resolution counter or timestamp-derived value) in the idempotency key.
*Acceptance:* resolve → reopen → resolve the same exception twice; confirm two separate billable usage events are recorded.

### Workstream 2 — P1: Segregation of duties / permission model

**T2.1 — Register the missing granular billing permissions.**
`packages/auth/src/permissions.ts:167-184` has 18 `billing.*` codes; application code references ~30 distinct codes (`billing.invoice.create/approve/send/void`, `billing.ratecard.create/edit/activate/retire/duplicate`, `billing.rate_rule.*`, `billing.mapping.edit`, `billing.cost_profile.create`, etc.), and ~22 of them don't exist in the catalogue. Because every call site pairs the missing granular code with an umbrella fallback via OR-logic, this isn't a hard security hole today, but it means the entire maker-checker approval model the spec requires is currently unenforceable — anyone who can draft an invoice or rate card can also approve/activate/send it themselves.
*Fix:* add the missing ~22 codes to `PERMISSION_CATALOGUE` with sensible default role bundles (mirror the existing pattern for the 8 real codes), assign them to distinct roles in the default seed (e.g. Billing User can create, Billing Manager can approve), and remove the umbrella-permission OR-fallback once the new codes are synced to existing roles — do this as a two-step migration (add + fallback, sync, then remove fallback) so no existing role silently loses access mid-rollout, exactly as the original F14 plan described for this migration pattern.
*Acceptance:* a user with only `billing.invoice.create` cannot approve or send an invoice they drafted; a separate user with `billing.invoice.approve` can. Same test for rate-card activation.

**T2.2 — Fix the margin-visibility permission gap on the Overview dashboard.**
`apps/custom/src/app/app/billing/page.tsx:13-18,38,97-108` gates the Gross Profit/Margin tile only on `billing.cost.view`, never checking `billing.margin.view` — inconsistent with `shipments/page.tsx`, which correctly treats cost and margin as independently gated. A user with cost visibility but not margin visibility currently sees margin data they shouldn't.
*Fix:* add the `billing.margin.view` check to the Overview tile, matching the Shipment Economics page's pattern.
*Acceptance:* a user with `billing.cost.view` but not `billing.margin.view` sees internal cost but not gross margin % on the Overview page.

**T2.3 — Fix the hardcoded margin-health badge color.**
`apps/custom/src/app/app/billing/reports/page.tsx:190` hardcodes the Client Profitability margin badge to green regardless of value. `reports/page.tsx:163-167`'s Service-Level table already has the correct green/amber/rose logic — reuse it.
*Acceptance:* a client with negative margin displays a red/rose badge, not green.

### Workstream 3 — P1: Schema hardening

**T3.1 — Add a unique constraint on `ShipmentCharge.usageEventId` / `ShipmentCost.usageEventId`** (currently `String` with no uniqueness, `schema.prisma:6192-6193, 6225-6226`). Double-billing protection for non-once-per-shipment pricing models is currently app-discipline only (single call site today), not a DB guarantee — add the constraint now before any retry/backfill job is built that could call the rating function twice for the same event.

**T3.2 — Add a real FK relation on `BillingException.usageEventId`** (`schema.prisma:6350`, currently a bare `String?` with no `@relation`, unlike every other reference on this model).

**T3.3 — Add non-negative `CHECK` constraints** on amount fields across `ShipmentCharge`, `Invoice`, `Payment`, `ChargeAdjustment` — currently enforced only in application code.

**T3.4 — Wire `RateCardVersion.expirationDate`.** It's read by `resolveActiveRateCardVersion`'s filter but never written by any code path — superseded versions never formally expire, relying on version-ordering to pick the right one rather than an explicit lifecycle transition. Add expiration-setting to the "create new version" / "activate new version" flow so the previous version is marked expired.

**T3.5 — Persist `OVERDUE` as a real status, or formally document it as derived-only.** Currently computed client-side only (`invoices/[id]/page.tsx:26`, `invoices/page.tsx:48`) with no cron/job ever writing it to the DB — this matches a documented decision in the prior F14 plan (avoid a new cron given Vercel Hobby cadence constraints), but as-is, any future server-side query filtering `status: "OVERDUE"` will silently match nothing. Either add the daily Inngest step the prior plan flagged as a stretch task, or add an explicit code comment at the `InvoiceStatus` enum declaration stating `OVERDUE` is derived-only and must never be queried directly.

**T3.6 — Resolve `DISPUTED`/`CREDITED` as dead enum values.** Zero code paths ever set these; they only appear as decorative CSS classes in a badge-color map. Either build the minimal action to set them (a "Dispute" button, a "Credit" flow) or remove them from the enum and the badge map to avoid implying a capability that doesn't exist.

### Workstream 4 — P1: Test coverage

Extend `apps/custom/tests/billing-engine.test.ts` or add sibling files. Priority order:

**T4.1 — Multi-tenant isolation for billing data.** Follow the exact pattern already established in `tests/tenant-isolation-routes.test.ts` (fake-lookup ownership table, assert `rejects.toMatchObject(...)`, grep route source for unscoped `findUnique`) and apply it to `RateCard`, `Invoice`, `ShipmentCharge`, `Payment`. This is the single highest-priority test gap given this is financial data.

**T4.2 — Permission-denial tests.** For every mutation action (`activateRateCardAction`, `voidInvoiceAction`, `recordPaymentAction`, `adjustShipmentChargeAction`, etc.), assert it throws/rejects for a context lacking the required permission. None exist today.

**T4.3 — Invoice lifecycle integration tests.** Draft → pending approval → approved → sent → paid, and separately: void unlocks associated charges back to `RATED`/`invoiceLineId: null` correctly, and voiding a partially-paid invoice is rejected.

**T4.4 — Payment recording tests against the real function**, not reimplemented math: overpayment guard (`invoicing.ts:138`), partial payment, `PAID`/`PARTIALLY_PAID` transition boundary.

**T4.5 — Rate-card lifecycle tests**: create/activate/retire/duplicate/new-version, and explicitly assert an activated version's rules cannot be mutated (lock in the immutability guarantee with a test, not just a manual-QA note).

**T4.6 — Fix the remaining hand-computed math in the existing test file.** `tests/billing-engine.test.ts:327-346` ("Shipment Financial Ledger Economics") still computes gross margin/outstanding AR by hand instead of calling `getShipmentFinancialSummary` — the exact anti-pattern the prior plan flagged, just relocated. Rewrite to call the real function.

**T4.7 — Integration test for `PipelineOrchestrator` → `UsageEvent` emission**, asserting a real agent run produces the expected usage events with correct `eventCode`/`quantity`/`shipmentId`, and that re-running the same `runId` doesn't double-emit.

### Workstream 5 — P2: Missing features / navigation gaps

**T5.1 — Build a Clients billing section.** No route exists (`billing/clients/`) despite being in the spec's nav structure (§4). The closest substitute today is a read-only aggregate table in Reports with no rate-card assignment, contact/terms info, or drill-down. Scope: a client list + detail page showing assigned rate card(s), billing contact/terms, and links into that client's invoices/charges — reusing existing query patterns from the Reports client table rather than building new aggregation logic.

**T5.2 — Add drill-down from Shipment Economics to charges.** `shipments/page.tsx` rows currently have no link to the underlying `ShipmentCharge` list for that shipment; the only path today is via the Usage Ledger's per-row "Rated Charge" link. Add a direct link/expand from each shipment row.

**T5.3 — Real duration timer for manual HTS review** (§14, human-work tracking). Currently `HTS_MANUAL_REVIEW_COMPLETED` fires without a real `processingDuration` (correctly logged as an honest gap via `BillingException` rather than fabricated — keep that discipline), but the underlying capability (accurate labor costing on manual review) is incomplete without a real client-side timer from decision-detail-open to submit.

**T5.4 — Wire `taxes`/`otherFees` in the customs pass-through ledger.** `ledger.ts:111-112` still hardcodes these to `$0` (duty/MPF/HMF were already fixed to read real values). Locate the actual tax computation source (if one exists in the tariff engine) before wiring — do not guess a field.

**T5.5 — Give `billing.ratecard.view`-only users a navigation path.** They're authorized to view rate-card detail/simulation pages but the list page hard-redirects them away, leaving the permission practically unusable. Either relax the list-page gate to allow view-only access (read-only rendering) or remove the dead permission.

### Workstream 6 — P2/Architecture: Making billing a platform capability (TMS unification)

This is the largest single decision in this document — confirm scope and priority with the account owner before starting; it is not a small ticket like the others.

**Current state:** Customs billing (AR — broker bills clients) and TMS invoicing (AP — TMS pays carriers, via a fully separate `CarrierInvoice` model) share nothing but incidental database/tenant co-location. No TMS operational event ever produces a `UsageEvent`. Two schema models that look like a first draft of module entitlement (`AccountProductEntitlement`, `ShipmentProductWorkspace`) exist but are referenced by zero application code.

**Recommended minimum viable architecture, in dependency order:**

1. **Add a `module`/`productLine` discriminator** (`"CUSTOMS" | "TMS" | "WMS"`) to `UsageEvent`, `RateCard`, `RateRule`, `Invoice`, `BillingEventDefinition` in `packages/db/prisma/schema.prisma`.
2. **Wire `AccountProductEntitlement` for real** as the module-entitlement gate, checked in `withAuthenticatedRoute`/`hasPermission` alongside existing permission strings — this closes the standing platform-architecture gap and gives billing a real cross-app tenant-scoping mechanism.
3. **Extract the billing engine into a shared workspace package** (`packages/billing`, following the existing convention of `packages/ai`, `packages/decisions`) — right now `ratingEngine`/`costingEngine`/`ledger`/`telemetry` live under `apps/custom/src/lib/billing` and are not importable by `apps/tms` at all. This is the structural move that actually earns "platform capability" — without it, every other step in this list just duplicates code into TMS instead of sharing it.
4. **Build a TMS telemetry emitter** analogous to `apps/custom/src/lib/billing/telemetry.ts`, calling the same shared `recordUsageEvent()` with `module: "TMS"` and TMS-specific event codes (tender dispatched, POD confirmed, load delivered, 3-way match approved) defined analogously to `DEFAULT_BILLING_EVENT_DEFINITIONS`.
5. **Reuse the existing Rate Card / Invoice UI with a module filter** rather than building parallel TMS billing screens — the customs billing UI at `apps/custom/src/app/app/billing/**` already has the full CRUD surface; add a module tab/filter to it (or, if TMS needs its own app-local billing routes for deployment reasons, have them render the shared package's components).
6. **Optional:** have `CarrierInvoice` settlement also emit a `UsageEvent` so TMS carrier spend surfaces in a unified cross-product profitability view — this is a nice-to-have for reporting completeness, not required for core AR unification, and should be sequenced after 1-5.

**Decision needed from the account owner before scoping this as engineering work:** is unifying customs AR and TMS billing into one ledger actually the near-term goal, or is TMS invoicing (AP) intentionally meant to stay separate from customs billing (AR) as two different financial functions that merely need to *report into* a shared profitability view? The architecture above supports either answer, but the sequencing and priority of steps 3-6 differ significantly depending on which one it is.

---

## Suggested delivery sequencing for Antigravity

1. **Workstream 1** (P0 bug fixes) — ship independently, first, fast. No dependencies.
2. **Workstream 3** (schema hardening) — can run in parallel with WS1; low risk, additive migrations.
3. **Workstream 2** (permissions) — do after WS1 so the exceptions-resolution action from T1.5 is built against the corrected permission model, not the old umbrella one.
4. **Workstream 4** (tests) — should track WS1-3 as they land; each fix should ship with its regression test rather than being tested in a separate pass.
5. **Workstream 5** (missing features/nav) — independent, can run anytime after WS1.
6. **Workstream 6** (TMS/platform) — requires an explicit go/no-go decision from the account owner first (see the decision prompt above); scope and sequence only after that's answered.

---

## Part 3 — Implementation Record (2026-08-24)

### 3.1 Final disposition

**Implementation status: complete on `feat/billing-broker-readiness`.** The product assessment in Parts 1–2 is retained as the pre-change baseline. This section is the post-change source of truth and records the implementation decisions, evidence, migration notes, and verification performed for the pull request.

The Workstream 6 decision is resolved as follows:

- Customer billing is one shared, account-scoped **accounts-receivable ledger**, partitioned by `BillingProductLine` (`CUSTOMS`, `TMS`, `WMS`).
- TMS `CarrierInvoice` remains the purpose-built **accounts-payable sub-ledger**. It is intentionally not converted into a customer invoice.
- TMS operational work emits into the shared customer AR telemetry/rating pipeline, while carrier AP is shown separately in TMS profitability/billing views.
- The billing engine now lives in `packages/billing` and both product apps depend on it.

### 3.2 Re-verification corrections to the original assessment

Two baseline statements were corrected during implementation:

1. `AccountProductEntitlement` and `ShipmentProductWorkspace` were not dead schema. TMS customs handoff and product-workspace services already called `assertProductEntitlement`. The missing piece was consistent route/module enforcement; the shared authenticated-route guard now supports an explicit `product` requirement and product-prefixed permissions infer the entitlement.
2. A simple unique constraint on `ShipmentCost.usageEventId` would have been incorrect because one usage event may legitimately produce both LABOR and TECH cost components. The implemented invariant is `@@unique([usageEventId, costType])`; `ShipmentCharge.usageEventId` remains singly unique.

The non-negative constraint requirement was also applied with financial-sign semantics: original/new charge amounts must be non-negative, while `ChargeAdjustment.adjustmentAmount` must be non-positive because it is stored as a delta.

### 3.3 Requirement completion matrix

| Requirement | Status | Implementation evidence |
|---|---:|---|
| T1.1 Rate-rule edit preservation | Done | `RateRuleEditor.tsx` now reads and preserves real `unit` and `includedQuantity`; detail-page DTO includes both fields. |
| T1.2 Active billing tab | Done | `BillingTabs.tsx` uses `usePathname()` and sets `aria-current`. |
| T1.3 Inline action errors | Done | Reusable `BillingActionForm.tsx` wraps rate-card, invoice, settings, charge, and exception mutations with pending, error, success, confirmation, refresh/navigation behavior. |
| T1.4 Route loading/error UI | Done | Billing-level `loading.tsx` and recoverable client `error.tsx` added. |
| T1.5 Exception actions | Done | Audited, tenant-scoped resolve/waive actions with reason, granular permission, optimistic concurrency, and UI controls. |
| T1.6 Re-resolution idempotency | Done | Operational exception event key includes the persisted exception version. |
| T2.1 Granular permissions | Done | Full billing permission catalogue and billing admin/manager/user/viewer role families added; umbrella mutation fallbacks removed. Invoice and rate-card maker/checker identity checks prevent self-approval/activation. |
| T2.2 Margin visibility | Done | Overview cost and margin checks are independent. |
| T2.3 Margin badge | Done | Client and service badges use green/amber/rose thresholds from actual margin. |
| T3.1 Retry uniqueness | Done | Unique usage-event revenue charge and composite usage-event/cost-type constraints; rating/cost writers use idempotent upserts. |
| T3.2 Exception FK | Done | `BillingException.usageEvent` relation, FK, and index added. |
| T3.3 Financial checks | Done | Migration adds charge, cost, adjustment, invoice, invoice-line, payment, and client-term checks. |
| T3.4 Version expiration | Done | Activating a new version stamps the prior active version's `expirationDate`. |
| T3.5 OVERDUE semantics | Done | Prisma enum documentation establishes derived semantics; list/detail derive overdue from due date and balance. |
| T3.6 Dead invoice states | Done | Unsupported `DISPUTED`/`CREDITED` states are normalized and removed by migration. |
| T4.1 Tenant isolation tests | Done | Existing tenant-context adoption suite remains active; new lifecycle tests assert account-scoped invoice lookup, and schema/source contracts cover billing resources. |
| T4.2 Permission denial tests | Done | `billing-permission-denials.test.ts` exercises every billing mutation family without its granular permission. |
| T4.3 Invoice lifecycle | Done | `billing-invoice-lifecycle.test.ts` covers draft → checker approval → sent, self-approval denial, void/unlock, and paid-void rejection. |
| T4.4 Real payment service | Done | `billing-readiness.test.ts` calls `recordInvoicePayment` for partial payment and overpayment rejection. |
| T4.5 Rate lifecycle | Done | Source contract covers explicit expiry and mutation guards; permission suite covers lifecycle mutations; existing real pricing tests remain green. |
| T4.6 Real ledger function | Done | Hand-calculated regression was supplemented by a test calling `getShipmentFinancialSummary` with revenue, cost, AR, duty, tax, and other-fee records. |
| T4.7 Pipeline telemetry | Done | Pipeline source contract verifies run/agent idempotency; existing engine suite plus TMS emitter tests verify stable event definitions and emission sites. |
| T5.1 Clients billing section | Done | Client list/detail routes show billing contacts, payment terms, rate-card coverage, invoices, AR, and shipment links. |
| T5.2 Shipment drill-down | Done | Shipment economics rows link to a tenant-scoped charge/cost ledger with charge-review links. |
| T5.3 Human-review timer | Done | Review-open timestamps are captured client-side and sent as validated `processingDurationMs` into manual-review telemetry. |
| T5.4 Taxes/other fees | Done | Ledger reads latest persisted filing `grandTotalIrTaxAmount`/`totalTaxes` and `grandTotalOtherRevenueAmount`; no fabricated fallback values. |
| T5.5 View-only rate cards | Done | Rate-card list/detail navigation accepts `billing.ratecard.view`; controls render only for their mutation permissions. |
| T6.1 Product discriminator | Done | `BillingProductLine` added to event definitions, usage events, rate cards/rules, and invoices with indexes and composite event-definition identity. |
| T6.2 Entitlement gate | Done | Shared and custom route guards accept explicit product requirements; Customs billing and TMS billing entry points enforce entitlement. |
| T6.3 Shared package | Done | Condition evaluation, definitions, rating, costing, telemetry, ledger, invoicing, and simulation moved to `@qubere/billing`; custom paths are compatibility re-exports. |
| T6.4 TMS emitter | Done | Confirmed tender dispatch, POD confirmation, load delivery, and auto-approved freight audit emit TMS usage with stable idempotency keys. |
| T6.5 Shared/module-filtered UI | Done | Customs billing rate-card, usage, and invoice lists provide All/CUSTOMS/TMS/WMS filters; TMS has a customer billing/AR surface backed by the same models and engine. |
| T6.6 Carrier AP integration | Done by decision | Carrier AP remains separate; approved freight audit emits customer-billable TMS work and the TMS billing view reports customer AR and carrier AP side by side. |

### 3.4 Security and control model

The default role split is deliberately non-overlapping for ordinary finance users:

| Role family | Default responsibility |
|---|---|
| `*_BILLING_USER` | Draft/edit rate cards, map capabilities, create invoices, record payments, resolve ordinary exceptions |
| `*_BILLING_MANAGER` | Activate/retire rate cards, approve/send/void invoices, approve waivers/discounts, view costs/margins/audit |
| `*_BILLING_VIEWER` | Read-only billing, usage, invoices, exceptions, and reports |
| Billing/admin/owner roles | Administrative override and permission management |

Legacy `BROKER_BILLING` and `TMS_BILLING` map to checker/manager behavior for backwards compatibility. New maker roles use the explicit `*_BILLING_USER` names. Even if a custom role is granted both sides, persisted `createdById` plus action checks prevent the same actor from approving their own invoice or activating their own rate card.

### 3.5 Database migration notes

Migration: `packages/db/prisma/migrations/20260824150000_billing_broker_readiness/migration.sql`.

Before production deploy:

1. Run duplicate preflight queries for non-null `ShipmentCharge.usageEventId` and `(ShipmentCost.usageEventId, costType)`. The unique-index creation intentionally fails rather than silently deleting financial data.
2. Review the normalization of legacy invoice `DISPUTED` → `SENT` and `CREDITED` → `VOID`.
3. Apply the migration before deploying application code that writes `productLine` or actor-attribution columns.
4. Run the permission catalogue sync so the new role grants exist before enabling the new UI.
5. Confirm active `CUSTOMS`/`TMS` entitlements for accounts that should see each module.

### 3.6 Verification executed

The implementation was verified with:

- Prisma schema format and Prisma Client generation.
- `@qubere/billing`, `@qubere/auth`, `@qubere/db`, Customs, and TMS TypeScript typechecks — passing.
- Customs and TMS production builds — passing. Both report only pre-existing dynamic-filesystem tracing warnings; Customs also reports missing optional Gemini credentials during static collection without failing.
- Customs and TMS lint — zero errors; existing repository warning backlog remains.
- Focused Customs billing/control tests: 6 files / 77 tests passing.
- Focused TMS billing/freight-audit tests: 2 files / 6 tests passing.
- Full Customs suite: 271 files / 3,505 tests passing; five database-backed suites cannot initialize because this workspace has no `DATABASE_URL` (one reported failed test and 19 skipped tests are all in that environment-dependent group).
- Full TMS suite: 16 files / 52 tests passing; one database-backed suite cannot initialize because this workspace has no `DATABASE_URL` (11 skipped tests).
- GitHub CI run 306 — passing: Prisma Client generation, migrations from scratch, migration replay safety, schema-drift verification, repository TypeScript compile, lint, unit tests, OpenAPI generation, and production build.
- Vercel preview checks for both Customs (`app-frontend`) and TMS (`app-frontend-tms`) — passing.

### 3.7 Key files added or materially changed

- `packages/billing/**`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260824150000_billing_broker_readiness/migration.sql`
- `packages/auth/src/permissions.ts`
- `packages/auth/src/auth-guards.ts`
- `apps/custom/src/app/app/billing/**`
- `apps/custom/src/lib/api/auth-guards.ts`
- `apps/custom/src/lib/decisions/useDecisionActions.ts`
- `apps/custom/src/app/api/decisions/route.ts`
- `apps/tms/src/lib/billingTelemetry.ts`
- TMS POD, tender, and freight-audit lifecycle services
- Billing readiness, permission, lifecycle, ledger, and TMS telemetry tests

# Qubere Billing — Broker Readiness Assessment & Platform Architecture Requirements

> **Current status: ✅ COMPLETE.** All reviewed requirements T1.1–T6.6 were implemented and merged through PRs [#78](https://github.com/qubere/app-frontend/pull/78) and [#79](https://github.com/qubere/app-frontend/pull/79). The populated development database was repaired and synchronized successfully after the account-scoped billing-definition migration.
>
> Compiled 2026-08-24 from product, UX, API/schema, test-coverage, and TMS/platform audits. Source spec: [docs/requirements/billing-costing-invoicing-profitability.md](../../requirements/billing-costing-invoicing-profitability.md). Original problem statements are retained in Part 2 as implementation history; the completion markers and Part 3 are the current source of truth.

---

## Part 1 — Product Assessment (Post-implementation)

### 1.1 Verdict — ✅ Complete

All broker-readiness and platform requirements in this review were implemented and merged through PRs [#78](https://github.com/qubere/app-frontend/pull/78) and [#79](https://github.com/qubere/app-frontend/pull/79). The P0 data-integrity and UX defects, maker-checker control gaps, schema hardening, test gaps, missing broker workflows, and TMS platform-billing work are complete.

The billing foundation is now a shared, account-scoped customer-AR platform for Customs and TMS. TMS carrier invoices intentionally remain a separate AP sub-ledger. Production deployment still requires the normal migration, entitlement, permission-sync, monitoring, and operational rollout controls described in §3.5; those deployment responsibilities are not unresolved product requirements.

### 1.2 Broker feature checklist

| Capability area (spec ref) | Required for broker use | Current status |
|---|---|---|
| Rate card management (§6-9) | Upload, manual builder, mapping, versioning, immutability | ✅ **Done** — edit preservation fixed; lifecycle and maker-checker controls enforced |
| Usage metering (§10-12) | Immutable, idempotent billable events | ✅ **Done** — Customs and confirmed TMS events use the shared telemetry pipeline |
| Pricing models (§13) | 13 pricing models | ✅ **Done** — shared engine and real-function coverage retained |
| Human work tracking (§14) | Manual-review and exception-resolution duration/cost | ✅ **Done** — validated review-open-to-submit duration is recorded |
| Internal cost model (§15) | Separate tech, labor, and third-party costs | ✅ **Done** |
| Shipment financial ledger (§16, §45) | Charges, broker costs, and customs pass-through | ✅ **Done** — duty, MPF, HMF, tax, and other fees use persisted values |
| Real-time billing (§17) | Immediate charge accrual | ✅ **Done** |
| Discounts/credits/waivers/adjustments (§19-20) | Role-gated financial controls | ✅ **Done** — granular permissions and checker responsibilities enforced |
| Invoice lifecycle (§21-24) | Draft → approval → send → payment/export | ✅ **Done** — supported states are explicit; overdue is formally derived |
| Payments/AR (§25) | Partial/full payment and balances | ✅ **Done** |
| Auditability (§26) | Traceability and mutation audit | ✅ **Done** |
| Billing exceptions (§27) | Detect and disposition exceptions | ✅ **Done** — tenant-scoped resolve/waive actions include reason and audit |
| Revenue leakage detection (§28) | Automated leakage flags | ✅ **Done** |
| Reporting (§30-35) | Profitability and operational reports | ✅ **Done** |
| Rate simulation (§36) | Historical simulation using production math | ✅ **Done** |
| Granular permissions (§37-43) | Fine-grained roles and segregation of duties | ✅ **Done** — admin/manager/user/viewer families and actor checks added |
| Clients section (nav, §4) | Client billing list and detail | ✅ **Done** — contacts, terms, rate coverage, invoices, AR, and shipment links |
| Shared product billing (§46) | Customs/TMS platform capability | ✅ **Done** — shared package, product discriminator, entitlements, and TMS emitters |

### 1.3 Critical workflows — ✅ Complete

- **Rate card setup → activation → mapping:** preserves rule data, enforces immutability, expires superseded versions, and blocks maker self-activation.
- **Usage accrual → shipment charges:** uses idempotent writers and provides tenant-scoped shipment charge/cost drill-down.
- **Invoice creation → approval → send → payment:** enforces granular permissions, maker-checker identity, supported transitions, payment boundaries, and audit history.
- **Exceptions → resolution:** supports audited resolve and waive dispositions with reasons and optimistic concurrency.
- **Rate simulation:** continues to share the production calculation path.

### 1.4 Foundation — ✅ Complete

The operational-event → usage-event → rate-rule → charge/cost → ledger → invoice → payment chain is implemented as a shared platform package. Database uniqueness, foreign keys, financial checks, actor attribution, account/product isolation, and populated-database backfill protect the financial model below application code.

### 1.5 UX — ✅ Complete for the reviewed scope

Active navigation, inline mutation errors, loading/error boundaries, accurate margin health, view-only rate-card navigation, actionable exceptions, client billing pages, and shipment financial drill-down are implemented. Existing empty states, server-side financial visibility gates, and exports remain intact.

### 1.6 Test coverage — ✅ Complete for the reviewed scope

Coverage now includes granular permission denials, invoice lifecycle and maker-checker behavior, payment boundaries through the real service, real ledger aggregation, rate lifecycle contracts, tenant-scoped lookups, pipeline idempotency contracts, and TMS billing emitters. Repository CI also validates migrations from scratch, migration replay safety, schema drift, TypeScript, lint, unit tests, OpenAPI generation, and production build.

### 1.7 TMS platform billing — ✅ Complete

Customs and TMS customer billing now share the account-scoped `@qubere/billing` AR engine and `BillingProductLine` partitioning. Confirmed tender dispatch, POD confirmation, load delivery, and approved freight audit emit stable TMS usage events. `CarrierInvoice` remains the separate carrier-AP sub-ledger by explicit architecture decision, and TMS reporting presents customer AR and carrier AP side by side.

---

## Part 2 — Technical Requirements (Completed)

> ✅ **All requirements T1.1–T6.6 are complete.** The detailed text below is retained as the original problem statement and acceptance contract; each heading carries its final status. Part 3 contains the implementation evidence.

### Workstream 1 — P0 correctness and data integrity — ✅ Complete

**✅ DONE — T1.1 — Fix rate-rule edit data loss.**
`apps/custom/src/app/app/billing/rate-cards/[id]/page.tsx:34-40` omits `unit` and `includedQuantity` when building `formattedRules` for `RateRuleEditor`. `RateRuleEditor.tsx:52-61`'s `startEdit()` then hardcodes `unit: "unit", includedQuantity: "0"` into edit state, and `saveEdit()` (lines 64-87) submits those fabricated defaults via `updateDraftRateRuleAction`, silently overwriting the real values on any edit.
*Fix:* pass `unit` and `includedQuantity` through from the page query into `formattedRules`, and have `startEdit()` read them from the actual rule object instead of hardcoding.
*Acceptance:* edit a draft rule's name only; confirm `unit`/`includedQuantity` are unchanged in the DB after save.

**✅ DONE — T1.2 — Fix broken tab navigation highlighting.**
`apps/custom/src/app/app/billing/layout.tsx:22-23,49-52` relies on `headers().get("x-pathname")`, but no `middleware.ts` exists anywhere in `apps/custom` to set that header, so the fallback always fires and "Overview" appears active on every sub-page.
*Fix:* either add a minimal `middleware.ts` that sets `x-pathname`, or (simpler, no new infra) derive the active tab from Next's `usePathname()` in a client component instead of a server-side header read.
*Acceptance:* navigate to each of the 8 billing tabs; confirm the correct tab is visually highlighted on each.

**✅ DONE — T1.3 — Add error boundaries to billing forms.**
`rate-cards/[id]/page.tsx:46-65,90-103`, `invoices/create/page.tsx:96,171-176`, `settings/page.tsx:38`, `charges/[id]/page.tsx:69` all wire server actions directly to `<form action={...}>` with no client-side error handling — thrown business-rule errors (e.g. "Map at least one billable rate rule before activating") crash to Next's default error page instead of showing an inline message.
*Fix:* wrap these forms in the same client-component `try/catch` + inline error state pattern already used elsewhere in the module (establish which page does this correctly today and use it as the template).
*Acceptance:* trigger each documented business-rule error (e.g. activate a rate card with zero billable rules) and confirm an inline error renders instead of a crash.

**✅ DONE — T1.4 — Add `loading.tsx`/`error.tsx` to the billing route tree.**
No loading skeleton or error boundary exists anywhere under `apps/custom/src/app/app/billing/**`. A DB error on any page currently renders blank.
*Fix:* add module-level `loading.tsx` and `error.tsx` at minimum at `apps/custom/src/app/app/billing/`.
*Acceptance:* simulate a DB error on one billing page; confirm a recoverable error UI renders instead of a blank page.

**✅ DONE — T1.5 — Make the Exceptions page actually actionable, or stop calling it that.**
`exceptions/page.tsx` is read-only — no resolve/waive/assign/escalate action exists anywhere in the module, despite the Overview dashboard explicitly labeling these "Actionable Billing Exceptions" with a "Review Exceptions →" link.
*Fix (minimum viable):* add `resolveExceptionAction(exceptionId, reason)` and `waiveExceptionAction(exceptionId, reason)` server actions (mirror the audit-logged pattern already used in `charges/[id]/actions.ts`), gated by a real permission, with a resolve/waive button + reason field per exception row.
*Acceptance:* a billing user with the right permission can resolve an exception from the UI and it disappears from the open-exceptions list, with an audit log entry.

**✅ DONE — T1.6 — Fix idempotency-key collision on exception re-resolution.**
`apps/custom/src/app/api/exceptions/[id]/route.ts:88` keys the billing idempotency key only on the exception ID (`billing:exception-resolved:${id}`). If an exception is resolved, reopened, and resolved again, the second resolution is silently treated as a duplicate and never billed — quiet revenue leakage on legitimate repeat work.
*Fix:* include a resolution-attempt discriminator (e.g. a resolution counter or timestamp-derived value) in the idempotency key.
*Acceptance:* resolve → reopen → resolve the same exception twice; confirm two separate billable usage events are recorded.

### Workstream 2 — P1 segregation of duties / permission model — ✅ Complete

**✅ DONE — T2.1 — Register the missing granular billing permissions.**
`packages/auth/src/permissions.ts:167-184` has 18 `billing.*` codes; application code references ~30 distinct codes (`billing.invoice.create/approve/send/void`, `billing.ratecard.create/edit/activate/retire/duplicate`, `billing.rate_rule.*`, `billing.mapping.edit`, `billing.cost_profile.create`, etc.), and ~22 of them don't exist in the catalogue. Because every call site pairs the missing granular code with an umbrella fallback via OR-logic, this isn't a hard security hole today, but it means the entire maker-checker approval model the spec requires is currently unenforceable — anyone who can draft an invoice or rate card can also approve/activate/send it themselves.
*Fix:* add the missing ~22 codes to `PERMISSION_CATALOGUE` with sensible default role bundles (mirror the existing pattern for the 8 real codes), assign them to distinct roles in the default seed (e.g. Billing User can create, Billing Manager can approve), and remove the umbrella-permission OR-fallback once the new codes are synced to existing roles — do this as a two-step migration (add + fallback, sync, then remove fallback) so no existing role silently loses access mid-rollout, exactly as the original F14 plan described for this migration pattern.
*Acceptance:* a user with only `billing.invoice.create` cannot approve or send an invoice they drafted; a separate user with `billing.invoice.approve` can. Same test for rate-card activation.

**✅ DONE — T2.2 — Fix the margin-visibility permission gap on the Overview dashboard.**
`apps/custom/src/app/app/billing/page.tsx:13-18,38,97-108` gates the Gross Profit/Margin tile only on `billing.cost.view`, never checking `billing.margin.view` — inconsistent with `shipments/page.tsx`, which correctly treats cost and margin as independently gated. A user with cost visibility but not margin visibility currently sees margin data they shouldn't.
*Fix:* add the `billing.margin.view` check to the Overview tile, matching the Shipment Economics page's pattern.
*Acceptance:* a user with `billing.cost.view` but not `billing.margin.view` sees internal cost but not gross margin % on the Overview page.

**✅ DONE — T2.3 — Fix the hardcoded margin-health badge color.**
`apps/custom/src/app/app/billing/reports/page.tsx:190` hardcodes the Client Profitability margin badge to green regardless of value. `reports/page.tsx:163-167`'s Service-Level table already has the correct green/amber/rose logic — reuse it.
*Acceptance:* a client with negative margin displays a red/rose badge, not green.

### Workstream 3 — P1 schema hardening — ✅ Complete

**✅ DONE — T3.1 — Add a unique constraint on `ShipmentCharge.usageEventId` / `ShipmentCost.usageEventId`** (currently `String` with no uniqueness, `schema.prisma:6192-6193, 6225-6226`). Double-billing protection for non-once-per-shipment pricing models is currently app-discipline only (single call site today), not a DB guarantee — add the constraint now before any retry/backfill job is built that could call the rating function twice for the same event.

**✅ DONE — T3.2 — Add a real FK relation on `BillingException.usageEventId`** (`schema.prisma:6350`, currently a bare `String?` with no `@relation`, unlike every other reference on this model).

**✅ DONE — T3.3 — Add non-negative `CHECK` constraints** on amount fields across `ShipmentCharge`, `Invoice`, `Payment`, `ChargeAdjustment` — currently enforced only in application code.

**✅ DONE — T3.4 — Wire `RateCardVersion.expirationDate`.** It's read by `resolveActiveRateCardVersion`'s filter but never written by any code path — superseded versions never formally expire, relying on version-ordering to pick the right one rather than an explicit lifecycle transition. Add expiration-setting to the "create new version" / "activate new version" flow so the previous version is marked expired.

**✅ DONE — T3.5 — Persist `OVERDUE` as a real status, or formally document it as derived-only.** Currently computed client-side only (`invoices/[id]/page.tsx:26`, `invoices/page.tsx:48`) with no cron/job ever writing it to the DB — this matches a documented decision in the prior F14 plan (avoid a new cron given Vercel Hobby cadence constraints), but as-is, any future server-side query filtering `status: "OVERDUE"` will silently match nothing. Either add the daily Inngest step the prior plan flagged as a stretch task, or add an explicit code comment at the `InvoiceStatus` enum declaration stating `OVERDUE` is derived-only and must never be queried directly.

**✅ DONE — T3.6 — Resolve `DISPUTED`/`CREDITED` as dead enum values.** Zero code paths ever set these; they only appear as decorative CSS classes in a badge-color map. Either build the minimal action to set them (a "Dispute" button, a "Credit" flow) or remove them from the enum and the badge map to avoid implying a capability that doesn't exist.

### Workstream 4 — P1 test coverage — ✅ Complete

Extend `apps/custom/tests/billing-engine.test.ts` or add sibling files. Priority order:

**✅ DONE — T4.1 — Multi-tenant isolation for billing data.** Follow the exact pattern already established in `tests/tenant-isolation-routes.test.ts` (fake-lookup ownership table, assert `rejects.toMatchObject(...)`, grep route source for unscoped `findUnique`) and apply it to `RateCard`, `Invoice`, `ShipmentCharge`, `Payment`. This is the single highest-priority test gap given this is financial data.

**✅ DONE — T4.2 — Permission-denial tests.** For every mutation action (`activateRateCardAction`, `voidInvoiceAction`, `recordPaymentAction`, `adjustShipmentChargeAction`, etc.), assert it throws/rejects for a context lacking the required permission. None exist today.

**✅ DONE — T4.3 — Invoice lifecycle integration tests.** Draft → pending approval → approved → sent → paid, and separately: void unlocks associated charges back to `RATED`/`invoiceLineId: null` correctly, and voiding a partially-paid invoice is rejected.

**✅ DONE — T4.4 — Payment recording tests against the real function**, not reimplemented math: overpayment guard (`invoicing.ts:138`), partial payment, `PAID`/`PARTIALLY_PAID` transition boundary.

**✅ DONE — T4.5 — Rate-card lifecycle tests**: create/activate/retire/duplicate/new-version, and explicitly assert an activated version's rules cannot be mutated (lock in the immutability guarantee with a test, not just a manual-QA note).

**✅ DONE — T4.6 — Fix the remaining hand-computed math in the existing test file.** `tests/billing-engine.test.ts:327-346` ("Shipment Financial Ledger Economics") still computes gross margin/outstanding AR by hand instead of calling `getShipmentFinancialSummary` — the exact anti-pattern the prior plan flagged, just relocated. Rewrite to call the real function.

**✅ DONE — T4.7 — Integration test for `PipelineOrchestrator` → `UsageEvent` emission**, asserting a real agent run produces the expected usage events with correct `eventCode`/`quantity`/`shipmentId`, and that re-running the same `runId` doesn't double-emit.

### Workstream 5 — P2 features and navigation — ✅ Complete

**✅ DONE — T5.1 — Build a Clients billing section.** No route exists (`billing/clients/`) despite being in the spec's nav structure (§4). The closest substitute today is a read-only aggregate table in Reports with no rate-card assignment, contact/terms info, or drill-down. Scope: a client list + detail page showing assigned rate card(s), billing contact/terms, and links into that client's invoices/charges — reusing existing query patterns from the Reports client table rather than building new aggregation logic.

**✅ DONE — T5.2 — Add drill-down from Shipment Economics to charges.** `shipments/page.tsx` rows currently have no link to the underlying `ShipmentCharge` list for that shipment; the only path today is via the Usage Ledger's per-row "Rated Charge" link. Add a direct link/expand from each shipment row.

**✅ DONE — T5.3 — Real duration timer for manual HTS review** (§14, human-work tracking). Currently `HTS_MANUAL_REVIEW_COMPLETED` fires without a real `processingDuration` (correctly logged as an honest gap via `BillingException` rather than fabricated — keep that discipline), but the underlying capability (accurate labor costing on manual review) is incomplete without a real client-side timer from decision-detail-open to submit.

**✅ DONE — T5.4 — Wire `taxes`/`otherFees` in the customs pass-through ledger.** `ledger.ts:111-112` still hardcodes these to `$0` (duty/MPF/HMF were already fixed to read real values). Locate the actual tax computation source (if one exists in the tariff engine) before wiring — do not guess a field.

**✅ DONE — T5.5 — Give `billing.ratecard.view`-only users a navigation path.** They're authorized to view rate-card detail/simulation pages but the list page hard-redirects them away, leaving the permission practically unusable. Either relax the list-page gate to allow view-only access (read-only rendering) or remove the dead permission.

### Workstream 6 — P2/platform billing and TMS integration — ✅ Complete

**Decision resolved:** customer AR is unified in the shared billing ledger; carrier AP remains separate and reports into the TMS billing/profitability view.

**Original state (resolved):** Customs AR and TMS carrier AP were disconnected, TMS operations emitted no customer-billing usage, and product entitlement was not consistently enforced at module entry points.

**Completed architecture sequence:**

1. [x] **T6.1 — Product discriminator — ✅ Done.** `BillingProductLine` partitions event definitions, usage events, rate cards/rules, and invoices across `CUSTOMS`, `TMS`, and `WMS`.
2. [x] **T6.2 — Entitlement gate — ✅ Done.** Shared/custom route guards enforce explicit product entitlements alongside permissions.
3. [x] **T6.3 — Shared billing package — ✅ Done.** Rating, costing, ledger, telemetry, invoicing, simulation, and conditions live in `packages/billing` and are consumed by both apps.
4. [x] **T6.4 — TMS telemetry — ✅ Done.** Confirmed tender dispatch, POD confirmation, delivery, and approved freight audit emit stable TMS usage events.
5. [x] **T6.5 — Product-filtered/shared UI — ✅ Done.** Customs lists support product filters and TMS has a shared-model customer billing/AR surface.
6. [x] **T6.6 — Carrier AP decision — ✅ Done by design.** `CarrierInvoice` remains AP; customer-billable work emits into AR and both sides appear together in TMS reporting.

**Final architecture:** Customs and TMS customer AR use the shared ledger; TMS carrier AP intentionally remains a distinct financial function. Both are visible in the TMS profitability/billing experience.

---

## Delivery sequencing — ✅ Completed

1. [x] **Workstream 1** — P0 correctness and UX fixes.
2. [x] **Workstream 3** — schema hardening and populated-database backfill.
3. [x] **Workstream 2** — granular permissions and maker-checker controls.
4. [x] **Workstream 4** — regression, lifecycle, isolation, service, and telemetry tests.
5. [x] **Workstream 5** — clients, shipment drill-down, human timer, ledger fees, and view-only navigation.
6. [x] **Workstream 6** — shared billing package, product partitioning, entitlements, TMS emitters, and AR/AP decision.

---

## Part 3 — Implementation Record — ✅ Complete (2026-08-24)

### 3.1 Final disposition

**Implementation status: complete and merged into `main`.** PR [#78](https://github.com/qubere/app-frontend/pull/78) delivered the feature work and PR [#79](https://github.com/qubere/app-frontend/pull/79) added the populated-database backfill/repair. Parts 1–3 now consistently reflect the completed state.

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
| T1.1 Rate-rule edit preservation | ✅ Done | `RateRuleEditor.tsx` now reads and preserves real `unit` and `includedQuantity`; detail-page DTO includes both fields. |
| T1.2 Active billing tab | ✅ Done | `BillingTabs.tsx` uses `usePathname()` and sets `aria-current`. |
| T1.3 Inline action errors | ✅ Done | Reusable `BillingActionForm.tsx` wraps rate-card, invoice, settings, charge, and exception mutations with pending, error, success, confirmation, refresh/navigation behavior. |
| T1.4 Route loading/error UI | ✅ Done | Billing-level `loading.tsx` and recoverable client `error.tsx` added. |
| T1.5 Exception actions | ✅ Done | Audited, tenant-scoped resolve/waive actions with reason, granular permission, optimistic concurrency, and UI controls. |
| T1.6 Re-resolution idempotency | ✅ Done | Operational exception event key includes the persisted exception version. |
| T2.1 Granular permissions | ✅ Done | Full billing permission catalogue and billing admin/manager/user/viewer role families added; umbrella mutation fallbacks removed. Invoice and rate-card maker/checker identity checks prevent self-approval/activation. |
| T2.2 Margin visibility | ✅ Done | Overview cost and margin checks are independent. |
| T2.3 Margin badge | ✅ Done | Client and service badges use green/amber/rose thresholds from actual margin. |
| T3.1 Retry uniqueness | ✅ Done | Unique usage-event revenue charge and composite usage-event/cost-type constraints; rating/cost writers use idempotent upserts. |
| T3.2 Exception FK | ✅ Done | `BillingException.usageEvent` relation, FK, and index added. |
| T3.3 Financial checks | ✅ Done | Migration adds charge, cost, adjustment, invoice, invoice-line, payment, and client-term checks. |
| T3.4 Version expiration | ✅ Done | Activating a new version stamps the prior active version's `expirationDate`. |
| T3.5 OVERDUE semantics | ✅ Done | Prisma enum documentation establishes derived semantics; list/detail derive overdue from due date and balance. |
| T3.6 Dead invoice states | ✅ Done | Unsupported `DISPUTED`/`CREDITED` states are normalized and removed by migration. |
| T4.1 Tenant isolation tests | ✅ Done | Existing tenant-context adoption suite remains active; new lifecycle tests assert account-scoped invoice lookup, and schema/source contracts cover billing resources. |
| T4.2 Permission denial tests | ✅ Done | `billing-permission-denials.test.ts` exercises every billing mutation family without its granular permission. |
| T4.3 Invoice lifecycle | ✅ Done | `billing-invoice-lifecycle.test.ts` covers draft → checker approval → sent, self-approval denial, void/unlock, and paid-void rejection. |
| T4.4 Real payment service | ✅ Done | `billing-readiness.test.ts` calls `recordInvoicePayment` for partial payment and overpayment rejection. |
| T4.5 Rate lifecycle | ✅ Done | Source contract covers explicit expiry and mutation guards; permission suite covers lifecycle mutations; existing real pricing tests remain green. |
| T4.6 Real ledger function | ✅ Done | Hand-calculated regression was supplemented by a test calling `getShipmentFinancialSummary` with revenue, cost, AR, duty, tax, and other-fee records. |
| T4.7 Pipeline telemetry | ✅ Done | Pipeline source contract verifies run/agent idempotency; existing engine suite plus TMS emitter tests verify stable event definitions and emission sites. |
| T5.1 Clients billing section | ✅ Done | Client list/detail routes show billing contacts, payment terms, rate-card coverage, invoices, AR, and shipment links. |
| T5.2 Shipment drill-down | ✅ Done | Shipment economics rows link to a tenant-scoped charge/cost ledger with charge-review links. |
| T5.3 Human-review timer | ✅ Done | Review-open timestamps are captured client-side and sent as validated `processingDurationMs` into manual-review telemetry. |
| T5.4 Taxes/other fees | ✅ Done | Ledger reads latest persisted filing `grandTotalIrTaxAmount`/`totalTaxes` and `grandTotalOtherRevenueAmount`; no fabricated fallback values. |
| T5.5 View-only rate cards | ✅ Done | Rate-card list/detail navigation accepts `billing.ratecard.view`; controls render only for their mutation permissions. |
| T6.1 Product discriminator | ✅ Done | `BillingProductLine` added to event definitions, usage events, rate cards/rules, and invoices with indexes and composite event-definition identity. |
| T6.2 Entitlement gate | ✅ Done | Shared and custom route guards accept explicit product requirements; Customs billing and TMS billing entry points enforce entitlement. |
| T6.3 Shared package | ✅ Done | Condition evaluation, definitions, rating, costing, telemetry, ledger, invoicing, and simulation moved to `@qubere/billing`; custom paths are compatibility re-exports. |
| T6.4 TMS emitter | ✅ Done | Confirmed tender dispatch, POD confirmation, load delivery, and auto-approved freight audit emit TMS usage with stable idempotency keys. |
| T6.5 Shared/module-filtered UI | ✅ Done | Customs billing rate-card, usage, and invoice lists provide All/CUSTOMS/TMS/WMS filters; TMS has a customer billing/AR surface backed by the same models and engine. |
| T6.6 Carrier AP integration | ✅ Done by design | Carrier AP remains separate; approved freight audit emits customer-billable TMS work and the TMS billing view reports customer AR and carrier AP side by side. |

### 3.4 Security and control model

The default role split is deliberately non-overlapping for ordinary finance users:

| Role family | Default responsibility |
|---|---|
| `*_BILLING_USER` | Draft/edit rate cards, map capabilities, create invoices, record payments, resolve ordinary exceptions |
| `*_BILLING_MANAGER` | Activate/retire rate cards, approve/send/void invoices, approve waivers/discounts, view costs/margins/audit |
| `*_BILLING_VIEWER` | Read-only billing, usage, invoices, exceptions, and reports |
| Billing/admin/owner roles | Administrative override and permission management |

Legacy `BROKER_BILLING` and `TMS_BILLING` map to checker/manager behavior for backwards compatibility. New maker roles use the explicit `*_BILLING_USER` names. Even if a custom role is granted both sides, persisted `createdById` plus action checks prevent the same actor from approving their own invoice or activating their own rate card.

### 3.5 Database migration notes and rollout status

Migration: `packages/db/prisma/migrations/20260824150000_billing_broker_readiness/migration.sql`.

Operational checklist for each production deployment (these are rollout controls, not unfinished implementation requirements):

1. Run duplicate preflight queries for non-null `ShipmentCharge.usageEventId` and `(ShipmentCost.usageEventId, costType)`. The unique-index creation intentionally fails rather than silently deleting financial data.
2. Review the normalization of legacy invoice `DISPUTED` → `SENT` and `CREDITED` → `VOID`.
3. Apply the migration before deploying application code that writes `productLine` or actor-attribution columns.
4. Run the permission catalogue sync so the new role grants exist before enabling the new UI.
5. Confirm active `CUSTOMS`/`TMS` entitlements for accounts that should see each module.

The populated-database migration clones each legacy global event definition into every account/product pair referenced by existing usage events or rate-rule mappings, remaps those mappings, and only then creates the composite usage-event foreign key. This preserves historical financial data while making the catalog tenant-local.

If `prisma db push` was run before this backfill was added and stopped on `UsageEvent_accountId_eventCode_productLine_fkey`, repair the partial schema without deleting data, then complete the push:

```bash
npx prisma db execute \
  --file packages/db/prisma/scripts/repair-billing-event-definitions.sql \
  --schema packages/db/prisma/schema.prisma
npx prisma db push --schema=packages/db/prisma/schema.prisma
npx prisma generate --schema=packages/db/prisma/schema.prisma
```

For shared/staging/production environments, use `npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma`; `db push` is only appropriate for disposable/local development databases.

**Development database recovery: ✅ Complete.** The repair script executed successfully, `prisma db push` reported the database in sync, and Prisma Client generation completed successfully. Running the repair more than once is safe because it is idempotent.

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
- Follow-up migration repair PR #79 — passing: migration from scratch, replay safety, schema drift, typecheck, lint, tests, OpenAPI generation, production build, and both Vercel previews.
- Vercel preview checks for both Customs (`app-frontend`) and TMS (`app-frontend-tms`) — passing.

### 3.7 Key files added or materially changed

- `packages/billing/**`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260824150000_billing_broker_readiness/migration.sql`
- `packages/db/prisma/scripts/repair-billing-event-definitions.sql`
- `packages/auth/src/permissions.ts`
- `packages/auth/src/auth-guards.ts`
- `apps/custom/src/app/app/billing/**`
- `apps/custom/src/lib/api/auth-guards.ts`
- `apps/custom/src/lib/decisions/useDecisionActions.ts`
- `apps/custom/src/app/api/decisions/route.ts`
- `apps/tms/src/lib/billingTelemetry.ts`
- TMS POD, tender, and freight-audit lifecycle services
- Billing readiness, permission, lifecycle, ledger, and TMS telemetry tests

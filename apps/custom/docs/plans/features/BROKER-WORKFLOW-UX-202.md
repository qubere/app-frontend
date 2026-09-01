# Broker Workflow UX — Issue #202 close-out

Tracking issue: [#202](https://github.com/qubere/app-frontend/issues/202)
Branch: `feat/broker-workflow-ux-202`

The plan of record in #202 (Phases 0–4, ~30 work items) was largely executed
across the Navigation IA redesign (PRs #113–#123) and later work. This document
is the verification pass — what is provably shipped, with file references — plus
the residual gaps this PR closes and the UX pass layered on top.

The user brief for this PR: the Actions queue is a broker's homepage. Brokers
work under filing-deadline pressure with a low margin for error. The surface has
to be fast (keyboard-operable), legible at a glance (every rank explainable), and
honest (human sign-off vs. machine verification never ambiguous).

---

## Verification — what is already shipped

### Phase 0 — foundation

| Item | Status | Evidence |
|---|---|---|
| 0.1 closed `DecisionState` union + `normalizeDecisionStatus` | ✅ | `src/modules/decisions/decisionState.ts` — union, alias table for every legacy literal, `getActionableDecisionWhereFilter`, `isDecisionActionable` |
| 0.1 queue + actions page point at the normalizer | ✅ | `src/modules/work/workQueue.ts:8` imports `actionableStatusVariants`; `src/app/app/actions/page.tsx:6` uses `getAllReviewableDecisionWhereFilter()` |
| 0.1 backfill migration | ✅ | `AgentDecision.triageState` column populated by agents at write time (`decisionState.ts` header) |
| 0.1 test that every agent literal normalizes | ✅ | `src/modules/decisions/decisionState.test.ts` |
| 0.2 `autoApproved` + `autoApprovalPolicy` columns | ✅ | `packages/db/prisma/schema.prisma:1615-1618`, indexed at `:1673` |
| 0.2 one `autoApprovalPolicy` module | ✅ | `src/modules/decisions/autoApprovalPolicy.ts` — `applyAutoApprovalPolicy` → `AUTO \| CONFIRM \| REVIEW`, thresholds in one place, per-account `AgentPolicyConfig` override |
| 0.2 agents stop writing bare `"Approved"` | ✅ | grep of `src/modules/agents/*.ts`: writers now emit `"Needs Review"` / `"AUTO_VERIFIED"` (e.g. `htsClassificationAgent.ts:474`) |

### Phase 1 — server-computed state

| Item | Status | Evidence |
|---|---|---|
| 1.1 `triageState` + `blockedReason` columns | ✅ | `schema.prisma:1608,1612`, `@@index([triageState])`, `@@index([accountId, triageState, createdAt])` |
| 1.1 client-side categorizers deleted | ✅ | `triageDecision()` in `decisionState.ts` reads the column; `workQueue.ts:296` calls it |
| 1.2 `partMasterMatch` pure module | ✅ | `src/modules/product/partMasterMatch.ts` |
| 1.2 wired into auto-approval | ✅ | `autoApprovalPolicy.ts:87` — part-master disagreement forces `REVIEW`, outranks confidence |
| 1.3 versioned resolution-reason picklist | ✅ | `src/modules/exceptions/resolutionReasons.ts` keyed by exception `category`; `ExceptionItem.resolutionReasonCode` at `schema.prisma:3047` |

### Phase 2 — queue is the homepage

| Item | Status | Evidence |
|---|---|---|
| 2.1 `filingDeadline` column, derived at ingest | ✅ | `schema.prisma:693` (`min(dueAt)` over OPEN blocking `ComplianceDeadline`), `@@index([filingDeadline])` |
| 2.1 value-at-risk | ✅ | `workQueue.ts` `DecisionRow.valueAtRisk` / `ExceptionRow.valueAtRisk` — sum of `ShipmentLineItem.totalValue` |
| 2.1 explicit tested scoring function | ✅ | `workQueue.ts:153` `computeB1Score` = `1/(hoursToDeadline+1) · log10(value+1) · blockingMultiplier`, blended with legacy signals; `tests/work-queue.test.ts` |
| 2.2 `/app` renders the queue | ✅ | `src/app/app/page.tsx` → `/app/actions`; `src/app/page.tsx:13` redirects authed users to `/app` |
| 2.3 `/app/decisions` + `/app/exceptions` redirect | ✅ | both are `permanentRedirect(/app/actions?…)` preserving `decisionId`/`exceptionId`/`shipmentId` |
| 2.3 verbs stay distinct on the item | ✅ | Approve/Reject vs Resolve/Waive in `ActionsClient`; waive gated on `RISK_ACCEPTANCE_PERMISSION` with mandatory reason |

### Phase 3 — provenance + bulk

| Item | Status | Evidence |
|---|---|---|
| 3.1 machine-read `ExtractionField` rows persisted | ✅ | `src/modules/agents/documentIntelligenceAgent.ts` writes `ExtractionField` (fieldName, value, confidence, pageNumber, bbox, source) |
| 3.1 pdf.js canvas + highlight layer | ✅ | `src/components/DocumentReviewPanel.tsx` — `PdfCanvas` + absolutely-positioned bbox layer, replaces the iframe |
| 3.1 two-pane, click-to-provenance | ✅ | `DocumentReviewPanel.tsx:781-811` — clicking a proposal jumps to its page/bbox; `initialFieldName` deep-link from the Actions screen |
| 3.1 degrade honestly with no bbox | ✅ | `DocumentReviewPanel.tsx:1332` "location not recorded" fallback |
| 3.2 bulk endpoints, per-row audit | ✅ | `src/app/api/decisions/bulk/route.ts`, `src/app/api/exceptions/bulk/route.ts` — per-decision permission + `AuditLog`, partial-success `{ succeeded, failed }` |
| 3.2 selection state + confirm dialog | ✅ | `ActionsClient.tsx` — `selectedDecisionIds`, `BulkConfirmDialog` with override count, select-all-in-bucket |

### Phase 4 — second reader + metrics

| Item | Status | Evidence |
|---|---|---|
| 4.1 provenance computed by the API | ✅ | `src/modules/decisions/reviewAuthority.ts` `decisionProvenance` — reviewer identity + broker license |
| 4.1 provenance rendered on the card | ⚠️ **gap** | `ActionsClient.tsx` `ProvenanceFooter` renders confidence + reviewer name, but reads `reviewer.brokerLicenseNumber` which `actions/page.tsx:143` never selects — license never shows. Auto-verified copy is also confusing. |
| 4.2 `metrics.ts` + `WorkMetricSnapshot` table | ✅ | `src/lib/analytics/metricComputer.ts`, `schema.prisma:6033`, `src/lib/inngest/functions/dailyWorkMetricSnapshot.ts` (cron `0 1 * * *`) |
| 4.2 touch rate | ⚠️ **partial** | `metricComputer.ts:115` computes `humanCorrected / totalFields` from `ExtractionField` rows — reconstructed after the fact, not recorded when the queue presented the work (the spec's explicit requirement) |
| 4.2 cycle time / first-pass / deadline margin / duty saved | ✅ | all in `metricComputer.ts`, null-safe (never fabricated) |

---

## Residual gaps this PR closes

1. **4.1 — provenance on the card is incomplete.** `actions/page.tsx` must select
   `brokerLicenseNumber` on `reviewedByUser` and thread it through the serialized
   decision + `ActionItem` type. Human sign-off ("Approved by Sarah Chen, License
   #12345, Aug 11 14:32") and machine verification ("Auto-verified · policy
   hts-auto-v1 · 94% · part-master match") must be visually unmistakable.

2. **1.3.4 — decision `REJECT` has no reason code.** `humanNotes` is mandatory
   (`api/decisions/route.ts:325`) but there is no structured code beside it.
   Add `src/modules/decisions/rejectionReasons.ts` (versioned picklist) +
   `AgentDecision.rejectionReasonCode`, validate on the `REJECT` path and the
   bulk path, surface it in the reject UI.

3. **4.2.2 — touch-rate denominator.** Record line-items-presented at queue
   render time (`WorkPresentationEvent` or a counter on the snapshot) so the
   metric has a real denominator instead of being reconstructed from whatever
   `ExtractionField` rows happen to exist.

## UX pass (layered on the verified surface)

- **Explainable rank** — every shipment row and every card carries a one-line
  "why is this here / why now": `Files in 6h · $412k declared · blocks entry`.
  A rank a broker can read aloud to their manager.
- **Keyboard-first triage** — `j/k` move between shipments, `a` approve focused
  card, `r` reject, `e` re-evaluate, `x` toggle select, `?` shortcut help. Clear
  a queue without touching the mouse.
- **Provenance chip redesign** — replace "not approved — auto-verified pending
  next audit" with a scannable badge; hover reveals policy id, confidence band,
  part-master basis.
- **Delight & resilience** — optimistic actions with an undo toast, live-ticking
  countdown chips, a genuine "inbox zero" empty state, skeleton loaders,
  `prefers-reduced-motion` support, `aria-live` on the queue count.

## Sequencing / commits

1. This doc + issue comment.
2. Gap 1 (provenance select + type + card redesign).
3. Gap 2 (rejection reason code: schema, module, API, UI).
4. Gap 3 (touch-rate presentation counter).
5. UX: explainable rank chip.
6. UX: keyboard triage + help overlay.
7. UX: empty state, skeletons, undo toast, motion polish.
8. Tests + verification screenshots.

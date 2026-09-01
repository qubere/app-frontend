# TMS Pipeline: Modular Multi-Agent Architecture Documentation

This document describes the modular refactoring of the TMS Pipeline from a 1,000-line monolith into single-purpose agent persona files with explicit evidence lineage and outbox idempotency.

---

## 1. Overview & Directory Structure

```
apps/tms/src/modules/agents/
├── shared/
│   └── pipelineShared.ts          # Shared types (StepResult, JobState), memory context builders, 
│                                   # evidence lineage, decision logging, & constants.
├── services/
│   ├── documentIntakeAgent.ts        # Step 1: Document Intake Agent Persona
│   ├── shipmentEnrichmentAgent.ts    # Step 2: Shipment Enrichment Agent Persona
│   ├── documentReadinessAgent.ts     # Step 3: Document Readiness Agent Persona
│   ├── movementReadinessAgent.ts     # Step 4: Movement Readiness Agent Persona
│   ├── costCarrierReadinessAgent.ts  # Step 5: Cost & Carrier Readiness Agent Persona
│   ├── operationalRiskAgent.ts       # Step 6: Operational Risk Agent Persona
│   └── operationalAgents.ts          # Tracking & ETA Agent
└── tmsPipelineOrchestrator.ts      # Pipeline Orchestrator with STEP_RUNNERS_BY_NUMBER
                                     # key lookup & outbox transactional enqueueing.
```

---

## 2. Re-export Shim (`apps/tms/src/lib/tmsPipelineEngine.ts`)

To ensure **zero breaking changes** across the 8 external call sites (API routes, outbox, and Inngest jobs), `tmsPipelineEngine.ts` exports all top-level methods directly from the orchestrator:

```ts
export {
  enqueueTmsDocumentPipeline,
  executeTmsPipelineJob,
  getTmsPipelineStatus,
  retryTmsPipeline,
  TMS_WORKFLOW_TYPE,
  TMS_WORKFLOW_VERSION,
  TMS_PIPELINE_OUTBOX_EVENT,
  TMS_PIPELINE_STEPS,
} from "../modules/agents/tmsPipelineOrchestrator";
```

---

## 3. Step-Runner Dispatch Map

Instead of positional array indexing, `tmsPipelineOrchestrator.ts` uses explicit key mapping:

```ts
const STEP_RUNNERS_BY_NUMBER: Record<number, StepRunner> = {
  1: runDocumentIntake,
  2: runShipmentEnrichment,
  3: runDocumentReadiness,
  4: runMovementReadiness,
  5: runCostCarrierReadiness,
  6: runOperationalRisk,
};
```

---

## 4. Operational Principles Preserved

- **Idempotency**: Scoped by `${TMS_WORKFLOW_VERSION}:${shipmentId}:${documentId}:${runKey}` with compound unique key handling.
- **Evidence Lineage**: Every agent records memory contexts via `buildStepMemory()` and populates `evidenceItems` using `memoryLineage()`.
- **Stateless Agent Files**: Each `services/<step>Agent.ts` exports its clean step function and is testable in isolation.

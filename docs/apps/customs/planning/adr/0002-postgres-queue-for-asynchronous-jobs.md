# ADR 0002: PostgreSQL-Backed Queue Engine (`PgQueue`)

## Status
Approved

## Context
Background job execution is required for multi-modal OCR extraction, asynchronous AI HTS classification cases, and HTSUS release ingestion. Introducing third-party external queue services (such as Redis/BullMQ or Inngest SaaS) adds operational complexity, external dependencies, and network overhead.

## Decision
1. We use PostgreSQL as the primary queue engine via `PgQueue` using `FOR UPDATE SKIP LOCKED`.
2. `PipelineJob` table acts as the durable job queue with ACID transactional guarantees.
3. Workers claim jobs atomically with row locks, update step states, and handle dead-letter retries cleanly within PostgreSQL transactions.
4. If scaling throughput exceeds database queue capabilities in the future, the worker producer/consumer contract remains unchanged while swapping the underlying `PgQueue` driver behind `src/lib/queue/`.

## Consequences
- Single source of truth for application state and background queue in PostgreSQL.
- Zero extra external infrastructure dependencies required.
- Full transactional guarantees during job enqueue and execution.

## Current status (2026-09)

`PgQueue`/`PipelineJob` (`apps/custom/src/lib/queue/pgQueue.ts`) is still live for the pipeline
orchestration this ADR targeted (OCR extraction, classification cases, agent pipelines — see
`pipelineOrchestrator.ts`, `classificationCaseEngine.ts`). However, the codebase has since adopted
Inngest (`apps/custom/src/lib/inngest/`) as a second background-job engine for a different class of
work: long-running/scheduled ingestion and sweep jobs that would exceed a request-scoped cron's
timeout (OFAC SDN ingestion, HTS refresh, SLA sweep, compliance report runs, account memory
extraction, restricted-party search-token backfill). This is exactly the kind of "third-party
external queue service" this ADR's Context argued against — the two engines now coexist rather
than one superseding the other, split by job shape (transactional row-locked work stays on
`PgQueue`; long-running/durable-cron work moved to Inngest). The original decision and its
reasoning above are preserved as written for `PgQueue`'s actual scope.

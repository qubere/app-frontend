-- Deadline-recompute race: concurrent recomputeShipmentDeadlines calls could
-- both pass the find-then-create check in deadline.service.ts before either
-- insert landed, producing duplicate open ExceptionItem rows for the same
-- (shipmentId, code). Collapse existing duplicates, keeping the oldest row
-- per group, then enforce the invariant at the DB level so the race can no
-- longer produce them going forward.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "shipmentId", code
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "ExceptionItem"
  WHERE "shipmentId" IS NOT NULL
    AND code LIKE 'DEADLINE_%'
    AND status <> 'Resolved'
)
UPDATE "ExceptionItem" e
SET status = 'Resolved',
    "resolvedAt" = now(),
    "resolvedBy" = 'SYSTEM',
    "resolvedByName" = 'DeadlineMonitor',
    "resolutionNote" = 'Auto-resolved: duplicate of another open exception with the same code, created by a concurrent recompute race'
FROM ranked
WHERE e.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "ExceptionItem_shipmentId_code_open_deadline_key"
  ON "ExceptionItem" ("shipmentId", code)
  WHERE "shipmentId" IS NOT NULL AND code LIKE 'DEADLINE_%' AND status <> 'Resolved';

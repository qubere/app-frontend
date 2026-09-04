import { db, isDataMode } from '@qubere/db';
import type { Prisma } from '@prisma/client';

/** Called only after shipment authorization. Raw SQL must repeat every tenant,
 * data-mode and publication constraint because ORM isolation does not
 * apply to $queryRaw. Compute the boolean in PostgreSQL rather than transferring
 * every line's evidence, findings and duty stack just to summarize costs. */
export async function loadPublishedProofCosts(
  ctx: { accountId: string; dataMode?: string | null }, shipmentId: string,
) {
  const mode = isDataMode(ctx.dataMode) ? ctx.dataMode : 'PRODUCTION';
  return db.$queryRaw<Array<{ dutyAndFeesUsd: Prisma.Decimal; complete: boolean }>>`
    SELECT p."dutyAndFeesUsd", NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p."payload"->'lines') AS line,
           jsonb_array_elements(line.value->'dutyStack') AS duty
      WHERE duty.value->>'status' IN ('NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED')
    ) AS complete
    FROM "EntryProof" p
    JOIN "CustomsFiling" f ON f.id = p."filingId" AND f."accountId" = p."accountId"
    JOIN "Account" a ON a.id = p."accountId"
    WHERE p."accountId" = ${ctx.accountId}
      AND a."dataMode"::text = ${mode}
      AND p."shipmentId" = ${shipmentId}
      AND f."shipmentId" = ${shipmentId}
      AND p.status = 'PUBLISHED'
      AND f."customerVisibleAt" IS NOT NULL
  `;
}

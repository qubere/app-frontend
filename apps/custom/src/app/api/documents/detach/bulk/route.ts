import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(100),
});

/**
 * Detaches many documents from their shipments in one call. Each document is
 * left intact (extractedJson, parse versions, file) so it can be reattached
 * later. Per-document results are returned so a partial failure does not lose
 * the successes.
 */
export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const parsed = await parseAndValidateBody(req, bodySchema, requestId);
  if ("response" in parsed) return parsed.response;

  const ids = Array.from(new Set(parsed.data.documentIds));

  const docs = await db.shipmentDocument.findMany({
    where: { id: { in: ids }, accountId: ctx.accountId },
    select: { id: true, fileName: true, shipmentId: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));

  const detached: string[] = [];
  const skipped: Array<{ documentId: string; reason: string }> = [];

  for (const id of ids) {
    const doc = byId.get(id);
    if (!doc) {
      skipped.push({ documentId: id, reason: "Not found in this account" });
      continue;
    }
    if (!doc.shipmentId) {
      skipped.push({ documentId: id, reason: "Already detached" });
      continue;
    }
    await db.shipmentDocument.update({ where: { id }, data: { shipmentId: null } });
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "document.detach",
      entity: "ShipmentDocument",
      entityId: id,
      source: "UI",
      metadata: { fileName: doc.fileName, previousShipmentId: doc.shipmentId, bulk: true },
      success: true,
    });
    detached.push(id);
  }

  return NextResponse.json({ detached, skipped, requestId });
}, { permission: { any: ["document.update", "documents.create"] }, write: true });

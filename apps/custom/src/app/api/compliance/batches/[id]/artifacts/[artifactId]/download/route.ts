/** GET /api/compliance/batches/:id/artifacts/:artifactId/download -- tenant-checked signed URL; never exposes the raw storage key. */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";
import { createAuditLog, AuditAction } from "@/lib/audit";

export const GET = withAuthenticatedRoute<{ id: string; artifactId: string }>(
  async ({ params, ctx, requestId }) => {
    const { id: batchId, artifactId } = params;

    const artifact = await db.batchArtifact.findFirst({
      where: { id: artifactId, batchId, accountId: ctx.accountId },
    });
    if (!artifact) {
      return NextResponse.json({ error: "Batch artifact not found", requestId }, { status: 404 });
    }

    let downloadUrl: string;
    try {
      downloadUrl = await createSignedReadUrl(artifact.storageKey, new Date(Date.now() + 15 * 60 * 1000));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create download link.", requestId },
        { status: 500 }
      );
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_DOWNLOADED,
      entity: "BatchArtifact",
      entityId: artifact.id,
      source: "UI",
      metadata: { batchId, fileName: artifact.originalFileName },
      requestId,
    });

    return NextResponse.json({ downloadUrl, fileName: artifact.originalFileName, mimeType: artifact.mimeType, requestId });
  },
  { permission: "compliance.bulk_screening.download" }
);

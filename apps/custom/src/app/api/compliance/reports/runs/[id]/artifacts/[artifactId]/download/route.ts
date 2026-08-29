import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

/** Secure download: tenant-checked, expiry-checked, never exposes the raw storage key. */
export const GET = withAuthenticatedRoute<{ id: string; artifactId: string }>(async ({ ctx, params }) => {
  const { id: runId, artifactId } = params;

  const artifact = await db.reportArtifact.findFirst({
    where: { id: artifactId, reportRunId: runId, accountId: ctx.accountId },
  });

  if (!artifact || artifact.deletedAt) {
    return NextResponse.json({ error: "Report artifact not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  if (artifact.expiresAt && artifact.expiresAt.getTime() < Date.now() && !artifact.retentionHold) {
    return NextResponse.json({ error: "Report artifact has expired.", code: "EXPIRED" }, { status: 410 });
  }

  let downloadUrl: string;
  try {
    downloadUrl = await createSignedReadUrl(artifact.storageKey, new Date(Date.now() + 15 * 60 * 1000));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create download link.", code: "STORAGE_ERROR" },
      { status: 500 }
    );
  }

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "COMPLIANCE_REPORT_ARTIFACT_DOWNLOADED",
    entity: "ReportArtifact",
    entityId: artifact.id,
    source: "UI",
    metadata: { reportRunId: runId, fileName: artifact.fileName },
  });

  return NextResponse.json({ downloadUrl, fileName: artifact.fileName, mimeType: artifact.mimeType });
}, { permission: "compliance.reports.generate" });

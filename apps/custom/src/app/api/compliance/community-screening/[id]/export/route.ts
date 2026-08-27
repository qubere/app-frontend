/**
 * GET /api/compliance/community-screening/[id]/export?format=csv|xlsx
 *
 * Downloads a run's per-party results as CSV or XLSX.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { buildCommunityScreeningExport } from "@/modules/compliance/communityScreening/export";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";
    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json({ error: "Unsupported format. Use ?format=csv|xlsx", requestId }, { status: 400 });
    }

    const exportResult = await buildCommunityScreeningExport(ctx.accountId, params.id, format);
    if (!exportResult) {
      return NextResponse.json({ error: "Community screening run not found", requestId }, { status: 404 });
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.COMMUNITY_SCREENING_EXPORTED,
      entity: "CommunityScreeningRun",
      entityId: params.id,
      source: "UI",
      metadata: { format },
      requestId,
    });

    return new Response(exportResult.body, {
      headers: {
        "Content-Type": exportResult.contentType,
        "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
      },
    });
  },
  { permission: "compliance.community_screening.read" }
);

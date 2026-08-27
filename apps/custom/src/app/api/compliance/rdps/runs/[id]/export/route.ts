/**
 * GET /api/compliance/rdps/runs/[id]/export
 *
 * Downloads the tenant-scoped slice of a run's outcomes as CSV.
 */
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { buildRdpsRunExport } from "@/modules/compliance/rdps/rdpsExport";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const exportResult = await buildRdpsRunExport(ctx.accountId, params.id);

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.RDPS_RUN_EXPORTED,
      entity: "RdpsRun",
      entityId: params.id,
      source: "UI",
      metadata: { format: "csv" },
      requestId,
    });

    return new Response(exportResult.body, {
      headers: {
        "Content-Type": exportResult.contentType,
        "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
      },
    });
  },
  { permission: "compliance.rdps.read" }
);

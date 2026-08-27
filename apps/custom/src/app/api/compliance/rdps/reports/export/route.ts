/**
 * GET /api/compliance/rdps/reports/export
 *
 * Downloads the tenant's RDPS reports summary + open alerts as CSV.
 */
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { buildRdpsReportsExport } from "@/modules/compliance/rdps/rdpsExport";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const exportResult = await buildRdpsReportsExport(ctx.accountId);

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.RDPS_REPORTS_EXPORTED,
      entity: "RdpsReportsSummary",
      entityId: ctx.accountId,
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

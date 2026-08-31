import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { FiveOhSixService } from "@/modules/onboarding/fiveOhSix.service";
import { buildFiveOhSixPdfBuffer } from "@/lib/pdf/fiveOhSixPdf";
import type { FiveOhSixPayload } from "@/modules/onboarding/fiveOhSix.service";

export const GET = withAuthenticatedRoute<{ caseId: string; recordId: string }>(
  async ({ params, ctx, requestId }) => {
    try {
      const record = await FiveOhSixService.getRecord(ctx.accountId, params.caseId, params.recordId);
      const payload = record.payload as unknown as FiveOhSixPayload;
      const pdfBuffer = buildFiveOhSixPdfBuffer(payload, params.caseId);

      // Fire-and-forget: mark as generated
      FiveOhSixService.markGenerated(
        ctx.accountId,
        params.caseId,
        params.recordId,
        `/api/onboarding/cases/${params.caseId}/5106/${params.recordId}/pdf`,
        ctx.userId
      ).catch(() => {});

      const safeName = payload.legalName.replace(/[^a-zA-Z0-9]/g, "-");
      const filename = `CBP-5106-${safeName}-${params.recordId.slice(-6)}.pdf`;

      return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(pdfBuffer.length),
          "Cache-Control": "no-store",
        },
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Record not found", undefined, requestId);
      return buildErrorResponse(
        500,
        "INTERNAL_ERROR",
        errorMessage(error) || "Failed to generate PDF",
        undefined,
        requestId
      );
    }
  },
  { permission: "onboarding.manage" }
);

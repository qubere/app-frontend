import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { importTemplateCsv } from "@/modules/filingConfig/codeListCsv";

/** GET /api/filing-config/code-list/template -- downloadable CSV column template. */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  return new Response(importTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="qubere-filing-code-list-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
});

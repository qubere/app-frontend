import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { DuplicateConfigRowError } from "@/modules/filingConfig/registry";
import { listHeaders, createHeader, headerCreateSchema, DomainCodeListError } from "@/modules/filingConfig/codeListService";

function requirePlatformAdmin(isPlatformAdmin: boolean, requestId: string) {
  if (!isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }
  return null;
}

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
  if (forbidden) return forbidden;

  const rows = await listHeaders();
  return NextResponse.json({ rows, requestId });
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
    if (forbidden) return forbidden;

    const body = await parseAndValidateBody(req, headerCreateSchema, requestId);
    if ("response" in body) return body.response;

    try {
      const row = await createHeader(body.data, ctx.userId ?? "system");
      return NextResponse.json({ row, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof DuplicateConfigRowError) {
        return buildErrorResponse(409, "DUPLICATE_ROW", err.message, undefined, requestId);
      }
      if (err instanceof DomainCodeListError) {
        return buildErrorResponse(400, "INVALID_REFERENCE", err.message, undefined, requestId);
      }
      throw err;
    }
  },
  { write: true }
);

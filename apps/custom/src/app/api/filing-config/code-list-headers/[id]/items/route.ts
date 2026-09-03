import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { DuplicateConfigRowError, ConfigRowNotFoundError } from "@/modules/filingConfig/registry";
import { listItems, createItem, itemCreateSchema, DomainCodeListError } from "@/modules/filingConfig/codeListService";

type Params = { id: string };

function requirePlatformAdmin(isPlatformAdmin: boolean, requestId: string) {
  if (!isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }
  return null;
}

/** GET /api/filing-config/code-list-headers/[id]/items -- items + translations under one header. */
export const GET = withAuthenticatedRoute<Params>(async ({ ctx, params, requestId }) => {
  const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
  if (forbidden) return forbidden;

  const rows = await listItems(params.id);
  return NextResponse.json({ rows, requestId });
});

export const POST = withAuthenticatedRoute<Params>(
  async ({ req, ctx, params, requestId }) => {
    const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
    if (forbidden) return forbidden;

    const body = await parseAndValidateBody(req, itemCreateSchema, requestId);
    if ("response" in body) return body.response;

    try {
      const row = await createItem(params.id, body.data, ctx.userId ?? "system");
      return NextResponse.json({ row, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof DuplicateConfigRowError) {
        return buildErrorResponse(409, "DUPLICATE_ROW", err.message, undefined, requestId);
      }
      if (err instanceof ConfigRowNotFoundError) {
        return buildErrorResponse(404, "NOT_FOUND", "The code list header no longer exists.", undefined, requestId);
      }
      if (err instanceof DomainCodeListError) {
        return buildErrorResponse(400, "INVALID_REFERENCE", err.message, undefined, requestId);
      }
      throw err;
    }
  },
  { write: true }
);

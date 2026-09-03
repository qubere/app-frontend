import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { DuplicateConfigRowError, ConfigRowNotFoundError } from "@/modules/filingConfig/registry";
import { updateHeader, deleteHeader, headerUpdateSchema, DomainCodeListError } from "@/modules/filingConfig/codeListService";

type Params = { id: string };

function requirePlatformAdmin(isPlatformAdmin: boolean, requestId: string) {
  if (!isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }
  return null;
}

export const PATCH = withAuthenticatedRoute<Params>(
  async ({ req, ctx, params, requestId }) => {
    const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
    if (forbidden) return forbidden;

    const body = await parseAndValidateBody(req, headerUpdateSchema, requestId);
    if ("response" in body) return body.response;

    try {
      const row = await updateHeader(params.id, body.data, ctx.userId ?? "system");
      return NextResponse.json({ row, requestId });
    } catch (err) {
      if (err instanceof DuplicateConfigRowError) {
        return buildErrorResponse(409, "DUPLICATE_ROW", err.message, undefined, requestId);
      }
      if (err instanceof ConfigRowNotFoundError) {
        return buildErrorResponse(404, "NOT_FOUND", err.message, undefined, requestId);
      }
      if (err instanceof DomainCodeListError) {
        return buildErrorResponse(400, "INVALID_REFERENCE", err.message, undefined, requestId);
      }
      throw err;
    }
  },
  { write: true }
);

export const DELETE = withAuthenticatedRoute<Params>(
  async ({ ctx, params, requestId }) => {
    const forbidden = requirePlatformAdmin(ctx.isPlatformAdmin, requestId);
    if (forbidden) return forbidden;

    try {
      await deleteHeader(params.id);
      return NextResponse.json({ requestId });
    } catch (err) {
      if (err instanceof ConfigRowNotFoundError) {
        return buildErrorResponse(404, "NOT_FOUND", err.message, undefined, requestId);
      }
      throw err;
    }
  },
  { write: true }
);

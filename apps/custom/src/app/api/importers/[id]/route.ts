import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { ImporterClientLinkError, linkImporterClient } from "@/modules/importers/importerClientLink.service";

const pathSchema = z.object({ id: z.string().min(1) });
const patchSchema = z.object({
  clientId: z.string().min(1),
  confirmHistoricalReassignment: z.boolean().optional().default(false),
}).strict();

export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params, requestId }) => {
  const path = validatePathParams(params, pathSchema, requestId);
  if ("response" in path) return path.response;

  const body = await parseAndValidateBody(req, patchSchema, requestId);
  if ("response" in body) return body.response;

  try {
    const result = await linkImporterClient({
      accountId: ctx.accountId,
      importerId: path.data.id,
      clientId: body.data.clientId,
      userId: ctx.userId,
      requestId,
      confirmHistoricalReassignment: body.data.confirmHistoricalReassignment,
    });
    return NextResponse.json({ ...result, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImporterClientLinkError) {
      if (error.code === "NOT_FOUND") {
        return buildErrorResponse(404, error.code, error.message, undefined, requestId);
      }
      return buildErrorResponse(409, error.code, error.message, error.details, requestId);
    }
    throw error;
  }
}, { permission: "parties.manage", write: true });

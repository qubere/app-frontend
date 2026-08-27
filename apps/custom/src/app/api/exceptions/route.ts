import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validateQueryParams } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { ExceptionService } from "@/modules/exceptions/exception.service";
import { InvalidCursorError } from "@/lib/api/keysetCursor";
import { PerfTimer } from "@/lib/perf/serverTiming";
import { z } from "zod";

const querySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  assignedToMe: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  // Bounded here so a hostile/broken caller can't ask for the whole table.
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  // Opt-in: a COUNT over every exception in the account is a second round
  // trip most list consumers don't need.
  withCount: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const queryVal = validateQueryParams(req.url, querySchema, requestId);
  if ("response" in queryVal) return queryVal.response;

  const { status, severity, assignedToMe, limit, cursor, withCount } = queryVal.data;
  const perf = new PerfTimer();

  let result;
  try {
    result = await perf.span("db.exceptions.list", () =>
      ExceptionService.listExceptions(
        ctx.accountId,
        ctx.userId,
        { status, severity, assignedToMe },
        { limit, cursor, withCount },
      ),
    );
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      return buildErrorResponse(400, "INVALID_CURSOR", err.message, undefined, requestId);
    }
    throw err;
  }

  return NextResponse.json(
    {
      exceptions: result.exceptions,
      metadata: result.metadata,
      pagination: result.pagination,
      requestId,
    },
    { headers: perf.headers() },
  );
});

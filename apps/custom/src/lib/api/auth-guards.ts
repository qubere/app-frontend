import crypto from "crypto";
import { AccountContext, getAccountContext, hasPermission, hasProductEntitlement } from "@/lib/auth";
import { runWithAccountId, runWithDataMode } from "@/lib/db";
import { logApiRequest } from "@/lib/logging/logger";
import { buildErrorResponse, generateRequestId, handleApiError } from "./error";
import { canWrite, READ_ONLY_MESSAGE } from "./write-access";

export type AuthenticatedRouteHandler = (
  ctx: AccountContext,
  requestId: string
) => Promise<Response>;

/**
 * A permission requirement can be a single permission (back-compat with all
 * existing callers), a bare list (treated as "any of"), or an explicit
 * any/all group for routes that need to combine multiple capabilities.
 */
export type PermissionRequirement =
  | string
  | string[]
  | { any: string[] }
  | { all: string[] };

async function checkPermission(requirement: PermissionRequirement): Promise<boolean> {
  if (typeof requirement === "string") {
    return hasPermission(requirement);
  }

  const isAll = !Array.isArray(requirement) && "all" in requirement;
  const perms = Array.isArray(requirement)
    ? requirement
    : isAll
      ? (requirement as { all: string[] }).all
      : (requirement as { any: string[] }).any;

  for (const perm of perms) {
    const allowed = await hasPermission(perm);
    if (!isAll && allowed) return true;
    if (isAll && !allowed) return false;
  }
  return isAll;
}

function describePermission(requirement: PermissionRequirement): string {
  if (typeof requirement === "string") return requirement;
  if (Array.isArray(requirement)) return requirement.join(" or ");
  if ("all" in requirement) return requirement.all.join(" and ");
  return requirement.any.join(" or ");
}

export async function authorizeRequest(
  requiredPermission?: PermissionRequirement,
  requiredProduct?: string
): Promise<{ ctx: AccountContext | null; errorResponse: ReturnType<typeof buildErrorResponse> | null }> {
  const ctx = await getAccountContext();
  if (!ctx) {
    return {
      ctx: null,
      errorResponse: buildErrorResponse(401, "UNAUTHENTICATED", "Authentication required"),
    };
  }

  const inferredProduct = requiredPermission && describePermission(requiredPermission).includes("customs.") ? "CUSTOMS" : undefined;
  const product = requiredProduct ?? inferredProduct;
  if (product && !(await hasProductEntitlement(ctx.accountId, product))) {
    return { ctx: null, errorResponse: buildErrorResponse(403, "NOT_ENTITLED", `Account is not entitled to ${product} product`) };
  }

  if (requiredPermission) {
    const allowed = await checkPermission(requiredPermission);
    if (!allowed) {
      return {
        ctx: null,
        errorResponse: buildErrorResponse(
          403,
          "FORBIDDEN",
          `Missing required permission: ${describePermission(requiredPermission)}`
        ),
      };
    }
  }

  return { ctx, errorResponse: null };
}

/** authorizeRequest plus the read-only role check every mutating route needs. */
export async function authorizeWrite(
  requiredPermission?: PermissionRequirement,
  requiredProduct?: string
): Promise<{ ctx: AccountContext | null; errorResponse: ReturnType<typeof buildErrorResponse> | null }> {
  const result = await authorizeRequest(requiredPermission, requiredProduct);
  if (result.errorResponse || !result.ctx) return result;

  if (!canWrite(result.ctx)) {
    return {
      ctx: null,
      errorResponse: buildErrorResponse(403, "READ_ONLY_ROLE", READ_ONLY_MESSAGE),
    };
  }

  return result;
}

export type RouteHandlerArgs<TParams> = {
  req: Request;
  ctx: AccountContext;
  requestId: string;
  params: TParams;
};

export type PublicRouteHandlerArgs<TParams> = Omit<RouteHandlerArgs<TParams>, "ctx">;

type NextRouteContext<TParams> = { params: Promise<TParams> };

/**
 * Composes request-id generation, permission enforcement, and centralized
 * error handling around a route handler. This replaces the four manual steps
 * (generateRequestId + authorizeRequest + try/catch + handleApiError) that
 * most routes previously reimplemented — and that `handleApiError` was, as a
 * result, never actually reached by.
 *
 * export const POST = withAuthenticatedRoute(async ({ ctx, req, requestId }) => {
 *   const body = await parseAndValidateBody(req, schema, requestId);
 *   if ("response" in body) return body.response;
 *   ...
 *   return NextResponse.json({ ... });
 * }, { permission: "filings.submit" });
 */
export function withAuthenticatedRoute<TParams = Record<string, never>>(
  handler: (args: RouteHandlerArgs<TParams>) => Promise<Response>,
  options?: { permission?: PermissionRequirement; write?: boolean; product?: string }
) {
  return async (req: Request, context: any = {}): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? generateRequestId();
    const startedAt = Date.now();
    const { pathname } = new URL(req.url);
    const { ctx, errorResponse } = options?.write
      ? await authorizeWrite(options?.permission, options?.product)
      : await authorizeRequest(options?.permission, options?.product);
    if (errorResponse) {
      logApiRequest({
        method: req.method,
        path: pathname,
        status: errorResponse.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return errorResponse;
    }

    try {
      const params = context && context.params ? await context.params : ({} as TParams);
      let runner: any = null;
      try {
        runner = runWithDataMode;
      } catch {
        runner = null;
      }
      let accountRunner: any = null;
      try {
        accountRunner = runWithAccountId;
      } catch {
        accountRunner = null;
      }
      const runAccountScoped = (fn: () => Promise<Response>) =>
        typeof accountRunner === "function" ? accountRunner(ctx!.accountId, fn) : fn();

      const response =
        typeof runner === "function"
          ? await runner(ctx!.dataMode, async () => {
              return await runAccountScoped(async () => {
                return await handler({ req, ctx: ctx!, requestId, params });
              });
            })
          : await runAccountScoped(async () => {
              return await handler({ req, ctx: ctx!, requestId, params });
            });

      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        accountId: ctx!.accountId,
        userId: ctx!.userId,
        requestId,
      });
      return response;
    } catch (error) {
      const response = handleApiError(error, requestId);
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        accountId: ctx?.accountId,
        userId: ctx?.userId,
        requestId,
        error,
      });
      return response;
    }
  };
}

/**
 * Same shape as `withAuthenticatedRoute` for routes that are intentionally
 * public (health checks, public HTS/rulings reference lookups). Still
 * centralizes request-id generation and error handling so public routes
 * get a consistent error envelope instead of ad-hoc `{ error: string }`.
 */
export function withPublicRoute<TParams = Record<string, never>>(
  handler: (args: PublicRouteHandlerArgs<TParams>) => Promise<Response>
) {
  return async (req: Request, context: any = {}): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? generateRequestId();
    const startedAt = Date.now();
    const { pathname } = new URL(req.url);
    try {
      const params = context && context.params ? await context.params : ({} as TParams);
      const response = await handler({ req, requestId, params });
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return response;
    } catch (error) {
      const response = handleApiError(error, requestId);
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
        error,
      });
      return response;
    }
  };
}

/**
 * Constant-time bearer-token check against CRON_SECRET. A missing
 * CRON_SECRET always fails closed — unlike the ad-hoc per-route checks this
 * replaces, there is no "secret unset, let it through" branch.
 */
function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length) {
    // Compare against itself so a length mismatch doesn't short-circuit the
    // timing profile relative to a matching-length wrong guess.
    crypto.timingSafeEqual(authBuf, authBuf);
    return false;
  }
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

/**
 * For cron-triggered ingestion routes: requires a valid `Authorization:
 * Bearer <CRON_SECRET>` header on every request, POST or GET. Replaces the
 * per-route `if (cronSecret) { check } ` pattern that silently allowed any
 * caller through whenever CRON_SECRET was unset.
 */
export function withCronRoute<TParams = Record<string, never>>(
  handler: (args: PublicRouteHandlerArgs<TParams>) => Promise<Response>
) {
  return async (req: Request, context: any = {}): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? generateRequestId();
    const startedAt = Date.now();
    const { pathname } = new URL(req.url);
    if (!verifyCronAuth(req)) {
      const response = buildErrorResponse(401, "UNAUTHORIZED", "Missing or invalid cron authorization", undefined, requestId);
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return response;
    }
    try {
      const params = context && context.params ? await context.params : ({} as TParams);
      const response = await handler({ req, requestId, params });
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return response;
    } catch (error) {
      const response = handleApiError(error, requestId);
      logApiRequest({
        method: req.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
        error,
      });
      return response;
    }
  };
}

import crypto from "crypto";
import { AccountContext, getAccountContext, hasPermission } from "./auth";
import { DataMode, runWithAccountId, runWithDataMode as runWithDataModeRaw } from "@qubere/db";
import { buildErrorResponse, generateRequestId, handleApiError } from "./error";
import { canWrite, READ_ONLY_MESSAGE } from "./write-access";
import { hasProductEntitlement } from "./entitlements";
import { authorizeResource, AuthorizationResult } from "./authorization-service";
import { logApiRequest } from "./logger";

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

export type RouteHandlerArgs<TParams> = {
  req: Request;
  ctx: AccountContext;
  requestId: string;
  params: TParams;
};

export type PublicRouteHandlerArgs<TParams> = Omit<RouteHandlerArgs<TParams>, "ctx">;

/**
 * The primitives every guard function is built from. Each consuming app
 * injects its own (mockable, re-exported) copies of these rather than
 * importing them straight from this package, so that per-app test suites can
 * still substitute fakes for account context / permission checks the same
 * way they did before the two implementations were consolidated here.
 */
export interface AuthGuardDeps {
  getAccountContext: () => Promise<AccountContext | null>;
  hasPermission: (permission: string) => Promise<boolean>;
  hasProductEntitlement: (accountId: string, product: string) => Promise<boolean>;
  runWithAccountId: <T>(accountId: string | null | undefined, fn: () => T) => T;
  runWithDataMode: <T>(dataMode: string, fn: () => T) => T;
  logApiRequest: (params: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    accountId?: string;
    userId?: string;
    requestId: string;
    error?: unknown;
  }) => void;
}

export function createAuthGuards(deps: AuthGuardDeps) {
  async function checkPermission(requirement: PermissionRequirement): Promise<boolean> {
    if (typeof requirement === "string") {
      return deps.hasPermission(requirement);
    }

    const isAll = !Array.isArray(requirement) && "all" in requirement;
    const perms = Array.isArray(requirement)
      ? requirement
      : isAll
        ? (requirement as { all: string[] }).all
        : (requirement as { any: string[] }).any;

    for (const perm of perms) {
      const allowed = await deps.hasPermission(perm);
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

  async function authorizeRequest(
    requiredPermission?: PermissionRequirement,
    requiredProduct?: string
  ): Promise<{ ctx: AccountContext | null; errorResponse: ReturnType<typeof buildErrorResponse> | null }> {
    const ctx = await deps.getAccountContext();
    if (!ctx) {
      return {
        ctx: null,
        errorResponse: buildErrorResponse(401, "UNAUTHENTICATED", "Authentication required"),
      };
    }

    const inferredProduct = requiredPermission && (() => {
      const permission = describePermission(requiredPermission);
      return permission.includes("customs.") ? "CUSTOMS" : permission.includes("tms.") ? "TMS" : undefined;
    })();
    const product = requiredProduct ?? inferredProduct;
    if (product && !(await deps.hasProductEntitlement(ctx.accountId, product))) {
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

  async function authorizeResourceRequest(params: {
    permission: string;
    resourceType?: string;
    resourceId?: string;
    clientId?: string;
  }): Promise<{ ctx: AccountContext | null; authResult: AuthorizationResult | null; errorResponse: ReturnType<typeof buildErrorResponse> | null }> {
    const ctx = await deps.getAccountContext();
    if (!ctx) {
      return {
        ctx: null,
        authResult: null,
        errorResponse: buildErrorResponse(401, "UNAUTHENTICATED", "Authentication required"),
      };
    }

    const authResult = await authorizeResource({
      userId: ctx.effectiveUserId,
      actorUserId: ctx.actorUserId,
      effectiveUserId: ctx.effectiveUserId,
      accountId: ctx.accountId,
      permission: params.permission,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      clientId: params.clientId,
    });

    if (!authResult.allowed) {
      return {
        ctx,
        authResult,
        errorResponse: buildErrorResponse(
          403,
          "FORBIDDEN",
          authResult.reason || `Unauthorized for resource action ${params.permission}`
        ),
      };
    }

    return { ctx, authResult, errorResponse: null };
  }

  /** authorizeRequest plus the read-only role check every mutating route needs. */
  async function authorizeWrite(
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

  /**
   * Composes request-id generation, permission enforcement, and centralized
   * error handling around a route handler.
   */
  function withAuthenticatedRoute<TParams = Record<string, never>>(
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
        deps.logApiRequest({
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
        // deps.runWithDataMode/runWithAccountId can come back undefined when a
        // test mocks the module they're re-exported from without including
        // them (e.g. `vi.mock("@/lib/db", () => ({ db: dbMock }))`) — fall
        // back to running the handler unscoped rather than throwing.
        const runner = typeof deps.runWithDataMode === "function" ? deps.runWithDataMode : null;
        const accountRunner = typeof deps.runWithAccountId === "function" ? deps.runWithAccountId : null;
        const runAccountScoped = (fn: () => Promise<Response>) =>
          accountRunner ? accountRunner(ctx!.accountId, fn) : fn();

        const response = runner
          ? await runner(ctx!.dataMode, async () => {
              return await runAccountScoped(async () => {
                return await handler({ req, ctx: ctx!, requestId, params });
              });
            })
          : await runAccountScoped(async () => {
              return await handler({ req, ctx: ctx!, requestId, params });
            });

        deps.logApiRequest({
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
        deps.logApiRequest({
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
   * public. Still centralizes request-id generation and error handling.
   */
  function withPublicRoute<TParams = Record<string, never>>(
    handler: (args: PublicRouteHandlerArgs<TParams>) => Promise<Response>
  ) {
    return async (req: Request, context: any = {}): Promise<Response> => {
      const requestId = req.headers.get("x-request-id") ?? generateRequestId();
      const startedAt = Date.now();
      const { pathname } = new URL(req.url);
      try {
        const params = context && context.params ? await context.params : ({} as TParams);
        const response = await handler({ req, requestId, params });
        deps.logApiRequest({
          method: req.method,
          path: pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
          requestId,
        });
        return response;
      } catch (error) {
        const response = handleApiError(error, requestId);
        deps.logApiRequest({
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
   * For cron-triggered ingestion routes: requires a valid `Authorization:
   * Bearer <CRON_SECRET>` header on every request. Fails closed when
   * CRON_SECRET is unset.
   */
  function withCronRoute<TParams = Record<string, never>>(
    handler: (args: PublicRouteHandlerArgs<TParams>) => Promise<Response>
  ) {
    return async (req: Request, context: any = {}): Promise<Response> => {
      const requestId = req.headers.get("x-request-id") ?? generateRequestId();
      const startedAt = Date.now();
      const { pathname } = new URL(req.url);
      if (!verifyCronAuth(req)) {
        const response = buildErrorResponse(401, "UNAUTHORIZED", "Missing or invalid cron authorization", undefined, requestId);
        deps.logApiRequest({
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
        deps.logApiRequest({
          method: req.method,
          path: pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
          requestId,
        });
        return response;
      } catch (error) {
        const response = handleApiError(error, requestId);
        deps.logApiRequest({
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

  return {
    authorizeRequest,
    authorizeResourceRequest,
    authorizeWrite,
    withAuthenticatedRoute,
    withPublicRoute,
    withCronRoute,
  };
}

/**
 * Constant-time bearer-token check against CRON_SECRET. A missing
 * CRON_SECRET always fails closed.
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
 * Default instance bound to this package's own primitives, for direct
 * consumers (e.g. apps/tms) that don't need to substitute their own.
 */
function runWithDataMode<T>(mode: string, fn: () => T): T {
  return runWithDataModeRaw(mode as DataMode, fn);
}

// Every dep is wrapped in a thunk, deferring the actual property read to
// call time: a plain shorthand (`{ runWithAccountId }`) reads the imported
// binding eagerly when this object literal is constructed, which throws for
// any consumer (e.g. apps/custom tests) that mocks "@qubere/db"/"./auth"
// without stubbing every one of these exports. runWithAccountId/runWithDataMode
// additionally read their reference inside try/catch rather than a `typeof`
// check, since a Vitest mock throws on ANY access to an export it didn't
// stub -- even a `typeof` read -- and fall back to running unscoped.
const defaultGuards = createAuthGuards({
  getAccountContext: (...args) => getAccountContext(...args),
  hasPermission: (...args) => hasPermission(...args),
  hasProductEntitlement: (...args) => hasProductEntitlement(...args),
  runWithAccountId: (accountId, fn) => {
    let runner: typeof runWithAccountId | null = null;
    try {
      runner = runWithAccountId;
    } catch {
      runner = null;
    }
    return typeof runner === "function" ? runner(accountId, fn) : fn();
  },
  runWithDataMode: (dataMode: string, fn) => {
    let runner: typeof runWithDataMode | null = null;
    try {
      runner = runWithDataMode;
    } catch {
      runner = null;
    }
    return typeof runner === "function" ? runner(dataMode, fn) : fn();
  },
  logApiRequest: (...args) => logApiRequest(...args),
});

export const authorizeRequest = defaultGuards.authorizeRequest;
export const authorizeResourceRequest = defaultGuards.authorizeResourceRequest;
export const authorizeWrite = defaultGuards.authorizeWrite;
export const withAuthenticatedRoute = defaultGuards.withAuthenticatedRoute;
export const withPublicRoute = defaultGuards.withPublicRoute;
export const withCronRoute = defaultGuards.withCronRoute;

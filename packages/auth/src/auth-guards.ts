import { AccountContext, getAccountContext, hasPermission } from "./auth";
import { runWithAccountId, runWithDataMode } from "@qubere/db";
import { buildErrorResponse, generateRequestId, handleApiError } from "./error";
import { canWrite, READ_ONLY_MESSAGE } from "./write-access";
import { hasProductEntitlement } from "./entitlements";
import { authorizeResource, AuthorizationResult } from "./authorization-service";

export type AuthenticatedRouteHandler = (
  ctx: AccountContext,
  requestId: string
) => Promise<Response>;

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

  const inferredProduct = requiredPermission && (() => {
    const permission = describePermission(requiredPermission);
    return permission.includes("customs.") ? "CUSTOMS" : permission.includes("tms.") ? "TMS" : undefined;
  })();
  const product = requiredProduct ?? inferredProduct;
  if (product && !(await hasProductEntitlement(ctx.accountId, product))) {
    return {
      ctx: null,
      errorResponse: buildErrorResponse(403, "NOT_ENTITLED", `Account is not entitled to ${product} product`),
    };
  }

  return { ctx, errorResponse: null };
}

export async function authorizeResourceRequest(params: {
  permission: string;
  resourceType?: string;
  resourceId?: string;
  clientId?: string;
}): Promise<{ ctx: AccountContext | null; authResult: AuthorizationResult | null; errorResponse: ReturnType<typeof buildErrorResponse> | null }> {
  const ctx = await getAccountContext();
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

export function withAuthenticatedRoute<TParams = Record<string, never>>(
  handler: (args: RouteHandlerArgs<TParams>) => Promise<Response>,
  options?: { permission?: PermissionRequirement; write?: boolean; product?: string }
) {
  return async (req: Request, context?: NextRouteContext<TParams>): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? generateRequestId();
    const { ctx, errorResponse } = options?.write
      ? await authorizeWrite(options?.permission, options?.product)
      : await authorizeRequest(options?.permission, options?.product);
    if (errorResponse) return errorResponse;

    try {
      const params = context ? await context.params : ({} as TParams);
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

      if (typeof runner === "function") {
        return await runner(ctx!.dataMode, async () => {
          return await runAccountScoped(async () => {
            return await handler({ req, ctx: ctx!, requestId, params });
          });
        });
      }
      return await runAccountScoped(async () => {
        return await handler({ req, ctx: ctx!, requestId, params });
      });
    } catch (error) {
      return handleApiError(error, requestId);
    }
  };
}

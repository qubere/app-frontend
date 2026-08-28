import { db } from "@qubere/db";
import { getAccountContext, AccountContext } from "./auth";
import { getEffectiveUserScope, UserScope } from "./scope-engine";
import { buildErrorResponse } from "./error";

export interface PortalAuthOptions {
  permission: string;
  resourceAccountId: string;
  resourceClientId?: string | null;
  importerName?: string | null;
  portalVisibility?: string | null; // e.g. "CUSTOMER" vs "INTERNAL"
  customerVisibleAt?: Date | null;   // for published filings/entries
}

export interface PortalAuthResult {
  authorized: boolean;
  ctx: AccountContext | null;
  scope: UserScope | null;
  effectiveClientId: string | null;
  errorResponse: ReturnType<typeof buildErrorResponse> | null;
}

/**
 * Fail-closed portal resource authorization engine.
 * Ensures the target resource:
 * 1. Matches active user's accountId.
 * 2. Resolves to a non-null clientId (or resolves via importerName/authorizedClientIds).
 * 3. Fall within user's assigned client scope (authorizedClientIds).
 * 4. Meets customer visibility requirements (not internal-only or draft/unpublished).
 * Returns uniform 404 response on any authorization failure to prevent data enumeration.
 */
export async function authorizePortalResource(
  options: PortalAuthOptions
): Promise<PortalAuthResult> {
  const ctx = await getAccountContext();
  if (!ctx) {
    return {
      authorized: false,
      ctx: null,
      scope: null,
      effectiveClientId: null,
      errorResponse: buildErrorResponse(401, "UNAUTHENTICATED", "Authentication required"),
    };
  }

  // 1. AccountId isolation check
  if (options.resourceAccountId !== ctx.accountId) {
    return {
      authorized: false,
      ctx,
      scope: null,
      effectiveClientId: null,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  // 2. Resolve effective user scope
  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);

  // 3. Client ownership check - if resource has no explicit clientId, attempt resolution from importerName
  let resourceClientId = options.resourceClientId;
  if (!resourceClientId && options.importerName) {
    const matchingClient = await db.client.findFirst({
      where: {
        accountId: ctx.accountId,
        name: { contains: options.importerName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (matchingClient) {
      resourceClientId = matchingClient.id;
    }
  }

  if (!resourceClientId) {
    return {
      authorized: false,
      ctx,
      scope,
      effectiveClientId: null,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  // 4. Verify client scope authorization
  if (!scope.isAllClients && !scope.authorizedClientIds.includes(resourceClientId)) {
    return {
      authorized: false,
      ctx,
      scope,
      effectiveClientId: resourceClientId,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  // 5. Visibility check
  if (options.portalVisibility && options.portalVisibility !== "CUSTOMER") {
    return {
      authorized: false,
      ctx,
      scope,
      effectiveClientId: resourceClientId,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  if (options.customerVisibleAt === null) {
    return {
      authorized: false,
      ctx,
      scope,
      effectiveClientId: resourceClientId,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  return {
    authorized: true,
    ctx,
    scope,
    effectiveClientId: resourceClientId,
    errorResponse: null,
  };
}

/**
 * Checks if the user has Porter View permission covering both Importers and Exporters.
 * Granted if user has 'porter', 'portal.porter', or 'portal.access' permissions.
 */
export function hasPorterAccess(ctx: AccountContext | null): boolean {
  if (!ctx) return false;
  const userPermissions = ctx.permissions || [];
  return (
    userPermissions.includes("porter") ||
    userPermissions.includes("portal.porter") ||
    userPermissions.includes("portal.access") ||
    ctx.roleNames.some((r) => r.startsWith("CUSTOMER_") || ["OWNER", "ADMIN", "BROKER_ADMIN", "TMS_ADMIN"].includes(r.toUpperCase()))
  );
}

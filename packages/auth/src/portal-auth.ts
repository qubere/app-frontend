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

  // 1. Permission check — the caller's role must actually grant the action being
  // performed. Platform admins and account owners/admins short-circuit; everyone
  // else (including read-only CUSTOMER_VIEWER) must hold the named permission.
  if (options.permission && !hasRequiredPortalPermission(ctx, options.permission)) {
    return {
      authorized: false,
      ctx,
      scope: null,
      effectiveClientId: null,
      errorResponse: buildErrorResponse(404, "NOT_FOUND", "Resource not found"),
    };
  }

  // 2. AccountId isolation check
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

export interface PortalClientScopeResult {
  /**
   * Client ids to filter list queries to.
   *  - `string[]` (possibly empty): restrict to exactly these ids. `[]` => return nothing.
   *  - `null`: no client restriction (all-clients role, no specific client requested).
   */
  clientIds: string[] | null;
  /** The caller asked for a client they are not authorized to see. */
  forbidden: boolean;
}

/**
 * Resolves the effective client filter for a portal LIST endpoint, given the caller's
 * scope and an optional caller-supplied `clientId`. Callers MUST treat `forbidden` as
 * a hard 403 and MUST apply `clientIds` as `{ clientId: { in: clientIds } }` when it is
 * not null. A caller-supplied `clientId` is never trusted on its own.
 * See docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md (P0-3/P0-5/P0-6).
 */
export function resolvePortalClientScope(
  scope: { isAllClients: boolean; authorizedClientIds: string[] },
  requestedClientId?: string | null
): PortalClientScopeResult {
  if (requestedClientId) {
    if (!scope.isAllClients && !scope.authorizedClientIds.includes(requestedClientId)) {
      return { clientIds: [], forbidden: true };
    }
    return { clientIds: [requestedClientId], forbidden: false };
  }
  if (scope.isAllClients) {
    return { clientIds: null, forbidden: false };
  }
  // Scoped user, no specific client requested: restrict to assignments. Empty
  // assignments => empty result (fail closed), never the whole account.
  return { clientIds: scope.authorizedClientIds, forbidden: false };
}

/**
 * True when the context holds `permission`, or is an account owner/admin or platform
 * admin (who implicitly hold every portal permission).
 */
export function hasRequiredPortalPermission(ctx: AccountContext, permission: string): boolean {
  if (ctx.isPlatformAdmin) return true;
  const roleNames = ctx.roleNames || [];
  if (roleNames.some((r) => ["OWNER", "ADMIN", "BROKER_ADMIN", "TMS_ADMIN"].includes(r.toUpperCase()))) {
    return true;
  }
  return (ctx.permissions || []).includes(permission);
}

/**
 * Checks if the user has Porter View permission covering both Importers and Exporters.
 * Granted if user has 'portal.porter' or 'portal.access' permissions.
 */
export function hasPorterAccess(ctx: AccountContext | null): boolean {
  if (!ctx) return false;
  const userPermissions = ctx.permissions || [];
  return (
    userPermissions.includes("portal.porter") ||
    userPermissions.includes("portal.access") ||
    ctx.roleNames.some((r) => r.startsWith("CUSTOMER_") || ["OWNER", "ADMIN", "BROKER_ADMIN", "TMS_ADMIN"].includes(r.toUpperCase()))
  );
}

import { db } from "@qubere/db";
import { getAccountContext, AccountContext } from "./auth";
import { getEffectiveUserScope, type UserScope } from "./scope-engine";
import { buildErrorResponse } from "./error";

export interface PortalAuthOptions {
  permission: string;
  resourceAccountId: string;
  resourceClientId?: string | null;
  /**
   * Importer of record for the target resource. Used to resolve the owning
   * client when the resource itself has no `clientId` (legacy shipments /
   * documents). Ownership is only inferred from an unambiguous link.
   */
  importerOfRecordId?: string | null;
  importerName?: string | null;
  portalVisibility?: string | null; // Legacy document metadata; workspace membership governs reads.
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
 * The customer's portal workspace is the Client (or Clients) they are assigned
 * to via UserClientAssignment / TeamClientAssignment — resolved by
 * getEffectiveUserScope. One broker Account holds many client workspaces, so
 * account membership alone is NOT the read boundary: a CUSTOMER_* user must
 * only ever see the clients in their scope (scope-engine P0-4). Broker / admin
 * roles resolve to all-clients. Callers still combine the result with
 * ctx.accountId on every query.
 */
export async function getPortalWorkspaceScope(
  ctx: Pick<AccountContext, 'accountId' | 'userId' | 'roleNames'>,
): Promise<UserScope> {
  if (!ctx.accountId) throw new Error('Authenticated workspace is required');
  return getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
}

/**
 * Resolve the owning client for a resource that has no explicit clientId, using
 * its importer of record. Returns null when the importer is unlinked or its
 * onboarding cases point at more than one client (conflicting links need a
 * broker correction, not a guess).
 */
async function resolveImporterClientId(
  accountId: string,
  importerOfRecordId: string,
): Promise<string | null> {
  const importer = await db.importerOfRecord.findFirst({
    where: { id: importerOfRecordId, accountId },
    select: {
      clientId: true,
      onboardingEntities: {
        where: { case: { status: { not: 'withdrawn' }, clientId: { not: null } } },
        select: { case: { select: { clientId: true } } },
      },
    },
  });
  if (!importer) return null;
  if (importer.clientId) return importer.clientId;
  const ids = [...new Set(importer.onboardingEntities.flatMap((e) => (e.case.clientId ? [e.case.clientId] : [])))];
  return ids.length === 1 ? ids[0] : null;
}

/** Enforce workspace membership, action permission and filing publication. */
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

  const scope = await getPortalWorkspaceScope(ctx);

  // 3. Client workspace check. Resolve the owning client (directly, or from the
  // importer of record for legacy null-client records) and confirm it is in the
  // caller's scope. Broker / admin (all-clients) skip this.
  let resourceClientId = options.resourceClientId ?? null;
  if (!resourceClientId && options.importerOfRecordId) {
    resourceClientId = await resolveImporterClientId(ctx.accountId, options.importerOfRecordId);
  }
  if (!scope.isAllClients && (!resourceClientId || !scope.authorizedClientIds.includes(resourceClientId))) {
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
 * Optional client filtering. Portal callers supply getPortalWorkspaceScope(ctx),
 * then always combine the result with ctx.accountId. Legacy scoped callers still
 * fail closed for unassigned client filters. Never use a requested client ID as
 * a substitute for the authenticated workspace predicate.
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

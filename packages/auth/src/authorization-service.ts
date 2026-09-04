import { db } from "@qubere/db";
import { getEffectiveUserScope, UserScope } from "./scope-engine";
import { PERMISSION_CATALOGUE } from "./permissions";

export interface AuthorizationRequest {
  userId: string;
  actorUserId?: string;
  effectiveUserId?: string;
  accountId: string;
  permission: string;
  resourceType?: string;
  resourceId?: string;
  clientId?: string;
  organizationId?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  actorUserId: string;
  effectiveUserId: string;
  accountId: string;
  clientId?: string;
  permissions: string[];
  scope: UserScope;
}

/**
 * Centralized authorization engine.
 * Determines whether a principal (or impersonated user) is authorized to perform
 * an action on a specific resource in an organization within their scope.
 */
export async function authorizeResource(req: AuthorizationRequest): Promise<AuthorizationResult> {
  const {
    userId,
    actorUserId = userId,
    effectiveUserId = userId,
    accountId,
    permission: requiredPermission,
    resourceType,
    resourceId,
    clientId: requestedClientId,
    organizationId,
  } = req;

  // 1. Verify organizationId match if specified
  if (organizationId && organizationId !== accountId) {
    return {
      allowed: false,
      reason: "Organization ID mismatch.",
      actorUserId,
      effectiveUserId,
      accountId,
      permissions: [],
      scope: { isAllClients: false, authorizedClientIds: [], teamIds: [] },
    };
  }

  // 2. Fetch target effective user's account membership & roles
  const effectiveUser = await db.user.findUnique({
    where: { id: effectiveUserId },
    include: {
      platformRoles: { include: { platformRole: true } },
      memberships: {
        where: { accountId, status: "ACTIVE", account: { status: "ACTIVE", deletedAt: null } },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!effectiveUser || effectiveUser.memberships.length === 0) {
    return {
      allowed: false,
      reason: "User has no active membership in target organization.",
      actorUserId,
      effectiveUserId,
      accountId,
      permissions: [],
      scope: { isAllClients: false, authorizedClientIds: [], teamIds: [] },
    };
  }

  const membership = effectiveUser.memberships[0];
  const platformRoleNames = effectiveUser.platformRoles.map((pr) => pr.platformRole.name);
  const roleNames = membership.roles.map((mr) => mr.role.name);

  const isPlatformAdmin = platformRoleNames.some((r) =>
    ["PLATFORM_ADMIN", "SUPER_ADMIN_READWRITE", "SUPER_ADMIN_READ", "SUPER_ADMIN_SETTINGS"].includes(r)
  );

  // Collect effective permissions (union of all assigned roles)
  const permissions = Array.from(
    new Set(
      membership.roles.flatMap((mr) => mr.role.rolePermissions.map((rp) => rp.permission.name))
    )
  );

  // 3. Permission check
  const isOwner = roleNames.includes("OWNER");
  const hasPerm = isPlatformAdmin || isOwner || permissions.includes(requiredPermission);

  if (!hasPerm) {
    return {
      allowed: false,
      reason: `Missing required permission: ${requiredPermission}`,
      actorUserId,
      effectiveUserId,
      accountId,
      permissions,
      scope: { isAllClients: false, authorizedClientIds: [], teamIds: [] },
    };
  }

  // 4. Calculate effective scope
  const scope = await getEffectiveUserScope(effectiveUserId, accountId, [
    ...platformRoleNames,
    ...roleNames,
  ]);

  // 5. Client Scope & Resource Ownership Check
  let targetClientId = requestedClientId;

  // If resourceId and resourceType are supplied without explicit clientId, lookup resource ownership
  if (!targetClientId && resourceId && resourceType) {
    targetClientId = await lookupResourceClientId(resourceType, resourceId, accountId);
  }

  if (targetClientId && !scope.isAllClients) {
    const isClientInScope = scope.authorizedClientIds.includes(targetClientId);
    if (!isClientInScope) {
      return {
        allowed: false,
        reason: `Resource belongs to client ${targetClientId} which is outside user's authorized scope.`,
        actorUserId,
        effectiveUserId,
        accountId,
        clientId: targetClientId,
        permissions,
        scope,
      };
    }
  }

  return {
    allowed: true,
    actorUserId,
    effectiveUserId,
    accountId,
    clientId: targetClientId,
    permissions,
    scope,
  };
}

async function lookupResourceClientId(
  resourceType: string,
  resourceId: string,
  accountId: string
): Promise<string | undefined> {
  try {
    const type = resourceType.toLowerCase();
    if (type === "shipment") {
      const s = await db.shipment.findFirst({
        where: { id: resourceId, accountId },
        select: { clientId: true },
      });
      return s?.clientId ?? undefined;
    }
    if (type === "transportationorder" || type === "order") {
      const o = await db.transportationOrder.findFirst({
        where: { id: resourceId, accountId },
        select: { clientId: true },
      });
      return o?.clientId ?? undefined;
    }
    if (type === "customsfiling" || type === "entry") {
      const f = await db.customsFiling.findFirst({
        where: { id: resourceId, accountId },
        select: { shipment: { select: { clientId: true } } },
      });
      return f?.shipment?.clientId ?? undefined;
    }
    if (type === "shipmentdocument" || type === "document") {
      const d = await db.shipmentDocument.findFirst({
        where: { id: resourceId, accountId },
        select: { shipment: { select: { clientId: true } } },
      });
      return d?.shipment?.clientId ?? undefined;
    }
    if (type === "client") {
      return resourceId;
    }
  } catch (err) {
    console.error("Resource client lookup error:", err);
  }
  return undefined;
}

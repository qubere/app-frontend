import { db } from "@qubere/db";

export interface UserScope {
  isAllClients: boolean;
  authorizedClientIds: string[];
  teamIds: string[];
  authorizedShipmentIds?: string[] | null; // null means no shipment-level restriction (all client shipments)
}

/**
 * Resolves the effective client/team/shipment scope for a user within an account.
 * Broker Admin, TMS Admin, and Platform Admins have ALL_CLIENTS access.
 * Customer Users & Shipment Contacts have access restricted to assigned clients
 * and specific shipments assigned by the broker.
 */
const userScopeCache = new Map<string, { scope: UserScope; time: number }>();

export async function getEffectiveUserScope(
  userId: string,
  accountId: string,
  roleNames: string[]
): Promise<UserScope> {
  const cacheKey = `${userId}:${accountId}:${roleNames.sort().join(",")}`;
  const cached = userScopeCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30000) {
    return cached.scope;
  }
  const isAllClientsRole = roleNames.some((r) =>
    [
      "BROKER_ADMIN",
      "TMS_ADMIN",
      "OWNER",
      "ADMIN",
      "CUSTOMER_ADMIN",
      "CUSTOMER_USER",
      "PORTER",
      "PLATFORM_ADMIN",
      "SUPER_ADMIN_READWRITE",
      "SUPER_ADMIN_READ",
      "SUPER_ADMIN_SETTINGS",
    ].includes(r.toUpperCase())
  );

  if (isAllClientsRole) {
    const allAccountClients = await db.client.findMany({
      where: { accountId, status: "ACTIVE" },
      select: { id: true },
    });
    const scopeRes: UserScope = {
      isAllClients: true,
      authorizedClientIds: allAccountClients.map((c) => c.id),
      teamIds: [],
      authorizedShipmentIds: null,
    };
    userScopeCache.set(cacheKey, { scope: scopeRes, time: Date.now() });
    return scopeRes;
  }

  const directAssignments = (db as any).userClientAssignment?.findMany
    ? await (db as any).userClientAssignment.findMany({
        where: { userId },
        select: { clientId: true },
      })
    : [];

  const teamMemberships = (db as any).accountTeamMembership?.findMany
    ? await (db as any).accountTeamMembership.findMany({
        where: { userId },
        select: {
          teamId: true,
          team: {
            select: {
              clients: { select: { clientId: true } },
            },
          },
        },
      })
    : [];

  const directClientIds = directAssignments.map((a: any) => a.clientId);
  const teamClientIds = teamMemberships.flatMap((m: any) => m.team.clients.map((c: any) => c.clientId));
  const teamIds = teamMemberships.map((m: any) => m.teamId);

  const authorizedClientIds = Array.from(new Set<string>([...directClientIds, ...teamClientIds]));

  const isCustomerAdmin = roleNames.some((r) => r.toUpperCase() === "CUSTOMER_ADMIN");

  if (isCustomerAdmin) {
    const allAccountClients = await db.client.findMany({
      where: { accountId, status: "ACTIVE" },
      select: { id: true },
    });
    const combinedClientIds = Array.from(new Set<string>([...authorizedClientIds, ...allAccountClients.map((c) => c.id)]));
    const scopeRes: UserScope = {
      isAllClients: combinedClientIds.length === 0,
      authorizedClientIds: combinedClientIds,
      teamIds,
      authorizedShipmentIds: null,
    };
    userScopeCache.set(cacheKey, { scope: scopeRes, time: Date.now() });
    return scopeRes;
  }

  // Check specific shipment assignments for customer contacts
  const assignedShipments = await db.shipment.findMany({
    where: {
      accountId,
      ownerName: userId,
    },
    select: { id: true },
  });

  const authorizedShipmentIds = assignedShipments.length === 0 ? null : assignedShipments.map((s) => s.id);

  const scopeRes: UserScope = {
    isAllClients: false,
    authorizedClientIds,
    teamIds,
    authorizedShipmentIds,
  };
  userScopeCache.set(cacheKey, { scope: scopeRes, time: Date.now() });
  return scopeRes;
}

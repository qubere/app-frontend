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
export async function getEffectiveUserScope(
  userId: string,
  accountId: string,
  roleNames: string[]
): Promise<UserScope> {
  const isAllClientsRole = roleNames.some((r) =>
    [
      "BROKER_ADMIN",
      "TMS_ADMIN",
      "OWNER",
      "ADMIN",
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
    return {
      isAllClients: true,
      authorizedClientIds: allAccountClients.map((c) => c.id),
      teamIds: [],
      authorizedShipmentIds: null,
    };
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

  // Check specific shipment assignments for customer contacts
  const assignedShipments = await db.shipment.findMany({
    where: {
      accountId,
      OR: [
        { ownerName: userId },
        { poReference: { contains: userId } },
      ],
    },
    select: { id: true },
  });

  const isCustomerAdmin = roleNames.some((r) => r.toUpperCase() === "CUSTOMER_ADMIN");
  const authorizedShipmentIds = isCustomerAdmin || assignedShipments.length === 0 ? null : assignedShipments.map((s) => s.id);

  return {
    isAllClients: false,
    authorizedClientIds,
    teamIds,
    authorizedShipmentIds,
  };
}

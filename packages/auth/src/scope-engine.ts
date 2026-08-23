import { db } from "@qubere/db";

export interface UserScope {
  isAllClients: boolean;
  authorizedClientIds: string[];
  teamIds: string[];
}

/**
 * Resolves the effective client/team scope for a user within an account.
 * Broker Admin, TMS Admin, and Platform Admins have ALL_CLIENTS access.
 * Managers, Specialists, Viewers, and Operations have access restricted to
 * their explicitly assigned clients or assigned team clients.
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

  return {
    isAllClients: false,
    authorizedClientIds,
    teamIds,
  };
}

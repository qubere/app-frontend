import { db } from "@/lib/db";

export interface AutoRouteResult {
  assignedToUserId: string | null;
  assignmentSource: "CLIENT_ROUTE" | "TEAM_ROUTE" | null;
}

/**
 * Calculates auto-assignment for a work item targeting a given shipment.
 * Checks UserClientAssignment first, then TeamClientAssignment.
 */
export async function computeAutoAssignment(
  shipmentId: string | null,
  accountId: string
): Promise<AutoRouteResult> {
  if (!shipmentId) {
    return { assignedToUserId: null, assignmentSource: null };
  }

  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId },
    select: { clientId: true, assignedBrokerId: true },
  });

  if (!shipment) {
    return { assignedToUserId: null, assignmentSource: null };
  }

  // 1. Direct assigned broker on shipment
  if (shipment.assignedBrokerId) {
    return { assignedToUserId: shipment.assignedBrokerId, assignmentSource: "CLIENT_ROUTE" };
  }

  if (!shipment.clientId) {
    return { assignedToUserId: null, assignmentSource: null };
  }

  // 2. UserClientAssignment
  const userClientAssign = await db.userClientAssignment.findFirst({
    where: { clientId: shipment.clientId },
    select: { userId: true },
  });

  if (userClientAssign) {
    return { assignedToUserId: userClientAssign.userId, assignmentSource: "CLIENT_ROUTE" };
  }

  // 3. TeamClientAssignment
  const teamClientAssign = await db.teamClientAssignment.findFirst({
    where: { clientId: shipment.clientId },
    select: { teamId: true },
  });

  if (teamClientAssign) {
    const member = await db.accountTeamMembership.findFirst({
      where: { teamId: teamClientAssign.teamId },
      select: { userId: true },
    });
    if (member) {
      return { assignedToUserId: member.userId, assignmentSource: "TEAM_ROUTE" };
    }
  }

  return { assignedToUserId: null, assignmentSource: null };
}

import Link from "next/link";
import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { DocumentsClient } from "./DocumentsClient";
import type { TeamMember } from "@/lib/team";
import { listQuarantinedInboundEmails } from "@/modules/inbound/quarantineReview";

export default async function DocumentsPage() {
  const ctx = await getAccountContext();
  if (!ctx) {
    return null;
  }

  const accountId = ctx.accountId;
  const isPlanner = ctx.roleNames.includes("PLANNER");

  return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () => {
    // Fetch active team members if user is an enterprise admin
    let teamMembers: TeamMember[] = [];
    const isEnterpriseAdmin =
      ctx.accountType === "ENTERPRISE" &&
      (ctx.roleNames.includes("ADMIN") || ctx.roleNames.includes("OWNER"));

    if (isEnterpriseAdmin) {
      const memberships = await db.accountMembership.findMany({
        where: { accountId, status: "ACTIVE" },
        include: { user: true },
      });
      teamMembers = memberships.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }));
    }

    // Server-side data fetching for SSR
    const shipmentWhere: any = {
      accountId,
      deletedAt: null,
      productWorkspaces: {
        some: { product: "CUSTOMS", status: "ACTIVE" },
      },
    };
    if (isPlanner) {
      shipmentWhere.assignedBrokerId = ctx.userId;
    }

    const [shipmentsRaw, unattachedDocsRaw, quarantinedEmails] = await Promise.all([
      db.shipment.findMany({
        where: shipmentWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shipmentNumber: true,
          assignedBrokerId: true,
          assignedBroker: {
            select: { firstName: true, lastName: true, email: true },
          },
          clientId: true,
          client: { select: { id: true, name: true } },
          documents: {
            select: {
              id: true,
              fileName: true,
              docType: true,
              documentType: true,
              documentTypeConfidence: true,
              status: true,
              createdAt: true,
              fileUrl: true,
              confidence: true,
              source: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        take: 200,
      }),
      db.shipmentDocument.findMany({
        where: {
          accountId,
          shipmentId: null,
        },
        select: {
          id: true,
          fileName: true,
          docType: true,
          documentType: true,
          documentTypeConfidence: true,
          status: true,
          createdAt: true,
          fileUrl: true,
          confidence: true,
          source: true,
          shipmentCandidates: {
            select: {
              id: true,
              confidenceScore: true,
              matchedIdentifierType: true,
              matchedValue: true,
              matchMethod: true,
              autoSelected: true,
              shipment: {
                select: { id: true, shipmentNumber: true, portOfEntry: true },
              },
            },
            orderBy: { confidenceScore: "desc" },
            take: 3,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      ctx.isPlatformAdmin ? listQuarantinedInboundEmails() : Promise.resolve([]),
    ]);

    const initialShipments = JSON.parse(JSON.stringify(shipmentsRaw));
    const initialUnattachedDocs = JSON.parse(JSON.stringify(unattachedDocsRaw));
    const initialQuarantineCount = quarantinedEmails.length;

    return (
      <><div className="mb-4 flex justify-end"><Link className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-brand" href="/app/documents/inbound-review">Email review →</Link></div><DocumentsClient
        context={{
          userId: ctx.userId,
          roleNames: ctx.roleNames,
          accountType: ctx.accountType,
          accountName: ctx.accountName,
          firstName: ctx.firstName,
          lastName: ctx.lastName,
          email: ctx.email,
          isPlatformAdmin: !!ctx.isPlatformAdmin,
        }}
        teamMembers={teamMembers}
        initialShipments={initialShipments}
        initialUnattachedDocs={initialUnattachedDocs}
        initialQuarantineCount={initialQuarantineCount}
      /></>
    );
  });
}


import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope, resolvePortalClientScope, hasRequiredPortalPermission } from "@qubere/auth";
import { db } from "@qubere/db";

const inFlightDashboardPromises = new Map<string, Promise<any>>();

export function invalidateDashboardCache() {
  inFlightDashboardPromises.clear();
}

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || "";

  const clientScope = resolvePortalClientScope(scope, clientId || undefined);
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const cacheKey = `${ctx.userId}:${ctx.accountId}:${clientId}`;

  if (inFlightDashboardPromises.has(cacheKey)) {
    const data = await inFlightDashboardPromises.get(cacheKey);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  const fetchPromise = (async () => {
    const actionWhere: any = {
      accountId: ctx.accountId,
    };

    if (clientScope.clientIds !== null) {
      actionWhere.clientId = { in: clientScope.clientIds };
    }

    // Fetch open customer action requests for "Needs your attention"
    const rawActionRequests = await db.customerRequest.findMany({
      take: 50,
      where: actionWhere,
      orderBy: { createdAt: "asc" },
      include: {
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            poReference: true,
            estimatedArrival: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            authorType: true,
            body: true,
            createdAt: true,
            authorUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            document: {
              select: {
                id: true,
                fileName: true,
                docType: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // Calculate deterministic actionId (ACT-101, ACT-102...) per shipment based on creation order asc
    const shipmentIdToRequestsMap = new Map<string, typeof rawActionRequests>();
    for (const reqItem of rawActionRequests) {
      const key = reqItem.shipmentId || "GENERAL";
      if (!shipmentIdToRequestsMap.has(key)) {
        shipmentIdToRequestsMap.set(key, []);
      }
      shipmentIdToRequestsMap.get(key)!.push(reqItem);
    }

    const actionIdMap = new Map<string, string>();
    for (const [_, reqList] of shipmentIdToRequestsMap.entries()) {
      const sortedAsc = [...reqList].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      sortedAsc.forEach((r, idx) => {
        actionIdMap.set(r.id, `ACT-${(101 + idx).toString()}`);
      });
    }

    // Sort by Shipment Number & Urgency for display (Active items first, RESOLVED last; sorted by createdAt asc within groups)
    rawActionRequests.sort((a, b) => {
      const shpA = a.shipment?.shipmentNumber || a.shipmentId || "ZZZ";
      const shpB = b.shipment?.shipmentNumber || b.shipmentId || "ZZZ";
      if (shpA !== shpB) {
        return shpA.localeCompare(shpB);
      }
      const isResA = a.status === "RESOLVED" || a.status === "CLOSED";
      const isResB = b.status === "RESOLVED" || b.status === "CLOSED";
      if (isResA !== isResB) {
        return isResA ? 1 : -1;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const actionItems = rawActionRequests.map((r, idx) => {
      let actionTargetUrl = `/requests/${r.id}`;
      if (r.shipmentId) {
        actionTargetUrl = `/shipments/${r.shipmentId}`;
      }

      const actionId = actionIdMap.get(r.id) || `ACT-${(101 + idx).toString()}`;

      return {
        id: r.id,
        actionId,
        type: r.type,
        title: r.title,
        description: r.description,
        status: r.status,
        dueAt: r.dueAt,
        createdAt: r.createdAt,
        assignedUserId: r.assignedUserId,
        assignedUser: r.assignedUser,
        shipmentId: r.shipmentId,
        shipmentNumber: r.shipment?.shipmentNumber || (r.shipmentId ? `SHP-${r.shipmentId.slice(-6).toUpperCase()}` : undefined),
        poReference: r.shipment?.poReference,
        estimatedArrival: r.shipment?.estimatedArrival,
        domain: r.domain,
        targetUrl: actionTargetUrl,
        messages: r.messages,
        documents: r.documents,
      };
    });

    const mayReadCustoms = ctx.isPlatformAdmin || ctx.roleNames.some(r=>["OWNER","ADMIN","BROKER_ADMIN"].includes(r)) || ctx.permissions.includes("portal.entries.read");
    const mayReadSetup = hasRequiredPortalPermission(ctx, "portal.setup.read");
    const [proofSummary, deadlines, setups] = await Promise.all([
      mayReadCustoms ? db.entryProof.aggregate({where:{...actionWhere,status:"PUBLISHED",filing:{customerVisibleAt:{not:null}}},_count:true,_avg:{scoreOverall:true},_sum:{linesAtRisk:true,dutySavingsIdentifiedUsd:true}}) : null,
      mayReadCustoms ? db.complianceDeadline.findMany({where:{accountId:ctx.accountId,customerActionable:true,status:"OPEN",shipment:{...(clientScope.clientIds===null?{}:{clientId:{in:clientScope.clientIds}})}},take:50,orderBy:{dueAt:"asc"},select:{id:true,customerLabel:true,dueAt:true,shipmentId:true}}) : [],
      mayReadSetup ? db.onboardingCase.findMany({where:{...actionWhere,activatedAt:null,status:{notIn:["active","activated","withdrawn"]}},select:{id:true,currentStep:true},take:50}) : [],
    ]);
    return { actionItems,
      complianceSummary: proofSummary ? {entriesWithProof:proofSummary._count,avgScore:Math.round(proofSummary._avg.scoreOverall??0),linesAtRiskTotal:proofSummary._sum.linesAtRisk??0,dutySavingsIdentifiedUsd:Number(proofSummary._sum.dutySavingsIdentifiedUsd??0)} : null,
      setupSummary:{incompleteCount:setups.length,stepsRemaining:setups.reduce((n,s)=>n+Math.max(1,7-s.currentStep),0)},
      needsFromYou:deadlines.map(d=>({id:d.id,label:d.customerLabel||"Your broker needs information",dueAt:d.dueAt,href:`/shipments/${d.shipmentId}`})),
    };
  })();

  inFlightDashboardPromises.set(cacheKey, fetchPromise);
  try {
    const data = await fetchPromise;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } finally {
    inFlightDashboardPromises.delete(cacheKey);
  }
}

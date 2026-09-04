import { db } from "@qubere/db";

export interface CustomsStatusProjection {
  customsRequired: boolean;
  workspaceStatus: string | null;
  customsCaseId: string | null;
  customsCaseNumber: string | null;
  documentReadiness: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
  filingReadiness: "READY_TO_FILE" | "INCOMPLETE" | "NOT_STARTED";
  filingStatus: string;
  holdReleaseStatus: "RELEASED" | "HOLD" | "PENDING" | "NOT_STARTED";
  lastCustomsUpdate: Date | null;
  blockingExceptionsCount: number;
}

export async function getCustomsStatusProjection(
  accountId: string,
  shipmentId: string
): Promise<CustomsStatusProjection> {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId, deletedAt: null },
    include: {
      productWorkspaces: {
        where: { product: "CUSTOMS" },
      },
      customsCaseLinks: {
        include: {
          customsCase: {
            include: {
              documents: true,
              filings: {
                orderBy: { updatedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      customsFilings: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      exceptionItems: {
        where: { status: "OPEN" },
      },
    },
  });

  if (!shipment) {
    return {
      customsRequired: false,
      workspaceStatus: null,
      customsCaseId: null,
      customsCaseNumber: null,
      documentReadiness: "NOT_STARTED",
      filingReadiness: "NOT_STARTED",
      filingStatus: "None",
      holdReleaseStatus: "NOT_STARTED",
      lastCustomsUpdate: null,
      blockingExceptionsCount: 0,
    };
  }

  const workspace = shipment.productWorkspaces[0];
  const caseLink = shipment.customsCaseLinks[0];
  const customsCase = caseLink?.customsCase;
  const latestFiling = customsCase?.filings[0] || shipment.customsFilings[0];

  const caseDocs = customsCase?.documents || [];
  const includedDocs = caseDocs.filter((d) => d.status === "INCLUDED");
  const suggestedDocs = caseDocs.filter((d) => d.status === "SUGGESTED");

  let documentReadiness: "COMPLETE" | "PARTIAL" | "NOT_STARTED" = "NOT_STARTED";
  if (includedDocs.length > 0 && suggestedDocs.length === 0) {
    documentReadiness = "COMPLETE";
  } else if (includedDocs.length > 0 || suggestedDocs.length > 0) {
    documentReadiness = "PARTIAL";
  }

  const filingStatus = latestFiling?.filingStatus || customsCase?.status || "Not Started";
  let holdReleaseStatus: "RELEASED" | "HOLD" | "PENDING" | "NOT_STARTED" = "NOT_STARTED";

  if (latestFiling) {
    if (latestFiling.filingStatus === "Released") {
      holdReleaseStatus = "RELEASED";
    } else if (latestFiling.filingStatus === "CustomsHold") {
      holdReleaseStatus = "HOLD";
    } else if (latestFiling.filingStatus === "Draft" || latestFiling.filingStatus === "Transmitted") {
      holdReleaseStatus = "PENDING";
    }
  }

  let filingReadiness: "READY_TO_FILE" | "INCOMPLETE" | "NOT_STARTED" = "NOT_STARTED";
  if (latestFiling?.filingStatus === "ReadyForBrokerReview" || latestFiling?.filingStatus === "BrokerApproved") {
    filingReadiness = "READY_TO_FILE";
  } else if (customsCase || latestFiling) {
    filingReadiness = "INCOMPLETE";
  }

  return {
    customsRequired: shipment.customsRequired,
    workspaceStatus: workspace?.status || (shipment.customsRequired ? "AVAILABLE_FROM_TMS" : null),
    customsCaseId: customsCase?.id || null,
    customsCaseNumber: customsCase?.caseNumber || null,
    documentReadiness,
    filingReadiness,
    filingStatus,
    holdReleaseStatus,
    lastCustomsUpdate: latestFiling?.updatedAt || customsCase?.updatedAt || null,
    blockingExceptionsCount: shipment.exceptionItems.length,
  };
}

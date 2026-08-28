import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Fetch raw request for scope & authorization check
  const rawRequest = await db.customerRequest.findUnique({
    where: { id },
    select: { id: true, accountId: true, clientId: true, shipmentId: true },
  });

  if (!rawRequest) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.requests.read",
    resourceAccountId: rawRequest.accountId,
    resourceClientId: rawRequest.clientId,
  });

  if (!auth.authorized || auth.errorResponse) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // 2. Fetch full request with messages, documents, and shipment metadata
  const request = await db.customerRequest.findUnique({
    where: { id },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          poReference: true,
          estimatedArrival: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
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
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              mimeType: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let actionId = `ACT-${request.id.slice(-4).toUpperCase()}`;
  if (request.shipmentId) {
    const siblingRequests = await db.customerRequest.findMany({
      where: { shipmentId: request.shipmentId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const index = siblingRequests.findIndex((r) => r.id === request.id);
    if (index !== -1) {
      actionId = `ACT-${(101 + index).toString()}`;
    }
  }

  // Explicit projection — never spread the raw row (internal assignee/creator ids,
  // filing linkage, etc.). See CUSTOMER-PORTAL-PR97-REVIEW.md (P1-3).
  return NextResponse.json({
    request: {
      id: request.id,
      actionId,
      type: request.type,
      title: request.title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      domain: request.domain,
      dueAt: request.dueAt,
      version: request.version,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      shipmentId: request.shipmentId,
      shipment: request.shipment,
      messages: request.messages,
      documents: request.documents,
    },
  });
}

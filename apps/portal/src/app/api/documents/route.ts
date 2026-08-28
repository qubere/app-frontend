import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope, authorizePortalResource, resolvePortalClientScope } from "@qubere/auth";
import { db } from "@qubere/db";
import { processSharedDocumentUpload } from "@qubere/db/services/shared-upload-service";

const inFlightDocumentPromises = new Map<string, Promise<any>>();
let cachedDocuments: { cacheKey: string; time: number; data: any } | null = null;

export function invalidateDocumentsCache() {
  cachedDocuments = null;
  inFlightDocumentPromises.clear();
}

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId") || "";
  const docType = url.searchParams.get("docType") || "";
  const clientId = url.searchParams.get("clientId") || "";
  const cursor = url.searchParams.get("cursor") || "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);

  const clientScope = resolvePortalClientScope(scope, clientId);
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const cacheKey = `${ctx.userId}:${ctx.accountId}:${clientId}:${shipmentId}:${docType}:${cursor}:${limit}`;
  const now = Date.now();

  if (cachedDocuments && cachedDocuments.cacheKey === cacheKey && now - cachedDocuments.time < 5000) {
    return NextResponse.json(cachedDocuments.data);
  }

  if (inFlightDocumentPromises.has(cacheKey)) {
    const data = await inFlightDocumentPromises.get(cacheKey);
    return NextResponse.json(data);
  }

  const fetchPromise = (async () => {
    const clientFilter =
      clientScope.clientIds === null ? {} : { clientId: { in: clientScope.clientIds } };

    const documents = await db.shipmentDocument.findMany({
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      where: {
        accountId: ctx.accountId,
        ...clientFilter,
        portalVisibility: "CUSTOMER",
        ...(shipmentId ? { shipmentId } : {}),
        ...(docType ? { docType } : {}),
      },
      include: {
        shipment: {
          select: { id: true, shipmentNumber: true },
        },
      },
    });

    let nextCursor: string | undefined = undefined;
    if (documents.length > limit) {
      const nextItem = documents.pop();
      nextCursor = nextItem?.id;
    }

    const items = documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      docType: d.docType,
      byteSize: d.byteSize,
      mimeType: d.mimeType,
      source: d.source || "PORTAL_UPLOAD",
      status: d.status === "Received" ? "Ready" : "Processing",
      shipmentId: d.shipmentId,
      shipmentNumber: d.shipment?.shipmentNumber || null,
      createdAt: d.createdAt,
    }));

    return { items, nextCursor };
  })();

  inFlightDocumentPromises.set(cacheKey, fetchPromise);
  try {
    const data = await fetchPromise;
    cachedDocuments = { cacheKey, time: Date.now(), data };
    return NextResponse.json(data);
  } finally {
    inFlightDocumentPromises.delete(cacheKey);
  }
}

export async function POST(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const shipmentId = (formData.get("shipmentId") as string) || undefined;
  const requestId = (formData.get("requestId") as string) || undefined;
  const docType = (formData.get("docType") as string) || "Customer Document";
  const clientIdInput = (formData.get("clientId") as string) || undefined;

  if (!file) {
    return NextResponse.json({ error: "MISSING_FILE", message: "File is required" }, { status: 400 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);

  // A caller-supplied clientId must be one the caller is authorized for.
  if (
    clientIdInput &&
    !scope.isAllClients &&
    !scope.authorizedClientIds.includes(clientIdInput)
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const effectiveClientId = clientIdInput || scope.authorizedClientIds[0];

  if (!effectiveClientId && !scope.isAllClients) {
    return NextResponse.json({ error: "MISSING_CLIENT_SCOPE", message: "Client ID required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await processSharedDocumentUpload({
      accountId: ctx.accountId,
      clientId: effectiveClientId,
      shipmentId,
      fileName: file.name,
      fileBuffer: buffer,
      docType,
      mimeType: file.type || "application/pdf",
      source: "PORTAL_UPLOAD",
      portalVisibility: "CUSTOMER",
      userId: ctx.userId,
    });

    // Link to request if uploaded as part of a customer request
    if (requestId) {
      const request = await db.customerRequest.findUnique({
        where: { id: requestId },
        select: { id: true, accountId: true, clientId: true },
      });
      if (request) {
        const auth = await authorizePortalResource({
          permission: "portal.documents.create",
          resourceAccountId: request.accountId,
          resourceClientId: request.clientId,
        });
        if (auth.authorized) {
          await db.customerRequestDocument.create({
            data: {
              requestId,
              documentId: result.documentId,
            },
          });
        }
      }
    }

    // Audit upload
    await db.auditLog.create({
      data: {
        accountId: ctx.accountId,
        userId: ctx.userId,
        actorUserId: ctx.userId,
        effectiveUserId: ctx.userId,
        action: "CUSTOMER_PORTAL_DOCUMENT_UPLOAD",
        entity: "ShipmentDocument",
        entityId: result.documentId,
        clientId: effectiveClientId,
        newValue: { fileName: file.name, byteSize: result.byteSize, docType, isUnattached: !shipmentId },
        source: "PORTAL_UI",
      },
    });

    // If no shipmentId, notify assigned agent that doc is parked in client unattached folder
    if (!shipmentId) {
      console.log(`[PORTAL_UPLOAD_UNATTACHED] Document ${result.documentId} (${file.name}) parked in unattached client folder. Notifying account broker agent.`);
    }

    return NextResponse.json(
      {
        message: "Document uploaded and enqueued for processing",
        document: {
          id: result.documentId,
          fileName: result.fileName,
          status: "Processing",
          byteSize: result.byteSize,
          acceptedAt: result.acceptedAt,
        },
      },
      { status: 202 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: "UPLOAD_FAILED", message: err.message || "Failed to process document" }, { status: 500 });
  }
}

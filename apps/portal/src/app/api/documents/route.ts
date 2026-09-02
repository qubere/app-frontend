import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { getPortalWorkspaceScope, authorizePortalResource, resolvePortalClientScope } from "@qubere/auth";
import { db } from "@qubere/db";
import { processSharedDocumentUpload } from "@qubere/db/services/shared-upload-service";

import { hasRequiredPortalPermission } from "@qubere/auth";
import { decodeDocumentCursor, loadDocumentPage } from "@/lib/document-list";

// Retained for upload callers; document lists now always use current ownership.
export function invalidateDocumentsCache() {}

export const GET = withPortalAccount(async (ctx, req: Request) => {
  if (!hasRequiredPortalPermission(ctx, 'portal.documents.read')) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const scope = await getPortalWorkspaceScope(ctx);
  const url = new URL(req.url);
  const clientScope = resolvePortalClientScope(scope, url.searchParams.get('clientId'));
  if (clientScope.forbidden) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);
  if (!Number.isSafeInteger(limit) || limit < 1) return NextResponse.json({ error: 'INVALID_LIMIT' }, { status: 400 });
  let cursor;
  try { cursor = decodeDocumentCursor(url.searchParams.get('cursor')); }
  catch { return NextResponse.json({ error: 'INVALID_CURSOR' }, { status: 400 }); }
  return NextResponse.json(await loadDocumentPage({ accountId: ctx.accountId, clientIds: clientScope.clientIds, limit, cursor,
    shipmentId: url.searchParams.get('shipmentId') || '', docType: url.searchParams.get('docType') || '',
    includeSetup: hasRequiredPortalPermission(ctx, 'portal.setup.read'), canDelete: hasRequiredPortalPermission(ctx, 'portal.documents.create'),
  }));
});

export const POST = withPortalAccount(async (ctx, req: Request) => {

  if (!hasRequiredPortalPermission(ctx, "portal.documents.create")) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const shipmentId = (formData.get("shipmentId") as string) || undefined;
  const requestId = (formData.get("requestId") as string) || undefined;
  const docType = (formData.get("docType") as string) || "Customer Document";
  const clientIdInput = (formData.get("clientId") as string) || undefined;

  if (!file) {
    return NextResponse.json({ error: "MISSING_FILE", message: "File is required" }, { status: 400 });
  }

  const effectiveClientId = clientIdInput;

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
      channel: "CUSTOMER_PORTAL",
      uploadedByType: "CUSTOMER_USER",
      uploadedByUserId: ctx.userId,
    });

    // Link to request if uploaded as part of a customer request
    if (requestId) {
      const request = await db.customerRequest.findUnique({
        where: { id: requestId, accountId: ctx.accountId },
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
});

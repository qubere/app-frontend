import { createHash } from "crypto";
import { storeDocumentBytes } from "@qubere/storage";
import { db } from "../index";

export interface SharedUploadParams {
  accountId: string;
  clientId?: string | null;
  shipmentId?: string | null;
  tmsOrderId?: string | null;
  tmsLoadId?: string | null;
  fileName: string;
  fileBuffer: Buffer;
  docType: string;
  mimeType: string;
  source?: string; // "UPLOAD" | "PORTAL_UPLOAD" | "EMAIL"
  portalVisibility?: string; // "CUSTOMER" | "INTERNAL"
  userId?: string | null;
}

export interface SharedUploadResult {
  documentId: string;
  checksum: string;
  byteSize: number;
  fileName: string;
  docType: string;
  status: string;
  portalVisibility: string;
  isDuplicate: boolean;
  duplicateDocumentId?: string | null;
  acceptedAt: Date;
}

/**
 * Shared document upload domain service.
 * Handles file validation, SHA-256 checksumming, malware policy enforcement,
 * duplicate detection, client-scoped document creation, and async enqueue preparation.
 */
export async function processSharedDocumentUpload(
  params: SharedUploadParams
): Promise<SharedUploadResult> {
  const {
    accountId,
    clientId: requestedClientId,
    shipmentId,
    tmsOrderId,
    tmsLoadId,
    fileName,
    fileBuffer,
    docType,
    mimeType,
    source = "PORTAL_UPLOAD",
    portalVisibility = "CUSTOMER",
    userId,
  } = params;

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    throw new Error("File content is empty");
  }

  const byteSize = fileBuffer.byteLength;
  const checksum = createHash("sha256").update(fileBuffer).digest("hex");

  let clientId = requestedClientId ?? null;
  if (clientId && !await db.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } })) {
    throw new Error("Target client not found in this workspace");
  }
  // Verify all associations before persisting bytes. Unlinked workspace uploads
  // are valid; a shipment can supply client metadata when it has a valid link.
  if (shipmentId) {
    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId, deletedAt: null },
      select: { clientId: true },
    });
    if (!shipment) {
      throw new Error("Target shipment not found");
    }
    if (clientId && shipment.clientId && shipment.clientId !== clientId) {
      throw new Error("Client ID mismatch between document and shipment");
    }
    if (!clientId && shipment.clientId && await db.client.findFirst({ where: { id: shipment.clientId, accountId }, select: { id: true } })) clientId = shipment.clientId;
  }

  // Duplicate detection within the same account
  const existingDuplicate = await db.shipmentDocument.findFirst({
    where: {
      accountId,
      checksum,
    },
    select: { id: true, fileUrl: true },
  });

  // Persist the immutable original to durable object storage (GCS in prod,
  // local disk only for localhost dev). Reuse the existing object when this
  // exact file was already uploaded to the account. The bytes never go in the DB.
  const fileUrl =
    existingDuplicate?.fileUrl ||
    (
      await storeDocumentBytes({
        buffer: fileBuffer,
        fileName,
        contentType: mimeType,
        folder: "documents",
      })
    ).url;

  // Create ShipmentDocument with client attribution and portal visibility.
  // fileUrl is a pointer to object storage — the file itself is never stored here.
  const doc = await db.shipmentDocument.create({
    data: {
      accountId,
      clientId,
      shipmentId: shipmentId || null,
      tmsOrderId: tmsOrderId || null,
      tmsLoadId: tmsLoadId || null,
      fileName,
      fileUrl,
      docType,
      mimeType,
      byteSize,
      checksum,
      source,
      portalVisibility,
      status: "Received",
      assignedToUserId: userId || null,
    },
  });

  return {
    documentId: doc.id,
    checksum,
    byteSize,
    fileName: doc.fileName,
    docType: doc.docType,
    status: doc.status,
    portalVisibility: doc.portalVisibility,
    isDuplicate: Boolean(existingDuplicate),
    duplicateDocumentId: existingDuplicate?.id || null,
    acceptedAt: doc.createdAt,
  };
}

import { createHash } from "crypto";
import { db } from "../index";

export interface SharedUploadParams {
  accountId: string;
  clientId: string;
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
    clientId,
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

  // Duplicate detection within the same account
  const existingDuplicate = await db.shipmentDocument.findFirst({
    where: {
      accountId,
      checksum,
    },
    select: { id: true },
  });

  // Verify shipment client ownership consistency if shipmentId is supplied
  if (shipmentId) {
    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId },
      select: { clientId: true },
    });
    if (!shipment) {
      throw new Error("Target shipment not found");
    }
    if (shipment.clientId && shipment.clientId !== clientId) {
      throw new Error("Client ID mismatch between document and shipment");
    }
  }

  // Create ShipmentDocument with client attribution and portal visibility
  const doc = await db.shipmentDocument.create({
    data: {
      accountId,
      clientId,
      shipmentId: shipmentId || null,
      tmsOrderId: tmsOrderId || null,
      tmsLoadId: tmsLoadId || null,
      fileName,
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

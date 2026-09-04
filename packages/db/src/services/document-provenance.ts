import type { DocumentChannel, DocumentUploaderType, Prisma } from "@prisma/client";
import { db } from "../index";

/**
 * Ingestion-provenance metadata for a document. These fields are written once,
 * at creation, and describe *how the document arrived* -- the surface, the
 * acting user (if any), and channel-specific detail. They are deliberately
 * independent of `assignedToUserId` (which is work ownership and can change)
 * and of the legacy free-text `ShipmentDocument.source`.
 */
export interface DocumentProvenanceInput {
  channel: DocumentChannel;
  uploadedByType: DocumentUploaderType;
  /** Acting user for WEB_APP / CUSTOMER_PORTAL uploads. Null for email/API/system. */
  uploadedByUserId?: string | null;
  /** Explicit display name/email. When omitted and a userId is given, resolved from the User row. */
  uploadedByName?: string | null;
  uploadedByEmail?: string | null;
  /** Channel-specific detail, e.g. { fromAddress, subject, messageId } for EMAIL. */
  channelMeta?: Prisma.InputJsonValue | null;
}

export interface DocumentProvenanceFields {
  channel: DocumentChannel;
  uploadedByType: DocumentUploaderType;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedByEmail: string | null;
  uploadedAt: Date;
  channelMeta?: Prisma.InputJsonValue;
}

/** Snapshot a user's display name and email for durable attribution. */
export async function resolveUploaderSnapshot(
  userId: string | null | undefined,
): Promise<{ uploadedByName: string | null; uploadedByEmail: string | null }> {
  if (!userId) return { uploadedByName: null, uploadedByEmail: null };
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!u) return { uploadedByName: null, uploadedByEmail: null };
  return {
    uploadedByName: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
    uploadedByEmail: u.email ?? null,
  };
}

/**
 * Build the provenance columns to spread into `db.shipmentDocument.create({ data })`.
 * Resolves the uploader name/email snapshot from `uploadedByUserId` when not
 * supplied explicitly. Never call this on an update -- provenance is immutable.
 */
export async function buildDocumentProvenance(
  input: DocumentProvenanceInput,
): Promise<DocumentProvenanceFields> {
  let uploadedByName = input.uploadedByName ?? null;
  let uploadedByEmail = input.uploadedByEmail ?? null;
  if (input.uploadedByUserId && !uploadedByName && !uploadedByEmail) {
    const snap = await resolveUploaderSnapshot(input.uploadedByUserId);
    uploadedByName = snap.uploadedByName;
    uploadedByEmail = snap.uploadedByEmail;
  }
  return {
    channel: input.channel,
    uploadedByType: input.uploadedByType,
    uploadedByUserId: input.uploadedByUserId ?? null,
    uploadedByName,
    uploadedByEmail,
    uploadedAt: new Date(),
    ...(input.channelMeta != null ? { channelMeta: input.channelMeta } : {}),
  };
}

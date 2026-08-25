/**
 * Platform-admin review queue for InboundEmail rows quarantined because the
 * sender wasn't a registered InboundSenderRoute. The attachments are already
 * downloaded and stored (see inboundEmailWorker.ts) -- this module is only
 * about the two things an admin can do with a quarantined email: release it
 * to an account (promoting its attachments to real ShipmentDocuments) or
 * discard it.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { findCrossShipmentDuplicates } from "@/modules/documents/duplicateDetection";
import { enqueueDocumentParse } from "@/modules/documents/processing/documentProcessingWorker";
import { createInboundSenderRoute, InboundSenderAlreadyRoutedError } from "@/modules/inbound/senderRouting";

export function listQuarantinedInboundEmails() {
  return db.inboundEmail.findMany({
    where: { routingStatus: "QUARANTINED" },
    include: { attachments: true },
    orderBy: { createdAt: "asc" },
  });
}

export class AssigneeNotAMemberError extends Error {
  constructor() {
    super("The default assignee must be an active member of this organization.");
    this.name = "AssigneeNotAMemberError";
  }
}

export { InboundSenderAlreadyRoutedError };

export async function releaseQuarantinedInboundEmail(params: {
  inboundEmailId: string;
  accountId: string;
  defaultAssignedToUserId?: string | null;
  createSenderRoute: boolean;
  adminUserId: string;
}) {
  const { inboundEmailId, accountId, defaultAssignedToUserId, createSenderRoute, adminUserId } = params;

  const email = await db.inboundEmail.findUniqueOrThrow({
    where: { id: inboundEmailId },
    include: { attachments: true },
  });
  if (email.routingStatus !== "QUARANTINED") {
    throw new Error(`InboundEmail ${inboundEmailId} is not quarantined (status: ${email.routingStatus}).`);
  }

  if (defaultAssignedToUserId) {
    const membership = await db.accountMembership.findFirst({
      where: { accountId, userId: defaultAssignedToUserId, status: "ACTIVE" },
    });
    if (!membership) throw new AssigneeNotAMemberError();
  }

  if (createSenderRoute) {
    await createInboundSenderRoute({
      accountId,
      email: email.originalFromAddress,
      defaultAssignedToUserId,
      createdByUserId: adminUserId,
      auditSource: "PLATFORM_ADMIN",
    });
  }

  const { DocumentTypeCatalog } = await import("@/modules/intake/documentTypeCatalog");

  let storedCount = 0;
  for (const attachment of email.attachments) {
    if (attachment.processingStatus !== "QUARANTINED" || !attachment.quarantinedFileUrl) continue;

    const correlationId = randomUUID();
    const docType = DocumentTypeCatalog.matchDocumentType(attachment.originalFilename).name;

    const document = await db.shipmentDocument.create({
      data: {
        accountId,
        shipmentId: null,
        source: "EMAIL",
        assignedToUserId: defaultAssignedToUserId ?? null,
        docType,
        fileName: attachment.originalFilename,
        fileUrl: attachment.quarantinedFileUrl,
        checksum: attachment.checksum,
        byteSize: attachment.actualSize,
        mimeType: attachment.declaredMimeType,
      },
    });

    await db.inboundAttachment.update({
      where: { id: attachment.id },
      data: { processingStatus: "STORED", shipmentDocumentId: document.id, quarantinedFileUrl: null },
    });

    const crossShipmentDuplicates = attachment.checksum
      ? await findCrossShipmentDuplicates(accountId, attachment.checksum, null, document.id)
      : [];

    await createAuditLog({
      accountId,
      userId: adminUserId,
      action: AuditAction.DOCUMENT_STORED,
      entity: "ShipmentDocument",
      entityId: document.id,
      source: "PLATFORM_ADMIN",
      metadata: {
        fileName: attachment.originalFilename,
        docType,
        byteSize: attachment.actualSize,
        sha256: attachment.checksum,
        mimeType: attachment.declaredMimeType,
        inboundEmailId: email.id,
        inboundAttachmentId: attachment.id,
        crossShipmentDuplicateCount: crossShipmentDuplicates.length,
        releasedFromQuarantine: true,
      },
      correlationId,
    });

    if (attachment.checksum) {
      await enqueueDocumentParse({
        accountId,
        documentId: document.id,
        contentSha256: attachment.checksum,
        profile: "STANDARD",
        reason: "INITIAL",
        correlationId,
      });
    }

    storedCount += 1;
  }

  if (storedCount > 0 && defaultAssignedToUserId) {
    await db.notification.create({
      data: {
        accountId,
        userId: defaultAssignedToUserId,
        type: "INBOUND_EMAIL_DOCUMENTS",
        message: `${storedCount} new document${storedCount === 1 ? "" : "s"} from ${email.originalFromAddress}`,
        entityType: "InboundEmail",
        entityId: email.id,
      },
    });
  }

  return db.inboundEmail.update({
    where: { id: email.id },
    data: { accountId, routingStatus: "ACCEPTED", quarantineReason: null },
  });
}

export async function discardQuarantinedInboundEmail(params: {
  inboundEmailId: string;
  adminUserId: string;
  reason?: string;
}) {
  const { inboundEmailId, reason } = params;
  const email = await db.inboundEmail.findUniqueOrThrow({ where: { id: inboundEmailId } });
  if (email.routingStatus !== "QUARANTINED") {
    throw new Error(`InboundEmail ${inboundEmailId} is not quarantined (status: ${email.routingStatus}).`);
  }

  return db.inboundEmail.update({
    where: { id: email.id },
    data: { routingStatus: "REJECTED", quarantineReason: reason ?? "admin_discarded" },
  });
}

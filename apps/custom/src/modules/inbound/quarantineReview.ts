/**
 * Platform-admin review queue for InboundEmail rows quarantined because the
 * sender wasn't a registered InboundSenderRoute. The attachments are already
 * downloaded and stored (see inboundEmailWorker.ts) -- this module is only
 * about the two things an admin can do with a quarantined email: release it
 * to an account (promoting its attachments to real ShipmentDocuments) or
 * discard it.
 */

import { randomUUID } from "crypto";
import { db, withDataModeContext } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { findCrossShipmentDuplicates } from "@/modules/documents/duplicateDetection";
import { enqueueDocumentParse } from "@/modules/documents/processing/documentProcessingWorker";
import { notify } from "@/modules/notifications/notify";
import {
  blockInboundSenderRoute,
  createInboundSenderRoute,
  InboundSenderAlreadyRoutedError,
} from "@/modules/inbound/senderRouting";

function log(event: string, fields: Record<string, string | number | boolean | null>): void {
  console.log(`[QuarantineReview] ${event}`, fields);
}

/**
 * Every export here reads/writes InboundEmail, which has an optional
 * `account` relation -- the shared `db` client auto-filters reads through
 * that relation by dataMode (see packages/db/src/index.ts), and a
 * quarantined email has no account yet by definition. Neither the
 * platform-admin server component nor `withAuthenticatedRoute` (which sets
 * the *admin's own* dataMode, not null) establish the right bypass for that,
 * so this module has to opt out itself, same as inboundEmailWorker.ts.
 */
export function listQuarantinedInboundEmails(options?: { accountId?: string; includeUnassigned?: boolean }) {
  // The callback must itself be declared `async` -- a plain (non-async)
  // arrow that just returns the lazy Prisma promise never actually triggers
  // it within withDataModeContext's active window, so the context has
  // already reverted by the time the query really runs and this silently
  // falls back to the default (accountId-required) filter. Confirmed
  // empirically against the live DB while diagnosing this bug.
  return withDataModeContext(null, async () => {
    const items = await db.inboundEmail.findMany({
      where: {
        routingStatus: "QUARANTINED",
        ...(options?.accountId
          ? { accountId: options.accountId }
          : options?.includeUnassigned
            ? { accountId: null }
            : {}),
      },
      include: {
        account: { select: { id: true, name: true } },
        attachments: true,
      },
      orderBy: { createdAt: "asc" },
    });
    log("list.completed", { count: items.length });
    return items;
  });
}

export async function getQuarantinedInboundEmail(inboundEmailId: string) {
  return withDataModeContext(null, async () =>
    db.inboundEmail.findFirst({
      where: { id: inboundEmailId, routingStatus: "QUARANTINED" },
      include: {
        account: { select: { id: true, name: true } },
        attachments: true,
      },
    })
  );
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
  return withDataModeContext(null, async () => releaseQuarantinedInboundEmailImpl(params));
}

async function releaseQuarantinedInboundEmailImpl(params: {
  inboundEmailId: string;
  accountId: string;
  defaultAssignedToUserId?: string | null;
  createSenderRoute: boolean;
  adminUserId: string;
}) {
  const { inboundEmailId, accountId, defaultAssignedToUserId, createSenderRoute, adminUserId } = params;
  log("release.started", { inboundEmailId, accountId, adminUserId, createSenderRoute });

  const email = await db.inboundEmail.findUniqueOrThrow({
    where: { id: inboundEmailId },
    include: { attachments: true },
  });
  if (email.routingStatus !== "QUARANTINED") {
    log("release.rejected_wrong_status", { inboundEmailId, routingStatus: email.routingStatus });
    throw new Error(`InboundEmail ${inboundEmailId} is not quarantined (status: ${email.routingStatus}).`);
  }

  if (defaultAssignedToUserId) {
    const membership = await db.accountMembership.findFirst({
      where: { accountId, userId: defaultAssignedToUserId, status: "ACTIVE" },
    });
    if (!membership) {
      log("release.assignee_not_a_member", { inboundEmailId, accountId, defaultAssignedToUserId });
      throw new AssigneeNotAMemberError();
    }
  }

  if (createSenderRoute) {
    try {
      const route = await createInboundSenderRoute({
        accountId,
        email: email.originalFromAddress,
        defaultAssignedToUserId,
        createdByUserId: adminUserId,
        auditSource: "PLATFORM_ADMIN",
      });
      log("release.sender_route_created", { inboundEmailId, accountId, senderRouteId: route.id });
    } catch (error) {
      log("release.sender_route_creation_failed", {
        inboundEmailId,
        accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  const { DocumentTypeCatalog } = await import("@/modules/intake/documentTypeCatalog");

  let storedCount = 0;
  for (const attachment of email.attachments) {
    if (attachment.processingStatus !== "QUARANTINED" || !attachment.quarantinedFileUrl) {
      log("release.attachment_skipped", {
        inboundEmailId,
        attachmentId: attachment.id,
        processingStatus: attachment.processingStatus,
      });
      continue;
    }

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

    log("release.attachment_promoted", {
      inboundEmailId,
      attachmentId: attachment.id,
      documentId: document.id,
      accountId,
      crossShipmentDuplicateCount: crossShipmentDuplicates.length,
    });
    storedCount += 1;
  }

  if (storedCount > 0 && defaultAssignedToUserId) {
    // dedupe guards against a duplicate if a prior call stored attachments but
    // crashed/raced before the routingStatus update below -- see the identical
    // guard in inboundEmailWorker.ts.
    await notify({
      accountId,
      userId: defaultAssignedToUserId,
      type: "INBOUND_EMAIL_DOCUMENTS",
      message: `${storedCount} new document${storedCount === 1 ? "" : "s"} from ${email.originalFromAddress}`,
      entityType: "InboundEmail",
      entityId: email.id,
      dedupe: true,
    });
  }

  const updated = await db.inboundEmail.update({
    where: { id: email.id },
    data: { accountId, routingStatus: "ACCEPTED", quarantineReason: null },
  });
  log("release.finished", { inboundEmailId, accountId, storedCount });
  return updated;
}

export async function discardQuarantinedInboundEmail(params: {
  inboundEmailId: string;
  adminUserId: string;
  reason?: string;
}) {
  return withDataModeContext(null, async () => discardQuarantinedInboundEmailImpl(params));
}

export async function blockQuarantinedInboundEmail(params: {
  inboundEmailId: string;
  accountId: string;
  adminUserId: string;
  requestId?: string;
}) {
  return withDataModeContext(null, async () => {
    const email = await db.inboundEmail.findUniqueOrThrow({ where: { id: params.inboundEmailId } });
    if (email.routingStatus !== "QUARANTINED") {
      throw new Error(`InboundEmail ${params.inboundEmailId} is not quarantined (status: ${email.routingStatus}).`);
    }
    if (email.accountId && email.accountId !== params.accountId) {
      throw new Error("Quarantined email is already attributed to a different account.");
    }

    await blockInboundSenderRoute({
      accountId: params.accountId,
      email: email.normalizedFromAddress,
      blockedByUserId: params.adminUserId,
      auditSource: "DOCUMENTS_QUEUE",
      requestId: params.requestId,
    });

    return discardQuarantinedInboundEmailImpl({
      inboundEmailId: params.inboundEmailId,
      adminUserId: params.adminUserId,
      reason: "blocked_sender",
    });
  });
}

async function discardQuarantinedInboundEmailImpl(params: {
  inboundEmailId: string;
  adminUserId: string;
  reason?: string;
}) {
  const { inboundEmailId, adminUserId, reason } = params;
  log("discard.started", { inboundEmailId, adminUserId, reason: reason ?? null });

  const email = await db.inboundEmail.findUniqueOrThrow({ where: { id: inboundEmailId } });
  if (email.routingStatus !== "QUARANTINED") {
    log("discard.rejected_wrong_status", { inboundEmailId, routingStatus: email.routingStatus });
    throw new Error(`InboundEmail ${inboundEmailId} is not quarantined (status: ${email.routingStatus}).`);
  }

  const updated = await db.inboundEmail.update({
    where: { id: email.id },
    data: { routingStatus: "REJECTED", quarantineReason: reason ?? "admin_discarded" },
  });
  log("discard.finished", { inboundEmailId });
  return updated;
}

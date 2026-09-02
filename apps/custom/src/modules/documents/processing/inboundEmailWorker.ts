import { summarizeInboundReceipt } from "@/modules/inbound/inboundNotifications";
import { runInboundAutoReplies } from "@/modules/inbound/inboundAutoReply";
import { acceptsInboundAddress, evaluateSenderPolicy } from "@/modules/inbound/inboundAddressService";
import { openInboundReview, resumeInboundDocumentRouting } from "@/modules/inbound/inboundDocumentRouting";
import { notifyAccountRoleHolders } from "@/modules/notifications/notifyAccount";
/**
 * Inbound email ingestion worker.
 *
 * Same shape as `documentProcessingWorker.ts`'s `runWorkerTick`: a single
 * bounded pass over durable Postgres state, safe to call concurrently from
 * both the webhook's `after()` dispatch and the `inbound-email-processing`
 * cron tick, because every step here re-checks and conditionally advances
 * state rather than assuming where a row was left off.
 *
 * No parsing happens here -- attachments are stored, then handed to the
 * existing `enqueueDocumentParse` pipeline, exactly like a manual upload.
 *
 * An email from a sender nobody has registered still gets its attachments
 * downloaded, scanned, and stored (under a `quarantine/` prefix) -- it just
 * isn't attributed to any account yet. A platform admin releases it later via
 * `modules/inbound/quarantineReview.ts`, which is what actually creates the
 * `ShipmentDocument` rows and runs the audit/duplicate/parse pipeline.
 */

import { randomUUID } from "crypto";
import { db, runWithAccountId, withDataModeContext } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { storeDocumentFile, StorageValidationError } from "@/lib/storage";
import { screenUploadForMalware } from "./malwarePolicy";
import { assertParseableFormat } from "./documentSource";
import { isDocumentParserError } from "../parser/contracts";
import { enqueueDocumentParse } from "./documentProcessingWorker";
import { findCrossShipmentDuplicates } from "@/modules/documents/duplicateDetection";
import { resolveBlockedInboundRoute, resolveInboundRoute } from "@/modules/inbound/senderRouting";
import { notify } from "@/modules/notifications/notify";
import {
  getReceivedEmail,
  getAttachmentDownloadInfo,
  downloadAttachmentBytes,
  type ReceivedEmailAttachmentMeta,
} from "@/lib/inbound/resendClient";

const MAX_EMAILS_PER_TICK = 10;
export type InboundEmailProvider = { getReceivedEmail: typeof getReceivedEmail; getAttachmentDownloadInfo: typeof getAttachmentDownloadInfo; downloadAttachmentBytes: typeof downloadAttachmentBytes };
const resendProvider: InboundEmailProvider = { getReceivedEmail, getAttachmentDownloadInfo, downloadAttachmentBytes };
type TickOptions = { emailIds?: string[]; provider?: InboundEmailProvider };

export interface InboundEmailTickResult {
  claimed: number;
  quarantined: number;
  accepted: number;
  rejected: number;
  failed: number;
}

function log(event: string, fields: Record<string, string | number | boolean | null>): void {
  console.log(`[InboundEmailWorker] ${event}`, fields);
}

export async function runInboundEmailWorkerTick(options: TickOptions = {}): Promise<InboundEmailTickResult> {
  // InboundEmail has an optional `account` relation, and the shared `db`
  // client auto-filters every read through that relation by dataMode unless
  // told otherwise (see packages/db/src/index.ts, buildIsolatedQueryArgs) --
  // with no context at all (the default for both call sites here: the
  // webhook's after() and the cron tick), that default silently excludes
  // every row that doesn't have an account yet, i.e. every freshly RECEIVED
  // email, before routing has even had a chance to run. This worker is
  // explicitly cross-tenant/pre-attribution by design, so it has to opt out
  // of that filter itself rather than rely on a caller to.
  return withDataModeContext(null, async () => runTickWithBypass(options));
}

async function runTickWithBypass(options: TickOptions): Promise<InboundEmailTickResult> {
  if (!options.provider && process.env.INBOUND_CLIENT_ADDRESSES_ENABLED === 'true') {
    const expired = await db.inboundAddress.findMany({ where: { status: 'SUSPENDED', graceUntil: { lte: new Date() }, activeKey: null }, select: { id: true, accountId: true }, take: 50 });
    for (const address of expired) await db.$transaction(async tx => {
      const changed = await tx.inboundAddress.updateMany({ where: { id: address.id, status: 'SUSPENDED' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      if (changed.count) await tx.auditLog.create({ data: { accountId: address.accountId, entity: 'InboundAddress', entityId: address.id, action: 'inbound_address.grace_expired', source: 'SYSTEM' } });
    });
  }
  const dueEmails = await db.inboundEmail.findMany({
    where: { routingStatus: { in: ["RECEIVED", "ROUTED"] }, ...(options.emailIds ? { id: { in: options.emailIds } } : {}) },
    orderBy: { createdAt: "asc" },
    take: MAX_EMAILS_PER_TICK,
  });

  log("tick.started", { claimed: dueEmails.length, inboundEmailIds: dueEmails.map((e) => e.id).join(", ") || null });

  const result: InboundEmailTickResult = { claimed: dueEmails.length, quarantined: 0, accepted: 0, rejected: 0, failed: 0 };

  for (const email of dueEmails) {
    const leaseToken = randomUUID();
    const claimed = await db.inboundEmail.updateMany({ where: { id: email.id, routingStatus: { in: ['RECEIVED', 'ROUTED'] }, OR: [{ processingLeaseUntil: null }, { processingLeaseUntil: { lt: new Date() } }] }, data: { processingLeaseUntil: new Date(Date.now() + 10 * 60_000), processingLeaseToken: leaseToken } });
    if (!claimed.count) continue;
    try {
      const outcome = await runWithAccountId(email.accountId ?? undefined, () => processOneEmail(email.id, options.provider ?? resendProvider));
      if (outcome === "QUARANTINED") result.quarantined += 1;
      else if (outcome === "REJECTED") result.rejected += 1;
      else result.accepted += 1;
    } catch (error) {
      result.failed += 1;
      log("email.tick_error", { inboundEmailId: email.id, error: error instanceof Error ? error.message : String(error) });
      // Left as ROUTED/RECEIVED so the next tick retries -- no state was
      // corrupted, since every downstream write here is itself idempotent.
    } finally {
      await db.inboundEmail.updateMany({ where: { id: email.id, processingLeaseToken: leaseToken }, data: { processingLeaseUntil: null, processingLeaseToken: null } });
    }
  }

  if (!options.provider && process.env.INBOUND_CLIENT_ADDRESSES_ENABLED === "true") await resumeInboundDocumentRouting();
  if (!options.provider) await runInboundAutoReplies();
  log("tick.finished", { ...result });
  return result;
}

async function processOneEmail(inboundEmailId: string, provider: InboundEmailProvider): Promise<"QUARANTINED" | "ACCEPTED" | "REJECTED"> {
  let email = await db.inboundEmail.findUniqueOrThrow({ where: { id: inboundEmailId } });
  log("email.processing_started", {
    inboundEmailId: email.id,
    routingStatus: email.routingStatus,
    normalizedFromAddress: email.normalizedFromAddress,
  });

  let route: Awaited<ReturnType<typeof resolveInboundRoute>> = null;
  let senderDecision: 'ACCEPT' | 'REVIEW' | 'HOLD' | 'REJECT' = 'ACCEPT';
  let destination: Awaited<ReturnType<typeof db.inboundAddress.findUnique>> = null;
  if (email.inboundAddressId) {
    destination = await db.inboundAddress.findUnique({ where: { id: email.inboundAddressId } });
    if (!destination || !acceptsInboundAddress(destination) || destination.accountId !== email.accountId || destination.clientId !== email.clientId) {
      await db.inboundEmail.update({ where: { id: email.id }, data: { routingStatus: 'REJECTED', quarantineReason: 'recipient_inactive' } });
      return 'REJECTED';
    }
    const senders = await db.inboundSenderRoute.findMany({ where: { accountId: destination.accountId, normalizedSenderEmail: email.normalizedFromAddress, OR: [{ clientId: email.clientId }, { clientId: null }] } });
    senderDecision = evaluateSenderPolicy(destination.senderPolicy, senders.map(s => s.status), !!email.senderApprovedAt);
    if (senderDecision === 'REJECT') {
      await db.inboundEmail.update({ where: { id: email.id }, data: { routingStatus: 'REJECTED', quarantineReason: 'blocked_sender' } });
      return 'REJECTED';
    }
    if (senderDecision === 'HOLD') {
      await openInboundReview({ accountId: destination.accountId, clientId: destination.clientId, inboundEmailId: email.id, reason: 'UNKNOWN_SENDER' });
      await db.inboundEmail.update({ where: { id: email.id }, data: { routingStatus: 'NEEDS_REVIEW', quarantineReason: 'unknown_sender' } });
      return 'QUARANTINED';
    }
    email = await db.inboundEmail.update({ where: { id: email.id }, data: { routingStatus: 'ROUTED' } });
  } else {
    const blockedRoute = await resolveBlockedInboundRoute(email.normalizedFromAddress);
    if (blockedRoute) {
      await db.inboundEmail.update({ where: { id: email.id }, data: { accountId: blockedRoute.accountId, routingStatus: 'REJECTED', quarantineReason: 'blocked_sender' } });
      return 'REJECTED';
    }
    route = await resolveInboundRoute(email.normalizedFromAddress);
    if (email.routingStatus === 'RECEIVED' && route) email = await db.inboundEmail.update({ where: { id: email.id }, data: { accountId: route.accountId, routingStatus: 'ROUTED' } });
  }
  const accountId = email.accountId;
  const defaultAssigneeId = destination?.defaultAssignedToUserId ?? route?.defaultAssignedToUserId ?? null;

  const remote = await provider.getReceivedEmail(email.providerEmailId);
  log("email.fetched_from_provider", {
    inboundEmailId: email.id,
    providerEmailId: email.providerEmailId,
    attachmentCount: remote.attachments.length,
    attachmentFilenames: remote.attachments.map((a) => a.filename ?? a.id).join(", ") || null,
  });
  if (email.authHeaders === null) {
    await db.inboundEmail.update({
      where: { id: email.id },
      data: { authHeaders: remote.headers ?? {} },
    });
  }

  let storedCount = 0;
  let duplicateCount = 0;
  for (const attachment of remote.attachments) {
    const outcome = await processOneAttachment({ accountId, email, attachment, defaultAssigneeId, provider, purpose: destination?.purpose, senderNeedsReview: senderDecision === "REVIEW" });
    if (outcome.stored) storedCount += 1;
    duplicateCount += outcome.crossShipmentDuplicateCount;
  }

  if (!accountId) {
    // createAuditLog requires a real accountId (it's a NOT NULL FK to
    // Account) and an unrouted email was never attributed to a tenant --
    // this log line, plus the InboundEmail/InboundAttachment rows themselves,
    // is the durable record for this case. A tenant-agnostic quarantine audit
    // trail is out of scope for this slice; see the plan's deferred-scope
    // notes.
    await db.inboundEmail.update({
      where: { id: email.id },
      data: { routingStatus: "QUARANTINED", quarantineReason: "unknown_sender" },
    });
    log("email.quarantined", {
      inboundEmailId: email.id,
      reason: "unknown_sender",
      attachmentCount: remote.attachments.length,
      storedCount,
    });
    return "QUARANTINED";
  }

  if (storedCount > 0 && defaultAssigneeId) {
    const duplicateSuffix =
      duplicateCount > 0 ? ` (${duplicateCount} possible duplicate${duplicateCount === 1 ? "" : "s"} of existing documents)` : "";
    // dedupe guards against a duplicate if a prior tick stored attachments but
    // crashed before reaching routingStatus: "ACCEPTED" below -- the retry
    // recomputes storedCount (correctly, from already-STORED rows).
    await notify({
      accountId,
      userId: defaultAssigneeId,
      type: "INBOUND_EMAIL_DOCUMENTS",
      message: `${storedCount} new document${storedCount === 1 ? "" : "s"} from ${email.originalFromAddress}${duplicateSuffix}`,
      entityType: "InboundEmail",
      entityId: email.id,
      dedupe: true,
    });
  }

  const needsReview = destination ? await db.inboundDocumentReview.count({ where: { inboundEmailId: email.id, status: 'OPEN' } }) : 0;
  if (destination && storedCount > 0) await notifyAccountRoleHolders({ accountId, permission: 'document.update', type: 'INBOUND_EMAIL_DOCUMENTS', message: `${storedCount} documents received by email${needsReview ? ` — ${needsReview} need review` : ' — processing shipment matches'}.`, entityType: 'InboundEmail', entityId: email.id, dedupe: true });
  await db.inboundEmail.update({ where: { id: email.id }, data: { routingStatus: needsReview ? 'NEEDS_REVIEW' : storedCount === 0 && remote.attachments.length ? 'REJECTED' : 'ACCEPTED' } });
  if (destination) await summarizeInboundReceipt(accountId, email.id);
  log("email.accepted", { inboundEmailId: email.id, accountId, attachmentCount: remote.attachments.length, storedCount });
  return "ACCEPTED";
}

interface AttachmentOutcome {
  stored: boolean;
  crossShipmentDuplicateCount: number;
}

const NOT_STORED: AttachmentOutcome = { stored: false, crossShipmentDuplicateCount: 0 };

async function processOneAttachment(params: {
  accountId: string | null;
  email: { id: string; providerEmailId: string; clientId?: string | null; inboundAddressId?: string | null };
  provider: InboundEmailProvider;
  purpose?: string;
  senderNeedsReview?: boolean;
  attachment: ReceivedEmailAttachmentMeta;
  defaultAssigneeId: string | null;
}): Promise<AttachmentOutcome> {
  const { accountId, email, attachment, defaultAssigneeId } = params;

  const attachmentLabel = attachment.filename ?? attachment.id;
  log("attachment.processing_started", {
    inboundEmailId: email.id,
    providerAttachmentId: attachment.id,
    filename: attachmentLabel,
    contentDisposition: attachment.contentDisposition,
    hasAccount: !!accountId,
  });

  const existing = await db.inboundAttachment.findUnique({
    where: { inboundEmailId_providerAttachmentId: { inboundEmailId: email.id, providerAttachmentId: attachment.id } },
  });
  // Already processed (or explicitly skipped) in a prior tick -- do not redo work.
  if (existing && existing.processingStatus !== "PENDING") {
    log("attachment.already_processed", {
      inboundEmailId: email.id,
      providerAttachmentId: attachment.id,
      filename: attachmentLabel,
      processingStatus: existing.processingStatus,
    });
    if (existing.processingStatus === 'STORED' && existing.shipmentDocumentId && accountId && existing.checksum) {
      if (params.senderNeedsReview) await openInboundReview({ accountId, clientId: email.clientId ?? null, inboundEmailId: email.id, shipmentDocumentId: existing.shipmentDocumentId, reason: 'UNKNOWN_SENDER' });
      await enqueueDocumentParse({ accountId, documentId: existing.shipmentDocumentId, contentSha256: existing.checksum, profile: 'STANDARD', reason: 'INITIAL', correlationId: randomUUID() });
    }
    return existing.processingStatus === "STORED" || existing.processingStatus === "QUARANTINED"
      ? { stored: true, crossShipmentDuplicateCount: 0 }
      : NOT_STORED;
  }

  const isInline = attachment.contentDisposition === "inline";
  if (isInline) {
    log("attachment.skipped_inline", { inboundEmailId: email.id, providerAttachmentId: attachment.id, filename: attachmentLabel });
    await db.inboundAttachment.upsert({
      where: { inboundEmailId_providerAttachmentId: { inboundEmailId: email.id, providerAttachmentId: attachment.id } },
      create: {
        inboundEmailId: email.id,
        providerAttachmentId: attachment.id,
        originalFilename: attachment.filename ?? "unnamed",
        declaredMimeType: attachment.contentType,
        contentDisposition: attachment.contentDisposition,
        actualSize: attachment.size,
        processingStatus: "SKIPPED_INLINE",
      },
      update: { processingStatus: "SKIPPED_INLINE" },
    });
    return NOT_STORED;
  }

  const attachmentRow = await db.inboundAttachment.upsert({
    where: { inboundEmailId_providerAttachmentId: { inboundEmailId: email.id, providerAttachmentId: attachment.id } },
    create: {
      inboundEmailId: email.id,
      providerAttachmentId: attachment.id,
      originalFilename: attachment.filename ?? "unnamed",
      declaredMimeType: attachment.contentType,
      contentDisposition: attachment.contentDisposition,
      actualSize: attachment.size,
      processingStatus: "PENDING",
    },
    update: {},
  });

  const correlationId = randomUUID();
  const filename = attachment.filename ?? `attachment-${attachment.id}`;
  // Unrecognized senders still get their files downloaded, scanned, and
  // stored -- just under a separate blob prefix, since nothing here is
  // attributed to a tenant yet.
  const folder = accountId ? `documents/${accountId}/${email.clientId ?? "ops"}` : "quarantine";

  try {
    const download = await params.provider.getAttachmentDownloadInfo(email.providerEmailId, attachment.id);
    const bytes = await params.provider.downloadAttachmentBytes(download.downloadUrl);
    log("attachment.downloaded", {
      inboundEmailId: email.id,
      providerAttachmentId: attachment.id,
      filename: attachmentLabel,
      byteLength: bytes.byteLength,
    });

    try {
      assertParseableFormat(bytes);
    } catch (error) {
      const reason = isDocumentParserError(error) ? error.message : "Unreadable file format.";
      await rejectAttachment(attachmentRow.id, reason, { inboundEmailId: email.id, providerAttachmentId: attachment.id, filename: attachmentLabel });
      return NOT_STORED;
    }

    const scan = await screenUploadForMalware({ fileName: filename, byteSize: bytes.byteLength, bytes });
    log("attachment.malware_scan_result", {
      inboundEmailId: email.id,
      providerAttachmentId: attachment.id,
      filename: attachmentLabel,
      verdict: scan.verdict,
      reason: scan.reason ?? null,
    });
    // Public destination addresses must never accept an unscanned attachment,
    // even when ordinary manual uploads use the legacy advisory policy.
    if (scan.verdict === "QUARANTINE" || (email.inboundAddressId && scan.verdict !== "CLEAN")) {
      await rejectAttachment(attachmentRow.id, scan.reason, { inboundEmailId: email.id, providerAttachmentId: attachment.id, filename: attachmentLabel });
      if (accountId) {
        await createAuditLog({
          accountId,
          action: "inbound_email.attachment_quarantined",
          entity: "InboundAttachment",
          entityId: attachmentRow.id,
          source: "SYSTEM",
          metadata: { fileName: filename, reason: scan.reason },
          correlationId,
          success: false,
        });
      }
      return NOT_STORED;
    }

    // A fresh Uint8Array copy: File/Blob do not accept a Node Buffer's
    // underlying ArrayBuffer view directly across every runtime.
    const file = new File([new Uint8Array(bytes)], filename, {
      type: download.contentType || attachment.contentType,
    });
    let storageResult;
    try {
      storageResult = await storeDocumentFile(file, filename, folder);
      log("attachment.stored_to_blob", {
        inboundEmailId: email.id,
        providerAttachmentId: attachment.id,
        filename: attachmentLabel,
        folder,
        url: storageResult.url,
        provider: storageResult.provider,
      });
    } catch (error) {
      const reason = error instanceof StorageValidationError ? error.message : "Storage failed.";
      await rejectAttachment(attachmentRow.id, reason, { inboundEmailId: email.id, providerAttachmentId: attachment.id, filename: attachmentLabel });
      return NOT_STORED;
    }

    if (!accountId) {
      // Sender not recognized: keep the stored file referenced only from
      // InboundAttachment. A platform admin releases it later via
      // modules/inbound/quarantineReview.ts, which creates the
      // ShipmentDocument and runs the audit/duplicate/parse steps below.
      await db.inboundAttachment.update({
        where: { id: attachmentRow.id },
        data: {
          processingStatus: "QUARANTINED",
          checksum: storageResult.checksum,
          quarantinedFileUrl: storageResult.url,
          actualSize: bytes.byteLength,
          declaredMimeType: file.type || attachment.contentType,
        },
      });
      log("attachment.quarantined", {
        inboundEmailId: email.id,
        providerAttachmentId: attachment.id,
        filename: attachmentLabel,
        quarantinedFileUrl: storageResult.url,
      });
      return { stored: true, crossShipmentDuplicateCount: 0 };
    }

    const { DocumentTypeCatalog } = await import("@/modules/intake/documentTypeCatalog");
    const docType = DocumentTypeCatalog.matchDocumentType(filename).name;

    const document = await db.$transaction(async tx => {
      const created = await tx.shipmentDocument.create({
      data: {
        accountId,
        shipmentId: null,
        source: email.inboundAddressId ? "INBOUND_EMAIL" : "EMAIL",
        clientId: email.clientId ?? null,
        portalVisibility: email.clientId && params.purpose === "CLIENT_DOCUMENTS" ? "CUSTOMER" : "INTERNAL",
        assignedToUserId: defaultAssigneeId,
        docType,
        fileName: filename,
        fileUrl: storageResult.url,
        checksum: storageResult.checksum,
        byteSize: bytes.byteLength,
        mimeType: file.type || null,
      },
    });

    await tx.inboundAttachment.update({
      where: { id: attachmentRow.id },
      data: { processingStatus: "STORED", checksum: storageResult.checksum, shipmentDocumentId: created.id },
    });
    return created;
    });

    if (params.senderNeedsReview) await openInboundReview({ accountId, clientId: email.clientId ?? null, inboundEmailId: email.id, shipmentDocumentId: document.id, reason: 'UNKNOWN_SENDER' });

    const crossShipmentDuplicates = await findCrossShipmentDuplicates(
      accountId,
      storageResult.checksum,
      null,
      document.id
    );

    await createAuditLog({
      accountId,
      action: AuditAction.DOCUMENT_STORED,
      entity: "ShipmentDocument",
      entityId: document.id,
      source: "SYSTEM",
      metadata: {
        fileName: filename,
        docType,
        byteSize: bytes.byteLength,
        sha256: storageResult.checksum,
        mimeType: file.type || null,
        storageProvider: storageResult.provider,
        malwareScan: scan.verdict,
        inboundEmailId: email.id,
        inboundAttachmentId: attachmentRow.id,
        crossShipmentDuplicateCount: crossShipmentDuplicates.length,
      },
      correlationId,
    });

    await enqueueDocumentParse({
      accountId,
      documentId: document.id,
      contentSha256: storageResult.checksum,
      profile: "STANDARD",
      reason: "INITIAL",
      correlationId,
    });
    log("attachment.stored_as_document", {
      inboundEmailId: email.id,
      providerAttachmentId: attachment.id,
      filename: attachmentLabel,
      accountId,
      documentId: document.id,
      crossShipmentDuplicateCount: crossShipmentDuplicates.length,
    });
    return { stored: true, crossShipmentDuplicateCount: crossShipmentDuplicates.length };
  } catch (error) {
    const latest = await db.inboundAttachment.findUnique({ where: { id: attachmentRow.id } });
    if (latest?.shipmentDocumentId) throw error;
    await rejectAttachment(
      attachmentRow.id,
      error instanceof Error ? error.message : "Unexpected error while processing this attachment.",
      { inboundEmailId: email.id, providerAttachmentId: attachment.id, filename: attachmentLabel }
    );
    return NOT_STORED;
  }
}

async function rejectAttachment(
  attachmentId: string,
  reason: string,
  context?: { inboundEmailId: string; providerAttachmentId: string; filename: string }
): Promise<void> {
  log("attachment.rejected", { attachmentId, reason, ...(context ?? {}) });
  await db.inboundAttachment.update({
    where: { id: attachmentId },
    data: { processingStatus: "REJECTED", rejectionReason: reason },
  });
}

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { matchShipmentForDocument, isMatchConflict } from '@/modules/shipments/shipmentMatching';
import { createAuditLog, AuditAction } from '@/lib/audit';
import { linkDocument } from '@/modules/documentAssociations/service';
import { notifyAccountRoleHolders } from '@/modules/notifications/notifyAccount';
import { generateEntryProof } from '@/lib/filing/entryProofService';

export function inboundAutoAttachThreshold() {
  const value = Number(process.env.INBOUND_AUTO_ATTACH_THRESHOLD || 0.75);
  return Number.isFinite(value) && value >= 0.75 && value <= 1 ? value : 0.75;
}

export async function openInboundReview(input: { accountId: string; clientId: string | null; inboundEmailId: string; shipmentDocumentId?: string; reason: string; candidateSummary?: unknown }) {
  const reviewKey = input.shipmentDocumentId ? `document:${input.shipmentDocumentId}` : `sender:${input.inboundEmailId}`;
  const candidateSummary = input.candidateSummary === undefined ? undefined : JSON.parse(JSON.stringify(input.candidateSummary)) as Prisma.InputJsonValue;
  const existing = await db.inboundDocumentReview.findUnique({ where: { reviewKey } });
  // Never reopen a broker's completed decision during a parser retry.
  if (existing && existing.status !== 'OPEN') return existing;
  const review = await db.inboundDocumentReview.upsert({ where: { reviewKey }, create: { ...input, candidateSummary, reviewKey }, update: { candidateSummary, ...(existing?.reason === 'UNKNOWN_SENDER' ? {} : { reason: input.reason }) } });
  if (input.shipmentDocumentId) await db.inboundAttachment.updateMany({ where: { shipmentDocumentId: input.shipmentDocumentId }, data: { reviewId: review.id } });
  await db.inboundEmail.updateMany({ where: { id: input.inboundEmailId, routingStatus: 'ACCEPTED' }, data: { routingStatus: 'NEEDS_REVIEW' } });
  await notifyAccountRoleHolders({ accountId: input.accountId, permission: 'document.update', type: 'INBOUND_EMAIL_DOCUMENTS', message: input.reason === 'UNKNOWN_SENDER' ? 'New email sender — review before attaching documents.' : 'Emailed document needs a shipment decision.', entityType: 'InboundDocumentReview', entityId: review.id, dedupe: true });
  return review;
}

export async function refreshInboundEntryProof(accountId: string, documentId: string) {
  const document = await db.shipmentDocument.findFirst({ where: { id: documentId, accountId }, select: { shipmentId: true, clientId: true } });
  if (!document?.shipmentId || !document.clientId) return;
  const filings = await db.customsFiling.findMany({ where: { accountId, shipmentId: document.shipmentId, entryProofs: { some: { status: 'PUBLISHED', clientId: document.clientId } } }, select: { id: true } });
  for (const filing of filings) {
    await generateEntryProof(filing.id, { accountId }, { inboundDocumentId: documentId });
    await notifyAccountRoleHolders({ accountId, permission: 'filing.approve', type: 'INBOUND_EMAIL_DOCUMENTS', message: 'Proof out of date — new document received. Review the new draft before publishing.', entityType: 'CustomsFiling', entityId: filing.id, dedupe: true });
  }
}

export async function attachInboundDocument(accountId: string, documentId: string, shipmentId: string, userId?: string) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ShipmentDocument" WHERE id = ${documentId} AND "accountId" = ${accountId} FOR UPDATE`;
    const document = await tx.shipmentDocument.findFirst({ where: { id: documentId, accountId } });
    if (!document || document.status === 'DISCARDED') throw new Error('DOCUMENT_NOT_FOUND');
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, accountId, deletedAt: null, clientId: document.clientId }, select: { id: true } });
    if (!shipment) throw new Error('SHIPMENT_CLIENT_MISMATCH');
    if (document.shipmentId && document.shipmentId !== shipmentId) throw new Error('DOCUMENT_ALREADY_ATTACHED');
    await tx.shipmentDocument.update({ where: { id: documentId }, data: { shipmentId } });
  });
  await linkDocument({ accountId, documentId, entityType: 'SHIPMENT', entityId: shipmentId, relationshipType: 'SOURCE_DOCUMENT', source: 'DOCUMENT_INTELLIGENCE', linkedBy: userId || 'SYSTEM', auditSource: userId ? 'UI' : 'SYSTEM' });
  await refreshInboundEntryProof(accountId, documentId);
  await createAuditLog({ accountId, userId, action: AuditAction.AUTO_ATTACH_DOCUMENT, entity: 'ShipmentDocument', entityId: documentId, source: userId ? 'UI' : 'SYSTEM', metadata: { shipmentId, algorithmVersion: 'v2-weighted-multi-identifier', trigger: 'INBOUND_DOCUMENT' } });
}

/** Called after parsing, when the existing deterministic matcher has usable text. */
export async function routeParsedInboundDocument(accountId: string, documentId: string, parsedText: string | null, extractionFailed = false) {
  const document = await db.shipmentDocument.findFirst({ where: { id: documentId, accountId }, include: { inboundAttachment: { include: { inboundEmail: true } }, inboundDocumentReview: true } });
  const email = document?.inboundAttachment?.inboundEmail;
  if (!document || !email?.inboundAddressId || document.status === 'DISCARDED') return null;
  if (document.shipmentId) { await refreshInboundEntryProof(accountId, documentId); return document.shipmentId; }
  if (document.inboundDocumentReview && document.inboundDocumentReview.status !== 'OPEN') return null;
  const unknownSender = document.inboundDocumentReview?.reason === 'UNKNOWN_SENDER';
  const result = await matchShipmentForDocument({ accountId, clientId: document.clientId, documentId, parsedText, emailSubject: email.subject, autoAttachThreshold: inboundAutoAttachThreshold(), requireReview: unknownSender || extractionFailed });
  if (result.matchedShipmentId) {
    await attachInboundDocument(accountId, documentId, result.matchedShipmentId);
    await db.inboundDocumentReview.updateMany({ where: { shipmentDocumentId: documentId, accountId, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedShipmentId: result.matchedShipmentId, resolvedAt: new Date() } });
    return result.matchedShipmentId;
  }
  await openInboundReview({ accountId, clientId: document.clientId, inboundEmailId: email.id, shipmentDocumentId: documentId, reason: unknownSender ? 'UNKNOWN_SENDER' : extractionFailed ? 'EXTRACTION_FAILED' : isMatchConflict(result) ? 'MATCH_CONFLICT' : result.candidates.length ? 'LOW_CONFIDENCE' : 'NO_MATCH', candidateSummary: result.candidates.map(c => ({ shipmentId: c.shipmentId, score: c.score, signals: c.breakdown.signals })) });
  return null;
}

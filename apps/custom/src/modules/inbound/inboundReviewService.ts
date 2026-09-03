import { summarizeInboundReceipt } from './inboundNotifications';
import { db } from '@/lib/db';
import { attachInboundDocument } from './inboundDocumentRouting';

export async function decideInboundReview(accountId: string, id: string, userId: string, input: { action: 'resolve' | 'discard' | 'reassign' | 'approve'; shipmentId?: string; clientId?: string }) {
  const review = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "InboundDocumentReview" WHERE id = ${id} AND "accountId" = ${accountId} FOR UPDATE`;
    const row = await tx.inboundDocumentReview.findFirst({ where: { id, accountId }, include: { shipmentDocument: true, inboundEmail: true } });
    if (!row) throw new Error('REVIEW_NOT_FOUND');
    if (row.status !== 'OPEN') {
      if (input.action === 'resolve' && row.status === 'RESOLVED' && row.resolvedShipmentId === input.shipmentId) return row;
      throw new Error('REVIEW_ALREADY_DECIDED');
    }
    let doc = row.shipmentDocument;
    if (doc) {
      await tx.$queryRaw`SELECT id FROM "ShipmentDocument" WHERE id = ${doc.id} AND "accountId" = ${accountId} FOR UPDATE`;
      doc = await tx.shipmentDocument.findFirst({ where: { id: doc.id, accountId } });
    }
    if (input.action === 'approve') {
      if (doc || row.reason !== 'UNKNOWN_SENDER') throw new Error('INVALID_REVIEW_ACTION');
      await tx.inboundEmail.update({ where: { id: row.inboundEmailId }, data: { senderApprovedAt: new Date(), routingStatus: 'RECEIVED', quarantineReason: null } });
    } else if (input.action === 'reassign') {
      if (!doc || doc.shipmentId || !input.clientId) throw new Error('INVALID_REVIEW_ACTION');
      if (!await tx.client.findFirst({ where: { id: input.clientId, accountId }, select: { id: true } })) throw new Error('CLIENT_NOT_FOUND');
      await tx.shipmentDocument.update({ where: { id: doc.id }, data: { clientId: input.clientId } });
      await tx.documentShipmentCandidate.deleteMany({ where: { documentId: doc.id, accountId } });
    } else if (input.action === 'resolve') {
      if (!doc || !input.shipmentId) throw new Error('INVALID_REVIEW_ACTION');
      const current = await tx.shipmentDocument.findFirst({ where: { id: doc.id, accountId }, select: { shipmentId: true, clientId: true } });
      if (!current || (current.shipmentId && current.shipmentId !== input.shipmentId)) throw new Error('DOCUMENT_ALREADY_ATTACHED');
      if (!await tx.shipment.findFirst({ where: { id: input.shipmentId, accountId, clientId: current.clientId, deletedAt: null }, select: { id: true } })) throw new Error('SHIPMENT_CLIENT_MISMATCH');
      await tx.shipmentDocument.update({ where: { id: doc.id }, data: { shipmentId: input.shipmentId, inboundProofPending: true } });
    } else if (doc) {
      const current = await tx.shipmentDocument.findFirst({ where: { id: doc.id, accountId }, select: { shipmentId: true } });
      if (current?.shipmentId) throw new Error('DOCUMENT_ALREADY_ATTACHED');
      await tx.shipmentDocument.update({ where: { id: doc.id }, data: { status: 'DISCARDED', portalVisibility: 'INTERNAL' } });
    } else {
      await tx.inboundEmail.update({ where: { id: row.inboundEmailId }, data: { routingStatus: 'REJECTED', quarantineReason: 'broker_discarded' } });
    }
    const updated = await tx.inboundDocumentReview.update({ where: { id }, data: input.action === 'reassign' ? { clientId: input.clientId, candidateSummary: [], reason: 'NO_MATCH' } : { status: input.action === 'discard' ? 'DISCARDED' : 'RESOLVED', resolvedAt: new Date(), resolvedByUserId: userId, resolvedShipmentId: input.shipmentId } });
    await tx.auditLog.create({ data: { accountId, userId, entity: 'InboundDocumentReview', entityId: id, action: `inbound_review.${input.action}`, source: 'UI', newValue: { shipmentId: input.shipmentId ?? null, clientId: input.clientId ?? row.clientId }, oldValue: { clientId: row.clientId } } });
    return updated;
  });
  // Idempotent on retry even if the broker decision committed before a downstream failure.
  if (input.action === 'resolve' && review.shipmentDocumentId && review.resolvedShipmentId) {
    await attachInboundDocument(accountId, review.shipmentDocumentId, review.resolvedShipmentId, userId);
    const { runDocumentExtraction } = await import('@/modules/documents/processing/classificationExtraction');
    await runDocumentExtraction({ accountId, userId, documentId: review.shipmentDocumentId, shipmentId: review.resolvedShipmentId, correlationId: null, processingRunId: null });
  }
  await summarizeInboundReceipt(accountId, review.inboundEmailId);
  return review;
}

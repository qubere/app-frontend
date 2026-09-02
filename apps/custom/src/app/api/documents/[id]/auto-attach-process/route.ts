import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { db } from '@/lib/db';
import { matchShipmentForDocument } from '@/modules/shipments/shipmentMatching';
import { routeParsedInboundDocument, attachInboundDocument, openInboundReview } from '@/modules/inbound/inboundDocumentRouting';
import { enqueueDocumentParse } from '@/modules/documents/processing/documentProcessingWorker';
import { randomUUID } from 'node:crypto';

/** Reuse actual identifier evidence. Never invent a shipment or a processed status. */
export const POST = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, requestId }) => {
  const doc = await db.shipmentDocument.findFirst({ where: { id: params.id, accountId: ctx.accountId }, include: { inboundAttachment: { include: { inboundEmail: true } } } });
  if (!doc || doc.status === 'DISCARDED') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  let shipmentId = doc.shipmentId;
  if (!shipmentId && doc.source === 'INBOUND_EMAIL') {
    shipmentId = await routeParsedInboundDocument(ctx.accountId, doc.id, doc.rawContent || doc.extractedJson);
  } else if (!shipmentId) {
    const result = await matchShipmentForDocument({ accountId: ctx.accountId, clientId: doc.clientId, documentId: doc.id, emailSubject: doc.inboundAttachment?.inboundEmail.subject ?? null, parsedText: doc.rawContent || doc.extractedJson });
    shipmentId = result.matchedShipmentId;
    if (shipmentId) await attachInboundDocument(ctx.accountId, doc.id, shipmentId, ctx.userId);
    else if (doc.inboundAttachment) await openInboundReview({ accountId: ctx.accountId, clientId: doc.clientId, inboundEmailId: doc.inboundAttachment.inboundEmailId, shipmentDocumentId: doc.id, reason: result.candidates.length > 1 ? 'MATCH_CONFLICT' : result.candidates.length ? 'LOW_CONFIDENCE' : 'NO_MATCH', candidateSummary: result.candidates.map(c => ({ shipmentId: c.shipmentId, score: c.score, signals: c.breakdown.signals })) });
  }
  if (doc.checksum) await enqueueDocumentParse({ accountId: ctx.accountId, documentId: doc.id, contentSha256: doc.checksum, profile: 'STANDARD', reason: 'INITIAL', correlationId: randomUUID() });
  return NextResponse.json({ success: true, documentId: doc.id, shipmentId, status: shipmentId ? 'ATTACHED' : 'NEEDS_REVIEW', message: shipmentId ? 'Document attached. Processing is queued.' : 'No unambiguous shipment match. Select the shipment in document review.', requestId }, { status: shipmentId ? 200 : 202 });
}, { permission: 'document.update', write: true });

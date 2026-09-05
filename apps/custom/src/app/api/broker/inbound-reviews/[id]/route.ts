import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { db } from '@/lib/db';
export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, req }) => {
  const review = await db.inboundDocumentReview.findFirst({
    where: { id: params.id, accountId: ctx.accountId },
    select: {
      clientId: true,
      candidateSummary: true,
      shipmentDocument: {
        select: {
          shipmentCandidates: {
            select: { shipmentId: true },
          },
        },
      },
    },
  });
  if (!review) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const q = new URL(req.url).searchParams.get('q')?.slice(0, 100) || '';
  const liveCandidateIds = review.shipmentDocument?.shipmentCandidates.map((c) => c.shipmentId) ?? [];
  const snapshotCandidateIds = Array.isArray(review.candidateSummary)
    ? review.candidateSummary.flatMap((c) => (c && typeof c === 'object' && !Array.isArray(c) && typeof c.shipmentId === 'string' ? [c.shipmentId] : []))
    : [];
  const candidateIds = Array.from(new Set([...liveCandidateIds, ...snapshotCandidateIds])).slice(0, 50);
  const [shipments, clients, candidateShipments] = await Promise.all([
    db.shipment.findMany({ where: { accountId: ctx.accountId, clientId: review.clientId, deletedAt: null, ...(q ? { shipmentNumber: { contains: q, mode: 'insensitive' } } : {}) }, select: { id: true, shipmentNumber: true, importerName: true }, orderBy: { createdAt: 'desc' }, take: 25 }),
    db.client.findMany({ where: { accountId: ctx.accountId }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100 }),
    db.shipment.findMany({ where: { id: { in: candidateIds }, accountId: ctx.accountId, clientId: review.clientId, deletedAt: null }, select: { id: true, shipmentNumber: true, importerName: true } }),
  ]);
  return NextResponse.json({ shipments, clients, candidateShipments });
}, { permission: 'document.read' });

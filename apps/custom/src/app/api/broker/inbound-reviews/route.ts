import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { db } from '@/lib/db';
export const GET = withAuthenticatedRoute(async ({ ctx, req }) => {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId');
  const cursor = url.searchParams.get('cursor');
  const rows = await db.inboundDocumentReview.findMany({
    where: { accountId: ctx.accountId, status: 'OPEN', ...(clientId ? { clientId } : {}), ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: 'asc' }, take: 51,
    select: {
      id: true,
      reason: true,
      createdAt: true,
      clientId: true,
      candidateSummary: true,
      client: { select: { name: true } },
      inboundEmail: { select: { originalFromAddress: true, subject: true, receivedAt: true } },
      shipmentDocument: {
        select: {
          id: true,
          fileName: true,
          status: true,
          mimeType: true,
          shipmentCandidates: {
            select: {
              shipmentId: true,
              confidenceScore: true,
              reasoning: true,
              matchedIdentifierType: true,
              matchedValue: true,
              matchedSource: true,
            },
            orderBy: { confidenceScore: 'desc' },
            take: 20,
          },
        },
      },
    },
  });

  const items = rows.slice(0, 50).map((row) => {
    const liveCandidates = row.shipmentDocument?.shipmentCandidates;
    const candidates =
      liveCandidates && liveCandidates.length > 0
        ? liveCandidates.map((c) => ({
            shipmentId: c.shipmentId,
            score: c.confidenceScore,
            signals: [{ type: c.matchedIdentifierType, value: c.matchedValue, source: c.matchedSource }],
            reasoning: c.reasoning,
          }))
        : row.candidateSummary;

    return {
      ...row,
      candidateSummary: candidates,
    };
  });

  return NextResponse.json({ items, nextCursor: rows.length > 50 ? rows[49].id : null });
}, { permission: 'document.read' });

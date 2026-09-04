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
    select: { id: true, reason: true, createdAt: true, clientId: true, candidateSummary: true, client: { select: { name: true } }, inboundEmail: { select: { originalFromAddress: true, subject: true, receivedAt: true } }, shipmentDocument: { select: { id: true, fileName: true, status: true, mimeType: true } } },
  });
  return NextResponse.json({ items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null });
}, { permission: 'document.read' });

import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { parseAndValidateBody } from '@/lib/api/validation';
import { decideInboundReview } from '@/modules/inbound/inboundReviewService';
import { runInboundEmailWorkerTick } from '@/modules/documents/processing/inboundEmailWorker';
const schema = z.object({ shipmentId: z.string().min(1).optional(), clientId: z.string().min(1).optional() });
export const POST = withAuthenticatedRoute<{ id: string; action: string }>(async ({ ctx, req, params, requestId }) => {
  const action = z.enum(['resolve', 'discard', 'reassign', 'approve']).safeParse(params.action);
  if (!action.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const body = await parseAndValidateBody(req, schema, requestId);
  if ('response' in body) return body.response;
  try {
    const review = await decideInboundReview(ctx.accountId, params.id, ctx.userId, { ...body.data, action: action.data });
    if (action.data === 'approve') after(() => runInboundEmailWorkerTick().then(() => undefined));
    return NextResponse.json({ review });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (['REVIEW_NOT_FOUND', 'CLIENT_NOT_FOUND'].includes(message)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (['REVIEW_ALREADY_DECIDED', 'INVALID_REVIEW_ACTION', 'DOCUMENT_ALREADY_ATTACHED', 'SHIPMENT_CLIENT_MISMATCH'].includes(message)) return NextResponse.json({ error: message, message: 'This item changed or the shipment belongs to a different client. Refresh and check the selection.' }, { status: 409 });
    throw error;
  }
}, { permission: 'document.update', write: true });

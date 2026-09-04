import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { parseAndValidateBody } from '@/lib/api/validation';
import { db } from '@/lib/db';
import { clientInboundEnabled, issueClientInboundAddress } from '@/modules/inbound/inboundAddressService';
export const GET = withAuthenticatedRoute(async ({ ctx, req }) => {
  if (!clientInboundEnabled()) return NextResponse.json({ enabled: false, addresses: [], clients: [] });
  const clientId = new URL(req.url).searchParams.get('clientId');
  const [addresses, clients] = await Promise.all([
    db.inboundAddress.findMany({ where: { accountId: ctx.accountId, ...(clientId ? { clientId } : {}), OR: [{ activeKey: { not: null } }, { graceUntil: { gt: new Date() } }] }, take: 200, orderBy: [{ clientId: 'asc' }, { createdAt: 'desc' }], select: { id: true, clientId: true, address: true, status: true, purpose: true, senderPolicy: true, autoReplyEnabled: true, autoAttachPolicy: true, graceUntil: true, activeKey: true, client: { select: { name: true } }, inboundEmails: { orderBy: { receivedAt: 'desc' }, take: 1, select: { receivedAt: true } } } }),
    db.client.findMany({ where: { accountId: ctx.accountId, ...(clientId ? { id: clientId } : {}) }, take: 200, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ enabled: true, addresses, clients });
}, { permission: 'document.read' });
const schema = z.object({ clientId: z.string().min(1).nullable().optional() });
export const POST = withAuthenticatedRoute(async ({ ctx, req, requestId }) => {
  if (!clientInboundEnabled()) return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 409 });
  const body = await parseAndValidateBody(req, schema, requestId);
  if ('response' in body) return body.response;
  if (body.data.clientId && !await db.client.findFirst({ where: { id: body.data.clientId, accountId: ctx.accountId }, select: { id: true } })) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ address: await issueClientInboundAddress({ accountId: ctx.accountId, clientId: body.data.clientId, createdByUserId: ctx.userId }) });
}, { permission: 'settings.manage', write: true });

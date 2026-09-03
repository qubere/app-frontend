import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { parseAndValidateBody } from '@/lib/api/validation';
import { changeInboundAddress } from '@/modules/inbound/inboundAddressService';
const schema = z.object({ action: z.enum(['SUSPEND', 'RESUME', 'REVOKE', 'ROTATE', 'POLICY']), senderPolicy: z.enum(['OPEN', 'ALLOWLIST', 'REVIEW']).optional(), autoReplyEnabled: z.boolean().optional() });
export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, req, requestId }) => {
  const body = await parseAndValidateBody(req, schema, requestId);
  if ('response' in body) return body.response;
  try { return NextResponse.json({ address: await changeInboundAddress(ctx.accountId, params.id, body.data.action, ctx.userId, { senderPolicy: body.data.senderPolicy, autoReplyEnabled: body.data.autoReplyEnabled }) }); }
  catch (e) { if (e instanceof Error && e.message === 'ADDRESS_NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 }); if (e instanceof Error && e.message === 'ADDRESS_NO_LONGER_CURRENT') return NextResponse.json({ error: e.message }, { status: 409 }); throw e; }
}, { permission: 'settings.manage', write: true });

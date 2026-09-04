import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { parseAndValidateBody } from '@/lib/api/validation';
import { buildErrorResponse } from '@/lib/api/error';
import { linkOnboardingClient } from '@/modules/onboarding/clientLink.service';

export const POST = withAuthenticatedRoute(async ({ req, params, ctx, requestId }) => {
  const parsed = await parseAndValidateBody(req, z.object({ clientId: z.string().min(1) }).strict(), requestId);
  if ('response' in parsed) return parsed.response;
  try {
    const result = await linkOnboardingClient(ctx.accountId, params.caseId as string, parsed.data.clientId, ctx.userId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === 'NOT_FOUND') return buildErrorResponse(404, 'NOT_FOUND', 'Case or client not found', undefined, requestId);
    if (e.code === 'CONFLICT') return buildErrorResponse(409, 'CONFLICT', e.message!, undefined, requestId);
    if (e.code === 'P2034') return buildErrorResponse(409, 'CONFLICT', 'The setup changed while saving. Refresh and try again.', undefined, requestId);
    return buildErrorResponse(500, 'INTERNAL_ERROR', 'Could not update the client link. No changes were saved.', undefined, requestId);
  }
}, { permission: 'onboarding.manage', write: true });

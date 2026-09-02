import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { db } from '@/lib/db';
export const GET = withAuthenticatedRoute<{
    id: string;
}>(async ({ ctx, params }) => { const client = await db.client.findFirst({ where: { id: (await params).id, accountId: ctx.accountId }, select: { id: true, name: true, clientStakeholders: { orderBy: { name: 'asc' } }, clientDocuments: { select: { id: true, kind: true, title: true, status: true, portalVisible: true } }, onboardingCases: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, currentStep: true } } } }); return client ? NextResponse.json(client) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 }); }, { permission: 'client.read' });

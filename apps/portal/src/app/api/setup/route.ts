import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { portalScope, portalData, noStore, notFound } from '@/lib/portal-scope';
import { loadClientSetup } from '@/lib/client-setup';
export async function GET(req: Request) {
    const s = await portalScope(req, 'portal.setup.read');
    if (s.error)
        return s.error;
    return portalData(s.ctx, async () => {
        const clients = await db.client.findMany({ where: { accountId: s.ctx.accountId, ...(s.clientIds === null ? {} : { id: { in: s.clientIds } }) }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
        const requested = new URL(req.url).searchParams.get('clientId');
        if (clients.length !== 1 && !requested)
            return NextResponse.json({ clients, selectClient: true }, noStore);
        const clientId = requested || clients[0]?.id;
        if (!clientId)
            return notFound();
        const summary = await loadClientSetup(s.ctx.accountId, clientId);
        return summary ? NextResponse.json({ ...summary, clients }, noStore) : notFound();
    });
}

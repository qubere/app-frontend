import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { withPortalAccount, portalScope, portalData, noStore, notFound } from '@/lib/portal-scope';
import { loadClientSetup, loadWorkspaceSetup } from '@/lib/client-setup';
export const GET = withPortalAccount(async (_ctx, req: Request) => {
    const s = await portalScope(req, 'portal.setup.read');
    if (s.error)
        return s.error;
    return portalData(s.ctx, async () => {
        // Keep the switcher populated after a selection. The requested client's
        // authorization was already checked by portalScope above.
        const clients = await db.client.findMany({ where: { accountId: s.ctx.accountId, ...(s.availableClientIds === null ? {} : { id: { in: s.availableClientIds } }) }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
        const requested = new URL(req.url).searchParams.get('clientId');
        if (requested && !clients.some(client => client.id === requested)) return notFound();
        const summary = requested
            ? await loadClientSetup(s.ctx.accountId, requested)
            : await loadWorkspaceSetup(s.ctx.accountId);
        return summary ? NextResponse.json({ ...summary, clients }, noStore) : notFound();
    });
});

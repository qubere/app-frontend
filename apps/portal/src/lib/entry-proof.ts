import { authorizePortalResource, getAccountContext } from '@qubere/auth';
import { db } from '@qubere/db';
import { notFound, portalData } from './portal-scope';
export async function authorizedProof(id: string, permission = 'portal.entries.read') {
    const ctx = await getAccountContext();
    if (!ctx)
        return { error: notFound() } as const;
    return portalData(ctx, async () => {
        const filing = await db.customsFiling.findUnique({ where: { id, accountId: ctx.accountId }, select: { id: true, accountId: true, shipmentId: true, customerVisibleAt: true, shipment: { select: { clientId: true, importerName: true } } } });
        if (!filing)
            return { error: notFound() } as const;
        const auth = await authorizePortalResource({ permission, resourceAccountId: filing.accountId, resourceClientId: filing.shipment?.clientId, importerName: filing.shipment?.importerName, customerVisibleAt: filing.customerVisibleAt });
        if (!auth.authorized || !auth.ctx || !auth.effectiveClientId)
            return { error: auth.errorResponse ?? notFound() } as const;
        const proof = await portalData(auth.ctx, () => db.entryProof.findFirst({ where: { filingId: id, accountId: auth.ctx!.accountId, clientId: auth.effectiveClientId!, status: 'PUBLISHED' }, orderBy: { version: 'desc' } }));
        if (!proof)
            return { error: notFound() } as const;
        return { auth, proof, filing } as const;
    });
}

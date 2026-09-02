import { setupDocumentResponse } from '@/lib/setup-document-response';
import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { readStoredObject } from '@qubere/storage';
import { withPortalAccount, portalScope, portalData, notFound } from '@/lib/portal-scope';
export const GET = withPortalAccount(async (_ctx, req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) => {
    const s = await portalScope(req, 'portal.setup.read');
    if (s.error)
        return s.error;
    return portalData(s.ctx, async () => {
        const { id } = await params;
        if (!db.clientDocument?.findFirst) throw { code: 'PORTAL_SCHEMA_OUTDATED' };
        const d = await db.clientDocument.findFirst({ where: { id, accountId: s.ctx.accountId, ...(s.clientIds === null ? {} : { clientId: { in: s.clientIds } }), status: 'ACTIVE' } });
        if (!d)
            return notFound();
        let body: Buffer;
        try {
            ({ body } = await readStoredObject(d.storageUrl));
        }
        catch {
            return NextResponse.json({ error: 'CONTENT_UNAVAILABLE' }, { status: 502 });
        }
        await db.auditLog.create({ data: { accountId: s.ctx.accountId, userId: s.ctx.userId, action: 'CUSTOMER_SETUP_DOCUMENT_DOWNLOAD', entity: 'ClientDocument', entityId: d.id, clientId: d.clientId, source: 'PORTAL_UI' } });
        return setupDocumentResponse(body, d.title);
    });
});

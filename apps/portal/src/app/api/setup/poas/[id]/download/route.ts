import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { readStoredObject } from '@qubere/storage';
import { withPortalAccount, portalScope, notFound } from '@/lib/portal-scope';
import { setupDocumentResponse } from '@/lib/setup-document-response';

// Older executed PoAs predate ClientDocument promotion. Read their stored
// signed artifact directly, without changing ownership or exposing storage URLs.
export const GET = withPortalAccount(async (_ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const s = await portalScope(req, 'portal.setup.read');
    if (s.error) return s.error;
    const { id } = await params;
    const poa = await db.powerOfAttorney.findFirst({
        where: { id, accountId: s.ctx.accountId, status: 'executed', revokedAt: null, importerOfRecord: { accountId: s.ctx.accountId } },
        select: { id: true, executedDocumentUrl: true, envelope: { select: { executedDocumentUrl: true } } },
    });
    const url = poa?.executedDocumentUrl ?? poa?.envelope?.executedDocumentUrl;
    if (!poa || !url) return notFound();
    let body: Buffer;
    try { ({ body } = await readStoredObject(url)); }
    catch { return NextResponse.json({ error: 'CONTENT_UNAVAILABLE' }, { status: 502 }); }
    await db.auditLog.create({ data: { accountId: s.ctx.accountId, userId: s.ctx.userId, action: 'CUSTOMER_SETUP_DOCUMENT_DOWNLOAD', entity: 'PowerOfAttorney', entityId: poa.id, source: 'PORTAL_UI' } });
    return setupDocumentResponse(body, 'Executed Power of Attorney');
});

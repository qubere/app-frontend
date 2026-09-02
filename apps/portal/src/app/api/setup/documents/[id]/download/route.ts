import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { readStoredObject } from '@qubere/storage';
import { portalScope, portalData, notFound } from '@/lib/portal-scope';
export async function GET(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { const s = await portalScope(req, 'portal.setup.read'); if (s.error)
    return s.error; return portalData(s.ctx, async () => { const { id } = await params; const d = await db.clientDocument.findFirst({ where: { id, accountId: s.ctx.accountId, ...(s.clientIds === null ? {} : { clientId: { in: s.clientIds } }), portalVisible: true, status: 'ACTIVE' } }); if (!d)
    return notFound(); let body: Buffer; try {
    ({ body } = await readStoredObject(d.storageUrl));
}
catch {
    return NextResponse.json({ error: 'CONTENT_UNAVAILABLE' }, { status: 502 });
} await db.auditLog.create({ data: { accountId: s.ctx.accountId, userId: s.ctx.userId, action: 'CUSTOMER_SETUP_DOCUMENT_DOWNLOAD', entity: 'ClientDocument', entityId: d.id, clientId: d.clientId, source: 'PORTAL_UI' } }); return new Response(new Uint8Array(body), { headers: { 'Content-Type': body.subarray(0, 1024).includes(Buffer.from('%PDF')) ? 'application/pdf' : 'application/octet-stream', 'Content-Disposition': `attachment; filename="${d.title.replace(/[^a-zA-Z0-9._ -]/g, '_')}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }); }

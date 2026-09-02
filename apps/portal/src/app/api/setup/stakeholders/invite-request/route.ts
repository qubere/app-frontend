import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { z } from 'zod';
import { portalScope, portalData, notFound, noStore } from '@/lib/portal-scope';
const schema = z.object({ clientId: z.string().min(1), name: z.string().trim().min(1).max(150), email: z.string().email(), role: z.enum(['IMPORTER_ADMIN', 'OFFICER_SIGNER', 'BILLING_CONTACT', 'CUSTOMS_CONTACT', 'SUPPLIER_CONTACT', 'VIEWER']) }).strict();
export async function POST(req: Request) {
    const s = await portalScope(req, 'portal.users.manage');
    if (s.error)
        return s.error;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
        return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const { clientId, name, email, role } = parsed.data;
    if (s.clientIds !== null && !s.clientIds.includes(clientId))
        return notFound();
    return portalData(s.ctx, async () => {
        if (!await db.client.findFirst({ where: { id: clientId, accountId: s.ctx.accountId }, select: { id: true } }))
            return notFound();
        const body = `Please provide portal access for ${name} (${email}) as ${role.replaceAll('_', ' ')}.`;
        const r = await db.customerRequest.create({ data: { accountId: s.ctx.accountId, clientId, domain: 'GENERAL', type: 'CONFIRMATION', title: `Portal access request: ${email}`, description: body, createdByUserId: s.ctx.userId, metadata: { name, email, role }, messages: { create: { accountId: s.ctx.accountId, clientId, authorUserId: s.ctx.userId, authorType: 'CUSTOMER', body } } } });
        return NextResponse.json({ id: r.id }, { status: 201, ...noStore });
    });
}

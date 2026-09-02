import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { portalScope, portalData, noStore } from '@/lib/portal-scope';
export async function GET(req: Request) { const s = await portalScope(req, 'portal.setup.read'); if (s.error)
    return s.error; return portalData(s.ctx, async () => NextResponse.json(await db.clientDocument.findMany({ where: { accountId: s.ctx.accountId, ...(s.clientIds === null ? {} : { clientId: { in: s.clientIds } }), status: 'ACTIVE', portalVisible: true }, select: { id: true, clientId: true, kind: true, title: true, effectiveDate: true, expirationDate: true }, orderBy: { createdAt: 'desc' } }), noStore)); }

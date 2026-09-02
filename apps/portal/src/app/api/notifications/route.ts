import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { portalScope, portalData, noStore } from '@/lib/portal-scope';
export async function GET(req: Request) { const s = await portalScope(req, 'portal.access'); if (s.error)
    return s.error; return portalData(s.ctx, async () => NextResponse.json(await db.notification.findMany({ where: { accountId: s.ctx.accountId, userId: s.ctx.userId, entityType: 'PortalUpdate', ...(s.clientIds === null ? {} : { entityId: { in: s.clientIds } }) }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, type: true, message: true, read: true, createdAt: true } }), noStore)); }
export async function PATCH(req: Request) { const s = await portalScope(req, 'portal.access'); if (s.error)
    return s.error; const b = await req.json().catch(() => null); if (typeof b?.id !== 'string')
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); return portalData(s.ctx, async () => { await db.notification.updateMany({ where: { id: b.id, accountId: s.ctx.accountId, userId: s.ctx.userId, entityType: 'PortalUpdate', ...(s.clientIds === null ? {} : { entityId: { in: s.clientIds } }) }, data: { read: true } }); return NextResponse.json({ ok: true }, noStore); }); }

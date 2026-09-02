import { NextResponse } from 'next/server';
import { db } from '@qubere/db';
import { portalScope, portalData, noStore, withPortalAccount } from '@/lib/portal-scope';
export const GET = withPortalAccount(async (_ctx, req: Request) => {
    const scope = await portalScope(req, 'portal.entries.read');
    if (scope.error)
        return scope.error;
    return portalData(scope.ctx, async () => {
        if (!db.entryProof?.findMany) throw { code: 'PORTAL_SCHEMA_OUTDATED' };
        const where = { accountId: scope.ctx.accountId, ...(scope.clientIds === null ? {} : { clientId: { in: scope.clientIds } }) };
        const [proofs, questions] = await Promise.all([
            db.entryProof.findMany({ where: { ...where, status: 'PUBLISHED', filing: { customerVisibleAt: { not: null }, shipment: { ...(scope.clientIds === null ? {} : { clientId: { in: scope.clientIds } }) } } }, orderBy: { publishedAt: 'desc' }, take: 200, select: { filingId: true, shipmentId: true, publishedAt: true, scoreOverall: true, scoreBand: true, dutyAndFeesUsd: true, dutySavingsIdentifiedUsd: true, filing: { select: { entryNumber: true } }, shipment: { select: { shipmentNumber: true } } } }),
            db.customerRequest.groupBy({ by: ['filingId'], where: { ...where, type: 'QUESTION', status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } }, _count: true }),
        ]);
        return NextResponse.json(proofs.map(p => ({ filingId: p.filingId, entryNumber: p.filing.entryNumber, shipmentId: p.shipmentId, shipmentNumber: p.shipment?.shipmentNumber, publishedAt: p.publishedAt, scoreOverall: p.scoreOverall, scoreBand: p.scoreBand, dutyAndFeesUsd: Number(p.dutyAndFeesUsd), dutySavingsIdentifiedUsd: Number(p.dutySavingsIdentifiedUsd), openQuestionCount: questions.find(q => q.filingId === p.filingId)?._count ?? 0 })), noStore);
    });
});

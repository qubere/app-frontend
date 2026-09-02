import { NextResponse } from 'next/server';
import { getEffectiveUserScope, hasRequiredPortalPermission, resolvePortalClientScope } from '@qubere/auth';
import { db } from '@qubere/db';
import { withPortalAccount } from '@/lib/portal-scope';

export const GET = withPortalAccount(async (ctx, req: Request) => {
  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const clients = resolvePortalClientScope(scope, new URL(req.url).searchParams.get('clientId'));
  if (clients.forbidden) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const where = { accountId: ctx.accountId, ...(clients.clientIds === null ? {} : { clientId: { in: clients.clientIds } }) };
  const mayReadCustoms = hasRequiredPortalPermission(ctx, 'portal.entries.read');
  const mayReadSetup = hasRequiredPortalPermission(ctx, 'portal.setup.read');
  const results = await Promise.allSettled([
    (async () => {
      if (!mayReadCustoms) return null;
      if (!db.entryProof?.aggregate) throw new Error('Entry Proof client is outdated. Regenerate Prisma and restart the portal.');
      return db.entryProof.aggregate({ where: { ...where, status: 'PUBLISHED', filing: { customerVisibleAt: { not: null } } }, _count: true, _avg: { scoreOverall: true }, _sum: { linesAtRisk: true, dutySavingsIdentifiedUsd: true } });
    })(),
    (async () => mayReadCustoms ? db.complianceDeadline.findMany({ where: { accountId: ctx.accountId, customerActionable: true, status: 'OPEN', shipment: { ...(clients.clientIds === null ? {} : { clientId: { in: clients.clientIds } }) } }, take: 50, orderBy: { dueAt: 'asc' }, select: { id: true, customerLabel: true, dueAt: true, shipmentId: true } }) : [])(),
    (async () => mayReadSetup ? db.onboardingCase.findMany({ where: { ...where, activatedAt: null, status: { notIn: ['active', 'activated', 'withdrawn'] } }, select: { id: true, currentStep: true }, take: 50 }) : [])(),
  ]);
  const sections = ['Compliance', 'Upcoming deadlines', 'Setup'];
  const unavailableSections = results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return [];
    console.error(`[portal] ${sections[i]} summary unavailable; core action requests are unaffected.`, result.reason);
    return [sections[i]];
  });
  const proof = results[0].status === 'fulfilled' ? results[0].value : null;
  const deadlines = results[1].status === 'fulfilled' ? results[1].value : [];
  const setups = results[2].status === 'fulfilled' ? results[2].value : [];
  return NextResponse.json({
    unavailableSections,
    complianceSummary: proof ? { entriesWithProof: proof._count, avgScore: Math.round(proof._avg.scoreOverall ?? 0), linesAtRiskTotal: proof._sum.linesAtRisk ?? 0, dutySavingsIdentifiedUsd: Number(proof._sum.dutySavingsIdentifiedUsd ?? 0) } : null,
    setupSummary: { incompleteCount: setups.length, stepsRemaining: setups.reduce((n, s) => n + Math.max(1, 7 - s.currentStep), 0) },
    needsFromYou: deadlines.map(d => ({ id: d.id, label: d.customerLabel || 'Your broker needs information', dueAt: d.dueAt, href: `/shipments/${d.shipmentId}` })),
  });
});

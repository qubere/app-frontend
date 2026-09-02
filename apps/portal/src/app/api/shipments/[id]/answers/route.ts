import { NextResponse } from 'next/server';
import { authorizePortalResource, getAccountContext } from '@qubere/auth';
import { db, mapPortalShipmentStatus } from '@qubere/db';
import { assembleShipmentAnswers, type EntryProofPayload } from '@qubere/entry-proof';
import { portalData, notFound, noStore } from '@/lib/portal-scope';
export async function GET(_req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const ctx = await getAccountContext();
    if (!ctx)
        return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    return portalData(ctx, async () => {
        const { id } = await params;
        const resource = await db.shipment.findFirst({ where: { id, accountId: ctx.accountId, deletedAt: null }, select: { accountId: true, clientId: true, importerName: true } });
        if (!resource)
            return notFound();
        const auth = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: resource.accountId, resourceClientId: resource.clientId, importerName: resource.importerName });
        if (!auth.authorized)
            return auth.errorResponse ?? notFound();
        const s = await db.shipment.findUnique({ where: { id }, include: {
                customsFilings: { where: { customerVisibleAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { filingStatus: true } },
                entryProofs: { where: { status: 'PUBLISHED', clientId: auth.effectiveClientId!, filing: { customerVisibleAt: { not: null } } }, select: { payload: true, dutyAndFeesUsd: true } },
                etaObservations: { orderBy: { estimatedAt: 'desc' }, take: 1 },
                trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 20, select: { eventType: true, occurredAt: true, locationName: true } },
                legs: { orderBy: { sequence: 'asc' }, select: { mode: true, status: true, actualDeparture: true, actualArrival: true, originStop: { select: { name: true } }, destinationStop: { select: { name: true } } } },
                trackingIdentifiers: { select: { type: true, value: true } },
                shipmentCharges: { where: { portalVisible: true }, select: { netAmount: true, currency: true, portalVisible: true, status: true } },
                invoiceLines: { where: { invoice: { accountId: ctx.accountId, clientId: auth.effectiveClientId! } }, include: { invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, currency: true } } } },
                customerRequests: { where: { status: { in: ['OPEN', 'CUSTOMER_RESPONDED'] } } },
                complianceDeadlines: { where: { customerActionable: true, status: 'OPEN' } },
                pgaHolds: { select: { agencyCode: true, status: true } }
            } });
        if (!s)
            return notFound();
        const mapped = mapPortalShipmentStatus({ internalStatus: s.status, filingStatus: s.customsFilings[0]?.filingStatus, openCustomerRequestCount: s.customerRequests.filter(r => r.status === 'OPEN').length });
        const eta = s.etaObservations[0];
        const result = assembleShipmentAnswers({ id: s.id, shipmentNumber: s.shipmentNumber, generatedAt: new Date().toISOString(), transportationStatus: mapped.transportationStatus, customsStatus: mapped.customsStatus, promiseState: s.promiseState, healthLabel: s.healthStatus, carrierName: s.carrierName, portOfEntry: s.portOfEntry, estimatedArrival: s.estimatedArrival?.toISOString() ?? null, lastFreeDay: s.lastFreeDay?.toISOString() ?? null, demurrageExposureUsd: s.demurrageExposureUsd === null ? null : Number(s.demurrageExposureUsd), eta: eta ? { current: eta.eta.toISOString(), previous: eta.previousEta?.toISOString() ?? null, changedOn: eta.estimatedAt.toISOString(), reasonCode: eta.reasonCode, confidence: eta.confidence } : null, publishedEntryCount: s.customsFilings.length, proofs: s.entryProofs.map(p => ({ dutyAndFeesUsd: Number(p.dutyAndFeesUsd), complete: !(p.payload as unknown as EntryProofPayload).lines.some(l => l.dutyStack.some(d => ['NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED'].includes(d.status))) })), charges: s.shipmentCharges.map(c => ({ ...c, netAmount: Number(c.netAmount) })), invoices: [...new Map(s.invoiceLines.map(l => [l.invoice.id, { id: l.invoice.id, number: l.invoice.invoiceNumber, status: l.invoice.status, total: Number(l.invoice.totalAmount), currency: l.invoice.currency }])).values()], milestones: [...s.legs.flatMap(l => [...(l.actualDeparture ? [{ label: `${l.mode} departed`, at: l.actualDeparture.toISOString(), location: l.originStop.name }] : []), ...(l.actualArrival ? [{ label: `${l.mode} arrived`, at: l.actualArrival.toISOString(), location: l.destinationStop.name }] : [])]), ...s.trackingEvents.map(e => ({ label: e.eventType.replaceAll('_', ' '), at: e.occurredAt.toISOString(), location: e.locationName }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20), referenceNumbers: s.trackingIdentifiers.map(r => ({ label: r.type, value: r.value })), requests: s.customerRequests.map(r => ({ id: r.id, title: r.title, status: r.status, dueAt: r.dueAt?.toISOString() ?? null })), deadlines: s.complianceDeadlines.map(d => ({ id: d.id, customerActionable: d.customerActionable, customerLabel: d.customerLabel, status: d.status, dueAt: d.dueAt?.toISOString() ?? null })), holds: s.pgaHolds });
        return NextResponse.json(result, noStore);
    });
}

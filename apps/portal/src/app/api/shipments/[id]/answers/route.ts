import { loadPublishedProofCosts } from '@/lib/shipment-proof-costs';
import { shipmentReadPermission } from "@/lib/shipment-access";
import { NextResponse } from 'next/server';
import { authorizePortalResource, hasRequiredPortalPermission } from '@qubere/auth';
import { db, mapPortalShipmentStatus } from '@qubere/db';
import { assembleShipmentAnswers } from '@qubere/entry-proof';
import { portalData, notFound, noStore, withPortalAccount } from '@/lib/portal-scope';
export const GET = withPortalAccount(async (ctx, _req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) => {
    return portalData(ctx, async () => {
        const { id } = await params;
        const resource = await db.shipment.findFirst({ where: { id, accountId: ctx.accountId, deletedAt: null }, select: { accountId: true, clientId: true, importerOfRecordId: true, productWorkspaces: { select: { product: true, status: true } } } });
        if (!resource)
            return notFound();
        const auth = await authorizePortalResource({ permission: shipmentReadPermission(ctx, resource.productWorkspaces || []), resourceAccountId: resource.accountId, resourceClientId: resource.clientId, importerOfRecordId: resource.importerOfRecordId });
        if (!auth.authorized)
            return auth.errorResponse ?? notFound();
        const canReadInvoices = hasRequiredPortalPermission(ctx, 'portal.invoices.read');
        const canReadEntries = hasRequiredPortalPermission(ctx, 'portal.entries.read');
        const [s, proofCosts, invoices] = await Promise.all([
          db.shipment.findUnique({ where: { id, accountId: ctx.accountId, deletedAt: null }, select: {
            id: true, shipmentNumber: true, status: true, promiseState: true, healthStatus: true,
            carrierName: true, portOfEntry: true, estimatedArrival: true, lastFreeDay: true, demurrageExposureUsd: true,
            customsFilings: { where: { customerVisibleAt: { not: null }, ...(!canReadEntries ? { id: { in: [] } } : {}) }, orderBy: { createdAt: 'desc' }, select: { filingStatus: true } },
            etaObservations: { orderBy: { estimatedAt: 'desc' }, take: 1, select: { eta: true, previousEta: true, estimatedAt: true, reasonCode: true, confidence: true } },
            trackingEvents: { where: { corrections: { none: {} } }, orderBy: { occurredAt: 'desc' }, take: 20, select: { eventType: true, occurredAt: true, locationName: true } },
            legs: { orderBy: { sequence: 'asc' }, select: { mode: true, actualDeparture: true, actualArrival: true, originStop: { select: { name: true } }, destinationStop: { select: { name: true } } } },
            trackingIdentifiers: { select: { type: true, value: true } },
            shipmentCharges: { where: { portalVisible: true, status: { not: 'VOIDED' } }, select: { netAmount: true, currency: true, portalVisible: true, status: true } },
            customerRequests: { where: { accountId: ctx.accountId, status: { in: ['OPEN', 'CUSTOMER_RESPONDED'] } }, select: { id: true, title: true, status: true, dueAt: true } },
            complianceDeadlines: { where: { customerActionable: true, status: 'OPEN', ...(!canReadEntries ? { id: { in: [] } } : {}) }, select: { id: true, customerActionable: true, customerLabel: true, status: true, dueAt: true } },
            pgaHolds: { where: { ...(!canReadEntries ? { id: { in: [] } } : {}) }, select: { agencyCode: true, status: true } },
          } }),
          canReadEntries ? loadPublishedProofCosts(ctx, id) : Promise.resolve([]),
          canReadInvoices ? db.invoice.findMany({ where: { accountId: ctx.accountId, lines: { some: { shipmentId: id } }, status: { in: ['SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'] } }, select: { id: true, invoiceNumber: true, status: true, totalAmount: true, currency: true } }) : Promise.resolve([]),
        ]);
        if (!s)
            return notFound();
        const mapped = mapPortalShipmentStatus({ internalStatus: s.status, filingStatus: s.customsFilings[0]?.filingStatus, openCustomerRequestCount: s.customerRequests.filter(r => r.status === 'OPEN').length });
        const eta = s.etaObservations[0];
        const result = assembleShipmentAnswers({ id: s.id, shipmentNumber: s.shipmentNumber, generatedAt: new Date().toISOString(), transportationStatus: mapped.transportationStatus, customsStatus: mapped.customsStatus, promiseState: s.promiseState, healthLabel: s.healthStatus, carrierName: s.carrierName, portOfEntry: s.portOfEntry, estimatedArrival: s.estimatedArrival?.toISOString() ?? null, lastFreeDay: s.lastFreeDay?.toISOString() ?? null, demurrageExposureUsd: s.demurrageExposureUsd === null ? null : Number(s.demurrageExposureUsd), eta: eta ? { current: eta.eta.toISOString(), previous: eta.previousEta?.toISOString() ?? null, changedOn: eta.estimatedAt.toISOString(), reasonCode: eta.reasonCode, confidence: eta.confidence } : null, publishedEntryCount: s.customsFilings.length, proofs: proofCosts.map(p => ({ dutyAndFeesUsd: Number(p.dutyAndFeesUsd), complete: p.complete })), charges: s.shipmentCharges.map(c => ({ ...c, netAmount: Number(c.netAmount) })), invoices: invoices.map(i => ({ id: i.id, number: i.invoiceNumber, status: i.status, total: Number(i.totalAmount), currency: i.currency })), milestones: [...s.legs.flatMap(l => [...(l.actualDeparture ? [{ label: `${l.mode} departed`, at: l.actualDeparture.toISOString(), location: l.originStop.name }] : []), ...(l.actualArrival ? [{ label: `${l.mode} arrived`, at: l.actualArrival.toISOString(), location: l.destinationStop.name }] : [])]), ...s.trackingEvents.map(e => ({ label: e.eventType.replaceAll('_', ' '), at: e.occurredAt.toISOString(), location: e.locationName }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20), referenceNumbers: s.trackingIdentifiers.map(r => ({ label: r.type, value: r.value })), requests: s.customerRequests.map(r => ({ id: r.id, title: r.title, status: r.status, dueAt: r.dueAt?.toISOString() ?? null })), deadlines: s.complianceDeadlines.map(d => ({ id: d.id, customerActionable: d.customerActionable, customerLabel: d.customerLabel, status: d.status, dueAt: d.dueAt?.toISOString() ?? null })), holds: s.pgaHolds });
        return NextResponse.json(result, noStore);
    });
});

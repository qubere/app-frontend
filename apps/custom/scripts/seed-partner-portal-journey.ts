import type { PrismaClient } from '@prisma/client';

/** Called only by the guarded non-production portal seed. Existing routes are preserved. */
export async function seedPartnerPortalJourney(db: PrismaClient, accountId: string, shipmentId: string, target: boolean, now = new Date()) {
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000);
  await db.$transaction(async tx => {
    const shipment = await tx.shipment.findFirstOrThrow({ where: { id: shipmentId, accountId }, select: { currentStage: true, _count: { select: { legs: true, transportLegs: true, trackingStops: true } } } });
    await tx.shipmentProductWorkspace.upsert({ where: { shipmentId_product: { shipmentId, product: 'TMS' } }, update: {}, create: { accountId, shipmentId, product: 'TMS', status: 'ACTIVE', source: 'PORTAL_DEMO' } });
    if (!shipment.currentStage) {
      await tx.shipment.update({ where: { id: shipmentId }, data: { currentStage: 'COMPLIANCE', stageStatus: target ? 'IN_PROGRESS' : 'GATE_PENDING' } });
      for (const [i, stage] of ['DOCUMENT_INTAKE', 'CLASSIFICATION', 'VALUATION', 'ORIGIN'].entries()) {
        await tx.shipmentStageHistory.upsert({ where: { id: `portal-demo-${shipmentId}-stage-${i}` }, update: {}, create: { id: `portal-demo-${shipmentId}-stage-${i}`, accountId, shipmentId, stage, enteredAt: day(-6 + i), exitedAt: day(-5 + i), outcome: 'ADVANCED', advancedBy: 'SYSTEM' } });
      }
    }
    if (shipment._count.legs || shipment._count.transportLegs || shipment._count.trackingStops) return;
    const names = ['Demo Shenzhen factory', 'Yantian terminal', 'Busan New Port', 'Los Angeles terminal', target ? 'Target distribution center' : 'Amazon distribution center'];
    const ports = ['CNSZX', 'CNYTN', 'KRPUS', 'USLAX', 'USRIA'];
    const stops = [];
    for (const [i, name] of names.entries()) {
      stops.push(await tx.shipmentStop.create({ data: { accountId, shipmentId, sequence: i + 1, type: i === 0 ? 'ORIGIN' : i === 4 ? 'DESTINATION' : 'PORT', name, unlocode: ports[i], role: i === 0 ? 'ORIGIN' : i === 4 ? 'DESTINATION' : 'TRANSSHIPMENT' } }));
    }
    const kinds = ['EXPORT_HAULAGE', 'MAIN_CARRIAGE', 'TRANSSHIPMENT', 'IMPORT_HAULAGE'] as const;
    for (const [i, legType] of kinds.entries()) {
      const completed = i < 2, inTransit = i === 2, ocean = i === 1 || i === 2;
      const departure = day(i < 3 ? -4 + i : 3), arrival = day(i < 2 ? -3 + i : i + 1);
      const leg = await tx.shipmentLeg.create({ data: {
        accountId, shipmentId, sequence: i + 1, legType, mode: ocean ? 'OCEAN' : 'TRUCK',
        originStopId: stops[i].id, destinationStopId: stops[i + 1].id, carrierName: ocean ? 'Demo Ocean Carrier' : 'Demo Haulage',
        vesselName: ocean ? 'DEMO PACIFIC' : null, voyageNumber: ocean ? 'DEMO-026' : null,
        billOfLadingNumber: `DEMO-BL-${shipmentId}-${i + 1}`, bookingNumber: `DEMO-BOOK-${i + 1}`,
        plannedDeparture: departure, estimatedDeparture: departure, actualDeparture: completed || inTransit ? departure : null,
        plannedArrival: arrival, estimatedArrival: arrival, actualArrival: completed ? arrival : null,
        status: completed ? 'COMPLETED' : inTransit ? 'IN_TRANSIT' : 'PLANNED', source: 'PORTAL_DEMO',
      } });
      if (completed || inTransit) await tx.trackingEvent.create({ data: {
        accountId, shipmentId, legId: leg.id, eventType: completed ? 'LEG_ARRIVED' : 'LEG_DEPARTED', classifier: 'ACTUAL',
        occurredAt: completed ? arrival : departure, locationName: completed ? stops[i + 1].name : stops[i].name,
        provider: 'DEMO', sourceType: 'SYSTEM', idempotencyKey: `portal-demo-${shipmentId}-leg-${i + 1}`,
      } });
    }
  });
}

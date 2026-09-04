import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedPartnerPortalJourney } from '../scripts/seed-partner-portal-journey';

const tx = {
  shipment: { findFirstOrThrow: vi.fn(), update: vi.fn() },
  shipmentProductWorkspace: { upsert: vi.fn() }, shipmentStageHistory: { upsert: vi.fn() },
  shipmentStop: { create: vi.fn() }, shipmentLeg: { create: vi.fn() }, trackingEvent: { create: vi.fn() },
};
const db = { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as any;
beforeEach(() => {
  vi.resetAllMocks();
  tx.shipment.findFirstOrThrow.mockResolvedValue({ currentStage: null, _count: { legs: 0, transportLegs: 0, trackingStops: 0 } });
  tx.shipmentStop.create.mockImplementation(async ({ data }) => ({ ...data, id: `stop-${data.sequence}` }));
  tx.shipmentLeg.create.mockImplementation(async ({ data }) => ({ ...data, id: `leg-${data.sequence}` }));
});
describe('Portal demo journey seed', () => {
  it('creates four linked legs with real milestone timestamps and a TMS workspace', async () => {
    await seedPartnerPortalJourney(db, 'demo-account', 'target-shipment', true, new Date('2026-09-02T00:00:00Z'));
    expect(tx.shipment.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'target-shipment', accountId: 'demo-account' } }));
    expect(tx.shipmentStop.create).toHaveBeenCalledTimes(5);
    expect(tx.shipmentLeg.create.mock.calls.map(([args]) => args.data.status)).toEqual(['COMPLETED', 'COMPLETED', 'IN_TRANSIT', 'PLANNED']);
    expect(tx.shipmentLeg.create.mock.calls[2][0].data).toMatchObject({ originStopId: 'stop-3', destinationStopId: 'stop-4', actualArrival: null });
    expect(tx.trackingEvent.create).toHaveBeenCalledTimes(3);
    expect(tx.shipmentStageHistory.upsert).toHaveBeenCalledTimes(4);
    expect(tx.shipmentProductWorkspace.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ accountId: 'demo-account', shipmentId: 'target-shipment', product: 'TMS' }) }));
  });
  it.each(['legs', 'transportLegs', 'trackingStops'])('preserves existing %s and workflow progress', async existing => {
    tx.shipment.findFirstOrThrow.mockResolvedValue({ currentStage: 'CLASSIFICATION', _count: { legs: 0, transportLegs: 0, trackingStops: 0, [existing]: 1 } });
    await seedPartnerPortalJourney(db, 'demo-account', 'target-shipment', true);
    expect(tx.shipmentStop.create).not.toHaveBeenCalled();
    expect(tx.shipmentLeg.create).not.toHaveBeenCalled();
    expect(tx.shipment.update).not.toHaveBeenCalled();
    expect(tx.shipmentStageHistory.upsert).not.toHaveBeenCalled();
  });
});

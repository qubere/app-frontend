import { describe, expect, it } from 'vitest';
import { buildShipmentProgress } from '../src/lib/shipment-progress';

const now = new Date('2026-09-02T10:00:00Z');
const source = (extra: object = {}) => ({ currentStage: null, stageStatus: null, estimatedArrival: null, lastFreeDay: null, stageHistory: [], trackingStops: [], legs: [], transportLegs: [], trackingIdentifiers: [], trackingEvents: [], etaObservations: [], ...extra }) as any;

describe('Customer shipment progress', () => {
  it('does not invent completed stages or a route when no history is available', () => {
    const progress = buildShipmentProgress(source());
    expect(progress.workflow.every(s => s.state === 'pending')).toBe(true);
    expect(progress.legs).toEqual([]);
    expect(progress.events).toEqual([]);
  });
  it('shows recorded completed stages and a blocked current stage', () => {
    const progress = buildShipmentProgress(source({ currentStage: 'COMPLIANCE', stageStatus: 'BLOCKED', stageHistory: [{ stage: 'DOCUMENT_INTAKE', exitedAt: now, outcome: 'ADVANCED' }] }));
    expect(progress.workflow[0].state).toBe('complete');
    expect(progress.workflow[4].state).toBe('blocked');
    expect(progress.workflow[5].state).toBe('pending');
  });
  it('a reset stage is active despite an earlier successful history entry', () => {
    const progress = buildShipmentProgress(source({ currentStage: 'CLASSIFICATION', stageStatus: 'IN_PROGRESS', stageHistory: [{ stage: 'CLASSIFICATION', exitedAt: now, outcome: 'ADVANCED' }] }));
    expect(progress.workflow[1].state).toBe('active');
  });
  it('supports existing transport legs and distinguishes planned from actual times', () => {
    const progress = buildShipmentProgress(source({ transportLegs: [{ id: 'legacy', sequence: 1, mode: 'OCEAN', status: 'IN_TRANSIT', originName: 'Yantian', destinationName: 'Los Angeles', plannedArrival: now, actualArrival: null }] }));
    expect(progress.legs[0].origin.name).toBe('Yantian');
    expect(progress.legs[0].plannedArrival).toBe(now.toISOString());
    expect(progress.legs[0].actualArrival).toBeNull();
  });
  it('projects only customer tracking fields and strips internal notes, raw payloads and costs', () => {
    const progress = buildShipmentProgress(source({ stageHistory: [{ stage: 'ORIGIN', exitedAt: now, outcome: 'ADVANCED', note: 'PRIVATE' }], trackingEvents: [{ id: 'e1', eventType: 'VESSEL_DEPARTED', classifier: 'ACTUAL', occurredAt: now, locationName: 'Yantian', provider: 'Carrier', normalizedData: { secret: 'PRIVATE' }, rawPayloadRef: 'PRIVATE' }], legs: [{ id: 'l1', sequence: 1, legType: 'MAIN_CARRIAGE', mode: 'OCEAN', status: 'IN_TRANSIT', originStop: { id: 'a', name: 'Yantian' }, destinationStop: { id: 'b', name: 'Los Angeles' }, actualDeparture: now, statusReason: 'PRIVATE', buyCost: 1234 }] }));
    expect(progress.events[0].classifier).toBe('ACTUAL');
    expect(JSON.stringify(progress)).not.toMatch(/PRIVATE|buyCost|statusReason|rawPayloadRef|normalizedData/);
  });
});

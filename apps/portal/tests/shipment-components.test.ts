import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShipmentTable } from '../src/components/ShipmentList';
import { ShipmentMilestones, ShipmentTracking } from '../src/components/ShipmentProgress';
import { ShipmentFilingData } from '../src/components/ShipmentFilingData';
import { buildShipmentProgress } from '../src/lib/shipment-progress';

const shipment = { id: 'target-shipment', shipmentNumber: 'SHP-TGT-2026-001', origin: 'Yantian', destination: 'Los Angeles', mode: 'Ocean', transportationStatus: 'In transit', customsStatus: 'Documents needed', hasCustomerActionRequired: true, actionRequiredCount: 2 };
const progress = buildShipmentProgress({ currentStage: 'COMPLIANCE', stageStatus: 'IN_PROGRESS', estimatedArrival: null, lastFreeDay: null, stageHistory: [], trackingStops: [], transportLegs: [], trackingIdentifiers: [{ type: 'MBL', value: 'DEMO-MBL-1', issuer: 'Demo carrier' }], trackingEvents: [], etaObservations: [], legs: [{ id: 'leg1', sequence: 1, legType: 'MAIN_CARRIAGE', mode: 'OCEAN', status: 'IN_TRANSIT', originStop: { id: 'origin', name: 'Yantian' }, destinationStop: { id: 'destination', name: 'Los Angeles' } }] } as any);

describe('Customer shipment navigation and panels', () => {
  it.each([false, true])('uses the shipment number as the detail link (freight=%s)', freight => {
    const html = renderToStaticMarkup(createElement(ShipmentTable, { shipments: [shipment], freight }));
    expect(html).toMatch(/<a[^>]+href="\/shipments\/target-shipment"[^>]*>SHP-TGT-2026-001<\/a>/);
    expect(html).not.toMatch(/<th[^>]*>Action<\/th>|View POD/);
    expect(html).toContain('2');
    expect(html).toContain('open');
  });
  it('renders filing stages, the route stepper and tracking references', () => {
    const milestones = renderToStaticMarkup(createElement(ShipmentMilestones, { progress, onTracking() {} }));
    expect(milestones).toContain('Filing progress');
    expect(milestones).toContain('aria-current="step"');
    expect(milestones).toContain('Yantian');
    expect(milestones).toContain('Los Angeles');
    const tracking = renderToStaticMarkup(createElement(ShipmentTracking, { progress }));
    expect(tracking).toContain('DEMO-MBL-1');
    expect(tracking).toContain('Actual arrival');
    expect(tracking).toContain('Not available');
  });
  it('distinguishes unpublished filing data from a fabricated entry', () => {
    const html = renderToStaticMarkup(createElement(ShipmentFilingData, { data: { importerName: 'Target', countryOfOrigin: 'CN', countryOfExport: 'CN', destinationCountry: 'US', portOfEntry: '2704', entryType: '01', incoterm: null, invoiceCurrency: 'USD' }, entries: [] }));
    expect(html).toContain('Your broker has not published filing data');
    expect(html).toContain('2704');
    expect(html).not.toContain('Inspect Entry Proof');
  });
});

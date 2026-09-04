// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 's1' }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));
const { default: ShipmentPage } = await import('../src/app/(portal)/shipments/[id]/page');
let container: HTMLDivElement;
let root: Root;
const fetcher = vi.fn();
const progress = { currentStage: 'COMPLIANCE', workflow: [{ key: 'COMPLIANCE', label: 'Compliance', state: 'active', completedAt: null }], legs: [], stops: [], references: [], events: [], eta: null, previousEta: null, etaUpdatedAt: null, lastFreeDay: null };
const overview = { overview: { id: 's1', shipmentNumber: 'SHP-TARGET-1', importerName: 'Target', origin: 'Yantian', destination: 'Los Angeles', transportMode: 'Ocean', transportationStatus: 'In transit', customsStatus: 'In progress' }, progress, filingData: { importerName: 'Target' }, requests: [{ id: 'r1', title: 'Confirm address', type: 'QUESTION', status: 'OPEN' }], entries: [{ id: 'f1', entryNumber: 'ENTRY-1', status: 'PUBLISHED', publishedAt: '2026-09-01', proof: { available: true, scoreOverall: 90, scoreBand: 'STRONG', linesTotal: 1 } }] };
const answers = { headline: { transportationStatus: 'In transit' }, eta: { current: null }, cost: { costIsPartial: true, dutyAndFeesUsd: null, brokerChargesUsd: null, estimatedTotalUsd: null }, needsFromYou: [], cards: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const calls = () => fetcher.mock.calls.map(([url]) => String(url));
const button = (name: string) => [...container.querySelectorAll('button')].find(el => el.textContent?.includes(name))!;
const click = async (element: HTMLElement) => { expect(element).toBeTruthy(); await act(async () => element.click()); };
const tab = async (name: string) => click(container.querySelector(`#shipment-tab-${name}`)!);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', fetcher);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => {
    if (url.endsWith('/answers')) return json(answers);
    if (url.includes('section=tracking')) return json({ progress: { ...progress, references: [{ type: 'MBL', value: 'TRACK-123', issuer: null }] } });
    if (url.includes('section=documents')) return json({ documents: [{ id: 'd1', fileName: url.endsWith('page=1') ? 'Page two.pdf' : 'Invoice.pdf', docType: 'INVOICE' }], hasMore: !url.endsWith('page=1') });
    if (url.includes('section=invoices')) return json({ invoices: [], hasMore: false });
    if (url.endsWith('/proof')) return json({ lines: [{ lineNumber: 1, description: 'Published widget', htsCode: '1234', quantity: 1, dutyStack: [], enteredValueUsd: 20, lineDutyTotalUsd: 2 }] });
    return json(overview);
  });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('Shipment tabs and loading', () => {
  it('starts overview and answers together, without fetching hidden tabs', async () => {
    let release!: (value: Response) => void;
    fetcher.mockImplementation((url: string) => url.endsWith('/answers') ? Promise.resolve(json(answers)) : new Promise<Response>(resolve => { release = resolve; }));
    await act(async () => root.render(createElement(ShipmentPage)));
    expect(calls().sort()).toEqual(['/api/shipments/s1', '/api/shipments/s1/answers']);
    await act(async () => release(json(overview)));
    const tabs = container.querySelector('[role=tablist]')!;
    const filing = container.querySelector('[aria-label="Filing progress"]')!;
    expect(tabs.compareDocumentPosition(filing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('#shipment-tab-overview')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[role=tabpanel]')?.firstElementChild?.textContent).toContain('Filing progress');
  });
  it('opens and focuses Tracking from the milestone link, then reuses its loaded data', async () => {
    await act(async () => root.render(createElement(ShipmentPage)));
    await click(button('View tracking details'));
    expect(container.querySelector('#shipment-tab-tracking')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[aria-label="Filing progress"]')).toBeNull();
    expect(container.querySelector('[role=tabpanel]')?.textContent).toContain('TRACK-123');
    expect(document.activeElement?.id).toBe('shipment-panel-tracking');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    await tab('overview'); await click(button('View tracking details'));
    expect(calls().filter(url => url.includes('section=tracking'))).toHaveLength(1);
  });
  it('loads documents only on selection and preserves pages when switching back', async () => {
    await act(async () => root.render(createElement(ShipmentPage)));
    expect(calls().some(url => url.includes('section=documents'))).toBe(false);
    await tab('documents'); expect(container.textContent).toContain('Invoice.pdf');
    await click(button('Next')); expect(container.textContent).toContain('Page two.pdf');
    await click(button('Previous')); expect(container.textContent).toContain('Invoice.pdf');
    await tab('invoices'); expect(container.textContent).toContain('No issued invoices');
    await tab('documents');
    expect(calls().filter(url => url.includes('section=documents'))).toHaveLength(2);
  });
  it('fetches published proof lines only when requested from Filing data', async () => {
    await act(async () => root.render(createElement(ShipmentPage)));
    await tab('filing');
    expect(calls().some(url => url.endsWith('/proof'))).toBe(false);
    await click(button('Show published line items'));
    expect(container.textContent).toContain('Published widget');
    expect(calls().filter(url => url.endsWith('/proof'))).toHaveLength(1);
  });
  it('keeps a failed tab distinct from an empty result and supports retry', async () => {
    await act(async () => root.render(createElement(ShipmentPage)));
    fetcher.mockResolvedValueOnce(json({ message: 'Tracking temporarily unavailable' }, 503));
    await tab('tracking');
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Could not load this shipment information');
    await click(button('Try again'));
    expect(container.querySelector('[role=tabpanel]')?.textContent).toContain('TRACK-123');
  });
});

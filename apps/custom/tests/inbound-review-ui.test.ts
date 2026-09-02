// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));
import { InboundReviewTable } from '../src/app/app/documents/InboundReviewTable';
let container: HTMLDivElement, root: Root;
const fetcher = vi.fn();
const rows = [{ id: 'review', reason: 'MATCH_CONFLICT', clientId: 'amazon', client: { name: 'Amazon' }, createdAt: '2026-09-02T10:00:00Z', inboundEmail: { originalFromAddress: 'supplier@example.com', subject: 'Container documents' }, shipmentDocument: { id: 'document1234567890', fileName: 'Invoice.pdf', status: 'Received' }, candidateSummary: ['s1', 's2'].map(shipmentId => ({ shipmentId, score: 0.85, signals: [{ type: 'CONTAINER', value: 'CBHU8842190' }] })) }];
const shipments = ['s1', 's2'].map((id, i) => ({ id, shipmentNumber: `SHP-ACME-2026-00${i + 2}`, importerName: 'Amazon' }));
const json = (body: unknown) => new Response(JSON.stringify(body));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  fetcher.mockReset(); vi.stubGlobal('fetch', fetcher);
  fetcher.mockImplementation(async (url: string, opts?: RequestInit) => opts?.method === 'POST' ? json({}) : url.includes('/review?') ? json({ shipments: [], candidateShipments: shipments, clients: [] }) : json({ items: rows, nextCursor: null }));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('keeps competing shipments visible and requires an explicit attachment decision', async () => {
  await act(async () => root.render(createElement(InboundReviewTable)));
  const row = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Invoice.pdf'))!;
  await act(async () => row.click());
  await act(async () => new Promise(resolve => setTimeout(resolve, 240)));
  expect(container.textContent).toContain('SHP-ACME-2026-002');
  expect(container.textContent).toContain('SHP-ACME-2026-003');
  expect(container.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe('/api/documents/proxy?documentId=document1234567890');
  const attach = [...container.querySelectorAll('button')].find(b => b.textContent === 'Attach document')!;
  expect(attach.disabled).toBe(true);
  expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  const select = container.querySelector('select')!;
  await act(async () => { select.value = 's2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(attach.disabled).toBe(false);
  await act(async () => attach.click());
  expect(fetcher).toHaveBeenCalledWith('/api/broker/inbound-reviews/review/resolve', expect.objectContaining({ method: 'POST', body: JSON.stringify({ shipmentId: 's2' }) }));
});

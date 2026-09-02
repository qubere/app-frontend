import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  ctx: { accountId: 'broker-demo', userId: 'porter', email: 'porter@target.com', dataMode: 'DEMO', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.shipments.read', 'portal.requests.read', 'portal.requests.respond'] } as any,
  scope: { isAllClients: false, authorizedClientIds: ['target'], teamIds: [] },
  db: {
    user: { findUnique: vi.fn() }, client: { findMany: vi.fn() },
    shipment: { findMany: vi.fn(), findUnique: vi.fn() },
    entryProof: { findMany: vi.fn(), aggregate: vi.fn() },
    complianceDeadline: { findMany: vi.fn() }, onboardingCase: { findMany: vi.fn() },
    customerRequest: { groupBy: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    customerRequestMessage: { create: vi.fn() }, auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => m.ctx }));
vi.mock('../../../packages/auth/src/scope-engine', () => ({ getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/auth', async () => ({
  ...await import('../../../packages/auth/src/portal-auth'),
  getAccountContext: async () => m.ctx,
  getEffectiveUserScope: async () => m.scope,
}));
// Retain the real AsyncLocalStorage and Prisma isolation rule builder. No database connection is used.
vi.mock('@qubere/db', async (original) => ({ ...await original<object>(), db: m.db }));
const { getDataModeContext, getAccountIdContext, buildIsolatedQueryArgs } = await import('@qubere/db');
const shipments = await import('../src/app/api/shipments/route');
const detail = await import('../src/app/api/shipments/[id]/route');
const summaries = await import('../src/app/api/dashboard/summary/route');
const dashboard = await import('../src/app/api/dashboard/route');
const requests = await import('../src/app/api/requests/route');
const request = await import('../src/app/api/requests/[id]/route');
const messages = await import('../src/app/api/requests/[id]/messages/route');
const proofs = await import('../src/app/api/proofs/route');
const me = await import('../src/app/api/me/route');
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (path: string) => new Request(`http://portal/api/${path}`);

function checkContext(model: string, operation: string, args: any) {
  expect(getAccountIdContext()).toBe(m.ctx.accountId);
  const { newArgs } = buildIsolatedQueryArgs(model, operation, args, getDataModeContext());
  // Previously these handlers silently queried account.dataMode = PRODUCTION for DEMO users.
  expect(newArgs.where.account.dataMode).toBe(m.ctx.dataMode);
}
const shipment = { id: 's1', accountId: 'broker-demo', clientId: 'target', importerName: 'Target', shipmentNumber: 'SHP-TGT-2026-001', status: 'In Progress', stageHistory: [], legs: [], transportLegs: [], trackingIdentifiers: [], trackingEvents: [], etaObservations: [], trackingStops: [], productWorkspaces: [], customsFilings: [], customerRequests: [], documents: [], invoiceLines: [] };
const action = { id: 'r1', accountId: 'broker-demo', clientId: 'target', shipmentId: 's1', shipment, title: 'Confirm manufacturer address', type: 'QUESTION', domain: 'CUSTOMS', status: 'OPEN', version: 1, createdAt: new Date(), messages: [], documents: [] };

beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); me.invalidateMeCache(); dashboard.invalidateDashboardCache();
  m.ctx = { accountId: 'broker-demo', userId: 'porter', email: 'porter@target.com', dataMode: 'DEMO', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.shipments.read', 'portal.requests.read', 'portal.requests.respond'] };
  m.scope.authorizedClientIds = ['target'];
  m.db.shipment.findMany.mockImplementation(async args => { checkContext('Shipment', 'findMany', args); return [{ ...shipment, customerRequests: [{ id: 'r1' }] }]; });
  m.db.shipment.findUnique.mockImplementation(async args => { checkContext('Shipment', 'findUnique', args); return { ...shipment, customerRequests: [action] }; });
  m.db.customerRequest.findMany.mockImplementation(async args => { checkContext('CustomerRequest', 'findMany', args); return [action]; });
  m.db.customerRequest.findUnique.mockImplementation(async args => { checkContext('CustomerRequest', 'findUnique', args); return action; });
  m.db.entryProof.findMany.mockImplementation(async args => { checkContext('EntryProof', 'findMany', args); return [{ filingId: 'f1', shipmentId: 's1', filing: { entryNumber: 'ENTRY-TGT-24001' }, shipment: { shipmentNumber: shipment.shipmentNumber }, scoreOverall: 80, dutyAndFeesUsd: 500, dutySavingsIdentifiedUsd: 50 }]; });
  m.db.entryProof.aggregate.mockResolvedValue({ _count: 1, _avg: { scoreOverall: 80 }, _sum: { linesAtRisk: 0, dutySavingsIdentifiedUsd: 50 } });
  m.db.complianceDeadline.findMany.mockResolvedValue([]); m.db.onboardingCase.findMany.mockResolvedValue([]);
  m.db.customerRequest.groupBy.mockImplementation(async args => { checkContext('CustomerRequest', 'groupBy', args); return []; });
  m.db.user.findUnique.mockResolvedValue({ id: 'porter', email: 'porter@target.com' });
  m.db.client.findMany.mockImplementation(async args => { checkContext('Client', 'findMany', args); return [{ id: 'target', name: 'Target' }]; });
  m.db.customerRequestMessage.create.mockImplementation(async () => { expect(getDataModeContext()).toBe(m.ctx.dataMode); return { id: 'msg1' }; });
  m.db.customerRequest.update.mockResolvedValue({ status: 'CUSTOMER_RESPONDED', version: 2 });
  m.db.$transaction.mockImplementation(async values => Promise.all(values));
});

afterEach(() => vi.restoreAllMocks());

describe('Portal account data mode', () => {
  it.each(['DEMO', 'SANDBOX', 'PRODUCTION'])('loads Target actions and shipment details in %s mode', async mode => {
    m.ctx.dataMode = mode;
    expect((await (await dashboard.GET(req('dashboard'))).json()).actionItems[0].title).toBe(action.title);
    expect((await (await shipments.GET(req('shipments'))).json()).items[0].actionRequiredCount).toBe(1);
    const response = await detail.GET(req('shipments/s1'), params('s1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.overview.shipmentNumber).toBe(shipment.shipmentNumber);
    expect(body.requests[0].id).toBe('r1');
    expect(m.db.customerRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'broker-demo', clientId: { in: ['target'] } } }));
    expect(getDataModeContext()).toBeUndefined();
    expect(getAccountIdContext()).toBeUndefined();
  });

  it('loads a request and accepts a reply in the same demo context', async () => {
    expect((await (await requests.GET(req('requests'))).json()).items[0].id).toBe('r1');
    expect((await (await request.GET(req('requests/r1'), params('r1'))).json()).request.id).toBe('r1');
    const response = await messages.POST(new Request('http://portal/api/requests/r1/messages', { method: 'POST', body: JSON.stringify({ body: 'Confirmed manufacturer address', version: 1 }) }), params('r1'));
    expect(response.status).toBe(200);
    expect((await response.json()).requestStatus).toBe('CUSTOMER_RESPONDED');
  });

  it('loads the assigned company and separates cached profiles by data mode', async () => {
    expect((await (await me.GET(req('me'))).json()).clients[0].id).toBe('target');
    m.ctx.dataMode = 'SANDBOX';
    await me.GET(req('me'));
    expect(m.db.client.findMany).toHaveBeenCalledTimes(2);
  });

  it('still rejects another client before loading shipment content', async () => {
    m.db.shipment.findUnique.mockResolvedValue({ ...shipment, clientId: 'amazon' });
    expect((await detail.GET(req('shipments/s1'), params('s1'))).status).toBe(404);
    expect(m.db.shipment.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects anonymous detail requests before database access', async () => {
    m.ctx = null;
    expect((await detail.GET(req('shipments/s1'), params('s1'))).status).toBe(401);
    expect(m.db.shipment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized client filter before querying shipments', async () => {
    expect((await shipments.GET(req('shipments?clientId=amazon'))).status).toBe(403);
    expect(m.db.shipment.findMany).not.toHaveBeenCalled();
  });
});

describe('Freight and proof access', () => {
  it('filters Freight to active TMS shipments in the assigned client', async () => {
    m.ctx.permissions = ['portal.orders.read'];
    expect((await shipments.GET(req('shipments?workspace=TMS'))).status).toBe(200);
    expect(m.db.shipment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'broker-demo', clientId: { in: ['target'] }, productWorkspaces: { some: { product: 'TMS', status: 'ACTIVE' } } }) }));
    m.db.shipment.findUnique.mockResolvedValue({ ...shipment, productWorkspaces: [{ product: 'TMS', status: 'ACTIVE' }] });
    const body = await (await detail.GET(req('shipments/s1'), params('s1'))).json();
    expect(body.overview.shipmentNumber).toBe(shipment.shipmentNumber);
    expect(body.filingData).toBeNull();
    expect(body.progress.workflow).toEqual([]);
    expect(m.db.shipment.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ include: expect.objectContaining({ customsFilings: expect.objectContaining({ where: { customerVisibleAt: { not: null }, id: { in: [] } } }) }) }));
  });
  it('does not widen a freight-only login to customs-only shipments', async () => {
    m.ctx.permissions = ['portal.orders.read'];
    expect((await detail.GET(req('shipments/s1'), params('s1'))).status).toBe(404);
    expect(m.db.shipment.findUnique).toHaveBeenCalledTimes(1);
  });
  it('loads published proofs in the correct mode and client scope', async () => {
    m.ctx.permissions.push('portal.entries.read');
    const response = await proofs.GET(req('proofs'));
    expect(response.status).toBe(200);
    expect((await response.json())[0].entryNumber).toBe('ENTRY-TGT-24001');
    expect(m.db.entryProof.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'broker-demo', clientId: { in: ['target'] }, status: 'PUBLISHED' }) }));
    expect(m.db.customerRequest.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } }) }));
  });
  it.each(['P2021', 'P2022', 'PORTAL_SCHEMA_OUTDATED'])('reports an incomplete database update (%s) without exposing database details', async code => {
    m.ctx.permissions.push('portal.entries.read');
    m.db.entryProof.findMany.mockRejectedValue({ code, message: 'PRIVATE table definition' });
    const response = await proofs.GET(req('proofs'));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('PORTAL_SCHEMA_OUTDATED');
    expect(JSON.stringify(body)).not.toContain('PRIVATE');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('keeps a real empty proof list distinct from a failed request', async () => {
    m.ctx.permissions.push('portal.entries.read');
    m.db.entryProof.findMany.mockResolvedValue([]);
    const response = await proofs.GET(req('proofs'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe('Actions survive optional summary failures', () => {
  it('returns existing Target actions when the generated client has no EntryProof model', async () => {
    m.ctx.permissions.push('portal.entries.read', 'portal.setup.read');
    const delegate = m.db.entryProof;
    (m.db as any).entryProof = undefined;
    try {
      const response = await dashboard.GET(req('dashboard'));
      expect(response.status).toBe(200);
      expect((await response.json()).actionItems[0].id).toBe('r1');
      const shipmentResponse = await detail.GET(req('shipments/s1'), params('s1'));
      expect(shipmentResponse.status).toBe(200);
      const shipmentBody = await shipmentResponse.json();
      expect(shipmentBody.requests[0].id).toBe('r1');
      expect(shipmentBody.unavailableSections).toEqual(['Entry Proof']);
      const summary = await summaries.GET(req('dashboard/summary'));
      expect(summary.status).toBe(200);
      expect((await summary.json()).unavailableSections).toEqual(['Compliance']);
    } finally { m.db.entryProof = delegate; }
  });
  it('an unavailable optional table cannot hide existing actions or successful summaries', async () => {
    m.ctx.permissions.push('portal.entries.read', 'portal.setup.read');
    m.db.onboardingCase.findMany.mockRejectedValue({ code: 'P2021' });
    const response = await dashboard.GET(req('dashboard'));
    expect((await response.json()).actionItems).toHaveLength(1);
    expect(m.db.entryProof.aggregate).not.toHaveBeenCalled();
    const summary = await (await summaries.GET(req('dashboard/summary'))).json();
    expect(summary.unavailableSections).toEqual(['Setup']);
    expect(summary.complianceSummary.entriesWithProof).toBe(1);
  });
  it('keeps published filing metadata and tracking when the proof table is missing', async () => {
    m.ctx.permissions.push('portal.entries.read');
    m.db.shipment.findUnique.mockResolvedValue({ ...shipment, customsFilings: [{ id: 'f1', entryNumber: 'ENTRY-TGT-24001' }] });
    m.db.entryProof.findMany.mockRejectedValue({ code: 'P2021' });
    const response = await detail.GET(req('shipments/s1'), params('s1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries[0].entryNumber).toBe('ENTRY-TGT-24001');
    expect(body.unavailableSections).toEqual(['Entry Proof']);
    expect(body.progress.legs).toEqual([]);
  });
  it('still reports a failed core action query as an error, never as an empty success', async () => {
    m.db.customerRequest.findMany.mockRejectedValue(new Error('Database unavailable'));
    const response = await dashboard.GET(req('dashboard'));
    expect(response.status).toBe(500);
    expect((await response.json()).actionItems).toBeUndefined();
  });
});

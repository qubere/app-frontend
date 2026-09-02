import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  ctx: { accountId: 'target-workspace', userId: 'porter', dataMode: 'DEMO', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'] },
  scope: { isAllClients: false, authorizedClientIds: ['target'], teamIds: [] }, read: vi.fn(),
  db: { importerOfRecord: { findMany: vi.fn(), findFirst: vi.fn() }, shipment: { findMany: vi.fn(), findUnique: vi.fn() }, shipmentDocument: { findMany: vi.fn(), findUnique: vi.fn() }, clientDocument: { findMany: vi.fn() }, auditLog: { findMany: vi.fn(), create: vi.fn() } },
}));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => m.ctx }));
vi.mock('../../../packages/auth/src/scope-engine', () => ({ getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/auth', async () => ({ ...await import('../../../packages/auth/src/portal-auth'), getAccountContext: async () => m.ctx, getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/db', () => ({ db: m.db, mapPortalShipmentStatus: () => ({}), withAccountIdContext: (_: unknown, fn: Function) => fn(), withDataModeContext: (_: unknown, fn: Function) => fn(), isDataMode: () => true }));
vi.mock('@qubere/db/services/shared-upload-service', () => ({ processSharedDocumentUpload: vi.fn() }));
vi.mock('@qubere/storage', () => ({ readStoredObject: m.read }));
const shipments = await import('../src/app/api/shipments/route');
const documents = await import('../src/app/api/documents/route');
const download = await import('../src/app/api/documents/[id]/download/route');
const { importerClientId, shipmentClientId } = await import('../src/lib/client-ownership');
const request = (path: string) => new Request(`http://portal/api/${path}`);
const date = new Date('2026-09-02T10:00:00Z');
const importer = (id: string, clientId: string | null = 'target') => ({ id, accountId: 'target-workspace', clientId, onboardingEntities: [] });
beforeEach(() => {
  vi.resetAllMocks(); m.ctx.accountId = 'target-workspace'; m.ctx.permissions = ['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'];
  m.scope.authorizedClientIds = ['target'];
  m.db.importerOfRecord.findMany.mockResolvedValue([importer('ior-one'), importer('ior-two')]);
  m.db.importerOfRecord.findFirst.mockResolvedValue(importer('ior-one'));
  m.db.shipment.findMany.mockResolvedValue(['SHP-2026-000002', 'SHP-2026-000001'].map((shipmentNumber, i) => ({ id: `s${i}`, shipmentNumber, trackingStops: [], customsFilings: [], customerRequests: [] })));
  m.db.shipmentDocument.findMany.mockResolvedValue([{ id: 'doc', fileName: 'Invoice.pdf', docType: 'Commercial Invoice', source: 'UPLOAD', status: 'Received', createdAt: date, shipmentId: 's1', shipment: { id: 's1', shipmentNumber: 'SHP-2026-000001' }, assignedToUserId: 'someone-else' }]);
  m.db.clientDocument.findMany.mockResolvedValue([{ id: 'poa-doc', title: 'Executed PoA', kind: 'EXECUTED_POA', contentType: 'application/pdf', sourceModel: 'PowerOfAttorney', sourceId: 'poa', createdAt: date }]);
  m.db.auditLog.findMany.mockResolvedValue([{ entity: 'ShipmentDocument', entityId: 'doc', actorUser: { firstName: 'Broker', lastName: 'Uploader', email: 'broker@example.com' } }]);
  m.db.shipmentDocument.findUnique.mockResolvedValue({ id: 'doc', accountId: 'target-workspace', clientId: null, portalVisibility: 'CUSTOMER', fileUrl: 'stored://invoice', fileName: 'Invoice.pdf', shipment: { accountId: 'target-workspace', clientId: null, importerOfRecordId: 'ior-one', deletedAt: null } });
  m.read.mockResolvedValue({ body: Buffer.from('%PDF-1.7 test') });
});
describe('Workspace ownership across importers', () => {
  it('includes both workspace shipments even without client or importer links', async () => {
    const body = await (await shipments.GET(request('shipments'))).json();
    expect(body.items.map((s: any) => s.shipmentNumber)).toEqual(['SHP-2026-000002', 'SHP-2026-000001']);
    expect(m.db.shipment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'target-workspace', deletedAt: null } }));
    expect(m.db.shipment.findMany.mock.calls[0][0].select.extractedJson).toBeUndefined();
  });
  it('resolves legacy importer ownership only from an unambiguous case link', async () => {
    const legacy = { ...importer('legacy', null), onboardingEntities: [{ case: { accountId: 'target-workspace', clientId: 'target' } }] };
    expect(importerClientId(legacy, 'target-workspace')).toBe('target');
    legacy.onboardingEntities.push({ case: { accountId: 'target-workspace', clientId: 'amazon' } });
    expect(importerClientId(legacy, 'target-workspace')).toBeNull();
  });
  it('never replaces an explicit different client with an importer link', async () => {
    expect(await shipmentClientId('target-workspace', { clientId: 'amazon', importerOfRecordId: 'ior-one' })).toBe('amazon');
    expect(m.db.importerOfRecord.findFirst).not.toHaveBeenCalled();
  });
  it('does not load importer ownership for default workspace lists', async () => {
    m.db.importerOfRecord.findMany.mockResolvedValue([importer('other', 'amazon'), importer('unlinked', null)]);
    await shipments.GET(request('shipments'));
    expect(m.db.importerOfRecord.findMany).not.toHaveBeenCalled();
    expect(m.db.shipment.findMany.mock.calls[0][0].where).toEqual({ accountId: 'target-workspace', deletedAt: null });
  });
  it('keeps optional client filtering inside the current workspace', async () => {
    expect((await shipments.GET(request('shipments?clientId=amazon'))).status).toBe(200);
    expect(m.db.shipment.findMany.mock.calls[0][0].where.accountId).toBe('target-workspace');
    expect(m.db.shipment.findMany.mock.calls[0][0].where.OR[0]).toEqual({ clientId: { in: ['amazon'] } });
  });
});
describe('Shared documents and upload attribution', () => {
  it('lists shipment and setup documents with real upload attribution', async () => {
    const response = await documents.GET(request('documents'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ fileName: 'Invoice.pdf', uploadedBy: 'Broker Uploader', downloadUrl: '/api/documents/doc/download' });
    expect(body.items[1]).toMatchObject({ fileName: 'Executed PoA', uploadedBy: null, downloadUrl: '/api/setup/documents/poa-doc/download', canDelete: false });
    const query = m.db.shipmentDocument.findMany.mock.calls[0][0];
    expect(query.where.portalVisibility).toBeUndefined();
    expect(query.where.AND[0].accountId).toBe('target-workspace');
    expect(JSON.stringify(query.where)).not.toContain('clientId');
    expect(query.select.extractedJson).toBeUndefined();
    expect(query.select.fileUrl).toBeUndefined();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('uses the original inbound sender rather than an assignee', async () => {
    const record = (await m.db.shipmentDocument.findMany())[0];
    m.db.shipmentDocument.findMany.mockResolvedValue([{ ...record, inboundAttachment: { inboundEmail: { accountId: 'target-workspace', normalizedFromAddress: 'supplier@example.com' } } }]);
    const body = await (await documents.GET(request('documents'))).json();
    expect(body.items[0].uploadedBy).toBe('supplier@example.com');
  });
  it('paginates across document sources when timestamps tie', async () => {
    const first = await (await documents.GET(request('documents?limit=1'))).json();
    expect(first.items[0].key).toBe('S:doc');
    expect(first.nextCursor).toBeTruthy();
    await documents.GET(request(`documents?limit=1&cursor=${first.nextCursor}`));
    const query = m.db.clientDocument.findMany.mock.calls.at(-1)![0];
    expect(query.where.OR).toContainEqual({ createdAt: date });
    expect(m.db.shipmentDocument.findMany.mock.calls.at(-1)![0].where.AND[1].OR).toContainEqual({ createdAt: date, id: { lt: 'doc' } });
  });
  it('uses the current workspace on every read rather than a user-only cache', async () => {
    await documents.GET(request('documents'));
    m.ctx.accountId = 'amazon-workspace';
    await documents.GET(request('documents'));
    expect(m.db.importerOfRecord.findMany).not.toHaveBeenCalled();
    expect(m.db.clientDocument.findMany.mock.calls.at(-1)![0].where.accountId).toBe('amazon-workspace');
  });
  it('requires document permission and rejects malformed cursors', async () => {
    expect((await documents.GET(request('documents?cursor=bad'))).status).toBe(400);
    m.ctx.permissions = [];
    expect((await documents.GET(request('documents'))).status).toBe(404);
    expect(m.db.shipmentDocument.findMany).not.toHaveBeenCalled();
  });
  it('downloads a shared document through its shipment/importer link', async () => {
    const response = await download.GET(request('documents/doc/download'), { params: Promise.resolve({ id: 'doc' }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('%PDF');
  });
  it('allows legacy INTERNAL documents but denies other workspaces before storage access', async () => {
    const record = await m.db.shipmentDocument.findUnique();
    m.db.shipmentDocument.findUnique.mockResolvedValue({ ...record, portalVisibility: 'INTERNAL' });
    expect((await download.GET(request('documents/doc/download'), { params: Promise.resolve({ id: 'doc' }) })).status).toBe(200);
    m.read.mockClear();
    m.db.shipmentDocument.findUnique.mockResolvedValue({ ...record, accountId: 'amazon-workspace' });
    expect((await download.GET(request('documents/doc/download'), { params: Promise.resolve({ id: 'doc' }) })).status).toBe(404);
    expect(m.read).not.toHaveBeenCalled();
  });
});

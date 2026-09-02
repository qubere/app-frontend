import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  store: vi.fn(), audit: vi.fn(), options: {} as any,
  db: { importerOfRecord: { findFirst: vi.fn() }, powerOfAttorney: { create: vi.fn() }, clientDocument: { upsert: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db: m.db }));
vi.mock('@/lib/storage', () => ({ storeDocumentFile: m.store }));
vi.mock('@/lib/audit', () => ({ createAuditLog: m.audit }));
vi.mock('@/lib/api/auth-guards', () => ({ withAuthenticatedRoute: (handler: Function, options: any) => {
  m.options = options;
  return (req: Request) => handler({ req, ctx: { accountId: 'broker', userId: 'staff' }, params: { id: 'target-ior' }, requestId: 'test' });
} }));
const { POST } = await import('../src/app/api/importers-of-record/[id]/poa/route');
const upload = (type = 'application/pdf') => {
  const form = new FormData();
  form.append('file', new File(['%PDF-1.7 signed customer document'], 'Target-signed-poa.pdf', { type }));
  return new Request('http://custom/api/importers-of-record/target-ior/poa', { method: 'POST', body: form });
};
beforeEach(() => {
  vi.clearAllMocks();
  m.db.importerOfRecord.findFirst.mockResolvedValue({ id: 'target-ior', name: 'Target', clientId: 'target', client: { accountId: 'broker' } });
  m.db.powerOfAttorney.create.mockImplementation(async ({ data }) => ({ id: 'poa-new', ...data, signedDate: new Date('2026-09-02') }));
  m.db.clientDocument.upsert.mockResolvedValue({ id: 'portal-document' });
  m.db.$transaction.mockImplementation(async (fn: Function) => fn(m.db));
  m.store.mockResolvedValue({ url: 'stored://poa/target-signed.pdf' });
});
describe('Broker signed-POA upload to client portal', () => {
  it('stores multipart bytes and publishes the executed document to the linked client in the same transaction', async () => {
    const response = await POST(upload());
    expect(response.status).toBe(201);
    expect((await response.json()).portalVisible).toBe(true);
    expect(m.options).toEqual({ permission: 'parties.manage', write: true });
    expect(m.store).toHaveBeenCalledWith(expect.objectContaining({ name: 'Target-signed-poa.pdf' }), 'Target-signed-poa.pdf', 'poa/broker');
    expect(m.db.powerOfAttorney.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'broker', importerOfRecordId: 'target-ior', status: 'executed', documentUrl: 'stored://poa/target-signed.pdf', executedDocumentUrl: 'stored://poa/target-signed.pdf' }) });
    expect(m.db.clientDocument.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ accountId: 'broker', clientId: 'target', kind: 'EXECUTED_POA', sourceId: 'poa-new', storageUrl: 'stored://poa/target-signed.pdf' }) }));
    expect(m.db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('never stores an upload for a different account importer', async () => {
    m.db.importerOfRecord.findFirst.mockResolvedValue(null);
    expect((await POST(upload())).status).toBe(404);
    expect(m.db.importerOfRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'target-ior', accountId: 'broker' } }));
    expect(m.store).not.toHaveBeenCalled();
  });
  it('refuses a cross-account client link before storing a file', async () => {
    m.db.importerOfRecord.findFirst.mockResolvedValue({ id: 'target-ior', name: 'Target', clientId: 'other', client: { accountId: 'other-broker' } });
    expect((await POST(upload())).status).toBe(404);
    expect(m.store).not.toHaveBeenCalled();
  });
  it('does not fabricate an executed document from JSON metadata or an invalid file', async () => {
    expect((await POST(new Request('http://custom/poa', { method: 'POST', body: JSON.stringify({ documentUrl: '/documents/placeholder.pdf' }), headers: { 'Content-Type': 'application/json' } }))).status).toBe(400);
    expect((await POST(upload('text/plain'))).status).toBe(400);
    expect(m.store).not.toHaveBeenCalled();
    expect(m.db.powerOfAttorney.create).not.toHaveBeenCalled();
  });
  it('does not claim portal publication when the importer has no client link', async () => {
    m.db.importerOfRecord.findFirst.mockResolvedValue({ id: 'target-ior', name: 'Target', clientId: null, client: null });
    const response = await POST(upload());
    expect(response.status).toBe(201);
    expect((await response.json()).portalVisible).toBe(false);
    expect(m.db.clientDocument.upsert).not.toHaveBeenCalled();
  });
  it('does not claim success if storage or portal publication fails', async () => {
    m.store.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(POST(upload())).rejects.toThrow('Storage unavailable');
    expect(m.db.powerOfAttorney.create).not.toHaveBeenCalled();
    m.db.clientDocument.upsert.mockRejectedValueOnce(new Error('Portal publication failed'));
    await expect(POST(upload())).rejects.toThrow('Portal publication failed');
    expect(m.audit).not.toHaveBeenCalled();
  });
});

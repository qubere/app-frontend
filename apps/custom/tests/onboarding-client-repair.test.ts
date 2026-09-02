import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  sourceInUse: false, targetExists: true, options: {} as any, current: null as any, importers: [] as any[],
  tx: {
    client: { findFirst: vi.fn() }, onboardingCase: { findFirst: vi.fn(), update: vi.fn() },
    importerOfRecord: { findMany: vi.fn(), updateMany: vi.fn() }, legalEntity: { findFirst: vi.fn(), updateMany: vi.fn() },
    clientDocument: { upsert: vi.fn(), updateMany: vi.fn() }, clientStakeholder: { findUnique: vi.fn(), upsert: vi.fn() },
    onboardingEvent: { create: vi.fn() },
  }, transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { $transaction: m.transaction } }));
// The real publication service must use the transaction passed by the repair.
vi.mock('../../../packages/db/src/index', () => ({ db: new Proxy({}, { get: () => { throw new Error('Publication escaped its transaction'); } }) }));
vi.mock('@/lib/api/auth-guards', () => ({ withAuthenticatedRoute: (handler: (...a: any[]) => any, options: any) => {
  m.options = options;
  return (req: Request) => handler({ req, ctx: { accountId: 'broker', userId: 'staff' }, params: { caseId: 'case' }, requestId: 'test' });
} }));
const { POST } = await import('../src/app/api/onboarding/cases/[caseId]/client/route');
const save = () => POST(new Request('http://custom/api/onboarding/cases/case/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: 'target' }) }));
const poa = { id: 'poa', status: 'executed', signerName: 'Target signer', signerEmail: 'signer@target.example', signedDate: new Date(), executedDocumentUrl: 'stored://signed-poa', envelope: null };
beforeEach(() => {
  vi.clearAllMocks(); m.sourceInUse = false; m.targetExists = true;
  m.current = { id: 'case', accountId: 'broker', clientId: 'duplicate', status: 'in_progress', primaryImporterId: 'ior', stepStatus: { step_6: 'done', waiver_billing: { reason: 'old client' }, '5106_filed': false }, entities: [{ id: 'entity', importerOfRecordId: 'ior', legalEntityId: 'legal', poaId: 'poa', bondId: 'bond', poa, officers: [], bond: null }], fiveOhSixRecords: [] };
  m.importers = [{ id: 'ior', clientId: null, powersOfAttorney: [poa], _count: { shipments: 0, customsFilings: 0, invoices: 0, customsCases: 0 }, onboardingEntities: [] }];
  m.tx.onboardingCase.findFirst.mockImplementation(async () => m.current);
  m.tx.client.findFirst.mockImplementation(async ({ where, include }) => {
    if (include) return { id: 'target', invitations: [], userAssignments: [], importersOfRecord: m.importers, onboardingCases: [m.current] };
    return where.id === 'duplicate' ? (m.sourceInUse ? { id: 'duplicate' } : null) : (m.targetExists ? { id: 'target', name: 'Target Corporation' } : null);
  });
  m.tx.importerOfRecord.findMany.mockImplementation(async () => m.importers);
  m.tx.legalEntity.findFirst.mockResolvedValue(null);
  m.tx.clientDocument.upsert.mockResolvedValue({ id: 'doc' });
  m.tx.clientStakeholder.findUnique.mockResolvedValue(null);
  m.transaction.mockImplementation((fn: (tx: any) => any) => fn(m.tx));
});
describe('Repair an explicit onboarding client link', () => {
  it('reuses saved PoA bytes, binds the importer and publishes inside the same transaction', async () => {
    const response = await save();
    expect(response.status).toBe(200);
    expect(m.options).toEqual({ permission: 'onboarding.manage', write: true });
    expect(m.tx.importerOfRecord.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['ior'] }, accountId: 'broker' }, data: { clientId: 'target' } });
    expect(m.tx.onboardingCase.update).toHaveBeenCalledWith({ where: { id: 'case', accountId: 'broker' }, data: { clientId: 'target', stepStatus: { '5106_filed': false } } });
    expect(m.tx.clientDocument.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ clientId: 'target', accountId: 'broker', sourceId: 'poa', storageUrl: 'stored://signed-poa' }) }));
    expect(m.tx.clientStakeholder.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ clientId: 'target', email: 'signer@target.example', isSigner: true }) }));
    expect(m.tx.onboardingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'CLIENT_LINKED', actorUserId: 'staff', detail: { previousClientId: 'duplicate', clientId: 'target' } }) });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable', timeout: 30000 });
  });
  it('moves only published documents belonging to this case, preserving visibility and revocation', async () => {
    await save();
    const args = m.tx.clientDocument.updateMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ accountId: 'broker', clientId: 'duplicate' });
    expect(args.where.OR).toContainEqual({ sourceModel: 'Bond', sourceId: { in: ['bond'] } });
    expect(args.data).toEqual({ clientId: 'target' });
  });
  it('can republish the same client without moving access or resetting billing', async () => {
    m.current.clientId = 'target'; m.current.status = 'active';
    expect((await save()).status).toBe(200);
    expect(m.tx.clientDocument.updateMany).not.toHaveBeenCalled();
    expect(m.tx.onboardingCase.update.mock.calls[0][0].data).toEqual({ clientId: 'target' });
  });
  it('denies another account’s client before writes', async () => {
    m.targetExists = false;
    expect((await save()).status).toBe(404);
    expect(m.tx.client.findFirst).toHaveBeenCalledWith({ where: { id: 'target', accountId: 'broker' }, select: { id: true, name: true } });
    expect(m.tx.onboardingCase.update).not.toHaveBeenCalled();
  });
  it('denies a missing or cross-account case', async () => {
    m.current = null;
    expect((await save()).status).toBe(404);
    expect(m.tx.onboardingCase.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'case', accountId: 'broker' } }));
    expect(m.tx.onboardingCase.update).not.toHaveBeenCalled();
  });
  it('refuses to move a case with active portal access or operational history', async () => {
    m.sourceInUse = true;
    expect((await save()).status).toBe(409);
    expect(m.tx.importerOfRecord.updateMany).not.toHaveBeenCalled();
  });
  it.each(['active', 'withdrawn'])('refuses to move a %s case', async status => {
    m.current.status = status;
    expect((await save()).status).toBe(409);
    expect(m.tx.onboardingCase.update).not.toHaveBeenCalled();
  });
  it('refuses to move an importer already used by another client or operations', async () => {
    m.importers[0].clientId = 'other-client';
    expect((await save()).status).toBe(409);
    m.importers[0].clientId = null; m.importers[0]._count.shipments = 1;
    expect((await save()).status).toBe(409);
    expect(m.tx.onboardingCase.update).not.toHaveBeenCalled();
  });
  it('fails the transaction when publication fails and never reports success', async () => {
    m.tx.clientDocument.upsert.mockRejectedValueOnce(new Error('Database unavailable'));
    expect((await save()).status).toBe(500);
    expect(m.tx.onboardingEvent.create).not.toHaveBeenCalled();
  });
});

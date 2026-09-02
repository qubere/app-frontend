import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  sync: vi.fn(), audit: vi.fn(), options: [] as any[],
  db: {
    client: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    onboardingCase: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    importerOfRecord: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    legalEntity: { create: vi.fn() }, onboardingEntity: { create: vi.fn(), count: vi.fn() },
    onboardingEvent: { create: vi.fn() }, powerOfAttorney: { findFirst: vi.fn() }, $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/db', () => ({ db: m.db }));
vi.mock('@/lib/audit', () => ({ createAuditLog: m.audit }));
vi.mock('@qubere/db/services/client-setup-service', () => ({ syncClientSetup: m.sync }));
vi.mock('@/lib/api/auth-guards', () => ({ withAuthenticatedRoute: (handler: (...a: any[]) => any, options: any) => {
  m.options.push(options);
  return (req: Request) => handler({ req, ctx: { accountId: 'broker', userId: 'staff' }, params: { caseId: 'case' }, requestId: 'test' });
} }));
const { CaseService } = await import('../src/modules/onboarding/case.service');
const entity = await import('../src/app/api/onboarding/cases/[caseId]/entities/route');
const clients = await import('../src/app/api/onboarding/clients/route');
const { promoteSetupForPoa, promoteSetupForBond } = await import('../src/lib/portal/clientSetup');
beforeEach(() => {
  vi.clearAllMocks();
  m.db.client.findFirst.mockResolvedValue({ id: 'target' });
  m.db.client.findMany.mockResolvedValue([{ id: 'target', name: 'Target Corporation' }]);
  m.db.client.create.mockResolvedValue({ id: 'new-client' });
  m.db.onboardingCase.create.mockImplementation(async ({ data }) => ({ id: 'case', ...data }));
  m.db.onboardingCase.findUnique.mockResolvedValue({ accountId: 'broker', clientId: 'target', status: 'in_progress' });
  m.db.onboardingCase.findMany.mockResolvedValue([{ clientId: 'target' }]);
  m.db.importerOfRecord.findFirst.mockResolvedValue(null);
  m.db.importerOfRecord.findMany.mockResolvedValue([]);
  m.db.importerOfRecord.create.mockResolvedValue({ id: 'ior' });
  m.db.legalEntity.create.mockResolvedValue({ id: 'legal' });
  m.db.onboardingEntity.create.mockResolvedValue({ id: 'entity' });
  m.db.onboardingEntity.count.mockResolvedValue(1);
  m.db.powerOfAttorney.findFirst.mockResolvedValue({ importerOfRecord: { clientId: null } });
  m.db.$transaction.mockImplementation((fn: (tx: any) => any) => fn(m.db));
});
describe('Onboarding client ownership', () => {
  it('uses the explicitly chosen existing client without creating a duplicate', async () => {
    const created = await CaseService.createCase('broker', 'staff', { path: 'STANDARD', clientId: 'target' });
    expect(created.clientId).toBe('target');
    expect(m.db.client.findFirst).toHaveBeenCalledWith({ where: { id: 'target', accountId: 'broker' }, select: { id: true } });
    expect(m.db.client.create).not.toHaveBeenCalled();
  });
  it('rejects missing, ambiguous and inaccessible client choices before writes', async () => {
    await expect(CaseService.createCase('broker', 'staff', { path: 'STANDARD' })).rejects.toThrow('Choose');
    await expect(CaseService.createCase('broker', 'staff', { path: 'STANDARD', clientId: 'target', newClient: { name: 'target' } })).rejects.toThrow('Choose');
    m.db.client.findFirst.mockResolvedValue(null);
    await expect(CaseService.createCase('broker', 'staff', { path: 'STANDARD', clientId: 'other-account' })).rejects.toThrow('Client not found');
    expect(m.db.onboardingCase.create).not.toHaveBeenCalled();
    expect(m.db.client.create).not.toHaveBeenCalled();
  });
  it('still creates a new client when explicitly requested', async () => {
    expect((await CaseService.createCase('broker', 'staff', { path: 'STANDARD', newClient: { name: 'New customer' } })).clientId).toBe('new-client');
  });
  it('links an onboarding importer to the case client at creation', async () => {
    const response = await entity.POST(new Request('http://custom/api/onboarding/cases/case/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importerNumberType: 'EIN', importerNumber: '123', legalName: 'Target', entityType: 'CORPORATION', addressLine1: 'One St', city: 'City', postalCode: '12345' }) }));
    expect(response.status).toBe(201);
    expect(m.db.importerOfRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'broker', clientId: 'target' }) });
  });
  it('limits client picker results to this account and 50 small records', async () => {
    expect((await clients.GET(new Request('http://custom/api/onboarding/clients?q=Target'))).status).toBe(200);
    expect(m.db.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'broker', name: { contains: 'Target', mode: 'insensitive' } }, take: 50, select: { id: true, name: true, contactEmail: true } }));
  });
  it('publishes signed PoAs through the case link when a legacy importer has no client', async () => {
    await promoteSetupForPoa('broker', 'poa');
    expect(m.sync).toHaveBeenCalledWith('broker', 'target');
    expect(m.db.onboardingCase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'broker', clientId: { not: null }, entities: { some: { accountId: 'broker', poaId: 'poa' } } } }));
  });
  it('publishes bonds through the case link without duplicate publication', async () => {
    m.db.importerOfRecord.findMany.mockResolvedValue([{ clientId: 'target' }]);
    await promoteSetupForBond('broker', 'bond');
    expect(m.sync).toHaveBeenCalledExactlyOnceWith('broker', 'target');
  });
});

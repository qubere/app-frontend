import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ ctx: { accountId: 'a1', userId: 'u1', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.setup.read', 'portal.users.manage'], dataMode: 'DEMO' }, scope: { isAllClients: false, authorizedClientIds: ['target'], teamIds: [] }, read: vi.fn(), db: { user: { findUnique: vi.fn() }, client: { findMany: vi.fn(), findFirst: vi.fn() }, clientDocument: { findFirst: vi.fn() }, accountMembership: { findFirst: vi.fn() }, auditLog: { create: vi.fn() }, customerRequest: { create: vi.fn() } } }));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => m.ctx }));
vi.mock('../../../packages/auth/src/scope-engine', () => ({ getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/auth', async () => ({ ...await import('../../../packages/auth/src/portal-auth'), getAccountContext: async () => m.ctx, getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/db', () => ({ db: m.db, withAccountIdContext: (_account: unknown, fn: Function) => fn(), withDataModeContext: (_mode: unknown, fn: Function) => fn(), isDataMode: () => true }));
vi.mock('@qubere/storage', () => ({ readStoredObject: m.read }));
const me = await import('../src/app/api/me/route');
const setup = await import('../src/app/api/setup/route');
const download = await import('../src/app/api/setup/documents/[id]/download/route');
const invite = await import('../src/app/api/setup/stakeholders/invite-request/route');
beforeEach(() => { vi.clearAllMocks(); me.invalidateMeCache(); m.ctx.roleNames = ['CUSTOMER_ADMIN']; m.db.user.findUnique.mockResolvedValue({ id: 'u1', email: 'client@example.com', firstName: 'Client', lastName: 'User' }); m.ctx.permissions = ['portal.setup.read', 'portal.users.manage']; m.scope.authorizedClientIds = ['target']; m.db.client.findMany.mockResolvedValue([{ id: 'target', name: 'Target' }]); m.db.client.findFirst.mockResolvedValue({ id: 'target', name: 'Target', account: { name: 'Broker' }, onboardingCases: [], importersOfRecord: [{ name: 'Target', irsEin: '12-3456789', cbpImporterNumber: 'DEMO123', registrationStatus: 'registered', powersOfAttorney: [], bond: null }], clientDocuments: [], clientStakeholders: [], internalNotes: 'PRIVATE' }); m.db.clientDocument.findFirst.mockResolvedValue({ id: 'doc1', clientId: 'target', title: 'Signed POA', storageUrl: 'stored://poa' }); m.read.mockResolvedValue({ body: Buffer.from('%PDF-1.7 DEMO') }); m.db.customerRequest.create.mockResolvedValue({ id: 'r1' }); });
afterEach(() => vi.restoreAllMocks());
describe('Setup schema recovery', () => {
    it.each(['P2021', 'P2022'])('returns a safe update-required response for %s', async code => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        m.db.client.findFirst.mockRejectedValue({ code, message: 'PRIVATE database schema' });
        const response = await setup.GET(new Request('http://portal/api/setup'));
        expect(response.status).toBe(503);
        expect((await response.json()).error).toBe('PORTAL_SCHEMA_OUTDATED');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
    it('recognizes an old generated client rejecting the new setup relation', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        m.db.client.findFirst.mockRejectedValue(new Prisma.PrismaClientValidationError('Unknown field `clientDocuments` for include statement. PRIVATE query', { clientVersion: '6.19.3' }));
        const response = await setup.GET(new Request('http://portal/api/setup'));
        expect(response.status).toBe(503);
        const body = await response.text();
        expect(body).toContain('PORTAL_SCHEMA_OUTDATED');
        expect(body).not.toContain('PRIVATE');
    });
    it('does not treat an unrelated query typo as a deployment problem', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        m.db.client.findFirst.mockRejectedValue(new Prisma.PrismaClientValidationError('Unknown argument `typo`.', { clientVersion: '6.19.3' }));
        const response = await setup.GET(new Request('http://portal/api/setup'));
        expect(response.status).toBe(500);
        expect((await response.json()).error).toBe('PORTAL_UNAVAILABLE');
    });
    it('reports a missing document delegate without accessing storage', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const delegate = m.db.clientDocument;
        (m.db as any).clientDocument = undefined;
        try {
            expect((await setup.GET(new Request('http://portal/api/setup'))).status).toBe(503);
            expect((await download.GET(new Request('http://portal/api/setup/documents/doc1/download'), { params: Promise.resolve({ id: 'doc1' }) })).status).toBe(503);
            expect(m.read).not.toHaveBeenCalled();
        } finally { m.db.clientDocument = delegate; }
    });
});
describe('Setup scope and content safety', () => {
    it('masks EIN and excludes raw notes and screening details', async () => { const r = await setup.GET(new Request('http://portal/api/setup')); expect(r.status).toBe(200); const body = JSON.stringify(await r.json()); expect(body).toContain('6789'); expect(body).not.toMatch(/12-345|PRIVATE|storageUrl/); expect(r.headers.get('Cache-Control')).toBe('no-store'); });
    it('rejects another client before reading any setup', async () => { const r = await setup.GET(new Request('http://portal/api/setup?clientId=amazon')); expect(r.status).toBe(404); expect(m.db.client.findFirst).not.toHaveBeenCalled(); });
    it('requires a choice when more than one client is assigned', async () => { m.scope.authorizedClientIds = ['target', 'amazon']; m.db.client.findMany.mockResolvedValue([{ id: 'target', name: 'Target' }, { id: 'amazon', name: 'Amazon' }]); const r = await setup.GET(new Request('http://portal/api/setup')); expect((await r.json()).selectClient).toBe(true); expect(m.db.client.findFirst).not.toHaveBeenCalled(); });
    it('downloads only active visible documents in the scoped client and audits access', async () => { const r = await download.GET(new Request('http://portal/api/setup/documents/doc1/download'), { params: Promise.resolve({ id: 'doc1' }) }); expect(r.status).toBe(200); expect(await r.text()).toContain('%PDF'); expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff'); expect(m.db.clientDocument.findFirst).toHaveBeenCalledWith({ where: { id: 'doc1', accountId: 'a1', clientId: { in: ['target'] }, portalVisible: true, status: 'ACTIVE' } }); expect(m.db.auditLog.create).toHaveBeenCalled(); });
    it('does not touch storage for an inaccessible or revoked document', async () => { m.db.clientDocument.findFirst.mockResolvedValue(null); expect((await download.GET(new Request('http://portal/api/setup/documents/other/download'), { params: Promise.resolve({ id: 'other' }) })).status).toBe(404); expect(m.read).not.toHaveBeenCalled(); });
    it('records an access request rather than creating a login', async () => { const r = await invite.POST(new Request('http://portal/api/setup/stakeholders/invite-request', { method: 'POST', body: JSON.stringify({ clientId: 'target', name: 'Billing contact', email: 'billing@example.com', role: 'BILLING_CONTACT' }) })); expect(r.status).toBe(201); expect(m.db.customerRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'CONFIRMATION', clientId: 'target', metadata: { name: 'Billing contact', email: 'billing@example.com', role: 'BILLING_CONTACT' } }) }); });
    it('denies access requests without the management permission', async () => { m.ctx.permissions = ['portal.setup.read']; expect((await invite.POST(new Request('http://portal/api/setup/stakeholders/invite-request', { method: 'POST', body: '{}' }))).status).toBe(404); expect(m.db.customerRequest.create).not.toHaveBeenCalled(); });
});

describe('Setup navigation and API access agree', () => {
    it.each([
        ['CUSTOMER_ADMIN', ['portal.porter', 'portal.setup.read'], true],
        ['CUSTOMER_VIEWER', ['portal.porter', 'portal.setup.read'], true],
        ['CUSTOMER_TMS_USER', ['portal.porter', 'portal.tms.read'], false],
        ['SUPER_ADMIN_READ', ['portal.porter'], false],
        ['TMS_ADMIN', ['portal.porter'], true],
        ['BROKER_ADMIN', ['portal.porter'], true],
    ])('%s reports Setup access only when the endpoint permits access', async (role, permissions, allowed) => {
        m.ctx.roleNames = [role];
        m.ctx.permissions = permissions;
        const profile = await (await me.GET(new Request('http://portal/api/me'))).json();
        expect(profile.capabilities.canReadSetup).toBe(allowed);
        const response = await setup.GET(new Request('http://portal/api/setup'));
        expect(response.status).toBe(allowed ? 200 : 404);
        if (!allowed) expect(m.db.client.findFirst).not.toHaveBeenCalled();
    });

    it('refreshes Setup access even when the profile is cached', async () => {
        await me.GET(new Request('http://portal/api/me'));
        m.ctx.permissions = ['portal.porter'];
        const profile = await (await me.GET(new Request('http://portal/api/me'))).json();
        expect(profile.capabilities.canReadSetup).toBe(false);
        expect((await setup.GET(new Request('http://portal/api/setup'))).status).toBe(404);
        expect(m.db.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('keeps administrator access within the assigned client scope', async () => {
        m.ctx.roleNames = ['TMS_ADMIN'];
        m.ctx.permissions = [];
        expect((await setup.GET(new Request('http://portal/api/setup?clientId=amazon'))).status).toBe(404);
        expect(m.db.client.findFirst).not.toHaveBeenCalled();
    });
});

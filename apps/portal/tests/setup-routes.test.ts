import { Prisma } from '@prisma/client';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImporterSetupList } from '../src/components/ImporterSetupList';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ ctx: { accountId: 'a1', userId: 'u1', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.setup.read', 'portal.users.manage'], dataMode: 'DEMO' }, scope: { isAllClients: false, authorizedClientIds: ['target'], teamIds: [] }, read: vi.fn(), db: { user: { findUnique: vi.fn() }, client: { findMany: vi.fn(), findFirst: vi.fn() }, clientDocument: { findFirst: vi.fn() }, accountMembership: { findFirst: vi.fn(), findMany: vi.fn() }, auditLog: { create: vi.fn() }, customerRequest: { create: vi.fn() } } }));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => m.ctx }));
vi.mock('../../../packages/auth/src/scope-engine', () => ({ getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/auth', async () => ({ ...await import('../../../packages/auth/src/portal-auth'), getAccountContext: async () => m.ctx, getEffectiveUserScope: async () => m.scope }));
vi.mock('@qubere/db', () => ({ db: m.db, withAccountIdContext: (_account: unknown, fn: Function) => fn(), withDataModeContext: (_mode: unknown, fn: Function) => fn(), isDataMode: () => true }));
vi.mock('@qubere/storage', () => ({ readStoredObject: m.read }));
const me = await import('../src/app/api/me/route');
const setup = await import('../src/app/api/setup/route');
const download = await import('../src/app/api/setup/documents/[id]/download/route');
const invite = await import('../src/app/api/setup/stakeholders/invite-request/route');
beforeEach(() => { vi.clearAllMocks(); me.invalidateMeCache(); m.ctx.roleNames = ['CUSTOMER_ADMIN']; m.db.user.findUnique.mockResolvedValue({ id: 'u1', email: 'client@example.com', firstName: 'Client', lastName: 'User' }); m.ctx.permissions = ['portal.setup.read', 'portal.users.manage']; m.scope.authorizedClientIds = ['target']; m.db.client.findMany.mockResolvedValue([{ id: 'target', name: 'Target' }]); m.db.client.findFirst.mockResolvedValue({ id: 'target', name: 'Target', account: { name: 'Broker' }, onboardingCases: [], importersOfRecord: [{ id: 'ior-target', accountId: 'a1', clientId: 'target', name: 'Target', irsEin: '12-3456789', cbpImporterNumber: 'DEMO123', registrationStatus: 'registered', powersOfAttorney: [], bond: null }], clientDocuments: [], clientStakeholders: [], internalNotes: 'PRIVATE' }); m.db.clientDocument.findFirst.mockResolvedValue({ id: 'doc1', clientId: 'target', title: 'Signed POA', storageUrl: 'stored://poa' }); m.read.mockResolvedValue({ body: Buffer.from('%PDF-1.7 DEMO') }); m.db.customerRequest.create.mockResolvedValue({ id: 'r1' }); });
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
    it('keeps all authorized choices after selecting an empty client so another setup is reachable', async () => {
        m.scope.authorizedClientIds = ['target', 'target-retail'];
        const choices = [{ id: 'target', name: 'Target' }, { id: 'target-retail', name: 'Target Retail' }];
        m.db.client.findMany.mockImplementation(async ({ where }) => choices.filter(c => where.id.in.includes(c.id)));
        m.db.client.findFirst.mockResolvedValueOnce({ id: 'target', name: 'Target', account: { name: 'Broker' }, onboardingCases: [], importersOfRecord: [], clientDocuments: [], clientStakeholders: [] });
        const body = await (await setup.GET(new Request('http://portal/api/setup?clientId=target'))).json();
        expect(body.importers).toEqual([]);
        expect(body.clients).toEqual(choices);
        expect(m.db.client.findFirst.mock.calls[0][0].where).toEqual({ id: 'target', accountId: 'a1' });
    });
    it('does not load setup for a selected client outside the current account', async () => {
        m.scope.authorizedClientIds = ['target', 'client-in-another-account'];
        const response = await setup.GET(new Request('http://portal/api/setup?clientId=client-in-another-account'));
        expect(response.status).toBe(404);
        expect(m.db.client.findFirst).not.toHaveBeenCalled();
    });
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

describe('Newly uploaded signed PoAs', () => {
    it('shows the newer signed upload for the same importer instead of an old onboarding draft', async () => {
        const importer = { id: 'ior-target', name: 'Target', powersOfAttorney: [{ id: 'poa-new', status: 'executed', executionMethod: 'WET_INK', signedDate: new Date('2026-09-02'), createdAt: new Date('2026-09-02') }], bond: null };
        m.db.client.findFirst.mockResolvedValueOnce({ id: 'target', name: 'Target', account: { name: 'Broker' },
            onboardingCases: [{ status: 'poa_pending', blockers: ['POA_NOT_EXECUTED'], entities: [{ importerOfRecord: importer, poa: { id: 'poa-old', status: 'draft', createdAt: new Date('2026-08-01') }, screeningStatus: 'pending' }] }],
            importersOfRecord: [{ id: 'different-ior', name: 'Other Target subsidiary', powersOfAttorney: [{ id: 'wrong-poa', status: 'draft', createdAt: new Date('2026-09-03') }] }, importer],
            clientDocuments: [{ id: 'signed-file', kind: 'EXECUTED_POA', sourceId: 'poa-new', title: 'Executed Power of Attorney' }], clientStakeholders: [],
        });
        const response = await setup.GET(new Request('http://portal/api/setup'));
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.poa).toMatchObject({ status: 'executed', documentId: 'signed-file' });
        expect(body.importers.find((i: any) => i.id === 'ior-target').onboarding.steps.find((step: any) => step.key === 'poa').state).toBe('done');
        expect(body.onboarding.steps.find((step: any) => step.key === 'poa').state).toBe('pending');
        expect(body.onboarding.blockers).not.toContain('POA awaiting signature');
    });
    it('downloads an uploaded signed image with the correct format', async () => {
        m.read.mockResolvedValueOnce({ body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
        const response = await download.GET(new Request('http://portal/api/setup/documents/doc1/download'), { params: Promise.resolve({ id: 'doc1' }) });
        expect(response.headers.get('Content-Type')).toBe('image/png');
        expect(response.headers.get('Content-Disposition')).toContain('.png');
    });
});

describe('Customs and portal readiness agree', () => {
    const completed = () => {
        const importer = { id: 'ior-target', name: 'Target legal entity', irsEin: '123456789', registrationStatus: 'pending_5106', powersOfAttorney: [], bond: null };
        const poa = { id: 'executed-poa', status: 'executed', signedDate: new Date('2026-09-01'), createdAt: new Date('2026-09-01') };
        const bond = { id: 'bond', status: 'verified', bondAmount: 50000, bondNumber: 'BOND-TARGET' };
        return { id: 'target', name: 'Target Corporation', account: { name: 'Broker' }, importersOfRecord: [], clientDocuments: [{ id: 'signed-doc', kind: 'EXECUTED_POA', sourceId: 'executed-poa', title: 'Executed PoA' }], clientStakeholders: [],
            onboardingCases: [{ status: 'in_progress', primaryImporterId: 'ior-target', primaryImporter: importer, fiveOhSixRecords: [], stepStatus: { step_6: 'done' }, entities: [{ importerOfRecordId: 'ior-target', importerOfRecord: importer, importerNumber: '123456789', importerNumberType: 'EIN', screeningStatus: 'passed', bondCoverage: 'own', poa, bond }], blockers: ['POA_NOT_EXECUTED', 'SCREENING_INCOMPLETE'] }],
        };
    };
    it('matches the screenshot with a legacy unlinked importer and only 5106/activation pending', async () => {
        m.db.client.findFirst.mockResolvedValueOnce(completed());
        const body = await (await setup.GET(new Request('http://portal/api/setup'))).json();
        const states = Object.fromEntries(body.onboarding.steps.map((s: any) => [s.key, s.state]));
        expect(states).toEqual({ legal_entity: 'done', five_oh_six: 'pending', poa: 'done', bond: 'done', screening: 'done', billing: 'done', activation: 'pending' });
        expect(body.onboarding.blockers).toEqual(['Importer registration pending']);
        expect(body.poa.documentId).toBe('signed-doc');
        expect(body.importer.legalName).toBe('Target legal entity');
        expect(body.bond.number).toBe('BOND-TARGET');
    });
    it('recognizes a submitted 5106 before activation updates importer registration', async () => {
        const client = completed();
        (client.onboardingCases[0].fiveOhSixRecords as any[]).push({ status: 'submitted' });
        m.db.client.findFirst.mockResolvedValueOnce(client);
        const body = await (await setup.GET(new Request('http://portal/api/setup'))).json();
        expect(body.onboarding.steps.find((s: any) => s.key === 'five_oh_six').state).toBe('done');
        expect(body.onboarding.steps.find((s: any) => s.key === 'activation').state).toBe('pending');
    });
    it('does not report all entities complete when a secondary entity is pending', async () => {
        const client = completed();
        client.onboardingCases[0].entities.push({ ...client.onboardingCases[0].entities[0], importerOfRecordId: 'secondary', importerOfRecord: { ...client.onboardingCases[0].entities[0].importerOfRecord, id: 'secondary', name: 'Target subsidiary' }, screeningStatus: 'pending' });
        m.db.client.findFirst.mockResolvedValueOnce(client);
        const body = await (await setup.GET(new Request('http://portal/api/setup'))).json();
        expect(body.onboarding.steps.find((s: any) => s.key === 'screening').state).toBe('pending');
    });
    it('does not invent a POA awaiting signature for a client with no linked setup', async () => {
        const client = completed(); client.onboardingCases = [];
        m.db.client.findFirst.mockResolvedValueOnce(client);
        const body = await (await setup.GET(new Request('http://portal/api/setup'))).json();
        expect(body.onboarding.status).toBe('not_started');
        expect(body.onboarding.blockers).toEqual([]);
        expect(body.onboarding.steps.every((s: any) => s.state === 'pending')).toBe(true);
    });
    it('shows waivers without exposing the broker’s private reason', async () => {
        const client = completed();
        (client.onboardingCases[0].stepStatus as any).waiver_five_oh_six = { reason: 'PRIVATE approval notes' };
        m.db.client.findFirst.mockResolvedValueOnce(client);
        const body = await (await setup.GET(new Request('http://portal/api/setup'))).json();
        expect(body.onboarding.steps.find((s: any) => s.key === 'five_oh_six').state).toBe('waived');
        expect(JSON.stringify(body)).not.toContain('PRIVATE');
    });
});

describe('All importers in a client workspace', () => {
    const importer = (id: string, name: string, clientId = 'target') => ({ id, accountId: 'a1', clientId, name, irsEin: '123456789', cbpImporterNumber: id, registrationStatus: 'registered', powersOfAttorney: [], bond: null });
    const client = (importers: any[] = []) => ({ id: 'target', name: 'Target', account: { name: 'Broker' }, importersOfRecord: importers, onboardingCases: [] as any[], clientDocuments: [], clientStakeholders: [] });
    const load = async () => (await setup.GET(new Request('http://portal/api/setup'))).json();
    it('returns and renders every linked importer even without an onboarding case', async () => {
        m.db.client.findFirst.mockResolvedValueOnce(client([importer('one', 'Target Retail'), importer('two', 'Target Imports')]));
        const body = await load();
        expect(body.importers.map((i: any) => i.id)).toEqual(['two', 'one']);
        expect(body.onboarding.status).toBe('on_file');
        expect(body.importers.every((i: any) => i.onboarding.status === 'on_file')).toBe(true);
        const html = renderToStaticMarkup(React.createElement(ImporterSetupList, { importers: body.importers }));
        expect(html).toContain('Importers of record (2)');
        expect(html).toContain('Target Retail'); expect(html).toContain('Target Imports');
        expect(html).not.toContain('has not linked an onboarding');
        expect(html).not.toContain('123456789');
    });
    it('loads different onboarding cases for different importers without dropping older cases', async () => {
        const one = importer('one', 'Target Retail'), two = importer('two', 'Target Imports');
        const c = client([one, two]);
        c.onboardingCases = [one, two].map((i, index) => ({ id: `case-${i.id}`, status: 'in_progress', primaryImporterId: i.id, primaryImporter: i, stepStatus: {}, fiveOhSixRecords: [], entities: [{ id: `entity-${i.id}`, importerOfRecordId: i.id, importerOfRecord: i, importerNumber: '123456789', importerNumberType: 'EIN', screeningStatus: index ? 'pending' : 'passed', bondCoverage: 'own', bond: null, poa: null }] }));
        m.db.client.findFirst.mockResolvedValueOnce(c);
        const body = await load();
        expect(body.importers.find((i: any) => i.id === 'one').screening.status).toBe('passed');
        expect(body.importers.find((i: any) => i.id === 'two').screening.status).toBe('pending');
        expect(body.importers.find((i: any) => i.id === 'two').onboardingCaseId).toBe('case-two');
        expect(m.db.client.findFirst.mock.calls.at(-1)![0].include.onboardingCases.take).toBeUndefined();
    });
    it('keeps registration and signed PoA evidence separate for each entity in one case', async () => {
        const one = importer('one', 'Retail'), two = importer('two', 'Imports');
        const c = client([one, two]);
        c.onboardingCases = [{ id: 'case', status: 'in_progress', stepStatus: {}, primaryImporterId: 'one', primaryImporter: one,
            fiveOhSixRecords: [{ status: 'submitted', onboardingEntityId: 'e-one' }],
            entities: [one, two].map(i => ({ id: `e-${i.id}`, importerOfRecordId: i.id, importerOfRecord: i, importerNumber: '123456789', importerNumberType: 'EIN', screeningStatus: 'passed', bondCoverage: 'own', bond: null, poa: i.id === 'one' ? { id: 'poa-one', status: 'executed', signedDate: new Date(), createdAt: new Date() } : null })) }];
        m.db.client.findFirst.mockResolvedValueOnce(c);
        const body = await load();
        const states = (id: string) => Object.fromEntries(body.importers.find((i: any) => i.id === id).onboarding.steps.map((s: any) => [s.key, s.state]));
        expect(states('one')).toMatchObject({ five_oh_six: 'done', poa: 'done' });
        expect(states('two')).toMatchObject({ five_oh_six: 'pending', poa: 'pending' });
    });
    it('does not expose an importer explicitly assigned to another client through a stale case relation', async () => {
        const other = importer('other', 'PRIVATE IMPORTER', 'amazon');
        const c = client();
        c.onboardingCases = [{ id: 'case', entities: [{ importerOfRecord: other }], primaryImporter: other }];
        m.db.client.findFirst.mockResolvedValueOnce(c);
        const body = await load();
        expect(body.importers).toEqual([]);
        expect(JSON.stringify(body)).not.toContain('PRIVATE');
    });
    it('does not mark the whole client active when another importer is only on file', async () => {
        const one = importer('one', 'Active importer'), two = importer('two', 'Pending importer');
        const c = client([one, two]);
        c.onboardingCases = [{ id: 'case-one', primaryImporter: one, primaryImporterId: 'one', status: 'active', stepStatus: {}, fiveOhSixRecords: [], entities: [] }];
        m.db.client.findFirst.mockResolvedValueOnce(c);
        expect((await load()).onboarding.status).toBe('in_progress');
    });
});

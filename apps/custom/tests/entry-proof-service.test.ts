import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntryProofPayload } from '@qubere/entry-proof';
import { db } from '@/lib/db';
import { generateEntryProof, publishEntryProof } from '@/lib/filing/entryProofService';
import { computeFilingTariff } from '@/lib/tariff/dutyEngine';
const records: any[] = [];
const ctx = { accountId: 'a1', userId: 'broker1' };
const line = { id: 'l1', lineNumber: 1, description: 'Valve', htsCode: '8481.80.5090', countryOfOrigin: 'CN', quantity: 1, unitPrice: 1000, totalValue: 1000, productId: 'prod1', htsConfidence: 90 };
const filing = { id: 'f1', accountId: 'a1', entryNumber: 'ENTRY-1', entryType: '01', country: 'US', shipmentId: 's1', importerOfRecordId: null, bondId: null, importerOfRecord: null, bond: null, snapshot: null, shipment: { clientId: 'target', importerName: 'Target', portOfEntry: '2704', countryOfExport: 'CN', carrierName: 'Carrier', lineItems: [line], documents: [] } };
const mock = (model: string, method: string, fn: Function) => vi.spyOn((db as any)[model], method).mockImplementation(fn as any);
beforeEach(() => {
    vi.restoreAllMocks();
    records.length = 0;
    mock('customsFiling', 'findFirst', async () => filing);
    mock('customsFiling', 'update', async () => filing);
    mock('productClassification', 'findMany', async () => [{ id: 'class1', productId: 'prod1', classificationCode: line.htsCode, reviewedByUserId: 'broker1', reviewedAt: new Date() }]);
    for (const model of ['productParty', 'complianceFinding', 'refundOpportunity', 'htsPgaRequirement', 'section301Rate', 'section232Rate', 'adcvdOrder'])
        mock(model, 'findMany', async () => []);
    mock('valuationAssistsRecord', 'findFirst', async () => null);
    mock('htsRelease', 'findFirst', async () => ({ id: 'r1', releaseName: 'HTS test', retrievedAt: new Date(), sourceUrl: 'https://hts.usitc.gov/' }));
    mock('htsNode', 'findMany', async () => [{ htsNumberNormalized: '8481805090', dutyRates: [{ rateColumn: 'General', rawRateText: '5%' }] }]);
    mock('entryProof', 'findFirst', async ({ where, orderBy }: any) => { const matches = records.filter(p => (!where.status || p.status === where.status) && (!where.filingId || p.filingId === where.filingId)); return (orderBy ? [...matches].sort((a, b) => b.version - a.version) : matches)[0] ?? null; });
    mock('entryProof', 'create', async ({ data }: any) => { const p = { ...data, id: `p${records.length + 1}`, status: 'DRAFT' }; records.push(p); return p; });
    mock('entryProof', 'update', async ({ where, data }: any) => { const p = records.find(p => p.id === where.id); Object.assign(p, data); return p; });
    mock('entryProofEvent', 'findFirst', async () => null);
    mock('entryProofEvent', 'create', async ({ data }: any) => data);
    mock('auditLog', 'create', async ({ data }: any) => data);
    vi.spyOn(db, '$transaction').mockImplementation((async (fn: Function) => fn(db)) as any);
    vi.spyOn(db, '$queryRaw').mockResolvedValue([]);
});
describe('Entry Proof lifecycle through the actual assembler and tariff engine', () => {
    it('creates an inbound-evidence draft without changing the published proof', async () => {
        await generateEntryProof('f1', ctx); await publishEntryProof('f1', ctx);
        const updated = { ...filing, shipment: { ...filing.shipment, documents: [{ id: 'doc-email', fileName: 'invoice.pdf', source: 'INBOUND_EMAIL', createdAt: new Date('2026-09-02') }] } };
        mock('customsFiling', 'findFirst', async () => updated);
        const proof = await generateEntryProof('f1', { accountId: 'a1' }, { inboundDocumentId: 'doc-email' });
        expect(records[0].status).toBe('PUBLISHED'); expect(proof.status).toBe('DRAFT');
        expect((proof.payload as unknown as EntryProofPayload).lines[0].evidence).toContainEqual(expect.objectContaining({ sourceId: 'doc-email', label: 'invoice.pdf (received by email 2026-09-02)' }));
        expect((proof as any).events.create).toMatchObject({ actorType: 'SYSTEM', detail: { trigger: 'INBOUND_DOCUMENT', shipmentDocumentId: 'doc-email' } });
        mock('entryProofEvent', 'findFirst', async () => ({ entryProof: proof }));
        await generateEntryProof('f1', { accountId: 'a1' }, { inboundDocumentId: 'doc-email' }); expect(records).toHaveLength(2);
    });
    it('refuses to publish an old draft after client reassignment', async () => { await generateEntryProof('f1', ctx); mock('customsFiling', 'findFirst', async () => ({ ...filing, shipment: { ...filing.shipment, clientId: 'amazon' } })); await expect(publishEntryProof('f1', ctx)).rejects.toThrow('PROOF_CLIENT_CHANGED_REGENERATE'); expect(records[0].status).toBe('DRAFT'); });
    it('generates a customer-safe draft with tariff parity', async () => { const p = await generateEntryProof('f1', ctx); const tariff = computeFilingTariff([line], { [line.htsCode]: { generalDutyRate: '5%' } }); expect((p.payload as unknown as EntryProofPayload).totals.dutyAndFeesUsd).toBe(tariff.totalAmount); expect(p.status).toBe('DRAFT'); expect(p.version).toBe(1); expect((p.payload as unknown as EntryProofPayload).lines[0].classificationStatus).toBe('sourced_approved'); expect(db.$transaction).toHaveBeenCalledTimes(1); });
    it('retains published v1 while drafts refresh, then supersedes both predecessor paths', async () => {
        await generateEntryProof('f1', ctx);
        await publishEntryProof('f1', ctx);
        await generateEntryProof('f1', ctx);
        expect(records[0].status).toBe('PUBLISHED');
        await generateEntryProof('f1', ctx);
        expect(records[1]).toMatchObject({ status: 'SUPERSEDED', supersededById: 'p3' });
        await publishEntryProof('f1', ctx);
        expect(records.map(p => p.status)).toEqual(['SUPERSEDED', 'SUPERSEDED', 'PUBLISHED']);
        expect(records[0].supersededById).toBe('p3');
        expect(records[2].version).toBe(3);
        expect(db.auditLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ newValue: expect.objectContaining({ entryProofId: 'p3', version: 3 }) }) });
    });
});

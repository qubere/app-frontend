import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { assembleEntryProof, flagCopy, type EntryProofPayload, type DutyStackRow, type ProofLineInput } from '@qubere/entry-proof';
import { buildForm7501 } from './form7501';
import { computeFilingTariff, loadLineDutyRates, parsePublishedDutyRate } from '@/lib/tariff/dutyEngine';
import type { FilingSnapshotData } from '@/modules/filings/filing.service';
import Decimal from 'decimal.js';
type Context = {
    accountId: string;
    userId: string;
};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const digits = (s: string) => s.replace(/\D/g, '');
export async function buildEntryProofPayload(filingId: string, ctx: Context): Promise<EntryProofPayload> {
    const filing = await db.customsFiling.findFirst({ where: { id: filingId, accountId: ctx.accountId }, include: { shipment: { include: { lineItems: { orderBy: { lineNumber: 'asc' } }, documents: { where: { portalVisibility: 'CUSTOMER' }, select: { id: true, fileName: true } } } }, importerOfRecord: true, bond: true, snapshot: true } });
    if (!filing?.shipment?.clientId)
        throw new Error('PROOF_REQUIRES_CLIENT_SHIPMENT');
    if (filing.country && filing.country !== 'US')
        throw new Error('PROOF_REQUIRES_US_ENTRY');
    const shipment = filing.shipment;
    const snapshot = filing.snapshot?.snapshotData as unknown as FilingSnapshotData | undefined;
    const live = shipment.lineItems;
    const lines = snapshot?.lineItems?.some(l => l.customsValue !== undefined)
        ? snapshot.lineItems.map(l => ({ ...l, productId: live.find(x => x.id === l.id)?.productId ?? null, htsConfidence: live.find(x => x.id === l.id)?.htsConfidence ?? null, totalValue: l.customsValue ?? l.totalValue })) : live;
    if (!lines.length)
        throw new Error('PROOF_REQUIRES_ENTRY_LINES');
    const snapshotRelease = (filing.snapshot?.snapshotData as Record<string, unknown> | null)?.htsReleaseId;
    const release = await db.htsRelease.findFirst({ where: typeof snapshotRelease === 'string' ? { id: snapshotRelease, country: 'US' } : { country: 'US', publicationStatus: 'PUBLISHED' }, orderBy: { effectiveFrom: 'desc' } });
    const [classifications, findings, refunds, assists, pga, rates] = await Promise.all([
        db.productClassification.findMany({ where: { accountId: ctx.accountId, productId: { in: lines.flatMap(l => l.productId ? [l.productId] : []) }, jurisdiction: 'US', status: 'APPROVED', supersededById: null }, orderBy: { reviewedAt: 'desc' } }),
        db.complianceFinding.findMany({ where: { accountId: ctx.accountId, filingId, status: { in: ['Open', 'Investigating', 'AcceptedRisk'] } } }),
        db.refundOpportunity.findMany({ where: { accountId: ctx.accountId, filingId, status: 'Identified' } }),
        db.valuationAssistsRecord.findFirst({ where: { accountId: ctx.accountId, filingId } }),
        db.htsPgaRequirement.findMany({ where: { htsNumber: { in: lines.flatMap(l => [l.htsCode, digits(l.htsCode)]) } } }),
        loadLineDutyRates(lines, release?.id),
    ]);
    const isOcean = !shipment.transportMode || ['OCEAN', 'SEA', 'VESSEL', 'FCL', 'LCL'].includes(shipment.transportMode.toUpperCase());
    const tariff = computeFilingTariff(lines, {}, rates, { isOcean });
    const lineInputs = lines.map((l, i) => {
        // Never label a different classification code approved, including frozen entries.
        const classification = classifications.find(c => c.productId === l.productId && digits(c.classificationCode) === digits(l.htsCode));
        return { id: l.id, lineNumber: l.lineNumber, description: l.description, htsCode: l.htsCode, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), totalValue: Number(l.totalValue), countryOfOrigin: l.countryOfOrigin, approvedHtsCode: classification?.classificationCode, approvedAt: classification?.reviewedAt?.toISOString(), approvedByUserId: classification?.reviewedByUserId, classificationId: classification?.id, dutyRateDecimal: parsePublishedDutyRate(rates[i]?.generalDutyRate), htsReleaseId: release?.id };
    });
    const form = buildForm7501({ id: filing.id, entryNumber: filing.entryNumber, entryType: filing.entryType, importerName: filing.importerOfRecord?.name ?? shipment.importerName, importerCbpNumber: filing.importerOfRecord?.cbpImporterNumber ?? null, importerOfRecordId: filing.importerOfRecordId, bondNumber: filing.bond?.bondNumber ?? null, bondId: filing.bondId, portOfEntry: shipment.portOfEntry, countryOfExport: shipment.countryOfExport, carrierName: shipment.carrierName }, lineInputs, release?.id ?? null);
    const safeFinding = (f: typeof findings[number]) => { const impact = (f.metadata as Record<string, unknown> | null)?.dutyImpact; return flagCopy({ id: f.id, rule: f.rule, severity: f.severity, dutyImpactUsd: typeof impact === 'number' && Number.isFinite(impact) ? impact : null }); };
    const potentialAssists = Array.isArray(assists?.potentialAssists) ? assists.potentialAssists as Array<{
        declared?: boolean;
        estimatedValue?: number;
    }> : [];
    // Entry-wide fees are allocated proportionally with the last line taking rounding remainder.
    let allocatedMpf = new Decimal(0), allocatedHmf = new Decimal(0);
    const entryMpf = tariff.dutyBreakdown.find(d => d.feeName.includes('(MPF)'))?.amount ?? 0;
    const entryHmf = tariff.dutyBreakdown.find(d => d.feeName.includes('(HMF)'))?.amount ?? 0;
    const proofLines: ProofLineInput[] = lines.map((l, i) => {
        const r = rates[i], result = tariff.lineResults[i], f = form.lineItems[i];
        const weight = tariff.totalCustomsValue ? new Decimal(result.customsValue).div(tariff.totalCustomsValue) : new Decimal(1).div(lines.length);
        const mpf = i === lines.length - 1 ? new Decimal(entryMpf).minus(allocatedMpf) : weight.times(entryMpf).toDecimalPlaces(2);
        const hmf = i === lines.length - 1 ? new Decimal(entryHmf).minus(allocatedHmf) : weight.times(entryHmf).toDecimalPlaces(2);
        allocatedMpf = allocatedMpf.plus(mpf);
        allocatedHmf = allocatedHmf.plus(hmf);
        const stack = result.dutyStack!;
        const dutyStack: DutyStackRow[] = [
            { key: 'BASE', label: 'Base duty', status: r.generalStatus ?? 'DATA_UNAVAILABLE', ratePct: result.baseDutyRate === null ? null : result.baseDutyRate * 100, amountUsd: result.baseDutyAmount, detail: null },
            { key: 'SECTION_301', label: 'Section 301', status: r.section301Status ?? 'NOT_EVALUATED', ratePct: r.section301AdditionalRate ?? null, amountUsd: result.section301Amount, detail: r.section301Tranche ?? null },
            { key: 'SECTION_232', label: 'Section 232', status: r.section232Status ?? 'NOT_EVALUATED', ratePct: r.section232AdditionalRate ?? null, amountUsd: result.section232Amount, detail: null },
            { key: 'ANTIDUMPING', label: 'Antidumping', status: r.antidumpingStatus ?? 'NOT_EVALUATED', ratePct: r.antidumpingRate ?? null, amountUsd: stack.antidumping.toNumber(), detail: null },
            { key: 'COUNTERVAILING', label: 'Countervailing', status: r.countervailingStatus ?? 'NOT_EVALUATED', ratePct: r.countervailingRate ?? null, amountUsd: stack.countervailing.toNumber(), detail: null },
            { key: 'MPF', label: 'Merchandise processing fee', status: 'EVALUATED_APPLICABLE', ratePct: 0.3464, amountUsd: mpf.toNumber(), detail: 'Share of entry-level fee, including minimum and maximum.' },
            { key: 'HMF', label: 'Harbor maintenance fee', status: isOcean ? 'EVALUATED_APPLICABLE' : 'EVALUATED_NOT_APPLICABLE', ratePct: isOcean ? 0.125 : 0, amountUsd: hmf.toNumber(), detail: null },
        ];
        return { lineNumber: l.lineNumber, shipmentLineItemId: l.id, description: l.description, htsCode: l.htsCode, htsDescription: classifications.find(c => c.productId === l.productId && digits(c.classificationCode) === digits(l.htsCode))?.description ?? null, htsConfidence: l.htsConfidence, classificationStatus: f.htsCode.status, classificationApprovedBy: lineInputs[i].approvedByUserId ?? null, classificationApprovedAt: lineInputs[i].approvedAt ?? null, griRulesApplied: [], whyThisCode: lineInputs[i].classificationId ? 'This tariff code matches the approved product classification.' : null, countryOfOrigin: l.countryOfOrigin, quantity: Number(l.quantity), enteredValueUsd: result.customsValue, dutyStack, lineDutyTotalUsd: result.totalDutyAmount, pgaAgencies: pga.filter(p => digits(p.htsNumber) === digits(l.htsCode)).map(p => p.agencyCode), valuation: { transactionValueUsd: Number(l.totalValue), assistsDeclared: potentialAssists.every(a => a.declared), assistsUndeclaredEstimateUsd: potentialAssists.filter(a => !a.declared).reduce((n, a) => n + Number(a.estimatedValue ?? 0), 0), relatedParty: assists?.relatedPartyTransaction ?? false },
            evidence: [...(release ? [{ kind: 'REFERENCE_DATA' as const, label: release.releaseName, sourceModel: 'HtsRelease', sourceId: release.id, portalHref: null, citation: release.sourceUrl }] : []), ...(lineInputs[i].classificationId ? [{ kind: 'BROKER_DECISION' as const, label: 'Approved product classification', sourceModel: 'ProductClassification', sourceId: lineInputs[i].classificationId!, portalHref: null, citation: null }] : []), ...shipment.documents.map(d => ({ kind: 'DOCUMENT' as const, label: d.fileName, sourceModel: 'ShipmentDocument', sourceId: d.id, portalHref: `/api/documents/${d.id}/download`, citation: null }))],
            flags: findings.filter(f => f.lineNumber === null || f.lineNumber === l.lineNumber).map(safeFinding) };
    });
    return assembleEntryProof({ filingId, entryNumber: filing.entryNumber, entryType: filing.entryType, importerName: filing.importerOfRecord?.name ?? shipment.importerName, portOfEntry: shipment.portOfEntry, countryOfExport: shipment.countryOfExport, generatedAt: new Date().toISOString(), htsReleaseId: release?.id ?? null, htsReleaseLabel: release?.releaseName ?? null, referenceDataAsOf: release?.retrievedAt.toISOString() ?? null, totals: { enteredValueUsd: tariff.totalCustomsValue, dutyUsd: tariff.totalDuty, feesUsd: tariff.totalFees, dutyAndFeesUsd: tariff.totalAmount }, lines: proofLines, findings: findings.filter(f => f.lineNumber === null).map(safeFinding), refundOpportunities: refunds.map(r => ({ status: r.status, estimatedRefundAmount: Number(r.estimatedRefundAmount ?? 0) })), coverageStatus: { complete: form.coverageStatus.missing === 0, missingFields: form.coverageStatus.missing, unapprovedFields: form.coverageStatus.sourced - form.coverageStatus.approved, warnings: tariff.unratedLineCount ? ['Some duty amounts are incomplete because published rates are unavailable.'] : [] } });
}
export async function generateEntryProof(filingId: string, ctx: Context) {
    const payload = await buildEntryProofPayload(filingId, ctx);
    return db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT id FROM "CustomsFiling" WHERE id = ${filingId} AND "accountId" = ${ctx.accountId} FOR UPDATE`;
        const filing = await tx.customsFiling.findFirst({ where: { id: filingId, accountId: ctx.accountId }, include: { shipment: { select: { clientId: true } } } });
        if (!filing?.shipment?.clientId)
            throw new Error('PROOF_REQUIRES_CLIENT_SHIPMENT');
        const latest = await tx.entryProof.findFirst({ where: { filingId }, orderBy: { version: 'desc' } });
        const draft = await tx.entryProof.findFirst({ where: { filingId, status: 'DRAFT' } });
        if (draft)
            await tx.entryProof.update({ where: { id: draft.id }, data: { status: 'SUPERSEDED' } });
        const proof = await tx.entryProof.create({ data: { accountId: ctx.accountId, filingId, shipmentId: filing.shipmentId, clientId: filing.shipment.clientId, version: (latest?.version ?? 0) + 1, ...payload.scorecard, dutyAndFeesUsd: payload.totals.dutyAndFeesUsd, payload: json(payload), htsReleaseId: payload.htsReleaseId, referenceDataAsOf: payload.referenceDataAsOf ? new Date(payload.referenceDataAsOf) : null, generatedByUserId: ctx.userId, events: { create: { accountId: ctx.accountId, type: 'GENERATED', actorType: 'BROKER', actorUserId: ctx.userId } } } });
        if (draft)
            await tx.entryProof.update({ where: { id: draft.id }, data: { supersededById: proof.id } });
        return proof;
    });
}
export async function publishEntryProof(filingId: string, ctx: Context) {
    const existing = await db.entryProof.findFirst({ where: { filingId, accountId: ctx.accountId, status: 'DRAFT' } });
    if (!existing)
        await generateEntryProof(filingId, ctx);
    return db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT id FROM "CustomsFiling" WHERE id = ${filingId} AND "accountId" = ${ctx.accountId} FOR UPDATE`;
        const draft = await tx.entryProof.findFirst({ where: { filingId, accountId: ctx.accountId, status: 'DRAFT' }, orderBy: { version: 'desc' } });
        if (!draft)
            throw new Error('PROOF_DRAFT_CHANGED_RETRY');
        const filing = await tx.customsFiling.findFirst({ where: { id: filingId, accountId: ctx.accountId }, include: { shipment: { select: { clientId: true } } } });
        if (!filing?.shipment || filing.shipmentId !== draft.shipmentId || filing.shipment.clientId !== draft.clientId)
            throw new Error('PROOF_CLIENT_CHANGED_REGENERATE');
        const previous = await tx.entryProof.findFirst({ where: { filingId, accountId: ctx.accountId, status: 'PUBLISHED' } });
        if (previous) {
            await tx.entryProof.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED', supersededById: draft.id } });
            await tx.entryProofEvent.create({ data: { entryProofId: previous.id, accountId: ctx.accountId, type: 'SUPERSEDED', actorType: 'BROKER', actorUserId: ctx.userId, detail: { supersededById: draft.id } } });
        }
        const now = new Date();
        const proof = await tx.entryProof.update({ where: { id: draft.id }, data: { status: 'PUBLISHED', publishedAt: now, publishedByUserId: ctx.userId, events: { create: { accountId: ctx.accountId, type: 'PUBLISHED', actorType: 'BROKER', actorUserId: ctx.userId } } } });
        await tx.customsFiling.update({ where: { id: filingId }, data: { customerVisibleAt: now, customerPublishedByUserId: ctx.userId } });
        await tx.auditLog.create({ data: { accountId: ctx.accountId, userId: ctx.userId, actorUserId: ctx.userId, effectiveUserId: ctx.userId, action: 'BROKER_ENTRY_SUMMARY_PUBLISH', entity: 'CustomsFiling', entityId: filingId, clientId: proof.clientId, newValue: { customerVisibleAt: now.toISOString(), entryProofId: proof.id, version: proof.version }, source: 'BROKER_WORKBENCH' } });
        return proof;
    });
}

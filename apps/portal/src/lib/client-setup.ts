import { db } from '@qubere/db';
import { computeReadiness } from '@qubere/db/services/onboarding-readiness';
import type { SetupSummary } from '@qubere/entry-proof';

const poaSelect = { id: true, status: true, createdAt: true, executionMethod: true, signerName: true, signedDate: true, expirationDate: true } as const;
const bondSelect = { id: true, bondType: true, suretyName: true, bondNumber: true, bondAmount: true, activityCode: true, expirationDate: true, status: true } as const;
const importerSelect = {
    id: true, accountId: true, clientId: true, name: true, irsEin: true, cbpImporterNumber: true, registrationStatus: true,
    bond: { select: bondSelect }, powersOfAttorney: { orderBy: { createdAt: 'desc' as const }, take: 1, select: poaSelect },
    onboardingEntities: { where: { case: { status: { not: 'withdrawn' }, clientId: { not: null } } }, select: { case: { select: { accountId: true, clientId: true } } } },
} as const;
const labels: Record<string, string> = { legal_entity: 'Company details', five_oh_six: 'Importer registration', poa: 'Power of attorney', bond: 'Customs bond', screening: 'Screening', billing: 'Billing' };
const publicBlockers: Record<string, string> = { legal_entity: 'Company details pending', five_oh_six: 'Importer registration pending', poa: 'POA awaiting signature', bond: 'Bond verification pending', screening: 'Screening review pending', billing: 'Billing setup pending' };

export async function loadClientSetup(accountId: string, clientId: string): Promise<SetupSummary | null> {
    if (!db.clientDocument?.findFirst) throw { code: 'PORTAL_SCHEMA_OUTDATED' };
    const c = await db.client.findFirst({
        where: { id: clientId, accountId },
        include: {
            account: { select: { name: true } },
            onboardingCases: {
                where: { accountId, status: { not: 'withdrawn' } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                select: { id: true, primaryImporterId: true, status: true, path: true, activatedAt: true, assignedUserId: true, stepStatus: true, projectedAnnualDutyTaxFee: true,
                    primaryImporter: { select: importerSelect }, fiveOhSixRecords: { select: { status: true, onboardingEntityId: true } },
                    entities: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, importerOfRecordId: true, importerNumber: true, importerNumberType: true, screeningStatus: true, bondCoverage: true, poa: { select: poaSelect }, bond: { select: bondSelect }, importerOfRecord: { select: importerSelect } } },
                },
            },
            importersOfRecord: { where: { accountId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: importerSelect },
            clientDocuments: { where: { accountId, portalVisible: true, status: 'ACTIVE' }, select: { id: true, kind: true, title: true, expirationDate: true, sourceId: true } },
            clientStakeholders: { where: { accountId }, orderBy: { name: 'asc' }, select: { name: true, role: true, title: true, isSigner: true, loginStatus: true } },
        },
    });
    if (!c) return null;
    type Importer = NonNullable<(typeof c.onboardingCases)[number]['primaryImporter']>;
    type Case = (typeof c.onboardingCases)[number];
    type Entity = Case['entities'][number];
    const linked = new Map<string, { importer: Importer; onboarding?: Case; entity?: Entity }>();
    const belongsToClient = (i: Importer) => {
        if ((i.accountId && i.accountId !== accountId) || (i.clientId && i.clientId !== clientId)) return false;
        const clients = new Set((i.onboardingEntities ?? []).filter(e => e.case.accountId === accountId).map(e => e.case.clientId));
        return !!i.clientId || clients.size === 0 || (clients.size === 1 && clients.has(clientId));
    };
    // Keep every explicit importer. Cases supplement legacy null links. The
    // newest case for each importer supplies that importer's progress only.
    for (const importer of c.importersOfRecord) if (belongsToClient(importer)) linked.set(importer.id, { importer });
    for (const onboarding of c.onboardingCases) {
        const candidates = [
            ...onboarding.entities.flatMap(entity => entity.importerOfRecord ? [{ importer: entity.importerOfRecord, entity }] : []),
            ...(onboarding.primaryImporter ? [{ importer: onboarding.primaryImporter, entity: undefined }] : []),
        ];
        for (const candidate of candidates) {
            if (!belongsToClient(candidate.importer)) continue;
            const existing = linked.get(candidate.importer.id);
            if (existing?.onboarding) continue;
            linked.set(candidate.importer.id, { importer: existing?.importer ?? candidate.importer, entity: candidate.entity, onboarding });
        }
    }
    const importers: SetupSummary['importers'] = [...linked.values()].map(({ importer, onboarding, entity }) => {
        const poa = [entity?.poa, importer.powersOfAttorney?.[0]].filter(p => p != null)
            .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
        const bond = entity?.bond ?? importer.bond;
        const active = !!onboarding?.activatedAt || ['active', 'activated'].includes(onboarding?.status ?? '');
        const { checklist } = computeReadiness({
            stepStatus: onboarding?.stepStatus ?? {}, projectedAnnualDutyTaxFee: onboarding?.projectedAnnualDutyTaxFee ?? null,
            primaryImporter: importer,
            fiveOhSixRecords: onboarding?.fiveOhSixRecords?.filter(r => !r.onboardingEntityId || r.onboardingEntityId === entity?.id) ?? [],
            entities: [{ importerNumber: entity?.importerNumber ?? importer.irsEin, importerNumberType: entity?.importerNumberType ?? 'EIN', screeningStatus: entity?.screeningStatus ?? 'pending', bondCoverage: entity?.bondCoverage ?? 'own', poa: poa ?? null, bond: bond ?? null }],
        });
        if (!onboarding && importer.registrationStatus === 'registered') checklist.find(s => s.item === 'five_oh_six')!.status = 'done';
        const steps = checklist.map(s => ({ key: s.item, label: labels[s.item], state: ['done', 'waived'].includes(s.status) ? s.status : 'pending' }));
        steps.push({ key: 'activation', label: 'Activation', state: active ? 'done' : 'pending' });
        return {
            id: importer.id,
            importer: { legalName: importer.name, ein: importer.irsEin ? `••-•••${importer.irsEin.replace(/\D/g, '').slice(-4)}` : 'Not on file', cbpImporterNumber: importer.cbpImporterNumber, registrationStatus: importer.registrationStatus },
            onboardingCaseId: onboarding?.id ?? null,
            onboarding: { status: onboarding?.status ?? 'on_file', path: onboarding?.path ?? null, activatedAt: onboarding?.activatedAt?.toISOString() ?? null, steps, blockers: active || !onboarding ? [] : checklist.filter(s => !['done', 'waived'].includes(s.status)).map(s => publicBlockers[s.item]) },
            bond: bond ? { type: bond.bondType, surety: bond.suretyName, number: bond.bondNumber, amountUsd: Number(bond.bondAmount), activityCode: bond.activityCode, expirationDate: bond.expirationDate?.toISOString() ?? null, status: bond.status } : null,
            poa: poa ? { status: poa.status, executionMethod: poa.executionMethod, signerName: poa.signerName, signedDate: poa.status === 'executed' ? poa.signedDate.toISOString() : null, expirationDate: poa.expirationDate?.toISOString() ?? null, documentId: c.clientDocuments.find(d => d.kind === 'EXECUTED_POA' && d.sourceId === poa.id)?.id ?? null } : null,
            screening: { status: entity?.screeningStatus ?? 'not_recorded', lastRunAt: null },
        };
    }).sort((a, b) => a.importer.legalName.localeCompare(b.importer.legalName) || a.id.localeCompare(b.id));
    const assignedUsers = [...new Set(c.onboardingCases.flatMap(o => o.assignedUserId ? [o.assignedUserId] : []))];
    const team = assignedUsers.length ? await db.accountMembership.findMany({ where: { accountId, userId: { in: assignedUsers }, status: 'ACTIVE', deletedAt: null, user: { deletedAt: null } }, select: { user: { select: { firstName: true, lastName: true, email: true } } } }) : [];
    const allActive = c.onboardingCases.every(o => !!o.activatedAt || ['active', 'activated'].includes(o.status)) && importers.length > 0 && importers.every(i => i.onboarding.steps.find(s => s.key === 'activation')?.state === 'done');
    const steps = [...Object.entries(labels), ['activation', 'Activation']].map(([key, label]) => {
        const states = importers.map(i => i.onboarding.steps.find(s => s.key === key)?.state);
        return { key, label, state: states.length && states.every(s => s === 'waived') ? 'waived' : states.length && states.every(s => s === 'done' || s === 'waived') ? 'done' : 'pending' };
    });
    const latest = c.onboardingCases[0];
    const primaryId = latest?.primaryImporterId ?? latest?.entities[0]?.importerOfRecord?.id;
    const primary = importers.find(i => i.id === primaryId) ?? importers[0];
    return {
        clientId: c.id, clientName: c.name, brokerName: c.account.name, importers,
        onboarding: { status: allActive ? 'active' : latest ? (['active', 'activated'].includes(latest.status) ? 'in_progress' : latest.status) : (importers.length ? 'on_file' : 'not_started'), path: latest?.path ?? null, activatedAt: allActive ? latest?.activatedAt?.toISOString() ?? null : null, steps, blockers: [...new Set(importers.flatMap(i => i.onboarding.blockers))] },
        // Retain the legacy primary fields for existing consumers. New screens
        // render the full importer collection instead of selecting this one.
        importer: primary?.importer ?? null, bond: primary?.bond ?? null, poa: primary?.poa ?? null, screening: primary?.screening ?? { status: 'not_recorded', lastRunAt: null },
        documents: c.clientDocuments.map(d => ({ id: d.id, kind: d.kind, title: d.title, expirationDate: d.expirationDate?.toISOString() ?? null })), stakeholders: c.clientStakeholders,
        brokerTeam: team.map(t => ({ name: [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || 'Your broker', role: 'Assigned broker', email: t.user.email })),
    };
}

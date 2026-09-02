import { db } from '@qubere/db';
import { computeReadiness } from '@qubere/db/services/onboarding-readiness';
import type { SetupSummary } from '@qubere/entry-proof';

export async function loadClientSetup(accountId: string, clientId: string): Promise<SetupSummary | null> {
    if (!db.clientDocument?.findFirst) throw { code: 'PORTAL_SCHEMA_OUTDATED' };
    const c = await db.client.findFirst({
        where: { id: clientId, accountId },
        include: {
            account: { select: { name: true } },
            onboardingCases: {
                where: { status: { not: 'withdrawn' } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 1,
                include: { primaryImporter: true, fiveOhSixRecords: { select: { status: true } }, entities: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { poa: true, bond: true, importerOfRecord: true } } },
            },
            importersOfRecord: { orderBy: { createdAt: 'asc' }, include: { bond: true, powersOfAttorney: { orderBy: { createdAt: 'desc' }, take: 1 } } },
            clientDocuments: { where: { portalVisible: true, status: 'ACTIVE' }, select: { id: true, kind: true, title: true, expirationDate: true, sourceId: true } },
            clientStakeholders: { orderBy: { name: 'asc' }, select: { name: true, role: true, title: true, isSigner: true, loginStatus: true } },
        },
    });
    if (!c) return null;
    const onboarding = c.onboardingCases[0];
    const entity = onboarding?.entities.find(e => e.importerOfRecordId === onboarding.primaryImporterId) ?? onboarding?.entities[0];
    const importer = entity?.importerOfRecord ?? onboarding?.primaryImporter ?? c.importersOfRecord[0];
    const linkedImporter = importer?.id ? c.importersOfRecord.find(i => i.id === importer.id) : c.importersOfRecord[0];
    const bond = entity?.bond ?? linkedImporter?.bond;
    // A later signed upload supersedes an older draft for this same importer.
    const poa = [entity?.poa, linkedImporter?.powersOfAttorney[0]].filter(p => p != null)
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    const entities = onboarding?.entities.map(e => ({ ...e, ...(e === entity ? { poa: poa ?? null, bond: bond ?? null } : {}) })) ?? (importer ? [{
        importerNumber: importer.irsEin, importerNumberType: 'EIN', screeningStatus: 'pending', bondCoverage: 'own', poa: poa ?? null, bond: bond ?? null,
    }] : []);
    const { checklist } = computeReadiness({
        stepStatus: onboarding?.stepStatus ?? {}, entities, fiveOhSixRecords: onboarding?.fiveOhSixRecords ?? [],
        primaryImporter: importer ?? null, projectedAnnualDutyTaxFee: onboarding?.projectedAnnualDutyTaxFee ?? null,
    });
    const labels: Record<string, string> = { legal_entity: 'Company details', five_oh_six: 'Importer registration', poa: 'Power of attorney', bond: 'Customs bond', screening: 'Screening', billing: 'Billing' };
    const steps: SetupSummary['onboarding']['steps'] = checklist.map(s => ({ key: s.item, label: labels[s.item], state: s.status === 'done' || s.status === 'waived' ? s.status : 'pending' }));
    const active = !!onboarding?.activatedAt || ['active', 'activated'].includes(onboarding?.status ?? '');
    steps.push({ key: 'activation', label: 'Activation', state: active ? 'done' : 'pending' });
    const team = onboarding?.assignedUserId ? await db.accountMembership.findFirst({ where: { accountId, userId: onboarding.assignedUserId, status: 'ACTIVE', deletedAt: null, user: { deletedAt: null } }, select: { user: { select: { firstName: true, lastName: true, email: true } } } }) : null;
    // Compute current blockers, not the case's historical JSON. Only public
    // labels are returned; screening evidence and waiver reasons remain private.
    const publicBlockers: Record<string, string> = { legal_entity: 'Company details pending', five_oh_six: 'Importer registration pending', poa: 'POA awaiting signature', bond: 'Bond verification pending', screening: 'Screening review pending', billing: 'Billing setup pending' };
    const blockers = active || !onboarding ? [] : checklist.filter(s => s.status !== 'done' && s.status !== 'waived').map(s => publicBlockers[s.item]);
    return {
        clientId: c.id, clientName: c.name, brokerName: c.account.name,
        onboarding: { status: onboarding?.status ?? 'not_started', path: onboarding?.path ?? null, activatedAt: onboarding?.activatedAt?.toISOString() ?? null, steps, blockers },
        importer: importer ? { legalName: importer.name, ein: importer.irsEin ? `••-•••${importer.irsEin.replace(/\D/g, '').slice(-4)}` : 'Not on file', cbpImporterNumber: importer.cbpImporterNumber, registrationStatus: importer.registrationStatus } : null,
        bond: bond ? { type: bond.bondType, surety: bond.suretyName, number: bond.bondNumber, amountUsd: Number(bond.bondAmount), activityCode: bond.activityCode, expirationDate: bond.expirationDate?.toISOString() ?? null, status: bond.status } : null,
        poa: poa ? { status: poa.status, executionMethod: poa.executionMethod, signerName: poa.signerName, signedDate: poa.status === 'executed' ? poa.signedDate.toISOString() : null, expirationDate: poa.expirationDate?.toISOString() ?? null, documentId: c.clientDocuments.find(d => d.kind === 'EXECUTED_POA' && d.sourceId === poa.id)?.id ?? null } : null,
        screening: { status: entity?.screeningStatus ?? 'pending', lastRunAt: null },
        documents: c.clientDocuments.map(d => ({ id: d.id, kind: d.kind, title: d.title, expirationDate: d.expirationDate?.toISOString() ?? null })),
        stakeholders: c.clientStakeholders,
        brokerTeam: team ? [{ name: [team.user.firstName, team.user.lastName].filter(Boolean).join(' ') || 'Your broker', role: 'Assigned broker', email: team.user.email }] : [],
    };
}

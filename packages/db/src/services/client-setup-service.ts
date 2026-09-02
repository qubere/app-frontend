import { clientInboundEnabled, issueClientInboundAddress } from './inbound-address-service';
import { db } from '../index';
import type { Prisma } from '@prisma/client';
type SetupDb = Prisma.TransactionClient;
const normalizeEmail = (s: string) => s.trim().toLowerCase();
export async function syncClientStakeholder(input: {
    accountId: string;
    clientId: string;
    email: string;
    name: string;
    role: string;
    isSigner?: boolean;
    title?: string | null;
    userId?: string | null;
    invitationId?: string | null;
    loginStatus?: string;
    onboardingEntityId?: string;
    sourceEvent: string;
}, tx: SetupDb = db) {
    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@'))
        return null;
    const { accountId, clientId, name, role, sourceEvent, ...details } = input;
    const existing = await tx.clientStakeholder.findUnique({ where: { clientId_email: { clientId, email } } });
    if (existing?.accountId && existing.accountId !== accountId)
        throw new Error('STAKEHOLDER_ACCOUNT_MISMATCH');
    return tx.clientStakeholder.upsert({ where: { clientId_email: { clientId, email } }, create: { ...input, email }, update: { name: existing?.name || name, title: details.title ?? existing?.title, role: existing?.role || role, isSigner: details.isSigner || existing?.isSigner || false, ...(details.userId ? { userId: details.userId } : {}), ...(details.invitationId ? { invitationId: details.invitationId } : {}), ...(details.loginStatus ? { loginStatus: details.loginStatus } : {}), sourceEvent } });
}
export async function promoteClientDocument(input: {
    accountId: string;
    clientId: string;
    kind: string;
    title: string;
    storageUrl: string;
    sourceModel: string;
    sourceId: string;
    effectiveDate?: Date | null;
    expirationDate?: Date | null;
}, tx: SetupDb = db) {
    const key = { clientId: input.clientId, kind: input.kind, sourceModel: input.sourceModel, sourceId: input.sourceId };
    return tx.clientDocument.upsert({ where: { clientId_kind_sourceModel_sourceId: key }, create: input, update: { storageUrl: input.storageUrl, effectiveDate: input.effectiveDate, expirationDate: input.expirationDate } });
}
/** Re-runnable migration/backfill; no invites or emails are sent. */
export async function syncClientSetup(accountId: string, clientId: string, tx: SetupDb = db) {
    const c = await tx.client.findFirst({ where: { id: clientId, accountId }, include: { onboardingCases: { include: { entities: { include: { poa: { include: { envelope: true } }, bond: { include: { verifications: { orderBy: { performedAt: 'desc' }, take: 1 } } } } }, fiveOhSixRecords: true } }, invitations: { where: { purpose: 'CUSTOMER_PORTAL' }, include: { role: true }, orderBy: { createdAt: 'asc' } }, userAssignments: { include: { user: true } }, importersOfRecord: { include: { powersOfAttorney: { include: { envelope: true } }, bond: { include: { verifications: { orderBy: { performedAt: 'desc' }, take: 1 } } } } } } });
    if (!c)
        throw new Error('CLIENT_NOT_FOUND');
    if (clientInboundEnabled() && !await tx.inboundAddress.findFirst({ where: { accountId, clientId, purpose: "CLIENT_DOCUMENTS" }, select: { id: true } })) await issueClientInboundAddress({ accountId, clientId });
    if (c.contactEmail)
        await syncClientStakeholder({ accountId, clientId, email: c.contactEmail, name: c.contactName || c.contactEmail, role: 'CUSTOMS_CONTACT', sourceEvent: 'CLIENT_CONTACT' }, tx);
    if (c.billingContactEmail)
        await syncClientStakeholder({ accountId, clientId, email: c.billingContactEmail, name: c.billingContactName || c.billingContactEmail, role: 'BILLING_CONTACT', sourceEvent: 'CLIENT_CONTACT' }, tx);
    for (const invitation of c.invitations) {
        const assignment = c.userAssignments.find(a => normalizeEmail(a.user.email) === normalizeEmail(invitation.email));
        const loginStatus = invitation.status === 'REVOKED' ? 'DISABLED' : invitation.status === 'ACCEPTED' && assignment && !assignment.user.deletedAt ? 'ACTIVE' : invitation.status === 'PENDING' && invitation.expiresAt > new Date() ? 'INVITED' : 'NOT_INVITED';
        await syncClientStakeholder({ accountId, clientId, email: invitation.email, name: assignment ? [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(' ') || invitation.email : invitation.email, role: invitation.role.name === 'CUSTOMER_ADMIN' ? 'IMPORTER_ADMIN' : invitation.role.name === 'CUSTOMER_VIEWER' ? 'VIEWER' : 'CUSTOMS_CONTACT', loginStatus, userId: assignment?.userId, invitationId: invitation.id, sourceEvent: 'PORTAL_INVITE' }, tx);
    }
    for (const importer of c.importersOfRecord) {
        const bond = importer.bond;
        if (!bond || !['verified', 'attested'].includes(bond.status))
            continue;
        let docId: string | undefined;
        try {
            docId = bond.verifications[0]?.responseRaw ? JSON.parse(bond.verifications[0].responseRaw).suretyLetterDocumentId : undefined;
        }
        catch { }
        if (docId) {
            const document = await tx.shipmentDocument.findFirst({ where: { id: docId, accountId, clientId }, select: { fileUrl: true } });
            if (document?.fileUrl)
                await promoteClientDocument({ accountId, clientId, kind: 'BOND', title: `Bond ${bond.bondNumber}`, storageUrl: document.fileUrl, sourceModel: 'Bond', sourceId: bond.id, effectiveDate: bond.effectiveDate, expirationDate: bond.expirationDate }, tx);
        }
    }
    const poas = new Map(c.importersOfRecord.flatMap(i => i.powersOfAttorney).map(p => [p.id, p]));
    for (const onboarding of c.onboardingCases) {
        for (const e of onboarding.entities) {
            if (e.poa)
                poas.set(e.poa.id, e.poa);
            const officers = Array.isArray(e.officers) ? e.officers : [];
            for (const raw of officers) {
                if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                    continue;
                const o = raw as Record<string, unknown>;
                if (typeof o.email === 'string')
                    await syncClientStakeholder({ accountId, clientId, email: o.email, name: typeof o.name === 'string' ? o.name : o.email, title: typeof o.title === 'string' ? o.title : null, role: 'OFFICER_SIGNER', isSigner: true, onboardingEntityId: e.id, sourceEvent: 'ONBOARDING_OFFICER' }, tx);
            }
            if (e.bond && ['verified', 'attested'].includes(e.bond.status)) {
                const verification = e.bond.verifications[0];
                let docId: string | undefined;
                try {
                    docId = verification?.responseRaw ? JSON.parse(verification.responseRaw).suretyLetterDocumentId : undefined;
                }
                catch { }
                if (docId) {
                    const doc = await tx.shipmentDocument.findFirst({ where: { id: docId, accountId, clientId }, select: { fileUrl: true } });
                    if (doc?.fileUrl)
                        await promoteClientDocument({ accountId, clientId, kind: 'BOND', title: `Bond ${e.bond.bondNumber}`, storageUrl: doc.fileUrl, sourceModel: 'Bond', sourceId: e.bond.id, effectiveDate: e.bond.effectiveDate, expirationDate: e.bond.expirationDate }, tx);
                }
            }
        }
        for (const r of onboarding.fiveOhSixRecords) {
            if (r.status === 'accepted' && r.pdfDocumentUrl)
                await promoteClientDocument({ accountId, clientId, kind: 'FORM_5106', title: 'Accepted CBP Form 5106', storageUrl: r.pdfDocumentUrl, sourceModel: 'FiveOhSixRecord', sourceId: r.id, effectiveDate: r.acceptedAt }, tx);
        }
    }
    for (const p of poas.values()) {
        if (p.status === 'executed') {
            const url = p.executedDocumentUrl || p.envelope?.executedDocumentUrl;
            if (url)
                await promoteClientDocument({ accountId, clientId, kind: 'EXECUTED_POA', title: 'Executed Power of Attorney', storageUrl: url, sourceModel: 'PowerOfAttorney', sourceId: p.id, effectiveDate: p.signedDate, expirationDate: p.expirationDate }, tx);
            const email = p.signerEmail || p.envelope?.signerEmail;
            if (email)
                await syncClientStakeholder({ accountId, clientId, email, name: p.signerName || p.envelope?.signerName || email, title: p.signerTitle, role: 'OFFICER_SIGNER', isSigner: true, sourceEvent: 'POA_SIGNED' }, tx);
        }
        else if (['revoked', 'expired'].includes(p.status))
            await tx.clientDocument.updateMany({ where: { accountId, clientId, sourceModel: 'PowerOfAttorney', sourceId: p.id }, data: { status: 'REVOKED', portalVisible: false } });
    }
}

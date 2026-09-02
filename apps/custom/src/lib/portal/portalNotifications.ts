import { db, runWithDataMode, runWithAccountId } from '@/lib/db';
import { syncClientSetup } from './clientSetup';
import { escapeHtml } from '@/modules/compliance/notifications/templates/escapeHtml';
import type { RenderedEmail } from '@/modules/compliance/notifications/templates/types';
const COPY: Record<string, string> = { POA_SIGNED: 'Your Power of Attorney has been signed.', FORM_5106_ACCEPTED: 'Your importer registration has been accepted.', ACCOUNT_ACTIVATED: 'Your importer setup is active.', ENTRY_PROOF_PUBLISHED: 'A new Entry Proof is available.', ETA_CHANGED: 'Your shipment arrival estimate has slipped by more than 24 hours.', CUSTOMS_RELEASED: 'Customs has released your shipment.', HOLD_PLACED: 'An agency hold has been placed on your shipment.', DOCUMENT_REQUESTED: 'Your broker has requested a document.', INVOICE_ISSUED: 'A new invoice is available.' };
export function renderPortalEmail(value: unknown): RenderedEmail {
    const p = value as {
        type: string;
        href: string;
        inboundAddress?: string;
    };
    if (!p || !COPY[p.type] || typeof p.href !== 'string' || !p.href.startsWith('/') || p.href.startsWith('//') || p.href.includes('\\'))
        throw new Error('Invalid portal notification');
    const url = new URL(p.href, process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3002').toString();
    const message = COPY[p.type] + (p.type === "ACCOUNT_ACTIVATED" && p.inboundAddress ? ` Send documents to ${p.inboundAddress}.` : "");
    return { subject: message, text: message + '\n' + url, html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url)}">Open your portal</a></p>` };
}
export async function queuePortalUpdate(accountId: string, clientId: string, type: string, sourceId: string, href: string) {
    if (!COPY[type])
        throw new Error('Unknown portal notification');
    const inbox = type === "ACCOUNT_ACTIVATED" && process.env.INBOUND_CLIENT_ADDRESSES_ENABLED === "true" ? await db.inboundAddress.findFirst({ where: { accountId, clientId, status: "ACTIVE", purpose: "CLIENT_DOCUMENTS" }, select: { address: true } }) : null;
    const recipients = await db.clientStakeholder.findMany({ where: { accountId, clientId, loginStatus: 'ACTIVE', userId: { not: null }, user: { deletedAt: null } } });
    for (const recipient of recipients) {
        const prefs = (recipient.notifyPrefs ?? {}) as Record<string, unknown>;
        if (prefs[type] === false)
            continue;
        const membership = await db.accountMembership.findFirst({ where: { accountId, userId: recipient.userId!, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
        const assignment = await db.userClientAssignment.findUnique({ where: { userId_clientId: { userId: recipient.userId!, clientId } }, select: { id: true } });
        if (!membership || !assignment)
            continue;
        const portalEventKey = `${accountId}:${clientId}:${type}:${sourceId}:${recipient.id}`;
        await db.$transaction(async (tx) => {
            const queued = await tx.complianceNotification.upsert({ where: { portalEventKey }, update: {}, create: { accountId, notificationType: 'PORTAL_UPDATE', portalEventKey, recipients: prefs.email === false ? [] : [recipient.email], payload: { type, href, ...(inbox ? { inboundAddress: inbox.address } : {}) }, deliveryStatus: prefs.email === false ? 'SUPPRESSED' : 'PENDING', queuedAt: new Date() } });
            await tx.$queryRaw `SELECT id FROM "ComplianceNotification" WHERE id = ${queued.id} FOR UPDATE`;
            const current = await tx.complianceNotification.findUniqueOrThrow({ where: { id: queued.id } });
            if (!current.bellDeliveredAt && prefs.portal !== false) {
                await tx.notification.create({ data: { accountId, userId: recipient.userId!, type, message: COPY[type] + (inbox ? ` Send documents to ${inbox.address}.` : ""), entityType: 'PortalUpdate', entityId: clientId } });
                await tx.complianceNotification.update({ where: { id: queued.id }, data: { bellDeliveredAt: new Date() } });
            }
        });
    }
}
/** Reconcile committed source transitions with a durable cursor. Retry is idempotent.
 * Runs inside the existing authenticated notification cron; never sends from seeds.
 */
export async function syncPortalNotifications() {
    return runWithDataMode(null, () => runWithAccountId(null, async () => {
        const accounts = await db.clientStakeholder.findMany({ where: { loginStatus: 'ACTIVE' }, select: { accountId: true }, distinct: ['accountId'] });
        for (const { accountId } of accounts)
            await runWithAccountId(accountId, async () => {
                const checkpoint = await db.auditLog.findFirst({ where: { accountId, action: 'PORTAL_NOTIFICATION_SYNC' }, orderBy: { createdAt: 'desc' }, select: { metadata: true } });
                const previous = (checkpoint?.metadata as {
                    through?: string;
                } | null)?.through;
                const since = previous ? new Date(previous) : new Date(0);
                const through = new Date();
                const window = { gt: since, lte: through };
                const [proofs, etas, holds, filings, requests, invoices, cases, poas, forms] = await Promise.all([
                    db.entryProof.findMany({ where: { accountId, status: 'PUBLISHED', publishedAt: window }, select: { id: true, clientId: true, filingId: true } }),
                    db.etaObservation.findMany({ where: { accountId, createdAt: window, deltaMinutes: { gt: 1440 } }, include: { shipment: { select: { clientId: true } } } }),
                    db.pgaHold.findMany({ where: { accountId, createdAt: window }, include: { shipment: { select: { clientId: true } } } }),
                    db.customsFiling.findMany({ where: { accountId, releasedAt: window, customerVisibleAt: { not: null } }, include: { shipment: { select: { clientId: true } } } }),
                    db.customerRequest.findMany({ where: { accountId, type: 'DOCUMENT', createdAt: window }, select: { id: true, clientId: true } }),
                    db.invoice.findMany({ where: { accountId, status: { in: ['SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'] }, updatedAt: window }, select: { id: true, clientId: true } }),
                    db.onboardingCase.findMany({ where: { accountId, updatedAt: window, clientId: { not: null } }, select: { id: true, clientId: true, activatedAt: true } }),
                    db.powerOfAttorney.findMany({ where: { accountId, status: 'executed', updatedAt: window }, include: { importerOfRecord: { select: { clientId: true } } } }),
                    db.fiveOhSixRecord.findMany({ where: { accountId, status: 'accepted', updatedAt: window }, include: { case: { select: { clientId: true } } } }),
                ]);
                for (const p of proofs)
                    await queuePortalUpdate(accountId, p.clientId, 'ENTRY_PROOF_PUBLISHED', p.id, `/entries/${p.filingId}`);
                for (const e of etas)
                    if (e.shipment.clientId)
                        await queuePortalUpdate(accountId, e.shipment.clientId, 'ETA_CHANGED', e.id, `/shipments/${e.shipmentId}`);
                for (const h of holds)
                    if (h.shipment.clientId)
                        await queuePortalUpdate(accountId, h.shipment.clientId, 'HOLD_PLACED', h.id, `/shipments/${h.shipmentId}`);
                for (const f of filings)
                    if (f.shipment?.clientId)
                        await queuePortalUpdate(accountId, f.shipment.clientId, 'CUSTOMS_RELEASED', f.id, `/shipments/${f.shipmentId}`);
                for (const r of requests)
                    await queuePortalUpdate(accountId, r.clientId, 'DOCUMENT_REQUESTED', r.id, `/requests/${r.id}`);
                for (const i of invoices)
                    if (i.clientId)
                        await queuePortalUpdate(accountId, i.clientId, 'INVOICE_ISSUED', i.id, '/invoices');
                for (const c of cases)
                    if (c.clientId) {
                        await syncClientSetup(accountId, c.clientId);
                        if (c.activatedAt)
                            await queuePortalUpdate(accountId, c.clientId, 'ACCOUNT_ACTIVATED', c.id, '/setup');
                    }
                for (const p of poas)
                    if (p.importerOfRecord.clientId) {
                        await syncClientSetup(accountId, p.importerOfRecord.clientId);
                        await queuePortalUpdate(accountId, p.importerOfRecord.clientId, 'POA_SIGNED', p.id, '/setup');
                    }
                for (const f of forms)
                    if (f.case?.clientId) {
                        await syncClientSetup(accountId, f.case.clientId);
                        await queuePortalUpdate(accountId, f.case.clientId, 'FORM_5106_ACCEPTED', f.id, '/setup');
                    }
                await db.auditLog.create({ data: { accountId, action: 'PORTAL_NOTIFICATION_SYNC', entity: 'Account', entityId: accountId, metadata: { through: through.toISOString() }, source: 'SYSTEM' } });
            });
    }));
}

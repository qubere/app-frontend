import { db } from '@/lib/db';
import { notifyAccountRoleHolders } from '@/modules/notifications/notifyAccount';

export async function summarizeInboundReceipt(accountId: string, emailId: string) {
  const email = await db.inboundEmail.findFirst({ where: { id: emailId, accountId }, include: { client: { select: { name: true } }, attachments: { include: { shipmentDocument: { select: { shipmentId: true, portalVisibility: true, status: true, shipment: { select: { shipmentNumber: true } } } } } }, reviews: { where: { status: 'OPEN' }, select: { id: true } } } });
  if (!email?.inboundAddressId) return;
  const docs = email.attachments.flatMap(a => a.shipmentDocument && a.shipmentDocument.status !== 'DISCARDED' ? [a.shipmentDocument] : []);
  const attached = docs.filter(d => d.shipmentId).length;
  // Reconcile the envelope after the last broker decision without releasing a held email.
  if (docs.length) await db.inboundEmail.updateMany({ where: { id: email.id, accountId, routingStatus: { in: ['ACCEPTED', 'NEEDS_REVIEW'] } }, data: { routingStatus: email.reviews.length ? 'NEEDS_REVIEW' : 'ACCEPTED' } });
  const message = `${docs.length} documents from ${email.client?.name || 'operations inbox'} — ${attached} attached, ${email.reviews.length} need review${docs.length > attached + email.reviews.length ? ', remaining documents processing' : ''}.`;
  await notifyAccountRoleHolders({ accountId, permission: 'document.update', type: 'INBOUND_EMAIL_DOCUMENTS', message, entityType: 'InboundEmail', entityId: email.id, dedupe: true });
  await db.notification.updateMany({ where: { accountId, entityType: 'InboundEmail', entityId: email.id, type: 'INBOUND_EMAIL_DOCUMENTS' }, data: { message } });
  if (!email.clientId) return;
  const visible = docs.filter(d => d.portalVisibility === 'CUSTOMER');
  if (!visible.length) return;
  const numbers = [...new Set(visible.flatMap(d => d.shipment?.shipmentNumber ? [d.shipment.shipmentNumber] : []))];
  const portalMessage = `We received ${visible.length} document${visible.length === 1 ? '' : 's'}${numbers.length ? ` for ${numbers.join(', ')}` : ''}. ${email.reviews.length ? 'Your broker is reviewing them.' : attached < visible.length ? 'Shipment matching is in progress.' : 'They are available in Documents.'}`;
  const members = await db.accountMembership.findMany({ where: { accountId, status: 'ACTIVE', deletedAt: null, roles: { some: { role: { rolePermissions: { some: { permission: { name: 'portal.documents.read' } } } } } } }, select: { userId: true } });
  for (const { userId } of members) await db.notification.upsert({ where: { id: `inbound-${email.id}-${userId}` }, create: { id: `inbound-${email.id}-${userId}`, accountId, userId, type: 'INBOUND_EMAIL_RECEIVED', entityType: 'PortalUpdate', entityId: email.clientId, message: portalMessage }, update: { message: portalMessage } });
}

import { db } from '@qubere/db';
import type { Prisma } from '@prisma/client';
import { documentClientWhere, loadImporterOwners } from './client-ownership';

type Cursor = { at: string; id: string; kind: 'C' | 'S' };
export function decodeDocumentCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const c = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (typeof c.at !== 'string' || !Number.isFinite(Date.parse(c.at)) || typeof c.id !== 'string' || !c.id || !['C', 'S'].includes(c.kind)) throw new Error();
    return c;
  } catch { throw new Error('INVALID_CURSOR'); }
}
function afterCursor(cursor: Cursor | null, kind: 'C' | 'S') {
  if (!cursor) return {};
  const at = new Date(cursor.at);
  return { OR: [{ createdAt: { lt: at } }, ...(kind <= cursor.kind ? [{ createdAt: at, ...(kind === cursor.kind ? { id: { lt: cursor.id } } : {}) }] : [])] };
}
const userSelect = { firstName: true, lastName: true, email: true } as const;

export async function loadDocumentPage(input: { accountId: string; clientIds: string[] | null; limit: number; cursor: Cursor | null; shipmentId: string; docType: string; includeSetup: boolean; canDelete: boolean }) {
  const { accountId, clientIds, limit, cursor, shipmentId, docType } = input;
  const owners = await loadImporterOwners(accountId, clientIds);
  const [shipmentDocuments, clientDocuments] = await Promise.all([
    db.shipmentDocument.findMany({
      where: { AND: [documentClientWhere(accountId, clientIds, owners), afterCursor(cursor, 'S')], ...(shipmentId ? { shipmentId } : {}), ...(docType ? { docType } : {}) },
      take: limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, fileName: true, docType: true, byteSize: true, mimeType: true, source: true, status: true, shipmentId: true, createdAt: true,
        shipment: { select: { id: true, shipmentNumber: true } },
        inboundAttachment: { select: { inboundEmail: { select: { accountId: true, normalizedFromAddress: true } } } },
      },
    }),
    input.includeSetup && !shipmentId ? db.clientDocument.findMany({
      where: { accountId, ...(clientIds === null ? {} : { clientId: { in: clientIds } }), status: 'ACTIVE', ...(docType ? { kind: docType } : {}), ...afterCursor(cursor, 'C') },
      take: limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, kind: true, contentType: true, sourceModel: true, sourceId: true, createdAt: true },
    }) : [],
  ]);
  const rows = [
    ...shipmentDocuments.map(d => ({ kind: 'S' as const, id: d.id, createdAt: d.createdAt, model: 'ShipmentDocument', sourceId: d.id,
      fileName: d.fileName, docType: d.docType, byteSize: d.byteSize, mimeType: d.mimeType, source: d.source,
      status: d.status === 'Received' ? 'Ready' : d.status, shipmentId: d.shipmentId, shipmentNumber: d.shipment?.shipmentNumber ?? null,
      sender: d.inboundAttachment?.inboundEmail.accountId === accountId ? d.inboundAttachment.inboundEmail.normalizedFromAddress : null,
      downloadUrl: `/api/documents/${d.id}/download`, canDelete: input.canDelete && d.source === 'PORTAL_UPLOAD' && !d.shipmentId,
    })),
    ...clientDocuments.map(d => ({ kind: 'C' as const, id: d.id, createdAt: d.createdAt, model: d.sourceModel, sourceId: d.sourceId,
      fileName: d.title, docType: d.kind, byteSize: null, mimeType: d.contentType, source: 'CLIENT_SETUP', status: 'Ready', shipmentId: null, shipmentNumber: null, sender: null,
      downloadUrl: `/api/setup/documents/${d.id}/download`, canDelete: false,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.kind === b.kind ? (a.id === b.id ? 0 : a.id < b.id ? 1 : -1) : a.kind < b.kind ? 1 : -1));
  const page = rows.slice(0, limit);
  const auditWhere: Prisma.AuditLogWhereInput[] = page.flatMap(d => d.model && d.sourceId ? [{ entity: d.model, entityId: d.sourceId }] : []);
  // An assignee can change; uploader attribution comes only from upload audit
  // events or the original inbound sender, never the document's current owner.
  const audits = auditWhere.length ? await db.auditLog.findMany({
    where: { accountId, success: true, action: { in: ['DOCUMENT_UPLOADED', 'CUSTOMER_PORTAL_DOCUMENT_UPLOAD', 'POA_EXECUTED', 'poa.create'] }, OR: auditWhere },
    distinct: ['entity', 'entityId'], orderBy: { createdAt: 'asc' },
    select: { entity: true, entityId: true, user: { select: userSelect }, actorUser: { select: userSelect } },
  }) : [];
  const uploadedBy = new Map(audits.map(a => { const u = a.actorUser ?? a.user; return [`${a.entity}:${a.entityId}`, u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : null]; }));
  const last = page.at(-1);
  return {
    items: page.map(({ model, sourceId, sender, kind, ...d }) => ({ ...d, key: `${kind}:${d.id}`, uploadedBy: sender || uploadedBy.get(`${model}:${sourceId}`) || null })),
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id, kind: last.kind })).toString('base64url') : null,
  };
}

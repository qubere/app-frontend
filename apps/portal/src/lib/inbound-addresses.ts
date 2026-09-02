import { db } from '@qubere/db';
export async function loadInboundAddresses(accountId: string, clientIds: string[] | null) {
  if (process.env.INBOUND_CLIENT_ADDRESSES_ENABLED !== 'true') return [];
  return db.inboundAddress.findMany({ where: { accountId, clientId: clientIds === null ? { not: null } : { in: clientIds }, status: 'ACTIVE', purpose: 'CLIENT_DOCUMENTS' }, select: { address: true, purpose: true, clientId: true, client: { select: { name: true } } }, orderBy: { client: { name: 'asc' } }, take: 200 });
}

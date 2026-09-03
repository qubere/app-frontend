import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { db, withDataModeContext } from '../index';

export const clientInboundEnabled = () => process.env.INBOUND_CLIENT_ADDRESSES_ENABLED === 'true';
export type SenderPolicy = 'OPEN' | 'ALLOWLIST' | 'REVIEW';
export type AddressPurpose = 'CLIENT_DOCUMENTS' | 'ACCOUNT_OPS' | 'ONBOARDING';
type AddressInput = { accountId: string; clientId?: string | null; label?: string; createdByUserId?: string; purpose?: AddressPurpose; senderPolicy?: SenderPolicy };
type Address = { status: string; graceUntil: Date | null };

export function generateInboundToken(): string {
  const size = Number(process.env.INBOUND_ADDRESS_TOKEN_BYTES || 10);
  if (!Number.isInteger(size) || size < 10 || size > 24) throw new Error('INBOUND_ADDRESS_TOKEN_BYTES must be between 10 and 24');
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, token = '';
  for (const byte of randomBytes(size)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; token += alphabet[(value >>> bits) & 31]; }
  }
  if (bits) token += alphabet[(value << (5 - bits)) & 31];
  return token;
}

export function normalizeInboundRecipient(raw: string): string {
  const address = (raw.match(/<([^<>]+)>/)?.[1] ?? raw).trim().toLowerCase();
  const parts = address.split('@');
  return parts.length === 2 ? `${parts[0].split('+')[0]}@${parts[1]}` : '';
}

export function acceptsInboundAddress(address: Address, now = new Date()): boolean {
  return address.status === 'ACTIVE' || (address.status === 'SUSPENDED' && !!address.graceUntil && address.graceUntil > now);
}

export function evaluateSenderPolicy(policy: string, statuses: string[], approved = false) {
  if (statuses.includes('BLOCKED')) return 'REJECT' as const;
  if (approved || statuses.includes('ACTIVE') || policy === 'OPEN') return 'ACCEPT' as const;
  return policy === 'ALLOWLIST' ? 'HOLD' as const : 'REVIEW' as const;
}

const keyFor = (p: AddressInput) => `${p.accountId}:${p.clientId ?? ''}:${p.purpose ?? (p.clientId ? 'CLIENT_DOCUMENTS' : 'ACCOUNT_OPS')}`;
const domain = () => {
  const value = (process.env.INBOUND_EMAIL_DOMAIN || 'inbound.qubere.ai').trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) throw new Error('Invalid INBOUND_EMAIL_DOMAIN');
  return value;
};
const audit = (tx: Prisma.TransactionClient, accountId: string, entityId: string, action: string, userId?: string, detail?: Prisma.InputJsonValue) =>
  tx.auditLog.create({ data: { accountId, entity: 'InboundAddress', entityId, action: `inbound_address.${action}`, source: userId ? 'UI' : 'SYSTEM', userId, newValue: detail } });

export async function issueClientInboundAddressInTransaction(tx: Prisma.TransactionClient, p: AddressInput) {
  if (p.clientId && !await tx.client.findFirst({ where: { id: p.clientId, accountId: p.accountId }, select: { id: true } })) throw new Error('CLIENT_NOT_FOUND');
  const activeKey = keyFor(p);
  const existing = await tx.inboundAddress.findUnique({ where: { activeKey } });
  if (existing) return existing;
  const token = generateInboundToken();
  const address = await tx.inboundAddress.create({ data: { ...p, clientId: p.clientId ?? null, purpose: p.purpose ?? (p.clientId ? 'CLIENT_DOCUMENTS' : 'ACCOUNT_OPS'), activeKey, token, address: `docs-${token}@${domain()}` } });
  await audit(tx, p.accountId, address.id, 'issued', p.createdByUserId, { clientId: p.clientId ?? null, purpose: address.purpose });
  return address;
}

export async function issueClientInboundAddress(p: AddressInput, database: PrismaClient = db) {
  try { return await database.$transaction(tx => issueClientInboundAddressInTransaction(tx, p)); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await database.inboundAddress.findUnique({ where: { activeKey: keyFor(p) } });
      if (winner) return winner;
    }
    throw error;
  }
}

export async function resolveInboundAddress(raw: string) {
  const address = normalizeInboundRecipient(raw);
  if (!address) return null;
  // The signed webhook has no tenant until the recipient has been resolved.
  return withDataModeContext(null, () => db.inboundAddress.findUnique({ where: { address } }));
}

export async function changeInboundAddress(accountId: string, id: string, action: 'SUSPEND' | 'RESUME' | 'REVOKE' | 'ROTATE' | 'POLICY', userId: string, options: { senderPolicy?: SenderPolicy; autoReplyEnabled?: boolean } = {}) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "InboundAddress" WHERE id = ${id} AND "accountId" = ${accountId} FOR UPDATE`;
    const old = await tx.inboundAddress.findFirst({ where: { id, accountId } });
    if (!old) throw new Error('ADDRESS_NOT_FOUND');
    if (old.status === 'REVOKED' || (!old.activeKey && action !== 'REVOKE')) throw new Error('ADDRESS_NO_LONGER_CURRENT');
    if (action === 'ROTATE') {
      const graceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tx.inboundAddress.update({ where: { id }, data: { activeKey: null, status: 'SUSPENDED', graceUntil } });
      const next = await issueClientInboundAddressInTransaction(tx, { accountId, clientId: old.clientId, label: old.label ?? undefined, createdByUserId: userId, purpose: old.purpose as AddressPurpose, senderPolicy: old.senderPolicy as SenderPolicy });
      await tx.inboundAddress.update({ where: { id: next.id }, data: { autoReplyEnabled: old.autoReplyEnabled, defaultAssignedToUserId: old.defaultAssignedToUserId } });
      await audit(tx, accountId, id, 'rotated', userId, { replacementId: next.id, graceUntil: graceUntil.toISOString() });
      return next;
    }
    const data = action === 'POLICY' ? options : action === 'REVOKE' ? { status: 'REVOKED', activeKey: null, graceUntil: null, revokedAt: new Date() } : { status: action === 'RESUME' ? 'ACTIVE' : 'SUSPENDED', graceUntil: null };
    const address = await tx.inboundAddress.update({ where: { id }, data });
    await audit(tx, accountId, id, action.toLowerCase(), userId, { previousStatus: old.status, status: address.status, senderPolicy: address.senderPolicy, autoReplyEnabled: address.autoReplyEnabled });
    return address;
  });
}

export const revokeInboundAddress = (p: { accountId: string; id: string; userId: string }) => changeInboundAddress(p.accountId, p.id, 'REVOKE', p.userId);
export const rotateInboundAddress = (p: { accountId: string; id: string; userId: string }) => changeInboundAddress(p.accountId, p.id, 'ROTATE', p.userId);

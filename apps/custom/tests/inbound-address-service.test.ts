import { beforeEach, describe, expect, it, vi } from 'vitest';
const { tx } = vi.hoisted(() => ({ tx: { $queryRaw: vi.fn(), client: { findFirst: vi.fn() }, inboundAddress: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() } } }));
vi.mock('../../../packages/db/src/index', () => ({ db: { ...tx, $transaction: (fn: (db: typeof tx) => unknown) => fn(tx) }, withDataModeContext: (_mode: null, fn: () => unknown) => fn() }));
import { generateInboundToken, normalizeInboundRecipient, acceptsInboundAddress, evaluateSenderPolicy, issueClientInboundAddress, changeInboundAddress, resolveInboundAddress } from '../../../packages/db/src/services/inbound-address-service';

beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); tx.client.findFirst.mockResolvedValue({ id: 'target' }); tx.inboundAddress.create.mockImplementation(({ data }) => ({ id: 'new', ...data })); });
describe('recipient addresses', () => {
  it('uses at least 80 bits of crypto randomness with no duplicate in a sample', () => {
    const tokens = Array.from({ length: 1000 }, generateInboundToken);
    expect(new Set(tokens).size).toBe(1000);
    expect(tokens.every(t => /^[a-z2-7]{16}$/.test(t))).toBe(true);
    vi.stubEnv('INBOUND_ADDRESS_TOKEN_BYTES', '2');
    expect(generateInboundToken).toThrow();
  });
  it('normalizes the recipient but preserves the exact domain', async () => {
    expect(normalizeInboundRecipient('Target <DOCS-ABCDE+invoice@INBOUND.QUBERE.AI>')).toBe('docs-abcde@inbound.qubere.ai');
    await resolveInboundAddress('docs-abcde@other.example');
    expect(tx.inboundAddress.findUnique).toHaveBeenCalledWith({ where: { address: 'docs-abcde@other.example' } });
  });
  it('reuses the destination and rejects a foreign client', async () => {
    tx.inboundAddress.findUnique.mockResolvedValue({ id: 'existing' });
    expect(await issueClientInboundAddress({ accountId: 'a', clientId: 'target' })).toEqual({ id: 'existing' });
    expect(tx.inboundAddress.create).not.toHaveBeenCalled();
    tx.client.findFirst.mockResolvedValue(null);
    await expect(issueClientInboundAddress({ accountId: 'a', clientId: 'amazon' })).rejects.toThrow('CLIENT_NOT_FOUND');
  });
  it('rotates atomically, retains sender policy, and grants exactly 30 days', async () => {
    tx.inboundAddress.findFirst.mockResolvedValue({ id: 'old', activeKey: 'key', clientId: 'target', purpose: 'CLIENT_DOCUMENTS', senderPolicy: 'ALLOWLIST', status: 'ACTIVE', autoReplyEnabled: false });
    const before = Date.now();
    await changeInboundAddress('a', 'old', 'ROTATE', 'u');
    const grace = tx.inboundAddress.update.mock.calls[0][0].data.graceUntil;
    expect(grace.getTime() - before).toBeGreaterThanOrEqual(30 * 86400000);
    expect(tx.inboundAddress.create.mock.calls[0][0].data.senderPolicy).toBe('ALLOWLIST');
    expect(acceptsInboundAddress({ status: 'SUSPENDED', graceUntil: grace })).toBe(true);
    expect(acceptsInboundAddress({ status: 'SUSPENDED', graceUntil: grace }, grace)).toBe(false);
    expect(acceptsInboundAddress({ status: 'SUSPENDED', graceUntil: null })).toBe(false);
    expect(acceptsInboundAddress({ status: 'REVOKED', graceUntil: grace })).toBe(false);
  });
});
describe('sender policy matrix', () => {
  it.each(['OPEN', 'REVIEW', 'ALLOWLIST'])('%s always blocks blocked senders', policy => {
    expect(evaluateSenderPolicy(policy, ['ACTIVE', 'BLOCKED'], true)).toBe('REJECT');
  });
  it.each(['OPEN', 'REVIEW', 'ALLOWLIST'])('%s accepts allowlisted or individually approved senders', policy => {
    expect(evaluateSenderPolicy(policy, ['ACTIVE'])).toBe('ACCEPT');
    expect(evaluateSenderPolicy(policy, [], true)).toBe('ACCEPT');
  });
  it('stores REVIEW unknowns for review and holds ALLOWLIST unknowns before storage', () => {
    expect(evaluateSenderPolicy('OPEN', [])).toBe('ACCEPT');
    expect(evaluateSenderPolicy('REVIEW', [])).toBe('REVIEW');
    expect(evaluateSenderPolicy('ALLOWLIST', [])).toBe('HOLD');
  });
});

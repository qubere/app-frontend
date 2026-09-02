/** Dry run by default. No email is sent and no files are stored. */
import { parseArgs } from 'node:util';
import { db, withDataModeContext } from '@qubere/db';
import { issueClientInboundAddress } from '@qubere/db/services/inbound-address-service';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
const { values } = parseArgs({ options: { 'account-id': { type: 'string' }, apply: { type: 'boolean', default: false }, help: { type: 'boolean' } } });
async function main() {
  if (values.help) { console.log('backfill:inbound-addresses -- --account-id <id> [--apply]. Dry-run by default; omit account-id to enumerate all accounts. Sends no email.'); return; }
  await withDataModeContext(null, async () => {
    const accounts = await db.account.findMany({ where: { deletedAt: null, ...(values['account-id'] ? { id: values['account-id'] } : {}) }, select: { id: true, name: true }, orderBy: { id: 'asc' } });
    for (const account of accounts) {
      const clients = await db.client.findMany({ where: { accountId: account.id }, select: { id: true, name: true } });
      for (const client of [null, ...clients]) {
        const purpose = client ? 'CLIENT_DOCUMENTS' : 'ACCOUNT_OPS';
        const current = await db.inboundAddress.findFirst({ where: { accountId: account.id, clientId: client?.id ?? null, purpose, activeKey: { not: null } }, select: { address: true, status: true } });
        const address = current || (values.apply ? await issueClientInboundAddress({ accountId: account.id, clientId: client?.id, label: client?.name ?? 'Operations inbox' }) : null);
        console.log(JSON.stringify({ account: account.name, client: client?.name ?? 'Operations inbox', action: current ? 'EXISTS' : values.apply ? 'CREATED' : 'WOULD_CREATE', address: address?.address, status: address?.status }));
      }
    }
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());

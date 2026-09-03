/** Synthetic emails through the real scanner/storage/worker; no provider calls or outbound mail. */
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { db, withDataModeContext, runWithAccountId } from '@qubere/db';
import { assertDemoSeedingAllowed } from '../src/lib/environment';
import { issueClientInboundAddress } from '@qubere/db/services/inbound-address-service';
import { createInboundSenderRoute } from '../src/modules/inbound/senderRouting';
import { runInboundEmailWorkerTick, type InboundEmailProvider } from '../src/modules/documents/processing/inboundEmailWorker';
import { routeParsedInboundDocument } from '../src/modules/inbound/inboundDocumentRouting';
loadEnvConfig(process.cwd());
const { values } = parseArgs({ options: { 'account-id': { type: 'string' }, help: { type: 'boolean' } } });
async function main() {
  if (values.help) { console.log('seed:inbound-email -- --account-id <DEMO/SANDBOX account from seed-partner-portal-demo>. Requires storage and scanner configuration; uses three synthetic fixture PDFs, never sends email.'); return; }
  assertDemoSeedingAllowed();
  if (!values['account-id']) throw new Error('--account-id is required');
  await withDataModeContext(null, async () => {
    const account = await db.account.findFirst({ where: { id: values['account-id'], ...(process.env.ALLOW_DEMO_SEEDING === 'true' ? {} : { dataMode: { in: ['DEMO', 'SANDBOX'] } }), deletedAt: null } });
    if (!account) throw new Error('Choose a DEMO or SANDBOX account');
    await runWithAccountId(account.id, async () => {
      const target = await db.client.findFirst({ where: { accountId: account.id, name: 'Target Corporation' } });
      const amazon = await db.client.findFirst({ where: { accountId: account.id, name: 'Amazon Import Services' } });
      const member = await db.accountMembership.findFirst({ where: { accountId: account.id, status: 'ACTIVE' } });
      if (!target || !amazon || !member) throw new Error('Run seed-partner-portal-demo first in this account.');
      const targetShipment = await db.shipment.findFirst({ where: { accountId: account.id, clientId: target.id, shipmentNumber: 'SHP-TGT-2026-001' } });
      if (!targetShipment) throw new Error('Target fixture shipment missing.');
      const targetAddress = await issueClientInboundAddress({ accountId: account.id, clientId: target.id, senderPolicy: 'ALLOWLIST', createdByUserId: member.userId });
      const amazonAddress = await issueClientInboundAddress({ accountId: account.id, clientId: amazon.id, senderPolicy: 'REVIEW', createdByUserId: member.userId });
      for (const [client, email] of [[target, 'porter@target.com'], [amazon, 'trade@amazon-import.test']] as const) await createInboundSenderRoute({ accountId: account.id, clientId: client.id, email, createdByUserId: member.userId });
      for (const number of ['SHP-ACME-2026-002', 'SHP-ACME-2026-003']) {
        const shipment = await db.shipment.upsert({ where: { accountId_shipmentNumber: { accountId: account.id, shipmentNumber: number } }, update: {}, create: { accountId: account.id, clientId: amazon.id, shipmentNumber: number, importerName: amazon.name, transportMode: 'Ocean', portOfEntry: '2704', status: 'Draft' } });
        if (shipment.clientId !== amazon.id) throw new Error(`Demo shipment ${number} belongs to another client`);
        await db.shipmentTrackingIdentifier.upsert({ where: { shipmentId_type_value_issuer: { shipmentId: shipment.id, type: 'CONTAINER', value: 'CBHU8842190', issuer: 'INBOUND_DEMO' } }, update: {}, create: { accountId: account.id, shipmentId: shipment.id, type: 'CONTAINER', value: 'CBHU8842190', issuer: 'INBOUND_DEMO' } });
      }
      const fixtures = [
        { name: 'target-invoice', sender: 'porter@target.com', address: targetAddress, subject: 'Commercial Invoice — SHP-TGT-2026-001', text: 'Commercial invoice SHP-TGT-2026-001' },
        { name: 'amazon-conflict', sender: 'trade@amazon-import.test', address: amazonAddress, subject: 'Docs for container CBHU8842190', text: 'Container CBHU8842190' },
        { name: 'amazon-unknown-sender', sender: 'logistics@freightco.example', address: amazonAddress, subject: 'Packing list for review', text: 'Packing list with no shipment identifier' },
      ];
      for (const f of fixtures) {
        const id = `inbound-demo-${account.id}-${f.name}-${Date.now()}`;
        const bytes = await readFile(resolve('scripts/fixtures/inbound', `${f.name}.pdf`));
        const email = await db.inboundEmail.upsert({ where: { provider_providerEventId: { provider: 'demo', providerEventId: id } }, update: { routingStatus: 'ROUTED', processingLeaseUntil: null, processingLeaseToken: null }, create: { provider: 'demo', providerEventId: id, providerEmailId: id, accountId: account.id, clientId: f.address.clientId, inboundAddressId: f.address.id, recipientAddress: f.address.address, normalizedFromAddress: f.sender, originalFromAddress: f.sender, toAddresses: f.address.address, subject: f.subject, receivedAt: new Date() } });
        await db.inboundAttachment.deleteMany({ where: { OR: [{ inboundEmailId: email.id }, { originalFilename: `${f.name}.pdf` }] } });
        await db.shipmentDocument.deleteMany({ where: { accountId: account.id, fileName: `${f.name}.pdf` } });
        const provider: InboundEmailProvider = {
          getReceivedEmail: async () => ({ id, from: f.sender, to: [f.address.address], subject: f.subject, receivedFor: [f.address.address], headers: { 'Auto-Submitted': 'auto-generated' }, attachments: [{ id: 'fixture', filename: `${f.name}.pdf`, size: bytes.length, contentType: 'application/pdf', contentDisposition: 'attachment', contentId: null }] }),
          getAttachmentDownloadInfo: async () => ({ downloadUrl: `fixture:${f.name}`, filename: `${f.name}.pdf`, contentType: 'application/pdf', contentDisposition: 'attachment', size: bytes.length }),
          downloadAttachmentBytes: async () => bytes,
        };
        await runInboundEmailWorkerTick({ emailIds: [email.id], provider });
        const attachment = await db.inboundAttachment.findUnique({ where: { inboundEmailId_providerAttachmentId: { inboundEmailId: email.id, providerAttachmentId: 'fixture' } } });
        if (!attachment?.shipmentDocumentId) throw new Error(`${f.name}: attachment was not accepted; check scanner and storage configuration.`);
        // Fixtures contain exactly this text. Production obtains it from the parser.
        await routeParsedInboundDocument(account.id, attachment.shipmentDocumentId, f.text);
        console.log(JSON.stringify({ fixture: f.name, address: f.address.address, documentId: attachment.shipmentDocumentId }));
      }
    });
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());

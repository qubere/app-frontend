import { issueClientInboundAddress } from '@qubere/db/services/inbound-address-service';
/** npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/seed-partner-portal-demo.ts */
import { seedPartnerPortalJourney } from './seed-partner-portal-journey';
import { PrismaClient } from '@prisma/client';
import { runWithDataMode, runWithAccountId } from '@qubere/db';
import { seedCustomerPortalDemoData } from '../../../packages/db/prisma/seeds/seed-customer-portal';
import { generateEntryProof, publishEntryProof } from '../src/lib/filing/entryProofService';
import { syncClientSetup } from '../src/lib/portal/clientSetup';
import { promoteClientDocument } from '@qubere/db/services/client-setup-service';
import { storeDocumentBytes } from '@qubere/storage';
import { PERMISSION_CATALOGUE, defaultPermissionsForRole } from '../../../packages/auth/src/permissions';
import { isDemoSeedingAllowed, assertDemoSeedingAllowed } from '../src/lib/environment';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
const req = createRequire(resolve('apps/custom/package.json'));
req('@next/env').loadEnvConfig(resolve('apps/custom'), true);
const db = new PrismaClient();
const now = new Date();
const day = (n: number) => new Date(now.getTime() + n * 86400000);
function demoPdf(title: string) { const stream = `BT /F1 16 Tf 50 750 Td (SYNTHETIC DEMO - NOT A LEGAL DOCUMENT) Tj 0 -40 Td (${title}) Tj ET`; const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`]; let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; }); const xref = Buffer.byteLength(pdf); pdf += `xref\n0 6\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf); }
async function main() {
    const { values } = parseArgs({ options: { 'account-id': { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) {
        console.log('seed-partner-portal-demo [--account-id DEMO_OR_SANDBOX_ACCOUNT_ID]. Uses demo-account by default; refuses production. Creates synthetic data only; sends no notifications.');
        return;
    }
    assertDemoSeedingAllowed();
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    let account = values['account-id'] ? await db.account.findUnique({ where: { id: values['account-id'] } }) : await db.account.findUnique({ where: { slug: 'demo-account' } });
    if (!account && !values['account-id'])
        account = await db.account.create({ data: { name: 'Qubere Portal Demo', slug: 'demo-account', type: 'ENTERPRISE', status: 'ACTIVE', dataMode: 'DEMO' } });
    if (!account || (!['DEMO', 'SANDBOX'].includes(account.dataMode) && !isDemoSeedingAllowed()))
        throw new Error('Choose an existing DEMO or SANDBOX account; no production account is modified.');
    const accountId = account.id;
    // Existing legacy demo IDs must belong to this account before any seed write.
    const collision = await db.customsFiling.findFirst({ where: { id: 'filing_tgt_7501_demo', accountId: { not: accountId } } });
    if (collision && !isDemoSeedingAllowed())
        throw new Error('Legacy portal demo belongs to another account. Select that DEMO account.');
    await seedCustomerPortalDemoData(db, accountId);
    const releaseId = 'portal-demo-hts-2026';
    await db.htsRelease.upsert({ where: { id: releaseId }, update: {}, create: { id: releaseId, country: 'US', editionYear: 2026, revisionNumber: 14, releaseName: 'SYNTHETIC DEMO HTSUS 2026 rev.14', effectiveFrom: new Date('2026-05-01'), sourceUrl: 'https://hts.usitc.gov/', sourceFormat: 'JSON', sha256: 'synthetic-portal-demo', validationStatus: 'VALIDATED', publicationStatus: 'PUBLISHED' } });
    const codes = ['8481.80.5090', '6204.62.4021', '9403.20.0050', '7604.29.5090', '8504.40.9580', '3822.00.0000', '5703.39.2030', '3926.90.9985'];
    for (const [i, code] of codes.entries()) {
        const digits = code.replace(/\D/g, '');
        const nodeId = `portal-demo-hts-${i}`;
        await db.htsNode.upsert({ where: { id: nodeId }, update: {}, create: { id: nodeId, releaseId, sourceRowNumber: i + 1, indentLevel: 0, htsNumberDisplay: code, htsNumberNormalized: digits, codeLevel: 10, description: `Demo item ${i + 1}`, fullDescription: `Synthetic demonstration item ${i + 1}`, chapter: digits.slice(0, 2), heading: digits.slice(0, 4) } });
        for (const [key, rate] of [['General', 5], ['Section301', 25]] as const)
            await db.htsDutyRate.upsert({ where: { id: `${nodeId}-${key}` }, update: {}, create: { id: `${nodeId}-${key}`, htsNodeId: nodeId, rateColumn: key, rawRateText: `${rate}%`, adValoremPercent: rate, rateType: key === 'General' ? 'AdValorem' : 'SECTION_301', trancheId: key === 'Section301' ? 'List3' : null } });
        for (const type of ['ANTIDUMPING', 'COUNTERVAILING']) {
            if (i === 6 && type === 'ANTIDUMPING')
                continue;
            await db.htsDutyRate.upsert({ where: { id: `${nodeId}-${type}` }, update: {}, create: { id: `${nodeId}-${type}`, htsNodeId: nodeId, rateColumn: 'AD_CVD', rateType: type, rawRateText: '0%', adValoremPercent: 0, countryOfOrigin: 'CN', manufacturer: '*' } });
        }
        if (i !== 2 && i !== 3)
            await db.section232Rate.upsert({ where: { id: `portal-demo-232-${i}` }, update: {}, create: { id: `portal-demo-232-${i}`, htsNumber: code, commodity: 'STEEL', baseRatePct: 0, isGeneralApprovedExclusion: true, effectiveDate: new Date('2026-05-01'), reviewStatus: 'APPROVED' } });
        await db.section301Rate.upsert({ where: { id: `portal-demo-301-${i}` }, update: {}, create: { id: `portal-demo-301-${i}`, htsNumber: code, tranche: 'LIST_3', dutyRatePct: 25, effectiveDate: new Date('2026-05-01'), reviewStatus: 'APPROVED' } });
        if (i === 2 || i === 3)
            await db.section232Rate.upsert({ where: { id: `portal-demo-232-${i}` }, update: {}, create: { id: `portal-demo-232-${i}`, htsNumber: code, commodity: i === 2 ? 'STEEL' : 'ALUMINUM', baseRatePct: i === 2 ? 25 : 10, effectiveDate: new Date('2026-05-01'), reviewStatus: 'APPROVED' } });
    }
    await db.adcvdOrder.upsert({ where: { caseNumber: 'A-570-042' }, update: {}, create: { caseNumber: 'A-570-042', title: 'Demo AD/CVD scope requiring company rate review', respondentCountries: ['CN'], htsCodesInScope: [codes[6]], scopeLanguage: 'Synthetic scope for portal demonstration; not a production tariff determination.', effectiveDate: new Date('2026-05-01') } });
    await db.htsPgaRequirement.upsert({ where: { htsNumber_agencyCode: { htsNumber: codes[5], agencyCode: 'FDA' } }, update: {}, create: { htsNumber: codes[5], agencyCode: 'FDA', formCodes: ['FDA_2877'], programCode: 'FDA_2877' } });
    for (const [index, name] of ['Target Corporation', 'Amazon Import Services'].entries()) {
        const client = await db.client.findFirstOrThrow({ where: { accountId, name } });
        const prefix = `portal-demo-${client.id}`;
        const target = index === 0;
        const email = target ? 'porter@target.com' : 'porter@amazon.example';
        const user = await db.user.upsert({ where: { email }, update: {}, create: { email, firstName: target ? 'Target' : 'Amazon', lastName: 'Portal Demo', clerkUserId: `demo_${prefix}` } });
        const role = await db.role.findFirstOrThrow({ where: { accountId, name: 'CUSTOMER_ADMIN' } });
        const member = await db.accountMembership.upsert({ where: { accountId_userId: { accountId, userId: user.id } }, update: {}, create: { accountId, userId: user.id, status: 'ACTIVE' } });
        await db.accountMembershipRole.upsert({ where: { accountMembershipId_roleId: { accountMembershipId: member.id, roleId: role.id } }, update: {}, create: { accountMembershipId: member.id, roleId: role.id } });
        await db.userClientAssignment.upsert({ where: { userId_clientId: { userId: user.id, clientId: client.id } }, update: {}, create: { userId: user.id, clientId: client.id } });
        for (const name of defaultPermissionsForRole('CUSTOMER_ADMIN')) {
            const definition = PERMISSION_CATALOGUE.find(p => p.name === name)!;
            const permission = await db.permission.upsert({ where: { name }, update: {}, create: { name, description: definition.description } });
            await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
        }
        await runWithAccountId(accountId, () => runWithDataMode(account.dataMode, () => issueClientInboundAddress({ accountId, clientId: client.id, senderPolicy: target ? "ALLOWLIST" : "REVIEW" })));
        const approvedSender = target ? 'porter@target.com' : 'trade@amazon-import.test';
        await db.inboundSenderRoute.upsert({ where: { accountId_scopeKey_normalizedSenderEmail: { accountId, scopeKey: client.id, normalizedSenderEmail: approvedSender } }, update: {}, create: { accountId, clientId: client.id, scopeKey: client.id, normalizedSenderEmail: approvedSender, displaySenderEmail: approvedSender, status: 'ACTIVE', createdByUserId: user.id } });
        const shipment = await db.shipment.upsert({ where: { accountId_shipmentNumber: { accountId, shipmentNumber: target ? 'SHP-TGT-2026-001' : 'SHP-ACME-2026-002' } }, update: { clientId: client.id, promiseState: target ? 'ON_PROMISE' : 'AT_RISK', lastFreeDay: day(1.5), demurrageExposureUsd: target ? 0 : 1850 }, create: { accountId, clientId: client.id, shipmentNumber: target ? 'SHP-TGT-2026-001' : 'SHP-ACME-2026-002', importerName: name, countryOfExport: 'CN', countryOfOrigin: 'CN', destinationCountry: 'US', transportMode: 'Ocean', portOfEntry: '2704', status: 'In Progress', estimatedArrival: day(4), promiseState: target ? 'ON_PROMISE' : 'AT_RISK', lastFreeDay: day(1.5), demurrageExposureUsd: target ? 0 : 1850 } });
        await seedPartnerPortalJourney(db, accountId, shipment.id, target, now);
        const bond = await db.bond.upsert({ where: { id: `${prefix}-bond` }, update: {}, create: { id: `${prefix}-bond`, accountId, bondNumber: `DEMO-${client.id}`, bondAmount: 50000, suretyName: 'Demo Surety', status: target ? 'verified' : 'unverified', expirationDate: day(250) } });
        const importer = await db.importerOfRecord.upsert({ where: { id: `${prefix}-ior` }, update: {}, create: { id: `${prefix}-ior`, accountId, clientId: client.id, name, irsEin: '12-3456789', cbpImporterNumber: target ? `DEMO-${client.id}` : null, registrationStatus: target ? 'registered' : 'pending_5106', address: { city: 'Demo City' }, bondId: bond.id } });
        const pdf = await storeDocumentBytes({ buffer: demoPdf(`${target ? 'Target' : 'Amazon'} setup document`), fileName: `${prefix}-setup.pdf`, contentType: 'application/pdf', folder: `portal/${accountId}/demo` });
        const poa = await db.powerOfAttorney.upsert({ where: { id: `${prefix}-poa` }, update: {}, create: { id: `${prefix}-poa`, accountId, importerOfRecordId: importer.id, grantedByEntity: name, signerName: 'Demo Officer', signerEmail: `officer@${target ? 'target' : 'amazon'}.example`, executionMethod: 'E_SIGN', status: target ? 'executed' : 'out_for_signature', executedDocumentUrl: target ? pdf.url : null } });
        const onboarding = await db.onboardingCase.upsert({ where: { id: `${prefix}-onboarding` }, update: {}, create: { id: `${prefix}-onboarding`, accountId, clientId: client.id, primaryImporterId: importer.id, path: 'STANDARD', status: target ? 'active' : 'in_progress', currentStep: target ? 6 : 3, activatedAt: target ? now : null, blockers: target ? [] : ['POA_NOT_EXECUTED'] } });
        await db.onboardingEntity.upsert({ where: { id: `${prefix}-entity` }, update: {}, create: { id: `${prefix}-entity`, accountId, caseId: onboarding.id, importerOfRecordId: importer.id, poaId: poa.id, bondId: bond.id, screeningStatus: target ? 'passed' : 'pending', officers: [{ name: 'Demo Officer', email: `officer@${target ? 'target' : 'amazon'}.example`, title: 'Officer', role: 'OFFICER' }] } });
        await db.fiveOhSixRecord.upsert({ where: { id: `${prefix}-5106` }, update: {}, create: { id: `${prefix}-5106`, accountId, caseId: onboarding.id, onboardingEntityId: `${prefix}-entity`, action: 'CREATE', importerNumberType: 'EIN', status: target ? 'accepted' : 'generated', pdfDocumentUrl: pdf.url, acceptedAt: target ? now : null, cbpAssignedNumber: target ? importer.cbpImporterNumber : null } });
        if (target)
            await promoteClientDocument({ accountId, clientId: client.id, kind: 'BOND', title: 'Demo customs bond', storageUrl: pdf.url, sourceModel: 'Bond', sourceId: bond.id });
        const filing = await db.customsFiling.upsert({ where: { id: target ? 'filing_tgt_7501_demo' : `${prefix}-filing` }, update: { shipmentId: shipment.id, entryNumber: target ? 'ENTRY-TGT-24001' : 'ENTRY-ACM-24002', importerOfRecordId: importer.id, bondId: bond.id }, create: { id: target ? 'filing_tgt_7501_demo' : `${prefix}-filing`, accountId, shipmentId: shipment.id, entryNumber: target ? 'ENTRY-TGT-24001' : 'ENTRY-ACM-24002', entryType: '01', country: 'US', filingType: 'ENTRY_SUMMARY', filingStatus: 'Accepted', importerOfRecordId: importer.id, bondId: bond.id } });
        const start = target ? 0 : 4;
        for (let n = 0; n < 4; n++) {
            const code = codes[start + n], id = `${prefix}-line-${n + 1}`, productId = `${prefix}-product-${n + 1}`;
            await db.product.upsert({ where: { id: productId }, update: {}, create: { id: productId, accountId, clientId: client.id, productName: `Demo ${target ? 'Target' : 'Amazon'} item ${n + 1}` } });
            if (target || n !== 0)
                await db.productClassification.upsert({ where: { id: `${productId}-classification` }, update: {}, create: { id: `${productId}-classification`, accountId, productId, jurisdiction: 'US', nomenclature: 'HTSUS', classificationCode: code, normalizedCode: code.replace(/\D/g, ''), status: 'APPROVED', reviewedByUserId: user.id, reviewedAt: now } });
            await db.shipmentLineItem.upsert({ where: { id }, update: {}, create: { id, accountId, shipmentId: shipment.id, productId, lineNumber: n + 1, description: `Demo item ${n + 1}`, quantity: 100, unitPrice: 176, totalValue: 17600, htsCode: code, htsConfidence: target && n === 0 ? 70 : 95, countryOfOrigin: 'CN' } });
        }
        await db.filingSnapshot.upsert({ where: { filingId: filing.id }, update: {}, create: { filingId: filing.id, snapshotData: { htsReleaseId: releaseId } } });
        if (target)
            await db.refundOpportunity.upsert({ where: { id: `${prefix}-refund` }, update: {}, create: { id: `${prefix}-refund`, accountId, filingId: filing.id, opportunityType: 'retroactive_exclusion', estimatedRefundAmount: 4400, basis: { demo: true, description: 'Check Section 301 exclusion' }, status: 'Identified' } });
        if (!target) {
            await db.complianceFinding.upsert({ where: { id: `${prefix}-ad-review` }, update: {}, create: { id: `${prefix}-ad-review`, accountId, filingId: filing.id, lineNumber: 3, rule: 'AD_CVD_REVIEW', severity: 'High', description: 'AD/CVD case requires broker review', recommendation: 'Internal-only company-rate research', status: 'Open' } });
            await db.pgaHold.upsert({ where: { accountId_externalKey: { accountId, externalKey: `${prefix}-fda` } }, update: {}, create: { accountId, shipmentId: shipment.id, externalKey: `${prefix}-fda`, agencyCode: 'FDA', holdCode: 'DOCS', reasonText: 'FDA documentation required', rawNotice: 'SYNTHETIC DEMO', issuedAt: now, status: 'Open' } });
            await db.complianceDeadline.upsert({ where: { id: `${prefix}-deadline` }, update: {}, create: { id: `${prefix}-deadline`, accountId, shipmentId: shipment.id, type: 'LAST_FREE_DAY', deadlineClass: 'COMMERCIAL', anchorEvent: 'CARRIER_TERMS', anchorAt: now, dueAt: day(1.5), ruleId: 'demo-customer-documents', ruleCitation: 'Synthetic demo', customerActionable: true, customerLabel: 'Upload FDA product documentation' } });
            await db.customerRequest.upsert({ where: { id: `${prefix}-question` }, update: {}, create: { id: `${prefix}-question`, accountId, clientId: client.id, filingId: filing.id, shipmentId: shipment.id, type: 'QUESTION', title: 'Question about AD/CVD on line 3', metadata: { entryProofLineNumber: 3 }, messages: { create: { accountId, clientId: client.id, authorUserId: user.id, authorType: 'CUSTOMER', body: 'What company-rate information do you need for line 3?' } } } });
        }
        await db.etaObservation.upsert({ where: { id: `${prefix}-eta` }, update: {}, create: { id: `${prefix}-eta`, accountId, shipmentId: shipment.id, estimatedAt: now, eta: day(4), previousEta: day(2), deltaMinutes: 2880, provider: 'DEMO', confidence: 0.85, reasonCode: 'PORT_CONGESTION' } });
        await db.trackingEvent.upsert({ where: { accountId_idempotencyKey: { accountId, idempotencyKey: `${prefix}-arrival` } }, update: {}, create: { accountId, shipmentId: shipment.id, eventType: 'VESSEL_ARRIVAL_ESTIMATED', classifier: 'ESTIMATED', occurredAt: now, locationName: 'Los Angeles', provider: 'DEMO', sourceType: 'SYSTEM', idempotencyKey: `${prefix}-arrival` } });
        await db.shipmentTrackingIdentifier.upsert({ where: { shipmentId_type_value_issuer: { shipmentId: shipment.id, type: 'MBL', value: `DEMO-MBL-${index + 1}`, issuer: 'DEMO' } }, update: {}, create: { accountId, shipmentId: shipment.id, type: 'MBL', value: `DEMO-MBL-${index + 1}`, issuer: 'DEMO' } });
        await db.shipmentCharge.upsert({ where: { id: `${prefix}-charge` }, update: {}, create: { id: `${prefix}-charge`, accountId, shipmentId: shipment.id, description: 'Demo broker service', quantity: 1, unitPrice: 350, grossAmount: 350, netAmount: 350, portalVisible: true } });
        await db.invoice.upsert({ where: { invoiceNumber: `DEMO-PORTAL-${client.id}` }, update: {}, create: { accountId, clientId: client.id, invoiceNumber: `DEMO-PORTAL-${client.id}`, status: 'SENT', dueDate: day(30), subtotal: 350, totalAmount: 350, balanceDue: 350, lines: { create: { shipmentId: shipment.id, description: 'Demo broker service', quantity: 1, unitPrice: 350, amount: 350 } } } });
        await syncClientSetup(accountId, client.id);
        for (const [n, roleName] of ['IMPORTER_ADMIN', 'BILLING_CONTACT', 'CUSTOMS_CONTACT', 'OFFICER_SIGNER'].entries()) {
            const stakeholderEmail = n === 0 ? email : `demo-${n}@${target ? 'target' : 'amazon'}.example`;
            await db.clientStakeholder.upsert({ where: { clientId_email: { clientId: client.id, email: stakeholderEmail } }, update: { notifyPrefs: { email: false } }, create: { accountId, clientId: client.id, email: stakeholderEmail, name: `Demo ${roleName.replaceAll('_', ' ')}`, role: roleName, isSigner: n === 3, loginStatus: n === 0 ? 'ACTIVE' : n === 1 ? 'INVITED' : 'NOT_INVITED', userId: n === 0 ? user.id : null, sourceEvent: 'MANUAL', notifyPrefs: { email: false } } });
        }
        await db.clientStakeholder.updateMany({ where: { accountId, clientId: client.id }, data: { notifyPrefs: { email: false } } });
        const ctx = { accountId, userId: user.id };
        await generateEntryProof(filing.id, ctx);
        const proof = await publishEntryProof(filing.id, ctx);
        console.log(`${name}: /entries/${filing.id}, score ${proof.scoreOverall}, ${proof.scoreBand}; /shipments/${shipment.id}; /setup`);
    }
}
runWithDataMode(null, () => runWithAccountId(null, main)).catch(e => { console.error(e instanceof Error ? e.message : 'Seed failed'); process.exitCode = 1; }).finally(() => db.$disconnect());

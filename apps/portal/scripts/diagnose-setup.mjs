/** Broker/operator diagnostic. Reads metadata only in a READ ONLY transaction. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDirectory = resolve(appDirectory, '../..');
const require = createRequire(resolve(appDirectory, 'package.json'));
class UsageError extends Error {}

async function main() {
  const { values } = parseArgs({ options: {
    email: { type: 'string' }, 'account-id': { type: 'string' },
    shipments: { type: 'string', default: 'SHP-2026-000001,SHP-2026-000002' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npm run portal:diagnose -- --email porter@target.com [--account-id <id>] [--shipments <number,number>]');
    console.log('Read-only: lists assignments, client/importer links, PoA status and document counts. No documents, EINs, credentials or message bodies are printed.');
    return;
  }
  if (!values.email?.trim()) throw new UsageError('Supply --email. Use --help for the command.');
  const shipmentNumbers = values.shipments.split(',').map(s => s.trim()).filter(Boolean);
  if (shipmentNumbers.length > 20) throw new UsageError('Inspect at most 20 shipment numbers per run.');
  const nextRequire = createRequire(require.resolve('next/package.json'));
  const { loadEnvConfig } = nextRequire('@next/env');
  const quiet = { info() {}, error() {} };
  // Match next dev's app environment first, with the documented root .env
  // setup as a fallback. Explicit shell variables retain precedence.
  const appEnvironment = { ...loadEnvConfig(appDirectory, true, quiet).combinedEnv };
  loadEnvConfig(rootDirectory, true, quiet, true);
  Object.assign(process.env, appEnvironment);
  if (!process.env.DATABASE_URL) throw new UsageError('DATABASE_URL is missing. Use the same environment as the portal app.');
  let target;
  try { target = new URL(process.env.DATABASE_URL); }
  catch { throw new UsageError('DATABASE_URL is not a valid URL.'); }
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ log: [] });
  try {
    const report = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      const user = await tx.user.findFirst({ where: { email: { equals: values.email.trim(), mode: 'insensitive' }, deletedAt: null }, select: { id: true, email: true } });
      if (!user) return { issue: 'USER_NOT_FOUND' };
      const memberships = await tx.accountMembership.findMany({
        where: { userId: user.id, status: 'ACTIVE', deletedAt: null, account: { status: 'ACTIVE', deletedAt: null } },
        select: { account: { select: { id: true, name: true, dataMode: true } }, roles: { select: { role: { select: { name: true } } } } },
      });
      const membership = values['account-id'] ? memberships.find(m => m.account.id === values['account-id']) : memberships.length === 1 ? memberships[0] : null;
      if (!membership) return { user, issue: memberships.length ? 'CHOOSE_AN_ACTIVE_ACCOUNT_WITH_ACCOUNT_ID' : 'NO_ACTIVE_ACCOUNT_MEMBERSHIP', accounts: memberships.map(m => m.account) };
      const accountId = membership.account.id;
      const roles = membership.roles.map(r => r.role.name);
      const [direct, teams] = await Promise.all([
        tx.userClientAssignment.findMany({ where: { userId: user.id, client: { accountId } }, select: { clientId: true } }),
        tx.accountTeamMembership.findMany({ where: { userId: user.id, team: { accountId } }, select: { teamId: true, team: { select: { clients: { where: { client: { accountId } }, select: { clientId: true } } } } } }),
      ]);
      const assignedClientIds = [...new Set([...direct.map(d => d.clientId), ...teams.flatMap(t => t.team.clients.map(c => c.clientId))])];
      const allClients = roles.some(r => ['BROKER_ADMIN', 'TMS_ADMIN', 'OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN_READWRITE', 'SUPER_ADMIN_READ', 'SUPER_ADMIN_SETTINGS'].includes(r.toUpperCase()));
      const limit = 200;
      const [clients, importers, cases, shipments, documentCounts, setupDocumentCounts, assignedRequests] = await Promise.all([
        tx.client.findMany({ where: { accountId }, orderBy: { id: 'asc' }, take: limit + 1, select: { id: true, name: true, status: true, _count: { select: { importersOfRecord: true, onboardingCases: true } } } }),
        tx.importerOfRecord.findMany({ where: { accountId }, orderBy: { id: 'asc' }, take: limit + 1, select: {
          id: true, name: true, clientId: true, registrationStatus: true,
          powersOfAttorney: { where: { accountId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, signedDate: true, createdAt: true } },
        } }),
        tx.onboardingCase.findMany({ where: { accountId, status: { not: 'withdrawn' } }, orderBy: { id: 'asc' }, take: limit + 1, select: {
          id: true, clientId: true, primaryImporterId: true, status: true, currentStep: true,
          entities: { where: { accountId }, orderBy: { id: 'asc' }, take: limit + 1, select: { id: true, importerOfRecordId: true, poaId: true, screeningStatus: true } },
        } }),
        tx.shipment.findMany({ where: { accountId, shipmentNumber: { in: shipmentNumbers } }, take: 100, select: { id: true, shipmentNumber: true, clientId: true, importerOfRecordId: true, deletedAt: true } }),
        tx.shipmentDocument.groupBy({ by: ['clientId', 'portalVisibility'], where: { accountId }, _count: true }),
        tx.clientDocument.groupBy({ by: ['clientId', 'portalVisible', 'status'], where: { accountId }, _count: true }),
        tx.customerRequest.groupBy({ by: ['clientId', 'status'], where: { accountId, assignedUserId: user.id }, _count: true }),
      ]);
      return {
        user, account: membership.account, roles,
        clientAccess: { allClients, directClientIds: direct.map(d => d.clientId), teamIds: teams.map(t => t.teamId), assignedClientIds },
        clients: clients.slice(0, limit).map(c => ({ ...c, assignedToUser: allClients || assignedClientIds.includes(c.id) })),
        importers: importers.slice(0, limit), cases: cases.slice(0, limit).map(c => ({ ...c, entities: c.entities.slice(0, limit) })),
        shipments, requestedShipmentNumbers: shipmentNumbers, documentCounts, setupDocumentCounts, assignedRequests,
        truncated: { clients: clients.length > limit, importers: importers.length > limit, cases: cases.length > limit, caseEntities: cases.some(c => c.entities.length > limit), shipments: shipments.length === 100 },
        note: 'This is an operator ownership report, not a portal API response. Compare explicit client IDs; names do not grant access. No records were changed.',
      };
    }, { timeout: 60000, maxWait: 10000, isolationLevel: 'RepeatableRead' });
    console.log(JSON.stringify({ databaseHost: target.hostname, databaseName: target.pathname.slice(1), readOnly: true, ...report }, null, 2));
    if (report.issue) process.exitCode = 2;
  } catch (error) {
    // Prisma messages can include a connection string or query values. Only
    // print a stable error code, never the raw exception or environment.
    console.error(`Diagnostic failed (${error.code ?? error.name ?? 'UNKNOWN'}). Check connectivity and that Prisma generation/migrations match this checkout. No repair was attempted.`);
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof UsageError ? error.message : `Could not start diagnostic (${error.code ?? error.name ?? 'UNKNOWN'}). Run --help and check the local dependencies and arguments.`);
  process.exitCode = 1;
});

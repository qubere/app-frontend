import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@qubere/db', () => ({ db: { $queryRaw: m.query }, isDataMode: (mode: unknown) => ['DEMO', 'SANDBOX', 'PRODUCTION'].includes(String(mode)) }));
const { loadPublishedProofCosts } = await import('../src/lib/shipment-proof-costs');
let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE "Account" (id text PRIMARY KEY, "dataMode" text);
    CREATE TABLE "CustomsFiling" (id text PRIMARY KEY, "accountId" text, "shipmentId" text, "customerVisibleAt" timestamp);
    CREATE TABLE "EntryProof" (id text PRIMARY KEY, "accountId" text, "filingId" text, "clientId" text, "shipmentId" text, status text, "dutyAndFeesUsd" numeric, payload jsonb);
    INSERT INTO "Account" VALUES ('demo', 'DEMO'), ('production', 'PRODUCTION');
    INSERT INTO "CustomsFiling" VALUES ('visible', 'demo', 'shipment', now()), ('hidden', 'demo', 'shipment', null), ('other', 'production', 'shipment', now()), ('different-shipment', 'demo', 'elsewhere', now());
  `);
  const add = async (id: string, status: string, dutyStatus: string, client = 'target', filing = 'visible', account = 'demo') => pg.query(
    'INSERT INTO "EntryProof" VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, account, filing, client, 'shipment', status, '123.45', JSON.stringify({ lines: [{ dutyStack: [{ status: dutyStatus }], evidence: [{ label: 'Large private test payload' }] }] })],
  );
  await add('complete', 'PUBLISHED', 'EVALUATED_APPLICABLE');
  await add('not-evaluated', 'PUBLISHED', 'NOT_EVALUATED');
  await add('unavailable', 'PUBLISHED', 'DATA_UNAVAILABLE');
  await add('review', 'PUBLISHED', 'REVIEW_REQUIRED');
  await add('draft', 'DRAFT', 'EVALUATED_APPLICABLE');
  await add('other-client', 'PUBLISHED', 'EVALUATED_APPLICABLE', 'amazon');
  await add('unpublished-filing', 'PUBLISHED', 'EVALUATED_APPLICABLE', 'target', 'hidden');
  await add('other-account', 'PUBLISHED', 'EVALUATED_APPLICABLE', 'target', 'other', 'production');
  await add('wrong-filing-shipment', 'PUBLISHED', 'EVALUATED_APPLICABLE', 'target', 'different-shipment');
  m.query.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await pg.query(sql, values)).rows;
  });
}, 30000);
afterAll(async () => { await pg?.close(); });

describe('Proof summaries in PostgreSQL', () => {
  it('returns only published, visible, same-workspace/shipment costs', async () => {
    const rows = await loadPublishedProofCosts({ accountId: 'demo', dataMode: 'DEMO' }, 'shipment');
    expect(rows).toHaveLength(5);
    expect(rows.filter(row => row.complete)).toHaveLength(2);
    expect(rows.filter(row => !row.complete)).toHaveLength(3);
    for (const row of rows) {
      expect(Number(row.dutyAndFeesUsd)).toBe(123.45);
      expect(Object.keys(row).sort()).toEqual(['complete', 'dutyAndFeesUsd']);
    }
  });
  it('enforces data-mode isolation even though raw SQL bypasses Prisma middleware', async () => {
    expect(await loadPublishedProofCosts({ accountId: 'demo', dataMode: 'PRODUCTION' }, 'shipment')).toEqual([]);
    expect(await loadPublishedProofCosts({ accountId: 'production', dataMode: 'PRODUCTION' }, 'shipment')).toHaveLength(1);
  });
  it('does not interpolate request-controlled values into SQL', async () => {
    expect(await loadPublishedProofCosts({ accountId: 'demo', dataMode: 'DEMO' }, "shipment' OR true --")).toEqual([]);
  });
  it('returns no costs for an unknown workspace', async () => {
    expect(await loadPublishedProofCosts({ accountId: 'unknown', dataMode: 'DEMO' }, 'shipment')).toEqual([]);
  });
});

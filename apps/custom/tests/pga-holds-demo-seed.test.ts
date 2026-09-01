import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { seedPgaHolds } from "../scripts/lib/pga-holds-demo";

function fixture(mode = "DEMO") {
  const records = new Map<string, Record<string, unknown>>();
  const audit = vi.fn(async () => ({}));
  const tx = {
    account: { findFirst: vi.fn(async () => ({ id: "account-a", name: "Demo", dataMode: mode })) },
    shipment: { findFirst: vi.fn(async () => ({ id: "shipment-a", shipmentNumber: "DEMO-001", importerName: "Demo importer" })) },
    accountMembership: { findFirst: vi.fn(async () => ({ userId: "user-a" })) },
    pgaHold: {
      findUnique: vi.fn(async ({ where }) => records.get(where.accountId_externalKey.externalKey) ?? null),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, id: `hold-${records.size + 1}` };
        records.set(data.externalKey, row);
        return row;
      }),
    },
    auditLog: { create: audit },
  };
  const transaction = vi.fn(async (work) => work(tx));
  const db = { pgaHold: tx.pgaHold, pgaHoldSubmission: {}, $transaction: transaction } as unknown as PrismaClient;
  return { db, tx, records, transaction };
}
const options = { accountId: "account-a", shipmentId: "shipment-a" };

describe("PGA demo seed", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "demo");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "demo");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["NODE_ENV", "APP_ENV", "NEXT_PUBLIC_APP_ENV"])("blocks production %s before any database access", async (key) => {
    vi.stubEnv(key, "production");
    const f = fixture();
    await expect(seedPgaHolds(f.db, options)).rejects.toThrow("SECURITY_VIOLATION");
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it("blocks production accounts and never changes their data mode", async () => {
    const f = fixture("PRODUCTION");
    await expect(seedPgaHolds(f.db, options)).rejects.toThrow("DEMO or SANDBOX");
    expect(f.tx.shipment.findFirst).not.toHaveBeenCalled();
    expect(f.tx.pgaHold.create).not.toHaveBeenCalled();
  });

  it("requires the shipment and optional operator to belong to the selected account", async () => {
    const f = fixture();
    f.tx.shipment.findFirst.mockResolvedValueOnce(null as never);
    await expect(seedPgaHolds(f.db, options)).rejects.toThrow("Shipment not found");
    expect(f.tx.shipment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "shipment-a", accountId: "account-a", deletedAt: null },
    }));
    expect(f.tx.pgaHold.create).not.toHaveBeenCalled();
    f.tx.accountMembership.findFirst.mockResolvedValueOnce(null as never);
    await expect(seedPgaHolds(f.db, { ...options, userId: "foreign-user" })).rejects.toThrow("active account member");
    expect(f.tx.accountMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId: "account-a", status: "ACTIVE", deletedAt: null, userId: "foreign-user" },
    }));
  });

  it("previews all four scenarios without creating holds, histories or audits", async () => {
    const f = fixture("SANDBOX");
    const result = await seedPgaHolds(f.db, { ...options, dryRun: true });
    expect(result.rows.map(row => row.status)).toEqual(["Open", "Rejected", "Submitted", "Released"]);
    expect(result.rows.every(row => row.action === "would create")).toBe(true);
    expect(f.tx.pgaHold.create).not.toHaveBeenCalled();
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("creates coherent synthetic histories and preserves broker edits on rerun", async () => {
    const f = fixture();
    const now = new Date("2026-09-01T12:00:00Z");
    const first = await seedPgaHolds(f.db, options, now);
    expect(first.rows.filter(row => row.action === "created")).toHaveLength(4);
    const data = f.tx.pgaHold.create.mock.calls.map(([arg]) => arg.data);
    expect(data.every(row => row.accountId === options.accountId && row.shipmentId === options.shipmentId)).toBe(true);
    expect(data.every(row => row.rawNotice.includes("DEMO ONLY"))).toBe(true);
    const rejected = data[1].submissions.create;
    expect(rejected.status).toBe("Rejected");
    expect(rejected.rejectedFields).toEqual(["scientificName"]);
    expect(rejected.submittedAt.getTime()).toBeGreaterThan(data[1].issuedAt.getTime());
    expect(rejected.responseAt.getTime()).toBeGreaterThan(rejected.submittedAt.getTime());
    expect(data[2].submissions.create.status).toBe("Sent");
    expect(data[3].submissions.create.status).toBe("Accepted");
    expect(data[3].closedAt).toEqual(data[3].submissions.create.responseAt);
    const firstRecord = [...f.records.values()][0];
    firstRecord.draftFormInput = { lotNumber: "BROKER-EDIT" };
    firstRecord.status = "Processing";
    const second = await seedPgaHolds(f.db, options, new Date(now.getTime() + 86_400_000));
    expect(second.rows.every(row => row.action === "kept")).toBe(true);
    expect(second.rows[0].status).toBe("Processing");
    expect(firstRecord.draftFormInput).toEqual({ lotNumber: "BROKER-EDIT" });
    expect(f.tx.pgaHold.create).toHaveBeenCalledTimes(4);
    expect(f.tx.auditLog.create).toHaveBeenCalledTimes(4);
  });

  it("explains a stale generated client before attempting a transaction", async () => {
    const f = fixture();
    const stale = { ...f.db, pgaHold: undefined } as unknown as PrismaClient;
    await expect(seedPgaHolds(stale, options)).rejects.toThrow("db:generate");
    expect(f.transaction).not.toHaveBeenCalled();
  });
});

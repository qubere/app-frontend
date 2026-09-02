import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedPgaHolds } from "../scripts/lib/pga-holds-demo";

describe.skipIf(process.env.PGA_ASSIST_INTEGRATION !== "1")("PGA demo seed / PostgreSQL", () => {
  let db: PrismaClient;
  const accountIds: string[] = [];
  let accountId: string;
  let shipmentId: string;
  let userId: string;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/qubere_test") {
      throw new Error("PGA seed integration requires localhost/qubere_test.");
    }
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("ALLOW_DEMO_SEEDING", "true");
    db = new PrismaClient();
    const suffix = randomUUID();
    const account = await db.account.create({ data: { name: "PGA seed integration", slug: `pga-seed-${suffix}`, dataMode: "DEMO" } });
    accountId = account.id;
    accountIds.push(accountId);
    const user = await db.user.create({ data: { clerkUserId: `pga-seed-${suffix}`, email: `pga-seed-${suffix}@example.test` } });
    userId = user.id;
    await db.accountMembership.create({ data: { accountId, userId } });
    const shipment = await db.shipment.create({ data: { accountId, shipmentNumber: `PGA-DEMO-${suffix}`, importerName: "Demo importer" } });
    shipmentId = shipment.id;
  });

  afterAll(async () => {
    if (db) {
      // Audit history is append-only: retire fixtures in the disposable test DB.
      await db.account.updateMany({ where: { id: { in: accountIds } }, data: { status: "INACTIVE", deletedAt: new Date() } });
      if (userId) await db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
      await db.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  it("previews without writes, seeds all four states, and preserves edits on rerun", async () => {
    const options = { accountId, shipmentId, userId };
    await seedPgaHolds(db, { ...options, dryRun: true });
    expect(await db.pgaHold.count({ where: { accountId } })).toBe(0);
    const result = await seedPgaHolds(db, options);
    expect(result.rows.filter(row => row.action === "created")).toHaveLength(4);
    const holds = await db.pgaHold.findMany({ where: { accountId, shipmentId }, include: { submissions: true } });
    expect(holds.filter(row => ["Open", "Submitted", "Processing", "Rejected"].includes(row.status))).toHaveLength(3);
    expect(await db.pgaHoldSubmission.count({ where: { accountId } })).toBe(3);
    expect(await db.auditLog.count({ where: { accountId, action: "PGA_HOLD_DEMO_SEEDED" } })).toBe(4);
    expect(holds.find(row => row.status === "Rejected")?.submissions[0].rejectedFields).toEqual(["scientificName"]);
    expect(holds.find(row => row.status === "Released")?.submissions[0].status).toBe("Accepted");
    const open = holds.find(row => row.status === "Open")!;
    await db.pgaHold.update({ where: { id: open.id }, data: { draftFormInput: { lotNumber: "BROKER-SAVED" } } });
    const again = await seedPgaHolds(db, options);
    expect(again.rows.every(row => row.action === "kept")).toBe(true);
    expect((await db.pgaHold.findUniqueOrThrow({ where: { id: open.id } })).draftFormInput).toEqual({ lotNumber: "BROKER-SAVED" });
    expect(await db.pgaHold.count({ where: { accountId } })).toBe(4);
    expect(await db.auditLog.count({ where: { accountId, action: "PGA_HOLD_DEMO_SEEDED" } })).toBe(4);
  });

  it("rejects production accounts and a shipment belonging to another account", async () => {
    const production = await db.account.create({ data: { name: "PGA negative fixture", slug: `pga-prod-${randomUUID()}` } });
    accountIds.push(production.id);
    vi.stubEnv("ALLOW_DEMO_SEEDING", "false");
    try {
      await expect(seedPgaHolds(db, { accountId: production.id, shipmentId })).rejects.toThrow("DEMO or SANDBOX");
    } finally {
      vi.stubEnv("ALLOW_DEMO_SEEDING", "true");
    }
    const foreign = await db.shipment.create({ data: { accountId: production.id, shipmentNumber: "FOREIGN", importerName: "Fixture" } });
    await expect(seedPgaHolds(db, { accountId, shipmentId: foreign.id })).rejects.toThrow("Shipment not found");
    expect(await db.pgaHold.count({ where: { accountId: production.id } })).toBe(0);
  });

  it("rolls back holds and histories if the audit write fails", async () => {
    const shipment = await db.shipment.create({ data: { accountId, shipmentNumber: "PGA-ROLLBACK", importerName: "Fixture" } });
    const failingDb = db.$extends({ query: { auditLog: { create() { throw new Error("audit unavailable"); } } } });
    await expect(seedPgaHolds(failingDb as unknown as PrismaClient, { accountId, shipmentId: shipment.id })).rejects.toThrow("audit unavailable");
    expect(await db.pgaHold.count({ where: { accountId, shipmentId: shipment.id } })).toBe(0);
    expect(await db.pgaHoldSubmission.count({ where: { accountId, pgaHold: { shipmentId: shipment.id } } })).toBe(0);
  });
});

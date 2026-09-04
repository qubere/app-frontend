import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    importerOfRecord: { findFirst: vi.fn(), update: vi.fn() },
    client: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { linkImporterClient } = await import(
  "../src/modules/importers/importerClientLink.service"
);

const baseImporter = {
  id: "importer-1",
  name: "Northwind Imports",
  clientId: "client-old",
  legalEntityId: "entity-1",
  _count: { customsFilings: 0, shipments: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((callback: (tx: typeof mocks.db) => unknown) => callback(mocks.db));
  mocks.db.importerOfRecord.findFirst.mockResolvedValue(baseImporter);
  mocks.db.client.findFirst.mockResolvedValue({ id: "client-new", name: "Northwind Trade Group" });
  mocks.db.importerOfRecord.update.mockResolvedValue({
    ...baseImporter,
    clientId: "client-new",
    client: { id: "client-new", name: "Northwind Trade Group" },
  });
  mocks.db.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("linkImporterClient", () => {
  it("scopes both records to the broker account and writes an audit event", async () => {
    const result = await linkImporterClient({
      accountId: "broker-1",
      importerId: "importer-1",
      clientId: "client-new",
      userId: "broker-user",
      requestId: "request-1",
    });

    expect(result.changed).toBe(true);
    expect(mocks.db.importerOfRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "importer-1", accountId: "broker-1" },
    }));
    expect(mocks.db.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "client-new", accountId: "broker-1" },
    }));
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "importer.client_linked",
      entityId: "importer-1",
      accountId: "broker-1",
    }) });
  });

  it("requires explicit confirmation when a client change affects operational history", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue({
      ...baseImporter,
      _count: { customsFilings: 2, shipments: 5 },
    });

    await expect(linkImporterClient({
      accountId: "broker-1",
      importerId: "importer-1",
      clientId: "client-new",
      userId: "broker-user",
    })).rejects.toMatchObject({
      code: "HISTORICAL_FILINGS_CONFIRMATION_REQUIRED",
      details: expect.objectContaining({ customsFilings: 2, shipments: 5 }),
    });
    expect(mocks.db.importerOfRecord.update).not.toHaveBeenCalled();
  });

  it("changes ownership after confirmation without rewriting historical records", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue({
      ...baseImporter,
      _count: { customsFilings: 2, shipments: 5 },
    });

    const result = await linkImporterClient({
      accountId: "broker-1",
      importerId: "importer-1",
      clientId: "client-new",
      userId: "broker-user",
      confirmHistoricalReassignment: true,
    });

    expect(result.historicalRecordsPreserved).toBe(true);
    expect(mocks.db.importerOfRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { clientId: "client-new" },
    }));
  });

  it("does not reveal which cross-account id failed", async () => {
    mocks.db.client.findFirst.mockResolvedValue(null);
    await expect(linkImporterClient({
      accountId: "broker-1",
      importerId: "importer-1",
      clientId: "client-other-account",
      userId: "broker-user",
    })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Importer or client not found." });
  });
});

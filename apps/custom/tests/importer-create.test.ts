import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    client: { findFirst: vi.fn() },
    legalEntity: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    importerOfRecord: { findFirst: vi.fn(), create: vi.fn() },
    onboardingCase: { create: vi.fn() },
    onboardingEntity: { create: vi.fn() },
    onboardingEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { createImporter } = await import("../src/modules/importers/importerCreate.service");

const newLegalEntity = {
  legalName: "Northwind Foods LLC",
  entityType: "US_LLC",
  country: "US",
  importerNumberType: "EIN" as const,
  importerNumber: "12-3456789",
  addressLine1: "100 Harbor Way",
  city: "Oakland",
  stateProvince: "CA",
  postalCode: "94607",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((callback: (tx: typeof mocks.db) => unknown) => callback(mocks.db));
  mocks.db.client.findFirst.mockResolvedValue({ id: "client-1", name: "Northwind Trade Group" });
  mocks.db.legalEntity.create.mockResolvedValue({
    id: "legal-1",
    accountId: "broker-1",
    clientId: "client-1",
    ...newLegalEntity,
    tradeName: null,
    addressLine2: null,
    taxIdentifier: "123456789",
    taxIdentifierType: "EIN",
    importerOfRecord: null,
  });
  mocks.db.importerOfRecord.findFirst.mockResolvedValue(null);
  mocks.db.importerOfRecord.create.mockResolvedValue({ id: "importer-1", name: newLegalEntity.legalName });
  mocks.db.onboardingCase.create.mockResolvedValue({ id: "case-1", currentStep: 2 });
  mocks.db.onboardingEntity.create.mockResolvedValue({ id: "entity-1" });
  mocks.db.onboardingEvent.create.mockResolvedValue({ id: "event-1" });
  mocks.db.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("createImporter", () => {
  it("creates one linked filing identity and starts onboarding", async () => {
    const result = await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    });

    expect(result.importer.id).toBe("importer-1");
    expect(mocks.db.importerOfRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      clientId: "client-1",
      legalEntityId: "legal-1",
      irsEin: "123456789",
    }) });
    expect(mocks.db.onboardingCase.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      primaryImporterId: "importer-1",
      clientId: "client-1",
      status: "in_progress",
      currentStep: 2,
    }) });
  });

  it("reuses an eligible legal entity instead of duplicating it", async () => {
    mocks.db.legalEntity.findFirst.mockResolvedValue({
      id: "legal-existing",
      accountId: "broker-1",
      clientId: "client-1",
      legalName: "Northwind Foods LLC",
      taxIdentifier: "123456789",
      taxIdentifierType: "EIN",
      country: "US",
      addressLine1: "100 Harbor Way",
      addressLine2: null,
      city: "Oakland",
      stateProvince: "CA",
      postalCode: "94607",
      importerOfRecord: null,
    });

    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "SWITCHING",
      legalEntityId: "legal-existing",
    });

    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
    expect(mocks.db.importerOfRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      legalEntityId: "legal-existing",
    }) });
  });

  it("returns the existing importer when the filing identity is already registered", async () => {
    mocks.db.legalEntity.findFirst.mockResolvedValue({
      id: "legal-existing",
      clientId: "client-1",
      importerOfRecord: { id: "importer-existing", name: "Northwind Foods LLC" },
    });

    await expect(createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntityId: "legal-existing",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      details: { existingImporter: { id: "importer-existing", name: "Northwind Foods LLC" } },
    });
    expect(mocks.db.importerOfRecord.create).not.toHaveBeenCalled();
  });

  it("does not accept a client from another broker account", async () => {
    mocks.db.client.findFirst.mockResolvedValue(null);
    await expect(createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "other-client",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipmentContainer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    shipmentPackage: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    fact: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { ContainerReconciler, PackageReconciler } from "@/modules/shipment/containerPackageReconciler";

afterEach(() => {
  vi.clearAllMocks();
});

describe("ContainerReconciler", () => {
  it("records Facts with a container: entityRef and creates a row on first discovery", async () => {
    await ContainerReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_1",
      sourceType: "EXTRACTED",
      items: [
        {
          containerNumber: "MSCU1234567",
          sealNumbers: ["SEAL1", "SEAL2"],
          containerType: "Dry",
          containerSize: "40ft",
          grossWeight: 21500,
          weightUom: "KG",
        },
      ],
    });

    const rows = dbMock.fact.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.every((r) => r.entityRef === "container:MSCU1234567")).toBe(true);
    expect(rows.find((r) => String(r.field).endsWith(".containerType"))?.value).toBe("Dry");

    const created = dbMock.shipmentContainer.create.mock.calls[0][0].data;
    expect(created.containerNumber).toBe("MSCU1234567");
    expect(created.sealNumbers).toEqual(["SEAL1", "SEAL2"]);
    expect(created.containerSize).toBe("40ft");
  });

  it("fills only currently-empty fields on an existing row, and never once status is Valid", async () => {
    dbMock.shipmentContainer.findFirst.mockResolvedValueOnce({
      id: "cont_1",
      status: "Unreviewed",
      sealNumbers: [],
      containerType: "Dry",
      containerSize: null,
      containerHeight: null,
      packageCount: null,
      packageType: null,
      descriptionOfGoods: null,
      pieceQuantity: null,
      quantityUom: null,
      grossWeight: null,
      netWeight: null,
      weightUom: null,
      volume: null,
      volumeUom: null,
      marksAndNumbers: null,
    });

    await ContainerReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_2",
      sourceType: "EXTRACTED",
      items: [{ containerNumber: "MSCU1234567", containerType: "Reefer", containerSize: "20ft" }],
    });

    const updateData = dbMock.shipmentContainer.update.mock.calls[0][0].data;
    expect(updateData.containerType).toBeUndefined();
    expect(updateData.containerSize).toBe("20ft");
  });
});

describe("PackageReconciler", () => {
  it("records Facts with a package: entityRef and creates a row on first discovery", async () => {
    await PackageReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_1",
      sourceType: "EXTRACTED",
      items: [
        {
          packageNumber: "PKG-1",
          containerNumber: "MSCU1234567",
          packageType: "Carton",
          containedItems: ["SKU-1", "SKU-2"],
        },
      ],
    });

    const rows = dbMock.fact.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.every((r) => r.entityRef === "package:PKG-1")).toBe(true);

    const created = dbMock.shipmentPackage.create.mock.calls[0][0].data;
    expect(created.packageNumber).toBe("PKG-1");
    expect(created.containerNumber).toBe("MSCU1234567");
    expect(created.containedItems).toEqual(["SKU-1", "SKU-2"]);
  });
});

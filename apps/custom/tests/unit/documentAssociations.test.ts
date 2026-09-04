import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  linkDocument,
  unlinkDocument,
  DocumentAssociationError,
} from "../../src/modules/documentAssociations/service";

vi.mock("../../src/lib/db", () => {
  const db = {
    shipmentDocument: { findFirst: vi.fn() },
    shipment: { findFirst: vi.fn() },
    party: { findFirst: vi.fn() },
    product: { findFirst: vi.fn() },
    license: { findFirst: vi.fn() },
    customsFiling: { findFirst: vi.fn() },
    documentAssociation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
  };
  return { db };
});

vi.mock("../../src/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: { DOCUMENT_ASSOCIATION_CREATED: "DOCUMENT_ASSOCIATION_CREATED", DOCUMENT_ASSOCIATION_UNLINKED: "DOCUMENT_ASSOCIATION_UNLINKED" },
}));

import { db } from "../../src/lib/db";

describe("documentAssociations service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new association when none exists", async () => {
    (db.shipmentDocument.findFirst as any).mockResolvedValue({ id: "doc1", fileName: "inv.pdf" });
    (db.shipment.findFirst as any).mockResolvedValue({ id: "shp1", shipmentNumber: "SHP-1" });
    (db.documentAssociation.findFirst as any).mockResolvedValue(null);
    (db.documentAssociation.create as any).mockResolvedValue({
      id: "assoc1",
      relationshipType: "GENERAL",
      source: "USER",
    });

    const result = await linkDocument({
      accountId: "acc1",
      documentId: "doc1",
      entityType: "SHIPMENT",
      entityId: "shp1",
      linkedBy: "user1",
    });

    expect(result.created).toBe(true);
    expect(db.documentAssociation.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: returns the existing active association without creating a duplicate", async () => {
    (db.shipmentDocument.findFirst as any).mockResolvedValue({ id: "doc1", fileName: "inv.pdf" });
    (db.shipment.findFirst as any).mockResolvedValue({ id: "shp1", shipmentNumber: "SHP-1" });
    (db.documentAssociation.findFirst as any).mockResolvedValue({ id: "existing1", active: true });

    const result = await linkDocument({
      accountId: "acc1",
      documentId: "doc1",
      entityType: "SHIPMENT",
      entityId: "shp1",
      linkedBy: "user1",
    });

    expect(result.created).toBe(false);
    expect(result.association).toEqual({ id: "existing1", active: true });
    expect(db.documentAssociation.create).not.toHaveBeenCalled();
  });

  it("throws DOCUMENT_NOT_FOUND when the document isn't in this account", async () => {
    (db.shipmentDocument.findFirst as any).mockResolvedValue(null);

    await expect(
      linkDocument({
        accountId: "acc1",
        documentId: "missing",
        entityType: "SHIPMENT",
        entityId: "shp1",
        linkedBy: "user1",
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  });

  it("throws ENTITY_NOT_FOUND when the target entity isn't in this account", async () => {
    (db.shipmentDocument.findFirst as any).mockResolvedValue({ id: "doc1", fileName: "inv.pdf" });
    (db.shipment.findFirst as any).mockResolvedValue(null);

    await expect(
      linkDocument({
        accountId: "acc1",
        documentId: "doc1",
        entityType: "SHIPMENT",
        entityId: "other-account-shipment",
        linkedBy: "user1",
      })
    ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" });
  });

  it("unlinks an active association (sets active=false, records unlinkedBy/unlinkedAt)", async () => {
    (db.documentAssociation.findFirst as any).mockResolvedValue({
      id: "assoc1",
      accountId: "acc1",
      active: true,
      documentId: "doc1",
      entityType: "SHIPMENT",
      entityId: "shp1",
    });
    (db.documentAssociation.update as any).mockResolvedValue({
      id: "assoc1",
      active: false,
      unlinkedBy: "user1",
    });

    const result = await unlinkDocument({
      accountId: "acc1",
      associationId: "assoc1",
      unlinkedBy: "user1",
    });

    expect(result.active).toBe(false);
    expect(db.documentAssociation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "assoc1" } })
    );
  });

  it("is a no-op (returns as-is) when unlinking an already-inactive association", async () => {
    const inactive = { id: "assoc1", accountId: "acc1", active: false };
    (db.documentAssociation.findFirst as any).mockResolvedValue(inactive);

    const result = await unlinkDocument({
      accountId: "acc1",
      associationId: "assoc1",
      unlinkedBy: "user1",
    });

    expect(result).toBe(inactive);
    expect(db.documentAssociation.update).not.toHaveBeenCalled();
  });

  it("throws ASSOCIATION_NOT_FOUND for an unknown/cross-account association id", async () => {
    (db.documentAssociation.findFirst as any).mockResolvedValue(null);

    await expect(
      unlinkDocument({ accountId: "acc1", associationId: "nope", unlinkedBy: "user1" })
    ).rejects.toBeInstanceOf(DocumentAssociationError);
  });
});

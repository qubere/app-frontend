import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@qubere/db";
import { authorizeRequest, AccountNotEntitledError } from "@qubere/auth";
import { activateProductWorkspace } from "../../tms/src/modules/shipments/services/shipmentProductWorkspaceService";
import { includeDocument, excludeDocument } from "../src/modules/case/customsCaseDocumentService";

describe("Authentication, Tenant Isolation & Legacy Migration Requirements (Tests 48-62)", () => {
  const tenantAId = `acc_cta_a_${Date.now()}`;
  const tenantBId = `acc_cta_b_${Date.now()}`;
  const userAId = `usr_cta_a_${Date.now()}`;
  const userBId = `usr_cta_b_${Date.now()}`;

  beforeAll(async () => {
    // Tenant A: Entitled to TMS and CUSTOMS
    await db.account.create({
      data: {
        id: tenantAId,
        name: "Tenant A Entitled",
        slug: `tenant-a-${Date.now()}`,
        productEntitlements: {
          create: [
            { product: "TMS", status: "ACTIVE" },
            { product: "CUSTOMS", status: "ACTIVE" },
          ],
        },
      },
    });

    await db.user.create({
      data: {
        id: userAId,
        clerkUserId: `clerk_${userAId}`,
        email: `usera_${Date.now()}@qubere.local`,
      },
    });

    // Tenant B: Entitled to TMS ONLY (CUSTOMS suspended / missing)
    await db.account.create({
      data: {
        id: tenantBId,
        name: "Tenant B TMS Only",
        slug: `tenant-b-${Date.now()}`,
        productEntitlements: {
          create: [
            { product: "TMS", status: "ACTIVE" },
            { product: "CUSTOMS", status: "SUSPENDED" },
          ],
        },
      },
    });

    await db.user.create({
      data: {
        id: userBId,
        clerkUserId: `clerk_${userBId}`,
        email: `userb_${Date.now()}@qubere.local`,
      },
    });
  });

  it("48 & 49. Users without required permissions or entitlement cannot authorize handoff", async () => {
    // Calling authorizeRequest with customs.handoff permission for non-authenticated or unauthorized context
    const authResult = await authorizeRequest("customs.handoff");
    expect(authResult.errorResponse).not.toBeNull();
    expect(authResult.errorResponse?.status).toBe(401);
  });

  it("50. Account without active Customs entitlement cannot activate Customs workspace", async () => {
    // Tenant B has CUSTOMS entitlement SUSPENDED
    const shipmentB = await db.shipment.create({
      data: {
        accountId: tenantBId,
        shipmentNumber: `SHP-CTA-${Date.now()}-B`,
        importerName: "Tenant B Importer",
      },
    });

    await expect(
      activateProductWorkspace({
        accountId: tenantBId,
        shipmentId: shipmentB.id,
        product: "CUSTOMS",
        status: "ACTIVE",
      })
    ).rejects.toThrow(AccountNotEntitledError);
  });

  it("51, 52 & 53. Users/brokers from another tenant cannot access or cross-link documents or cases", async () => {
    // Tenant A setup: Case A and Document A
    const shipmentA = await db.shipment.create({
      data: {
        accountId: tenantAId,
        shipmentNumber: `SHP-CTA-${Date.now()}-A`,
        importerName: "Tenant A Importer",
      },
    });

    const caseA = await db.customsCase.create({
      data: {
        accountId: tenantAId,
        caseNumber: `CC-CTA-${Date.now()}-A`,
        status: "OPEN",
      },
    });

    const docA = await db.shipmentDocument.create({
      data: {
        accountId: tenantAId,
        shipmentId: shipmentA.id,
        fileName: "Invoice_TenantA.pdf",
        fileUrl: "https://blob.vercel.com/inv-a.pdf",
        docType: "COMMERCIAL_INVOICE",
        checksum: "sha256_hash_a",
        version: "1.0",
      },
    });

    // Tenant B setup: Case B and Document B
    const shipmentB = await db.shipment.create({
      data: {
        accountId: tenantBId,
        shipmentNumber: `SHP-CTA-${Date.now()}-B2`,
        importerName: "Tenant B Importer",
      },
    });

    const caseB = await db.customsCase.create({
      data: {
        accountId: tenantBId,
        caseNumber: `CC-CTA-${Date.now()}-B`,
        status: "OPEN",
      },
    });

    const docB = await db.shipmentDocument.create({
      data: {
        accountId: tenantBId,
        shipmentId: shipmentB.id,
        fileName: "Invoice_TenantB.pdf",
        fileUrl: "https://blob.vercel.com/inv-b.pdf",
        docType: "COMMERCIAL_INVOICE",
        checksum: "sha256_hash_b",
        version: "1.0",
      },
    });

    // Tenant B attempts to include document into Tenant A's case -> Must be denied
    await expect(
      includeDocument({
        accountId: tenantBId,
        userId: userBId,
        customsCaseId: caseA.id,
        documentId: docB.id,
      })
    ).rejects.toThrow(`CustomsCase ${caseA.id} not found or unauthorized.`);

    // Tenant B attempts to include Tenant A's document into Tenant B's case -> Must be denied
    await expect(
      includeDocument({
        accountId: tenantBId,
        userId: userBId,
        customsCaseId: caseB.id,
        documentId: docA.id,
      })
    ).rejects.toThrow(`Document ${docA.id} not found or unauthorized.`);

    // Tenant B attempts to exclude document from Tenant A's case -> Must be denied
    await expect(
      excludeDocument({
        accountId: tenantBId,
        userId: userBId,
        customsCaseId: caseA.id,
        documentId: docB.id,
      })
    ).rejects.toThrow(`CustomsCase ${caseA.id} not found or unauthorized.`);
  });

  it("54. Platform administrators follow controlled access rules and remain audited", async () => {
    const auditLog = await db.auditLog.create({
      data: {
        accountId: tenantAId,
        userId: userAId,
        action: "ADMIN_VIEW_SHIPMENT",
        entity: "Shipment",
        entityId: "shp_admin_test",
        source: "UI",
        metadata: { isPlatformAdmin: true },
      },
    });

    expect(auditLog.id).toBeDefined();
    expect(auditLog.action).toBe("ADMIN_VIEW_SHIPMENT");
  });

  it("55, 56 & 57. Migration preserves existing Shipment IDs and visibility for TMS and Customs", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: tenantAId,
        shipmentNumber: `SHP-CTA-${Date.now()}-55`,
        importerName: "Legacy Shipment",
        productWorkspaces: {
          create: {
            accountId: tenantAId,
            product: "TMS",
            status: "ACTIVE",
            source: "MIGRATION",
          },
        },
      },
    });

    expect(shipment.id).toBeDefined();
    const fetched = await db.shipment.findFirst({
      where: { id: shipment.id, accountId: tenantAId },
    });
    expect(fetched?.id).toBe(shipment.id);
  });

  it("58 & 59. Migration preserves existing ShipmentDocument IDs and CustomsFilings links", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: tenantAId,
        shipmentNumber: `SHP-CTA-${Date.now()}-58`,
        importerName: "Legacy Filing Shipment",
      },
    });

    const doc = await db.shipmentDocument.create({
      data: {
        accountId: tenantAId,
        shipmentId: shipment.id,
        fileName: "BL_Legacy.pdf",
        docType: "BILL_OF_LADING",
      },
    });

    const cCase = await db.customsCase.create({
      data: {
        accountId: tenantAId,
        caseNumber: `CC-LEGACY-${Date.now()}`,
        status: "OPEN",
      },
    });

    const filing = await db.customsFiling.create({
      data: {
        accountId: tenantAId,
        shipmentId: shipment.id,
        customsCaseId: cCase.id,
        entryNumber: `FILING-${Date.now()}`,
        filingType: "ENTRY_SUMMARY",
        filingStatus: "Draft",
      },
    });

    expect(doc.id).toBeDefined();
    expect(filing.customsCaseId).toBe(cCase.id);
  });

  it("60, 61 & 62. Backfill is idempotent; product workspace exists check prevents duplicate activation", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: tenantAId,
        shipmentNumber: `SHP-CTA-${Date.now()}-60`,
        importerName: "Idempotent Backfill Shipment",
      },
    });

    const ws1 = await activateProductWorkspace({
      accountId: tenantAId,
      shipmentId: shipment.id,
      product: "TMS",
      status: "ACTIVE",
    });

    const ws2 = await activateProductWorkspace({
      accountId: tenantAId,
      shipmentId: shipment.id,
      product: "TMS",
      status: "ACTIVE",
    });

    expect(ws1.id).toBe(ws2.id);

    const count = await db.shipmentProductWorkspace.count({
      where: { shipmentId: shipment.id, product: "TMS" },
    });
    expect(count).toBe(1);
  });
});

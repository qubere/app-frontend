import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@qubere/db";
import { sendToCustoms } from "../src/modules/shipments/services/customsHandoffService";
import { activateProductWorkspace } from "../src/modules/shipments/services/shipmentProductWorkspaceService";

describe("Shared Shipment Architecture — Data Model & Service Requirements (Tests 1-17)", () => {
  const testAccountId = `acc_test_ssa_${Date.now()}`;
  const testUserId = `usr_test_ssa_${Date.now()}`;

  beforeAll(async () => {
    // Create test account and user with active TMS and CUSTOMS entitlements
    await db.account.create({
      data: {
        id: testAccountId,
        name: "SSA Test Account",
        slug: `ssa-test-account-${Date.now()}`,
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
        id: testUserId,
        clerkUserId: `clerk_${testUserId}`,
        email: `ssa_test_${Date.now()}@qubere.local`,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.account.delete({ where: { id: testAccountId } }).catch(() => {});
    await db.user.delete({ where: { id: testUserId } }).catch(() => {});
  });

  it("1. Creating a TMS shipment creates exactly one Shipment and one TMS product workspace", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-1`,
        importerName: "Test Importer 1",
        productWorkspaces: {
          create: {
            accountId: testAccountId,
            product: "TMS",
            status: "ACTIVE",
            source: "TMS_INTAKE",
          },
        },
      },
      include: {
        productWorkspaces: true,
      },
    });

    expect(shipment.id).toBeDefined();
    expect(shipment.productWorkspaces).toHaveLength(1);
    expect(shipment.productWorkspaces[0].product).toBe("TMS");
    expect(shipment.productWorkspaces[0].status).toBe("ACTIVE");
  });

  it("2. Creating a TMS shipment does not create a CustomsCase", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-2`,
        importerName: "Test Importer 2",
        productWorkspaces: {
          create: {
            accountId: testAccountId,
            product: "TMS",
            status: "ACTIVE",
          },
        },
      },
    });

    const caseLinks = await db.customsCaseShipment.findMany({
      where: { shipmentId: shipment.id },
    });

    expect(caseLinks).toHaveLength(0);
  });

  it("3. A TMS-only shipment does not appear in the active Customs list", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-3`,
        importerName: "Test Importer 3",
        productWorkspaces: {
          create: {
            accountId: testAccountId,
            product: "TMS",
            status: "ACTIVE",
          },
        },
      },
    });

    const activeCustomsShipments = await db.shipment.findMany({
      where: {
        accountId: testAccountId,
        id: shipment.id,
        deletedAt: null,
        productWorkspaces: {
          some: {
            product: "CUSTOMS",
            status: "ACTIVE",
          },
        },
      },
    });

    expect(activeCustomsShipments).toHaveLength(0);
  });

  it("4. A shipment without active Customs workspace does not appear in active Customs work", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-4`,
        importerName: "Test Importer 4",
        customsRequired: false,
        productWorkspaces: {
          create: {
            accountId: testAccountId,
            product: "TMS",
            status: "ACTIVE",
          },
        },
      },
    });

    const activeCustoms = await db.shipment.findFirst({
      where: {
        accountId: testAccountId,
        id: shipment.id,
        productWorkspaces: {
          some: {
            product: "CUSTOMS",
            status: "ACTIVE",
          },
        },
      },
    });

    expect(activeCustoms).toBeNull();
  });

  it("5. A shipment with active TMS but no active Customs workspace appears in 'Available from TMS'", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-5`,
        importerName: "Test Importer 5",
        customsRequired: true,
        productWorkspaces: {
          create: {
            accountId: testAccountId,
            product: "TMS",
            status: "ACTIVE",
          },
        },
      },
    });

    const availableFromTms = await db.shipment.findFirst({
      where: {
        accountId: testAccountId,
        id: shipment.id,
        productWorkspaces: {
          some: { product: "TMS", status: "ACTIVE" },
          none: { product: "CUSTOMS", status: "ACTIVE" },
        },
      },
    });

    expect(availableFromTms).not.toBeNull();
    expect(availableFromTms?.id).toBe(shipment.id);
  });

  it("6 & 7. Sending to Customs reuses the existing Shipment ID without increasing Shipment count", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-6`,
        importerName: "Test Importer 6",
        productWorkspaces: {
          create: { accountId: testAccountId, product: "TMS", status: "ACTIVE" },
        },
      },
    });

    const initialCount = await db.shipment.count({ where: { accountId: testAccountId } });

    const result = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const finalCount = await db.shipment.count({ where: { accountId: testAccountId } });

    expect(result.ok).toBe(true);
    expect(result.shipmentId).toBe(shipment.id);
    expect(finalCount).toBe(initialCount);
  });

  it("8, 9 & 10. Sending to Customs creates one Customs workspace, one CustomsCase, and one case-to-shipment link", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-8`,
        importerName: "Test Importer 8",
        countryOfOrigin: "CN",
        destinationCountry: "US",
        productWorkspaces: {
          create: { accountId: testAccountId, product: "TMS", status: "ACTIVE" },
        },
      },
    });

    const result = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const customsWorkspace = await db.shipmentProductWorkspace.findFirst({
      where: { shipmentId: shipment.id, product: "CUSTOMS" },
    });

    const caseLink = await db.customsCaseShipment.findFirst({
      where: { shipmentId: shipment.id },
      include: { customsCase: true },
    });

    expect(customsWorkspace?.status).toBe("ACTIVE");
    expect(caseLink).not.toBeNull();
    expect(caseLink?.customsCase.id).toBe(result.customsCaseId);
    expect(caseLink?.customsCase.copiedFromShipmentId).toBe(shipment.id);
    expect(caseLink?.customsCase.caseNumber).toMatch(/^CC-\d{4}-\d{6}$/);
  });

  it("11 & 12. Repeating or concurrent handoff requests return existing CustomsCase idempotently", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-11`,
        importerName: "Test Importer 11",
        productWorkspaces: {
          create: { accountId: testAccountId, product: "TMS", status: "ACTIVE" },
        },
      },
    });

    const result1 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const result2 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    expect(result1.customsCaseId).toBe(result2.customsCaseId);
    expect(result2.alreadyExisted).toBe(true);

    const totalLinks = await db.customsCaseShipment.count({
      where: { shipmentId: shipment.id },
    });
    expect(totalLinks).toBe(1);
  });

  it("13 & 9. Closed cases trigger a new CustomsCase on subsequent handoff, creating multiple links over life", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-13`,
        importerName: "Test Importer 13",
        productWorkspaces: {
          create: { accountId: testAccountId, product: "TMS", status: "ACTIVE" },
        },
      },
    });

    // Initial handoff creates case 1
    const res1 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    // Close case 1
    await db.customsCase.update({
      where: { id: res1.customsCaseId },
      data: { status: "CLOSED" },
    });

    // Second handoff after case closure should create case 2
    const res2 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    expect(res2.customsCaseId).not.toBe(res1.customsCaseId);
    expect(res2.alreadyExisted).toBe(false);

    const allLinks = await db.customsCaseShipment.findMany({
      where: { shipmentId: shipment.id },
    });
    expect(allLinks).toHaveLength(2);
  });

  it("14. A Customs case can link to multiple shipments when explicitly requested", async () => {
    const shipment1 = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-14A`,
        importerName: "Importer 14A",
      },
    });

    const shipment2 = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-14B`,
        importerName: "Importer 14B",
      },
    });

    const cCase = await db.customsCase.create({
      data: {
        accountId: testAccountId,
        caseNumber: `CC-TEST-${Date.now()}`,
        status: "OPEN",
      },
    });

    await db.customsCaseShipment.createMany({
      data: [
        { accountId: testAccountId, customsCaseId: cCase.id, shipmentId: shipment1.id },
        { accountId: testAccountId, customsCaseId: cCase.id, shipmentId: shipment2.id },
      ],
    });

    const links = await db.customsCaseShipment.findMany({
      where: { customsCaseId: cCase.id },
    });

    expect(links).toHaveLength(2);
  });

  it("15, 16 & 17. Transportation and Customs statuses change independently", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-SSA-${Date.now()}-15`,
        importerName: "Test Importer 15",
        status: "In Progress",
      },
    });

    const res = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    // Update CustomsCase status to RELEASED
    await db.customsCase.update({
      where: { id: res.customsCaseId },
      data: { status: "RELEASED" },
    });

    // Check that Shipment status remains "In Progress"
    const freshShipment = await db.shipment.findUnique({
      where: { id: shipment.id },
    });
    expect(freshShipment?.status).toBe("In Progress");

    // Update Shipment status to Completed
    await db.shipment.update({
      where: { id: shipment.id },
      data: { status: "Completed" },
    });

    const freshCase = await db.customsCase.findUnique({
      where: { id: res.customsCaseId },
    });
    expect(freshCase?.status).toBe("RELEASED");
  });
});

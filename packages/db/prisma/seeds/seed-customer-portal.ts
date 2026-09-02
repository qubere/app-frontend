import { PrismaClient } from "@prisma/client";
import { clientInboundEnabled, issueClientInboundAddress } from "../../src/services/inbound-address-service";

export async function seedCustomerPortalDemoData(db: PrismaClient, accountId?: string) {
  console.log("🌱 Seeding Qubere Customer Portal demo data with Target & Amazon onboarding workflows...");

  // 1. Resolve or create active Account
  let account = await db.account.findFirst({
    where: accountId ? { id: accountId } : { slug: "demo-account" },
  });

  if (!account && accountId) throw new Error("Requested demo account not found");

  if (!account) {
    account = await db.account.create({
      data: {
        name: "Qubere Demo Customs & TMS Brokerage",
        slug: "demo-account",
        dataMode: "DEMO",
        type: "ENTERPRISE",
        status: "ACTIVE",
      },
    });
  }

  // 2. Create Target Corporation Client
  let targetClient = await db.client.findFirst({
    where: { accountId: account.id, name: "Target Corporation" },
  });

  if (!targetClient) {
    targetClient = await db.client.create({
      data: {
        accountId: account.id,
        name: "Target Corporation",
        contactName: "Target Logistics Admin",
        contactEmail: "customs-admin@target.com",
        paymentTermsDays: 30,
        status: "ACTIVE",
      },
    });
  }

  // 3. Create Amazon Import Services Client
  let amazonClient = await db.client.findFirst({
    where: { accountId: account.id, name: "Amazon Import Services" },
  });

  if (!amazonClient) {
    amazonClient = await db.client.create({
      data: {
        accountId: account.id,
        name: "Amazon Import Services",
        contactName: "Amazon Trade Admin",
        contactEmail: "trade-compliance@amazon.com",
        paymentTermsDays: 30,
        status: "ACTIVE",
      },
    });
  }

  if (clientInboundEnabled()) {
    for (const client of [targetClient, amazonClient]) {
      await issueClientInboundAddress({ accountId: account.id, clientId: client.id, label: client.name, senderPolicy: client.id === targetClient.id ? 'ALLOWLIST' : 'REVIEW' }, db);
    }
  }

  // 4. Resolve or create Roles
  const _adminRole = await db.role.findFirst({
    where: { accountId: account.id, name: "CUSTOMER_ADMIN" },
  }) || await db.role.create({
    data: {
      accountId: account.id,
      name: "CUSTOMER_ADMIN",
      description: "Customer Portal Company Administrator",
    },
  });

  const _userRole = await db.role.findFirst({
    where: { accountId: account.id, name: "CUSTOMER_USER" },
  }) || await db.role.create({
    data: {
      accountId: account.id,
      name: "CUSTOMER_USER",
      description: "Customer Portal Shipment Contact",
    },
  });

  // 5. Seed Target Admin & Shipment Contact Users
  const targetAdminUser = await db.user.findFirst({
    where: { email: "customs-admin@target.com" },
  }) || await db.user.create({
    data: {
      clerkUserId: `clerk_demo_target_admin_${Date.now()}`,
      email: "customs-admin@target.com",
      firstName: "Target",
      lastName: "Logistics Admin",
    },
  });

  await db.userClientAssignment.upsert({
    where: { id: `assign_${targetAdminUser.id}_${targetClient.id}` },
    update: {},
    create: {
      id: `assign_${targetAdminUser.id}_${targetClient.id}`,
      userId: targetAdminUser.id,
      clientId: targetClient.id,
    },
  });

  // 6. Seed Target Shipment (SHP-TGT-2026-001)
  let targetShipment = await db.shipment.findFirst({
    where: { accountId: account.id, shipmentNumber: "SHP-TGT-2026-001" },
  });

  if (!targetShipment) {
    targetShipment = await db.shipment.create({
      data: {
        accountId: account.id,
        clientId: targetClient.id,
        shipmentNumber: "SHP-TGT-2026-001",
        poReference: "PO-TARGET-8849",
        importerName: "Target Corporation",
        countryOfExport: "CN",
        destinationCountry: "US",
        portOfEntry: "2704 - Los Angeles/Long Beach",
        transportMode: "Ocean",
        carrierName: "COSCO Shipping",
        status: "In Progress",
        estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // ETA in 3 days
      },
    });
  }

  // 7. Seed "Needs Your Attention" Action Requests
  // Action Item 1: Upload doc-abc for shipment-123
  await db.customerRequest.upsert({
    where: { id: "req_tgt_upload_doc_abc" },
    update: {},
    create: {
      id: "req_tgt_upload_doc_abc",
      accountId: account.id,
      clientId: targetClient.id,
      shipmentId: targetShipment.id,
      domain: "CUSTOMS",
      type: "DOCUMENT",
      title: "Upload Commercial Invoice (doc-abc)",
      description: "CBP requires signed itemized Commercial Invoice (doc-abc) for valuation clearance.",
      status: "OPEN",
      priority: "HIGH",
      dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Due in 1 day
      createdByUserId: targetAdminUser.id,
      messages: {
        create: {
          accountId: account.id,
          clientId: targetClient.id,
          authorUserId: targetAdminUser.id,
          authorType: "BROKER",
          body: "Please upload Commercial Invoice doc-abc for SHP-TGT-2026-001 before ETA on 2026-08-30.",
        },
      },
    },
  });

  // Action Item 2: Update value of field ABC
  await db.customerRequest.upsert({
    where: { id: "req_tgt_field_abc" },
    update: {},
    create: {
      id: "req_tgt_field_abc",
      accountId: account.id,
      clientId: targetClient.id,
      shipmentId: targetShipment.id,
      domain: "CUSTOMS",
      type: "QUESTION",
      title: "Update value of field Manufacturer MID/Address (field-ABC)",
      description: "Please confirm manufacturer name and full address for MID generation on line 2.",
      status: "OPEN",
      priority: "HIGH",
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      createdByUserId: targetAdminUser.id,
      messages: {
        create: {
          accountId: account.id,
          clientId: targetClient.id,
          authorUserId: targetAdminUser.id,
          authorType: "BROKER",
          body: "Line 2 manufacturer address differs from master MID record. Please update field ABC.",
        },
      },
    },
  });

  // Action Item 3: Upload POA document
  await db.customerRequest.upsert({
    where: { id: "req_tgt_poa_upload" },
    update: {},
    create: {
      id: "req_tgt_poa_upload",
      accountId: account.id,
      clientId: targetClient.id,
      domain: "GENERAL",
      type: "CONFIRMATION",
      title: "Upload Power of Attorney (POA) Document",
      description: "Annual Customs Power of Attorney (POA) renewal required for Target Corporation.",
      status: "OPEN",
      priority: "URGENT",
      dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      createdByUserId: targetAdminUser.id,
      messages: {
        create: {
          accountId: account.id,
          clientId: targetClient.id,
          authorUserId: targetAdminUser.id,
          authorType: "BROKER",
          body: "Please upload the signed 2026 Corporate Customs Power of Attorney (POA) document.",
        },
      },
    },
  });

  // 8. Seed Published 7501 Entry Summary & Invoice for Target
  await db.customsFiling.upsert({
    where: { id: "filing_tgt_7501_demo" },
    update: {},
    create: {
      id: "filing_tgt_7501_demo",
      accountId: account.id,
      shipmentId: targetShipment.id,
      entryNumber: "231-0099881-9",
      entryType: "01",
      country: "US",
      filingType: "ENTRY_SUMMARY",
      filingStatus: "Released",
      totalValue: 240000.0,
      totalDuties: 4800.0,
      totalTaxes: 650.0,
      customerVisibleAt: new Date(),
      customerPublishedByUserId: targetAdminUser.id,
    },
  });

  await db.invoice.upsert({
    where: { invoiceNumber: "INV-TGT-2026-901" },
    update: {},
    create: {
      accountId: account.id,
      clientId: targetClient.id,
      invoiceNumber: "INV-TGT-2026-901",
      status: "SENT",
      productLine: "CUSTOMS",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 2850.0,
      totalAmount: 2850.0,
      balanceDue: 2850.0,
      currency: "USD",
      lines: {
        create: {
          shipmentId: targetShipment.id,
          description: "Customs Entry Clearance & Harbor Maintenance Fee Disbursement",
          quantity: 1,
          unitPrice: 2850.0,
          amount: 2850.0,
        },
      },
    },
  });

  console.log("  ✅ Seeded Target & Amazon onboarding demo workflows!");
}

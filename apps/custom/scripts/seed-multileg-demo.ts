import { PrismaClient, LegMode, LegType, LegStatus, LegDocumentRequirement, DocumentType } from "@prisma/client";

const db = new PrismaClient({ log: ["warn", "error"] });

export async function seedMultiLegDemo() {
  console.log("🌱 Seeding Multi-Leg Shipment Demo: SHP-TGT-2026-001...");

  // 1. Find or create Target Corporation account
  let account = await db.account.findFirst({
    where: { OR: [{ id: "cmt4zah2s000hfx0odci3e658" }, { slug: "target" }, { name: { contains: "Target" } }] },
  });

  if (!account) {
    account = await db.account.create({
      data: {
        id: "cmt4zah2s000hfx0odci3e658",
        name: "Target Corporation",
        slug: "target",
        type: "ENTERPRISE",
        status: "ACTIVE",
      },
    });
  }

  console.log(`  Target Account ID: ${account.id} (${account.name})`);

  // Clean up existing demo shipment for this account if present
  const existingShipment = await db.shipment.findFirst({
    where: { accountId: account.id, shipmentNumber: "SHP-TGT-2026-001" },
  });

  if (existingShipment) {
    console.log(`  Cleaning up existing demo shipment SHP-TGT-2026-001 for account ${account.id}...`);
    const sId = existingShipment.id;
    await db.pipelineJob.deleteMany({ where: { shipmentId: sId } });
    await db.agentDecision.deleteMany({ where: { shipmentId: sId } });
    await db.exceptionItem.deleteMany({ where: { shipmentId: sId } });
    await db.customsFiling.deleteMany({ where: { shipmentId: sId } });
    await db.shipmentDocument.deleteMany({ where: { shipmentId: sId } });
    await db.complianceDeadline.deleteMany({ where: { shipmentId: sId } });
    await db.trackingEvent.deleteMany({ where: { shipmentId: sId } });
    await db.etaObservation.deleteMany({ where: { shipmentId: sId } });
    await db.shipmentLegDocument.deleteMany({ where: { leg: { shipmentId: sId } } });
    await db.shipmentLeg.deleteMany({ where: { shipmentId: sId } });
    await db.shipmentStop.deleteMany({ where: { shipmentId: sId } });
    await db.shipmentTrackingIdentifier.deleteMany({ where: { shipmentId: sId } });
    await db.shipment.delete({ where: { id: sId } });
  }

    // 3. Create Shipment
    const shipment = await db.shipment.create({
      data: {
        accountId: account.id,
        shipmentNumber: "SHP-TGT-2026-001",
        importerName: "Target Corporation",
        poReference: "PO-TGT-884129",
        entryType: "01",
        incoterm: "FOB",
        portOfEntry: "2704", // Los Angeles/Long Beach
        carrierName: "COSCO Shipping",
        countryOfExport: "CN",
        countryOfOrigin: "CN",
        destinationCountry: "US",
        transportMode: "Ocean",
        status: "In Progress",
        customsRequired: true,
        currentStage: "COMPLIANCE",
        healthStatus: "At Risk",
        estimatedArrival: new Date("2026-08-31T06:00:00Z"),
        ladingDate: new Date("2026-08-18T10:00:00Z"),
        arrivalDate: new Date("2026-08-31T06:00:00Z"),
      },
    });

    console.log(`  Created Shipment: ${shipment.id} (${shipment.shipmentNumber})`);

    // 4. Create Tracking Identifiers
    await db.shipmentTrackingIdentifier.createMany({
      data: [
        { accountId: account.id, shipmentId: shipment.id, type: "BOOKING", value: "COSU6620149", issuer: "COSCO", isPrimary: false },
        { accountId: account.id, shipmentId: shipment.id, type: "MBL", value: "COSU7223841650", issuer: "COSCO", isPrimary: true },
        { accountId: account.id, shipmentId: shipment.id, type: "HBL", value: "SNKO2208841", issuer: "SINOTRANS", isPrimary: false },
        { accountId: account.id, shipmentId: shipment.id, type: "CONTAINER", value: "CBHU8842190", issuer: "COSCO", isPrimary: false },
        { accountId: account.id, shipmentId: shipment.id, type: "CONTAINER", value: "TCLU7761334", issuer: "COSCO", isPrimary: false },
      ],
    });

    // 5. Create Shared Stops
    const stop1 = await db.shipmentStop.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 1, type: "FACILITY", role: "ORIGIN",
        name: "Shenzhen Factory (Longgang)", unlocode: null, timezone: "Asia/Shanghai",
      },
    });

    const stop2 = await db.shipmentStop.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 2, type: "PORT", role: "PORT_OF_LADING",
        name: "Yantian Port", unlocode: "CNYTN", timezone: "Asia/Shanghai",
      },
    });

    const stop3 = await db.shipmentStop.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 3, type: "PORT", role: "TRANSSHIPMENT",
        name: "Busan Port", unlocode: "KRPUS", timezone: "Asia/Seoul",
      },
    });

    const stop4 = await db.shipmentStop.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 4, type: "PORT", role: "PORT_OF_DISCHARGE",
        name: "Los Angeles / Long Beach (Pier 400)", unlocode: "USLAX", firmsCode: "Y274", timezone: "America/Los_Angeles",
      },
    });

    const stop5 = await db.shipmentStop.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 5, type: "DC", role: "DESTINATION",
        name: "Target Import DC, Rialto CA", unlocode: null, timezone: "America/Los_Angeles",
      },
    });

    console.log("  Created 5 shared stops (4 legs).");

    // 6. Create Documents on file
    const docBooking = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Booking Confirmation",
        documentType: DocumentType.OTHER, fileName: "Booking_COSU6620149.pdf", status: "Received", fileUrl: "/demo/Booking_COSU6620149.pdf",
      },
    });

    const docShippingInst = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Shipping Instructions",
        documentType: DocumentType.OTHER, fileName: "Shipping_Instructions_TGT.pdf", status: "Received", fileUrl: "/demo/Shipping_Instructions_TGT.pdf",
      },
    });

    const docPackingList = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Packing List",
        documentType: DocumentType.PACKING_LIST, fileName: "Packing_List_884129.pdf", status: "Received", fileUrl: "/demo/Packing_List_884129.pdf",
      },
    });

    const docMBL = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Bill of Lading",
        documentType: DocumentType.BILL_OF_LADING, fileName: "MBL_COSU7223841650.pdf", status: "Received", fileUrl: "/demo/MBL_COSU7223841650.pdf",
      },
    });

    const docISF = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "ISF Filing",
        documentType: DocumentType.ISF, fileName: "ISF_10+2_COSU7223841650.pdf", status: "Received", fileUrl: "/demo/ISF_10+2_COSU7223841650.pdf",
      },
    });

    const docCOO = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Certificate of Origin",
        documentType: DocumentType.CERTIFICATE_OF_ORIGIN, fileName: "COO_China_TGT.pdf", status: "Received", fileUrl: "/demo/COO_China_TGT.pdf",
      },
    });

    const docCBP7501 = await db.shipmentDocument.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, docType: "Customs Entry Summary",
        documentType: DocumentType.ENTRY_SUMMARY, fileName: "CBP_7501_Draft.pdf", status: "Received", fileUrl: "/demo/CBP_7501_Draft.pdf",
      },
    });

    // 7. Create 4 ShipmentLegs
    const leg1 = await db.shipmentLeg.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 1, legType: LegType.EXPORT_HAULAGE, mode: LegMode.TRUCK,
        status: LegStatus.COMPLETED, originStopId: stop1.id, destinationStopId: stop2.id,
        carrierName: "Sinotrans Drayage", bookingNumber: "COSU6620149",
        actualDeparture: new Date("2026-08-16T08:00:00Z"), actualArrival: new Date("2026-08-16T14:30:00Z"),
        source: "MANUAL", confirmedAt: new Date(),
      },
    });

    const leg2 = await db.shipmentLeg.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 2, legType: LegType.MAIN_CARRIAGE, mode: LegMode.OCEAN,
        status: LegStatus.COMPLETED, originStopId: stop2.id, destinationStopId: stop3.id,
        carrierName: "COSCO Shipping", carrierScac: "COSU", vesselName: "COSCO SHIPPING ARIES", voyageNumber: "072E",
        billOfLadingNumber: "COSU7223841650", billOfLadingType: "MASTER", bookingNumber: "COSU6620149",
        actualDeparture: new Date("2026-08-18T10:00:00Z"), actualArrival: new Date("2026-08-22T04:15:00Z"),
        source: "MANUAL", confirmedAt: new Date(),
      },
    });

    const leg3 = await db.shipmentLeg.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 3, legType: LegType.TRANSSHIPMENT, mode: LegMode.OCEAN,
        status: LegStatus.IN_TRANSIT, originStopId: stop3.id, destinationStopId: stop4.id,
        carrierName: "COSCO Shipping", carrierScac: "COSU", vesselName: "COSCO SHIPPING LIBRA", voyageNumber: "118E",
        billOfLadingNumber: "COSU7223841650", billOfLadingType: "MASTER", bookingNumber: "COSU6620149",
        actualDeparture: new Date("2026-08-24T18:40:00Z"), estimatedArrival: new Date("2026-08-31T06:00:00Z"), plannedArrival: new Date("2026-08-30T16:00:00Z"),
        source: "MANUAL", confirmedAt: new Date(),
      },
    });

    const leg4 = await db.shipmentLeg.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, sequence: 4, legType: LegType.IMPORT_HAULAGE, mode: LegMode.TRUCK,
        status: LegStatus.PLANNED, originStopId: stop4.id, destinationStopId: stop5.id,
        carrierName: "Hub Group Drayage", carrierScac: "HUBG",
        plannedDeparture: new Date("2026-09-01T08:00:00Z"), plannedArrival: new Date("2026-09-01T14:00:00Z"),
        source: "MANUAL", confirmedAt: new Date(),
      },
    });

    console.log("  Created 4 ShipmentLegs.");

    // 8. Create Leg Document Checklists (ShipmentLegDocument)
    await db.shipmentLegDocument.createMany({
      data: [
        // Leg 1 docs
        { accountId: account.id, legId: leg1.id, documentId: docBooking.id, expectedDocType: DocumentType.OTHER, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Carrier booking confirmation" },
        { accountId: account.id, legId: leg1.id, documentId: docShippingInst.id, expectedDocType: DocumentType.POWER_OF_ATTORNEY, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Export drayage dispatch instructions" },
        { accountId: account.id, legId: leg1.id, documentId: docPackingList.id, expectedDocType: DocumentType.PACKING_LIST, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Container load manifest" },

        // Leg 2 docs
        { accountId: account.id, legId: leg2.id, documentId: docMBL.id, expectedDocType: DocumentType.BILL_OF_LADING, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Ocean master bill of lading" },
        { accountId: account.id, legId: leg2.id, documentId: docISF.id, expectedDocType: DocumentType.ISF, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "US Customs 24h ISF filing" },

        // Leg 3 docs
        { accountId: account.id, legId: leg3.id, documentId: docMBL.id, expectedDocType: DocumentType.BILL_OF_LADING, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Shared MBL for ocean transshipment" },
        { accountId: account.id, legId: leg3.id, documentId: docCOO.id, expectedDocType: DocumentType.CERTIFICATE_OF_ORIGIN, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Country of origin verification" },
        { accountId: account.id, legId: leg3.id, documentId: null, expectedDocType: DocumentType.OTHER, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Arrival notice required prior to POD arrival" }, // MISSING!

        // Leg 4 docs
        { accountId: account.id, legId: leg4.id, documentId: null, expectedDocType: DocumentType.OTHER, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "Delivery order required for terminal gate out" }, // MISSING!
        { accountId: account.id, legId: leg4.id, documentId: docCBP7501.id, expectedDocType: DocumentType.ENTRY_SUMMARY, requirement: LegDocumentRequirement.REQUIRED, requirementReason: "CBP release / 7501" },
        { accountId: account.id, legId: leg4.id, documentId: null, expectedDocType: DocumentType.PROOF_OF_DELIVERY, requirement: LegDocumentRequirement.OPTIONAL, requirementReason: "Final delivery signoff" },
      ],
    });

    console.log("  Created ShipmentLegDocument checklist rows (including 2 missing gaps).");

    // 9. Create Tracking Events
    await db.trackingEvent.createMany({
      data: [
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg1.id, shipmentStopId: stop1.id, eventType: "GATE_IN",
          classifier: "ACTUAL", occurredAt: new Date("2026-08-16T08:00:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-001",
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg2.id, shipmentStopId: stop2.id, eventType: "LOADED_ON_VESSEL",
          classifier: "ACTUAL", occurredAt: new Date("2026-08-17T20:00:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-002",
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg2.id, shipmentStopId: stop2.id, eventType: "VESSEL_DEPARTURE",
          classifier: "ACTUAL", occurredAt: new Date("2026-08-18T10:00:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-003",
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg2.id, shipmentStopId: stop3.id, eventType: "VESSEL_ARRIVAL",
          classifier: "ACTUAL", occurredAt: new Date("2026-08-22T04:15:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-004",
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg3.id, shipmentStopId: stop3.id, eventType: "VESSEL_DEPARTURE",
          classifier: "ACTUAL", occurredAt: new Date("2026-08-24T18:40:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-005",
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg3.id, shipmentStopId: stop4.id, eventType: "VESSEL_ARRIVAL",
          classifier: "ESTIMATED", occurredAt: new Date("2026-08-31T06:00:00Z"), provider: "CARRIER", sourceType: "CARRIER", idempotencyKey: "evt-006",
        },
      ],
    });

    // 10. Create ETA Observations (+14h delay)
    await db.etaObservation.createMany({
      data: [
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg3.id, shipmentStopId: stop4.id,
          estimatedAt: new Date("2026-08-24T12:00:00Z"), eta: new Date("2026-08-30T16:00:00Z"), provider: "CARRIER", confidence: 0.95,
        },
        {
          accountId: account.id, shipmentId: shipment.id, legId: leg3.id, shipmentStopId: stop4.id,
          estimatedAt: new Date("2026-08-27T09:00:00Z"), eta: new Date("2026-08-31T06:00:00Z"), previousEta: new Date("2026-08-30T16:00:00Z"),
          deltaMinutes: 840, provider: "CARRIER", confidence: 0.92, reasonCode: "WEATHER_DELAY",
        },
      ],
    });

    // 11. Create Deadlines & Customs Filing
    await db.complianceDeadline.createMany({
      data: [
        {
          accountId: account.id, shipmentId: shipment.id, type: "ISF_10_2" as any, deadlineClass: "REGULATORY" as any, status: "SATISFIED" as any,
          anchorEvent: "LADING" as any, dueAt: new Date("2026-08-17T10:00:00Z"), estimated: false,
          ruleId: "RULE_ISF_10_2", ruleCitation: "19 CFR 149.2",
        },
        {
          accountId: account.id, shipmentId: shipment.id, type: "ENTRY_FILING" as any, deadlineClass: "REGULATORY" as any, status: "OPEN" as any,
          anchorEvent: "ARRIVAL" as any, dueAt: new Date("2026-09-15T23:59:59Z"), estimated: false,
          ruleId: "RULE_ENTRY_FILING", ruleCitation: "19 CFR 141.68",
        },
        {
          accountId: account.id, shipmentId: shipment.id, type: "LAST_FREE_DAY" as any, deadlineClass: "COMMERCIAL" as any, status: "OPEN" as any,
          anchorEvent: "CARRIER_TERMS" as any, dueAt: new Date("2026-09-03T23:59:59Z"), estimated: true,
          ruleId: "RULE_LAST_FREE_DAY", ruleCitation: "Terminal Tariff",
        },
      ],
    });

    await db.customsFiling.create({
      data: {
        accountId: account.id, shipmentId: shipment.id, filingType: "ENTRY_SUMMARY", filingStatus: "Transmitted",
        entryNumber: "2704-8841920-1",
      },
    });

    // 12. Create open ExceptionItem for missing required leg document so shipment surfaces on Actions page (/app/actions)
    await db.exceptionItem.create({
      data: {
        accountId: account.id,
        shipmentId: shipment.id,
        type: "MISSING_LEG_DOCUMENT",
        severity: "High",
        status: "Open",
        blocking: true,
        description: "Leg 4 (IMPORT_HAULAGE): Missing required Delivery Order for terminal gate out at LA/LB Pier 400.",
      },
    });

    console.log(`✨ Seed complete! Demo Multi-Leg Shipment SHP-TGT-2026-001 is ready under Target account (${account.id}).`);
}

if (require.main === module) {
  seedMultiLegDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}

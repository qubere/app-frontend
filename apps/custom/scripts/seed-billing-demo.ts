/**
 * scripts/seed-billing-demo.ts
 *
 * Real, database-seeded demo data for the Billing module (customs-brokerage
 * SaaS). Directly models the Acceptance Scenario in
 * docs/requirements/billing-costing-invoicing-profitability.md §51 so the
 * demo can honestly be presented as "this is literally our own product
 * spec, running live."
 *
 * What this creates (idempotent — safe to re-run):
 *  - Account "ABC Customs Brokers" (ENTERPRISE)
 *  - 3 demo internal Users (billing admin / billing manager / broker) used
 *    as createdById/approvedById/requestedById/userId actors
 *  - 3 Clients, each with an ImporterOfRecord:
 *      - Acme Manufacturing   — healthy margin, matches spec §51 exactly
 *      - Meridian Apparel Group — underpriced rate card, one shipment with
 *        deliberately negative gross margin
 *      - Northstar Electronics — third client, portfolio filler
 *  - One account CostProfile
 *  - Rate cards (RateCard + RateCardVersion + RateRule +
 *    RateRuleCapabilityMapping), ACTIVE v1 for each client, plus a DRAFT v2
 *    for Acme (renegotiated Additional Lines rate) for Rate Simulation demo
 *  - 10 Shipments (2-4 per client) with ShipmentLineItems
 *  - Real UsageEvents recorded via the actual `recordUsageEvent()` entry
 *    point (packages/billing/src/telemetry.ts), which internally calls the
 *    real rating engine (evaluateAndRateUsageEvent) and costing engine
 *    (calculateAndRecordEventCost) — no charge/cost amounts are hand-written.
 *  - One ChargeAdjustment (discount) via the same math the real
 *    adjustShipmentChargeAction uses
 *  - 4 Invoices spanning the full lifecycle (PAID, SENT+PARTIALLY_PAID,
 *    SENT+overdue+unpaid, PENDING_APPROVAL) via the real
 *    createInvoiceFromCharges / recordInvoicePayment functions
 *  - One live BillingException (CONDITION_FIELD_MISSING), created by the
 *    real rating engine when a CONDITIONAL rate rule fires against a usage
 *    event missing the referenced metadata field
 *
 * Run with (from repo root):
 *   npx tsx apps/custom/scripts/seed-billing-demo.ts
 *
 * Then re-run the multirole setup so Frank (multirole@qubere.ai) gets an
 * OWNER membership + CUSTOMS/TMS entitlements on the new account:
 *   npx tsx apps/custom/scripts/setup-multirole-user.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@qubere/db";
import {
  seedBillingEventDefinitions,
  recordUsageEvent,
  createInvoiceFromCharges,
  recordInvoicePayment,
  runRateSimulation,
  type RecordUsageEventInput,
} from "@qubere/billing";

// ---------------------------------------------------------------------------
// Guard rails
// ---------------------------------------------------------------------------

function assertNotProduction() {
  const url = process.env.DATABASE_URL ?? "";
  if (/app\.qubere\.ai/i.test(url)) {
    throw new Error("SECURITY_VIOLATION: refusing to seed demo billing data against app.qubere.ai");
  }
}
assertNotProduction();

// ---------------------------------------------------------------------------
// Small date helpers so usage events / invoices are spread over ~60 days
// ---------------------------------------------------------------------------

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Billing demo data for ABC Customs Brokers...\n");

  // 1. Account -------------------------------------------------------------
  let account = await db.account.findFirst({ where: { name: "ABC Customs Brokers", type: "ENTERPRISE" } });
  if (!account) {
    account = await db.account.create({
      data: {
        name: "ABC Customs Brokers",
        slug: `abc-customs-brokers-${Date.now()}`,
        type: "ENTERPRISE",
        status: "ACTIVE",
      },
    });
    console.log(`Created account "ABC Customs Brokers" (${account.id})`);
  } else {
    console.log(`Reusing existing account "ABC Customs Brokers" (${account.id})`);
  }
  const accountId = account.id;

  // Product entitlements so the account can actually see the Billing/Customs UI
  for (const product of ["CUSTOMS", "TMS"]) {
    await db.accountProductEntitlement.upsert({
      where: { accountId_product: { accountId, product } },
      update: { status: "ACTIVE" },
      create: { accountId, product, status: "ACTIVE" },
    });
  }

  // 2. Demo internal users (actors for createdById / approvedById / userId) --
  async function upsertDemoUser(email: string, firstName: string, lastName: string, clerkUserId: string) {
    return db.user.upsert({
      where: { email },
      update: { firstName, lastName },
      create: { email, firstName, lastName, clerkUserId },
    });
  }
  const priya = await upsertDemoUser("priya.shah@abccustomsbrokers-demo.local", "Priya", "Shah", "demo_abc_priya_shah");
  const marcus = await upsertDemoUser("marcus.webb@abccustomsbrokers-demo.local", "Marcus", "Webb", "demo_abc_marcus_webb");
  const jordan = await upsertDemoUser("jordan.reyes@abccustomsbrokers-demo.local", "Jordan", "Reyes", "demo_abc_jordan_reyes");
  console.log(`Demo actors ready: Priya Shah (Billing Admin, ${priya.id}), Marcus Webb (Billing Manager, ${marcus.id}), Jordan Reyes (Broker, ${jordan.id})`);

  // 3. CostProfile -----------------------------------------------------------
  let costProfile = await db.costProfile.findFirst({ where: { accountId }, orderBy: { createdAt: "desc" } });
  const costProfileData = {
    name: "Standard 2026 Cost Profile",
    loadedLaborRate: 73.0,
    aiTokenRate: 0.075,
    ocrPageRate: 0.18,
    aceTransmissionFee: 4.0,
  };
  if (!costProfile) {
    costProfile = await db.costProfile.create({ data: { accountId, ...costProfileData } });
    console.log(`Created CostProfile (${costProfile.id})`);
  } else {
    costProfile = await db.costProfile.update({ where: { id: costProfile.id }, data: costProfileData });
    console.log(`Reused/updated CostProfile (${costProfile.id})`);
  }

  // 4. Billing event catalog (real platform capability catalog) -------------
  await seedBillingEventDefinitions(accountId);
  const defs = await db.billingEventDefinition.findMany({ where: { accountId } });
  const defByCode = new Map(defs.map((d) => [`${d.eventCode}:${d.productLine}`, d.id]));
  function eventDefId(code: string): string {
    const id = defByCode.get(`${code}:CUSTOMS`);
    if (!id) throw new Error(`Missing BillingEventDefinition for ${code} (run seedBillingEventDefinitions first)`);
    return id;
  }
  console.log(`Billing event catalog ready (${defs.length} definitions)`);

  // 5. Clients + Importers of Record -----------------------------------------
  async function upsertClient(name: string, contactName: string, contactEmail: string) {
    let client = await db.client.findFirst({ where: { accountId, name } });
    if (!client) {
      client = await db.client.create({
        data: { accountId, name, contactName, contactEmail, billingContactName: contactName, billingContactEmail: contactEmail, paymentTermsDays: 30, status: "ACTIVE" },
      });
    }
    return client;
  }
  async function upsertImporter(name: string, irsEin: string, cbpImporterNumber: string, clientId: string, city: string, state: string) {
    return db.importerOfRecord.upsert({
      where: { cbpImporterNumber },
      update: { clientId },
      create: {
        accountId,
        name,
        irsEin,
        cbpImporterNumber,
        clientId,
        address: { street: "1 Trade Way", city, state, zip: "00000", country: "USA" },
      },
    });
  }

  const acme = await upsertClient("Acme Manufacturing", "David Chen", "billing@acme-manufacturing-demo.local");
  const acmeIor = await upsertImporter("Acme Manufacturing Ltd", "94-1234567", "ACMEIOR0001", acme.id, "Cleveland", "OH");

  const meridian = await upsertClient("Meridian Apparel Group", "Lena Ortiz", "billing@meridian-apparel-demo.local");
  const meridianIor = await upsertImporter("Meridian Apparel Group Inc", "83-2345678", "MERIDIOR0002", meridian.id, "Charlotte", "NC");

  const northstar = await upsertClient("Northstar Electronics", "Raj Patel", "billing@northstar-electronics-demo.local");
  const northstarIor = await upsertImporter("Northstar Electronics Corp", "77-3456789", "NSTARIOR0003", northstar.id, "San Jose", "CA");

  console.log(`Clients ready: Acme Manufacturing (${acme.id}), Meridian Apparel Group (${meridian.id}), Northstar Electronics (${northstar.id})`);

  // 6. Rate cards --------------------------------------------------------------
  interface RuleSpec {
    lineItemName: string;
    serviceCode: string;
    pricingModel: string;
    unit: string;
    rate: number;
    includedQuantity?: number;
    conditions?: unknown;
    eventCodes: string[];
  }

  async function ensureRateCard(params: {
    clientId: string;
    name: string;
    description: string;
    rules: RuleSpec[];
  }) {
    let card = await db.rateCard.findFirst({ where: { accountId, clientId: params.clientId, name: params.name } });
    if (card) return card;

    card = await db.rateCard.create({
      data: {
        accountId,
        clientId: params.clientId,
        name: params.name,
        description: params.description,
        currency: "USD",
        isDefault: false,
        currentVersion: 1,
        status: "ACTIVE",
        createdById: priya.id,
        versions: {
          create: [
            {
              version: 1,
              effectiveDate: daysAgo(90),
              status: "ACTIVE",
              activatedAt: daysAgo(90),
              activatedById: marcus.id,
              createdById: priya.id,
              notes: "Initial rate card",
              rules: {
                create: params.rules.map((r) => ({
                  lineItemName: r.lineItemName,
                  serviceCode: r.serviceCode,
                  pricingModel: r.pricingModel as never,
                  unit: r.unit,
                  rate: r.rate,
                  currency: "USD",
                  includedQuantity: r.includedQuantity ?? 0,
                  conditions: r.conditions ? (r.conditions as never) : undefined,
                  isBillable: true,
                })),
              },
            },
          ],
        },
      },
    });

    // Wire capability mappings now that rule ids exist
    const version = await db.rateCardVersion.findFirstOrThrow({
      where: { rateCardId: card.id, version: 1 },
      include: { rules: true },
    });
    for (const rule of version.rules) {
      const spec = params.rules.find((r) => r.serviceCode === rule.serviceCode);
      if (!spec) continue;
      for (const code of spec.eventCodes) {
        await db.rateRuleCapabilityMapping.upsert({
          where: { rateRuleId_eventDefId: { rateRuleId: rule.id, eventDefId: eventDefId(code) } },
          update: {},
          create: { rateRuleId: rule.id, eventDefId: eventDefId(code) },
        });
      }
    }
    console.log(`Created ACTIVE rate card "${params.name}" (${card.id}) with ${params.rules.length} rules`);
    return card;
  }

  const acmeRushSurchargeConditions = [{ field: "metadata.priorityLevel", operator: "eq", value: "RUSH" }];

  const acmeRuleSpecs: RuleSpec[] = [
    { lineItemName: "Entry Processing", serviceCode: "ENTRY_PROCESSING", pricingModel: "FLAT_FEE", unit: "shipment", rate: 125.0, eventCodes: ["CUSTOMS_ENTRY_COMPLETED"] },
    { lineItemName: "Additional Lines", serviceCode: "ADDL_LINES", pricingModel: "PER_UNIT", unit: "line", rate: 4.0, includedQuantity: 5, eventCodes: ["HTS_CLASSIFICATION_COMPLETED"] },
    { lineItemName: "Human Classification Review", serviceCode: "HUMAN_HTS_REVIEW", pricingModel: "PER_SUCCESSFUL_OUTCOME", unit: "review", rate: 20.0, eventCodes: ["HTS_MANUAL_REVIEW_COMPLETED"] },
    { lineItemName: "PGA Processing", serviceCode: "PGA_PROCESSING", pricingModel: "PER_TRANSACTION", unit: "entry", rate: 35.0, eventCodes: ["PGA_PROCESSING_COMPLETED"] },
    { lineItemName: "Rush Reconciliation Surcharge", serviceCode: "RUSH_RECON", pricingModel: "CONDITIONAL", unit: "shipment", rate: 50.0, conditions: acmeRushSurchargeConditions, eventCodes: ["RECONCILIATION_COMPLETED"] },
  ];
  const acmeCard = await ensureRateCard({
    clientId: acme.id,
    name: "Acme Manufacturing 2026 Standard",
    description: "Matches docs/requirements §51 acceptance scenario exactly: Entry $125, first 5 lines included, Additional Lines $4/line, Human Classification Review $20, PGA Processing $35.",
    rules: acmeRuleSpecs,
  });

  const meridianRuleSpecs: RuleSpec[] = [
    { lineItemName: "Entry Processing", serviceCode: "ENTRY_PROCESSING", pricingModel: "FLAT_FEE", unit: "shipment", rate: 60.0, eventCodes: ["CUSTOMS_ENTRY_COMPLETED"] },
    { lineItemName: "Additional Lines", serviceCode: "ADDL_LINES", pricingModel: "PER_UNIT", unit: "line", rate: 1.75, includedQuantity: 5, eventCodes: ["HTS_CLASSIFICATION_COMPLETED"] },
    { lineItemName: "Human Classification Review", serviceCode: "HUMAN_HTS_REVIEW", pricingModel: "PER_SUCCESSFUL_OUTCOME", unit: "review", rate: 12.0, eventCodes: ["HTS_MANUAL_REVIEW_COMPLETED"] },
    { lineItemName: "PGA Processing", serviceCode: "PGA_PROCESSING", pricingModel: "PER_TRANSACTION", unit: "entry", rate: 18.0, eventCodes: ["PGA_PROCESSING_COMPLETED"] },
  ];
  const meridianCard = await ensureRateCard({
    clientId: meridian.id,
    name: "Meridian Apparel Group 2026 Standard",
    description: "Legacy apparel-vertical pricing — underpriced relative to loaded labor cost for manual HTS review; drives negative shipment margin on high-touch entries.",
    rules: meridianRuleSpecs,
  });

  const northstarRuleSpecs: RuleSpec[] = [
    { lineItemName: "Entry Processing", serviceCode: "ENTRY_PROCESSING", pricingModel: "FLAT_FEE", unit: "shipment", rate: 110.0, eventCodes: ["CUSTOMS_ENTRY_COMPLETED"] },
    { lineItemName: "Additional Lines", serviceCode: "ADDL_LINES", pricingModel: "PER_UNIT", unit: "line", rate: 4.5, includedQuantity: 4, eventCodes: ["HTS_CLASSIFICATION_COMPLETED"] },
    { lineItemName: "Human Classification Review", serviceCode: "HUMAN_HTS_REVIEW", pricingModel: "PER_SUCCESSFUL_OUTCOME", unit: "review", rate: 22.0, eventCodes: ["HTS_MANUAL_REVIEW_COMPLETED"] },
    { lineItemName: "PGA Processing", serviceCode: "PGA_PROCESSING", pricingModel: "PER_TRANSACTION", unit: "entry", rate: 30.0, eventCodes: ["PGA_PROCESSING_COMPLETED"] },
  ];
  const northstarCard = await ensureRateCard({
    clientId: northstar.id,
    name: "Northstar Electronics 2026 Standard",
    description: "Electronics-vertical rate card, healthy margin.",
    rules: northstarRuleSpecs,
  });

  // Acme DRAFT v2 — renegotiated Additional Lines rate, for Rate Simulation demo
  let acmeV2 = await db.rateCardVersion.findFirst({ where: { rateCardId: acmeCard.id, version: 2 } });
  if (!acmeV2) {
    const v1 = await db.rateCardVersion.findFirstOrThrow({
      where: { rateCardId: acmeCard.id, version: 1 },
      include: { rules: { include: { capabilityMappings: true } } },
    });
    acmeV2 = await db.rateCardVersion.create({
      data: {
        rateCardId: acmeCard.id,
        version: 2,
        effectiveDate: daysFromNow(30),
        status: "DRAFT",
        createdById: priya.id,
        notes: "Proposed 2027 renegotiation: raise Additional Lines from $4.00 to $5.50/line to offset classification volume growth.",
        rules: {
          create: v1.rules.map((r) => ({
            lineItemName: r.lineItemName,
            serviceCode: r.serviceCode,
            pricingModel: r.pricingModel,
            unit: r.unit,
            rate: r.serviceCode === "ADDL_LINES" ? 5.5 : Number(r.rate),
            currency: r.currency,
            includedQuantity: r.includedQuantity,
            conditions: r.conditions ?? undefined,
            isBillable: r.isBillable,
          })),
        },
      },
      include: { rules: true },
    });
    // Re-wire capability mappings for the clone
    const v1Rules = v1.rules;
    for (let i = 0; i < v1Rules.length; i++) {
      const source = v1Rules[i];
      const target = acmeV2.rules[i];
      for (const mapping of source.capabilityMappings) {
        await db.rateRuleCapabilityMapping.upsert({
          where: { rateRuleId_eventDefId: { rateRuleId: target.id, eventDefId: mapping.eventDefId } },
          update: {},
          create: { rateRuleId: target.id, eventDefId: mapping.eventDefId },
        });
      }
    }
    await db.rateCard.update({ where: { id: acmeCard.id }, data: { currentVersion: 2 } });
    console.log(`Created DRAFT v2 of Acme's rate card (${acmeV2.id}) — Additional Lines $4.00 -> $5.50`);
  } else {
    console.log(`Reusing existing DRAFT v2 of Acme's rate card (${acmeV2.id})`);
  }

  // 7. Shipments + line items ---------------------------------------------------
  interface LineItemSpec {
    description: string;
    hts: string;
    origin: string;
    unitPrice: number;
  }

  const industrialParts: LineItemSpec[] = [
    { description: "Stainless Steel Valve 1/2\" NPT, 316 Grade", hts: "8481.80.5090", origin: "Germany", unitPrice: 42.5 },
    { description: "Hydraulic Cylinder Assembly", hts: "8412.21.0075", origin: "Italy", unitPrice: 310.0 },
    { description: "Precision Ball Bearing 6205-2RS", hts: "8482.10.5044", origin: "Japan", unitPrice: 8.75 },
    { description: "Aluminum Extrusion Profile, 6061-T6", hts: "7604.29.3060", origin: "Canada", unitPrice: 21.2 },
    { description: "Carbon Steel Pipe Flange, Class 150", hts: "7307.91.5030", origin: "South Korea", unitPrice: 36.0 },
    { description: "Pneumatic Rotary Actuator", hts: "8412.31.0080", origin: "Germany", unitPrice: 185.0 },
    { description: "Helical Gear Reducer Unit", hts: "8483.40.5010", origin: "Italy", unitPrice: 420.0 },
    { description: "Industrial Proximity Sensor Module", hts: "9031.80.8085", origin: "Japan", unitPrice: 64.3 },
    { description: "Flexible Motor Coupling", hts: "8483.60.8000", origin: "Mexico", unitPrice: 27.9 },
    { description: "Galvanized Steel Conveyor Roller", hts: "8431.39.0010", origin: "China", unitPrice: 19.4 },
    { description: "Welded Steel Mounting Bracket", hts: "7326.90.8688", origin: "Mexico", unitPrice: 6.15 },
    { description: "Hex Socket Cap Screw Set, A2 Stainless", hts: "7318.15.2065", origin: "Taiwan", unitPrice: 3.4 },
  ];
  const apparel: LineItemSpec[] = [
    { description: "Men's Cotton Crew Neck T-Shirt", hts: "6109.10.0012", origin: "Bangladesh", unitPrice: 2.85 },
    { description: "Women's Denim Jacket", hts: "6202.92.2010", origin: "Vietnam", unitPrice: 14.5 },
    { description: "Polyester Athletic Shorts", hts: "6103.43.1520", origin: "Cambodia", unitPrice: 3.2 },
    { description: "Wool Blend Overcoat", hts: "6202.11.0000", origin: "Vietnam", unitPrice: 38.0 },
    { description: "Kids' Fleece Pullover Hoodie", hts: "6110.30.3053", origin: "Bangladesh", unitPrice: 6.1 },
    { description: "Genuine Leather Belt", hts: "4203.30.0000", origin: "India", unitPrice: 5.4 },
    { description: "Cotton Canvas Tote Bag", hts: "4202.92.3131", origin: "India", unitPrice: 2.1 },
    { description: "Acrylic Knit Beanie Cap", hts: "6505.00.6090", origin: "China", unitPrice: 1.35 },
    { description: "Nylon Packable Windbreaker", hts: "6201.93.3511", origin: "Vietnam", unitPrice: 9.75 },
    { description: "Cotton Blend Crew Socks, 6-Pack", hts: "6115.95.6000", origin: "Pakistan", unitPrice: 3.6 },
  ];
  const electronics: LineItemSpec[] = [
    { description: "USB-C Braided Charging Cable, 2m", hts: "8544.42.9090", origin: "China", unitPrice: 1.9 },
    { description: "Bluetooth 5.3 Wireless Earbuds", hts: "8518.30.2000", origin: "Vietnam", unitPrice: 8.4 },
    { description: "Lithium-Ion Battery Pack, 10000mAh", hts: "8507.60.0020", origin: "South Korea", unitPrice: 6.75 },
    { description: "LED Display Module, 5.5in", hts: "8531.20.0040", origin: "China", unitPrice: 12.3 },
    { description: "Populated Circuit Board Assembly", hts: "8534.00.0040", origin: "Taiwan", unitPrice: 22.0 },
    { description: "Switching Power Supply Unit, 65W", hts: "8504.40.9520", origin: "China", unitPrice: 5.6 },
    { description: "HDMI to USB-C Adapter", hts: "8544.42.9090", origin: "China", unitPrice: 1.4 },
    { description: "Dual-Band Wireless Router", hts: "8517.62.0090", origin: "Taiwan", unitPrice: 18.9 },
    { description: "Smart Home Motion Sensor", hts: "8531.80.9051", origin: "South Korea", unitPrice: 4.5 },
    { description: "Portable USB-C Power Bank, 20000mAh", hts: "8507.60.0020", origin: "China", unitPrice: 9.1 },
  ];

  async function ensureShipment(params: {
    shipmentNumber: string;
    clientId: string;
    importerOfRecordId: string;
    importerName: string;
    lineCount: number;
    pool: LineItemSpec[];
  }) {
    const shipment = await db.shipment.upsert({
      where: { accountId_shipmentNumber: { accountId, shipmentNumber: params.shipmentNumber } },
      update: {},
      create: {
        accountId,
        shipmentNumber: params.shipmentNumber,
        importerName: params.importerName,
        clientId: params.clientId,
        importerOfRecordId: params.importerOfRecordId,
        assignedBrokerId: jordan.id,
        entryType: "Consumption",
        incoterm: "FOB",
        portOfEntry: "Los Angeles, CA",
        carrierName: "Pacific Star Line",
        countryOfExport: params.pool[0].origin,
        countryOfOrigin: params.pool[0].origin,
        destinationCountry: "US",
        transportMode: "Ocean",
        invoiceCurrency: "USD",
        status: "Completed",
        customsRequired: true,
        currentStage: "READY_TO_FILE",
        healthStatus: "Healthy",
        readinessScore: 100,
        riskScore: 12,
        ownerName: "Jordan Reyes",
      },
    });

    const existingLineCount = await db.shipmentLineItem.count({ where: { shipmentId: shipment.id } });
    if (existingLineCount === 0) {
      const rows = Array.from({ length: params.lineCount }, (_, i) => {
        const item = params.pool[i % params.pool.length];
        const qty = 50 + ((i * 17) % 150);
        return {
          shipmentId: shipment.id,
          accountId,
          lineNumber: i + 1,
          description: item.description,
          quantity: qty,
          unitPrice: item.unitPrice,
          totalValue: Math.round(item.unitPrice * qty * 100) / 100,
          countryOfOrigin: item.origin,
          htsCode: item.hts,
          htsConfidence: 92,
          status: "Valid",
        };
      });
      await db.shipmentLineItem.createMany({ data: rows });
    }
    return shipment;
  }

  // 8. Usage-event recording helper (calls the REAL rating/costing engine) ----
  let eventSeq = 0;
  async function recordEventAt(input: RecordUsageEventInput, occurredAt: Date) {
    eventSeq += 1;
    const result = await recordUsageEvent(input);
    await db.usageEvent.update({
      where: { id: result.usageEvent.id },
      data: { occurredAt, createdAt: occurredAt },
    });
    return result;
  }

  interface EventSpec {
    eventCode: string;
    quantity: number;
    automated: boolean;
    success?: boolean;
    processingDuration?: number;
    userId?: string;
    metadata?: Record<string, unknown>;
    sourceFunction: string;
    sourceAgent?: string;
  }

  async function recordShipmentEvents(shipmentNumber: string, shipmentId: string, clientId: string, importerId: string, baseDate: Date, events: EventSpec[]) {
    let hour = 0;
    for (const ev of events) {
      hour += 1;
      const occurredAt = new Date(baseDate);
      occurredAt.setHours(9 + hour, 0, 0, 0);
      const idempotencyKey = `billing-demo:${shipmentNumber}:${ev.eventCode}:${eventSeq}`;
      await recordEventAt(
        {
          accountId,
          eventCode: ev.eventCode,
          clientId,
          importerId,
          shipmentId,
          userId: ev.userId,
          quantity: ev.quantity,
          sourceFunction: ev.sourceFunction,
          sourceAgent: ev.sourceAgent,
          success: ev.success ?? true,
          automated: ev.automated,
          processingDuration: ev.processingDuration,
          idempotencyKey,
          metadata: ev.metadata,
        },
        occurredAt
      );
    }
  }

  // --- Acme Manufacturing shipments -------------------------------------------
  const acmeShp001 = await ensureShipment({ shipmentNumber: "SHP-2026-ACM001", clientId: acme.id, importerOfRecordId: acmeIor.id, importerName: acmeIor.name, lineCount: 12, pool: industrialParts });
  await recordShipmentEvents("SHP-2026-ACM001", acmeShp001.id, acme.id, acmeIor.id, daysAgo(50), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 18, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "PRODUCT_NORMALIZATION_COMPLETED", quantity: 12, automated: true, sourceFunction: "productIntelligenceAgent.normalize", sourceAgent: "Product Intelligence Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 12, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 45600 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 900_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "ORIGIN_DETERMINATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "originRulesAgent.determine", sourceAgent: "Origin Rules Agent" },
    { eventCode: "VALUATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "valuationAssistsAgent.calculate", sourceAgent: "Valuation & Assists Agent" },
    { eventCode: "COMPLIANCE_REVIEW_COMPLETED", quantity: 1, automated: true, sourceFunction: "complianceAuditAgent.review", sourceAgent: "Compliance Audit Agent", metadata: { tokenCount: 46800 } },
    { eventCode: "FILING_READINESS_COMPLETED", quantity: 1, automated: true, sourceFunction: "filingReadinessAgent.assess", sourceAgent: "Filing Readiness Agent" },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  const acmeShp002 = await ensureShipment({ shipmentNumber: "SHP-2026-ACM002", clientId: acme.id, importerOfRecordId: acmeIor.id, importerName: acmeIor.name, lineCount: 8, pool: industrialParts });
  await recordShipmentEvents("SHP-2026-ACM002", acmeShp002.id, acme.id, acmeIor.id, daysAgo(35), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 15, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 8, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 30400 } },
    { eventCode: "ORIGIN_DETERMINATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "originRulesAgent.determine", sourceAgent: "Origin Rules Agent" },
    { eventCode: "VALUATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "valuationAssistsAgent.calculate", sourceAgent: "Valuation & Assists Agent" },
    { eventCode: "FILING_READINESS_COMPLETED", quantity: 1, automated: true, sourceFunction: "filingReadinessAgent.assess", sourceAgent: "Filing Readiness Agent" },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  const acmeShp003 = await ensureShipment({ shipmentNumber: "SHP-2026-ACM003", clientId: acme.id, importerOfRecordId: acmeIor.id, importerName: acmeIor.name, lineCount: 6, pool: industrialParts });
  await recordShipmentEvents("SHP-2026-ACM003", acmeShp003.id, acme.id, acmeIor.id, daysAgo(18), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 12, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 6, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 22800 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 600_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "ORIGIN_DETERMINATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "originRulesAgent.determine", sourceAgent: "Origin Rules Agent" },
    { eventCode: "FILING_READINESS_COMPLETED", quantity: 1, automated: true, sourceFunction: "filingReadinessAgent.assess", sourceAgent: "Filing Readiness Agent" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  // Dedicated exception-demo shipment: RECONCILIATION_COMPLETED without the
  // metadata field the CONDITIONAL "Rush Reconciliation Surcharge" rule
  // requires -> real rating engine raises a live BillingException.
  const acmeShp004 = await ensureShipment({ shipmentNumber: "SHP-2026-ACM004", clientId: acme.id, importerOfRecordId: acmeIor.id, importerName: acmeIor.name, lineCount: 5, pool: industrialParts });
  await recordShipmentEvents("SHP-2026-ACM004", acmeShp004.id, acme.id, acmeIor.id, daysAgo(5), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 8, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 5, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 19000 } },
    { eventCode: "RECONCILIATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "reconciliationAgent.reconcile", sourceAgent: "Reconciliation Agent", metadata: {} },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  // --- Meridian Apparel Group shipments ---------------------------------------
  const merShp001 = await ensureShipment({ shipmentNumber: "SHP-2026-MER001", clientId: meridian.id, importerOfRecordId: meridianIor.id, importerName: meridianIor.name, lineCount: 8, pool: apparel });
  await recordShipmentEvents("SHP-2026-MER001", merShp001.id, meridian.id, meridianIor.id, daysAgo(45), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 14, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 8, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 20000 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 1_200_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "ORIGIN_DETERMINATION_COMPLETED", quantity: 1, automated: true, sourceFunction: "originRulesAgent.determine", sourceAgent: "Origin Rules Agent" },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  // Deliberately negative-margin shipment: 3 lengthy manual reviews at a
  // rate card price ($12) far below loaded labor cost (~$54.75 each @ 45min).
  const merShp002 = await ensureShipment({ shipmentNumber: "SHP-2026-MER002", clientId: meridian.id, importerOfRecordId: meridianIor.id, importerName: meridianIor.name, lineCount: 10, pool: apparel });
  await recordShipmentEvents("SHP-2026-MER002", merShp002.id, meridian.id, meridianIor.id, daysAgo(28), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 16, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 10, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 25000 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 2_700_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);
  // Two more manual reviews on the same shipment (separate usage events —
  // PER_SUCCESSFUL_OUTCOME is not a once-per-shipment pricing model).
  for (const suffix of ["b", "c"]) {
    eventSeq += 1;
    const occurredAt = daysAgo(28, 15);
    await recordEventAt(
      {
        accountId,
        eventCode: "HTS_MANUAL_REVIEW_COMPLETED",
        clientId: meridian.id,
        importerId: meridianIor.id,
        shipmentId: merShp002.id,
        userId: jordan.id,
        quantity: 1,
        sourceFunction: "broker.manualReview",
        success: true,
        automated: false,
        processingDuration: 2_700_000,
        idempotencyKey: `billing-demo:SHP-2026-MER002:HTS_MANUAL_REVIEW_COMPLETED:${suffix}`,
      },
      occurredAt
    );
  }

  const merShp003 = await ensureShipment({ shipmentNumber: "SHP-2026-MER003", clientId: meridian.id, importerOfRecordId: meridianIor.id, importerName: meridianIor.name, lineCount: 6, pool: apparel });
  await recordShipmentEvents("SHP-2026-MER003", merShp003.id, meridian.id, meridianIor.id, daysAgo(10), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 10, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 6, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 15000 } },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  // --- Northstar Electronics shipments -----------------------------------------
  const nstShp001 = await ensureShipment({ shipmentNumber: "SHP-2026-NST001", clientId: northstar.id, importerOfRecordId: northstarIor.id, importerName: northstarIor.name, lineCount: 9, pool: electronics });
  await recordShipmentEvents("SHP-2026-NST001", nstShp001.id, northstar.id, northstarIor.id, daysAgo(55), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 13, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 9, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 27000 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 900_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  const nstShp002 = await ensureShipment({ shipmentNumber: "SHP-2026-NST002", clientId: northstar.id, importerOfRecordId: northstarIor.id, importerName: northstarIor.name, lineCount: 7, pool: electronics });
  await recordShipmentEvents("SHP-2026-NST002", nstShp002.id, northstar.id, northstarIor.id, daysAgo(22), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 11, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 7, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 21000 } },
    { eventCode: "PGA_PROCESSING_COMPLETED", quantity: 1, automated: true, sourceFunction: "pgaProcessing.validate" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  const nstShp003 = await ensureShipment({ shipmentNumber: "SHP-2026-NST003", clientId: northstar.id, importerOfRecordId: northstarIor.id, importerName: northstarIor.name, lineCount: 5, pool: electronics });
  await recordShipmentEvents("SHP-2026-NST003", nstShp003.id, northstar.id, northstarIor.id, daysAgo(3), [
    { eventCode: "CUSTOMS_ENTRY_COMPLETED", quantity: 1, automated: true, sourceFunction: "entrySummary.process" },
    { eventCode: "DOCUMENT_PROCESSED", quantity: 9, automated: true, sourceFunction: "documentIntakeAgent.process", sourceAgent: "Document Intake Agent" },
    { eventCode: "HTS_CLASSIFICATION_COMPLETED", quantity: 5, automated: true, sourceFunction: "htsClassificationAgent.classify", sourceAgent: "HTS Classification Agent", metadata: { tokenCount: 15000 } },
    { eventCode: "HTS_MANUAL_REVIEW_COMPLETED", quantity: 1, automated: false, processingDuration: 600_000, userId: jordan.id, sourceFunction: "broker.manualReview" },
    { eventCode: "ACE_FILING_TRANSMITTED", quantity: 1, automated: true, sourceFunction: "aceGateway.transmit" },
  ]);

  console.log("\nAll shipments + usage events recorded (real rating/costing engine applied).\n");

  // 9. ChargeAdjustment — $10 discount on Acme SHP-002's Entry Processing charge
  const entryChargeShp002 = await db.shipmentCharge.findFirst({
    where: { shipmentId: acmeShp002.id, rateRule: { serviceCode: "ENTRY_PROCESSING" } },
  });
  if (entryChargeShp002) {
    const existingAdjustment = await db.chargeAdjustment.findFirst({ where: { chargeId: entryChargeShp002.id } });
    if (!existingAdjustment && entryChargeShp002.status === "RATED" && !entryChargeShp002.invoiceLineId) {
      const currentNet = Number(entryChargeShp002.netAmount);
      const gross = Number(entryChargeShp002.grossAmount);
      const discountAmount = 10;
      const newNet = Math.max(0, currentNet - discountAmount);
      const newDiscountTotal = Math.max(0, gross - newNet);
      await db.$transaction(async (tx) => {
        await tx.chargeAdjustment.create({
          data: {
            chargeId: entryChargeShp002.id,
            adjustmentType: "DISCOUNT",
            originalAmount: currentNet,
            adjustmentAmount: -discountAmount,
            newAmount: newNet,
            reason: "Loyalty discount — Q3 volume commitment (per account manager agreement)",
            requestedById: priya.id,
            approvedById: null,
            approvalStatus: "APPROVED",
          },
        });
        await tx.shipmentCharge.update({
          where: { id: entryChargeShp002.id },
          data: { discountAmount: newDiscountTotal, netAmount: newNet },
        });
      });
      console.log(`Applied $10 discount to Acme SHP-2026-ACM002 Entry Processing charge (${entryChargeShp002.id}): $${gross.toFixed(2)} -> $${newNet.toFixed(2)}`);
    } else {
      console.log("Discount on Acme SHP-2026-ACM002 already applied (or charge no longer adjustable) — skipping.");
    }
  }

  // 10. Invoices spanning the full lifecycle -------------------------------------
  // Idempotency note: on re-run, this shipment's charges are already INVOICED
  // (not RATED), so we must first check whether an invoice already covers
  // these shipments (via any existing charge's invoiceLine) before looking
  // for freshly-RATED charges to invoice.
  async function getOrCreateInvoiceForShipments(params: { clientId: string; shipmentIds: string[]; dueDate: Date; notes: string }) {
    const already = await db.shipmentCharge.findFirst({
      where: { shipmentId: { in: params.shipmentIds }, invoiceLineId: { not: null } },
      select: { invoiceLine: { select: { invoiceId: true } } },
    });
    if (already?.invoiceLine) {
      return db.invoice.findUniqueOrThrow({ where: { id: already.invoiceLine.invoiceId } });
    }

    const ratedCharges = await db.shipmentCharge.findMany({
      where: { shipmentId: { in: params.shipmentIds }, status: "RATED" },
      select: { id: true },
    });
    if (!ratedCharges.length) return null;

    return createInvoiceFromCharges({
      accountId,
      clientId: params.clientId,
      chargeIds: ratedCharges.map((c) => c.id),
      dueDate: params.dueDate,
      notes: params.notes,
      createdById: priya.id,
    });
  }

  const STATUS_ORDER = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"];
  async function advanceTo(invoiceId: string, status: string, extra: Record<string, unknown> = {}) {
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (["PAID", "PARTIALLY_PAID", "VOID"].includes(inv.status)) return;
    if (STATUS_ORDER.indexOf(inv.status) < STATUS_ORDER.indexOf(status)) {
      await db.invoice.update({ where: { id: invoiceId }, data: { status: status as never, ...extra } });
    }
  }
  async function ensurePayment(invoiceId: string, amount: number, method: string, referenceNo: string, notes: string) {
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (Number(inv.paidAmount) > 0 || Number(inv.balanceDue) <= 0) return;
    const payAmount = Math.min(amount, Number(inv.balanceDue));
    await recordInvoicePayment({ accountId, invoiceId, amount: payAmount, paymentMethod: method, referenceNo, notes });
  }

  // Invoice 1 — PAID (Acme SHP-001, the exact spec §51 scenario: $208)
  const inv1 = await getOrCreateInvoiceForShipments({ clientId: acme.id, shipmentIds: [acmeShp001.id], dueDate: daysAgo(-10), notes: "[DEMO] Acme SHP-2026-ACM001 — spec §51 acceptance scenario" });
  if (inv1) {
    await db.invoice.update({ where: { id: inv1.id }, data: { issueDate: daysAgo(40) } });
    await advanceTo(inv1.id, "PENDING_APPROVAL");
    await advanceTo(inv1.id, "APPROVED", { approvedById: marcus.id });
    await advanceTo(inv1.id, "SENT", { sentById: marcus.id });
    const invNow = await db.invoice.findUniqueOrThrow({ where: { id: inv1.id } });
    await ensurePayment(inv1.id, Number(invNow.totalAmount), "ACH", "ACH-DEMO-0001", "Paid in full via ACH");
  }

  // Invoice 2 — SENT + PARTIALLY_PAID (Acme SHP-002, discounted Entry Processing)
  const inv2 = await getOrCreateInvoiceForShipments({ clientId: acme.id, shipmentIds: [acmeShp002.id], dueDate: daysFromNow(10), notes: "[DEMO] Acme SHP-2026-ACM002 — discount applied to Entry Processing" });
  if (inv2) {
    await db.invoice.update({ where: { id: inv2.id }, data: { issueDate: daysAgo(20) } });
    await advanceTo(inv2.id, "PENDING_APPROVAL");
    await advanceTo(inv2.id, "APPROVED", { approvedById: marcus.id });
    await advanceTo(inv2.id, "SENT", { sentById: marcus.id });
    await ensurePayment(inv2.id, 100, "Wire", "WIRE-DEMO-0002", "Partial payment received");
  }

  // Invoice 3 — SENT, unpaid, dueDate in the past (derived overdue). Meridian.
  const inv3 = await getOrCreateInvoiceForShipments({ clientId: meridian.id, shipmentIds: [merShp001.id, merShp003.id], dueDate: daysAgo(20), notes: "[DEMO] Meridian SHP-2026-MER001 + SHP-2026-MER003" });
  if (inv3) {
    await db.invoice.update({ where: { id: inv3.id }, data: { issueDate: daysAgo(35) } });
    await advanceTo(inv3.id, "PENDING_APPROVAL");
    await advanceTo(inv3.id, "APPROVED", { approvedById: marcus.id });
    await advanceTo(inv3.id, "SENT", { sentById: marcus.id });
  }

  // Invoice 4 — PENDING_APPROVAL, awaiting action (Acme SHP-003)
  const inv4 = await getOrCreateInvoiceForShipments({ clientId: acme.id, shipmentIds: [acmeShp003.id], dueDate: daysFromNow(30), notes: "[DEMO] Acme SHP-2026-ACM003 — awaiting approval" });
  if (inv4) {
    await advanceTo(inv4.id, "PENDING_APPROVAL");
  }

  console.log("\nInvoices created/verified for all 4 lifecycle states.\n");

  // 11. Rate simulation smoke test (does not persist anything) -------------------
  if (acmeV2) {
    const sim = await runRateSimulation({ accountId, proposedRateCardVersionId: acmeV2.id, months: 3 });
    console.log("Rate simulation (Acme DRAFT v2 vs last 3 months of actuals):");
    console.log(`  Actual revenue:   $${sim.actualRevenue.toFixed(2)}`);
    console.log(`  Proposed revenue: $${sim.proposedRevenue.toFixed(2)}`);
    console.log(`  Delta:            $${sim.delta.toFixed(2)} (${sim.deltaPercent?.toFixed(1) ?? "n/a"}%)`);
  }

  // 12. Verification queries ------------------------------------------------------
  console.log("\n--- Verification ---");
  const exceptions = await db.billingException.findMany({ where: { accountId, status: "OPEN" } });
  console.log(`Open BillingExceptions: ${exceptions.length}`);
  for (const ex of exceptions) console.log(`  - [${ex.type}] ${ex.description}`);

  for (const [label, inv] of [
    ["PAID", inv1],
    ["PARTIALLY_PAID", inv2],
    ["overdue SENT", inv3],
    ["PENDING_APPROVAL", inv4],
  ] as const) {
    if (!inv) continue;
    const full = await db.invoice.findUniqueOrThrow({
      where: { id: inv.id },
      include: { lines: true, payments: true },
    });
    const lineSum = full.lines.reduce((s, l) => s + Number(l.amount), 0);
    const consistent = Math.abs(lineSum - Number(full.totalAmount)) < 0.01;
    console.log(
      `Invoice ${full.invoiceNumber} [${label} -> actual status ${full.status}]: total=$${Number(full.totalAmount).toFixed(2)} paid=$${Number(full.paidAmount).toFixed(2)} balanceDue=$${Number(full.balanceDue).toFixed(2)} lineSum=$${lineSum.toFixed(2)} ${consistent ? "OK" : "MISMATCH"}`
    );
  }

  const shp001Summary = await db.shipmentCharge.findMany({ where: { shipmentId: acmeShp001.id }, include: { rateRule: true } });
  const shp001CostSummary = await db.shipmentCost.findMany({ where: { shipmentId: acmeShp001.id } });
  const totalCharge = shp001Summary.reduce((s, c) => s + Number(c.netAmount), 0);
  const totalCost = shp001CostSummary.reduce((s, c) => s + Number(c.amount), 0);
  console.log(`\nSHP-2026-ACM001 (spec §51 scenario): Charges=$${totalCharge.toFixed(2)} (spec expects $208.00), Cost=$${totalCost.toFixed(2)} (spec expects $32.42), Gross Profit=$${(totalCharge - totalCost).toFixed(2)}, Margin=${(((totalCharge - totalCost) / totalCharge) * 100).toFixed(1)}%`);

  const merShp002Charges = await db.shipmentCharge.findMany({ where: { shipmentId: merShp002.id } });
  const merShp002Costs = await db.shipmentCost.findMany({ where: { shipmentId: merShp002.id } });
  const merRevenue = merShp002Charges.reduce((s, c) => s + Number(c.netAmount), 0);
  const merCost = merShp002Costs.reduce((s, c) => s + Number(c.amount), 0);
  console.log(`SHP-2026-MER002 (negative-margin demo): Revenue=$${merRevenue.toFixed(2)}, Cost=$${merCost.toFixed(2)}, Gross Profit=$${(merRevenue - merCost).toFixed(2)} (${merRevenue < merCost ? "NEGATIVE MARGIN as intended" : "WARNING: not negative"})`);

  console.log("\nDone. Now run: npx tsx apps/custom/scripts/setup-multirole-user.ts\n");

  return { accountId, accountSlug: account.slug, inv1, inv2, inv3, inv4, acmeCard, acmeShp001 };
}

main()
  .catch((err) => {
    console.error("Billing demo seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

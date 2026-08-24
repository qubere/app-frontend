import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    shipment: { findUnique: vi.fn() },
    usageEvent: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@qubere/db", () => ({ db: mockDb }));

import { getShipmentFinancialSummary } from "@qubere/billing/ledger";
import { recordInvoicePayment } from "@qubere/billing/invoicing";

describe("broker billing ledger integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the real ledger function across revenue, costs, AR, and filing taxes", async () => {
    mockDb.shipment.findUnique.mockResolvedValue({
      shipmentCharges: [
        { status: "INVOICED", grossAmount: new Prisma.Decimal(208), discountAmount: new Prisma.Decimal(10), netAmount: new Prisma.Decimal(198), invoiceLineId: "line-1", invoiceLine: { invoice: { status: "PARTIALLY_PAID" } } },
      ],
      shipmentCosts: [
        { costType: "TECH", amount: new Prisma.Decimal("12.42") },
        { costType: "LABOR", amount: new Prisma.Decimal(20) },
      ],
      lineItems: [{ dutyStack: { total: 100, mpf: 5, hmf: 2 } }],
      customsFilings: [{ grandTotalDutyAmount: new Prisma.Decimal(100), grandTotalIrTaxAmount: new Prisma.Decimal(7), grandTotalOtherRevenueAmount: new Prisma.Decimal(3), totalDuties: null, totalTaxes: null }],
    });

    const summary = await getShipmentFinancialSummary("shipment-a");
    expect(summary).toMatchObject({
      shipmentId: "shipment-a",
      netRevenue: 198,
      totalCost: 32.42,
      grossProfit: 165.57999999999998,
      customsEconomics: { duty: 100, mpf: 5, hmf: 2, taxes: 7, otherFees: 3, totalPassThrough: 117 },
      arStatus: { accrued: 198, invoiced: 198, paid: 0, outstanding: 198 },
    });
    expect(summary?.grossMarginPct).toBeCloseTo(83.626, 2);
  });

  it("supports partial payment and rejects overpayment in the real payment service", async () => {
    const tx = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({ paidAmount: new Prisma.Decimal(0), balanceDue: new Prisma.Decimal(198), totalAmount: new Prisma.Decimal(198) }),
        update: vi.fn(),
      },
      payment: { create: vi.fn().mockResolvedValue({ id: "payment-1" }) },
    };
    mockDb.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));

    await expect(recordInvoicePayment({ accountId: "account-a", invoiceId: "invoice-a", amount: 100, paymentMethod: "ACH" })).resolves.toEqual({ id: "payment-1" });
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PARTIALLY_PAID" }) }));

    tx.invoice.findFirst.mockResolvedValueOnce({ paidAmount: new Prisma.Decimal(0), balanceDue: new Prisma.Decimal(50), totalAmount: new Prisma.Decimal(50) });
    await expect(recordInvoicePayment({ accountId: "account-a", invoiceId: "invoice-a", amount: 51, paymentMethod: "ACH" })).rejects.toThrow("cannot exceed");
  });
});

describe("billing readiness contracts", () => {
  const repoRoot = join(process.cwd(), "../..");
  const permissions = readFileSync(join(repoRoot, "packages/auth/src/permissions.ts"), "utf8");
  const schema = readFileSync(join(repoRoot, "packages/db/prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(repoRoot, "packages/db/prisma/migrations/20260824150000_billing_broker_readiness/migration.sql"), "utf8");
  const billingDefinitionRepair = readFileSync(join(repoRoot, "packages/db/prisma/scripts/repair-billing-event-definitions.sql"), "utf8");
  const actions = readFileSync(join(process.cwd(), "src/app/app/billing/actions.ts"), "utf8");
  const pipeline = readFileSync(join(process.cwd(), "src/modules/agents/pipelineOrchestrator.ts"), "utf8");

  it("keeps maker/checker grants separate for creation and approval", () => {
    expect(permissions).toContain('name: "billing.invoice.create"');
    expect(permissions).toContain('name: "billing.invoice.approve"');
    expect(permissions).toContain('name: "billing.ratecard.activate"');
    expect(permissions).toContain("BILLING_USERS");
    expect(permissions).toContain("BILLING_MANAGERS");
    expect(actions).toContain('requireBillingPermission("billing.invoice.create")');
    expect(actions).toContain('requireBillingPermission("billing.ratecard.activate")');
  });

  it("database schema guarantees event linkage, retry safety, and financial checks", () => {
    expect(schema).toContain("@@unique([accountId, eventCode, productLine])");
    expect(schema).toContain("usageEventId      String?          @unique");
    expect(schema).toContain("@@unique([usageEventId, costType])");
    expect(schema).toContain("usageEvent     UsageEvent?");
    expect(migration).toContain("ShipmentCharge_nonnegative_amounts_check");
    expect(migration).toContain("Invoice_nonnegative_amounts_check");
    expect(migration).toContain("BillingException_usageEventId_fkey");
  });

  it("backfills account-scoped billing definitions before enforcing the usage-event FK", () => {
    const backfill = migration.indexOf('INSERT INTO "BillingEventDefinition"');
    const mappingRepair = migration.indexOf('UPDATE "RateRuleCapabilityMapping"');
    const foreignKey = migration.indexOf('ADD CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey"');

    expect(backfill).toBeGreaterThan(-1);
    expect(mappingRepair).toBeGreaterThan(backfill);
    expect(foreignKey).toBeGreaterThan(mappingRepair);
    expect(migration).toContain('ON CONFLICT ("accountId", "eventCode", "productLine") DO NOTHING');
    expect(billingDefinitionRepair).toContain('VALIDATE CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey"');
    expect(billingDefinitionRepair).not.toMatch(/DELETE FROM|TRUNCATE TABLE/i);
  });

  it("rate activation expires the prior active version", () => {
    expect(actions).toContain("rateCardVersion.updateMany");
    expect(actions).toContain("expirationDate: version.effectiveDate");
  });

  it("pipeline emission remains source-idempotent", () => {
    expect(pipeline).toContain("recordUsageEvent");
    expect(pipeline).toMatch(/idempotencyKey:\s*`billing:\$\{runId\}:\$\{agentName\}`/);
  });
});

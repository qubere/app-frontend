// Multi-tenant isolation coverage for the Billing module.
//
// Mirrors the conventions already established in tests/tenant-isolation-routes.test.ts
// (fake lookups + `rejects.toMatchObject`), tests/product-tenant-isolation.test.ts and
// tests/party-tenant-isolation.test.ts (source-level static scans reading the shipped
// files), and tests/billing-readiness.test.ts / tests/billing-invoice-lifecycle.test.ts
// (mocking @/lib/db and @qubere/db to exercise the real action/engine functions).
//
// Covers every billing-relevant model: RateCard, RateCardVersion, RateRule, UsageEvent,
// ShipmentCharge, ShipmentCost, ChargeAdjustment, Invoice, InvoiceLine, Payment,
// BillingException, BillingEventDefinition, CostProfile — plus the rate-card resolution
// hierarchy (packages/billing/src/ratingEngine.ts) and the Clients section / reports
// aggregate added in the multi-customer work.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";

// ---------------------------------------------------------------------------
// Shared source-reading helpers
// ---------------------------------------------------------------------------

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

const BILLING_APP_DIR = join(process.cwd(), "src/app/app/billing");
const BILLING_API_DIR = join(process.cwd(), "src/app/api/billing");
const BILLING_ENGINE_DIR = join(process.cwd(), "../../packages/billing/src");

const billingSourceFiles = [
  ...sourceFiles(BILLING_APP_DIR),
  ...sourceFiles(BILLING_API_DIR),
  ...sourceFiles(BILLING_ENGINE_DIR),
];

function read(file: string) {
  return readFileSync(file, "utf8");
}

/**
 * Extracts the full, brace-balanced argument text of every `db.<model>.<method>(...)`
 * call in `source`. Regex alone cannot capture nested `{ ... }` reliably, so this walks
 * parens by hand — the same shape of guarantee tenant-isolation-routes.test.ts makes
 * ("no route resolves with an unscoped findUnique"), generalized across all 13 billing
 * models and every read/write method instead of one hardcoded string per file.
 */
function extractModelCalls(source: string, model: string, methods: string[]): string[] {
  const calls: string[] = [];
  for (const method of methods) {
    const needle = `db.${model}.${method}(`;
    let idx = 0;
    while (true) {
      const start = source.indexOf(needle, idx);
      if (start === -1) break;
      const openParen = start + needle.length - 1;
      let depth = 0;
      let i = openParen;
      for (; i < source.length; i++) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      calls.push(source.slice(openParen, i + 1));
      idx = i + 1;
    }
  }
  return calls;
}

// Calls that read/mutate exactly one row by id and therefore MUST scope by the caller's
// account (directly, or via a parent relation) or a foreign id can be reached.
const SINGLE_ROW_METHODS = ["findUnique", "findFirst"];

// Documented exceptions: internal engine calls that operate on an id the engine itself
// just minted in the same call chain (never a caller-supplied cross-tenant id), so they
// cannot be used to probe another tenant's data even though the literal `where` has no
// accountId. Format: "<file basename>::<model>.<method>".
const SAFE_UNSCOPED_SINGLE_ROW_LOOKUPS = new Set([
  "ratingEngine.ts::usageEvent.findUnique", // evaluateAndRateUsageEvent(usageEventId) — id is always the just-created event's own id
  "costingEngine.ts::usageEvent.findUnique", // calculateAndRecordEventCost(usageEventId) — same
  "telemetry.ts::usageEvent.findUnique", // recordUsageEvent's idempotencyKey lookup — globally unique by design; ownership is verified immediately after (see dedicated test below) before any cached data is returned
]);

describe("tenant isolation: billing model reads are account-scoped (static scan)", () => {
  const BILLING_MODELS = [
    "rateCard",
    "rateCardVersion",
    "rateRule",
    "usageEvent",
    "shipmentCharge",
    "shipmentCost",
    "chargeAdjustment",
    "invoice",
    "invoiceLine",
    "payment",
    "billingException",
    "billingEventDefinition",
    "costProfile",
  ];

  it("has billing source files to scan", () => {
    expect(billingSourceFiles.length).toBeGreaterThan(15);
  });

  for (const model of BILLING_MODELS) {
    it(`${model}: every single-row lookup (findUnique/findFirst) is scoped by accountId, directly or via a parent relation`, () => {
      const offenders: string[] = [];
      for (const file of billingSourceFiles) {
        const source = read(file);
        const calls = extractModelCalls(source, model, SINGLE_ROW_METHODS);
        for (const call of calls) {
          if (call.includes("accountId")) continue;
          const basename = file.split("/").pop();
          // Try both method names for the documented-exception key.
          const isDocumentedSafe =
            SAFE_UNSCOPED_SINGLE_ROW_LOOKUPS.has(`${basename}::${model}.findUnique`) ||
            SAFE_UNSCOPED_SINGLE_ROW_LOOKUPS.has(`${basename}::${model}.findFirst`);
          if (isDocumentedSafe) continue;
          offenders.push(`${file}: ${call.slice(0, 120)}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it("InvoiceLine is never queried directly by id — it has no accountId column, so a direct lookup would be unscoped by construction; it must only ever be reached through a parent Invoice that is already accountId-scoped", () => {
    const offenders: string[] = [];
    for (const file of billingSourceFiles) {
      const source = read(file);
      if (/db\.invoiceLine\.(findFirst|findUnique|findMany)\(/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("the usage-event idempotency lookup (unscoped by design — idempotencyKey is globally unique) verifies account ownership immediately after, before returning cached data", () => {
    const telemetry = read(join(BILLING_ENGINE_DIR, "telemetry.ts"));
    expect(telemetry).toMatch(/idempotencyKey:\s*input\.idempotencyKey/);
    expect(telemetry).toContain("existing.accountId !== input.accountId");
    expect(telemetry).toContain("Billing idempotency key collision across accounts");
  });

  it("BillingEventDefinition creates always stamp the row with the caller's own accountId, never a caller-supplied value", () => {
    const offenders: string[] = [];
    for (const file of billingSourceFiles) {
      const source = read(file);
      for (const call of extractModelCalls(source, "billingEventDefinition", ["create", "upsert"])) {
        const match = call.match(/accountId:\s*([\w.]+)/);
        if (!match) continue;
        const value = match[1];
        if (!/^(accountId|ctx\.accountId|context\.accountId|input\.accountId)$/.test(value)) {
          offenders.push(`${file}: accountId: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("regression guard: BillingEventDefinition lookups by eventCode are scoped to the caller's account (the fixed cross-tenant bug)", () => {
    // Prior to the fix, actions.ts and rate-cards/import/actions.ts resolved billing
    // event definitions by eventCode+productLine with NO accountId filter. Because every
    // account seeds an identical catalog (seedBillingEventDefinitions), any two tenants
    // end up with distinct rows sharing the same eventCode — an unscoped findMany could
    // return another tenant's row and link this tenant's RateRule to it.
    const actions = read(join(BILLING_APP_DIR, "actions.ts"));
    const importActions = read(join(BILLING_APP_DIR, "rate-cards/import/actions.ts"));
    for (const source of [actions, importActions]) {
      const calls = extractModelCalls(source, "billingEventDefinition", ["findMany"]);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(call).toMatch(/accountId:\s*(context|ctx)\.accountId/);
    }
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests: real action/engine functions against a mocked db + auth,
// proving a foreign-tenant id is rejected as "not found" rather than acted on.
// ---------------------------------------------------------------------------

const { authState, mockDb, auditLog } = vi.hoisted(() => ({
  authState: { accountId: "account-a", userId: "user-a" },
  auditLog: vi.fn(),
  mockDb: {
    rateCard: { findFirst: vi.fn() },
    rateCardVersion: { findFirst: vi.fn() },
    rateRule: { findFirst: vi.fn() },
    shipmentCharge: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    billingException: { findFirst: vi.fn(), updateMany: vi.fn() },
    billingEventDefinition: { findMany: vi.fn() },
    rateCardVersionMock: null as unknown,
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn(async () => ({ accountId: authState.accountId, userId: authState.userId })),
  hasPermission: vi.fn(async () => true),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: (...args: unknown[]) => auditLog(...args) }));
vi.mock("@/lib/billing/invoicing", () => ({
  createInvoiceFromCharges: vi.fn(),
  recordInvoicePayment: vi.fn(),
}));
vi.mock("@/lib/billing/telemetry", () => ({ seedBillingEventDefinitions: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: mockDb,
  withAccountIdContext: vi.fn(async (_accountId: string, cb: () => unknown) => cb()),
  runWithAccountId: vi.fn(async (_accountId: string, cb: () => unknown) => cb()),
}));

import { retireRateCardAction, addDraftRateRuleAction, updateDraftRateRuleAction, saveRateRuleMappingsAction } from "@/app/app/billing/actions";
import { adjustShipmentChargeAction } from "@/app/app/billing/charges/[id]/actions";
import { resolveExceptionAction } from "@/app/app/billing/exceptions/actions";
import { submitInvoiceForApprovalAction } from "@/app/app/billing/invoices/[id]/actions";
import { createImportedRateCardAction } from "@/app/app/billing/rate-cards/import/actions";

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("tenant isolation: billing actions reject a foreign tenant's id as not found", () => {
  beforeEach(() => {
    authState.accountId = ACCOUNT_A;
    authState.userId = "user-a";
    vi.clearAllMocks();
    // Default: every scoped lookup finds nothing, simulating what Prisma returns
    // once the accountId filter excludes a foreign-tenant row.
    mockDb.rateCard.findFirst.mockResolvedValue(null);
    mockDb.rateCardVersion.findFirst.mockResolvedValue(null);
    mockDb.rateRule.findFirst.mockResolvedValue(null);
    mockDb.shipmentCharge.findFirst.mockResolvedValue(null);
    mockDb.invoice.findFirst.mockResolvedValue(null);
    mockDb.billingException.findFirst.mockResolvedValue(null);
  });

  it("RateCard: retireRateCardAction rejects an id belonging to another account", async () => {
    await expect(retireRateCardAction("card-owned-by-account-b")).rejects.toThrow("Rate card not found");
    expect(mockDb.rateCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "card-owned-by-account-b", accountId: ACCOUNT_A } })
    );
  });

  it("RateCardVersion: addDraftRateRuleAction rejects a version belonging to another account's rate card", async () => {
    await expect(
      addDraftRateRuleAction("version-owned-by-account-b", {
        lineItemName: "X",
        serviceCode: "X",
        pricingModel: "PER_UNIT",
        unit: "unit",
        rate: 1,
      })
    ).rejects.toThrow("Rate card version not found");
    expect(mockDb.rateCardVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "version-owned-by-account-b", rateCard: { accountId: ACCOUNT_A } },
      })
    );
  });

  it("RateRule: updateDraftRateRuleAction rejects a rule belonging to another account's rate card", async () => {
    await expect(updateDraftRateRuleAction("rule-owned-by-account-b", { rate: 10 })).rejects.toThrow("Rate rule not found");
    expect(mockDb.rateRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-owned-by-account-b", rateCardVersion: { rateCard: { accountId: ACCOUNT_A } } },
      })
    );
  });

  it("ShipmentCharge / ChargeAdjustment: adjustShipmentChargeAction rejects a charge belonging to another account, and never creates an adjustment against it", async () => {
    await expect(
      adjustShipmentChargeAction("charge-owned-by-account-b", fd({ adjustmentType: "DISCOUNT", reason: "test", amount: "5" }))
    ).rejects.toThrow("Charge not found");
    expect(mockDb.shipmentCharge.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "charge-owned-by-account-b", accountId: ACCOUNT_A } })
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("Invoice: submitInvoiceForApprovalAction rejects an invoice belonging to another account", async () => {
    await expect(submitInvoiceForApprovalAction("invoice-owned-by-account-b")).rejects.toThrow("Invoice not found");
    expect(mockDb.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invoice-owned-by-account-b", accountId: ACCOUNT_A } })
    );
  });

  it("BillingException: resolveExceptionAction rejects an exception belonging to another account, and never updates it", async () => {
    await expect(resolveExceptionAction("exception-owned-by-account-b", fd({ reason: "test" }))).rejects.toThrow(
      "Billing exception not found"
    );
    expect(mockDb.billingException.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "exception-owned-by-account-b", accountId: ACCOUNT_A } })
    );
    expect(mockDb.billingException.updateMany).not.toHaveBeenCalled();
  });

  it("RateRule: saveRateRuleMappingsAction rejects a rule belonging to another account before ever touching BillingEventDefinition", async () => {
    await expect(saveRateRuleMappingsAction("rule-owned-by-account-b", ["DOCUMENT_PROCESSED"])).rejects.toThrow(
      "Rate rule not found"
    );
    expect(mockDb.billingEventDefinition.findMany).not.toHaveBeenCalled();
  });

  // ── The bug: BillingEventDefinition lookups were not scoped by accountId ──────
  //
  // Every account seeds an identical event-code catalog (seedBillingEventDefinitions),
  // so once two accounts exist, the same eventCode has one BillingEventDefinition row
  // per account. An unscoped findMany({ where: { eventCode: { in }, productLine } })
  // can return rows from every account that has seeded that code, and the resulting
  // `Map(eventCode -> id)` can pick a foreign row's id — silently linking this
  // tenant's RateRule to another tenant's BillingEventDefinition. Fixed in
  // src/app/app/billing/actions.ts and src/app/app/billing/rate-cards/import/actions.ts
  // by adding `accountId: context.accountId` to the where clause.

  it("saveRateRuleMappingsAction: links the mapping only to this account's BillingEventDefinition row, never another tenant's, even when both seeded the same eventCode", async () => {
    mockDb.rateRule.findFirst.mockResolvedValue({ id: "rule-1", lineItemName: "Doc Processing", productLine: "CUSTOMS" });
    // Simulates the real Prisma behavior: the where clause's accountId filter excludes
    // the foreign row. If the source ever regresses to an unscoped query, this fixture
    // would need to return BOTH rows for the assertion below to still pass — but the
    // explicit `where` assertion catches that regression directly.
    mockDb.billingEventDefinition.findMany.mockImplementation(async ({ where }: any) => {
      const catalog = [
        { id: "def-account-a", accountId: "account-a", eventCode: "DOCUMENT_PROCESSED" },
        { id: "def-account-b", accountId: "account-b", eventCode: "DOCUMENT_PROCESSED" },
      ];
      return catalog.filter(
        (row) => where.eventCode.in.includes(row.eventCode) && row.accountId === where.accountId
      );
    });
    const tx = { rateRuleCapabilityMapping: { deleteMany: vi.fn(), createMany: vi.fn() } };
    mockDb.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));

    await saveRateRuleMappingsAction("rule-1", ["DOCUMENT_PROCESSED"]);

    expect(mockDb.billingEventDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: ACCOUNT_A }) })
    );
    expect(tx.rateRuleCapabilityMapping.createMany).toHaveBeenCalledWith({
      data: [{ rateRuleId: "rule-1", eventDefId: "def-account-a" }],
    });
  });

  it("createImportedRateCardAction: links the imported rule's capability mapping only to this account's BillingEventDefinition row", async () => {
    const created: any[] = [];
    mockDb.rateCard.findFirst.mockResolvedValue(null); // unused by this action
    (mockDb as any).rateCard.create = vi.fn(async ({ data }: any) => {
      created.push(data);
      return { id: "new-card" };
    });
    mockDb.billingEventDefinition.findMany.mockImplementation(async ({ where }: any) => {
      const catalog = [
        { id: "def-account-a", accountId: "account-a", eventCode: "DOCUMENT_PROCESSED" },
        { id: "def-account-b", accountId: "account-b", eventCode: "DOCUMENT_PROCESSED" },
      ];
      return catalog.filter(
        (row) => where.eventCode.in.includes(row.eventCode) && row.accountId === where.accountId
      );
    });

    await createImportedRateCardAction({
      name: "Imported Card",
      lines: [
        {
          lineItemName: "Document Processing",
          serviceCode: "DOC",
          pricingModel: "PER_UNIT",
          unit: "page",
          rate: 1,
          eventCode: "DOCUMENT_PROCESSED",
        },
      ],
    });

    expect(mockDb.billingEventDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: ACCOUNT_A }) })
    );
    const eventDefId = created[0]?.versions?.create?.[0]?.rules?.create?.[0]?.capabilityMappings?.create?.[0]?.eventDefId;
    expect(eventDefId).toBe("def-account-a");
  });
});

// ---------------------------------------------------------------------------
// Payment: recordInvoicePayment (packages/billing/src/invoicing.ts) verifies
// invoice ownership before ever creating a Payment row.
// ---------------------------------------------------------------------------

describe("tenant isolation: Payment creation is gated on invoice ownership", () => {
  it("rejects paying an invoice that does not belong to the caller's account, and never creates a Payment", async () => {
    vi.resetModules();
    const txFindFirst = vi.fn(async ({ where }: any) =>
      // Simulates Prisma's accountId filter: the invoice exists, but under a different account.
      where.accountId === "account-a" && where.id === "invoice-owned-by-account-b" ? null : null
    );
    const paymentCreate = vi.fn();
    vi.doMock("@qubere/db", () => ({
      db: {
        $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
          cb({ invoice: { findFirst: txFindFirst, update: vi.fn() }, payment: { create: paymentCreate } })
        ),
      },
    }));
    const { recordInvoicePayment } = await import("@qubere/billing/invoicing");

    await expect(
      recordInvoicePayment({
        accountId: "account-a",
        invoiceId: "invoice-owned-by-account-b",
        amount: 50,
        paymentMethod: "ACH",
      })
    ).rejects.toThrow("Invoice not found");
    expect(txFindFirst).toHaveBeenCalledWith({ where: { id: "invoice-owned-by-account-b", accountId: "account-a" } });
    expect(paymentCreate).not.toHaveBeenCalled();
    vi.doUnmock("@qubere/db");
  });
});

// ---------------------------------------------------------------------------
// Rate-card resolution hierarchy: resolveActiveRateCardVersion
// (packages/billing/src/ratingEngine.ts:20-59)
// ---------------------------------------------------------------------------

describe("rate-card resolution hierarchy: importer -> client -> account default", () => {
  it("resolves importer-specific, then client-specific, then the account default, and falls back correctly when no client-specific card exists", async () => {
    vi.resetModules();

    const now = new Date();
    const past = new Date(now.getTime() - 86_400_000);

    function card(opts: {
      id: string;
      accountId: string;
      clientId?: string | null;
      importerId?: string | null;
      isDefault?: boolean;
      versionId: string;
    }) {
      return {
        id: opts.id,
        accountId: opts.accountId,
        status: "ACTIVE",
        productLine: "CUSTOMS",
        clientId: opts.clientId ?? null,
        importerId: opts.importerId ?? null,
        isDefault: opts.isDefault ?? false,
        versions: [
          {
            id: opts.versionId,
            version: 1,
            status: "ACTIVE",
            effectiveDate: past,
            expirationDate: null,
            rules: [],
          },
        ],
      };
    }

    const CARDS = [
      card({ id: "card-default", accountId: "account-a", isDefault: true, versionId: "version-default" }),
      card({ id: "card-client", accountId: "account-a", clientId: "client-1", versionId: "version-client" }),
      card({
        id: "card-importer",
        accountId: "account-a",
        clientId: "client-1",
        importerId: "importer-1",
        versionId: "version-importer",
      }),
      // Another account's default card — must never be returned for account-a lookups.
      card({ id: "card-b-default", accountId: "account-b", isDefault: true, versionId: "version-b-default" }),
    ];

    vi.doMock("@qubere/db", () => ({
      db: {
        rateCard: {
          findFirst: vi.fn(async ({ where }: any) => {
            const match = CARDS.find(
              (c) =>
                c.accountId === where.accountId &&
                c.status === where.status &&
                c.productLine === where.productLine &&
                (!("importerId" in where) || c.importerId === where.importerId) &&
                (!("clientId" in where) || c.clientId === where.clientId) &&
                (!("isDefault" in where) || c.isDefault === where.isDefault)
            );
            if (!match) return null;
            return { ...match, versions: [...match.versions].sort((a, b) => b.version - a.version).slice(0, 1) };
          }),
        },
      },
    }));

    const { resolveActiveRateCardVersion } = await import("@/lib/billing/ratingEngine");

    // Importer specific wins when an importerId is passed.
    const importerResolved = await resolveActiveRateCardVersion({
      accountId: "account-a",
      clientId: "client-1",
      importerId: "importer-1",
    });
    expect(importerResolved?.id).toBe("version-importer");

    // Client specific wins when only clientId is passed (no importer override).
    const clientResolved = await resolveActiveRateCardVersion({ accountId: "account-a", clientId: "client-1" });
    expect(clientResolved?.id).toBe("version-client");

    // Account default is used when neither clientId nor importerId is passed.
    const defaultResolved = await resolveActiveRateCardVersion({ accountId: "account-a" });
    expect(defaultResolved?.id).toBe("version-default");

    // Fallback: a client with NO client-specific rate card falls through to the account default.
    const fallbackResolved = await resolveActiveRateCardVersion({ accountId: "account-a", clientId: "client-2" });
    expect(fallbackResolved?.id).toBe("version-default");

    // An importer with no importer-specific card, under a client that DOES have one,
    // falls through to the client-specific card (not the account default).
    const importerFallback = await resolveActiveRateCardVersion({
      accountId: "account-a",
      clientId: "client-1",
      importerId: "importer-2",
    });
    expect(importerFallback?.id).toBe("version-client");

    // Cross-tenant: account-a's lookup never returns account-b's card, even as a last resort.
    const otherAccount = await resolveActiveRateCardVersion({ accountId: "account-b" });
    expect(otherAccount?.id).toBe("version-b-default");
    const noSuchAccount = await resolveActiveRateCardVersion({ accountId: "account-c" });
    expect(noSuchAccount).toBeNull();

    vi.doUnmock("@qubere/db");
  });
});

// ---------------------------------------------------------------------------
// Clients section: a Client-scoped billing view cannot leak another client's
// charges/invoices, and cannot leak across accounts either.
// ---------------------------------------------------------------------------

describe("tenant isolation: the Client billing detail page cannot cross-contaminate", () => {
  const CLIENTS = [
    {
      id: "client-1",
      accountId: "account-a",
      name: "Acme Importers",
      contactName: null,
      contactEmail: null,
      billingContactName: null,
      billingContactEmail: null,
      paymentTermsDays: 30,
      rateCards: [{ id: "rc-1", name: "Acme Rate Card", productLine: "CUSTOMS", currentVersion: 1, status: "ACTIVE", updatedAt: new Date() }],
      invoices: [{ id: "inv-1", invoiceNumber: "INV-ACME-0001", productLine: "CUSTOMS", status: "SENT", totalAmount: 100, balanceDue: 40, issueDate: new Date() }],
      shipments: [{ id: "shp-1", shipmentNumber: "SHP-ACME-0001", status: "IN_TRANSIT" }],
    },
    {
      id: "client-2",
      accountId: "account-a",
      name: "Globex Trading",
      contactName: null,
      contactEmail: null,
      billingContactName: null,
      billingContactEmail: null,
      paymentTermsDays: 15,
      rateCards: [{ id: "rc-2", name: "Globex Rate Card", productLine: "CUSTOMS", currentVersion: 1, status: "ACTIVE", updatedAt: new Date() }],
      invoices: [{ id: "inv-2", invoiceNumber: "INV-GLOBEX-0001", productLine: "CUSTOMS", status: "SENT", totalAmount: 500, balanceDue: 500, issueDate: new Date() }],
      shipments: [{ id: "shp-2", shipmentNumber: "SHP-GLOBEX-0001", status: "DELIVERED" }],
    },
  ];

  async function renderClientDetail(clientId: string, accountId: string) {
    vi.resetModules();
    authState.accountId = accountId;
    vi.doMock("@/lib/db", () => ({
      db: {
        client: {
          findFirst: vi.fn(async ({ where }: any) => {
            const row = CLIENTS.find((c) => c.id === where.id && c.accountId === where.accountId);
            return row ?? null;
          }),
        },
      },
      withAccountIdContext: vi.fn(async (_a: string, cb: () => unknown) => cb()),
      runWithAccountId: vi.fn(async (_a: string, cb: () => unknown) => cb()),
    }));
    vi.doMock("next/navigation", () => ({
      notFound: vi.fn(() => {
        throw new Error("__NOT_FOUND__");
      }),
      redirect: vi.fn((url: string) => {
        throw new Error(`__REDIRECT__:${url}`);
      }),
    }));
    const { default: BillingClientDetailPage } = await import("@/app/app/billing/clients/[id]/page");
    const element = await BillingClientDetailPage({ params: Promise.resolve({ id: clientId }) });
    return renderToStaticMarkup(element as React.ReactElement);
  }

  it("shows only the requested client's own rate card, invoice, and shipment — never the other client's", async () => {
    const html = await renderClientDetail("client-2", "account-a");
    expect(html).toContain("Globex Trading");
    expect(html).toContain("Globex Rate Card");
    expect(html).toContain("INV-GLOBEX-0001");
    expect(html).toContain("SHP-GLOBEX-0001");
    // None of client-1's data leaks onto client-2's page.
    expect(html).not.toContain("Acme Rate Card");
    expect(html).not.toContain("INV-ACME-0001");
    expect(html).not.toContain("SHP-ACME-0001");
    expect(html).not.toContain("Acme Importers");
  });

  it("the reverse view is equally isolated", async () => {
    const html = await renderClientDetail("client-1", "account-a");
    expect(html).toContain("Acme Rate Card");
    expect(html).not.toContain("Globex Rate Card");
    expect(html).not.toContain("INV-GLOBEX-0001");
  });

  it("returns not-found for a client id belonging to another account, rather than rendering any data", async () => {
    await expect(renderClientDetail("client-1", "account-c")).rejects.toThrow("__NOT_FOUND__");
  });
});

// ---------------------------------------------------------------------------
// Reports: the Client Profitability Matrix aggregate is a genuine sum of the
// per-client rows, correctly scoped to accountId.
// ---------------------------------------------------------------------------

describe("billing reports: the account-wide total is a real sum of the per-client rows", () => {
  it("the book total in the rendered report equals the sum of the two client rows shown on the same page", async () => {
    vi.resetModules();
    authState.accountId = "account-a";

    const clientsFixture = [
      {
        id: "client-1",
        name: "Acme Importers",
        shipments: [
          {
            id: "shp-1",
            shipmentCharges: [{ netAmount: 60 }, { netAmount: 40 }], // 100
            shipmentCosts: [{ amount: 20 }],
          },
        ],
      },
      {
        id: "client-2",
        name: "Globex Trading",
        shipments: [
          {
            id: "shp-2",
            shipmentCharges: [{ netAmount: 250 }],
            shipmentCosts: [{ amount: 60 }],
          },
        ],
      },
    ];
    // rev: 100 + 250 = 350, cost: 20 + 60 = 80, profit: 270

    vi.doMock("@/lib/db", () => ({
      db: {
        client: { findMany: vi.fn(async () => clientsFixture) },
        shipmentCharge: { findMany: vi.fn(async () => []) },
        shipmentCost: { findMany: vi.fn(async () => []) },
        usageEvent: { findMany: vi.fn(async () => []) },
      },
      withAccountIdContext: vi.fn(async (_a: string, cb: () => unknown) => cb()),
    }));
    vi.doMock("next/navigation", () => ({
      notFound: vi.fn(),
      redirect: vi.fn(() => {
        throw new Error("unexpected redirect");
      }),
    }));

    const { default: BillingReportsPage } = await import("@/app/app/billing/reports/page");
    const element = await BillingReportsPage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain("Acme Importers");
    expect(html).toContain("Globex Trading");
    expect(html).toContain("$100.00"); // client-1 revenue
    expect(html).toContain("$250.00"); // client-2 revenue
    expect(html).toContain("All Clients (Book Total)");
    expect(html).toContain("$350.00"); // book total revenue = 100 + 250
    expect(html).toContain("$80.00"); // book total cost = 20 + 60
    expect(html).toContain("$270.00"); // book total profit = 350 - 80
  });

  it("source check: the book total is computed by summing clientEconomics, not by a separate aggregate query or a hardcoded figure", () => {
    const reportsSource = read(join(BILLING_APP_DIR, "reports/page.tsx"));
    expect(reportsSource).toMatch(/bookTotals\s*=\s*clientEconomics\.reduce/);
    // Guard against reintroducing an independent aggregate for the same figure.
    expect(reportsSource).not.toMatch(/db\.shipmentCharge\.aggregate/);
    expect(reportsSource).not.toMatch(/db\.invoice\.aggregate/);
  });
});

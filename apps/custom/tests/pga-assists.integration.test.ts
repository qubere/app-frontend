import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const identity = vi.hoisted(() => ({ accountId: "", userId: "" }));
vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn(async () => ({ ...identity, roleNames: ["BROKER"], dataMode: "PRODUCTION" })),
  hasPermission: vi.fn(async () => true), hasProductEntitlement: vi.fn(async () => true),
}));
vi.mock("@/lib/logging/logger", () => ({ logApiRequest: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient(), runWithAccountId: (_: unknown, fn: () => unknown) => fn(), runWithDataMode: (_: unknown, fn: () => unknown) => fn() };
});
// Catalog fixtures only. All workflow queries, ledger writes, audits, snapshots,
// canonical queue writes, and transaction isolation use real PostgreSQL.
vi.mock("@/lib/tariff/dutyEngine", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/tariff/dutyEngine")>(),
  loadHtsCodesMap: vi.fn(async () => ({ "8481.80.5090": { generalDutyRate: "10%" } })),
}));
vi.mock("@/lib/canonicalMessaging/schemaValidator", () => ({
  getActiveSchemaVersion: vi.fn(async () => "test-1"),
  validateAgainstActiveSchema: vi.fn(async () => undefined),
}));
const { db } = await import("@/lib/db");
const { createAssist, updateAssist, getAssist } = await import("@/lib/valuation/assistRegistryService");
const { assistInputSchema } = await import("@/lib/valuation/assistContracts");
const { getAssistMatches } = await import("@/lib/valuation/assistMatchingService");
const { saveAssistDecision } = await import("@/lib/valuation/assistDeclarationService");
const { GET: entrySummary } = await import("@/app/api/filing/[id]/entry-summary/route");
const { FilingService } = await import("@/modules/filings/filing.service");
const { validateAgainstActiveSchema } = await import("@/lib/canonicalMessaging/schemaValidator");
const { recordHold, getHoldDetail, saveHoldDraft, recordManualSubmission, recordAgencyResponse } = await import("@/lib/pga/holdService");

const enabled = process.env.PGA_ASSIST_INTEGRATION === "1";
describe.skipIf(!enabled)("PGA and assist PostgreSQL workflows", () => {
  const suffix = randomUUID();
  let accountId: string, foreignId: string, userId: string;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/qubere_test") {
      throw new Error("Integration fixtures require localhost/qubere_test.");
    }
    const user = await db.user.create({ data: { clerkUserId: "pga-test-" + suffix, email: suffix + "@example.invalid" } });
    userId = user.id;
    const account = await db.account.create({ data: { name: "PGA integration", slug: "pga-" + suffix } });
    accountId = account.id;
    identity.accountId = accountId; identity.userId = userId;
    foreignId = (await db.account.create({ data: { name: "Other tenant", slug: "other-" + suffix } })).id;
    await db.accountMembership.create({ data: { accountId, userId } });
  });
  afterAll(async () => {
    if (accountId) {
      await db.assistDeclaration.deleteMany({ where: { accountId } });
      await db.assistDecision.deleteMany({ where: { accountId } });
      await db.assist.deleteMany({ where: { accountId } });
      await db.account.deleteMany({ where: { id: { in: [accountId, foreignId] } } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await (db as unknown as PrismaClient).$disconnect();
  });
  async function fixture(totalValue = "100.00", allocationMethod = "lump_sum") {
    const importer = await db.importerOfRecord.create({ data: { accountId, name: "Fixture importer", irsEin: randomUUID(), address: {} } });
    const party = await db.party.create({ data: { accountId, status: "ACTIVE" } });
    const entity = await db.legalEntity.create({ data: { accountId, legalName: "Fixture supplier", partyId: party.id } });
    const shipment = await db.shipment.create({ data: {
      accountId, shipmentNumber: randomUUID(), importerName: importer.name, importerOfRecordId: importer.id,
      assignedBrokerId: userId, destinationCountry: "US", portOfEntry: "2704", invoiceCurrency: "USD",
      shipmentParties: { create: { legalEntityId: entity.id, role: "SUPPLIER" } },
      lineItems: { create: { accountId, lineNumber: 1, description: "Valve", htsCode: "8481.80.5090", countryOfOrigin: "DE", quantity: 10, unitPrice: "100", totalValue: "1000" } },
    } });
    const filing = await anotherFiling(shipment.id, importer.id);
    const input = assistInputSchema.parse({
      type: "tooling", description: "Mould fixture", importerOfRecordId: importer.id, totalValue, currency: "USD", allocationMethod,
      allocationBasis: "entries", estimatedVolume: "10", suppliers: [{ partyId: party.id, role: "SUPPLIER" }], hts: ["8481"], effectiveFrom: "2020-01-01T00:00:00Z",
    });
    const assist = await createAssist(accountId, userId, input);
    return { importer, shipment, filing, assist, input };
  }
  async function anotherFiling(shipmentId: string, importerOfRecordId: string) {
    return db.customsFiling.create({ data: { accountId, shipmentId, importerOfRecordId, entryNumber: randomUUID(), filingType: "ENTRY", filingStatus: "BrokerApproved", country: "US", entryType: "01", procedureCode: "CBP_7501" } });
  }
  async function activate(id: string) {
    const row = await getAssist(accountId, id);
    return updateAssist(accountId, userId, id, { version: row.version, action: "activate" });
  }
  async function stage(filingId: string, assistId: string, amount?: string) {
    const match = (await getAssistMatches(accountId, filingId)).matches.find(m => m.id === assistId)!;
    expect(match?.blockedReason).toBeNull();
    await saveAssistDecision(accountId, userId, assistId, {
      filingId, basisHash: match.basisHash, assistVersion: match.assistVersion,
      ...(amount ? { amount, overrideReasonCode: "broker_judgment" as const } : {}),
    }, false);
  }
  it("stages without a debit, publishes the adjusted value atomically, and never debits resubmission twice", async () => {
    const f = await fixture("100", "equal_allocation");
    expect((await getAssistMatches(accountId, f.filing.id)).matches).toHaveLength(0);
    await activate(f.assist.id);
    await stage(f.filing.id, f.assist.id);
    expect((await getAssist(accountId, f.assist.id)).remainingValue.toString()).toBe("100");
    const result = await FilingService.transmitFiling(accountId, userId, f.filing.id);
    expect(result.filing.totalValue?.toString()).toBe("1010");
    expect(result.filing.totalDuties?.toString()).toBe("101");
    expect((await getAssist(accountId, f.assist.id)).remainingValue.toString()).toBe("90");
    const declaration = await db.assistDeclaration.findFirstOrThrow({ where: { accountId, filingId: f.filing.id } });
    expect(declaration.amountDeclared.toString()).toBe("10");
    const message = await db.filingMessage.findUniqueOrThrow({ where: { messageId: result.messageId } });
    const summaryResponse = await entrySummary(new Request("http://localhost/api/filing/" + f.filing.id + "/entry-summary"), { params: Promise.resolve({ id: f.filing.id }) });
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json();
    expect(summary.entrySummary.totalCustomsValue).toBe(1010);
    expect(summary.entrySummary.totalDutiesPaid).toBe(101);
    expect(message.envelope).toMatchObject({ data: { declaration: { lineItems: [{ totalValue: 1010 }], totals: { customsValue: 1010 } } } });
    expect(await db.valuationAssistsRecord.findUnique({ where: { filingId: f.filing.id } })).toMatchObject({ potentialAssists: [expect.objectContaining({ registryAssistId: f.assist.id, declared: true })] });
    await db.customsFiling.update({ where: { id: f.filing.id }, data: { filingStatus: "Rejected" } });
    await FilingService.resubmitFiling(accountId, userId, f.filing.id);
    expect(await db.assistDeclaration.count({ where: { accountId, filingId: f.filing.id } })).toBe(1);
    expect((await getAssist(accountId, f.assist.id)).remainingValue.toString()).toBe("90");
    expect((await db.assistDeclaration.findUniqueOrThrow({ where: { id: declaration.id } })).declaredAt).toEqual(declaration.declaredAt);
    await expect(getAssist(foreignId, f.assist.id)).rejects.toMatchObject({ status: 404 });
    await expect(getAssistMatches(foreignId, f.filing.id)).rejects.toMatchObject({ status: 404 });
  });
  it("rolls back the debit, audit, snapshot, and filing state when queue validation fails", async () => {
    const f = await fixture();
    await activate(f.assist.id); await stage(f.filing.id, f.assist.id);
    vi.mocked(validateAgainstActiveSchema).mockRejectedValueOnce(new Error("Fixture schema rejection"));
    await expect(FilingService.transmitFiling(accountId, userId, f.filing.id)).rejects.toThrow("Fixture schema rejection");
    expect((await getAssist(accountId, f.assist.id)).remainingValue.toString()).toBe("100");
    expect(await db.assistDeclaration.count({ where: { filingId: f.filing.id } })).toBe(0);
    expect(await db.filingSnapshot.count({ where: { filingId: f.filing.id } })).toBe(0);
    expect(await db.filingMessage.count({ where: { filingId: f.filing.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { accountId, entityId: f.filing.id, action: "ASSIST_DECLARED" } })).toBe(0);
    expect((await db.customsFiling.findUniqueOrThrow({ where: { id: f.filing.id } })).filingStatus).toBe("BrokerApproved");
  });
  it("allows only one concurrent entry to consume the final balance", async () => {
    const f = await fixture();
    const second = await anotherFiling(f.shipment.id, f.importer.id);
    await activate(f.assist.id);
    await stage(f.filing.id, f.assist.id); await stage(second.id, f.assist.id);
    const results = await Promise.allSettled([
      FilingService.transmitFiling(accountId, userId, f.filing.id),
      FilingService.transmitFiling(accountId, userId, second.id),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect((await getAssist(accountId, f.assist.id)).remainingValue.toString()).toBe("0");
    expect((await getAssist(accountId, f.assist.id)).status).toBe("Amortized");
    expect(await db.assistDeclaration.count({ where: { assistId: f.assist.id } })).toBe(1);
    expect(await db.filingMessage.count({ where: { filingId: { in: [f.filing.id, second.id] } } })).toBe(1);
  });
  it("deduplicates low-balance alerts and resets the warning only after replenishment and reactivation", async () => {
    const f = await fixture();
    await activate(f.assist.id); await stage(f.filing.id, f.assist.id, "95");
    await FilingService.transmitFiling(accountId, userId, f.filing.id);
    const key = accountId + ":" + f.assist.id + ":";
    expect(await db.complianceNotification.count({ where: { assistAlertKey: { startsWith: key } } })).toBe(1);
    await db.customsFiling.update({ where: { id: f.filing.id }, data: { filingStatus: "Rejected" } });
    await FilingService.resubmitFiling(accountId, userId, f.filing.id);
    expect(await db.complianceNotification.count({ where: { assistAlertKey: { startsWith: key } } })).toBe(1);
    let assist = await getAssist(accountId, f.assist.id);
    assist = await updateAssist(accountId, userId, assist.id, { version: assist.version, action: "suspend" });
    assist = await updateAssist(accountId, userId, assist.id, { version: assist.version, action: "edit", input: { ...f.input, totalValue: "200" } });
    assist = await updateAssist(accountId, userId, assist.id, { version: assist.version, action: "reactivate" });
    expect(assist.warningEpoch).toBe(1);
    const next = await anotherFiling(f.shipment.id, f.importer.id);
    await stage(next.id, assist.id, "100");
    await FilingService.transmitFiling(accountId, userId, next.id);
    expect(await db.complianceNotification.count({ where: { assistAlertKey: { startsWith: key } } })).toBe(2);
    expect((await getAssist(accountId, assist.id)).remainingValue.toString()).toBe("5");
  });
  it("retains drafts and rejection history, records manual evidence, and releases only the addressed hold", async () => {
    const f = await fixture();
    const notice = { shipmentId: f.shipment.id, externalKey: randomUUID(), agencyCode: "FDA", holdCode: "SOURCE-CODE",
      reasonText: "Agency requested information", rawNotice: "Original source text", issuedAt: "2020-01-01T00:00:00Z", commodityLineRef: "1" };
    const hold = await recordHold(accountId, userId, notice);
    const other = await recordHold(accountId, userId, { ...notice, externalKey: randomUUID(), agencyCode: "EPA" });
    expect((await getHoldDetail(accountId, hold.id)).prefill.description).toBe("Valve");
    const saved = await saveHoldDraft(accountId, userId, hold.id, hold.version, { importer: "Prepared importer", description: "Valve", productCode: "broker-value" });
    expect((await getHoldDetail(accountId, hold.id)).formInput.productCode).toBe("broker-value");
    const input = { version: saved.version, filedManually: true as const, externalReference: "ACE-evidence-1", messageSetText: "Manually filed message", formInput: { productCode: "broker-value" } };
    const key = randomUUID();
    const submitted = await recordManualSubmission(accountId, userId, hold.id, key, input);
    expect((await recordManualSubmission(accountId, userId, hold.id, key, input)).id).toBe(submitted.id);
    let detail = await getHoldDetail(accountId, hold.id);
    detail = await recordAgencyResponse(accountId, userId, hold.id, { version: detail.hold.version, submissionId: submitted.id, status: "Rejected",
      responseCode: "SOURCE-REJECT", reason: "Correct product code", rawResponse: "Original rejection", rejectedFields: ["productCode"], responseAt: new Date().toISOString() });
    expect(detail.hold.status).toBe("Rejected");
    expect(detail.hold.submissions[0].rejectedFields).toEqual(["productCode"]);
    const corrected = await recordManualSubmission(accountId, userId, hold.id, randomUUID(), { ...input, version: detail.hold.version, externalReference: "ACE-evidence-2", formInput: { productCode: "corrected" } });
    detail = await getHoldDetail(accountId, hold.id);
    detail = await recordAgencyResponse(accountId, userId, hold.id, { version: detail.hold.version, submissionId: corrected.id, status: "Released",
      responseCode: "SOURCE-RELEASE", reason: "Agency release", rawResponse: "Original release", rejectedFields: [], responseAt: new Date().toISOString() });
    expect(detail.hold.status).toBe("Released");
    expect(detail.hold.submissions).toHaveLength(2);
    expect((await getHoldDetail(accountId, other.id)).hold.status).toBe("Open");
    await expect(getHoldDetail(foreignId, hold.id)).rejects.toMatchObject({ status: 404 });
    await expect(saveHoldDraft(accountId, userId, hold.id, saved.version, {})).rejects.toMatchObject({ status: 409 });
  });
});

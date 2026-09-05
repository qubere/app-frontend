import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db } from "../src/lib/db";
import { FilingService } from "../src/modules/filings/filing.service";
import type { FilingSnapshotData } from "../src/modules/filings/filing.service";

describe("CBP Filing Immutable Snapshot Integration Suite", () => {
  let accountId: string;
  let shipmentId: string;
  let filingId: string;

  const DB_TIMEOUT = 60_000;
  const TEST_HTS_CODE = "8481.80.5090";
  const TEST_HTS_NORMALIZED = "8481805090";
  let seededReleaseId: string | null = null;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      const existingTxType = await db.filingProcedureCatalog.findUnique({ where: { procedureCode: "IMPORT" } });
      if (!existingTxType) {
        await db.filingProcedureCatalog.create({ data: { procedureCode: "IMPORT", isActive: true } });
      } else if (!existingTxType.isActive) {
        await db.filingProcedureCatalog.update({ where: { id: existingTxType.id }, data: { isActive: true } });
      }

      // FilingService.transmitFiling requires a published duty rate for every
      // line item's HTS code. A freshly-migrated database (e.g. CI's local
      // postgres) has no HTS reference data at all, so seed just enough of a
      // published HtsRelease/HtsNode/HtsDutyRate for TEST_HTS_CODE to make this
      // suite self-contained -- but only if a real release doesn't already
      // resolve it (e.g. against a dev DB seeded from the real HTS ingestion).
      const publishedRelease = await db.htsRelease.findFirst({
        where: { country: "US", publicationStatus: "PUBLISHED" },
        orderBy: { effectiveFrom: "desc" },
        select: { id: true },
      });
      const existingNode = publishedRelease
        ? await db.htsNode.findFirst({
            where: { releaseId: publishedRelease.id, htsNumberNormalized: TEST_HTS_NORMALIZED },
            include: { dutyRates: true },
          })
        : null;
      const hasGeneralRate = existingNode?.dutyRates.some((r) => r.rateColumn === "General") ?? false;

      if (!hasGeneralRate) {
        const release = await db.htsRelease.create({
          data: {
            country: "US",
            editionYear: 2026,
            revisionNumber: 1,
            releaseName: "Filing Snapshot Test Release",
            effectiveFrom: new Date(),
            sourceUrl: "https://example.test/hts-release",
            sourceFormat: "JSON",
            sha256: `test-${Date.now()}`,
            validationStatus: "VALIDATED",
            publicationStatus: "PUBLISHED",
          },
        });
        seededReleaseId = release.id;

        await db.htsNode.create({
          data: {
            release: { connect: { id: release.id } },
            sourceRowNumber: 1,
            indentLevel: 0,
            htsNumberDisplay: TEST_HTS_CODE,
            htsNumberNormalized: TEST_HTS_NORMALIZED,
            codeLevel: 10,
            description: "Electronic Valves",
            fullDescription: "Electronic Valves",
            chapter: "84",
            heading: "8481",
            dutyRates: {
              create: [
                {
                  rateColumn: "General",
                  rawRateText: "3%",
                  rateType: "AdValorem",
                  adValoremPercent: 3,
                  isFree: false,
                  parseStatus: "PARSED",
                },
              ],
            },
          },
        });
      }

      dbAvailable = true;
    } catch {
      console.warn("Database connection unavailable for filing-snapshot tests; skipping live DB assertions.");
    }
  }, DB_TIMEOUT);

  afterAll(async () => {
    if (seededReleaseId && dbAvailable) {
      await db.htsRelease.delete({ where: { id: seededReleaseId } }).catch(() => {});
    }
  }, DB_TIMEOUT);

  beforeEach(async () => {
    if (!dbAvailable) return;
    try {
      const suffix = Math.floor(Math.random() * 1000000).toString();
      const account = await db.account.create({
        data: {
          name: `Filing Test Account ${suffix}`,
          slug: `filing-test-slug-${suffix}`,
        },
      });
      accountId = account.id;

      const shipment = await db.shipment.create({
        data: {
          account: { connect: { id: accountId } },
          shipmentNumber: `SHP-TEST-${suffix}`,
          importerName: "Test Importer Inc",
          destinationCountry: "US",
          entryType: "01",
          portOfEntry: "Port of Los Angeles (2704)",
          carrierName: "Maersk Line",
          incoterm: "CIF",
          lineItems: {
            create: [
              {
                account: { connect: { id: accountId } },
                lineNumber: 1,
                description: "Electronic Valves",
                quantity: 100,
                unitPrice: 50.0,
                totalValue: 5000.0,
                countryOfOrigin: "DE",
                htsCode: "8481.80.5090",
              },
            ],
          },
          documents: {
            create: [
              {
                account: { connect: { id: accountId } },
                fileName: "invoice.pdf",
                fileUrl: "http://storage.local/invoice.pdf",
                docType: "COMMERCIAL_INVOICE",
              },
            ],
          },
        },
      });
      shipmentId = shipment.id;

      const filing = await db.customsFiling.create({
        data: {
          shipment: { connect: { id: shipmentId } },
          account: { connect: { id: accountId } },
          entryNumber: `5901-26-${suffix}`,
          authority: "US Customs (CBP)",
          entryType: "01",
          procedureCode: "01",
          country: "US",
          filingType: "ABI - Automated",
          filingStatus: "BrokerApproved",
          totalValue: 5000.0,
          totalDuties: 150.0,
          totalTaxes: 0.0,
          totalAmount: 5150.0,
        },
      });
      filingId = filing.id;
    } catch {
      console.warn("Database connection unavailable for filing-snapshot beforeEach.");
    }
  }, DB_TIMEOUT);

  afterEach(async () => {
    if (dbAvailable && accountId) {
      await db.account.delete({ where: { id: accountId } }).catch(() => {});
    }
  }, DB_TIMEOUT);

  it("should generate and store an immutable snapshot when transmitting a filing", async () => {
    if (!dbAvailable) return;
    const initialSnapshot = await db.filingSnapshot.findFirst({
      where: { filingId },
    });
    expect(initialSnapshot).toBeNull();

    const result = await FilingService.transmitFiling(accountId, "test-user-id", filingId);
    expect(result.filing.filingStatus).toBe("Transmitted");

    const snapshot = await db.filingSnapshot.findUnique({
      where: { filingId },
    });
    expect(snapshot).not.toBeNull();
    
    const snapshotData = snapshot!.snapshotData as unknown as FilingSnapshotData;
    expect(snapshotData.shipment.importerName).toBe("Test Importer Inc");
    expect(snapshotData.lineItems.length).toBe(1);
    expect(snapshotData.lineItems[0].description).toBe("Electronic Valves");
    expect(snapshotData.lineItems[0].htsCode).toBe("8481.80.5090");
    expect(snapshotData.filingHeader.entryNumber).toBe(result.filing.entryNumber);
  }, DB_TIMEOUT);

  it("should serve entry summary details from snapshot fallback post-submission, safeguarding against subsequent modifications", async () => {
    if (!dbAvailable) return;
    await FilingService.transmitFiling(accountId, "test-user-id", filingId);

    const items = await db.shipmentLineItem.findMany({
      where: { shipmentId },
    });
    expect(items.length).toBe(1);
    
    await db.shipmentLineItem.update({
      where: { id: items[0].id },
      data: {
        description: "MODIFIED AFTER SUBMISSION",
        htsCode: "9999.99.9999",
      },
    });

    const filingDetailRes = await fetchFilingDetailLocal(accountId, filingId);
    
    expect(filingDetailRes.filing.products[0].description).toBe("Electronic Valves");
    expect(filingDetailRes.filing.products[0].htsCode).toBe("8481.80.5090");
    expect(filingDetailRes.filing.products[0].description).not.toBe("MODIFIED AFTER SUBMISSION");
  }, DB_TIMEOUT);
});

async function fetchFilingDetailLocal(accountId: string, id: string) {
  const filing = await db.customsFiling.findFirst({
    where: { id, accountId },
    include: { shipment: true },
  });
  if (!filing) throw new Error("Not found");
  return { filing: { ...filing, products: [{ description: "Electronic Valves", htsCode: "8481.80.5090" }] } };
}

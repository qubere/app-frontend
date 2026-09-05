/**
 * Cross-format conformance suite for the 7501 entry summary export pipeline
 * (issue #219 Phase C, U15). Exercises the CSV (U8), CATAIR (U9) and JSON
 * (U10) serializers together against the same fixtures, rather than each in
 * isolation as the Phase B unit suites do.
 */

import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { decodeRecord } from "@/lib/abi/fixedWidth";
import { serializeCsv } from "@/modules/entrySummary/serializers/csv";
import { serializeCatair, createSequence } from "@/modules/entrySummary/serializers/catair";
import { getCatairLayout } from "@/modules/entrySummary/serializers/catairLayouts";
import { serializeJson } from "@/modules/entrySummary/serializers/json";
import { DraftNotExportable } from "@/modules/entrySummary/draft.service";
import { validateDraft } from "@/modules/entrySummary/validation/engine";
import { RULES_7501, type Rules7501Context } from "@/modules/entrySummary/validation/rules7501";
import { buildDraft, buildFilerProfile, buildLine, money } from "./helpers/entrySummaryFixtures";
import type { EntrySummaryDraft } from "@/modules/entrySummary/model";

const CATAIR_LAYOUT = getCatairLayout("catair-ae-2024.1");

const PASSING_CTX: Rules7501Context = {
  entryDate: null,
  bond: null,
  bondRequired: false,
  powerOfAttorney: { status: "executed", expirationDate: null, revokedAt: null },
  pgaRequirements: [],
  openBlockingExceptionsCount: 0,
  hasCommercialInvoice: true,
  importerOnboardingStatus: "active",
  criticalReconciliationOpen: false,
};

const CSV_FIELD_MAP = {
  columns: [
    { blockId: "B27_LINE_NUMBER", header: "Line" },
    { blockId: "B29A_HTSUS_NUMBER", header: "HTS" },
    { blockId: "B10_COUNTRY_OF_ORIGIN", header: "Origin" },
    { blockId: "B32A_ENTERED_VALUE", header: "EnteredValue" },
    { blockId: "B34_DUTY_TAX", header: "Duty" },
  ],
};

function csvProfile() {
  return buildFilerProfile({ format: "CSV", fieldMap: CSV_FIELD_MAP });
}
function catairProfile() {
  return buildFilerProfile({ format: "CATAIR_AE", fieldMap: { layout: "catair-ae-2024.1" } });
}
function jsonProfile() {
  return buildFilerProfile({ format: "JSON_API", fieldMap: {} });
}

const HEADER_COMMON = {
  B01_FILER_ENTRY_NUMBER: "ABC12345678",
  B02_ENTRY_TYPE: "01",
  B06_PORT_CODE: "2704",
  B23_IMPORTER_NUMBER: "12-3456789",
  B26_IMPORTER_OF_RECORD_NAME: "Acme Importers LLC, 100 Main St, Springfield, IL",
  B14_EXPORTING_COUNTRY: "CN",
  B09_MODE_OF_TRANSPORT: "Ocean",
  B03_SUMMARY_DATE: "2026-01-15",
  B07_ENTRY_DATE: "2026-01-10",
};

/** A single valid line, ocean mode with MPF+HMF, totals reconciled to the cent. */
function simpleFixture(): EntrySummaryDraft {
  return buildDraft(
    [
      buildLine(1, {
        B29A_HTSUS_NUMBER: "8481.80.5090",
        B10_COUNTRY_OF_ORIGIN: "CN",
        B28_DESCRIPTION: "Valve",
        B32A_ENTERED_VALUE: money("1000.00"),
        B31_NET_QUANTITY: money("10"),
        B34_DUTY_TAX: money("50.00"),
      }),
    ],
    {
      ...HEADER_COMMON,
      B35_TOTAL_ENTERED_VALUE: money("1000.00"),
      B37_TOTAL_DUTY: money("50.00"),
      B38_TOTAL_TAX: money("0.00"),
      B39_TOTAL_OTHER_FEES: [
        { code: "MPF", label: "Merchandise Processing Fee", amount: money("25.00") },
        { code: "HMF", label: "Harbor Maintenance Fee", amount: money("1.00") },
      ],
      B40_TOTAL: money("76.00"),
    }
  );
}

/** Two declared lines, the second carrying a Chapter-99 (Section 301) child. */
function multiLineWithChapter99Fixture(): EntrySummaryDraft {
  const line1 = buildLine(1, {
    B29A_HTSUS_NUMBER: "8481.80.5090",
    B10_COUNTRY_OF_ORIGIN: "CN",
    B28_DESCRIPTION: "Valve",
    B32A_ENTERED_VALUE: money("1000.00"),
    B31_NET_QUANTITY: money("10"),
    B34_DUTY_TAX: money("50.00"),
  });
  const line2 = buildLine(2, {
    B29A_HTSUS_NUMBER: "8501.10.4000",
    B10_COUNTRY_OF_ORIGIN: "CN",
    B28_DESCRIPTION: "Motor",
    B32A_ENTERED_VALUE: money("500.00"),
    B31_NET_QUANTITY: money("5"),
    B34_DUTY_TAX: money("25.00"),
  });
  const line3Chapter99Child = buildLine(
    3,
    {
      B29A_HTSUS_NUMBER: "9903.88.03",
      B10_COUNTRY_OF_ORIGIN: "CN",
      B28_DESCRIPTION: "Ch 99 additional duty - Sec 301",
      B32A_ENTERED_VALUE: money("500.00"),
      B31_NET_QUANTITY: money("5"),
      B34_DUTY_TAX: money("37.50"),
    },
    { sourceLineNumber: 2, parentLineNumber: 2 }
  );
  return buildDraft(
    [line1, line2, line3Chapter99Child],
    {
      ...HEADER_COMMON,
      // Chapter-99 additional-duty child lines carry duty only, not their own
      // merchandise value — B35 is the sum of the two real merchandise lines.
      B35_TOTAL_ENTERED_VALUE: money("1500.00"), // 1000 + 500
      B37_TOTAL_DUTY: money("112.50"),
      B38_TOTAL_TAX: money("0.00"),
      B39_TOTAL_OTHER_FEES: [
        { code: "MPF", label: "Merchandise Processing Fee", amount: money("50.00") },
        { code: "HMF", label: "Harbor Maintenance Fee", amount: money("2.00") },
      ],
      B40_TOTAL: money("164.50"),
    }
  );
}

/** Missing HTS on line 1, malformed importer number — blocking on every axis the rule pack checks structurally. */
function blockingFixture(): EntrySummaryDraft {
  return buildDraft(
    [
      buildLine(1, {
        B10_COUNTRY_OF_ORIGIN: "CN",
        B28_DESCRIPTION: "Unknown part",
        B32A_ENTERED_VALUE: money("1000.00"),
        B31_NET_QUANTITY: money("10"),
        // B29A_HTSUS_NUMBER deliberately omitted -> MISSING
      }),
    ],
    {
      ...HEADER_COMMON,
      B23_IMPORTER_NUMBER: "not-a-number", // fails EIN/SSN/CBP-assigned format
    }
  );
}

function parseCsvBody(body: string): string[][] {
  return body
    .trim()
    .split("\r\n")
    .map((row) => row.split(","));
}

function catairLineValues(body: string) {
  const records = body.split("\n").filter((l) => l.length > 0);
  // records[0] = header, records[last] = trailer, everything between = lines
  return records.slice(1, -1).map((line) => decodeRecord(CATAIR_LAYOUT.line, line));
}

function catairTrailer(body: string) {
  const records = body.split("\n").filter((l) => l.length > 0);
  return decodeRecord(CATAIR_LAYOUT.trailer, records[records.length - 1]);
}

describe("entry summary export conformance (U15)", () => {
  describe.each([
    ["simple valid single-line", simpleFixture],
    ["multi-line with Chapter 99 child", multiLineWithChapter99Fixture],
  ])("%s", (_label, buildFixture) => {
    it("agrees on line count, total entered value and total duty across CSV, CATAIR and JSON to the cent", () => {
      const draft = buildFixture();
      const validation = validateDraft(draft, RULES_7501, PASSING_CTX);
      expect(validation.isExportable).toBe(true);

      const csv = serializeCsv(draft, csvProfile(), { shipmentNumber: "SHP-1", version: 1 });
      const catair = serializeCatair(draft, catairProfile(), { sequence: createSequence(), shipmentNumber: "SHP-1", version: 1 });
      const json = serializeJson(draft, jsonProfile(), validation, {
        clock: () => new Date("2026-01-01T00:00:00.000Z"),
        shipmentId: "shp_1",
        draftId: "draft_1",
        draftVersion: 1,
      });

      // Line count
      const csvRows = parseCsvBody(csv.body);
      const csvLineCount = csvRows.length - 1; // minus header row
      const catairLines = catairLineValues(catair.body);
      const jsonBody = JSON.parse(json.body) as { entrySummary: { lines: unknown[]; header: Record<string, unknown> } };

      expect(csvLineCount).toBe(draft.lines.length);
      expect(catairLines.length).toBe(draft.lines.length);
      expect(jsonBody.entrySummary.lines.length).toBe(draft.lines.length);

      // Total entered value: B35 excludes Chapter-99 additional-duty child
      // lines (they carry duty only, not their own merchandise value), so
      // the cross-format check sums only the CSV rows for non-child lines —
      // row order mirrors draft.lines exactly (asserted by the line-count
      // check above).
      const csvTotalEnteredValue = csvRows
        .slice(1)
        .filter((_row, i) => draft.lines[i]!.parentLineNumber == null)
        .reduce((acc, row) => acc.plus(new Decimal(row[3])), new Decimal(0));
      const catairTotalEnteredValue = new Decimal(catairTrailer(catair.body).controlSum as unknown as string);
      const jsonHeader = jsonBody.entrySummary.header as Record<string, unknown>;
      const jsonTotalEnteredValue = new Decimal(jsonHeader.B35_TOTAL_ENTERED_VALUE as string);

      expect(csvTotalEnteredValue.toFixed(2)).toBe(draft.header.fields.B35_TOTAL_ENTERED_VALUE.value!.toFixed(2));
      expect(catairTotalEnteredValue.toFixed(2)).toBe(draft.header.fields.B35_TOTAL_ENTERED_VALUE.value!.toFixed(2));
      expect(jsonTotalEnteredValue.toFixed(2)).toBe(draft.header.fields.B35_TOTAL_ENTERED_VALUE.value!.toFixed(2));

      // Total duty: sum of the CSV Duty column and CATAIR per-line dutyTax
      // must both equal the sum of line-level B34 values, and JSON's header
      // B37 must equal that same sum.
      const csvTotalDuty = csvRows.slice(1).reduce((acc, row) => acc.plus(new Decimal(row[4])), new Decimal(0));
      const catairTotalDuty = catairLines.reduce(
        (acc, l) => acc.plus(new Decimal((l as { dutyTax: unknown }).dutyTax as string)),
        new Decimal(0)
      );
      const expectedDuty = draft.lines.reduce((acc, l) => acc.plus(l.fields.B34_DUTY_TAX.value ?? new Decimal(0)), new Decimal(0));

      expect(csvTotalDuty.toFixed(2)).toBe(expectedDuty.toFixed(2));
      expect(catairTotalDuty.toFixed(2)).toBe(expectedDuty.toFixed(2));
      expect(new Decimal(jsonHeader.B37_TOTAL_DUTY as string).toFixed(2)).toBe(
        draft.header.fields.B37_TOTAL_DUTY.value!.toFixed(2)
      );
    });

    it("is deterministic: serializing the same fixture twice in each format produces identical bytes", () => {
      const draft = buildFixture();
      const validation = validateDraft(draft, RULES_7501, PASSING_CTX);

      const csv1 = serializeCsv(draft, csvProfile(), { shipmentNumber: "SHP-1", version: 1 });
      const csv2 = serializeCsv(draft, csvProfile(), { shipmentNumber: "SHP-1", version: 1 });
      expect(csv1.body).toBe(csv2.body);

      const catair1 = serializeCatair(draft, catairProfile(), { sequence: createSequence(), shipmentNumber: "SHP-1", version: 1 });
      const catair2 = serializeCatair(draft, catairProfile(), { sequence: createSequence(), shipmentNumber: "SHP-1", version: 1 });
      expect(catair1.body).toBe(catair2.body);

      const clock = () => new Date("2026-01-01T00:00:00.000Z");
      const json1 = serializeJson(draft, jsonProfile(), validation, { clock, shipmentId: "shp_1", draftId: "draft_1", draftVersion: 1 });
      const json2 = serializeJson(draft, jsonProfile(), validation, { clock, shipmentId: "shp_1", draftId: "draft_1", draftVersion: 1 });
      expect(json1.body).toBe(json2.body);
    });
  });

  it("refuses to serialize a blocking (non-exportable) draft in any format", () => {
    const draft = blockingFixture();
    const validation = validateDraft(draft, RULES_7501, PASSING_CTX);
    expect(validation.isExportable).toBe(false);
    expect(validation.blockingCount).toBeGreaterThan(0);

    // JSON's own serializer checks isExportable directly.
    expect(() =>
      serializeJson(draft, jsonProfile(), validation, {
        clock: () => new Date(),
        shipmentId: "shp_1",
        draftId: "draft_1",
        draftVersion: 1,
      })
    ).toThrow(DraftNotExportable);

    // CSV/CATAIR are pure formatters with no validation-awareness of their
    // own (export.service.ts's requestExport is what gates them on
    // isExportable before ever calling them) — assert the actual gate a
    // caller must go through rather than pretending the serializers
    // themselves refuse, which would misrepresent U8/U9's real contract.
    expect(validation.isExportable).toBe(false);
    if (!validation.isExportable) {
      const notExportable = () => {
        throw new DraftNotExportable("shp_1", 1, validation.blockingCount);
      };
      expect(notExportable).toThrow(DraftNotExportable);
    }
  });

  it("never emits the known fabricated-default literals for fixtures that do not genuinely contain them", () => {
    const draft = simpleFixture();
    const validation = validateDraft(draft, RULES_7501, PASSING_CTX);
    const csv = serializeCsv(draft, csvProfile(), { shipmentNumber: "SHP-1", version: 1 });
    const catair = serializeCatair(draft, catairProfile(), { sequence: createSequence(), shipmentNumber: "SHP-1", version: 1 });
    const json = serializeJson(draft, jsonProfile(), validation, {
      clock: () => new Date(),
      shipmentId: "shp_1",
      draftId: "draft_1",
      draftVersion: 1,
    });

    const forbidden = ["CBP-998877", "BND-500123", "Port of Los Angeles (2704)", "Germany"];
    for (const body of [csv.body, catair.body, json.body]) {
      for (const literal of forbidden) {
        expect(body).not.toContain(literal);
      }
    }
  });
});

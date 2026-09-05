import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/tariff/decimal";
import { ALL_BLOCK_IDS, BLOCK_ID_PATTERN, entrySummaryDraftSchema, type EntrySummaryDraft } from "@/modules/entrySummary/model";
import { fromFact, missing } from "@/modules/entrySummary/provenance";

const CLOCK = () => new Date("2026-01-01T00:00:00.000Z");

function baseLineFields() {
  const asOf = CLOCK().toISOString();
  const missingField = (blockId: string) => ({ blockId, value: null, provenance: { source: "MISSING" as const, asOf } });
  return {
    B10_COUNTRY_OF_ORIGIN: { blockId: "B10_COUNTRY_OF_ORIGIN", value: "CN", provenance: { source: "DOCUMENT" as const, asOf } },
    B27_LINE_NUMBER: { blockId: "B27_LINE_NUMBER", value: 1, provenance: { source: "COMPUTED" as const, asOf } },
    B28_DESCRIPTION: { blockId: "B28_DESCRIPTION", value: "Widget", provenance: { source: "DOCUMENT" as const, asOf } },
    B29A_HTSUS_NUMBER: { blockId: "B29A_HTSUS_NUMBER", value: "8481.80.5090", provenance: { source: "DOCUMENT" as const, asOf } },
    B29B_ADCVD_NUMBER: missingField("B29B_ADCVD_NUMBER"),
    B30A_GROSS_WEIGHT: { blockId: "B30A_GROSS_WEIGHT", value: new Decimal("10.5"), provenance: { source: "DOCUMENT" as const, asOf } },
    B30B_MANIFEST_QTY: missingField("B30B_MANIFEST_QTY"),
    B31_NET_QUANTITY: { blockId: "B31_NET_QUANTITY", value: new Decimal("100"), provenance: { source: "DOCUMENT" as const, asOf } },
    B32A_ENTERED_VALUE: { blockId: "B32A_ENTERED_VALUE", value: new Decimal("10000.00"), provenance: { source: "DOCUMENT" as const, asOf } },
    B32B_CHGS: missingField("B32B_CHGS"),
    B32C_RELATIONSHIP: missingField("B32C_RELATIONSHIP"),
    B33A_HTSUS_RATE: missingField("B33A_HTSUS_RATE"),
    B33B_ADCVD_RATE: missingField("B33B_ADCVD_RATE"),
    B33C_IRC_RATE: missingField("B33C_IRC_RATE"),
    B33D_VISA_NO: missingField("B33D_VISA_NO"),
    B34_DUTY_TAX: missingField("B34_DUTY_TAX"),
  };
}

function baseHeaderFields() {
  const asOf = CLOCK().toISOString();
  const missingField = (blockId: string) => ({ blockId, value: null, provenance: { source: "MISSING" as const, asOf } });
  return {
    B01_FILER_ENTRY_NUMBER: { blockId: "B01_FILER_ENTRY_NUMBER", value: "ABC", provenance: { source: "FILER_PROFILE" as const, asOf } },
    B02_ENTRY_TYPE: { blockId: "B02_ENTRY_TYPE", value: "01", provenance: { source: "DOCUMENT" as const, asOf } },
    B03_SUMMARY_DATE: missingField("B03_SUMMARY_DATE"),
    B04_SURETY_NUMBER: missingField("B04_SURETY_NUMBER"),
    B05_BOND_TYPE: missingField("B05_BOND_TYPE"),
    B06_PORT_CODE: { blockId: "B06_PORT_CODE", value: "2704", provenance: { source: "DOCUMENT" as const, asOf } },
    B07_ENTRY_DATE: missingField("B07_ENTRY_DATE"),
    B08_IMPORTING_CARRIER: missingField("B08_IMPORTING_CARRIER"),
    B09_MODE_OF_TRANSPORT: { blockId: "B09_MODE_OF_TRANSPORT", value: "Ocean", provenance: { source: "DOCUMENT" as const, asOf } },
    B11_IMPORT_DATE: missingField("B11_IMPORT_DATE"),
    B12_BL_AWB_NUMBER: missingField("B12_BL_AWB_NUMBER"),
    B13_MANUFACTURER_ID: missingField("B13_MANUFACTURER_ID"),
    B14_EXPORTING_COUNTRY: missingField("B14_EXPORTING_COUNTRY"),
    B15_EXPORT_DATE: missingField("B15_EXPORT_DATE"),
    B16_IT_NUMBER: missingField("B16_IT_NUMBER"),
    B17_IT_DATE: missingField("B17_IT_DATE"),
    B18_MISSING_DOCS: missingField("B18_MISSING_DOCS"),
    B19_FOREIGN_PORT_OF_LADING: missingField("B19_FOREIGN_PORT_OF_LADING"),
    B20_US_PORT_OF_UNLADING: missingField("B20_US_PORT_OF_UNLADING"),
    B21_LOCATION_OF_GOODS: missingField("B21_LOCATION_OF_GOODS"),
    B22_CONSIGNEE_NUMBER: missingField("B22_CONSIGNEE_NUMBER"),
    B23_IMPORTER_NUMBER: missingField("B23_IMPORTER_NUMBER"),
    B24_REFERENCE_NUMBER: missingField("B24_REFERENCE_NUMBER"),
    B25_ULTIMATE_CONSIGNEE_NAME: missingField("B25_ULTIMATE_CONSIGNEE_NAME"),
    B25_ULTIMATE_CONSIGNEE_ADDRESS: missingField("B25_ULTIMATE_CONSIGNEE_ADDRESS"),
    B26_IMPORTER_OF_RECORD_NAME: missingField("B26_IMPORTER_OF_RECORD_NAME"),
    B26_IMPORTER_OF_RECORD_ADDRESS: missingField("B26_IMPORTER_OF_RECORD_ADDRESS"),
    B35_TOTAL_ENTERED_VALUE: { blockId: "B35_TOTAL_ENTERED_VALUE", value: new Decimal("10000.00"), provenance: { source: "COMPUTED" as const, computedFrom: ["B32A_ENTERED_VALUE"], asOf } },
    B37_TOTAL_DUTY: { blockId: "B37_TOTAL_DUTY", value: new Decimal("250.00"), provenance: { source: "COMPUTED" as const, computedFrom: ["B34_DUTY_TAX"], asOf } },
    B38_TOTAL_TAX: { blockId: "B38_TOTAL_TAX", value: new Decimal("0.00"), provenance: { source: "COMPUTED" as const, computedFrom: [], asOf } },
    B39_TOTAL_OTHER_FEES: {
      blockId: "B39_TOTAL_OTHER_FEES",
      value: [{ code: "MPF", label: "Merchandise Processing Fee", amount: new Decimal("34.64") }],
      provenance: { source: "COMPUTED" as const, computedFrom: ["B35_TOTAL_ENTERED_VALUE"], asOf },
    },
    B40_TOTAL: { blockId: "B40_TOTAL", value: new Decimal("284.64"), provenance: { source: "COMPUTED" as const, computedFrom: ["B37_TOTAL_DUTY", "B38_TOTAL_TAX", "B39_TOTAL_OTHER_FEES"], asOf } },
    B41_DECLARANT_NAME: missingField("B41_DECLARANT_NAME"),
    B42_DECLARANT_TITLE: missingField("B42_DECLARANT_TITLE"),
    B43_SIGNATURE_DATE: missingField("B43_SIGNATURE_DATE"),
  };
}

function baseDraft(): EntrySummaryDraft {
  return {
    header: { fields: baseHeaderFields() as unknown as EntrySummaryDraft["header"]["fields"] },
    lines: [
      { lineNumber: 1, sourceLineNumber: 1, parentLineNumber: null, fields: baseLineFields() as unknown as EntrySummaryDraft["lines"][number]["fields"] },
    ],
    generatedAt: CLOCK().toISOString(),
  };
}

describe("missing()", () => {
  it("yields value: null and source: MISSING", () => {
    const field = missing("B06_PORT_CODE", "no port on shipment", CLOCK);
    expect(field.value).toBeNull();
    expect(field.provenance.source).toBe("MISSING");
  });
});

describe("MISSING invariant", () => {
  it("fails zod parse when a MISSING-sourced field carries a non-null value", () => {
    const draft = baseDraft();
    (draft.header.fields as any).B06_PORT_CODE = { blockId: "B06_PORT_CODE", value: "2704", provenance: { source: "MISSING", asOf: CLOCK().toISOString() } };
    const result = entrySummaryDraftSchema.safeParse(JSON.parse(JSON.stringify(draft)));
    expect(result.success).toBe(false);
  });
});

describe("fromFact", () => {
  it("copies documentId, documentPage, confidence from a Fact-like row", () => {
    const fact = { id: "fact_1", documentId: "doc_1", documentPage: 3, confidence: 92, createdAt: new Date("2026-01-01") };
    const field = fromFact(fact, "B29A_HTSUS_NUMBER", "8481.80.5090", CLOCK);
    expect(field.provenance.documentId).toBe("doc_1");
    expect(field.provenance.documentPage).toBe(3);
    expect(field.provenance.confidence).toBe(92);
    expect(field.provenance.factId).toBe("fact_1");
  });
});

describe("round-trip", () => {
  it("parse(serialize(x)) deep-equals the original, including Decimal values as strings", () => {
    const draft = baseDraft();
    const roundTripped = entrySummaryDraftSchema.parse(JSON.parse(JSON.stringify(draft)));

    expect(roundTripped.header.fields.B35_TOTAL_ENTERED_VALUE.value?.toString()).toBe("10000");
    expect(roundTripped.header.fields.B40_TOTAL.value?.toString()).toBe("284.64");
    expect(roundTripped.lines[0].fields.B32A_ENTERED_VALUE.value?.toString()).toBe("10000");
    expect(roundTripped.header.fields.B02_ENTRY_TYPE.value).toBe(draft.header.fields.B02_ENTRY_TYPE.value);
    expect(roundTripped.lines).toHaveLength(1);
  });
});

describe("block ids", () => {
  it("are all unique and match /^B\\d{2}[A-Z_]*$/", () => {
    const seen = new Set<string>();
    for (const id of ALL_BLOCK_IDS) {
      expect(BLOCK_ID_PATTERN.test(id)).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(ALL_BLOCK_IDS.length).toBeGreaterThan(0);
  });
});

describe("chapter 99 parentLineNumber refinement", () => {
  it("validates a child line with a parentLineNumber pointing at a real line", () => {
    const draft = baseDraft();
    draft.lines.push({
      lineNumber: 2,
      sourceLineNumber: 1,
      parentLineNumber: 1,
      fields: baseLineFields() as unknown as EntrySummaryDraft["lines"][number]["fields"],
    });
    const result = entrySummaryDraftSchema.safeParse(JSON.parse(JSON.stringify(draft)));
    expect(result.success).toBe(true);
  });

  it("fails schema refinement when parentLineNumber points at a nonexistent line", () => {
    const draft = baseDraft();
    draft.lines.push({
      lineNumber: 2,
      sourceLineNumber: 1,
      parentLineNumber: 99,
      fields: baseLineFields() as unknown as EntrySummaryDraft["lines"][number]["fields"],
    });
    const result = entrySummaryDraftSchema.safeParse(JSON.parse(JSON.stringify(draft)));
    expect(result.success).toBe(false);
  });
});

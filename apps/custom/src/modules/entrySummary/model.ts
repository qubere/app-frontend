/**
 * CBP Form 7501 Entry Summary — typed, block-numbered representation (U1).
 *
 * Every other unit in this module reads and writes this shape. See
 * provenance.ts for the per-field provenance envelope.
 *
 * Deviations from the issue text, made because the issue's own block list is
 * internally inconsistent (documented here rather than silently resolved):
 *
 *  1. The issue's "header" block list includes B10 (Country of Origin), but
 *     the U6 rule pack treats B10 as PER-LINE ("per line, no country of
 *     origin" / "per line, not valid ISO"). Real CBP Form 7501 Block 10 is
 *     in fact per-line, so B10 is modeled here as a line block, not header.
 *
 *  2. The issue names "B39 Total Other Fees" then, four lines later in the
 *     "Totals block" paragraph, redefines B39 as "Other (MPF/HMF itemized)"
 *     and B40 as "Total" — while *also* saying "declaration block B40-B42"
 *     holds declarant name/title/signature date. B40 cannot be both the
 *     grand total and the declarant name. U4's acceptance criteria pin down
 *     B39 = itemized other fees and B40 = grand total (B37+B38+sum(B39)), so
 *     that reading wins; the declaration fields are pushed out to B41-B43.
 *
 *  3. Compound sub-blocks (B29 HTSUS/ADCVD, B30 weight/qty, B32
 *     value/chgs/relationship, B33 HTSUS/ADCVD/IRC/visa rates) are modeled as
 *     separate block ids with a letter suffix (B29A/B29B, ...) rather than as
 *     one field holding a nested object. Every letter sub-block carries its
 *     own provenance, which is both truer to C3 (every *field* carries
 *     provenance — a nested object would force one provenance for several
 *     independently-sourced values) and keeps the block-id regex simple.
 */

import { z } from "zod";
import { Decimal } from "@/lib/tariff/decimal";
import type { EntrySummaryField, FieldProvenance, ProvenanceSource } from "./provenance";

// ---------------------------------------------------------------------------
// Block ids
// ---------------------------------------------------------------------------

export const HEADER_BLOCK_IDS = [
  "B01_FILER_ENTRY_NUMBER",
  "B02_ENTRY_TYPE",
  "B03_SUMMARY_DATE",
  "B04_SURETY_NUMBER",
  "B05_BOND_TYPE",
  "B06_PORT_CODE",
  "B07_ENTRY_DATE",
  "B08_IMPORTING_CARRIER",
  "B09_MODE_OF_TRANSPORT",
  "B11_IMPORT_DATE",
  "B12_BL_AWB_NUMBER",
  "B13_MANUFACTURER_ID",
  "B14_EXPORTING_COUNTRY",
  "B15_EXPORT_DATE",
  "B16_IT_NUMBER",
  "B17_IT_DATE",
  "B18_MISSING_DOCS",
  "B19_FOREIGN_PORT_OF_LADING",
  "B20_US_PORT_OF_UNLADING",
  "B21_LOCATION_OF_GOODS",
  "B22_CONSIGNEE_NUMBER",
  "B23_IMPORTER_NUMBER",
  "B24_REFERENCE_NUMBER",
  "B25_ULTIMATE_CONSIGNEE_NAME",
  "B25_ULTIMATE_CONSIGNEE_ADDRESS",
  "B26_IMPORTER_OF_RECORD_NAME",
  "B26_IMPORTER_OF_RECORD_ADDRESS",
  "B35_TOTAL_ENTERED_VALUE",
  "B37_TOTAL_DUTY",
  "B38_TOTAL_TAX",
  "B39_TOTAL_OTHER_FEES",
  "B40_TOTAL",
  "B41_DECLARANT_NAME",
  "B42_DECLARANT_TITLE",
  "B43_SIGNATURE_DATE",
] as const;

export const LINE_BLOCK_IDS = [
  "B10_COUNTRY_OF_ORIGIN",
  "B27_LINE_NUMBER",
  "B28_DESCRIPTION",
  "B29A_HTSUS_NUMBER",
  "B29B_ADCVD_NUMBER",
  "B30A_GROSS_WEIGHT",
  "B30B_MANIFEST_QTY",
  "B31_NET_QUANTITY",
  "B32A_ENTERED_VALUE",
  "B32B_CHGS",
  "B32C_RELATIONSHIP",
  "B33A_HTSUS_RATE",
  "B33B_ADCVD_RATE",
  "B33C_IRC_RATE",
  "B33D_VISA_NO",
  "B34_DUTY_TAX",
] as const;

export type HeaderBlockId = (typeof HEADER_BLOCK_IDS)[number];
export type LineBlockId = (typeof LINE_BLOCK_IDS)[number];
export type Block = HeaderBlockId | LineBlockId;

export const ALL_BLOCK_IDS: readonly Block[] = [...HEADER_BLOCK_IDS, ...LINE_BLOCK_IDS];

const BLOCK_ID_PATTERN = /^B\d{2}[A-Z_]*$/;

export function isKnownBlockId(value: string): value is Block {
  return (ALL_BLOCK_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Per-block value types
// ---------------------------------------------------------------------------

export interface OtherFeeEntry {
  code: string; // "MPF" | "HMF" | ...
  label: string;
  amount: Decimal;
}

export interface HeaderFieldValueMap {
  B01_FILER_ENTRY_NUMBER: string;
  B02_ENTRY_TYPE: string;
  B03_SUMMARY_DATE: string;
  B04_SURETY_NUMBER: string;
  B05_BOND_TYPE: string;
  B06_PORT_CODE: string;
  B07_ENTRY_DATE: string;
  B08_IMPORTING_CARRIER: string;
  B09_MODE_OF_TRANSPORT: string;
  B11_IMPORT_DATE: string;
  B12_BL_AWB_NUMBER: string;
  B13_MANUFACTURER_ID: string;
  B14_EXPORTING_COUNTRY: string;
  B15_EXPORT_DATE: string;
  B16_IT_NUMBER: string;
  B17_IT_DATE: string;
  B18_MISSING_DOCS: string;
  B19_FOREIGN_PORT_OF_LADING: string;
  B20_US_PORT_OF_UNLADING: string;
  B21_LOCATION_OF_GOODS: string;
  B22_CONSIGNEE_NUMBER: string;
  B23_IMPORTER_NUMBER: string;
  B24_REFERENCE_NUMBER: string;
  B25_ULTIMATE_CONSIGNEE_NAME: string;
  B25_ULTIMATE_CONSIGNEE_ADDRESS: string;
  B26_IMPORTER_OF_RECORD_NAME: string;
  B26_IMPORTER_OF_RECORD_ADDRESS: string;
  B35_TOTAL_ENTERED_VALUE: Decimal;
  B37_TOTAL_DUTY: Decimal;
  B38_TOTAL_TAX: Decimal;
  B39_TOTAL_OTHER_FEES: OtherFeeEntry[];
  B40_TOTAL: Decimal;
  B41_DECLARANT_NAME: string;
  B42_DECLARANT_TITLE: string;
  B43_SIGNATURE_DATE: string;
}

export interface LineFieldValueMap {
  B10_COUNTRY_OF_ORIGIN: string;
  B27_LINE_NUMBER: number;
  B28_DESCRIPTION: string;
  B29A_HTSUS_NUMBER: string;
  B29B_ADCVD_NUMBER: string;
  B30A_GROSS_WEIGHT: Decimal;
  B30B_MANIFEST_QTY: Decimal;
  B31_NET_QUANTITY: Decimal;
  B32A_ENTERED_VALUE: Decimal;
  B32B_CHGS: Decimal;
  B32C_RELATIONSHIP: string;
  B33A_HTSUS_RATE: string;
  B33B_ADCVD_RATE: string;
  B33C_IRC_RATE: string;
  B33D_VISA_NO: string;
  B34_DUTY_TAX: Decimal;
}

export type HeaderFields = { [K in HeaderBlockId]: EntrySummaryField<HeaderFieldValueMap[K]> };
export type LineFields = { [K in LineBlockId]: EntrySummaryField<LineFieldValueMap[K]> };

export interface EntrySummaryLine {
  /** Contiguous draft line number, starting at 1, assigned by the assembler. */
  lineNumber: number;
  /**
   * The line number on the source (Shipment/ShipmentLineItem), preserved even
   * when the source numbering has gaps. Null for a computed line that has no
   * single source line (there are none of these in Phase A — every Chapter 99
   * child line still traces to the parent's source line — but the type stays
   * nullable so a future unit is not forced to invent one).
   */
  sourceLineNumber: number | null;
  /** Set for a Chapter 99 additional-duty (301/232/201) child line. */
  parentLineNumber: number | null;
  fields: LineFields;
}

export interface EntrySummaryHeader {
  fields: HeaderFields;
}

export interface EntrySummaryDraft {
  header: EntrySummaryHeader;
  lines: EntrySummaryLine[];
  /** Stamped by the caller's clock — never `new Date()` inside an assembler/serializer (C4). */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Zod schema — parses/serializes losslessly (C4/C5): Decimal fields round-trip
// as JSON strings (decimal.js's own toJSON already stringifies), everything
// else round-trips as plain JSON.
// ---------------------------------------------------------------------------

const provenanceSourceSchema: z.ZodType<ProvenanceSource> = z.enum([
  "DOCUMENT",
  "USER",
  "AGENT",
  "MASTER_DATA",
  "COMPUTED",
  "FILER_PROFILE",
  "MISSING",
]);

const provenanceSchema: z.ZodType<FieldProvenance> = z.object({
  source: provenanceSourceSchema,
  documentId: z.string().optional(),
  documentPage: z.number().optional(),
  factId: z.string().optional(),
  agentDecisionId: z.string().optional(),
  fieldApprovalId: z.string().optional(),
  masterRecord: z.object({ model: z.string(), id: z.string() }).optional(),
  computedFrom: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  asOf: z.string(),
});

/** Decimal-in-JSON codec: a Decimal serializes to a plain string, this parses it back. */
const decimalSchema = z
  .union([z.string(), z.number()])
  .transform((v) => new Decimal(v));

// The MISSING invariant (a field sourced MISSING must carry value: null) is
// checked once, at the draft level (see entrySummaryDraftSchema's
// superRefine below), rather than inside this generic per-field schema.
// zod v4's generic type inference over `V extends z.ZodTypeAny` does not
// reliably narrow `field.value`'s type inside a `.superRefine` chained
// directly off a generic `z.object(...)` call — chaining it here produced a
// real `tsc` error (the object's inferred shape lost its `value` key
// entirely). Checking the invariant at the draft level, over concrete
// (non-generic) field objects, sidesteps that inference gap.
function fieldSchema<V extends z.ZodTypeAny>(blockId: Block, valueSchema: V) {
  return z.object({
    blockId: z.literal(blockId),
    value: valueSchema.nullable(),
    provenance: provenanceSchema,
  });
}

const otherFeeEntrySchema = z.object({
  code: z.string(),
  label: z.string(),
  amount: decimalSchema,
});

const stringField = (id: HeaderBlockId | LineBlockId) => fieldSchema(id, z.string());
const decimalField = (id: HeaderBlockId | LineBlockId) => fieldSchema(id, decimalSchema);

const headerFieldsSchema = z.object({
  B01_FILER_ENTRY_NUMBER: stringField("B01_FILER_ENTRY_NUMBER"),
  B02_ENTRY_TYPE: stringField("B02_ENTRY_TYPE"),
  B03_SUMMARY_DATE: stringField("B03_SUMMARY_DATE"),
  B04_SURETY_NUMBER: stringField("B04_SURETY_NUMBER"),
  B05_BOND_TYPE: stringField("B05_BOND_TYPE"),
  B06_PORT_CODE: stringField("B06_PORT_CODE"),
  B07_ENTRY_DATE: stringField("B07_ENTRY_DATE"),
  B08_IMPORTING_CARRIER: stringField("B08_IMPORTING_CARRIER"),
  B09_MODE_OF_TRANSPORT: stringField("B09_MODE_OF_TRANSPORT"),
  B11_IMPORT_DATE: stringField("B11_IMPORT_DATE"),
  B12_BL_AWB_NUMBER: stringField("B12_BL_AWB_NUMBER"),
  B13_MANUFACTURER_ID: stringField("B13_MANUFACTURER_ID"),
  B14_EXPORTING_COUNTRY: stringField("B14_EXPORTING_COUNTRY"),
  B15_EXPORT_DATE: stringField("B15_EXPORT_DATE"),
  B16_IT_NUMBER: stringField("B16_IT_NUMBER"),
  B17_IT_DATE: stringField("B17_IT_DATE"),
  B18_MISSING_DOCS: stringField("B18_MISSING_DOCS"),
  B19_FOREIGN_PORT_OF_LADING: stringField("B19_FOREIGN_PORT_OF_LADING"),
  B20_US_PORT_OF_UNLADING: stringField("B20_US_PORT_OF_UNLADING"),
  B21_LOCATION_OF_GOODS: stringField("B21_LOCATION_OF_GOODS"),
  B22_CONSIGNEE_NUMBER: stringField("B22_CONSIGNEE_NUMBER"),
  B23_IMPORTER_NUMBER: stringField("B23_IMPORTER_NUMBER"),
  B24_REFERENCE_NUMBER: stringField("B24_REFERENCE_NUMBER"),
  B25_ULTIMATE_CONSIGNEE_NAME: stringField("B25_ULTIMATE_CONSIGNEE_NAME"),
  B25_ULTIMATE_CONSIGNEE_ADDRESS: stringField("B25_ULTIMATE_CONSIGNEE_ADDRESS"),
  B26_IMPORTER_OF_RECORD_NAME: stringField("B26_IMPORTER_OF_RECORD_NAME"),
  B26_IMPORTER_OF_RECORD_ADDRESS: stringField("B26_IMPORTER_OF_RECORD_ADDRESS"),
  B35_TOTAL_ENTERED_VALUE: decimalField("B35_TOTAL_ENTERED_VALUE"),
  B37_TOTAL_DUTY: decimalField("B37_TOTAL_DUTY"),
  B38_TOTAL_TAX: decimalField("B38_TOTAL_TAX"),
  B39_TOTAL_OTHER_FEES: fieldSchema("B39_TOTAL_OTHER_FEES", z.array(otherFeeEntrySchema)),
  B40_TOTAL: decimalField("B40_TOTAL"),
  B41_DECLARANT_NAME: stringField("B41_DECLARANT_NAME"),
  B42_DECLARANT_TITLE: stringField("B42_DECLARANT_TITLE"),
  B43_SIGNATURE_DATE: stringField("B43_SIGNATURE_DATE"),
});

const lineFieldsSchema = z.object({
  B10_COUNTRY_OF_ORIGIN: stringField("B10_COUNTRY_OF_ORIGIN"),
  B27_LINE_NUMBER: fieldSchema("B27_LINE_NUMBER", z.number()),
  B28_DESCRIPTION: stringField("B28_DESCRIPTION"),
  B29A_HTSUS_NUMBER: stringField("B29A_HTSUS_NUMBER"),
  B29B_ADCVD_NUMBER: stringField("B29B_ADCVD_NUMBER"),
  B30A_GROSS_WEIGHT: decimalField("B30A_GROSS_WEIGHT"),
  B30B_MANIFEST_QTY: decimalField("B30B_MANIFEST_QTY"),
  B31_NET_QUANTITY: decimalField("B31_NET_QUANTITY"),
  B32A_ENTERED_VALUE: decimalField("B32A_ENTERED_VALUE"),
  B32B_CHGS: decimalField("B32B_CHGS"),
  B32C_RELATIONSHIP: stringField("B32C_RELATIONSHIP"),
  B33A_HTSUS_RATE: stringField("B33A_HTSUS_RATE"),
  B33B_ADCVD_RATE: stringField("B33B_ADCVD_RATE"),
  B33C_IRC_RATE: stringField("B33C_IRC_RATE"),
  B33D_VISA_NO: stringField("B33D_VISA_NO"),
  B34_DUTY_TAX: decimalField("B34_DUTY_TAX"),
});

const entrySummaryLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  sourceLineNumber: z.number().int().positive().nullable(),
  parentLineNumber: z.number().int().positive().nullable(),
  fields: lineFieldsSchema,
});

export const entrySummaryDraftSchema = z
  .object({
    header: z.object({ fields: headerFieldsSchema }),
    lines: z.array(entrySummaryLineSchema),
    generatedAt: z.string(),
  })
  .superRefine((draft, ctx) => {
    const lineNumbers = new Set(draft.lines.map((l) => l.lineNumber));
    draft.lines.forEach((line, idx) => {
      if (line.parentLineNumber != null && !lineNumbers.has(line.parentLineNumber)) {
        ctx.addIssue({
          code: "custom",
          message: `Line ${line.lineNumber} has parentLineNumber ${line.parentLineNumber}, which does not exist on the draft.`,
          path: ["lines", idx, "parentLineNumber"],
        });
      }
    });

    // C2 invariant: a MISSING-sourced field must carry value: null.
    const checkField = (field: { blockId: string; value: unknown; provenance: { source: string } }, path: (string | number)[]) => {
      if (field.provenance.source === "MISSING" && field.value !== null) {
        ctx.addIssue({
          code: "custom",
          message: `Block ${field.blockId} is sourced MISSING but carries a non-null value.`,
          path,
        });
      }
    };
    for (const [key, field] of Object.entries(draft.header.fields)) {
      checkField(field, ["header", "fields", key]);
    }
    draft.lines.forEach((line, lineIdx) => {
      for (const [key, field] of Object.entries(line.fields)) {
        checkField(field, ["lines", lineIdx, "fields", key]);
      }
    });
  });

export type EntrySummaryDraftParsed = z.infer<typeof entrySummaryDraftSchema>;

// Sanity check run at module load: every declared block id is unique and
// matches the /^B\d{2}[A-Z_]*$/ shape the issue specifies.
(function assertBlockIdsWellFormed() {
  const seen = new Set<string>();
  for (const id of ALL_BLOCK_IDS) {
    if (!BLOCK_ID_PATTERN.test(id)) {
      throw new Error(`Block id "${id}" does not match /^B\\d{2}[A-Z_]*$/.`);
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate block id "${id}".`);
    }
    seen.add(id);
  }
})();

export { BLOCK_ID_PATTERN };

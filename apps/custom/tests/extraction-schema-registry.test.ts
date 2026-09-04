import { describe, it, expect } from "vitest";
import {
  getExtractionSchema,
  getRequiredFields,
  getFieldExpectation,
  buildSchemaScopedInstructions,
} from "@/lib/documents/extractionSchemas";
import type { DocumentType } from "@prisma/client";

describe("extraction schema registry — newly added document types", () => {
  const typesWithSchemas: DocumentType[] = [
    "FORWARDING_INSTRUCTION",
    "BOOKING_REQUEST",
    "ARRIVAL_NOTICE",
    "PURCHASE_ORDER",
    "DELIVERY_NOTE",
    "SHIPPING_INSTRUCTION",
    "CMR",
    "SEA_WAYBILL",
    "CUSTOMS_ENTRY",
    "EUR1_CERTIFICATE",
    "ATR_CERTIFICATE",
    "EXPORT_DECLARATION",
    "IMPORT_DECLARATION",
  ];

  it.each(typesWithSchemas)("%s has a non-empty schema with at least one required field", (docType) => {
    const schema = getExtractionSchema(docType);
    expect(schema.length).toBeGreaterThan(0);
    expect(getRequiredFields(docType).length).toBeGreaterThan(0);
  });

  it("a field outside a document type's schema is NOT_EXPECTED", () => {
    // CMR has no invoice_number field -- a Commercial-Invoice-only field must
    // not silently apply to a road-freight consignment note.
    expect(getFieldExpectation("CMR", "invoice_number")).toBe("NOT_EXPECTED");
  });

  it("EXPORT_DECLARATION and IMPORT_DECLARATION reuse the CUSTOMS_ENTRY schema", () => {
    expect(getExtractionSchema("EXPORT_DECLARATION")).toEqual(getExtractionSchema("CUSTOMS_ENTRY"));
    expect(getExtractionSchema("IMPORT_DECLARATION")).toEqual(getExtractionSchema("CUSTOMS_ENTRY"));
  });

  it("builds schema-scoped prompt instructions for a new document type", () => {
    const instructions = buildSchemaScopedInstructions("EUR1_CERTIFICATE");
    expect(instructions).toContain("EUR1_CERTIFICATE");
    expect(instructions).toContain("Certificate Number");
  });
});

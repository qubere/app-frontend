import { describe, it, expect } from "vitest";
import { getFieldExpectation, buildSchemaScopedInstructions, getSchemaVersion } from "./extractionSchemas";

describe("getFieldExpectation", () => {
  it("returns EXPECTED for a required field on its document type", () => {
    expect(getFieldExpectation("COMMERCIAL_INVOICE", "invoice_number")).toBe("EXPECTED");
  });

  it("returns OPTIONAL for a non-required field listed on its document type", () => {
    expect(getFieldExpectation("COMMERCIAL_INVOICE", "incoterm")).toBe("OPTIONAL");
  });

  it("returns NOT_EXPECTED for a field not listed on the document type's schema", () => {
    expect(getFieldExpectation("COMMERCIAL_INVOICE", "bl_number")).toBe("NOT_EXPECTED");
  });

  it("returns NOT_EXPECTED (not MISSING_REQUIRED) for a Packing List missing an entry number -- that field belongs to Shipment/Filing Readiness, not this document type", () => {
    expect(getFieldExpectation("PACKING_LIST", "entry_number")).toBe("NOT_EXPECTED");
  });

  it("returns NOT_EXPECTED for any field on OTHER, which has no schema", () => {
    expect(getFieldExpectation("OTHER", "invoice_number")).toBe("NOT_EXPECTED");
  });

  it("returns NOT_EXPECTED for a null/undefined document type", () => {
    expect(getFieldExpectation(null, "invoice_number")).toBe("NOT_EXPECTED");
    expect(getFieldExpectation(undefined, "invoice_number")).toBe("NOT_EXPECTED");
  });
});

describe("getSchemaVersion", () => {
  it("returns 1 for a document type whose field list has never changed", () => {
    expect(getSchemaVersion("COMMERCIAL_INVOICE")).toBe(1);
  });

  it("returns 1 for a null/undefined document type", () => {
    expect(getSchemaVersion(null)).toBe(1);
    expect(getSchemaVersion(undefined)).toBe(1);
  });
});

describe("buildSchemaScopedInstructions", () => {
  it("lists required and optional fields for a document type with a schema", () => {
    const instructions = buildSchemaScopedInstructions("COMMERCIAL_INVOICE");
    expect(instructions).not.toBeNull();
    expect(instructions).toContain("COMMERCIAL_INVOICE");
    expect(instructions).toContain("Invoice Number");
    expect(instructions).toContain("Incoterm");
  });

  it("returns null for OTHER, which has no schema", () => {
    expect(buildSchemaScopedInstructions("OTHER")).toBeNull();
  });

  it("returns null for a document type with no schema entry", () => {
    expect(buildSchemaScopedInstructions("PROOF_OF_DELIVERY")).toBeNull();
    expect(buildSchemaScopedInstructions("CARRIER_INVOICE")).toBeNull();
  });

  it("returns null for a null/undefined document type", () => {
    expect(buildSchemaScopedInstructions(null)).toBeNull();
    expect(buildSchemaScopedInstructions(undefined)).toBeNull();
  });
});

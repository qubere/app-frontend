import { describe, it, expect } from "vitest";
import { getFieldExpectation } from "./extractionSchemas";

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

  it("returns NOT_EXPECTED for any field on OTHER, which has no schema", () => {
    expect(getFieldExpectation("OTHER", "invoice_number")).toBe("NOT_EXPECTED");
  });

  it("returns NOT_EXPECTED for a null/undefined document type", () => {
    expect(getFieldExpectation(null, "invoice_number")).toBe("NOT_EXPECTED");
    expect(getFieldExpectation(undefined, "invoice_number")).toBe("NOT_EXPECTED");
  });
});

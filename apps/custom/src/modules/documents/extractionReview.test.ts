import { describe, it, expect } from "vitest";
import { buildReviewFields, evaluateFieldVerification, type RawExtractionField } from "./extractionReview";

function row(overrides: Partial<RawExtractionField> = {}): RawExtractionField {
  return {
    id: "row-1",
    fieldName: "invoice_number",
    value: "INV-1",
    confidence: 90,
    pageNumber: 1,
    bbox: null,
    source: "MACHINE",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("evaluateFieldVerification", () => {
  it("returns NOT_APPLICABLE when the field doesn't belong on this document type", () => {
    expect(
      evaluateFieldVerification({
        corrected: false,
        confidence: 95,
        expectation: "NOT_EXPECTED",
        hasMachineRead: true,
      })
    ).toEqual({ state: "NOT_APPLICABLE", reasonCode: null });
  });

  it("returns MISSING_REQUIRED when an expected field has no machine read and no correction", () => {
    expect(
      evaluateFieldVerification({
        corrected: false,
        confidence: null,
        expectation: "EXPECTED",
        hasMachineRead: false,
      })
    ).toEqual({ state: "MISSING_REQUIRED", reasonCode: "MISSING_ON_SOURCE_DOCUMENT" });
  });

  it("returns CONFLICT when the caller flags a cross-document conflict", () => {
    expect(
      evaluateFieldVerification({
        corrected: false,
        confidence: 95,
        expectation: "OPTIONAL",
        hasMachineRead: true,
        hasConflict: true,
      })
    ).toEqual({ state: "CONFLICT", reasonCode: "CROSS_DOCUMENT_CONFLICT" });
  });

  it("returns AUTO_VERIFIED for a corrected field", () => {
    expect(
      evaluateFieldVerification({
        corrected: true,
        confidence: null,
        expectation: "EXPECTED",
        hasMachineRead: false,
      })
    ).toEqual({ state: "AUTO_VERIFIED", reasonCode: null });
  });

  it("returns AUTO_VERIFIED for a high-confidence uncorrected field", () => {
    expect(
      evaluateFieldVerification({
        corrected: false,
        confidence: 85,
        expectation: "OPTIONAL",
        hasMachineRead: true,
      })
    ).toEqual({ state: "AUTO_VERIFIED", reasonCode: null });
  });

  it("returns NEEDS_REVIEW for a low-confidence uncorrected field", () => {
    expect(
      evaluateFieldVerification({
        corrected: false,
        confidence: 40,
        expectation: "OPTIONAL",
        hasMachineRead: true,
      })
    ).toEqual({ state: "NEEDS_REVIEW", reasonCode: "LOW_CONFIDENCE" });
  });
});

describe("buildReviewFields — verification and needsReview alias", () => {
  it("keeps needsReview consistent with verification for a high-confidence field", () => {
    const fields = buildReviewFields([row({ confidence: 95 })], "COMMERCIAL_INVOICE");
    const field = fields.find((f) => f.fieldName === "invoice_number")!;
    expect(field.verification).toBe("AUTO_VERIFIED");
    expect(field.needsReview).toBe(false);
  });

  it("keeps needsReview consistent with verification for a low-confidence field", () => {
    const fields = buildReviewFields([row({ confidence: 30 })], "COMMERCIAL_INVOICE");
    const field = fields.find((f) => f.fieldName === "invoice_number")!;
    expect(field.verification).toBe("NEEDS_REVIEW");
    expect(field.reasonCode).toBe("LOW_CONFIDENCE");
    expect(field.needsReview).toBe(true);
  });

  it("marks a field not on the document type's schema as NOT_APPLICABLE", () => {
    const fields = buildReviewFields([row({ fieldName: "bl_number", confidence: 95 })], "COMMERCIAL_INVOICE");
    const field = fields.find((f) => f.fieldName === "bl_number")!;
    expect(field.verification).toBe("NOT_APPLICABLE");
    expect(field.needsReview).toBe(false);
  });

  it("synthesizes a MISSING_REQUIRED placeholder for a required field with zero rows", () => {
    const fields = buildReviewFields([row({ fieldName: "invoice_number" })], "COMMERCIAL_INVOICE");
    const missing = fields.find((f) => f.fieldName === "seller_name");
    expect(missing).toBeDefined();
    expect(missing?.verification).toBe("MISSING_REQUIRED");
    expect(missing?.reasonCode).toBe("MISSING_ON_SOURCE_DOCUMENT");
    expect(missing?.needsReview).toBe(true);
    expect(missing?.currentValue).toBe("");
  });

  it("does not synthesize placeholders when no docType is passed", () => {
    const fields = buildReviewFields([row({ fieldName: "invoice_number" })]);
    expect(fields.find((f) => f.fieldName === "seller_name")).toBeUndefined();
  });

  it("does not synthesize placeholders for optional fields", () => {
    const fields = buildReviewFields([row({ fieldName: "invoice_number" })], "COMMERCIAL_INVOICE");
    expect(fields.find((f) => f.fieldName === "incoterm")).toBeUndefined();
  });
});

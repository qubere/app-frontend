import { describe, it, expect } from "vitest";
import {
  buildReviewFields,
  evaluateFieldVerification,
  sortByReviewPriority,
  summarizeVerification,
  type RawExtractionField,
  type ReviewField,
} from "./extractionReview";

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

  it("marks a field as CONFLICT when it's named in conflictedFieldNames", () => {
    const fields = buildReviewFields(
      [row({ fieldName: "invoice_number", confidence: 95 })],
      "COMMERCIAL_INVOICE",
      new Set(["invoice_number"])
    );
    const field = fields.find((f) => f.fieldName === "invoice_number")!;
    expect(field.verification).toBe("CONFLICT");
    expect(field.reasonCode).toBe("CROSS_DOCUMENT_CONFLICT");
    expect(field.needsReview).toBe(true);
  });

  it("leaves a field unaffected when conflictedFieldNames doesn't name it", () => {
    const fields = buildReviewFields(
      [row({ fieldName: "invoice_number", confidence: 95 })],
      "COMMERCIAL_INVOICE",
      new Set(["seller_name"])
    );
    const field = fields.find((f) => f.fieldName === "invoice_number")!;
    expect(field.verification).toBe("AUTO_VERIFIED");
  });
});

function reviewField(overrides: Partial<ReviewField> = {}): ReviewField {
  return {
    fieldName: "z_field",
    currentValue: "value",
    originalValue: null,
    confidence: 90,
    pageNumber: null,
    bbox: null,
    corrected: false,
    needsReview: false,
    verification: "AUTO_VERIFIED",
    reasonCode: null,
    history: [],
    ...overrides,
  };
}

describe("sortByReviewPriority", () => {
  it("orders MISSING_REQUIRED, CONFLICT, NEEDS_REVIEW, AUTO_VERIFIED, NOT_APPLICABLE", () => {
    const fields = [
      reviewField({ fieldName: "b_auto", verification: "AUTO_VERIFIED" }),
      reviewField({ fieldName: "a_missing", verification: "MISSING_REQUIRED" }),
      reviewField({ fieldName: "c_na", verification: "NOT_APPLICABLE" }),
      reviewField({ fieldName: "d_conflict", verification: "CONFLICT" }),
      reviewField({ fieldName: "e_needs", verification: "NEEDS_REVIEW" }),
    ];

    const sorted = sortByReviewPriority(fields).map((f) => f.verification);
    expect(sorted).toEqual(["MISSING_REQUIRED", "CONFLICT", "NEEDS_REVIEW", "AUTO_VERIFIED", "NOT_APPLICABLE"]);
  });

  it("breaks ties within a bucket alphabetically by fieldName", () => {
    const fields = [
      reviewField({ fieldName: "zeta", verification: "NEEDS_REVIEW" }),
      reviewField({ fieldName: "alpha", verification: "NEEDS_REVIEW" }),
    ];

    const sorted = sortByReviewPriority(fields).map((f) => f.fieldName);
    expect(sorted).toEqual(["alpha", "zeta"]);
  });

  it("does not mutate the input array", () => {
    const fields = [reviewField({ fieldName: "b" }), reviewField({ fieldName: "a" })];
    const original = [...fields];
    sortByReviewPriority(fields);
    expect(fields).toEqual(original);
  });
});

describe("summarizeVerification", () => {
  it("counts fields per verification state, including zero for absent states", () => {
    const fields = [
      reviewField({ verification: "AUTO_VERIFIED" }),
      reviewField({ verification: "AUTO_VERIFIED" }),
      reviewField({ verification: "CONFLICT" }),
    ];

    expect(summarizeVerification(fields)).toEqual({
      AUTO_VERIFIED: 2,
      NEEDS_REVIEW: 0,
      CONFLICT: 1,
      MISSING_REQUIRED: 0,
      NOT_APPLICABLE: 0,
    });
  });

  it("returns all-zero counts for an empty list", () => {
    expect(summarizeVerification([])).toEqual({
      AUTO_VERIFIED: 0,
      NEEDS_REVIEW: 0,
      CONFLICT: 0,
      MISSING_REQUIRED: 0,
      NOT_APPLICABLE: 0,
    });
  });
});

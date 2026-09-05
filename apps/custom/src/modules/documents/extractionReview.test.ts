import { describe, it, expect } from "vitest";
import {
  buildReviewFields,
  evaluateFieldVerification,
  isDocumentFullyReviewed,
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

  it("merges an OCR_AI_AGENT freeform label and a DOC_INTEL_STRUCTURED key for the same fact into one field", () => {
    const fields = buildReviewFields(
      [
        row({
          id: "row-ocr",
          fieldName: "Invoice Number",
          value: "INV-100",
          confidence: 60,
          source: "OCR_AI_AGENT",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
        row({
          id: "row-structured",
          fieldName: "invoiceNumber",
          value: "INV-100",
          confidence: 95,
          source: "DOC_INTEL_STRUCTURED",
          createdAt: "2026-01-01T00:00:01.000Z",
        }),
      ],
      "COMMERCIAL_INVOICE"
    );

    const matches = fields.filter((f) => f.fieldName === "invoice_number");
    expect(matches).toHaveLength(1);
    expect(matches[0].history).toHaveLength(2);
    expect(matches[0].verification).toBe("AUTO_VERIFIED");
  });

  it("keeps an unresolvable freeform label in its own bucket", () => {
    const fields = buildReviewFields(
      [row({ fieldName: "Some Unrecognized Freeform Label", source: "OCR_AI_AGENT" })],
      "COMMERCIAL_INVOICE"
    );

    expect(fields.find((f) => f.fieldName === "Some Unrecognized Freeform Label")).toBeDefined();
  });

  it("flags the merged field as CONFLICT when the reconciliation-vocabulary name is in conflictedFieldNames, even though the current value comes from the OCR_AI_AGENT row", () => {
    const fields = buildReviewFields(
      [
        row({
          id: "row-ocr",
          fieldName: "Invoice Number",
          value: "INV-100",
          confidence: 95,
          source: "OCR_AI_AGENT",
          createdAt: "2026-01-01T00:00:01.000Z",
        }),
        row({
          id: "row-structured",
          fieldName: "invoiceNumber",
          value: "INV-999",
          confidence: 95,
          source: "DOC_INTEL_STRUCTURED",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
      "COMMERCIAL_INVOICE",
      new Set(["invoiceNumber"])
    );

    const field = fields.find((f) => f.fieldName === "invoice_number")!;
    expect(field.verification).toBe("CONFLICT");
    expect(field.currentValue).toBe("INV-100");
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
      HUMAN_CONFIRMED: 0,
      HUMAN_CORRECTED: 0,
      REJECTED: 0,
    });
  });

  it("returns all-zero counts for an empty list", () => {
    expect(summarizeVerification([])).toEqual({
      AUTO_VERIFIED: 0,
      NEEDS_REVIEW: 0,
      CONFLICT: 0,
      MISSING_REQUIRED: 0,
      NOT_APPLICABLE: 0,
      HUMAN_CONFIRMED: 0,
      HUMAN_CORRECTED: 0,
      REJECTED: 0,
    });
  });
});

describe("isDocumentFullyReviewed", () => {
  it("is true when every field is settled and no reconciliation issue is open", () => {
    const fields = [reviewField({ verification: "AUTO_VERIFIED" }), reviewField({ verification: "NOT_APPLICABLE" })];
    expect(isDocumentFullyReviewed(fields, false)).toBe(true);
  });

  it("is false when a field is missing, conflicting, or needs review", () => {
    expect(isDocumentFullyReviewed([reviewField({ verification: "MISSING_REQUIRED" })], false)).toBe(false);
    expect(isDocumentFullyReviewed([reviewField({ verification: "CONFLICT" })], false)).toBe(false);
    expect(isDocumentFullyReviewed([reviewField({ verification: "NEEDS_REVIEW" })], false)).toBe(false);
  });

  it("is false when a cross-document reconciliation issue is still open, even with every field settled", () => {
    const fields = [reviewField({ verification: "AUTO_VERIFIED" })];
    expect(isDocumentFullyReviewed(fields, true)).toBe(false);
  });

  it("is true for a document with no fields at all and no open issues", () => {
    expect(isDocumentFullyReviewed([], false)).toBe(true);
  });
});

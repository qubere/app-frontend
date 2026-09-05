import { describe, it, expect } from "vitest";
import { computeReadinessScore, computeReadinessBreakdown, type ReadinessShipmentInput } from "@/lib/shipmentReadiness";

function baseInput(overrides: Partial<ReadinessShipmentInput> = {}): ReadinessShipmentInput {
  return {
    documents: [],
    lineItems: [],
    exceptionItems: [],
    avgExtractionConfidence: null,
    blockingReconciliationIssues: 0,
    ...overrides,
  };
}

describe("computeReadinessScore — boundary conditions (E-5)", () => {
  it("scores 0 when there are no documents, no line items, and no extraction", () => {
    expect(computeReadinessScore(baseInput())).toBe(0);
  });

  it("scores 100 when all factors are fully satisfied", () => {
    const score = computeReadinessScore(
      baseInput({
        documents: [
          { docType: "Commercial Invoice", status: "Processed" },
          { docType: "Packing List", status: "Received" },
          { docType: "Bill of Lading", status: "Completed" },
        ],
        lineItems: [
          { htsCode: "8471.30", countryOfOrigin: "CN", quantity: 10, unitPrice: 500, status: "Valid" },
          { htsCode: "8471.41", countryOfOrigin: "CN", quantity: 5, unitPrice: 800, status: "Valid" },
        ],
        exceptionItems: [], // no open exceptions
        avgExtractionConfidence: 92,
        blockingReconciliationIssues: 0,
      })
    );

    expect(score).toBe(100);
  });
});

describe("computeReadinessScore — factor 1: document completeness", () => {
  it("awards 25 pts when all three required doc types are present", () => {
    const { factors } = computeReadinessBreakdown(
      baseInput({
        documents: [
          { docType: "Commercial Invoice", status: "Received" },
          { docType: "Packing List", status: "Received" },
          { docType: "Bill of Lading", status: "Received" },
        ],
      })
    );
    expect(factors[0].points).toBe(25);
    expect(factors[0].maxPoints).toBe(25);
  });

  it("awards 0 pts for document completeness when no documents present", () => {
    const { factors } = computeReadinessBreakdown(baseInput());
    expect(factors[0].points).toBe(0);
  });

  it("awards partial pts when only one required doc type is present", () => {
    const { factors } = computeReadinessBreakdown(
      baseInput({ documents: [{ docType: "Commercial Invoice", status: "Received" }] })
    );
    expect(factors[0].points).toBeGreaterThan(0);
    expect(factors[0].points).toBeLessThan(25);
  });
});

describe("computeReadinessScore — factor 2: extraction quality", () => {
  it("awards 0 pts when avgExtractionConfidence is null", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ avgExtractionConfidence: null }));
    expect(factors[1].points).toBe(0);
  });

  it("awards full 20 pts when avgExtractionConfidence is ≥ 80", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ avgExtractionConfidence: 80 }));
    expect(factors[1].points).toBe(20);
  });

  it("awards proportional pts for confidence below 80", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ avgExtractionConfidence: 40 }));
    expect(factors[1].points).toBeGreaterThan(0);
    expect(factors[1].points).toBeLessThan(20);
  });
});

const withDoc = (overrides: Partial<ReadinessShipmentInput> = {}) =>
  baseInput({ documents: [{ docType: "Commercial Invoice", status: "Received" }], ...overrides });

describe("computeReadinessScore — factor 3: exception status", () => {
  it("awards 0 pts when there are no documents (vacuous no-exception state)", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ exceptionItems: [] }));
    expect(factors[2].points).toBe(0);
  });

  it("awards 25 pts when there are documents and no open exceptions", () => {
    const { factors } = computeReadinessBreakdown(withDoc({ exceptionItems: [] }));
    expect(factors[2].points).toBe(25);
  });

  it("deducts 5 pts per blocking exception", () => {
    const { factors } = computeReadinessBreakdown(
      withDoc({
        exceptionItems: [
          { status: "Open", severity: "Critical", blocking: true },
          { status: "Open", severity: "Critical", blocking: true },
        ],
      })
    );
    expect(factors[2].points).toBe(15); // 25 - 2*5
  });

  it("deducts 2 pts per non-blocking open exception", () => {
    const { factors } = computeReadinessBreakdown(
      withDoc({
        exceptionItems: [
          { status: "Open", severity: "Medium", blocking: false },
          { status: "Open", severity: "Low", blocking: false },
        ],
      })
    );
    expect(factors[2].points).toBe(21); // 25 - 2*2
  });

  it("floors at 0 when exceptions overwhelm the factor", () => {
    const manyBlockers = Array.from({ length: 10 }, () => ({
      status: "Open",
      severity: "Critical",
      blocking: true,
    }));
    const { factors } = computeReadinessBreakdown(withDoc({ exceptionItems: manyBlockers }));
    expect(factors[2].points).toBe(0);
  });
});

const withTwoDocs = (overrides: Partial<ReadinessShipmentInput> = {}) =>
  baseInput({
    documents: [
      { docType: "Commercial Invoice", status: "Received" },
      { docType: "Packing List", status: "Received" },
    ],
    ...overrides,
  });

describe("computeReadinessScore — factor 5: reconciliation pass", () => {
  it("awards 0 pts when fewer than 2 documents are attached (nothing to reconcile)", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ blockingReconciliationIssues: 0 }));
    expect(factors[4].points).toBe(0);
  });

  it("awards 10 pts when ≥ 2 documents and no blocking reconciliation issues", () => {
    const { factors } = computeReadinessBreakdown(
      withTwoDocs({ blockingReconciliationIssues: 0 })
    );
    expect(factors[4].points).toBe(10);
  });

  it("awards 0 pts when there is at least one blocking reconciliation issue", () => {
    const { factors } = computeReadinessBreakdown(
      withTwoDocs({ blockingReconciliationIssues: 1 })
    );
    expect(factors[4].points).toBe(0);
    expect(factors[4].contributingItems[0]).toContain("unresolved blocking reconciliation issue");
  });

  it("awards 0 pts on a live invoice-vs-packing quantity mismatch even with no issue row yet", () => {
    const { factors } = computeReadinessBreakdown(
      withTwoDocs({ blockingReconciliationIssues: 0, liveQuantityMismatch: true })
    );
    expect(factors[4].points).toBe(0);
    expect(factors[4].contributingItems[0]).toContain("quantity mismatch");
  });
});

describe("computeReadinessScore — factor 4: classification coverage", () => {
  const line = (overrides: Partial<ReadinessShipmentInput["lineItems"][number]> = {}) => ({
    htsCode: "8471.30",
    countryOfOrigin: "CN",
    quantity: 1,
    unitPrice: 100,
    status: "Valid",
    ...overrides,
  });

  it("awards full 20 pts when every line has an HTS code and a Valid (human-approved) status", () => {
    const { factors } = computeReadinessBreakdown(baseInput({ lineItems: [line(), line()] }));
    expect(factors[3].points).toBe(20);
  });

  it("does NOT count a line that has an HTS code but is not human-approved", () => {
    // Regression: the old filter OR-ed in Boolean(li.htsCode), so any coded
    // line counted as approved and the status check was dead.
    const { factors } = computeReadinessBreakdown(
      baseInput({
        lineItems: [line({ status: "Valid" }), line({ status: "Needs Review" })],
      })
    );
    expect(factors[3].points).toBe(10); // 1 of 2 approved
    expect(factors[3].contributingItems[0]).toBe("1 of 2 line items classified");
  });

  it("awards 0 pts when lines have HTS codes but none are approved", () => {
    const { factors } = computeReadinessBreakdown(
      baseInput({ lineItems: [line({ status: null }), line({ status: "Needs Review" })] })
    );
    expect(factors[3].points).toBe(0);
  });
});

describe("computeReadinessBreakdown — structure", () => {
  it("returns five named factors that sum to the total score", () => {
    const { totalScore, factors } = computeReadinessBreakdown(baseInput());
    expect(factors).toHaveLength(5);
    const sum = factors.reduce((s, f) => s + f.points, 0);
    expect(sum).toBe(totalScore);
  });

  it("each factor exposes a maxPoints value", () => {
    const { factors } = computeReadinessBreakdown(baseInput());
    const maxes = factors.map((f) => f.maxPoints);
    expect(maxes).toEqual([25, 20, 25, 20, 10]);
  });
});

import { describe, it, expect } from "vitest";
import { detectPlanChanges, type PlanFieldReading } from "./planChangeDetector";

function reading(overrides: Partial<PlanFieldReading> = {}): PlanFieldReading {
  return {
    fieldKey: "totalQuantity",
    value: "500",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentId: "doc-1",
    docType: "Commercial Invoice",
    ...overrides,
  };
}

describe("detectPlanChanges", () => {
  it("flags a baseline-vs-current drift outside the field's tolerance", () => {
    const { results, evaluatedFieldKeys } = detectPlanChanges([
      reading({ value: "500", createdAt: "2026-01-01T00:00:00.000Z", documentId: "doc-1" }),
      reading({ value: "300", createdAt: "2026-01-02T00:00:00.000Z", documentId: "doc-2", docType: "Packing List" }),
    ]);

    expect(evaluatedFieldKeys).toEqual(["totalQuantity"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fieldKey: "totalQuantity",
      baselineValue: "500",
      baselineDocumentId: "doc-1",
      currentValue: "300",
      currentDocumentId: "doc-2",
    });
  });

  it("returns no result and does not count as evaluated when there's only one reading", () => {
    const { results, evaluatedFieldKeys } = detectPlanChanges([reading()]);
    expect(results).toEqual([]);
    expect(evaluatedFieldKeys).toEqual([]);
  });

  it("still counts a field as evaluated when a correction reverts back to the baseline value", () => {
    const { results, evaluatedFieldKeys } = detectPlanChanges([
      reading({ value: "500", createdAt: "2026-01-01T00:00:00.000Z" }),
      reading({ value: "480", createdAt: "2026-01-02T00:00:00.000Z" }),
      reading({ value: "500", createdAt: "2026-01-03T00:00:00.000Z", docType: "Packing List" }),
    ]);

    expect(evaluatedFieldKeys).toEqual(["totalQuantity"]);
    expect(results).toEqual([]);
  });

  it("does not flag a numeric difference within the field's tolerance", () => {
    // grossWeight (weight_unit) has a 5% tolerance rule (WEIGHT_INV_PACK).
    const { results, evaluatedFieldKeys } = detectPlanChanges([
      reading({ fieldKey: "grossWeight", value: "100 kg", createdAt: "2026-01-01T00:00:00.000Z" }),
      reading({ fieldKey: "grossWeight", value: "103 kg", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(evaluatedFieldKeys).toEqual(["grossWeight"]);
    expect(results).toEqual([]);
  });

  it("skips a field entirely when a value can't be normalized/parsed", () => {
    const { results, evaluatedFieldKeys } = detectPlanChanges([
      reading({ fieldKey: "totalValue", value: "not-a-number", createdAt: "2026-01-01T00:00:00.000Z" }),
      reading({ fieldKey: "totalValue", value: "500", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(evaluatedFieldKeys).toEqual([]);
    expect(results).toEqual([]);
  });

  it("ignores a fieldKey that isn't tracked by any reconciliation rule", () => {
    const { results, evaluatedFieldKeys } = detectPlanChanges([
      reading({ fieldKey: "someUntrackedField", value: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      reading({ fieldKey: "someUntrackedField", value: "b", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(evaluatedFieldKeys).toEqual([]);
    expect(results).toEqual([]);
  });
});

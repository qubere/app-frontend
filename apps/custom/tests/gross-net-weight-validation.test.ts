import { describe, it, expect } from "vitest";
import { isGrossWeightBelowNetWeight } from "@/modules/shipment/reconciliationEngine";

describe("isGrossWeightBelowNetWeight", () => {
  it("flags a document whose gross weight is lower than its own net weight", () => {
    expect(isGrossWeightBelowNetWeight("10 kg", "12 kg")).toBe(true);
  });

  it("does not flag a document whose gross weight is at or above net weight", () => {
    expect(isGrossWeightBelowNetWeight("12 kg", "10 kg")).toBe(false);
    expect(isGrossWeightBelowNetWeight("10 kg", "10 kg")).toBe(false);
  });

  it("compares across units before deciding", () => {
    // 9000 g = 9 kg gross, which is below a 10 kg net weight.
    expect(isGrossWeightBelowNetWeight("9000 g", "10 kg")).toBe(true);
    // 22.0462 lb ~= 10 kg gross, which is not below a 9 kg net weight.
    expect(isGrossWeightBelowNetWeight("22.0462 lb", "9 kg")).toBe(false);
  });

  it("returns null when either value cannot be parsed as a weight", () => {
    expect(isGrossWeightBelowNetWeight("see attached", "10 kg")).toBeNull();
    expect(isGrossWeightBelowNetWeight("10 kg", "")).toBeNull();
  });
});

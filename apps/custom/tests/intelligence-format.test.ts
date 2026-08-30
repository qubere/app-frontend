import { describe, it, expect } from "vitest";
import {
  accuracyTone,
  compactUsd,
  overrideTone,
  pct,
  riskTone,
} from "@/app/app/intelligence/intelligenceFormat";

describe("riskTone", () => {
  it("maps the free-text risk level, case-insensitively, defaulting to low", () => {
    expect(riskTone("Critical")).toBe("critical");
    expect(riskTone("HIGH")).toBe("high");
    expect(riskTone("medium")).toBe("medium");
    expect(riskTone("Low")).toBe("low");
    expect(riskTone(null)).toBe("low");
    expect(riskTone("weird")).toBe("low");
  });
});

describe("accuracyTone / overrideTone", () => {
  it("bands broker accuracy", () => {
    expect(accuracyTone(99)).toBe("low");
    expect(accuracyTone(96)).toBe("medium");
    expect(accuracyTone(91)).toBe("high");
  });
  it("bands override rate", () => {
    expect(overrideTone(2)).toBe("low");
    expect(overrideTone(6)).toBe("medium");
    expect(overrideTone(12)).toBe("high");
  });
});

describe("compactUsd", () => {
  it("scales to K / M / B", () => {
    expect(compactUsd(850)).toBe("$850");
    expect(compactUsd(12_500)).toBe("$12.5K");
    expect(compactUsd(3_400_000)).toBe("$3.4M");
    expect(compactUsd(2_100_000_000)).toBe("$2.1B");
  });
  it("is NaN-safe", () => {
    expect(compactUsd(NaN)).toBe("—");
  });
});

describe("pct", () => {
  it("formats and is NaN-safe", () => {
    expect(pct(2.567)).toBe("2.6%");
    expect(pct(98, 0)).toBe("98%");
    expect(pct(NaN)).toBe("—");
  });
});

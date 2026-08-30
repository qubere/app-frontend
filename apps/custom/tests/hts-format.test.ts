import { describe, it, expect } from "vitest";
import {
  codeLevelLabel,
  headlineRate,
  isClassifiable,
  looksLikeCode,
  normalizeHtsQuery,
} from "@/app/app/hts/htsFormat";

describe("codeLevelLabel", () => {
  it("names each HTS level", () => {
    expect(codeLevelLabel(2)).toBe("Chapter");
    expect(codeLevelLabel(4)).toBe("Heading");
    expect(codeLevelLabel(6)).toBe("Subheading");
    expect(codeLevelLabel(8)).toBe("Tariff line");
    expect(codeLevelLabel(10)).toBe("Statistical suffix");
    expect(codeLevelLabel(7)).toBe("Level 7");
  });
});

describe("isClassifiable", () => {
  it("is true only at 8-digit and deeper", () => {
    expect(isClassifiable(2)).toBe(false);
    expect(isClassifiable(6)).toBe(false);
    expect(isClassifiable(8)).toBe(true);
    expect(isClassifiable(10)).toBe(true);
  });
});

describe("headlineRate", () => {
  it("prefers the General column", () => {
    expect(
      headlineRate([
        { rateColumn: "Special", rawRateText: "Free" },
        { rateColumn: "General", rawRateText: "2.6%" },
        { rateColumn: "Column 2", rawRateText: "35%" },
      ])
    ).toBe("2.6%");
  });

  it("renders Free from the isFree flag", () => {
    expect(headlineRate([{ rateColumn: "General", rawRateText: "", isFree: true }])).toBe("Free");
  });

  it("falls back to the first rate, then to a dash", () => {
    expect(headlineRate([{ rateColumn: "Column 2", rawRateText: "35%" }])).toBe("35%");
    expect(headlineRate([])).toBe("—");
    expect(headlineRate(undefined)).toBe("—");
  });
});

describe("normalizeHtsQuery / looksLikeCode", () => {
  it("strips non-digits", () => {
    expect(normalizeHtsQuery("8471.30.0100")).toBe("8471300100");
    expect(normalizeHtsQuery("laptop 8471")).toBe("8471");
  });

  it("recognizes a bare code vs keywords", () => {
    expect(looksLikeCode("8471.30")).toBe(true);
    expect(looksLikeCode("8471300100")).toBe(true);
    expect(looksLikeCode("laptop computer")).toBe(false);
    expect(looksLikeCode("847")).toBe(false); // too short
  });
});

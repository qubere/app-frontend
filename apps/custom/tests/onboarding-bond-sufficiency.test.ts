import { describe, it, expect } from "vitest";
import { Decimal } from "../src/lib/tariff/decimal";
import { requiredContinuousBondAmount } from "../src/modules/onboarding/bondSufficiency";

function req(dtf: number) {
  return requiredContinuousBondAmount(new Decimal(dtf)).toNumber();
}

describe("requiredContinuousBondAmount", () => {
  it("$0 prior-year DTF → $50,000 floor", () => {
    expect(req(0)).toBe(50_000);
  });

  it("$400,000 DTF → 10% = $40,000 → floor raises to $50,000", () => {
    expect(req(400_000)).toBe(50_000);
  });

  it("$500,000 DTF → 10% = $50,000 → at floor exactly", () => {
    expect(req(500_000)).toBe(50_000);
  });

  it("$600,000 DTF → 10% = $60,000 → rounds to next $10k = $60,000", () => {
    expect(req(600_000)).toBe(60_000);
  });

  it("$650,001 DTF → 10% = $65,000.10 → rounds up to $70,000", () => {
    expect(req(650_001)).toBe(70_000);
  });

  it("$999,999 DTF → 10% = $99,999.90 → rounds up to $100,000", () => {
    expect(req(999_999)).toBe(100_000);
  });

  it("$1,000,000 DTF → 10% = $100,000 → at $100k boundary, rounds to next $100k = $100,000", () => {
    expect(req(1_000_000)).toBe(100_000);
  });

  it("$1,000,001 DTF → 10% = $100,000.10 → rounds up to $200,000", () => {
    expect(req(1_000_001)).toBe(200_000);
  });

  it("$9,000,000 DTF → 10% = $900,000 → at $100k boundary = $900,000", () => {
    expect(req(9_000_000)).toBe(900_000);
  });

  it("$9,500,000 DTF → 10% = $950,000 → rounds to $1,000,000", () => {
    expect(req(9_500_000)).toBe(1_000_000);
  });
});

describe("suretyCodes lookup", () => {
  it("looks up by 3-digit code", async () => {
    const { lookupSuretyByCode } = await import("../src/lib/abi/suretyCodes");
    const entry = lookupSuretyByCode("913");
    expect(entry?.name).toBe("WESTERN SURETY COMPANY");
  });

  it("looks up by name (case-insensitive)", async () => {
    const { lookupSuretyByName } = await import("../src/lib/abi/suretyCodes");
    const entry = lookupSuretyByName("western surety company");
    expect(entry?.code).toBe("913");
  });

  it("returns undefined for unknown code", async () => {
    const { lookupSuretyByCode } = await import("../src/lib/abi/suretyCodes");
    expect(lookupSuretyByCode("999")).toBeUndefined();
  });

  it("zero-padded code 056 finds Transatlantic", async () => {
    const { lookupSuretyByCode } = await import("../src/lib/abi/suretyCodes");
    const entry = lookupSuretyByCode("056");
    expect(entry?.name).toContain("TRANSATLANTIC");
  });
});

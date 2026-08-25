import { describe, it, expect } from "vitest";
import { metaphone2, metaphone2Matches } from "@/modules/agents/compliance/restrictedParty/metaphone2";

describe("metaphone2", () => {
  it("returns an empty code for a string with no letters", () => {
    expect(metaphone2("123")).toBe("");
  });

  it("produces a non-empty code for an ordinary name", () => {
    expect(metaphone2("SMITH").length).toBeGreaterThan(0);
  });
});

describe("metaphone2Matches", () => {
  it("matches classic phonetic-equivalent spelling variants", () => {
    expect(metaphone2Matches("SMITH", "SMYTH")).toBe(true);
  });

  it("does not match clearly unrelated names", () => {
    expect(metaphone2Matches("ACME TRADING", "GLOBAL WIDGETS")).toBe(false);
  });

  it("returns false when both inputs have no letters", () => {
    expect(metaphone2Matches("123", "456")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  normalizeName,
  tokenize,
  stripCommonWords,
  normalizeForMatching,
  normalizeAddressForMatching,
  COMMON_WORDS,
  LEGAL_FORM_WORDS,
  WEAK_BUSINESS_TERMS,
  NAME_PARTICLES,
  ADDRESS_TERMS,
} from "@/modules/agents/compliance/restrictedParty/normalize";

// Legacy Oracle COMMON_WORDS reference table (CW_TYPE="WORD"), read in full
// from C:\C-Drive\AI-Cust\RPS\common_words.csv (135 data rows: 35 ALL / 10
// ADDRESS / 3 NAME / 87 REDFLAG). REDFLAG terms are export-control/sanctions
// vocabulary (e.g. PLUTONIUM, CENTRIFUGE, WEAPONS, CUBA, IRAN) and must NEVER
// be treated as name-normalization stop words -- they carry real screening
// signal and belong to redFlagCheck.ts's keyword-rule path, not here. This
// list is inlined (not read from the external CSV at test time -- that file
// lives outside this repo) purely to guard against future accidental
// inclusion in COMMON_WORDS.
const LEGACY_REDFLAG_SAMPLE = [
  "PLUTONIUM",
  "URANIUM",
  "CENTRIFUGE",
  "WEAPONS",
  "AUTOCLAVE",
  "UNSAFEGUARDED",
  "CUBA",
  "CUBAN",
  "IRAN",
  "IRANIAN",
  "IRAQ",
  "IRAQI",
  "SYRIA",
  "SYRIAN",
  "SUDAN",
  "SUDANESE",
  "AERIAL",
  "PARTICLE",
];

describe("normalizeName", () => {
  it("uppercases, trims, and collapses whitespace", () => {
    expect(normalizeName("  acme   trading co  ")).toBe("ACME TRADING CO");
  });

  it("strips punctuation, keeping letters/digits/spaces", () => {
    expect(normalizeName("Acme, Trading & Co. (Pvt.) Ltd.")).toBe("ACME TRADING CO PVT LTD");
  });

  it("strips diacritics", () => {
    expect(normalizeName("Société Générale")).toBe("SOCIETE GENERALE");
  });
});

describe("tokenize", () => {
  it("drops single-character tokens", () => {
    expect(tokenize("J P MORGAN")).toEqual(["MORGAN"]);
  });

  it("keeps multi-character tokens", () => {
    expect(tokenize("ACME TRADING CO")).toEqual(["ACME", "TRADING", "CO"]);
  });
});

describe("stripCommonWords", () => {
  it("removes legal-entity suffixes and connector words", () => {
    expect(stripCommonWords("ACME TRADING CO LTD")).toBe("ACME");
  });

  it("leaves a name with no common words unchanged", () => {
    expect(stripCommonWords("XINJIANG TEXTILES")).toBe("XINJIANG TEXTILES");
  });

  it("every entry in COMMON_WORDS is actually stripped", () => {
    for (const word of COMMON_WORDS) {
      expect(stripCommonWords(`ACME ${word}`)).toBe("ACME");
    }
  });

  it("strips SARL like the other legal-form suffixes (previously-confirmed missing gap)", () => {
    expect(stripCommonWords("ACME SARL")).toBe("ACME");
  });
});

describe("LEGAL_FORM_WORDS / WEAK_BUSINESS_TERMS / NAME_PARTICLES split", () => {
  it("COMMON_WORDS is exactly the union of LEGAL_FORM_WORDS, WEAK_BUSINESS_TERMS, and NAME_PARTICLES", () => {
    expect(new Set(COMMON_WORDS)).toEqual(new Set([...LEGAL_FORM_WORDS, ...WEAK_BUSINESS_TERMS, ...NAME_PARTICLES]));
  });

  it("the three lists do not overlap", () => {
    const weakSet = new Set(WEAK_BUSINESS_TERMS);
    const particleSet = new Set(NAME_PARTICLES);
    for (const word of LEGAL_FORM_WORDS) {
      expect(weakSet.has(word)).toBe(false);
      expect(particleSet.has(word)).toBe(false);
    }
    for (const word of WEAK_BUSINESS_TERMS) {
      expect(particleSet.has(word)).toBe(false);
    }
  });

  it("SARL is classified as a legal form, not a weak business term", () => {
    expect(LEGAL_FORM_WORDS).toContain("SARL");
    expect(WEAK_BUSINESS_TERMS).not.toContain("SARL");
  });
});

describe("legacy COMMON_WORDS (common_words.csv) gap closure", () => {
  it("strips LTDA like the other legal-form suffixes (legacy ALL-subtype word missing here)", () => {
    expect(stripCommonWords("ACME LTDA")).toBe("ACME");
    expect(LEGAL_FORM_WORDS).toContain("LTDA");
  });

  it("strips legacy weak/general terms newly added from the ALL subtype", () => {
    const legacyWeakTerms = [
      "AERO",
      "AIRLINES",
      "CENTER",
      "CENTRE",
      "EAST",
      "WEST",
      "NORTH",
      "SOUTH",
      "NO",
      "NUMBER",
      "INT",
      "INTERNACIONAL",
      "APARTADO",
      "CALLE",
    ];
    for (const word of legacyWeakTerms) {
      expect(stripCommonWords(`ACME ${word}`)).toBe("ACME");
    }
  });

  it("strips NAME_PARTICLES (DEL, AL, DE)", () => {
    expect(stripCommonWords("COMPANIA DEL PACIFICO")).toBe("COMPANIA PACIFICO");
    expect(NAME_PARTICLES).toEqual(["DEL", "AL", "DE"]);
  });

  it("none of the legacy REDFLAG sanctions/export-control terms are treated as name stop words", () => {
    const commonWordsSet = new Set(COMMON_WORDS);
    for (const word of LEGACY_REDFLAG_SAMPLE) {
      expect(commonWordsSet.has(word)).toBe(false);
    }
  });

  it("ADDRESS_TERMS is exported and kept independent of COMMON_WORDS (not stripped by stripCommonWords)", () => {
    expect(ADDRESS_TERMS).toEqual(["E", "N", "ST", "W", "C", "O", "P", "BOX", "STREET", "ROAD"]);
    const commonWordsSet = new Set(COMMON_WORDS);
    for (const word of ADDRESS_TERMS) {
      if (word.length <= 1) continue;
      expect(commonWordsSet.has(word)).toBe(false);
    }
    // A real street name is untouched by name-normalization stripping.
    expect(stripCommonWords("MAIN STREET")).toBe("MAIN STREET");
  });
});

describe("normalizeAddressForMatching", () => {
  it("strips ADDRESS_TERMS noise (directionals, STREET/ROAD/BOX) independent of name normalization", () => {
    expect(normalizeAddressForMatching("123 N Main Street")).toBe("123 MAIN");
    expect(normalizeAddressForMatching("PO Box 456 W Elm Road")).toBe("PO 456 ELM");
  });

  it("does not strip organization legal-form/weak-business-term words -- address normalization is a distinct vocabulary", () => {
    expect(normalizeAddressForMatching("The Corporation Building")).toBe("THE CORPORATION BUILDING");
  });

  it("falls back to the merely-normalized form when stripping empties the address", () => {
    expect(normalizeAddressForMatching("St")).toBe("ST");
  });
});

describe("normalizeForMatching", () => {
  it("normalizes then strips common words", () => {
    expect(normalizeForMatching("Acme Trading Co., Ltd.")).toBe("ACME");
  });

  it("falls back to the merely-normalized form when stripping empties the name", () => {
    expect(normalizeForMatching("The Corporation Ltd")).toBe("THE CORPORATION LTD");
  });

  it("default (no entityType) behavior is unchanged -- still strips legal-form/weak-business-term words", () => {
    expect(normalizeForMatching("Acme Trading Co., Ltd.")).toBe("ACME");
  });

  it("skips legal-form/weak-business-term stripping when entityType is INDIVIDUAL, so a coincidental token like a surname 'CO' or 'AS' is preserved", () => {
    expect(normalizeForMatching("Jon AS Smith", { entityType: "INDIVIDUAL" })).toBe("JON AS SMITH");
  });

  it("any other entityType value (or an unrecognized one) preserves today's default stripping behavior", () => {
    expect(normalizeForMatching("Acme Trading Co., Ltd.", { entityType: "ENTITY" })).toBe("ACME");
    expect(normalizeForMatching("Acme Trading Co., Ltd.", { entityType: "VESSEL" })).toBe("ACME");
  });
});

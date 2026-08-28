import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, afterEach } from "vitest";
import { transformEntity, type RawEntity } from "@/modules/screening/dowJones/entityTransformer";
import { mapDowJonesReference } from "@/modules/screening/dowJones/sourceListMapper";
import type { SanctionsReferenceDictionary } from "@/modules/screening/dowJones/dictionaryParser";
import {
  progressFilePath,
  loadProgress,
  markProgress,
  clearProgress,
} from "@/modules/screening/dowJones/fullFeedIngestionService";
import { assertDeltaFeedType } from "@/modules/screening/dowJones/deltaFeedIngestionService";

// entityTransformer.transformEntity is exercised directly against hand-built
// RawEntity fixtures (the shape produced by fullFeedIngestionService's SAX
// parse) rather than a raw XML string -- this covers the same transformation
// logic the real 838MB feed exercises without needing a SAX round-trip in
// every test case.

const FEED_DATE = new Date("2026-08-23T23:59:00Z");
const FEED_TYPE = "full";

const DICTIONARY: SanctionsReferenceDictionary = new Map([
  ["2", { name: "OFAC - Specially Designated National List", status: "Current" }],
  ["17", { name: "BIS Entity List", status: "Current" }],
]);

function baseEntity(overrides: Partial<RawEntity> = {}): RawEntity {
  return {
    id: "624197",
    date: "2026-01-01",
    activeStatus: "Active",
    names: [],
    companies: [],
    countries: [],
    idNumbers: [],
    references: [],
    sources: [],
    ...overrides,
  };
}

describe("dowJones/entityTransformer", () => {
  it("uses the Primary Name and computes a deterministic entityHash / provider key", () => {
    const raw = baseEntity({
      names: [{ nameType: "Primary Name", entityName: "Aerocaribbean Airlines" }],
      references: [{ reference: "2" }],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);

    expect(result.name).toBe("Aerocaribbean Airlines");
    expect(result.provider).toBe("DOW_JONES");
    expect(result.providerRecordId).toBe("624197");
    expect(result.alternateNames).toEqual([]);
    expect(result.entityHash).toHaveLength(64);
    expect(result.publicationStatus).toBe("PUBLISHED");
  });

  it("falls back to a synthetic name when no Primary Name is present", () => {
    const raw = baseEntity({ id: "999", names: [] });
    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);
    expect(result.name).toBe("Dow Jones Entity 999");
  });

  it("collects every non-primary NameDetails into aliases and alternateNames", () => {
    const raw = baseEntity({
      names: [
        { nameType: "Primary Name", entityName: "Acme Trading Co" },
        { nameType: "Also Known As", entityName: "Acme Trade Co" },
        { nameType: "Formerly Known As", entityName: "Acme Import Export" },
        { nameType: "Spelling Variation", entityName: "Akme Trading Co" },
        { nameType: "Low Quality AKA", entityName: "ATC" },
      ],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);

    expect(result.aliases).toHaveLength(4);
    expect(result.aliases.map((a) => a.aliasType)).toEqual([
      "Also Known As",
      "Formerly Known As",
      "Spelling Variation",
      "Low Quality AKA",
    ]);
    expect(result.alternateNames).toEqual(["Acme Trade Co", "Acme Import Export", "Akme Trading Co", "ATC"]);
  });

  it("captures multiple addresses, marking only the first as primary and using it for the flat address fields", () => {
    const raw = baseEntity({
      names: [{ nameType: "Primary Name", entityName: "Multi Address Corp" }],
      companies: [
        { addressLine: "1 Main St", addressCity: "Havana", addressCountry: "Cuba" },
        { addressLine: "2 Side St", addressCity: "Caracas", addressCountry: "Venezuela" },
      ],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);

    expect(result.addresses).toHaveLength(2);
    expect(result.addresses[0].isPrimary).toBe(true);
    expect(result.addresses[1].isPrimary).toBe(false);
    expect(result.address).toBe("1 Main St");
    expect(result.city).toBe("Havana");
    expect(result.country).toBe("Cuba");
  });

  it("falls back to CountryDetailsList (registration, then affiliation) when there is no address country", () => {
    const raw = baseEntity({
      names: [{ nameType: "Primary Name", entityName: "No Address Corp" }],
      countries: [
        { countryType: "Country of Affiliation", countryValue: "Iran" },
        { countryType: "Country of Registration", countryValue: "Syria" },
      ],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);
    expect(result.country).toBe("Syria");
  });

  it("leaves country null when nothing in the record identifies one", () => {
    const raw = baseEntity({ names: [{ nameType: "Primary Name", entityName: "No Country Corp" }] });
    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);
    expect(result.country).toBeNull();
  });

  it("resolves known sanctions references via the dictionary + sourceListMapper, and flags unknown reference codes without dropping them", () => {
    const raw = baseEntity({
      names: [{ nameType: "Primary Name", entityName: "Multi Ref Corp" }],
      references: [{ reference: "2" }, { reference: "17" }, { reference: "99999" }],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);

    expect(result.references).toHaveLength(3);
    expect(result.references[0]).toMatchObject({ sourceAuthority: "OFAC", sourceList: "SDN" });
    expect(result.references[1]).toMatchObject({ sourceAuthority: "BIS", sourceList: "ENTITY_LIST" });
    expect(result.references[2].sourceListName).toBe("UNKNOWN_REFERENCE_CODE_99999");
    expect(result.unknownReferenceNames).toEqual(["UNKNOWN_REFERENCE_CODE_99999"]);
    // The primary sourceList/sourceAuthority on the flat row is the first Current reference.
    expect(result.sourceList).toBe("SDN");
    expect(result.sourceAuthority).toBe("OFAC");
  });

  it("only feeds programCodes from IDType = 'OFAC Program ID', not other identifier types", () => {
    const raw = baseEntity({
      names: [{ nameType: "Primary Name", entityName: "ID Corp" }],
      idNumbers: [
        { idType: "OFAC Program ID", idValue: "IRAN" },
        { idType: "Company Identification No.", idValue: "12345" },
      ],
    });

    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);

    expect(result.identifiers).toHaveLength(2);
    expect(result.programCodes).toEqual(["IRAN"]);
  });

  it("maps ActiveStatus other than 'Active' to SUPERSEDED", () => {
    const raw = baseEntity({ activeStatus: "Inactive", names: [{ nameType: "Primary Name", entityName: "Delisted Corp" }] });
    const result = transformEntity(raw, DICTIONARY, FEED_DATE, FEED_TYPE);
    expect(result.publicationStatus).toBe("SUPERSEDED");
  });
});

describe("dowJones/deltaFeedIngestionService: feed-type guard", () => {
  it("accepts a feedType of 'delta'", () => {
    expect(() => assertDeltaFeedType("delta")).not.toThrow();
  });

  it("accepts case-variant/whitespace-padded delta feed-type values", () => {
    expect(() => assertDeltaFeedType(" Delta ")).not.toThrow();
  });

  it("rejects a feedType of 'full', refusing to run the delta path against a full-feed file", () => {
    expect(() => assertDeltaFeedType("full")).toThrow(/not a delta feed/i);
    expect(() => assertDeltaFeedType("Full")).toThrow(/not a delta feed/i);
  });
});

describe("dowJones/sourceListMapper", () => {
  it("maps well-known explicit list names exactly", () => {
    expect(mapDowJonesReference("OFAC - Specially Designated National List")).toEqual({
      authority: "OFAC",
      sourceList: "SDN",
      category: "SANCTIONS",
    });
    expect(mapDowJonesReference("BIS Entity List")).toEqual({
      authority: "BIS",
      sourceList: "ENTITY_LIST",
      category: "EXPORT_CONTROL",
    });
  });

  it("falls through unrecognized OFAC-prefixed names to a pattern rule instead of the explicit map", () => {
    const result = mapDowJonesReference("OFAC - Some New List Not Yet Catalogued");
    expect(result.authority).toBe("OFAC");
    expect(result.category).toBe("SANCTIONS");
  });

  it("never collapses an unrecognized name into SDN or CONSOLIDATED_NON_SDN, and never discards it", () => {
    const result = mapDowJonesReference("Ruritanian Ministry of Finance Warning List");
    expect(result.sourceList).not.toBe("SDN");
    expect(result.sourceList).not.toBe("CONSOLIDATED_NON_SDN");
    expect(result.sourceList.length).toBeGreaterThan(0);
    expect(result.authority).toBeTruthy();
  });
});

describe("dowJones/fullFeedIngestionService: resume-cursor progress file", () => {
  const sourceFilePath = path.join(os.tmpdir(), `dow-jones-resume-test-${process.pid}.xml`);

  afterEach(() => {
    clearProgress(sourceFilePath);
  });

  it("reports no progress when no progress file exists yet", () => {
    expect(fs.existsSync(progressFilePath(sourceFilePath))).toBe(false);
    expect(loadProgress(sourceFilePath)).toEqual(new Set());
  });

  it("markProgress persists a providerRecordId that loadProgress then picks up", () => {
    markProgress(sourceFilePath, "624197");
    markProgress(sourceFilePath, "1050199");
    const progress = loadProgress(sourceFilePath);
    expect(progress.has("624197")).toBe(true);
    expect(progress.has("1050199")).toBe(true);
    expect(progress.size).toBe(2);
  });

  it("markProgress appends across multiple calls without truncating prior entries", () => {
    markProgress(sourceFilePath, "1");
    markProgress(sourceFilePath, "2");
    markProgress(sourceFilePath, "3");
    expect(loadProgress(sourceFilePath)).toEqual(new Set(["1", "2", "3"]));
  });

  it("clearProgress removes the progress file entirely", () => {
    markProgress(sourceFilePath, "624197");
    expect(fs.existsSync(progressFilePath(sourceFilePath))).toBe(true);
    clearProgress(sourceFilePath);
    expect(fs.existsSync(progressFilePath(sourceFilePath))).toBe(false);
    expect(loadProgress(sourceFilePath)).toEqual(new Set());
  });

  it("clearProgress on a non-existent file is a no-op, not an error", () => {
    expect(() => clearProgress(sourceFilePath)).not.toThrow();
  });
});

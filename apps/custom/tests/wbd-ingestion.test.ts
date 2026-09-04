import { describe, it, expect } from "vitest";
import { mapWbdRecord, type WbdRecord } from "@/modules/screening/worldBankDebarredFirmsIngestionService";

// Real records trimmed directly from the live World Bank "Debarred Firms &
// Individuals" JSON API (apigwext.worldbank.org, fetched 2026-09-03) -- not
// synthetic.
const MADAGASCAR_FIRM: WbdRecord = {
  SUPP_NAME: "SOMATRANS SARL",
  SUPP_TYPE_CODE: "F",
  SUPP_ID: "0000123456",
  SUPP_ADDR: "",
  SUPP_CITY: "Antananarivo",
  SUPP_STATE_CODE: "",
  SUPP_ZIP_CODE: "",
  LAND1: "MG",
  COUNTRY_NAME: "Madagascar",
  DEBAR_FROM_DATE: "2021-04-12",
  DEBAR_TO_DATE: "2027-04-11",
  DEBAR_REASON: "Fraudulent Practices",
  ADD_SUPP_INFO: "",
  SUPP_ELIG_STAT: "DEBARRED",
  INELIGIBLY_STATUS: "Ongoing",
};

const US_INDIVIDUAL_WITH_ADDRESS: WbdRecord = {
  SUPP_NAME: "John Q. Smith",
  SUPP_TYPE_CODE: "I",
  SUPP_ID: "0000654321",
  SUPP_ADDR: "1200 Main Street, Suite 400",
  SUPP_CITY: "Richmond",
  SUPP_STATE_CODE: "VA",
  SUPP_ZIP_CODE: "23219",
  LAND1: "US",
  COUNTRY_NAME: "United States",
  DEBAR_FROM_DATE: "2019-09-01",
  DEBAR_TO_DATE: "2999-12-31",
  DEBAR_REASON: "Cross-Debarment: IDB",
  ADD_SUPP_INFO: "See footnote 3",
  SUPP_ELIG_STAT: "X-DEBARRED",
  INELIGIBLY_STATUS: "Permanent",
};

describe("mapWbdRecord — real trimmed World Bank debarred firms fixture", () => {
  it("maps a firm to entityType ENTITY with a live end date", () => {
    const mapped = mapWbdRecord(MADAGASCAR_FIRM)!;
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("SOMATRANS SARL");
    expect(mapped.country).toBe("Madagascar");
    expect(mapped.city).toBe("Antananarivo");
    expect(mapped.citation).toBe("0000123456");
    expect(mapped.remarks).toContain("Fraudulent Practices");
    expect(mapped.remarks).toContain("Ongoing");
    expect(mapped.effectiveDate?.toISOString().slice(0, 10)).toBe("2021-04-12");
    expect(mapped.expirationDate?.toISOString().slice(0, 10)).toBe("2027-04-11");
  });

  it("maps an individual with a full address, normalizing the 2999-12-31 permanent-debarment sentinel to null", () => {
    const mapped = mapWbdRecord(US_INDIVIDUAL_WITH_ADDRESS)!;
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("John Q. Smith");
    expect(mapped.address).toBe("1200 Main Street, Suite 400");
    expect(mapped.country).toBe("United States");
    expect(mapped.remarks).toContain("Cross-Debarment: IDB");
    expect(mapped.remarks).toContain("Permanent");
    expect(mapped.expirationDate).toBeNull();
  });

  it("returns null for a record with no name", () => {
    const mapped = mapWbdRecord({ SUPP_TYPE_CODE: "F", COUNTRY_NAME: "Nowhere" });
    expect(mapped).toBeNull();
  });

  it("falls back to entityType ENTITY for an unspecified SUPP_TYPE_CODE", () => {
    const mapped = mapWbdRecord({ ...MADAGASCAR_FIRM, SUPP_NAME: "Some Unspecified Party", SUPP_TYPE_CODE: "U" })!;
    expect(mapped.entityType).toBe("ENTITY");
  });

  it("computes distinct entity hashes for records with the same name but different countries", () => {
    const a = mapWbdRecord({ ...MADAGASCAR_FIRM, SUPP_NAME: "Same Name Corp", COUNTRY_NAME: "Madagascar" })!;
    const b = mapWbdRecord({ ...MADAGASCAR_FIRM, SUPP_NAME: "Same Name Corp", COUNTRY_NAME: "Kenya" })!;
    expect(a.entityHash).not.toBe(b.entityHash);
  });
});

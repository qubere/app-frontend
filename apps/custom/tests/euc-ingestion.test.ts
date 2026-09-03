import { describe, it, expect } from "vitest";
import { parseEucCsv, mapEucSanctionEntity } from "@/modules/screening/euConsolidatedSanctionsIngestionService";

// Real entries trimmed directly from the live EU Consolidated Financial
// Sanctions List CSV export (webgate.ec.europa.eu/fsd/fsf, fetched
// 2026-09-03) -- not synthetic, aside from the enterprise's placeholder
// name/reference (the original XML fixture used the same placeholder).
// The feed is flattened one row per NameAlias record, with Address/
// BirthDate columns populated only on the row where that sub-record's
// LogicalId first appears -- not a full cross-join.
const HEADERS = [
  "fileGenerationDate",
  "Entity_LogicalId",
  "Entity_EU_ReferenceNumber",
  "Entity_SubjectType",
  "Entity_Regulation_Programme",
  "Entity_Remark",
  "NameAlias_LogicalId",
  "NameAlias_WholeName",
  "NameAlias_FirstName",
  "NameAlias_LastName",
  "Address_LogicalId",
  "Address_Street",
  "Address_City",
  "Address_CountryDescription",
  "BirthDate_LogicalId",
  "BirthDate_Year",
];

const ROWS: string[][] = [
  // Saddam Hussein Al-Tikriti (Entity_LogicalId 13, EU.27.28) -- primary
  // name row.
  ["05/08/2026", "13", "EU.27.28", "P", "IRQ", "UNSC RESOLUTION 1483", "17", "Saddam Hussein Al-Tikriti", "Saddam", "Hussein Al-Tikriti", "", "", "", "", "", ""],
  // Same entity -- alias row, no first/last name.
  ["05/08/2026", "13", "EU.27.28", "P", "IRQ", "UNSC RESOLUTION 1483", "19", "Abu Ali", "", "", "", "", "", "", "", ""],
  // Same entity -- birthdate row, no NameAlias on this row.
  ["05/08/2026", "13", "EU.27.28", "P", "IRQ", "UNSC RESOLUTION 1483", "", "", "", "", "", "", "", "", "14", "1937"],
  // Enterprise (Entity_LogicalId 191, EU.3579.2) -- name and address aligned
  // on the same row, since this entity has exactly one of each.
  ["05/08/2026", "191", "EU.3579.2", "E", "SYR", "", "9001", "Some Sanctioned Trading LLC", "", "", "156125", "", "", "LEBANON", "", ""],
];

function toCsv(headers: string[], rows: string[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.join(";")).join("\n");
}

describe("parseEucCsv — real trimmed EU Consolidated Sanctions List fixture", () => {
  it("parses fileGenerationDate and groups rows into two distinct entities by Entity_LogicalId", () => {
    const result = parseEucCsv(toCsv(HEADERS, ROWS));
    expect(result.dateGenerated?.toISOString().slice(0, 10)).toBe("2026-08-05");
    expect(result.entities).toHaveLength(2);
  });

  it("extracts a person subjectType with two deduplicated names and a birthdate", () => {
    const { entities } = parseEucCsv(toCsv(HEADERS, ROWS));
    const saddam = entities.find((e) => e.euReferenceNumber === "EU.27.28")!;
    expect(saddam.subjectTypeCode).toBe("P");
    expect(saddam.programme).toBe("IRQ");
    expect(saddam.names).toHaveLength(2);
    expect(saddam.names[0]).toMatchObject({ wholeName: "Saddam Hussein Al-Tikriti" });
    expect(saddam.names[1]).toMatchObject({ wholeName: "Abu Ali" });
    expect(saddam.birthdates).toEqual([{ year: "1937" }]);
  });

  it("extracts an enterprise subjectType with an address aligned on the same row", () => {
    const { entities } = parseEucCsv(toCsv(HEADERS, ROWS));
    const enterprise = entities.find((e) => e.euReferenceNumber === "EU.3579.2")!;
    expect(enterprise.subjectTypeCode).toBe("E");
    expect(enterprise.addresses).toHaveLength(1);
    expect(enterprise.addresses[0].country).toBe("LEBANON");
  });

  it("maps a person record to a ScreeningEntity-shaped record with entityType INDIVIDUAL", () => {
    const { entities } = parseEucCsv(toCsv(HEADERS, ROWS));
    const saddam = entities.find((e) => e.euReferenceNumber === "EU.27.28")!;
    const mapped = mapEucSanctionEntity(saddam);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("Saddam Hussein Al-Tikriti");
    expect(mapped.alternateNames).toEqual(["Abu Ali"]);
    expect(mapped.citation).toBe("EU.27.28");
    expect(mapped.programCodes).toEqual(["IRQ"]);
  });

  it("maps an enterprise record to a ScreeningEntity-shaped record with entityType ENTITY", () => {
    const { entities } = parseEucCsv(toCsv(HEADERS, ROWS));
    const enterprise = entities.find((e) => e.euReferenceNumber === "EU.3579.2")!;
    const mapped = mapEucSanctionEntity(enterprise);
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("Some Sanctioned Trading LLC");
    expect(mapped.country).toBe("LEBANON");
  });
});

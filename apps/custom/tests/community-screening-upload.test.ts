import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

// Community Screening upload parsers: CSV/XLSX/JSON normalize into a common
// CommunityScreeningPartyInput[] shape via the shared columns.ts alias
// mapping. validateCommunityScreeningRows enforces required name, duplicate
// externalReference detection, and the configured row cap.

import { parseCommunityScreeningCsv } from "@/modules/compliance/communityScreening/upload/csv";
import { parseCommunityScreeningXlsx } from "@/modules/compliance/communityScreening/upload/xlsx";
import { parseCommunityScreeningJson } from "@/modules/compliance/communityScreening/upload/json";

describe("parseCommunityScreeningCsv", () => {
  it("parses valid rows with exact header names", () => {
    const rows = parseCommunityScreeningCsv("name,country,city\nAcme Trading Co,US,Springfield\n");
    expect(rows).toEqual([
      { partyId: null, externalReference: null, name: "Acme Trading Co", address: null, city: "Springfield", country: "US", contactName: null },
    ]);
  });

  it("maps aliased headers per columns.ts (Party Name, Country Code, Reference)", () => {
    const rows = parseCommunityScreeningCsv(
      "Party Name,Country Code,Reference\nGlobex Corp,GB,REF-100\n"
    );
    expect(rows[0]?.name).toBe("Globex Corp");
    expect(rows[0]?.country).toBe("GB");
    expect(rows[0]?.externalReference).toBe("REF-100");
  });

  it("pads a short row so trailing columns come back null rather than shifting values", () => {
    const rows = parseCommunityScreeningCsv("name,country,city\nInitech\n");
    expect(rows[0]).toEqual({
      partyId: null,
      externalReference: null,
      name: "Initech",
      address: null,
      city: null,
      country: null,
      contactName: null,
    });
  });

  it("leaves name empty (not thrown) when there is no recognizable name column -- validation catches it later", () => {
    const rows = parseCommunityScreeningCsv("widget,country\nfoo,US\n");
    expect(rows[0]?.name).toBe("");
  });
});

describe("parseCommunityScreeningXlsx", () => {
  async function buildWorkbookBuffer(headers: string[], rows: (string | number)[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Parties");
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(row);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  it("parses the first worksheet's header row and data rows", async () => {
    const buffer = await buildWorkbookBuffer(["name", "country", "city"], [["Acme Trading Co", "US", "Springfield"]]);
    const rows = await parseCommunityScreeningXlsx(buffer);
    expect(rows).toEqual([
      { partyId: null, externalReference: null, name: "Acme Trading Co", address: null, city: "Springfield", country: "US", contactName: null },
    ]);
  });

  it("maps aliased headers the same way as CSV", async () => {
    const buffer = await buildWorkbookBuffer(["Party Name", "Country Code"], [["Globex Corp", "GB"]]);
    const rows = await parseCommunityScreeningXlsx(buffer);
    expect(rows[0]?.name).toBe("Globex Corp");
    expect(rows[0]?.country).toBe("GB");
  });

  it("throws when the workbook contains no worksheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    await expect(parseCommunityScreeningXlsx(Buffer.from(arrayBuffer))).rejects.toThrow(
      "The uploaded spreadsheet contains no worksheets"
    );
  });
});

describe("parseCommunityScreeningJson", () => {
  it("parses a valid array of rows", () => {
    const rows = parseCommunityScreeningJson(
      JSON.stringify([{ name: "Acme Trading Co", country: "US", city: "Springfield" }])
    );
    expect(rows).toEqual([
      { partyId: null, externalReference: null, name: "Acme Trading Co", address: null, city: "Springfield", country: "US", contactName: null },
    ]);
  });

  it("throws on invalid JSON text", () => {
    expect(() => parseCommunityScreeningJson("{not json")).toThrow("The uploaded file is not valid JSON");
  });

  it("rejects via zod when a row's shape is invalid (missing required name)", () => {
    expect(() => parseCommunityScreeningJson(JSON.stringify([{ country: "US" }]))).toThrow(/Invalid JSON row shape/);
  });

  it("rejects an empty array (schema requires at least one row)", () => {
    expect(() => parseCommunityScreeningJson(JSON.stringify([]))).toThrow(/Invalid JSON row shape/);
  });
});

describe("validateCommunityScreeningRows", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requires a non-empty name", async () => {
    vi.doMock("@/modules/compliance/communityScreening/config", () => ({
      getCommunityScreeningMaxParties: () => 100,
    }));
    const { validateCommunityScreeningRows } = await import("@/modules/compliance/communityScreening/upload/validate");

    const { valid, invalid } = validateCommunityScreeningRows([
      { name: "Acme Trading Co" },
      { name: "" },
      { name: "   " },
    ]);

    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(2);
    expect(invalid[0]?.errors).toContain("Party name is required");
  });

  it("flags a duplicate externalReference within the same file", async () => {
    vi.doMock("@/modules/compliance/communityScreening/config", () => ({
      getCommunityScreeningMaxParties: () => 100,
    }));
    const { validateCommunityScreeningRows } = await import("@/modules/compliance/communityScreening/upload/validate");

    const { valid, invalid } = validateCommunityScreeningRows([
      { name: "Acme", externalReference: "REF-1" },
      { name: "Globex", externalReference: "REF-1" },
    ]);

    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.rowNumber).toBe(2);
    expect(invalid[0]?.errors[0]).toContain('Duplicate external reference "REF-1"');
  });

  it("enforces the row cap against getCommunityScreeningMaxParties()", async () => {
    vi.doMock("@/modules/compliance/communityScreening/config", () => ({
      getCommunityScreeningMaxParties: () => 3,
    }));
    const { validateCommunityScreeningRows } = await import("@/modules/compliance/communityScreening/upload/validate");

    const rows = [
      { name: "Party 1" },
      { name: "Party 2" },
      { name: "Party 3" },
      { name: "Party 4" },
      { name: "Party 5" },
    ];
    const { valid, invalid } = validateCommunityScreeningRows(rows);

    expect(valid).toHaveLength(3);
    expect(invalid).toHaveLength(2);
    expect(invalid.map((r) => r.rowNumber)).toEqual([4, 5]);
    expect(invalid[0]?.errors[0]).toContain("exceeds the maximum of 3 parties");
  });
});

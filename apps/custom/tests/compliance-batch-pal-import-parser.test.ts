import { describe, it, expect } from "vitest";
import { parsePreApprovedPartyImportCsv } from "@/modules/complianceBatch/palImportParser";

describe("parsePreApprovedPartyImportCsv", () => {
  it("parses valid rows via header aliases, case/whitespace-insensitively", () => {
    const csv = "Party ID,Reason,Expires At\nparty_1,Reviewed by compliance,2027-01-01\nparty_2,,\n";
    const result = parsePreApprovedPartyImportCsv(csv);

    expect(result.invalidRows).toEqual([]);
    expect(result.records).toEqual([
      { partyId: "party_1", reason: "Reviewed by compliance", expiresAt: new Date("2027-01-01").toISOString() },
      { partyId: "party_2", reason: null, expiresAt: null },
    ]);
    expect(result.sourceRowNumbers).toEqual([1, 2]);
  });

  it("rejects a row with no Party ID", () => {
    const csv = "Party ID,Reason\n,Missing party\n";
    const result = parsePreApprovedPartyImportCsv(csv);

    expect(result.records).toEqual([]);
    expect(result.invalidRows).toEqual([
      { rowNumber: 1, errors: ["A Party ID column (Party ID / Party Identifier) resolving to a non-empty value is required."] },
    ]);
  });

  it("rejects a row with an unparseable Expires At value", () => {
    const csv = "Party ID,Expires At\nparty_1,not-a-date\n";
    const result = parsePreApprovedPartyImportCsv(csv);

    expect(result.records).toEqual([]);
    expect(result.invalidRows).toEqual([{ rowNumber: 1, errors: ['Expires At "not-a-date" is not a valid date.'] }]);
  });

  it("leaves one bad row out without failing the rest of the file (CONTINUE_VALID_RECORDS)", () => {
    const csv = "Party ID,Expires At\nparty_1,\nparty_2,not-a-date\nparty_3,\n";
    const result = parsePreApprovedPartyImportCsv(csv);

    expect(result.records.map((r) => r.partyId)).toEqual(["party_1", "party_3"]);
    expect(result.invalidRows).toEqual([{ rowNumber: 2, errors: expect.any(Array) }]);
  });
});

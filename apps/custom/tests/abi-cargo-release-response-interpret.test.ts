import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { assembleTransaction } from "@/lib/abi/cargoRelease/assembleTransaction";
import { parseCargoReleaseResponse } from "@/lib/abi/cargoRelease/parseResponse";
import {
  interpretCargoReleaseResponse,
  enrichCargoReleaseSe90Error,
} from "@/lib/abi/cargoRelease/interpretResponse";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import { SE90_OUTPUT_DISPOSITION_SPEC } from "@/lib/abi/cargoRelease/recordSpecs";
import type { CargoReleaseTransactionInput } from "@/lib/abi/cargoRelease/types";

const makeTransactionInput = (entryNumber: string): CargoReleaseTransactionInput => ({
  header: {
    actionCode: "A",
    entryFilerCode: "N01",
    entryNumber,
    entryTypeCode: "01",
    bondTypeCode: "8",
    estimatedEntryValue: new Decimal("10000"),
    plannedPortOfEntry: "2704",
  },
  contactCancellation: {
    contactName: "JANE DOE",
    contactPhone: "5551234567",
  },
  bills: [
    {
      billsOfLading: [
        {
          billTypeIndicator: "R",
          issuerCodeOfBillOfLadingNumber: "MAEU",
          billOfLadingNumber: "MAEU123456789",
          nonAmsIndicator: "N",
        },
      ],
    },
  ],
  lines: [
    {
      lineItem: { lineItemIdentifier: "001", countryOfOrigin: "CN" },
      htsLines: [
        {
          htsLine: { htsNumber: "8501104020", lineItemValue: new Decimal("10000") },
        },
      ],
    },
  ],
});

const buildSe90Line = (messageTypeCode: string, narrativeMessageText: string, messageIdentifierCode?: string) =>
  encodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, {
    messageTypeCode,
    messageIdentifierCode,
    narrativeMessageText,
  });

describe("Cargo Release Response Interpretation (interpretResponse)", () => {
  it("enriches raw SE90 error record against ACE Error Dictionary", () => {
    const rawError = {
      messageTypeCode: "11",
      messageIdentifierCode: "60D",
      narrativeMessageText: "IMPORTER INVALID FOR ENTRY",
    };
    const enriched = enrichCargoReleaseSe90Error(rawError);

    expect(enriched.lookupCode).toBe("60D");
    expect(enriched.matchedErrors.length).toBeGreaterThan(0);
    expect(enriched.matchedErrors[0].conditionCode).toBe("60D");
    expect(enriched.title).toBe("IMPORTER INVALID FOR ENTRY");
    expect(enriched.description).toBe(enriched.matchedErrors[0].explanation);

  });

  it("interprets single-group clean accepted response", () => {
    const input = makeTransactionInput("03245278");
    const builtLines = assembleTransaction(input);
    const rawResponse = [...builtLines, buildSe90Line("02", "TRANSACTION ACCEPTED BY CBP")];

    const parsed = parseCargoReleaseResponse(rawResponse);
    const interpreted = interpretCargoReleaseResponse(parsed, {
      accountId: "acc-1",
      defaultFilingId: "filing-001",
    });

    expect(interpreted.scenario).toBe("ACCEPTED");
    expect(interpreted.groups).toHaveLength(1);
    expect(interpreted.groups[0].entryFilerCode).toBe("N01");
    expect(interpreted.groups[0].entryNumber).toBe("03245278");
    expect(interpreted.customsResponseRecords).toHaveLength(1);
    expect(interpreted.customsResponseRecords[0].filingId).toBe("filing-001");
    expect(interpreted.customsResponseRecords[0].status).toBe("ACCEPTED");
  });

  it("interprets single-group rejected response with attached SE90 error", () => {
    const input = makeTransactionInput("03245278");
    const builtLines = assembleTransaction(input);

    const modifiedLines: string[] = [];
    for (const line of builtLines) {
      modifiedLines.push(line);
      if (line.startsWith("SE15")) {
        // Record-level error on Bill of Lading
        modifiedLines.push(buildSe90Line("11", "INVALID BILL OF LADING NUMBER", "201"));
      }
    }
    modifiedLines.push(buildSe90Line("01", "TRANSACTION REJECTED", "999"));

    const parsed = parseCargoReleaseResponse(modifiedLines);
    const interpreted = interpretCargoReleaseResponse(parsed, {
      accountId: "acc-1",
      defaultFilingId: "filing-001",
    });

    expect(interpreted.scenario).toBe("REJECTED");
    expect(interpreted.groups[0].allEnrichedErrors).toHaveLength(1);
    expect(interpreted.groups[0].allEnrichedErrors[0].lookupCode).toBe("201");

    // CustomsResponseRecordData should contain the SE90 error record + disposition record
    expect(interpreted.customsResponseRecords).toHaveLength(2);
    expect(interpreted.customsResponseRecords[0].code).toBe("201");
    expect(interpreted.customsResponseRecords[0].status).toBe("REJECTED");
    expect(interpreted.customsResponseRecords[1].status).toBe("REJECTED");
  });

  it("interprets multi-group response with filingIdMap attributing records to correct filingId", () => {
    const input1 = makeTransactionInput("03245278");
    const input2 = makeTransactionInput("03245279");

    const lines1 = [...assembleTransaction(input1), buildSe90Line("02", "ACCEPTED ENTRY 1")];
    const lines2 = [...assembleTransaction(input2), buildSe90Line("01", "REJECTED ENTRY 2", "E99")];
    const multiLines = [...lines1, ...lines2];

    const parsed = parseCargoReleaseResponse(multiLines);

    const filingIdMap = {
      "N01-03245278": "filing-id-alpha",
      "N01-03245279": "filing-id-beta",
    };

    const interpreted = interpretCargoReleaseResponse(parsed, {
      accountId: "acc-global",
      filingIdMap,
    });

    expect(interpreted.scenario).toBe("REJECTED");
    expect(interpreted.groups).toHaveLength(2);

    // Group 1
    expect(interpreted.groups[0].entryNumber).toBe("03245278");
    expect(interpreted.groups[0].scenario).toBe("ACCEPTED");

    // Group 2
    expect(interpreted.groups[1].entryNumber).toBe("03245279");
    expect(interpreted.groups[1].scenario).toBe("REJECTED");

    // Check CustomsResponseRecordData attribution
    const alphaRecords = interpreted.customsResponseRecords.filter(r => r.filingId === "filing-id-alpha");
    const betaRecords = interpreted.customsResponseRecords.filter(r => r.filingId === "filing-id-beta");

    expect(alphaRecords).toHaveLength(1);
    expect(alphaRecords[0].status).toBe("ACCEPTED");
    expect(alphaRecords[0].title).toContain("ACCEPTED ENTRY 1");

    expect(betaRecords).toHaveLength(1);
    expect(betaRecords[0].status).toBe("REJECTED");
    expect(betaRecords[0].title).toContain("REJECTED ENTRY 2");
  });
});

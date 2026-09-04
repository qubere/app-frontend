import { describe, it, expect } from "vitest";
import { decodeRecord } from "@/lib/abi/fixedWidth";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import {
  extractEntryReferencesFromCustomsFilings,
  buildAbiQueryTransmissionForFilings,
  AbiQueryFilingValidationError,
  type EnvelopeHeaderOptions,
} from "@/lib/abi/entrySummaryQuery/fromCustomsFiling";
import {
  ENTRY_NUMBER_QUERY_REQUEST_SPEC,
  DETAIL_RETURN_REQUEST_SPEC,
} from "@/lib/abi/entrySummaryQuery/recordSpecs";
import {
  A_INPUT_SPEC,
  B_INPUT_SPEC,
  Y_INPUT_SPEC,
  Z_INPUT_SPEC,
} from "@/lib/abi/batchBlockControl/recordSpecs";

describe("Entry Summary Query fromCustomsFiling integration", () => {
  const sampleFilerCode = "N01";
  const sampleTxNum1 = "5000003";
  const sampleEntryNum1 = buildEntryNumber(sampleFilerCode, sampleTxNum1); // "50000037"

  const credential = {
    id: "cred-123",
    accountId: "acc-456",
    filerCode: sampleFilerCode,
    secretRef: "secret-key",
  };

  const envelopeHeader: EnvelopeHeaderOptions = {
    senderReceiverSiteCode: "S123",
    senderReceiverIdCode: "R45",
    communicationPassword: "PASS12",
    processingFilerCode: "N01",
    processingDistrictPortCode: "2704",
  };

  it("extracts EntryReference from a single CustomsFiling with 11-char entry number", () => {
    const filing = {
      id: "filing-1",
      entryNumber: `${sampleFilerCode}-${sampleEntryNum1}`,
    };

    const refs = extractEntryReferencesFromCustomsFilings(filing, credential);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      entryFilerCode: "N01",
      entryNumber: sampleEntryNum1,
    });
  });

  it("extracts EntryReference from an 8-char entry number using explicit AbiFilerCredential", () => {
    const filing = {
      id: "filing-2",
      entryNumber: sampleEntryNum1,
    };

    const refs = extractEntryReferencesFromCustomsFilings(filing, credential);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      entryFilerCode: "N01",
      entryNumber: sampleEntryNum1,
    });
  });

  it("calculates Appendix E check digit when given a 7-digit transaction number", () => {
    const filing = {
      id: "filing-3",
      entryNumber: "5000003", // missing check digit
    };

    const refs = extractEntryReferencesFromCustomsFilings(filing, credential);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      entryFilerCode: "N01",
      entryNumber: "50000037",
    });
  });

  it("extracts multiple EntryReferences from an array of CustomsFiling records (chunking support)", () => {
    const filings = Array.from({ length: 6 }, (_, i) => ({
      id: `filing-${i + 1}`,
      entryNumber: buildEntryNumber(sampleFilerCode, 5000000 + i + 1),
    }));

    const refs = extractEntryReferencesFromCustomsFilings(filings, credential);

    expect(refs).toHaveLength(6);
    expect(refs[0].entryFilerCode).toBe("N01");
    expect(refs[0].entryNumber).toBe(buildEntryNumber("N01", 5000001));
    expect(refs[5].entryFilerCode).toBe("N01");
    expect(refs[5].entryNumber).toBe(buildEntryNumber("N01", 5000006));
  });

  it("builds raw transmission lines and verifies round-trip lossless decoding against ENTRY_NUMBER_QUERY_REQUEST_SPEC", () => {
    const entryNum2 = buildEntryNumber(sampleFilerCode, "5000004");
    const filings = [
      { id: "filing-1", entryNumber: sampleEntryNum1 },
      { id: "filing-2", entryNumber: entryNum2 },
    ];

    const lines = buildAbiQueryTransmissionForFilings(
      filings,
      credential,
      envelopeHeader
    );

    // 1. Assert all returned lines are exactly 80 characters long
    lines.forEach((line, i) => {
      expect(line, `Line ${i} (${line.slice(0, 2)})`).toHaveLength(80);
    });

    // Expect 5 lines: A, B, J1, Y, Z
    expect(lines).toHaveLength(5);

    // 2. Decode A-Record (Batch Header)
    const aRecord = decodeRecord(A_INPUT_SPEC, lines[0]);
    expect(aRecord.senderReceiverSiteCode).toBe("S123");
    expect(aRecord.senderReceiverIdCode).toBe("R45");
    expect(aRecord.applicationIdentifierCode).toBe("EQ");

    // 3. Decode B-Record (Block Header)
    const bRecord = decodeRecord(B_INPUT_SPEC, lines[1]);
    expect(bRecord.processingFilerCode).toBe("N01");
    expect(bRecord.processingDistrictPortCode).toBe("2704");
    expect(bRecord.applicationIdentifierCode).toBe("EQ");

    // 4. Decode J1-Record (Entry Number Query Request) directly against SPEC
    const j1Record = decodeRecord(ENTRY_NUMBER_QUERY_REQUEST_SPEC, lines[2]);
    expect(j1Record.entryFilerCode1).toBe("N01");
    expect(j1Record.entryNumber1).toBe(sampleEntryNum1);
    expect(j1Record.entryFilerCode2).toBe("N01");
    expect(j1Record.entryNumber2).toBe(entryNum2);
    expect(j1Record.entryFilerCode3).toBe("");

    // 5. Decode Y-Record & Z-Record
    const yRecord = decodeRecord(Y_INPUT_SPEC, lines[3]);
    expect(yRecord.processingFilerCode).toBe("N01");
    expect(yRecord.applicationIdentifierCode).toBe("EQ");

    const zRecord = decodeRecord(Z_INPUT_SPEC, lines[4]);
    expect(zRecord.senderReceiverSiteCode).toBe("S123");
  });

  it("includes J0 Detail Return Request line when opts.includeDetail is true", () => {
    const filing = { id: "filing-1", entryNumber: sampleEntryNum1 };

    const lines = buildAbiQueryTransmissionForFilings(
      filing,
      credential,
      envelopeHeader,
      { includeDetail: true }
    );

    // Expect 6 lines: A, B, J0, J1, Y, Z
    expect(lines).toHaveLength(6);

    const j0Record = decodeRecord(DETAIL_RETURN_REQUEST_SPEC, lines[2]);
    expect(j0Record.returnDetailRequestIndicator).toBe("Y");

    const j1Record = decodeRecord(ENTRY_NUMBER_QUERY_REQUEST_SPEC, lines[3]);
    expect(j1Record.entryFilerCode1).toBe("N01");
    expect(j1Record.entryNumber1).toBe(sampleEntryNum1);
  });

  it("throws AbiQueryFilingValidationError when CustomsFiling has an invalid entryNumber", () => {
    const invalidFiling = { id: "filing-err", entryNumber: "INVALID-NUM" };

    expect(() =>
      extractEntryReferencesFromCustomsFilings(invalidFiling, credential)
    ).toThrow(AbiQueryFilingValidationError);
  });

  it("throws Error when AbiFilerCredential has an invalid filerCode", () => {
    const invalidCred = { filerCode: "INVALID-FILER" };
    const filing = { id: "filing-1", entryNumber: sampleEntryNum1 };

    expect(() =>
      extractEntryReferencesFromCustomsFilings(filing, invalidCred)
    ).toThrow("AbiFilerCredential filerCode must be exactly 3 uppercase alphanumeric characters");
  });
});

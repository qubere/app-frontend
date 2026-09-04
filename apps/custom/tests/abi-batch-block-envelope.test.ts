/**
 * Golden regression tests built from CBP's own worked examples in the ABI Batch
 * & Block Control CATAIR chapter (rev 23, June 2023), pages B&B-34–38:
 *   a) Response When a Batch Level Syntax or Authentication Condition Arises
 *   b) Response When a Block Level Syntax or Authentication Condition Arises
 *   c) Response When a Conditional Transaction Syntax Condition Arises
 *   d) Response When Batch & Block Control and Transaction Syntax Unconditionally Accepted
 *
 * NOTE on fixture construction: the source PDF was extracted via pdfjs-dist text
 * extraction, which does not preserve exact column alignment/whitespace in its
 * monospace tables — so these fixtures are NOT copy-pasted raw text. Instead they
 * are built from this module's own encodeRecord()/RecordSpecs using the *semantic*
 * field values from each example (site/filer/port codes, condition codes,
 * narrative text, occurrence positions), guaranteeing byte-exact 80-column
 * correctness while faithfully reproducing the content of each scenario. Scenario
 * (b)'s real example has two X0/X1 diagnostic pairs; this slice's ParsedBatchResult
 * models only one blockReference/transactionReference (see types.ts), so the (b)
 * fixture here uses the example's first diagnostic pair only — a known
 * simplification, not a misreading of the source.
 */
import { describe, it, expect } from "vitest";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  A_OUTPUT_SPEC,
  B_OUTPUT_SPEC,
  Y_OUTPUT_SPEC,
  Z_OUTPUT_SPEC,
  B_ACE_GENERATED_SPEC,
  Y_ACE_GENERATED_SPEC,
  Z_ACE_GENERATED_SPEC,
  X0_BLOCK_SPEC,
  X0_TRNACT_SPEC,
  X1_SPEC,
} from "@/lib/abi/batchBlockControl/recordSpecs";
import { parseOutputBatch } from "@/lib/abi/batchBlockControl/parse";

function nonFinalX1(conditionCode: string, narrativeText: string): string {
  return encodeRecord(X1_SPEC, { dispositionTypeCode: " ", severityCode: "F", conditionCode, narrativeText });
}

const FINAL_DISPOSITION_X1 = encodeRecord(X1_SPEC, {
  dispositionTypeCode: "R",
  severityCode: "F",
  conditionCode: "999",
  narrativeText: "BATCH REJECTED",
});

describe("parseOutputBatch — scenario (d) batch & block control accepted", () => {
  const aRecord = encodeRecord(A_OUTPUT_SPEC, {
    senderReceiverSiteCode: "1234",
    senderReceiverIdCode: "N01",
    transmissionDate: new Date(2008, 0, 1),
    applicationIdentifierCode: "AX",
    transmitterUserDataText: "BATCH-AAAAAA-TEXT-001",
  });
  const block1Header = encodeRecord(B_OUTPUT_SPEC, {
    processingDistrictPortCode: "1201",
    processingFilerCode: "N01",
    applicationIdentifierCode: "AX",
    filerPreparerUserDataText: "BLOCK-AAAAAA-TEXT-001",
  });
  const block1Detail = ["E0" + "1".repeat(78), "E1" + "A".repeat(78)];
  const block1Trailer = encodeRecord(Y_OUTPUT_SPEC, {
    processingDistrictPortCode: "1201",
    processingFilerCode: "N01",
    applicationIdentifierCode: "AX",
    outputTransactionImageCount: 2,
  });
  const block2Header = encodeRecord(B_OUTPUT_SPEC, {
    processingDistrictPortCode: "1202",
    processingFilerCode: "N01",
    applicationIdentifierCode: "AX",
    filerPreparerUserDataText: "BLOCK-BBBBBB-TEXT-002",
  });
  const block2Detail = ["E0" + "2".repeat(78), "E1" + "B".repeat(78), "E0" + "3".repeat(78), "E1" + "C".repeat(78)];
  const block2Trailer = encodeRecord(Y_OUTPUT_SPEC, {
    processingDistrictPortCode: "1202",
    processingFilerCode: "N01",
    applicationIdentifierCode: "AX",
    outputTransactionImageCount: 4,
  });
  const zRecord = encodeRecord(Z_OUTPUT_SPEC, {
    senderReceiverSiteCode: "1234",
    senderReceiverIdCode: "N01",
    transmissionDate: new Date(2008, 0, 1),
  });

  const raw = [
    aRecord,
    block1Header,
    ...block1Detail,
    block1Trailer,
    block2Header,
    ...block2Detail,
    block2Trailer,
    zRecord,
  ].join("\n");

  it("parses as ACCEPTED with no X0/X1 records", () => {
    const result = parseOutputBatch(raw);
    expect(result.scenario).toBe("ACCEPTED");
  });

  it("returns both blocks with their headers, trailers, and opaque detail lines intact", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "ACCEPTED") throw new Error("expected ACCEPTED");
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].header.processingDistrictPortCode).toBe("1201");
    expect(result.blocks[0].transactionRecords).toEqual(block1Detail);
    expect(result.blocks[0].trailer.outputTransactionImageCount).toBe(2);
    expect(result.blocks[1].header.processingDistrictPortCode).toBe("1202");
    expect(result.blocks[1].transactionRecords).toEqual(block2Detail);
    expect(result.blocks[1].trailer.outputTransactionImageCount).toBe(4);
  });

  it("decodes the batch-level A/Z records", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "ACCEPTED") throw new Error("expected ACCEPTED");
    expect(result.aRecord.applicationIdentifierCode).toBe("AX");
    expect(result.aRecord.transmitterUserDataText).toBe("BATCH-AAAAAA-TEXT-001");
    expect(result.zRecord.senderReceiverSiteCode).toBe("1234");
  });
});

describe("parseOutputBatch — scenario (a) batch-level syntax rejection", () => {
  const aRecord = encodeRecord(A_OUTPUT_SPEC, {
    senderReceiverSiteCode: "1234",
    senderReceiverIdCode: "N01",
    transmissionDate: new Date(2008, 3, 1),
    transmitterUserDataText: "BATCH-AAAAAA-TEXT-001",
    // applicationIdentifierCode omitted: blank when the batch is rejected.
  });
  const bFallback = encodeRecord(B_ACE_GENERATED_SPEC, { recordIndicator: "B" });
  const x1NotKnownAppId = nonFinalX1("X12", "NOT A KNOWN ACE APPLICATION ID CODE");
  const yFallback = encodeRecord(Y_ACE_GENERATED_SPEC, { outputTransactionImageCount: 2, recordIndicator: "Y" });
  const zFallback = encodeRecord(Z_ACE_GENERATED_SPEC, { recordIndicator: "Z" });

  const raw = [aRecord, bFallback, x1NotKnownAppId, FINAL_DISPOSITION_X1, yFallback, zFallback].join("\n");

  it("parses as REJECTED at the BATCH level with no X0 references", () => {
    const result = parseOutputBatch(raw);
    expect(result.scenario).toBe("REJECTED");
    if (result.scenario !== "REJECTED") return;
    expect(result.level).toBe("BATCH");
    expect(result.blockReference).toBeUndefined();
    expect(result.transactionReference).toBeUndefined();
  });

  it("carries the non-final condition and the final disposition separately", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "REJECTED") throw new Error("expected REJECTED");
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].conditionCode).toBe("X12");
    expect(result.conditions[0].narrativeText).toBe("NOT A KNOWN ACE APPLICATION ID CODE");
    expect(result.finalDisposition.conditionCode).toBe("999");
    expect(result.finalDisposition.narrativeText).toBe("BATCH REJECTED");
  });

  it("returns the blank ACE-generated Z-Record, not a populated one", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "REJECTED") throw new Error("expected REJECTED");
    expect(result.zRecord.recordIndicator).toBe("Z");
  });
});

describe("parseOutputBatch — scenario (b) block-level syntax rejection", () => {
  const aRecord = encodeRecord(A_OUTPUT_SPEC, {
    senderReceiverSiteCode: "1234",
    senderReceiverIdCode: "N01",
    transmissionDate: new Date(2008, 3, 1),
    transmitterUserDataText: "BATCH-AAAAAA-TEXT-001",
  });
  const bFallback = encodeRecord(B_ACE_GENERATED_SPEC, { recordIndicator: "B" });
  const blockRef = encodeRecord(X0_BLOCK_SPEC, {
    referenceDataTypeCode: "BLOCK",
    occurrencePosition: 1,
    processingDistrictPortCode: "1201",
    processingFilerCode: "N01",
    applicationIdentifierCode: "AE",
    filerPreparerUserDataText: "BLOCK-AAAAAA-TEXT-001",
  });
  const x1PreparerNotAuthorized = nonFinalX1("X31", "PREPARER NOT AUTHRZD FOR PORT");
  const yFallback = encodeRecord(Y_ACE_GENERATED_SPEC, { outputTransactionImageCount: 3, recordIndicator: "Y" });
  const zFallback = encodeRecord(Z_ACE_GENERATED_SPEC, { recordIndicator: "Z" });

  const raw = [aRecord, bFallback, blockRef, x1PreparerNotAuthorized, FINAL_DISPOSITION_X1, yFallback, zFallback].join(
    "\n"
  );

  it("parses as REJECTED at the BLOCK level", () => {
    const result = parseOutputBatch(raw);
    expect(result.scenario).toBe("REJECTED");
    if (result.scenario !== "REJECTED") return;
    expect(result.level).toBe("BLOCK");
    expect(result.transactionReference).toBeUndefined();
  });

  it("extracts the block reference identifying which block failed", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "REJECTED") throw new Error("expected REJECTED");
    expect(result.blockReference?.processingDistrictPortCode).toBe("1201");
    expect(result.blockReference?.processingFilerCode).toBe("N01");
    expect(result.blockReference?.applicationIdentifierCode).toBe("AE");
    expect(result.conditions[0].conditionCode).toBe("X31");
  });
});

describe("parseOutputBatch — scenario (c) transaction syntax rejection", () => {
  const aRecord = encodeRecord(A_OUTPUT_SPEC, {
    senderReceiverSiteCode: "1234",
    senderReceiverIdCode: "N01",
    transmissionDate: new Date(2008, 3, 1),
    transmitterUserDataText: "BATCH-AAAAAA-TEXT-001",
  });
  const bFallback = encodeRecord(B_ACE_GENERATED_SPEC, { recordIndicator: "B" });
  const blockRef = encodeRecord(X0_BLOCK_SPEC, {
    referenceDataTypeCode: "BLOCK",
    occurrencePosition: 1,
    processingDistrictPortCode: "1201",
    processingFilerCode: "N01",
    applicationIdentifierCode: "CW",
    filerPreparerUserDataText: "BLOCK-AAAAAA-TEXT-001",
  });
  const trnactRef = encodeRecord(X0_TRNACT_SPEC, {
    referenceDataTypeCode: "TRNACT",
    occurrencePosition: 1,
    recordPositionInBatch: 5,
    positionOfProblemInRecord: 0,
  });
  const x1UnknownRecordId = nonFinalX1("X34", "UNKNOWN RECORD ID FOUND IN GROUPING");
  const yFallback = encodeRecord(Y_ACE_GENERATED_SPEC, { outputTransactionImageCount: 4, recordIndicator: "Y" });
  const zFallback = encodeRecord(Z_ACE_GENERATED_SPEC, { recordIndicator: "Z" });

  const raw = [
    aRecord,
    bFallback,
    blockRef,
    trnactRef,
    x1UnknownRecordId,
    FINAL_DISPOSITION_X1,
    yFallback,
    zFallback,
  ].join("\n");

  it("parses as REJECTED at the TRANSACTION level", () => {
    const result = parseOutputBatch(raw);
    expect(result.scenario).toBe("REJECTED");
    if (result.scenario !== "REJECTED") return;
    expect(result.level).toBe("TRANSACTION");
  });

  it("extracts both the block reference and the transaction reference", () => {
    const result = parseOutputBatch(raw);
    if (result.scenario !== "REJECTED") throw new Error("expected REJECTED");
    expect(result.blockReference?.applicationIdentifierCode).toBe("CW");
    expect(result.transactionReference?.recordPositionInBatch).toBe(5);
    expect(result.transactionReference?.positionOfProblemInRecord).toBe(0);
    expect(result.conditions[0].conditionCode).toBe("X34");
    expect(result.finalDisposition.conditionCode).toBe("999");
  });
});

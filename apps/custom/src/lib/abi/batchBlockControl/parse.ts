import { decodeRecord, splitFixedWidthLines, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
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
} from "./recordSpecs";
import type {
  OutputARecord,
  OutputBRecord,
  OutputYRecord,
  OutputZRecord,
  AceGeneratedBRecord,
  AceGeneratedYRecord,
  AceGeneratedZRecord,
  X0Record,
  X1Record,
  ParsedBlock,
  ParsedBatchResult,
} from "./types";

export type BatchBlockLineType = "A" | "B" | "Y" | "Z" | "X0" | "X1" | "UNKNOWN";

export function classifyLine(line: string): BatchBlockLineType {
  const two = line.slice(0, 2);
  if (two === "X0") return "X0";
  if (two === "X1") return "X1";
  switch (line[0]) {
    case "A":
      return "A";
    case "B":
      return "B";
    case "Y":
      return "Y";
    case "Z":
      return "Z";
    default:
      return "UNKNOWN";
  }
}

export function parseOutputARecord(line: string): OutputARecord {
  return decodeRecord(A_OUTPUT_SPEC, line);
}

export function parseOutputZRecord(line: string): OutputZRecord {
  return decodeRecord(Z_OUTPUT_SPEC, line);
}

export function parseOutputBRecord(line: string): OutputBRecord {
  return decodeRecord(B_OUTPUT_SPEC, line);
}

export function parseOutputYRecord(line: string): OutputYRecord {
  return decodeRecord(Y_OUTPUT_SPEC, line);
}

export function parseAceGeneratedBRecord(line: string): AceGeneratedBRecord {
  return decodeRecord(B_ACE_GENERATED_SPEC, line);
}

export function parseAceGeneratedYRecord(line: string): AceGeneratedYRecord {
  return decodeRecord(Y_ACE_GENERATED_SPEC, line);
}

export function parseAceGeneratedZRecord(line: string): AceGeneratedZRecord {
  return decodeRecord(Z_ACE_GENERATED_SPEC, line);
}

export function parseX0Record(line: string): X0Record {
  const typeCode = line.slice(3, 9).trim();
  if (typeCode === "BLOCK") return decodeRecord(X0_BLOCK_SPEC, line);
  if (typeCode === "TRNACT") return decodeRecord(X0_TRNACT_SPEC, line);
  throw new AbiFixedWidthError(`X0-Record has an unrecognized Reference Data Type Code: "${typeCode}".`);
}

export function parseX1Record(line: string): X1Record {
  const decoded = decodeRecord(X1_SPEC, line);
  const isFinalDisposition = decoded.dispositionTypeCode === "R" || decoded.conditionCode === "999";
  return { ...decoded, isFinalDisposition };
}

/**
 * Parses raw CBP ACE response text into a typed result. Batch & Block Control
 * acceptance is binary at the envelope level (see types.ts docs): the presence
 * of ANY X1 record means the whole batch was rejected — CBP never emits X1
 * records when batch/block/transaction syntax was accepted.
 */
export function parseOutputBatch(raw: string): ParsedBatchResult {
  const lines = splitFixedWidthLines(raw);
  if (lines.length < 4) {
    throw new AbiFixedWidthError(
      `Output batch has only ${lines.length} record(s); at minimum expects A, B, Y, Z.`
    );
  }

  if (classifyLine(lines[0]) !== "A") {
    throw new AbiFixedWidthError("Output batch must begin with an A-Record.");
  }
  if (classifyLine(lines[lines.length - 1]) !== "Z") {
    throw new AbiFixedWidthError("Output batch must end with a Z-Record.");
  }

  const aRecord = parseOutputARecord(lines[0]);
  const interior = lines.slice(1, -1);
  const lastLine = lines[lines.length - 1];

  const hasCondition = interior.some((line) => classifyLine(line) === "X1");

  if (hasCondition) {
    return parseRejectedBatch(aRecord, interior, lastLine);
  }
  return parseAcceptedBatch(aRecord, interior, lastLine);
}

function parseRejectedBatch(
  aRecord: OutputARecord,
  interior: string[],
  lastLine: string
): ParsedBatchResult {
  const zRecord = parseAceGeneratedZRecord(lastLine);

  let blockReference: Extract<X0Record, { referenceDataTypeCode: "BLOCK" }> | undefined;
  let transactionReference: Extract<X0Record, { referenceDataTypeCode: "TRNACT" }> | undefined;
  const conditions: X1Record[] = [];
  let finalDisposition: X1Record | undefined;

  for (const line of interior) {
    const type = classifyLine(line);
    if (type === "X0") {
      const x0 = parseX0Record(line);
      if (x0.referenceDataTypeCode === "BLOCK") blockReference = x0;
      else transactionReference = x0;
    } else if (type === "X1") {
      const x1 = parseX1Record(line);
      if (x1.isFinalDisposition) finalDisposition = x1;
      else conditions.push(x1);
    }
    // "B"/"Y" here are the ACE-generated diagnostic block wrapper — no data to extract.
  }

  if (!finalDisposition) {
    throw new AbiFixedWidthError(
      "Rejected batch has no final disposition X1-Record (condition 999 / BATCH REJECTED)."
    );
  }

  const level: "BATCH" | "BLOCK" | "TRANSACTION" = transactionReference
    ? "TRANSACTION"
    : blockReference
      ? "BLOCK"
      : "BATCH";

  return {
    scenario: "REJECTED",
    level,
    aRecord,
    zRecord,
    blockReference,
    transactionReference,
    conditions,
    finalDisposition,
  };
}

function parseAcceptedBatch(
  aRecord: OutputARecord,
  interior: string[],
  lastLine: string
): ParsedBatchResult {
  const zRecord = parseOutputZRecord(lastLine);
  const blocks: ParsedBlock[] = [];

  let i = 0;
  while (i < interior.length) {
    if (classifyLine(interior[i]) !== "B") {
      throw new AbiFixedWidthError(`Expected a B-Record starting a block, found: "${interior[i]}"`);
    }
    const header = parseOutputBRecord(interior[i]);
    i++;

    const transactionRecords: string[] = [];
    while (i < interior.length && classifyLine(interior[i]) !== "Y") {
      transactionRecords.push(interior[i]);
      i++;
    }
    if (i >= interior.length) {
      throw new AbiFixedWidthError("Block is missing its closing Y-Record.");
    }
    const trailer = parseOutputYRecord(interior[i]);
    i++;

    blocks.push({ header, trailer, transactionRecords });
  }

  return { scenario: "ACCEPTED", aRecord, zRecord, blocks };
}

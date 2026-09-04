import { decodeRecord, splitFixedWidthLines, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { E0_SUMMARY_SPEC, E0_GENERIC_SPEC, E1_SPEC } from "./recordSpecs";
import type { E0Record, E1Record, EntrySummaryCondition, ParsedEntrySummaryResponse } from "./types";

export type EntrySummaryResponseLineType = "E0" | "E1" | "UNKNOWN";

export function classifyResponseLine(line: string): EntrySummaryResponseLineType {
  const two = line.slice(0, 2);
  if (two === "E0") return "E0";
  if (two === "E1") return "E1";
  return "UNKNOWN";
}

export function parseE0Record(line: string): E0Record {
  const typeCode = line.slice(3, 9).trim();
  return typeCode === "SUMMRY" ? decodeRecord(E0_SUMMARY_SPEC, line) : decodeRecord(E0_GENERIC_SPEC, line);
}

export function parseE1Record(line: string): E1Record {
  const decoded = decodeRecord(E1_SPEC, line);
  const isFinalDisposition = decoded.dispositionTypeCode === "A" || decoded.dispositionTypeCode === "R";
  return { ...decoded, isFinalDisposition };
}

/**
 * Parses the flat E0/E1 lines CBP returns for one Entry Summary TRANSACTION
 * Grouping — as extracted from a Batch & Block Control block's
 * `transactionRecords` (see batchBlockControl's `ParsedBlock`) — into each
 * condition paired with the E0-Record(s) that identify what caused it, plus the
 * final disposition. Per the spec's usage notes, every condition E1-Record is
 * preceded by one or more E0-Records; the final disposition record itself
 * describes the whole transaction and has none.
 */
export function parseEntrySummaryResponse(lines: string[]): ParsedEntrySummaryResponse {
  const conditions: EntrySummaryCondition[] = [];
  let pendingReferences: E0Record[] = [];
  let finalDisposition: E1Record | undefined;

  for (const line of lines) {
    const type = classifyResponseLine(line);
    if (type === "E0") {
      pendingReferences.push(parseE0Record(line));
    } else if (type === "E1") {
      const e1 = parseE1Record(line);
      if (e1.isFinalDisposition) {
        finalDisposition = e1;
      } else {
        conditions.push({ references: pendingReferences, condition: e1 });
      }
      pendingReferences = [];
    } else {
      throw new AbiFixedWidthError(`Unrecognized Entry Summary response line: "${line}"`);
    }
  }

  if (!finalDisposition) {
    throw new AbiFixedWidthError(
      "Entry Summary response has no final disposition E1-Record (Disposition Type Code A or R)."
    );
  }

  return {
    scenario: finalDisposition.dispositionTypeCode === "A" ? "ACCEPTED" : "REJECTED",
    conditions,
    finalDisposition,
  };
}

/** Convenience: splits raw multi-line response text into 80-char lines before parsing. */
export function parseEntrySummaryResponseText(raw: string): ParsedEntrySummaryResponse {
  return parseEntrySummaryResponse(splitFixedWidthLines(raw));
}

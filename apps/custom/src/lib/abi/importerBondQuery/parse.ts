import { decodeRecord } from "@/lib/abi/fixedWidth";
import {
  RECORD_K1_SPEC,
  RECORD_K2_SPEC,
  RECORD_K3_SPEC,
  RECORD_K4_SPEC,
  RECORD_K5_SPEC,
  RECORD_K6_SPEC,
  RECORD_K7_SPEC,
  RECORD_K8_SPEC,
} from "./recordSpecs";
import type { K1Output, K2Output, K3Output, K4Output, K5Output, K6Output, K7Output, K8Output } from "./types";

// Decode/classify helpers for the Importer/Bond Query chapter's 8 output
// records (K1 mandatory per bond on file, K2-K8 conditional on address
// request code / data availability).

export function parseK1(line: string): K1Output {
  return decodeRecord(RECORD_K1_SPEC, line);
}

export function parseK2(line: string): K2Output {
  return decodeRecord(RECORD_K2_SPEC, line);
}

export function parseK3(line: string): K3Output {
  return decodeRecord(RECORD_K3_SPEC, line);
}

export function parseK4(line: string): K4Output {
  return decodeRecord(RECORD_K4_SPEC, line);
}

export function parseK5(line: string): K5Output {
  return decodeRecord(RECORD_K5_SPEC, line);
}

export function parseK6(line: string): K6Output {
  return decodeRecord(RECORD_K6_SPEC, line);
}

export function parseK7(line: string): K7Output {
  return decodeRecord(RECORD_K7_SPEC, line);
}

export function parseK8(line: string): K8Output {
  return decodeRecord(RECORD_K8_SPEC, line);
}

export type ImporterBondQueryLineType = "K1" | "K2" | "K3" | "K4" | "K5" | "K6" | "K7" | "K8" | "UNKNOWN";

const KNOWN_CODES: ReadonlySet<string> = new Set(["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"]);

/**
 * Classifies an output line by its 2-char "Control Identifier + Record Type"
 * prefix (e.g. "K1", "K7"). "UNKNOWN" covers the input K-record itself (which
 * shares the "K" control identifier but is followed by a space, not a record
 * type digit, at position 2) and anything outside this chapter.
 */
export function classifyImporterBondQueryLine(line: string): ImporterBondQueryLineType {
  const code = line.slice(0, 2);
  return KNOWN_CODES.has(code) ? (code as ImporterBondQueryLineType) : "UNKNOWN";
}

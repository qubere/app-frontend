import { encodeRecord } from "@/lib/abi/fixedWidth";
import { RECORD_K_SPEC } from "./recordSpecs";
import type { ImporterBondQueryInput } from "./types";

export function buildImporterBondQuery(input: ImporterBondQueryInput): string {
  return encodeRecord(RECORD_K_SPEC, input);
}

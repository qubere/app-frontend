// Parse an ACE CATAIR 5106 Importer/Consignee Create/Update response (output records E0, E1).
// Source: docs/plans/catair-source-docs/19-importer-consignee-create-update-5106-v12.pdf

import { decodeRecord, splitFixedWidthLines } from "@/lib/abi/fixedWidth";
import type { E0Output, E1Output } from "./types";
import { RECORD_E0_SPEC, RECORD_E1_SPEC } from "./recordSpecs";

export interface ImporterCreateResponse {
  /** Accepted = at least one E1 with dispositionTypeCode "A" and no fatal rejections. */
  accepted: boolean;
  /** CBP-assigned importer number when actionCode was "N" and accepted. */
  cbpAssignedNumber?: string;
  conditionReferences: E0Output[];
  dispositionRecords: E1Output[];
  errors: string[];
}

/**
 * Parse a CBP response for an Importer Create/Update transaction.
 * `raw` is the full multi-line CATAIR response text (CRLF-delimited).
 * Lines not starting with "E0" or "E1" are silently skipped (B/Y batch control, etc.).
 */
export function parseImporterCreateResponse(raw: string): ImporterCreateResponse {
  const lines = raw.split(/\r\n|\r|\n/).filter((l) => l.length > 0);

  const conditionReferences: E0Output[] = [];
  const dispositionRecords: E1Output[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === "E0") {
      try {
        conditionReferences.push(decodeRecord(RECORD_E0_SPEC, line));
      } catch (e) {
        errors.push(`E0 parse error: ${e}`);
      }
    } else if (id === "E1") {
      try {
        dispositionRecords.push(decodeRecord(RECORD_E1_SPEC, line));
      } catch (e) {
        errors.push(`E1 parse error: ${e}`);
      }
    }
    // skip B, Y, and any other control records
  }

  // Determine acceptance: a final "A" disposition record with no fatal "F" severity
  const hasFatal = dispositionRecords.some((r) => r.severityCode === "F");
  const hasAccepted = dispositionRecords.some((r) => r.dispositionTypeCode === "A");
  const hasRejected = dispositionRecords.some((r) => r.dispositionTypeCode === "R");
  const accepted = hasAccepted && !hasFatal && !hasRejected;

  // Extract CBP-assigned number from the E0 IMPACC reference data text (positions 26-37 of E0)
  // Reference Data Text: pos 26-37 = Importer Number, 38-69 = Abbreviated Name (within the 55X field)
  let cbpAssignedNumber: string | undefined;
  for (const ref of conditionReferences) {
    if (ref.referenceDataTypeCode.trim() === "IMPACC" && accepted) {
      // referenceDataText pos 26-80 in original E0 → in our decoded field it's the full 55X
      // positions within the 55X: 1-12 = importer number, 13-44 = abbreviated name, 45-55 = space
      const importerNum = ref.referenceDataText.slice(0, 12).trim();
      if (importerNum.length > 0) {
        cbpAssignedNumber = importerNum;
        break;
      }
    }
  }

  return { accepted, cbpAssignedNumber, conditionReferences, dispositionRecords, errors };
}

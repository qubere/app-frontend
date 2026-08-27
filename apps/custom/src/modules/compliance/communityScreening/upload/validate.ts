import { getCommunityScreeningMaxParties } from "../config";
import type { CommunityScreeningPartyInput } from "../types";

export interface CommunityScreeningRowError {
  rowNumber: number;
  errors: string[];
}

export interface ValidateCommunityScreeningRowsResult {
  valid: CommunityScreeningPartyInput[];
  invalid: CommunityScreeningRowError[];
}

/** Validates parsed rows: name required, row cap enforced, duplicate external references flagged. Never mutates input rows. */
export function validateCommunityScreeningRows(
  rows: CommunityScreeningPartyInput[]
): ValidateCommunityScreeningRowsResult {
  const maxParties = getCommunityScreeningMaxParties();
  const valid: CommunityScreeningPartyInput[] = [];
  const invalid: CommunityScreeningRowError[] = [];
  const seenReferences = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];

    if (!row.name || row.name.trim() === "") {
      errors.push("Party name is required");
    }

    if (row.externalReference) {
      if (seenReferences.has(row.externalReference)) {
        errors.push(`Duplicate external reference "${row.externalReference}" within this file`);
      }
      seenReferences.add(row.externalReference);
    }

    if (rowNumber > maxParties) {
      errors.push(`Row exceeds the maximum of ${maxParties} parties per screening run`);
    }

    if (errors.length > 0) {
      invalid.push({ rowNumber, errors });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

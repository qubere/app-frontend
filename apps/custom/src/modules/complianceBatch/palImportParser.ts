// PRE_APPROVED_PARTY_IMPORT -- CSV parser for the bulk pre-approval upload
// (see docs/pre-approved-party-list.md "Known gaps": approvals could
// previously only be created one party at a time). This only validates row
// *structure*; partyId existence, identity, and reference-data freshness are
// all re-checked by createPreApproval() itself at processing time, exactly
// as for the one-at-a-time API -- this parser never assumes a party is
// approvable just because its row is well-formed.
import { parseCsv } from "@/modules/party/partyCsv";
import type { ParsedPreApprovedPartyImportInput } from "./types";

const PARTY_ID_ALIASES = ["partyid", "party id", "party identifier"];
const REASON_ALIASES = ["reason"];
const EXPIRES_AT_ALIASES = ["expiresat", "expires at", "expiration date", "expirationdate"];

function canonicalHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: readonly string[], aliases: readonly string[]): number {
  const canonicalHeaders = headers.map(canonicalHeader);
  const canonicalAliases = aliases.map(canonicalHeader);
  return canonicalHeaders.findIndex((h) => canonicalAliases.includes(h));
}

export function parsePreApprovedPartyImportCsv(text: string): ParsedPreApprovedPartyImportInput {
  const parsed = parseCsv(text);

  const partyIdIndex = findColumn(parsed.headers, PARTY_ID_ALIASES);
  const reasonIndex = findColumn(parsed.headers, REASON_ALIASES);
  const expiresAtIndex = findColumn(parsed.headers, EXPIRES_AT_ALIASES);

  const records: ParsedPreApprovedPartyImportInput["records"] = [];
  const sourceRowNumbers: number[] = [];
  const invalidRows: ParsedPreApprovedPartyImportInput["invalidRows"] = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const errors: string[] = [];

    const partyId = partyIdIndex >= 0 ? (row[partyIdIndex] ?? "").trim() : "";
    if (!partyId) {
      errors.push("A Party ID column (Party ID / Party Identifier) resolving to a non-empty value is required.");
    }

    const reason = reasonIndex >= 0 ? (row[reasonIndex] ?? "").trim() || null : null;

    let expiresAt: string | null = null;
    const rawExpiresAt = expiresAtIndex >= 0 ? (row[expiresAtIndex] ?? "").trim() : "";
    if (rawExpiresAt) {
      const parsedDate = new Date(rawExpiresAt);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push(`Expires At "${rawExpiresAt}" is not a valid date.`);
      } else {
        expiresAt = parsedDate.toISOString();
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber, errors });
      return;
    }

    records.push({ partyId, reason, expiresAt });
    sourceRowNumbers.push(rowNumber);
  });

  return { records, sourceRowNumbers, invalidRows };
}

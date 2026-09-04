// Normalizes all three Community Screening input modes into a common list
// of party rows. Party Master rows are snapshotted at resolution time (via
// loadCurrentIdentity) -- the Party record itself is never cloned or
// mutated, only read.
import type { Tx } from "@/modules/agents/compliance/restrictedParty/partyIdentity";
import { loadCurrentIdentity } from "@/modules/agents/compliance/restrictedParty/partyIdentity";
import { parseCommunityScreeningCsv } from "./upload/csv";
import { parseCommunityScreeningXlsx } from "./upload/xlsx";
import { parseCommunityScreeningJson } from "./upload/json";
import { validateCommunityScreeningRows } from "./upload/validate";
import type { CommunityScreeningInputSource, CommunityScreeningPartyInput } from "./types";

export class CommunityScreeningInputError extends Error {
  constructor(
    message: string,
    public readonly invalidRows: Array<{ rowNumber: number; errors: string[] }> = []
  ) {
    super(message);
    this.name = "CommunityScreeningInputError";
  }
}

async function resolvePartyMasterRows(
  tx: Tx,
  accountId: string,
  partyIds: string[]
): Promise<CommunityScreeningPartyInput[]> {
  const rows: CommunityScreeningPartyInput[] = [];
  for (const partyId of partyIds) {
    const identity = await loadCurrentIdentity(tx, accountId, partyId);
    if (!identity) {
      throw new CommunityScreeningInputError(`Party ${partyId} has no active identity to screen`);
    }
    rows.push({
      partyId,
      externalReference: null,
      name: identity.name,
      address: identity.address ?? null,
      city: identity.city ?? null,
      country: identity.country ?? null,
      contactName: identity.contactName ?? null,
    });
  }
  return rows;
}

function parseUploadedFile(
  fileName: string,
  fileType: "CSV" | "XLSX" | "JSON",
  fileContent: Buffer
): Promise<CommunityScreeningPartyInput[]> | CommunityScreeningPartyInput[] {
  switch (fileType) {
    case "CSV":
      return parseCommunityScreeningCsv(fileContent.toString("utf-8"));
    case "XLSX":
      return parseCommunityScreeningXlsx(fileContent);
    case "JSON":
      return parseCommunityScreeningJson(fileContent.toString("utf-8"));
  }
}

export interface ResolvedCommunityScreeningParties {
  parties: CommunityScreeningPartyInput[];
  invalidRows: Array<{ rowNumber: number; errors: string[] }>;
}

export async function resolveCommunityScreeningParties(
  tx: Tx,
  accountId: string,
  input: CommunityScreeningInputSource
): Promise<ResolvedCommunityScreeningParties> {
  let rows: CommunityScreeningPartyInput[];

  if (input.inputMode === "DIRECT_ENTRY") {
    rows = input.parties;
  } else if (input.inputMode === "PARTY_MASTER") {
    rows = await resolvePartyMasterRows(tx, accountId, input.partyIds);
  } else {
    rows = await parseUploadedFile(input.fileName, input.fileType, input.fileContent);
  }

  const { valid, invalid } = validateCommunityScreeningRows(rows);
  if (valid.length === 0) {
    throw new CommunityScreeningInputError("No valid rows to screen", invalid);
  }

  return { parties: valid, invalidRows: invalid };
}

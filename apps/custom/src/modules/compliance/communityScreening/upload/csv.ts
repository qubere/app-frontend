import { parseCsv } from "@/modules/party/partyCsv";
import { mapCommunityScreeningColumns, rowToPartyInput } from "./columns";
import type { CommunityScreeningPartyInput } from "../types";

export function parseCommunityScreeningCsv(text: string): CommunityScreeningPartyInput[] {
  const parsed = parseCsv(text);
  const mapping = mapCommunityScreeningColumns(parsed.headers);
  return parsed.rows.map((row) => rowToPartyInput(mapping, row));
}

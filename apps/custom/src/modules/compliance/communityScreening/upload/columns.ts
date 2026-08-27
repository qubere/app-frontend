// Community Screening upload -- shared column-alias mapping, used by both
// the CSV and JSON/XLSX row normalizers. Mirrors partyCsv.ts's alias
// approach, scoped to Community Screening's own (smaller) field set.
import { normalizeCountry, trimToNull } from "@/modules/party/partyNormalization";
import type { CommunityScreeningPartyInput } from "../types";

export type CommunityScreeningColumnField =
  | "partyId"
  | "externalReference"
  | "name"
  | "address"
  | "city"
  | "country"
  | "contactName";

const COLUMN_ALIASES: Record<CommunityScreeningColumnField, readonly string[]> = {
  partyId: ["partyid", "party id", "party_id"],
  externalReference: ["externalreference", "external reference", "reference", "ref"],
  name: ["name", "partyname", "party name", "legalname", "legal name"],
  address: ["address", "addressline1", "address line 1", "street"],
  city: ["city"],
  country: ["country", "countrycode", "country code"],
  contactName: ["contactname", "contact name", "contact"],
};

function canonicalHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface CommunityScreeningColumnMapping {
  /** Field -> zero-based column index, or undefined when the file has no matching column. */
  indexByField: Partial<Record<CommunityScreeningColumnField, number>>;
}

export function mapCommunityScreeningColumns(headers: readonly string[]): CommunityScreeningColumnMapping {
  const canonicalHeaders = headers.map(canonicalHeader);
  const indexByField: Partial<Record<CommunityScreeningColumnField, number>> = {};

  for (const field of Object.keys(COLUMN_ALIASES) as CommunityScreeningColumnField[]) {
    const aliases = COLUMN_ALIASES[field].map(canonicalHeader);
    const index = canonicalHeaders.findIndex((h) => aliases.includes(h));
    if (index >= 0) indexByField[field] = index;
  }

  return { indexByField };
}

export function rowToPartyInput(
  mapping: CommunityScreeningColumnMapping,
  row: readonly string[]
): CommunityScreeningPartyInput {
  const get = (field: CommunityScreeningColumnField): string | null => {
    const index = mapping.indexByField[field];
    if (index === undefined) return null;
    return trimToNull(row[index] ?? "");
  };

  const countryRaw = get("country");

  return {
    partyId: get("partyId"),
    externalReference: get("externalReference"),
    name: get("name") ?? "",
    address: get("address"),
    city: get("city"),
    country: countryRaw ? normalizeCountry(countryRaw).code ?? countryRaw : null,
    contactName: get("contactName"),
  };
}

import crypto from "crypto";
import { mapDowJonesReference } from "./sourceListMapper";
import type { SanctionsReferenceDictionary } from "./dictionaryParser";

export interface RawNameDetail {
  subId?: string;
  nameType?: string;
  entityName?: string;
  fullName?: string;
  singleStringName?: string;
}

export interface RawCompanyDetail {
  subId?: string;
  addressLine?: string;
  addressCity?: string;
  addressCountry?: string;
}

export interface RawCountryDetail {
  subId?: string;
  countryType?: string;
  countryValue?: string;
}

export interface RawIdNumberType {
  subId?: string;
  idType?: string;
  idValue?: string;
  idNotes?: string;
}

export interface RawSanctionsReference {
  subId?: string;
  sinceMonth?: string;
  toMonth?: string;
  reference?: string;
}

export interface RawSource {
  subId?: string;
  source?: string;
}

export interface RawEntity {
  id: string;
  date?: string;
  activeStatus?: string;
  profileNotes?: string;
  names: RawNameDetail[];
  companies: RawCompanyDetail[];
  countries: RawCountryDetail[];
  idNumbers: RawIdNumberType[];
  references: RawSanctionsReference[];
  sources: RawSource[];
}

export interface TransformedAlias {
  providerSubId: string | null;
  name: string;
  aliasType: string;
  isPrimary: boolean;
}

export interface TransformedAddress {
  providerSubId: string | null;
  addressLine: string | null;
  city: string | null;
  stateOrProvince: string | null;
  countryCode: string | null;
  countryName: string | null;
  isPrimary: boolean;
}

export interface TransformedIdentifier {
  identifierType: string;
  identifierValue: string;
  notes: string | null;
}

export interface TransformedReference {
  providerSubId: string | null;
  sourceAuthority: string;
  sourceList: string;
  sourceListName: string;
  sourceStatus: string;
}

export interface TransformedEntity {
  entityHash: string;
  provider: "DOW_JONES";
  providerRecordId: string;
  providerUpdatedAt: Date | null;
  entityType: string;
  name: string;
  alternateNames: string[];
  address: string | null;
  city: string | null;
  country: string | null;
  programCodes: string[];
  sourceAuthority: string | null;
  sourceList: string | null;
  sourceFileDate: Date;
  sourceFileType: string;
  providerMetadata: Record<string, unknown>;
  publicationStatus: "PUBLISHED" | "SUPERSEDED";
  aliases: TransformedAlias[];
  addresses: TransformedAddress[];
  identifiers: TransformedIdentifier[];
  references: TransformedReference[];
  unknownReferenceNames: string[];
}

function parseDowJonesDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nameDetailText(n: RawNameDetail): string | null {
  return n.entityName?.trim() || n.fullName?.trim() || n.singleStringName?.trim() || null;
}

/**
 * Transforms one parsed `<Entity>` node into a ScreeningEntity row plus its
 * alias/address/identifier/reference children. Pure and side-effect-free --
 * the caller (fullFeedIngestionService) owns all DB access, so this can be
 * unit-tested against hand-built fixtures with no database.
 */
export function transformEntity(
  raw: RawEntity,
  dictionary: SanctionsReferenceDictionary,
  feedDate: Date,
  feedType: string
): TransformedEntity {
  const primaryNameDetail = raw.names.find((n) => n.nameType === "Primary Name") || raw.names[0];
  const name = (primaryNameDetail && nameDetailText(primaryNameDetail)) || `Dow Jones Entity ${raw.id}`;

  const aliases: TransformedAlias[] = [];
  const alternateNames: string[] = [];
  for (const n of raw.names) {
    if (n === primaryNameDetail) continue;
    const text = nameDetailText(n);
    if (!text) continue;
    aliases.push({
      providerSubId: n.subId ?? null,
      name: text,
      aliasType: n.nameType || "Also Known As",
      isPrimary: false,
    });
    alternateNames.push(text);
  }

  const addresses: TransformedAddress[] = raw.companies.map((c) => ({
    providerSubId: c.subId ?? null,
    addressLine: c.addressLine?.trim() || null,
    city: c.addressCity?.trim() || null,
    stateOrProvince: null,
    countryCode: null,
    countryName: c.addressCountry?.trim() || null,
    isPrimary: false,
  }));
  if (addresses.length > 0) addresses[0].isPrimary = true;
  const primaryAddress = addresses[0] ?? null;

  const countryOfRegistration = raw.countries.find((c) => c.countryType === "Country of Registration");
  const countryOfAffiliation = raw.countries.find((c) => c.countryType === "Country of Affiliation");
  const country =
    primaryAddress?.countryName || countryOfRegistration?.countryValue || countryOfAffiliation?.countryValue || null;

  const identifiers: TransformedIdentifier[] = raw.idNumbers
    .filter((i) => i.idType && i.idValue)
    .map((i) => ({
      identifierType: i.idType!,
      identifierValue: i.idValue!,
      notes: i.idNotes?.trim() || null,
    }));
  const programCodes = raw.idNumbers.filter((i) => i.idType === "OFAC Program ID" && i.idValue).map((i) => i.idValue!);

  const references: TransformedReference[] = [];
  const unknownReferenceNames: string[] = [];
  for (const ref of raw.references) {
    if (!ref.reference) continue;
    const dictEntry = dictionary.get(ref.reference);
    const sourceListName = dictEntry?.name ?? `UNKNOWN_REFERENCE_CODE_${ref.reference}`;
    if (!dictEntry) unknownReferenceNames.push(sourceListName);
    const mapped = mapDowJonesReference(sourceListName);
    references.push({
      providerSubId: ref.subId ?? null,
      sourceAuthority: mapped.authority,
      sourceList: mapped.sourceList,
      sourceListName,
      sourceStatus: dictEntry?.status ?? "Current",
    });
  }
  const primaryReference = references.find((r) => r.sourceStatus === "Current") ?? references[0] ?? null;

  const publicationStatus = raw.activeStatus === "Active" ? "PUBLISHED" : "SUPERSEDED";

  return {
    // Dow Jones' real dedup/upsert key is (provider, providerRecordId) below, not
    // this hash -- entityHash only exists to satisfy ScreeningEntity's shared
    // required-unique column. computeEntityHash's name+country formula (used by
    // OFAC/BIS to intentionally collapse the same entity across small
    // government lists) collides far too often across this feed's ~62,000
    // distinct entities, so it is not reused here: this is keyed on
    // providerRecordId, which the feed already guarantees is unique per entity.
    entityHash: crypto.createHash("sha256").update(`DOW_JONES:${raw.id}`).digest("hex"),
    provider: "DOW_JONES",
    providerRecordId: raw.id,
    providerUpdatedAt: parseDowJonesDate(raw.date),
    entityType: "ENTITY",
    name,
    alternateNames,
    address: primaryAddress?.addressLine ?? null,
    city: primaryAddress?.city ?? null,
    country,
    programCodes,
    sourceAuthority: primaryReference?.sourceAuthority ?? null,
    sourceList: primaryReference?.sourceList ?? null,
    sourceFileDate: feedDate,
    sourceFileType: feedType,
    providerMetadata: {
      countryDetails: raw.countries,
      sources: raw.sources,
      profileNotes: raw.profileNotes ?? null,
    },
    publicationStatus,
    aliases,
    addresses,
    identifiers,
    references,
    unknownReferenceNames,
  };
}

/**
 * Deterministic, rule-based mapping from a Dow Jones `SanctionsReferencesLists`
 * dictionary <Name> (e.g. "OFAC - Specially Designated National List") to the
 * {authority, sourceList, category} triple stored on ScreeningEntityReference.
 *
 * No LLM involved. The dictionary carries 3,000+ distinct list names (see
 * apps/custom/src/modules/screening/dowJones/README-source-lists.md for the
 * extraction method) -- far too many to hand-transcribe one-by-one, so only
 * the small set of authorities this app's matcher/compliance logic actually
 * cares about (OFAC, BIS, UN, EU, DDTC, MOFCOM, DHS/UFLPA, multilateral
 * development banks) get an exact or pattern match below. Everything else
 * (the long tail of country financial-regulator warning/enforcement lists)
 * falls through to a generic "(Country) Descriptor" pattern rule, and
 * anything that matches nothing at all still gets a stable UNKNOWN mapping
 * -- never silently discarded, and never collapsed into SDN/CONSOLIDATED_NON_SDN.
 */

export type SourceCategory =
  | "SANCTIONS"
  | "EXPORT_CONTROL"
  | "DEBARMENT"
  | "LAW_ENFORCEMENT"
  | "REGULATORY_WARNING"
  | "OTHER_WATCHLIST";

export interface MappedReference {
  authority: string;
  sourceList: string;
  category: SourceCategory;
}

function normalizeToSourceList(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/&AMP;/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function extractParentheticalAuthority(name: string): string | null {
  const m = name.match(/\(([^)]+)\)/);
  if (!m) return null;
  return normalizeToSourceList(m[1]) || null;
}

// Exact matches for the handful of well-known lists this app's existing
// matcher/compliance code already reasons about by short code.
const EXPLICIT_MAP: Record<string, MappedReference> = {
  "OFAC - Specially Designated National List": { authority: "OFAC", sourceList: "SDN", category: "SANCTIONS" },
  "OFAC - Specially Designated Terrorist List": { authority: "OFAC", sourceList: "SDT", category: "SANCTIONS" },
  "OFAC - Specially Designated Global Terrorist List": { authority: "OFAC", sourceList: "SDGT", category: "SANCTIONS" },
  "OFAC - Specially Designated Narcotics Trafficker List": { authority: "OFAC", sourceList: "SDNTK", category: "SANCTIONS" },
  "OFAC - Foreign Sanctions Evaders with Respect to Iran": { authority: "OFAC", sourceList: "FSE", category: "SANCTIONS" },
  "OFAC - Foreign Sanctions Evaders with Respect to Syria": { authority: "OFAC", sourceList: "FSE", category: "SANCTIONS" },
  "OFAC - Palestinian Legislative Council List (NS-PLC)": { authority: "OFAC", sourceList: "PLC", category: "SANCTIONS" },
  "OFAC - Non-SDN Menu Based Sanctions List": { authority: "OFAC", sourceList: "NS_MBS", category: "SANCTIONS" },
  "BIS Denied Persons List": { authority: "BIS", sourceList: "DPL", category: "EXPORT_CONTROL" },
  "BIS Entity List": { authority: "BIS", sourceList: "ENTITY_LIST", category: "EXPORT_CONTROL" },
  // Must be "UNVERIFIED" -- endUserRepository.ts queries ScreeningEntity by that exact sourceList.
  "BIS Unverified List": { authority: "BIS", sourceList: "UNVERIFIED", category: "EXPORT_CONTROL" },
  // Must be "MEU_LIST" -- militaryEndUseRepository.ts queries ScreeningEntity by that exact sourceList.
  "BIS Military End User List": { authority: "BIS", sourceList: "MEU_LIST", category: "EXPORT_CONTROL" },
  "BIS Military Intelligence End User List": { authority: "BIS", sourceList: "MIEU", category: "EXPORT_CONTROL" },
  "BIS Antiboycott Compliance List": { authority: "BIS", sourceList: "ANTIBOYCOTT", category: "EXPORT_CONTROL" },
  "US Department of Homeland Security UFLPA Entity List": {
    authority: "DHS",
    sourceList: "UFLPA_ENTITY_LIST",
    category: "EXPORT_CONTROL",
  },
  "MOFCOM (China) Unreliable Entity List": { authority: "MOFCOM", sourceList: "UNRELIABLE_ENTITY_LIST", category: "EXPORT_CONTROL" },
  "MOFCOM (China) Export Control List": { authority: "MOFCOM", sourceList: "EXPORT_CONTROL_LIST", category: "EXPORT_CONTROL" },
  "US Defense Trade Controls Administratively Debarred Parties": {
    authority: "DDTC",
    sourceList: "ADMIN_DEBARRED",
    category: "EXPORT_CONTROL",
  },
  "US Defense Trade Controls Statutorily Debarred Parties": {
    authority: "DDTC",
    sourceList: "STATUTORY_DEBARRED",
    category: "EXPORT_CONTROL",
  },
  "World Bank List of Debarred Firms": { authority: "WORLD_BANK", sourceList: "DEBARRED_FIRMS", category: "DEBARMENT" },
};

interface PatternRule {
  test: (name: string) => boolean;
  map: (name: string) => MappedReference;
}

const PATTERN_RULES: PatternRule[] = [
  {
    // Any other "OFAC ..." / "OFAC Advisory - ..." list not already in EXPLICIT_MAP
    test: (n) => /^OFAC\b/i.test(n),
    map: (n) => ({
      authority: "OFAC",
      sourceList: normalizeToSourceList(n.replace(/^OFAC(\s+Advisory)?\s*-?\s*/i, "")),
      category: "SANCTIONS",
    }),
  },
  {
    test: (n) => /^BIS\b/i.test(n),
    map: (n) => ({ authority: "BIS", sourceList: normalizeToSourceList(n.replace(/^BIS\s*/i, "")), category: "EXPORT_CONTROL" }),
  },
  {
    // UN Security Council resolutions and Panel of Experts lists
    test: (n) => /^UN\b/i.test(n),
    map: (n) => ({ authority: "UN", sourceList: normalizeToSourceList(n.replace(/^UN\s*/i, "")), category: "SANCTIONS" }),
  },
  {
    // Numbered EU directives/decisions, e.g. "2001/927/EC Terrorism List", "2002/340/CFSP EU Terrorism List"
    test: (n) => /^\d+\/\d+\/(EC|CFSP)\b/i.test(n),
    map: (n) => ({ authority: "EU", sourceList: normalizeToSourceList(n), category: "SANCTIONS" }),
  },
  {
    test: (n) => /^EU\b/i.test(n),
    map: (n) => ({
      authority: "EU",
      sourceList: normalizeToSourceList(n.replace(/^EU\s*/i, "")),
      category: /tax purposes|Illegal, Unreported/i.test(n) ? "REGULATORY_WARNING" : "SANCTIONS",
    }),
  },
  {
    test: (n) => /^DFATD?\b/i.test(n), // DFAT (Australia) and DFATD (Canada)
    map: (n) => ({
      authority: /DFATD/i.test(n) ? "CANADA" : "AUSTRALIA",
      sourceList: normalizeToSourceList(n),
      category: "SANCTIONS",
    }),
  },
  {
    test: (n) => /^SECO\b/i.test(n),
    map: (n) => ({ authority: "SWITZERLAND", sourceList: normalizeToSourceList(n), category: "SANCTIONS" }),
  },
  {
    test: (n) => /^HM Treasury\b/i.test(n) || /^UK\b/i.test(n),
    map: (n) => ({
      authority: "UK",
      sourceList: normalizeToSourceList(n),
      category: /Proscribed Terrorist/i.test(n) ? "LAW_ENFORCEMENT" : "SANCTIONS",
    }),
  },
  {
    // Multilateral development bank debarment lists (may or may not carry a "(Country)" tag)
    test: (n) => /debar|blacklist/i.test(n) || /(World Bank|Development Bank)/i.test(n),
    map: (n) => ({
      authority: extractParentheticalAuthority(n) ?? "MULTILATERAL",
      sourceList: normalizeToSourceList(n),
      category: "DEBARMENT",
    }),
  },
  {
    test: (n) => /(Police|Wanted|Interpol|Prosecutor|Court|Bureau of Investigation|Crimestoppers|FBI|Constabulary)/i.test(n),
    map: (n) => ({
      authority: extractParentheticalAuthority(n) ?? "UNKNOWN",
      sourceList: normalizeToSourceList(n),
      category: "LAW_ENFORCEMENT",
    }),
  },
];

/**
 * Resolves one Dow Jones sanctions-reference dictionary name to
 * {authority, sourceList, category}. Always returns a value -- an
 * unrecognized name still gets a deterministic UNKNOWN/OTHER_WATCHLIST
 * mapping rather than being dropped, per the "never discard unknown
 * references" requirement.
 */
export function mapDowJonesReference(referenceName: string): MappedReference {
  const trimmed = referenceName.trim();

  const exact = EXPLICIT_MAP[trimmed];
  if (exact) return exact;

  for (const rule of PATTERN_RULES) {
    if (rule.test(trimmed)) return rule.map(trimmed);
  }

  // Generic long-tail fallback: country financial-regulator warning/enforcement
  // lists overwhelmingly follow a "Regulator (Country) Descriptor" shape.
  const parenthetical = extractParentheticalAuthority(trimmed);
  return {
    authority: parenthetical ?? "UNKNOWN",
    sourceList: normalizeToSourceList(trimmed),
    category: "REGULATORY_WARNING",
  };
}

/**
 * The 7501 rule pack (U6) — all 7501-specific validation knowledge, run
 * through the generic engine in engine.ts.
 *
 * C8: reuses `normalizeEntryType`/`requireEntryTypeCode` (modules/filing/entryType)
 * and `isKnownCountryCode` (modules/shipment/countryCode) rather than
 * re-inventing those vocabularies.
 *
 * Deviations / additions, documented rather than silently made:
 *
 *  - Bond.status in this codebase is one of
 *    unverified|verifying|verified|insufficient|verification_failed|attested|
 *    expired|revoked (see packages/db/prisma/schema.prisma) — there is no
 *    literal "Active" value. BOND_USABLE_STATUSES below is the current
 *    codebase's stand-in for "the bond is in force."
 *  - PowerOfAttorney.status is one of
 *    draft|out_for_signature|executed|declined|expired|revoked. "Active"
 *    means status === "executed", not revoked, and (if it has an expiry) not
 *    expired as of the entry date.
 *  - The issue's explicit rule list has no BLOCKING rule for
 *    MISSING_COMMERCIAL_INVOICE / MISSING_IMPORTER_OF_RECORD /
 *    BLOCKING_EXCEPTIONS / CRITICAL_RECONCILIATION / IMPORTER_NOT_ONBOARDED,
 *    yet the acceptance criteria require every FilingBlockerCode to map to at
 *    least one E7501.* rule. Four small BLOCKING rules are added
 *    (E7501.B18.MISSING_DOCS, E7501.B26.IMPORTER_OF_RECORD_MISSING,
 *    E7501.EXCEPTIONS.OPEN_BLOCKING, E7501.RECONCILIATION.CRITICAL_OPEN,
 *    E7501.IMPORTER.NOT_ONBOARDED) purely to close that coverage gap; they
 *    are additive and do not change any rule the issue named explicitly.
 */

import { normalizeEntryType } from "@/modules/filing/entryType";
import type { FilingBlockerCode } from "@/modules/filing/filingReadiness";
import { isKnownCountryCode } from "@/modules/shipment/countryCode";
import { Decimal } from "@/lib/tariff/decimal";
import type { EntrySummaryDraft, EntrySummaryLine, HeaderBlockId } from "../model";
import type { Rule, RuleFinding, Severity } from "./engine";

export interface BondForRules {
  status: string;
  expirationDate: Date | string | null;
}

export interface PowerOfAttorneyForRules {
  status: string;
  expirationDate: Date | string | null;
  revokedAt: Date | string | null;
}

export interface PgaRequirementForRules {
  lineNumber: number;
  resolved: boolean;
}

export interface Rules7501Context {
  entryDate: Date | string | null;
  bond: BondForRules | null;
  bondRequired: boolean;
  powerOfAttorney: PowerOfAttorneyForRules | null;
  pgaRequirements: PgaRequirementForRules[];
  openBlockingExceptionsCount: number;
  hasCommercialInvoice: boolean;
  /** "active" passes; anything else (including null with an IOR present) fires IMPORTER_NOT_ONBOARDED. */
  importerOnboardingStatus: string | null;
  criticalReconciliationOpen: boolean;
}

// A minimal set, not the full CBP mode-of-transport code table. "Ocean" is
// included as this codebase's existing spelling alongside CBP's "Vessel".
export const MODE_OF_TRANSPORT_CODES = ["Vessel", "Ocean", "Air", "Truck", "Rail", "Mail"] as const;

export const BOND_USABLE_STATUSES = new Set(["verified", "attested"]);

const HTS_FORMAT = /^\d{4}\.\d{2}\.\d{4}$/;
const EIN_FORMAT = /^\d{2}-\d{7}(\d{2})?$/;
const SSN_FORMAT = /^\d{3}-\d{2}-\d{4}$/;
const CBP_ASSIGNED_FORMAT = /^[A-Z]{2}\d{9,11}$/;
const PORT_CODE_FORMAT = /^\d{4}$/;

function isValidImporterNumber(value: string): boolean {
  return EIN_FORMAT.test(value) || SSN_FORMAT.test(value) || CBP_ASSIGNED_FORMAT.test(value);
}

function toTime(value: Date | string | null): number | null {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function declaredLines(draft: EntrySummaryDraft): EntrySummaryLine[] {
  return draft.lines.filter((l) => l.parentLineNumber == null);
}

function finding(
  code: string,
  severity: Severity,
  blocks: RuleFinding["blocks"],
  message: string,
  anchor: string,
  lineNumber?: number
): RuleFinding {
  return { code, severity, blocks, message, remediation: { label: "Fix on the shipment workspace", anchor }, ...(lineNumber != null ? { lineNumber } : {}) };
}

function rule(code: string, severity: Severity, blocks: RuleFinding["blocks"], title: string, evaluate: Rule<Rules7501Context>["evaluate"], cite?: string): Rule<Rules7501Context> {
  return { code, severity, blocks, title, cite, evaluate };
}

// ---------------------------------------------------------------------------
// Structural / presence (BLOCKING)
// ---------------------------------------------------------------------------

const B01_FILER_CODE_MISSING = rule(
  "E7501.B01.FILER_CODE_MISSING",
  "BLOCKING",
  ["B01_FILER_ENTRY_NUMBER"],
  "Filer code present",
  (draft) => {
    const field = draft.header.fields.B01_FILER_ENTRY_NUMBER;
    if (field.value != null) return null;
    return [finding("E7501.B01.FILER_CODE_MISSING", "BLOCKING", ["B01_FILER_ENTRY_NUMBER"], "No filer code is configured on the filer profile.", "#filer-profile")];
  }
);

const B02_ENTRY_TYPE_INVALID = rule(
  "E7501.B02.ENTRY_TYPE_INVALID",
  "BLOCKING",
  ["B02_ENTRY_TYPE"],
  "Entry type resolves to a known CBP entry type code",
  (draft) => {
    const field = draft.header.fields.B02_ENTRY_TYPE;
    const code = normalizeEntryType(field.value);
    if (code) return null;
    return [
      finding(
        "E7501.B02.ENTRY_TYPE_INVALID",
        "BLOCKING",
        ["B02_ENTRY_TYPE"],
        field.value == null ? "No entry type is recorded." : `Entry type "${field.value}" is not a known CBP entry type code.`,
        "#overview"
      ),
    ];
  }
);

const B06_PORT_MISSING = rule("E7501.B06.PORT_MISSING", "BLOCKING", ["B06_PORT_CODE"], "Port code present", (draft) => {
  if (draft.header.fields.B06_PORT_CODE.value != null) return null;
  return [finding("E7501.B06.PORT_MISSING", "BLOCKING", ["B06_PORT_CODE"], "No port of entry is recorded.", "#overview")];
});

const B06_PORT_FORMAT = rule("E7501.B06.PORT_FORMAT", "BLOCKING", ["B06_PORT_CODE"], "Port code is 4 digits", (draft) => {
  const value = draft.header.fields.B06_PORT_CODE.value;
  if (value == null || PORT_CODE_FORMAT.test(value)) return null;
  return [finding("E7501.B06.PORT_FORMAT", "BLOCKING", ["B06_PORT_CODE"], `Port code "${value}" is not 4 digits.`, "#overview")];
});

const B23_IMPORTER_NUMBER_MISSING = rule("E7501.B23.IMPORTER_NUMBER_MISSING", "BLOCKING", ["B23_IMPORTER_NUMBER"], "Importer number present", (draft) => {
  if (draft.header.fields.B23_IMPORTER_NUMBER.value != null) return null;
  return [finding("E7501.B23.IMPORTER_NUMBER_MISSING", "BLOCKING", ["B23_IMPORTER_NUMBER"], "No importer number is recorded.", "#overview")];
});

const B23_IMPORTER_NUMBER_FORMAT = rule("E7501.B23.IMPORTER_NUMBER_FORMAT", "BLOCKING", ["B23_IMPORTER_NUMBER"], "Importer number matches EIN, SSN, or CBP-assigned format", (draft) => {
  const value = draft.header.fields.B23_IMPORTER_NUMBER.value;
  if (value == null || isValidImporterNumber(value)) return null;
  return [finding("E7501.B23.IMPORTER_NUMBER_FORMAT", "BLOCKING", ["B23_IMPORTER_NUMBER"], `Importer number "${value}" matches none of EIN (NN-NNNNNNN[NN]), SSN (NNN-NN-NNNN), or CBP-assigned (AA followed by 9-11 digits) format.`, "#overview")];
});

const B04_BOND_MISSING = rule("E7501.B04.BOND_MISSING", "BLOCKING", ["B04_SURETY_NUMBER"], "Bond linked when the entry type requires one", (draft, ctx) => {
  if (!ctx.bondRequired || ctx.bond) return null;
  return [finding("E7501.B04.BOND_MISSING", "BLOCKING", ["B04_SURETY_NUMBER"], "This entry type requires a bond and none is linked.", "#overview")];
});

const BOND_EXPIRED = rule("E7501.BOND.EXPIRED", "BLOCKING", ["B04_SURETY_NUMBER", "B05_BOND_TYPE"], "Linked bond is usable and not expired as of the entry date", (draft, ctx) => {
  if (!ctx.bond) return null;
  const entryTime = toTime(ctx.entryDate);
  const bondExpiry = toTime(ctx.bond.expirationDate);
  const expiredByDate = entryTime != null && bondExpiry != null && bondExpiry < entryTime;
  const badStatus = !BOND_USABLE_STATUSES.has(ctx.bond.status);
  if (!expiredByDate && !badStatus) return null;
  const detail = expiredByDate
    ? `Bond expires ${ctx.bond.expirationDate ? new Date(ctx.bond.expirationDate).toISOString() : "unknown"}, before the entry date.`
    : `Bond status is "${ctx.bond.status}", not one of: ${[...BOND_USABLE_STATUSES].join(", ")}.`;
  return [finding("E7501.BOND.EXPIRED", "BLOCKING", ["B04_SURETY_NUMBER", "B05_BOND_TYPE"], detail, "#overview")];
});

const POA_NOT_ACTIVE = rule("E7501.POA.NOT_ACTIVE", "BLOCKING", ["B26_IMPORTER_OF_RECORD_NAME"], "An active Power of Attorney is on file for the importer of record", (draft, ctx) => {
  const poa = ctx.powerOfAttorney;
  const entryTime = toTime(ctx.entryDate);
  const active =
    poa != null &&
    poa.status === "executed" &&
    poa.revokedAt == null &&
    (poa.expirationDate == null || (entryTime != null && (toTime(poa.expirationDate) as number) >= entryTime));
  if (active) return null;
  return [
    finding(
      "E7501.POA.NOT_ACTIVE",
      "BLOCKING",
      ["B26_IMPORTER_OF_RECORD_NAME"],
      poa ? `Power of Attorney status is "${poa.status}", not an active grant as of the entry date.` : "No Power of Attorney is on file for the importer of record.",
      "#overview"
    ),
  ];
});

const B27_NO_LINES = rule("E7501.B27.NO_LINES", "BLOCKING", ["B27_LINE_NUMBER"], "At least one declared line item", (draft) => {
  if (declaredLines(draft).length > 0) return null;
  return [finding("E7501.B27.NO_LINES", "BLOCKING", ["B27_LINE_NUMBER"], "This entry has 0 declared line items.", "#line-items")];
});

const B29_HTS_MISSING = rule("E7501.B29.HTS_MISSING", "BLOCKING", ["B29A_HTSUS_NUMBER"], "Every line has an HTS number", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B29A_HTSUS_NUMBER.value == null)
    .map((l) => finding("E7501.B29.HTS_MISSING", "BLOCKING", ["B29A_HTSUS_NUMBER"], `Line ${l.lineNumber} has no HTS number.`, `#line-${l.lineNumber}-hts`, l.lineNumber))
);

const B29_HTS_FORMAT = rule("E7501.B29.HTS_FORMAT", "BLOCKING", ["B29A_HTSUS_NUMBER"], "Every line's HTS number is formatted NNNN.NN.NNNN", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B29A_HTSUS_NUMBER.value != null && !HTS_FORMAT.test(l.fields.B29A_HTSUS_NUMBER.value as string))
    .map((l) => finding("E7501.B29.HTS_FORMAT", "BLOCKING", ["B29A_HTSUS_NUMBER"], `Line ${l.lineNumber} HTS number "${l.fields.B29A_HTSUS_NUMBER.value}" is not formatted NNNN.NN.NNNN.`, `#line-${l.lineNumber}-hts`, l.lineNumber))
);

const B10_ORIGIN_MISSING = rule("E7501.B10.ORIGIN_MISSING", "BLOCKING", ["B10_COUNTRY_OF_ORIGIN"], "Every line has a country of origin", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B10_COUNTRY_OF_ORIGIN.value == null)
    .map((l) => finding("E7501.B10.ORIGIN_MISSING", "BLOCKING", ["B10_COUNTRY_OF_ORIGIN"], `Line ${l.lineNumber} names no country of origin.`, `#line-${l.lineNumber}-origin`, l.lineNumber))
);

const B10_ORIGIN_NOT_ISO = rule("E7501.B10.ORIGIN_NOT_ISO", "BLOCKING", ["B10_COUNTRY_OF_ORIGIN"], "Every line's country of origin is a valid ISO 3166-1 alpha-2 code", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B10_COUNTRY_OF_ORIGIN.value != null && !isKnownCountryCode(l.fields.B10_COUNTRY_OF_ORIGIN.value))
    .map((l) => finding("E7501.B10.ORIGIN_NOT_ISO", "BLOCKING", ["B10_COUNTRY_OF_ORIGIN"], `Line ${l.lineNumber} country of origin "${l.fields.B10_COUNTRY_OF_ORIGIN.value}" is not a known ISO 3166-1 alpha-2 code.`, `#line-${l.lineNumber}-origin`, l.lineNumber))
);

const B32_VALUE_NONPOSITIVE = rule("E7501.B32.VALUE_NONPOSITIVE", "BLOCKING", ["B32A_ENTERED_VALUE"], "Every line's entered value is positive", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B32A_ENTERED_VALUE.value != null && !l.fields.B32A_ENTERED_VALUE.value.gt(0))
    .map((l) => finding("E7501.B32.VALUE_NONPOSITIVE", "BLOCKING", ["B32A_ENTERED_VALUE"], `Line ${l.lineNumber} entered value ${l.fields.B32A_ENTERED_VALUE.value?.toString()} is not positive.`, `#line-${l.lineNumber}-value`, l.lineNumber))
);

const B31_QTY_MISSING = rule("E7501.B31.QTY_MISSING", "BLOCKING", ["B31_NET_QUANTITY"], "Every line has a net quantity", (draft) =>
  declaredLines(draft)
    .filter((l) => l.fields.B31_NET_QUANTITY.value == null || l.fields.B31_NET_QUANTITY.value.lte(0))
    .map((l) => finding("E7501.B31.QTY_MISSING", "BLOCKING", ["B31_NET_QUANTITY"], `Line ${l.lineNumber} has no net quantity.`, `#line-${l.lineNumber}-qty`, l.lineNumber))
);

// ---------------------------------------------------------------------------
// Arithmetic (BLOCKING)
// ---------------------------------------------------------------------------

const TOTALS_LINE_SUM_MISMATCH = rule("E7501.TOTALS.LINE_SUM_MISMATCH", "BLOCKING", ["B35_TOTAL_ENTERED_VALUE"], "B35 equals the sum of line B32A values", (draft) => {
  const b35 = draft.header.fields.B35_TOTAL_ENTERED_VALUE.value;
  if (b35 == null) return null;
  const lines = declaredLines(draft);
  if (lines.some((l) => l.fields.B32A_ENTERED_VALUE.value == null)) return null; // covered by VALUE/presence rules
  const sum = lines.reduce((acc, l) => acc.plus(l.fields.B32A_ENTERED_VALUE.value as Decimal), new Decimal(0));
  if (sum.equals(b35)) return null;
  return [finding("E7501.TOTALS.LINE_SUM_MISMATCH", "BLOCKING", ["B35_TOTAL_ENTERED_VALUE"], `B35 (${b35.toString()}) does not equal the sum of line entered values (${sum.toString()}).`, "#totals")];
});

const TOTALS_GRAND_TOTAL_MISMATCH = rule("E7501.TOTALS.GRAND_TOTAL_MISMATCH", "BLOCKING", ["B40_TOTAL"], "B40 equals B37 + B38 + sum(B39)", (draft) => {
  const { B37_TOTAL_DUTY, B38_TOTAL_TAX, B39_TOTAL_OTHER_FEES, B40_TOTAL } = draft.header.fields;
  if (B37_TOTAL_DUTY.value == null || B38_TOTAL_TAX.value == null || B39_TOTAL_OTHER_FEES.value == null || B40_TOTAL.value == null) return null;
  const feeSum = B39_TOTAL_OTHER_FEES.value.reduce((acc, fee) => acc.plus(fee.amount), new Decimal(0));
  const expected = B37_TOTAL_DUTY.value.plus(B38_TOTAL_TAX.value).plus(feeSum);
  if (expected.equals(B40_TOTAL.value)) return null;
  return [finding("E7501.TOTALS.GRAND_TOTAL_MISMATCH", "BLOCKING", ["B40_TOTAL"], `B40 (${B40_TOTAL.value.toString()}) does not equal B37 + B38 + sum(B39) (${expected.toString()}).`, "#totals")];
});

// ---------------------------------------------------------------------------
// Cross-field (BLOCKING)
// ---------------------------------------------------------------------------

const B09_MODE_TRANSPORT_INVALID = rule("E7501.B09.MODE_TRANSPORT_INVALID", "BLOCKING", ["B09_MODE_OF_TRANSPORT"], "Mode of transport is a known CBP mode code", (draft) => {
  const value = draft.header.fields.B09_MODE_OF_TRANSPORT.value;
  if (value == null) return null; // absence is a separate concern; this rule only checks known-ness of a present value
  if ((MODE_OF_TRANSPORT_CODES as readonly string[]).includes(value)) return null;
  return [finding("E7501.B09.MODE_TRANSPORT_INVALID", "BLOCKING", ["B09_MODE_OF_TRANSPORT"], `Mode of transport "${value}" is not one of: ${MODE_OF_TRANSPORT_CODES.join(", ")}.`, "#overview")];
});

const HMF_MODE_MISMATCH = rule("E7501.HMF.MODE_MISMATCH", "BLOCKING", ["B09_MODE_OF_TRANSPORT", "B39_TOTAL_OTHER_FEES"], "HMF is present iff mode of transport is ocean", (draft) => {
  const mode = draft.header.fields.B09_MODE_OF_TRANSPORT.value;
  const fees = draft.header.fields.B39_TOTAL_OTHER_FEES.value;
  if (mode == null || fees == null) return null;
  const isOcean = mode.toLowerCase() === "ocean" || mode.toLowerCase() === "vessel";
  const hasHmf = fees.some((f) => f.code === "HMF");
  if (isOcean === hasHmf) return null;
  return [
    finding(
      "E7501.HMF.MODE_MISMATCH",
      "BLOCKING",
      ["B09_MODE_OF_TRANSPORT", "B39_TOTAL_OTHER_FEES"],
      isOcean ? `Mode of transport is "${mode}" but no HMF entry is present.` : `Mode of transport is "${mode}" but an HMF entry is present.`,
      "#totals"
    ),
  ];
});

const B14_EXPORT_COUNTRY_MISSING = rule("E7501.B14.EXPORT_COUNTRY_MISSING", "BLOCKING", ["B14_EXPORTING_COUNTRY"], "Exporting country present", (draft) => {
  if (draft.header.fields.B14_EXPORTING_COUNTRY.value != null) return null;
  return [finding("E7501.B14.EXPORT_COUNTRY_MISSING", "BLOCKING", ["B14_EXPORTING_COUNTRY"], "No exporting country is recorded.", "#overview")];
});

const B11_IMPORT_DATE_AFTER_SUMMARY_DATE = rule("E7501.B11.IMPORT_DATE_AFTER_SUMMARY_DATE", "BLOCKING", ["B11_IMPORT_DATE", "B03_SUMMARY_DATE"], "Import date is not after the summary date", (draft) => {
  const importDate = toTime(draft.header.fields.B11_IMPORT_DATE.value);
  const summaryDate = toTime(draft.header.fields.B03_SUMMARY_DATE.value);
  if (importDate == null || summaryDate == null || importDate <= summaryDate) return null;
  return [finding("E7501.B11.IMPORT_DATE_AFTER_SUMMARY_DATE", "BLOCKING", ["B11_IMPORT_DATE", "B03_SUMMARY_DATE"], `Import date (${draft.header.fields.B11_IMPORT_DATE.value}) is after the summary date (${draft.header.fields.B03_SUMMARY_DATE.value}).`, "#overview")];
});

// ---------------------------------------------------------------------------
// Coverage-closing additions (BLOCKING) — see file header for why these exist.
// ---------------------------------------------------------------------------

const B18_MISSING_DOCS = rule("E7501.B18.MISSING_DOCS", "BLOCKING", ["B18_MISSING_DOCS"], "A commercial invoice is on file", (draft, ctx) => {
  if (ctx.hasCommercialInvoice) return null;
  return [finding("E7501.B18.MISSING_DOCS", "BLOCKING", ["B18_MISSING_DOCS"], "No commercial invoice has been received for this shipment.", "#documents")];
});

const B26_IMPORTER_OF_RECORD_MISSING = rule("E7501.B26.IMPORTER_OF_RECORD_MISSING", "BLOCKING", ["B26_IMPORTER_OF_RECORD_NAME"], "An importer of record is named", (draft) => {
  if (draft.header.fields.B26_IMPORTER_OF_RECORD_NAME.value != null) return null;
  return [finding("E7501.B26.IMPORTER_OF_RECORD_MISSING", "BLOCKING", ["B26_IMPORTER_OF_RECORD_NAME"], "No importer of record is linked to this shipment.", "#overview")];
});

const EXCEPTIONS_OPEN_BLOCKING = rule("E7501.EXCEPTIONS.OPEN_BLOCKING", "BLOCKING", ["B27_LINE_NUMBER"], "No open blocking exceptions", (draft, ctx) => {
  if (ctx.openBlockingExceptionsCount === 0) return null;
  return [finding("E7501.EXCEPTIONS.OPEN_BLOCKING", "BLOCKING", ["B27_LINE_NUMBER"], `${ctx.openBlockingExceptionsCount} open blocking exception(s) on this shipment.`, "#exceptions")];
});

const RECONCILIATION_CRITICAL_OPEN = rule("E7501.RECONCILIATION.CRITICAL_OPEN", "BLOCKING", ["B27_LINE_NUMBER"], "No open critical reconciliation issues", (draft, ctx) => {
  if (!ctx.criticalReconciliationOpen) return null;
  return [finding("E7501.RECONCILIATION.CRITICAL_OPEN", "BLOCKING", ["B27_LINE_NUMBER"], "A critical reconciliation issue is still open on this shipment.", "#exceptions")];
});

const IMPORTER_NOT_ONBOARDED = rule("E7501.IMPORTER.NOT_ONBOARDED", "BLOCKING", ["B26_IMPORTER_OF_RECORD_NAME"], "Importer onboarding is complete", (draft, ctx) => {
  if (ctx.importerOnboardingStatus === "active") return null;
  return [finding("E7501.IMPORTER.NOT_ONBOARDED", "BLOCKING", ["B26_IMPORTER_OF_RECORD_NAME"], `Importer onboarding status is "${ctx.importerOnboardingStatus ?? "unknown"}", not "active".`, "/app/onboarding")];
});

// ---------------------------------------------------------------------------
// Advisory (WARNING)
// ---------------------------------------------------------------------------

const BLOCKING_ADJACENT_HEADER_BLOCKS: readonly HeaderBlockId[] = ["B06_PORT_CODE", "B23_IMPORTER_NUMBER", "B04_SURETY_NUMBER"];

const W_B29_LOW_CONFIDENCE = rule("W7501.B29.LOW_CONFIDENCE", "WARNING", ["B29A_HTSUS_NUMBER"], "Line HTS confidence is at least 85 or has been human-approved", (draft) =>
  declaredLines(draft)
    .filter((l) => {
      const f = l.fields.B29A_HTSUS_NUMBER;
      return (f.provenance.source === "DOCUMENT" || f.provenance.source === "AGENT") && (f.provenance.confidence ?? 100) < 85;
    })
    .map((l) => finding("W7501.B29.LOW_CONFIDENCE", "WARNING", ["B29A_HTSUS_NUMBER"], `Line ${l.lineNumber} HTS confidence is ${l.fields.B29A_HTSUS_NUMBER.provenance.confidence}, below 85, and has not been approved.`, `#line-${l.lineNumber}-hts`, l.lineNumber))
);

const W_PROVENANCE_UNVERIFIED = rule("W7501.PROVENANCE.UNVERIFIED", "WARNING", ["B06_PORT_CODE", "B23_IMPORTER_NUMBER", "B04_SURETY_NUMBER"], "Blocking-adjacent header fields are human-confirmed, not document-only", (draft) => {
  const findings: RuleFinding[] = [];
  for (const blockId of BLOCKING_ADJACENT_HEADER_BLOCKS) {
    const field = draft.header.fields[blockId];
    if (field.provenance.source === "DOCUMENT") {
      findings.push(finding("W7501.PROVENANCE.UNVERIFIED", "WARNING", [blockId], `${blockId} is sourced from a document only and has not been human-confirmed.`, "#overview"));
    }
  }
  return findings;
});

const W_B13_MID_MISSING = rule("W7501.B13.MID_MISSING", "WARNING", ["B13_MANUFACTURER_ID"], "Manufacturer ID present", (draft) => {
  if (draft.header.fields.B13_MANUFACTURER_ID.value != null) return null;
  return [finding("W7501.B13.MID_MISSING", "WARNING", ["B13_MANUFACTURER_ID"], "No manufacturer ID is recorded.", "#overview")];
});

const W_PGA_FLAG_UNRESOLVED = rule("W7501.PGA.FLAG_UNRESOLVED", "WARNING", ["B27_LINE_NUMBER"], "No open PGA requirement on any line", (draft, ctx) =>
  ctx.pgaRequirements
    .filter((pga) => !pga.resolved)
    .map((pga) => finding("W7501.PGA.FLAG_UNRESOLVED", "WARNING", ["B27_LINE_NUMBER"], `Line ${pga.lineNumber} has an unresolved PGA requirement.`, `#line-${pga.lineNumber}-pga`, pga.lineNumber))
);

const W_EXCEPTIONS_OPEN_BLOCKING = rule("W7501.EXCEPTIONS.OPEN_BLOCKING", "WARNING", ["B27_LINE_NUMBER"], "No open blocking exceptions (advisory)", (draft, ctx) => {
  if (ctx.openBlockingExceptionsCount === 0) return null;
  return [finding("W7501.EXCEPTIONS.OPEN_BLOCKING", "WARNING", ["B27_LINE_NUMBER"], `${ctx.openBlockingExceptionsCount} open blocking exception(s) on this shipment.`, "#exceptions")];
});

export const RULES_7501: Array<Rule<Rules7501Context>> = [
  B01_FILER_CODE_MISSING,
  B02_ENTRY_TYPE_INVALID,
  B06_PORT_MISSING,
  B06_PORT_FORMAT,
  B23_IMPORTER_NUMBER_MISSING,
  B23_IMPORTER_NUMBER_FORMAT,
  B04_BOND_MISSING,
  BOND_EXPIRED,
  POA_NOT_ACTIVE,
  B27_NO_LINES,
  B29_HTS_MISSING,
  B29_HTS_FORMAT,
  B10_ORIGIN_MISSING,
  B10_ORIGIN_NOT_ISO,
  B32_VALUE_NONPOSITIVE,
  B31_QTY_MISSING,
  TOTALS_LINE_SUM_MISMATCH,
  TOTALS_GRAND_TOTAL_MISMATCH,
  B09_MODE_TRANSPORT_INVALID,
  HMF_MODE_MISMATCH,
  B14_EXPORT_COUNTRY_MISSING,
  B11_IMPORT_DATE_AFTER_SUMMARY_DATE,
  B18_MISSING_DOCS,
  B26_IMPORTER_OF_RECORD_MISSING,
  EXCEPTIONS_OPEN_BLOCKING,
  RECONCILIATION_CRITICAL_OPEN,
  IMPORTER_NOT_ONBOARDED,
  W_B29_LOW_CONFIDENCE,
  W_PROVENANCE_UNVERIFIED,
  W_B13_MID_MISSING,
  W_PGA_FLAG_UNRESOLVED,
  W_EXCEPTIONS_OPEN_BLOCKING,
];

export const RULE_7501_CODES: string[] = RULES_7501.map((r) => r.code);

/** Every FilingBlockerCode must map to at least one E7501.* (BLOCKING) rule code — asserted in tests. */
export const FILING_BLOCKER_TO_7501_RULES: Record<FilingBlockerCode, string[]> = {
  NO_LINE_ITEMS: ["E7501.B27.NO_LINES"],
  MISSING_HTS_CLASSIFICATION: ["E7501.B29.HTS_MISSING"],
  MISSING_COUNTRY_OF_ORIGIN: ["E7501.B10.ORIGIN_MISSING"],
  MISSING_COMMERCIAL_INVOICE: ["E7501.B18.MISSING_DOCS"],
  MISSING_IMPORTER_OF_RECORD: ["E7501.B26.IMPORTER_OF_RECORD_MISSING"],
  MISSING_ENTRY_TYPE: ["E7501.B02.ENTRY_TYPE_INVALID"],
  BLOCKING_EXCEPTIONS: ["E7501.EXCEPTIONS.OPEN_BLOCKING"],
  CRITICAL_RECONCILIATION: ["E7501.RECONCILIATION.CRITICAL_OPEN"],
  IMPORTER_NOT_ONBOARDED: ["E7501.IMPORTER.NOT_ONBOARDED"],
};

import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";
import type { CustomsResponseRecordData } from "@/lib/abi/entrySummary/interpretResponse";
import type {
  ParsedCargoReleaseResponse,
  ParsedCargoReleaseHeaderGroup,
  OutputDispositionInput,
  CargoReleaseResponseScenario,
} from "./types";

export type { CustomsResponseRecordData };

export interface InterpretedCargoReleaseError {
  rawError: OutputDispositionInput;
  lookupCode: string;
  matchedErrors: ErrorDictionaryEntry[];
  title: string;
  description: string;
}

export interface InterpretedCargoReleaseHeaderGroup {
  rawGroup: ParsedCargoReleaseHeaderGroup;
  scenario: CargoReleaseResponseScenario;
  entryFilerCode: string;
  entryNumber: string;
  disposition?: OutputDispositionInput;
  enrichedHeaderErrors: InterpretedCargoReleaseError[];
  enrichedBillErrors: InterpretedCargoReleaseError[];
  enrichedEntityErrors: InterpretedCargoReleaseError[];
  enrichedLineErrors: InterpretedCargoReleaseError[];
  allEnrichedErrors: InterpretedCargoReleaseError[];
}

export interface InterpretedCargoReleaseResponse {
  scenario: CargoReleaseResponseScenario;
  groups: InterpretedCargoReleaseHeaderGroup[];
  customsResponseRecords: CustomsResponseRecordData[];
  unrecognizedLines: string[];
}

export interface InterpretCargoReleaseResponseOptions {
  accountId?: string;
  /** Map of `${entryFilerCode}-${entryNumber}` or `${entryNumber}` to Prisma `filingId`. */
  filingIdMap?: Record<string, string>;
  defaultFilingId?: string;
}

/**
 * Enriches a single SE90 error / disposition record against the ACE Error Dictionary.
 */
export function enrichCargoReleaseSe90Error(
  se90: OutputDispositionInput
): InterpretedCargoReleaseError {
  const code = (se90.messageIdentifierCode || "").trim();
  const matchedErrors = code ? getAllAbiErrors(code) : [];

  let title: string;
  let description: string;

  if (matchedErrors.length > 0) {
    title = se90.narrativeMessageText.trim() || matchedErrors[0].narrativeText;

    if (matchedErrors.length === 1) {
      description = matchedErrors[0].explanation;
    } else {
      description = matchedErrors
        .map(
          (err, i) =>
            `[Match ${i + 1} - ${err.narrativeText}]: ${err.explanation}`
        )
        .join("\n\n");
    }
  } else {
    title = se90.narrativeMessageText.trim() || (code ? `CBP Code ${code}` : "Cargo Release Error");
    description = se90.narrativeMessageText.trim()
      ? `CBP returned error code "${code}": ${se90.narrativeMessageText.trim()}`
      : `CBP returned error code "${code}" with no additional explanation.`;
  }

  return {
    rawError: se90,
    lookupCode: code,
    matchedErrors,
    title,
    description,
  };
}

/**
 * Enriches and interprets a ParsedCargoReleaseResponse (supporting single or multi-group responses),
 * mapping error dictionary entries and attributing records to Prisma filing IDs via filingIdMap.
 */
export function interpretCargoReleaseResponse(
  parsed: ParsedCargoReleaseResponse,
  options: InterpretCargoReleaseResponseOptions = {}
): InterpretedCargoReleaseResponse {
  const accountId = options.accountId ?? "default-account";
  const defaultFilingId = options.defaultFilingId ?? "cargo-release-response-filing";
  const filingIdMap = options.filingIdMap ?? {};

  const groups: InterpretedCargoReleaseHeaderGroup[] = [];
  const customsResponseRecords: CustomsResponseRecordData[] = [];

  for (const group of parsed.headerGroups) {
    const entryFilerCode = group.header.record.entryFilerCode;
    const entryNumber = group.header.record.entryNumber;
    const entryKey = `${entryFilerCode}-${entryNumber}`;
    const filingId = filingIdMap[entryKey] || filingIdMap[entryNumber] || defaultFilingId;

    // Header & additional header errors
    const headerErrs: OutputDispositionInput[] = [
      ...group.header.errors,
      ...(group.additionalHeader?.errors ?? []),
      ...(group.contactCancellation?.errors ?? []),
    ];
    const enrichedHeaderErrors = headerErrs.map(enrichCargoReleaseSe90Error);

    // Bill errors
    const billErrs: OutputDispositionInput[] = [];
    for (const b of group.bills) {
      billErrs.push(...b.bill.errors);
      for (const c of b.conveyances) billErrs.push(...c.errors);
      for (const e of b.equipment) billErrs.push(...e.errors);
    }
    const enrichedBillErrors = billErrs.map(enrichCargoReleaseSe90Error);

    // Entity errors
    const entityErrs: OutputDispositionInput[] = [];
    for (const e of group.headerEntities) {
      entityErrs.push(...e.entity.errors);
      for (const g of e.gbiIdentifiers) entityErrs.push(...g.errors);
      for (const a of e.streetAddresses) entityErrs.push(...a.errors);
      if (e.geographicArea?.errors.length) entityErrs.push(...e.geographicArea.errors);
    }
    const enrichedEntityErrors = entityErrs.map(enrichCargoReleaseSe90Error);

    // Line errors
    const lineErrs: OutputDispositionInput[] = [];
    for (const l of group.lines) {
      lineErrs.push(...l.lineItem.errors);
      if (l.ftzStatus?.errors.length) lineErrs.push(...l.ftzStatus.errors);
      for (const le of l.entities) {
        lineErrs.push(...le.entity.errors);
        for (const g of le.gbiIdentifiers) lineErrs.push(...g.errors);
        for (const a of le.streetAddresses) lineErrs.push(...a.errors);
        if (le.geographicArea?.errors.length) lineErrs.push(...le.geographicArea.errors);
      }
      for (const h of l.htsLines) {
        lineErrs.push(...h.htsLine.errors);
        if (h.ftzPfHts?.errors.length) lineErrs.push(...h.ftzPfHts.errors);
      }
    }
    const enrichedLineErrors = lineErrs.map(enrichCargoReleaseSe90Error);

    const allEnrichedErrors = [
      ...enrichedHeaderErrors,
      ...enrichedBillErrors,
      ...enrichedEntityErrors,
      ...enrichedLineErrors,
    ];

    // Build CustomsResponseRecordData[] for this header group
    for (const err of allEnrichedErrors) {
      const status = group.scenario === "REJECTED" ? "REJECTED" : "WARNING";
      customsResponseRecords.push({
        accountId,
        filingId,
        code: err.lookupCode || "SE90",
        title: err.title,
        description: err.description,
        status,
      });
    }

    // Add top-level group disposition record
    const dispCode = group.disposition?.messageIdentifierCode || group.disposition?.messageTypeCode || "SE90";
    const dispTitle = group.disposition?.narrativeMessageText
      ? `Cargo Release Disposition: ${group.disposition.narrativeMessageText}`
      : `Cargo Release Transaction (${entryKey}): ${group.scenario}`;

    customsResponseRecords.push({
      accountId,
      filingId,
      code: dispCode,
      title: dispTitle,
      description: `Transaction for entry ${entryKey} finished with scenario ${group.scenario}.`,
      status: group.scenario,
    });

    groups.push({
      rawGroup: group,
      scenario: group.scenario,
      entryFilerCode,
      entryNumber,
      disposition: group.disposition,
      enrichedHeaderErrors,
      enrichedBillErrors,
      enrichedEntityErrors,
      enrichedLineErrors,
      allEnrichedErrors,
    });
  }

  return {
    scenario: parsed.scenario,
    groups,
    customsResponseRecords,
    unrecognizedLines: parsed.unrecognizedLines,
  };
}

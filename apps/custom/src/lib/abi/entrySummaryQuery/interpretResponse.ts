import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";
import type { QueryReturnedCondition, BondSuretyInfo } from "./types";
import type { ParsedQueryResponse, EntrySummaryQueryResult } from "./parse";
import type { CustomsResponseRecordData } from "@/lib/abi/entrySummary/interpretResponse";

export type { CustomsResponseRecordData };

export interface InterpretedQueryReturnedCondition {
  /** The original QueryReturnedCondition record (JZ). */
  rawCondition: QueryReturnedCondition;
  /** Code looked up in the ACE Error Dictionary. */
  lookupCode: string;
  /** All matching entries from the ACE Error Dictionary. */
  matchedErrors: ErrorDictionaryEntry[];
  /** Primary title derived from narrative text or dictionary. */
  title: string;
  /** Human-readable explanation. */
  description: string;
}

export interface StructuredLiquidationSummary {
  statusCode?: string; // 1=Unliquidated, 2=Liquidated, 3=Reliquidated
  liquidationDate?: Date;
  cbpReviewIndicator?: string;
  reasonCodes: string[];
  liquidatedDuty?: string;
  liquidatedTax?: string;
  liquidatedFees?: string;
  liquidatedInterest?: string;
  liquidatedAdCvd?: string;
}

export interface StructuredEstimatedRevenueSummary {
  estimatedDuty?: string;
  estimatedTax?: string;
  estimatedFees?: string;
  estimatedInterest?: string;
  estimatedAdCvd?: string;
}

export interface StructuredFilingSummary {
  importerOfRecordNumber?: string;
  entryTypeCode?: string;
  districtPortOfEntry: string;
  entrySummaryFilingDate?: Date;
}

export interface EntrySummaryQueryStatusSummary {
  entryFilerCode: string;
  entryNumber: string;
  versionNumber: string;
  acceptDateTime?: Date;
  centerId: string;

  // Status Details (JC-Record)
  entrySummaryControlStatus: string;
  entrySummaryStatusCode: string;
  entrySummaryStatusDate?: Date;
  releaseStatusCode?: string;
  releaseDate?: Date;
  collectionStatusCode: string;
  collectionDate?: Date;

  // Liquidation Info (JD-Record)
  liquidation?: StructuredLiquidationSummary;

  // Estimated Revenue Info (JE-Record)
  estimatedRevenue?: StructuredEstimatedRevenueSummary;

  // Filing Info (JF-Record)
  filing?: StructuredFilingSummary;

  // Bond & Surety Info (JI-Records)
  bonds: BondSuretyInfo[];

  // Deferred Counts
  billsCount: number;
  collectionsCount: number;
  suretyBillsCount: number;

  // Detail Grouping Indicator
  hasDetailsGrouping: boolean;
}

export interface InterpretedQueryResponse {
  /** Enriched JZ condition records. */
  conditions: InterpretedQueryReturnedCondition[];

  /** Rich structured status / liquidation / bond details for each entry summary returned in query. */
  summaries: EntrySummaryQueryStatusSummary[];

  /** Flat CustomsResponseRecordData[] array ready for Prisma insertion into CustomsResponse table. */
  customsResponseRecords: CustomsResponseRecordData[];
}

export interface InterpretQueryResponseOptions {
  accountId?: string;
  /** Map of `${entryFilerCode}-${entryNumber}` or `${entryNumber}` to Prisma `filingId`. */
  filingIdMap?: Record<string, string>;
  /** Default filingId to use if filingIdMap doesn't contain a match. */
  defaultFilingId?: string;
}

/**
 * Enriches a single QueryReturnedCondition (JZ-Record) against the ACE Error Dictionary.
 */
export function enrichQueryReturnedCondition(
  condition: QueryReturnedCondition
): InterpretedQueryReturnedCondition {
  const code = (condition.conditionCode || condition.reasonCode || "").trim();
  const matchedErrors = code ? getAllAbiErrors(code) : [];

  let title: string;
  let description: string;

  if (matchedErrors.length > 0) {
    title = condition.narrativeText.trim() || matchedErrors[0].narrativeText;

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
    title = condition.narrativeText.trim() || (code ? `CBP Code ${code}` : "CBP Condition");
    description = condition.narrativeText.trim()
      ? `CBP returned condition code "${code}": ${condition.narrativeText.trim()}`
      : `CBP returned condition code "${code}" with no additional explanation.`;
  }

  return {
    rawCondition: condition,
    lookupCode: code,
    matchedErrors,
    title,
    description,
  };
}

/**
 * Extracts a structured summary from a single EntrySummaryQueryResult (JB through JI).
 */
export function summarizeQueryResult(
  result: EntrySummaryQueryResult
): EntrySummaryQueryStatusSummary {
  const { status, detail, liquidation, estimatedRevenue, filing, bonds, bills, collections, suretyBills, detailsGrouping } = result;

  const reasonCodes = [
    liquidation.liquidationReasonCode1,
    liquidation.liquidationReasonCode2,
    liquidation.liquidationReasonCode3,
  ].filter((c): c is string => Boolean(c && c.trim() !== ""));

  const liquidationSummary: StructuredLiquidationSummary = {
    statusCode: status.liquidationStatusCode,
    liquidationDate: status.liquidationDate,
    cbpReviewIndicator: liquidation.cbpReviewIndicator,
    reasonCodes,
    liquidatedDuty: liquidation.liquidatedDuty?.toString(),
    liquidatedTax: liquidation.liquidatedTax?.toString(),
    liquidatedFees: liquidation.liquidatedFees?.toString(),
    liquidatedInterest: liquidation.liquidatedInterest?.toString(),
    liquidatedAdCvd: liquidation.liquidatedAdCvd?.toString(),
  };

  const estimatedRevenueSummary: StructuredEstimatedRevenueSummary = {
    estimatedDuty: estimatedRevenue.estimatedDuty?.toString(),
    estimatedTax: estimatedRevenue.estimatedTax?.toString(),
    estimatedFees: estimatedRevenue.estimatedFees?.toString(),
    estimatedInterest: estimatedRevenue.estimatedInterest?.toString(),
    estimatedAdCvd: estimatedRevenue.estimatedAdCvd?.toString(),
  };

  const filingSummary: StructuredFilingSummary = {
    importerOfRecordNumber: filing.importerOfRecordNumber,
    entryTypeCode: filing.entryTypeCode,
    districtPortOfEntry: filing.districtPortOfEntry,
    entrySummaryFilingDate: filing.entrySummaryFilingDate,
  };

  return {
    entryFilerCode: status.entryFilerCode,
    entryNumber: status.entryNumber,
    versionNumber: status.versionNumber,
    acceptDateTime: status.acceptDateTime,
    centerId: status.centerId,

    entrySummaryControlStatus: detail.entrySummaryControlStatus,
    entrySummaryStatusCode: detail.entrySummaryStatusCode,
    entrySummaryStatusDate: detail.entrySummaryStatusDate,
    releaseStatusCode: detail.releaseStatusCode,
    releaseDate: detail.releaseDate,
    collectionStatusCode: detail.collectionStatusCode,
    collectionDate: detail.collectionDate,

    liquidation: liquidationSummary,
    estimatedRevenue: estimatedRevenueSummary,
    filing: filingSummary,

    bonds,
    billsCount: bills.length,
    collectionsCount: collections.length,
    suretyBillsCount: suretyBills.length,
    hasDetailsGrouping: Boolean(detailsGrouping),
  };
}

/**
 * Interprets a ParsedQueryResponse into enriched conditions, structured summaries,
 * and CustomsResponseRecordData[] suitable for Prisma CustomsResponse insertion.
 */
export function interpretQueryResponse(
  parsed: ParsedQueryResponse,
  options: InterpretQueryResponseOptions = {}
): InterpretedQueryResponse {
  const accountId = options.accountId ?? "default-account";
  const defaultFilingId = options.defaultFilingId ?? "query-response-filing";
  const filingIdMap = options.filingIdMap ?? {};

  const conditions = parsed.conditions.map(enrichQueryReturnedCondition);
  const summaries = parsed.results.map(summarizeQueryResult);

  const customsResponseRecords: CustomsResponseRecordData[] = [];

  // 1. Condition records (JZ)
  for (const cond of conditions) {
    const entryKey = cond.rawCondition.entryFilerCode && cond.rawCondition.entryNumber
      ? `${cond.rawCondition.entryFilerCode}-${cond.rawCondition.entryNumber}`
      : cond.rawCondition.entryNumber ?? "";

    const filingId = filingIdMap[entryKey] || filingIdMap[cond.rawCondition.entryNumber ?? ""] || defaultFilingId;

    customsResponseRecords.push({
      accountId,
      filingId,
      code: cond.lookupCode || "JZ",
      title: cond.title,
      description: cond.description,
      status: "QUERY_CONDITION",
    });
  }

  // 2. Query Result summaries (JB-JH)
  for (const summary of summaries) {
    const entryKey = `${summary.entryFilerCode}-${summary.entryNumber}`;
    const filingId = filingIdMap[entryKey] || filingIdMap[summary.entryNumber] || defaultFilingId;

    let desc = `Entry Summary Status: Code ${summary.entrySummaryStatusCode} (Control: ${summary.entrySummaryControlStatus}). Port: ${summary.filing?.districtPortOfEntry ?? "N/A"}.`;
    if (summary.liquidation?.statusCode === "2" && summary.liquidation.liquidationDate) {
      desc += ` Liquidated on ${summary.liquidation.liquidationDate.toISOString().slice(0, 10)}.`;
      if (summary.liquidation.liquidatedDuty) {
        desc += ` Liquidated Duty: $${summary.liquidation.liquidatedDuty}.`;
      }
    } else if (summary.estimatedRevenue?.estimatedDuty) {
      desc += ` Estimated Duty: $${summary.estimatedRevenue.estimatedDuty}.`;
    }

    const isLiquidated = summary.liquidation?.statusCode === "2";
    const status = isLiquidated ? "LIQUIDATED" : "IN_PROCESS";

    customsResponseRecords.push({
      accountId,
      filingId,
      code: summary.entrySummaryStatusCode || "JC",
      title: `Entry Summary ${entryKey} Status (${summary.entrySummaryStatusCode})`,
      description: desc,
      status,
    });
  }

  return {
    conditions,
    summaries,
    customsResponseRecords,
  };
}

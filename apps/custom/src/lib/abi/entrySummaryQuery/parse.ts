import { decodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  CRITERIA_QUERY_RESPONSE_HEADER_SPEC,
  ENTRY_SUMMARY_STATUS_INFO_SPEC,
  QUERY_RETURNED_CONDITION_SPEC,
  ENTRY_SUMMARY_STATUS_DETAIL_SPEC,
  LIQUIDATION_INFO_SPEC,
  ESTIMATED_REVENUE_INFO_SPEC,
  ENTRY_SUMMARY_FILING_INFO_SPEC,
  WAREHOUSE_AND_LINE_INFO_SPEC,
  FORM_REFERENCE_INFO_SPEC,
  BOND_SURETY_INFO_SPEC,
  BILL_DETAIL_STATUS_INFO_SPEC,
  COLLECTION_DETAIL_STATUS_INFO_SPEC,
  COLLECTION_CLASS_CODE_DETAIL_INFO_SPEC,
  SURETY_BILL_DETAIL_STATUS_INFO_SPEC,
  CBP_LINE_NUMBER_SPEC,
  HEADER_CONTROL_SPEC,
  HEADER_CONTENT_SPEC,
  LINE_ITEM_HEADER_SPEC,
  TARIFF_DETAIL_SPEC,
  FEE_TOTAL_SPEC,
  GRAND_TOTALS_SPEC,
} from "./recordSpecs";
import type {
  CriteriaQueryResponseHeader,
  EntrySummaryStatusInfo,
  QueryReturnedCondition,
  EntrySummaryStatusDetail,
  LiquidationInfo,
  EstimatedRevenueInfo,
  EntrySummaryFilingInfo,
  WarehouseAndLineInfo,
  FormReferenceInfo,
  BondSuretyInfo,
  BillDetailStatusInfo,
  CollectionDetailStatusInfo,
  CollectionClassCodeDetailInfo,
  SuretyBillDetailStatusInfo,
  CbpLineNumberInfo,
  EntrySummaryDetailsGrouping,
} from "./types";
import type {
  HeaderControlInput,
  HeaderContentInput,
  FeeTotalInput,
  GrandTotalsInput,
} from "@/lib/abi/entrySummary/types";

export type EsqOutputLineType =
  | "JA" | "JB" | "JC" | "JD" | "JE" | "JF" | "JG" | "JH" | "JI"
  | "JK" | "JL" | "JM" | "JN" | "JZ"
  | "10" | "11" | "4A" | "40" | "50" | "89" | "90"
  | "UNKNOWN";

/**
 * "UNKNOWN" covers output JJ (Protest Data — deferred, see types.ts) plus any
 * of the Entry Summary Details Grouping's many other conditional detail
 * records (20-36, 41-47, OA/OI/FC01/FC02, 51-54, 60-63, CW02, ...) this slice
 * doesn't model.
 *
 * Note: CBP's own fallback messages for missing billing/collection data (e.g.
 * a bare "JK BILLING DATA NOT ON FILE" line when requested data doesn't
 * exist) still classify as their record's normal two-char type here, since
 * classification is position-only — `decodeRecord` will happily decode that
 * narrative text through the normal field layout rather than recognizing the
 * fallback shape. Not handled specially in this slice.
 */
export function classifyOutputLine(line: string): EsqOutputLineType {
  const two = line.slice(0, 2);
  if (
    ["JA", "JB", "JC", "JD", "JE", "JF", "JG", "JH", "JI", "JK", "JL", "JM", "JN", "JZ",
      "10", "11", "4A", "40", "50", "89", "90"].includes(two)
  ) {
    return two as EsqOutputLineType;
  }
  return "UNKNOWN";
}

export function parseCriteriaQueryResponseHeader(line: string): CriteriaQueryResponseHeader {
  return decodeRecord(CRITERIA_QUERY_RESPONSE_HEADER_SPEC, line);
}

export function parseEntrySummaryStatusInfo(line: string): EntrySummaryStatusInfo {
  return decodeRecord(ENTRY_SUMMARY_STATUS_INFO_SPEC, line);
}

export function parseQueryReturnedCondition(line: string): QueryReturnedCondition {
  return decodeRecord(QUERY_RETURNED_CONDITION_SPEC, line);
}

export function parseEntrySummaryStatusDetail(line: string): EntrySummaryStatusDetail {
  return decodeRecord(ENTRY_SUMMARY_STATUS_DETAIL_SPEC, line);
}

export function parseLiquidationInfo(line: string): LiquidationInfo {
  return decodeRecord(LIQUIDATION_INFO_SPEC, line);
}

export function parseEstimatedRevenueInfo(line: string): EstimatedRevenueInfo {
  return decodeRecord(ESTIMATED_REVENUE_INFO_SPEC, line);
}

export function parseEntrySummaryFilingInfo(line: string): EntrySummaryFilingInfo {
  return decodeRecord(ENTRY_SUMMARY_FILING_INFO_SPEC, line);
}

export function parseWarehouseAndLineInfo(line: string): WarehouseAndLineInfo {
  return decodeRecord(WAREHOUSE_AND_LINE_INFO_SPEC, line);
}

export function parseFormReferenceInfo(line: string): FormReferenceInfo {
  return decodeRecord(FORM_REFERENCE_INFO_SPEC, line);
}

export function parseBondSuretyInfo(line: string): BondSuretyInfo {
  return decodeRecord(BOND_SURETY_INFO_SPEC, line);
}

export function parseBillDetailStatusInfo(line: string): BillDetailStatusInfo {
  return decodeRecord(BILL_DETAIL_STATUS_INFO_SPEC, line);
}

export function parseCollectionDetailStatusInfo(line: string): CollectionDetailStatusInfo {
  return decodeRecord(COLLECTION_DETAIL_STATUS_INFO_SPEC, line);
}

export function parseCollectionClassCodeDetailInfo(line: string): CollectionClassCodeDetailInfo {
  return decodeRecord(COLLECTION_CLASS_CODE_DETAIL_INFO_SPEC, line);
}

export function parseSuretyBillDetailStatusInfo(line: string): SuretyBillDetailStatusInfo {
  return decodeRecord(SURETY_BILL_DETAIL_STATUS_INFO_SPEC, line);
}

export function parseCbpLineNumber(line: string): CbpLineNumberInfo {
  return decodeRecord(CBP_LINE_NUMBER_SPEC, line);
}

// ── Entry Summary Details Grouping (10-90-Records, reused from entrySummary/) ──

export function parseHeaderControl(line: string): HeaderControlInput {
  return decodeRecord(HEADER_CONTROL_SPEC, line);
}

export function parseHeaderContent(line: string): HeaderContentInput {
  return decodeRecord(HEADER_CONTENT_SPEC, line);
}

export function parseLineItemHeader(line: string) {
  return decodeRecord(LINE_ITEM_HEADER_SPEC, line);
}

export function parseTariffDetail(line: string) {
  return decodeRecord(TARIFF_DETAIL_SPEC, line);
}

export function parseFeeTotal(line: string): FeeTotalInput {
  return decodeRecord(FEE_TOTAL_SPEC, line);
}

export function parseGrandTotals(line: string): GrandTotalsInput {
  return decodeRecord(GRAND_TOTALS_SPEC, line);
}

/** One entry summary's full status: JB plus its mandatory JC-JH detail
 * records, 0+ JI bond/surety records, 0+ JK-JN billing/collection detail
 * records, and an optional Entry Summary Details Grouping (10-90-Records). */
export interface EntrySummaryQueryResult {
  status: EntrySummaryStatusInfo;
  detail: EntrySummaryStatusDetail;
  liquidation: LiquidationInfo;
  estimatedRevenue: EstimatedRevenueInfo;
  filing: EntrySummaryFilingInfo;
  warehouseAndLine: WarehouseAndLineInfo;
  formReference: FormReferenceInfo;
  bonds: BondSuretyInfo[];
  bills: BillDetailStatusInfo[];
  collections: CollectionDetailStatusInfo[];
  collectionClassCodes: CollectionClassCodeDetailInfo[];
  suretyBills: SuretyBillDetailStatusInfo[];
  /** Present only when the input J0-Record requested detail (and the entry
   * summary's Entry Type is eligible — see J0's own usage notes in types.ts). */
  detailsGrouping?: EntrySummaryDetailsGrouping;
}

export interface ParsedQueryResponse {
  criteriaHeader?: CriteriaQueryResponseHeader;
  results: EntrySummaryQueryResult[];
  conditions: QueryReturnedCondition[];
  /**
   * Lines that don't classify as any modeled record: output JJ (Protest Data,
   * deferred — see types.ts) or an unmodeled Entry Summary Details Grouping
   * record (20-36, 41-47, OA/OI/FC01/FC02, 51-54, 60-63, CW02, ...). Preserved
   * in original order rather than silently dropped or guessed at.
   */
  unrecognizedLines: string[];
}

const DECODERS = {
  JC: parseEntrySummaryStatusDetail,
  JD: parseLiquidationInfo,
  JE: parseEstimatedRevenueInfo,
  JF: parseEntrySummaryFilingInfo,
  JG: parseWarehouseAndLineInfo,
  JH: parseFormReferenceInfo,
} as const;

const RESULT_KEYS = {
  JC: "detail",
  JD: "liquidation",
  JE: "estimatedRevenue",
  JF: "filing",
  JG: "warehouseAndLine",
  JH: "formReference",
} as const;

// JI/JK/JL/JM/JN all repeat whole-record and collect into an array on the
// current JB group, unlike JC-JH's single-value fields above.
const ARRAY_DECODERS = {
  JI: parseBondSuretyInfo,
  JK: parseBillDetailStatusInfo,
  JL: parseCollectionDetailStatusInfo,
  JM: parseCollectionClassCodeDetailInfo,
  JN: parseSuretyBillDetailStatusInfo,
} as const;

const ARRAY_RESULT_KEYS = {
  JI: "bonds",
  JK: "bills",
  JL: "collections",
  JM: "collectionClassCodes",
  JN: "suretyBills",
} as const;

/**
 * Walks a raw Entry Summary Query response, grouping each JB with the JC-JH
 * detail records, JI bond/surety records, JK-JN billing/collection detail
 * records, and Entry Summary Details Grouping (10-90-Records, reused from
 * entrySummary/) that structurally follow it — per the Output Record
 * Structure Map: JB -> JC -> JD -> JE -> JF -> JG -> JH -> JI x0-20 -> JK
 * x0-999 -> JL x0-20 -> JM x0-20 -> JN x0-999 -> Entry Summary Detail
 * Grouping x0+ (10 -> 11? -> [4A -> 40 -> 50+]+ -> 89? -> 90). Output JJ and
 * every other Details Grouping record this slice doesn't model are preserved
 * verbatim in `unrecognizedLines` rather than guessed at.
 */
export function parseQueryResponse(lines: string[]): ParsedQueryResponse {
  const result: ParsedQueryResponse = { results: [], conditions: [], unrecognizedLines: [] };
  let current: Partial<EntrySummaryQueryResult> | undefined;
  let pendingGrouping: EntrySummaryDetailsGrouping | undefined;
  let pendingCbpLineNumber: string | undefined;

  // Called both to legitimately finalize a grouping (from the "90" case below,
  // by which point `grandTotals` is already set) and to close out whatever's
  // pending before a new 10-Record or JB-Record starts, or at end of input —
  // in those latter cases `grandTotals` being unset means the prior grouping
  // never reached its mandatory (Structure Map: "90 ... M 1") closing record.
  const flushGrouping = () => {
    if (!pendingGrouping) return;
    if (!pendingGrouping.grandTotals) {
      throw new AbiFixedWidthError(
        "Entry Summary Query response: an Entry Summary Details Grouping (10-Record) never reached its mandatory closing 90-Record."
      );
    }
    if (current) current.detailsGrouping = { ...pendingGrouping };
    pendingGrouping = undefined;
    pendingCbpLineNumber = undefined;
  };

  const flushCurrent = () => {
    if (!current) return;
    flushGrouping();
    if (!current.status || !current.detail || !current.liquidation || !current.estimatedRevenue ||
      !current.filing || !current.warehouseAndLine || !current.formReference) {
      throw new AbiFixedWidthError(
        "Entry Summary Query response: a JB group is missing one of its mandatory JC-JH detail records."
      );
    }
    result.results.push({
      ...current,
      bonds: current.bonds ?? [],
      bills: current.bills ?? [],
      collections: current.collections ?? [],
      collectionClassCodes: current.collectionClassCodes ?? [],
      suretyBills: current.suretyBills ?? [],
    } as EntrySummaryQueryResult);
    current = undefined;
  };

  for (const line of lines) {
    const type = classifyOutputLine(line);
    if (type === "JA") {
      result.criteriaHeader = parseCriteriaQueryResponseHeader(line);
    } else if (type === "JB") {
      flushCurrent();
      current = { status: parseEntrySummaryStatusInfo(line) };
    } else if (type in ARRAY_DECODERS) {
      if (!current) {
        throw new AbiFixedWidthError(`Entry Summary Query response: ${type}-Record with no preceding JB group.`);
      }
      const key = ARRAY_RESULT_KEYS[type as keyof typeof ARRAY_RESULT_KEYS];
      const decoder = ARRAY_DECODERS[type as keyof typeof ARRAY_DECODERS];
      ((current as unknown as Record<string, unknown[]>)[key] ??= []).push(decoder(line));
    } else if (type in DECODERS) {
      if (!current) {
        throw new AbiFixedWidthError(`Entry Summary Query response: ${type}-Record with no preceding JB group.`);
      }
      const key = RESULT_KEYS[type as keyof typeof RESULT_KEYS];
      const decoder = DECODERS[type as keyof typeof DECODERS];
      (current as Record<string, unknown>)[key] = decoder(line);
    } else if (type === "10") {
      if (!current) {
        throw new AbiFixedWidthError("Entry Summary Query response: 10-Record with no preceding JB group.");
      }
      flushGrouping();
      pendingGrouping = { headerControl: parseHeaderControl(line), lineItems: [] };
    } else if (type === "11") {
      if (!pendingGrouping) {
        throw new AbiFixedWidthError("Entry Summary Query response: 11-Record with no preceding 10-Record.");
      }
      pendingGrouping.headerContent = parseHeaderContent(line);
    } else if (type === "4A") {
      if (!pendingGrouping) {
        throw new AbiFixedWidthError("Entry Summary Query response: 4A-Record with no preceding 10-Record.");
      }
      pendingCbpLineNumber = parseCbpLineNumber(line).cbpLineNumber;
    } else if (type === "40") {
      if (!pendingGrouping) {
        throw new AbiFixedWidthError("Entry Summary Query response: 40-Record with no preceding 10-Record.");
      }
      pendingGrouping.lineItems.push({
        cbpLineNumber: pendingCbpLineNumber ?? "",
        header: parseLineItemHeader(line),
        tariffDetails: [],
      });
      pendingCbpLineNumber = undefined;
    } else if (type === "50") {
      if (!pendingGrouping || pendingGrouping.lineItems.length === 0) {
        throw new AbiFixedWidthError("Entry Summary Query response: 50-Record with no preceding 40-Record.");
      }
      pendingGrouping.lineItems[pendingGrouping.lineItems.length - 1].tariffDetails.push(parseTariffDetail(line));
    } else if (type === "89") {
      if (!pendingGrouping) {
        throw new AbiFixedWidthError("Entry Summary Query response: 89-Record with no preceding 10-Record.");
      }
      pendingGrouping.feeTotals = parseFeeTotal(line);
    } else if (type === "90") {
      if (!pendingGrouping) {
        throw new AbiFixedWidthError("Entry Summary Query response: 90-Record with no preceding 10-Record.");
      }
      pendingGrouping.grandTotals = parseGrandTotals(line);
      flushGrouping();
    } else if (type === "JZ") {
      result.conditions.push(parseQueryReturnedCondition(line));
    } else {
      result.unrecognizedLines.push(line);
    }
  }
  flushCurrent();

  return result;
}

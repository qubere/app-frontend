import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  RECORD_10_DRAWBACK_HEADER_SPEC,
  RECORD_31_BOND_INFO_SPEC,
  RECORD_40_IMPORTS_DETAILS_SPEC,
  RECORD_41_IMPORT_CLASSIFICATION_SPEC,
  RECORD_42_IMPORT_QUANTITY_UOM_SPEC,
  RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC,
  RECORD_50_MANUFACTURED_ARTICLE_SPEC,
  RECORD_51_MANUFACTURED_DESC_SPEC,
  RECORD_52_LINK_IMPORT_MFG_SPEC,
  RECORD_53_LINK_MFG_SOURCE_SPEC,
  RECORD_60_EXPORT_DESTROY_SPEC,
  RECORD_61_EXPORT_DESC_SPEC,
  RECORD_62_NOTICE_OF_INTENT_SPEC,
  RECORD_63_EXAM_WITNESS_SPEC,
  RECORD_64_NAFTA_USMCA_SPEC,
  RECORD_70_TFTEA_EXPORT_DESTROY_SPEC,
  RECORD_71_TFTEA_EXPORT_DESC_SPEC,
  RECORD_72_LINK_EXPORT_IMPORT_SPEC,
  RECORD_73_LINK_EXPORT_MFG_SPEC,
  RECORD_89_REVENUE_CLASS_TOTALS_SPEC,
  RECORD_90_REVENUE_GRAND_TOTALS_SPEC,
} from "./recordSpecs";
import type {
  DrawbackHeaderInput,
  BondInfoInput,
  ImportsDetailsInput,
  ImportClassificationInput,
  ImportQuantityUomInput,
  ImportRevenueClaimedInput,
  ManufacturedArticleInput,
  ManufacturedDescInput,
  LinkImportMfgInput,
  LinkMfgSourceInput,
  ExportDestroyInput,
  ExportDescInput,
  NoticeOfIntentInput,
  ExamWitnessInput,
  NaftaUsmcaInput,
  TfteaExportDestroyInput,
  TfteaExportDescInput,
  LinkExportImportInput,
  LinkExportMfgInput,
  RevenueClassTotalsInput,
  RevenueGrandTotalsInput,
} from "./types";

export function buildDrawbackHeader(input: DrawbackHeaderInput): string {
  return encodeRecord(RECORD_10_DRAWBACK_HEADER_SPEC, input);
}

export function buildBondInfo(input: BondInfoInput): string {
  return encodeRecord(RECORD_31_BOND_INFO_SPEC, input);
}

export function buildImportsDetails(input: ImportsDetailsInput): string {
  return encodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, input);
}

export function buildImportClassification(input: ImportClassificationInput): string {
  return encodeRecord(RECORD_41_IMPORT_CLASSIFICATION_SPEC, input);
}

export function buildImportQuantityUom(input: ImportQuantityUomInput): string {
  return encodeRecord(RECORD_42_IMPORT_QUANTITY_UOM_SPEC, input);
}

export function buildImportRevenueClaimed(input: ImportRevenueClaimedInput): string {
  return encodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, input);
}

export function buildManufacturedArticle(input: ManufacturedArticleInput): string {
  return encodeRecord(RECORD_50_MANUFACTURED_ARTICLE_SPEC, input);
}

export function buildManufacturedDesc(input: ManufacturedDescInput): string {
  return encodeRecord(RECORD_51_MANUFACTURED_DESC_SPEC, input);
}

export function buildLinkImportMfg(input: LinkImportMfgInput): string {
  return encodeRecord(RECORD_52_LINK_IMPORT_MFG_SPEC, input);
}

export function buildLinkMfgSource(input: LinkMfgSourceInput): string {
  return encodeRecord(RECORD_53_LINK_MFG_SOURCE_SPEC, input);
}

export function buildExportDestroy(input: ExportDestroyInput): string {
  return encodeRecord(RECORD_60_EXPORT_DESTROY_SPEC, input);
}

export function buildExportDesc(input: ExportDescInput): string {
  return encodeRecord(RECORD_61_EXPORT_DESC_SPEC, input);
}

export function buildNoticeOfIntent(input: NoticeOfIntentInput): string {
  return encodeRecord(RECORD_62_NOTICE_OF_INTENT_SPEC, input);
}

export function buildExamWitness(input: ExamWitnessInput): string {
  return encodeRecord(RECORD_63_EXAM_WITNESS_SPEC, input);
}

export function buildNaftaUsmca(input: NaftaUsmcaInput): string {
  return encodeRecord(RECORD_64_NAFTA_USMCA_SPEC, input);
}

export function buildTfteaExportDestroy(input: TfteaExportDestroyInput): string {
  return encodeRecord(RECORD_70_TFTEA_EXPORT_DESTROY_SPEC, input);
}

export function buildTfteaExportDesc(input: TfteaExportDescInput): string {
  return encodeRecord(RECORD_71_TFTEA_EXPORT_DESC_SPEC, input);
}

export function buildLinkExportImport(input: LinkExportImportInput): string {
  return encodeRecord(RECORD_72_LINK_EXPORT_IMPORT_SPEC, input);
}

export function buildLinkExportMfg(input: LinkExportMfgInput): string {
  return encodeRecord(RECORD_73_LINK_EXPORT_MFG_SPEC, input);
}

export function buildRevenueClassTotals(input: RevenueClassTotalsInput): string {
  return encodeRecord(RECORD_89_REVENUE_CLASS_TOTALS_SPEC, input);
}

export function buildRevenueGrandTotals(input: RevenueGrandTotalsInput): string {
  return encodeRecord(RECORD_90_REVENUE_GRAND_TOTALS_SPEC, input);
}

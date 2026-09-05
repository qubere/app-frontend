import { Decimal } from "@/lib/tariff/decimal";
import { AbiFilingValidationError, type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";
import type {
  DrawbackHeaderInput,
  BondInfoInput,
  LinkImportMfgInput,
  ExportDestroyInput,
  TfteaExportDestroyInput,
  NaftaUsmcaInput,
} from "./types";

export type DrawbackClaimWithRelations = {
  id: string;
  accountId: string;
  claimType: string;
  status: string;
  totalRefundClaimed: Decimal | number;
  cbpClaimNumber?: string | null;
  filedAt?: Date | null;
  naftaDrawbackClaimIndicator?: boolean | null;
  usmcaDrawbackClaimIndicator?: boolean | null;
  oneTimeWaiverIndicator?: boolean | null;
  bondWaiverIndicator?: boolean | null;
  bondWaiverReasonCode?: string | null;
  electronicPetroleumCertification?: boolean | null;
  oilSpillTaxCertification?: boolean | null;
  superfundTaxCertification?: boolean | null;
  billOfMaterialsFormulaCertification?: boolean | null;
  retailSalesSubstitutionIndicator?: boolean | null;
  designatedNotifyPartyNumber?: string | null;
  brokerReferenceNumber?: string | null;
  acceleratedPaymentRequestIndicator?: boolean | null;
  bond?: {
    bondType?: string | null;
    suretyCode?: string | null;
    bondNumber?: string | null;
    bondAmount?: Decimal | number | null;
  } | null;
  importLinks?: {
    id: string;
    importTrackingIdNumber: string;
    sequence: number;
  }[];
  exportDestroys?: {
    id: string;
    noticeOfIntentIndicator?: boolean | null;
    waiverToDrawbackClaimRightsIndicator?: boolean | null;
    countryOfUltimateDestination?: string | null;
    billOfLadingIndicator?: string | null;
    billOfLadingCarrierCode?: string | null;
    intendedPortOfExport?: string | null;
    examinationWitnessIndicator?: boolean | null;
    locationOfDestruction?: string | null;
    resultsOfExamination?: string | null;
    examinerName?: string | null;
    examinerBadgeNumber?: string | null;
    examinerPhone?: string | null;
    processingExaminationDate?: Date | null;
  }[];
  tfteaLines?: {
    id: string;
    htsNumber?: string | null;
    exportOrDestroyIndicator?: string | null;
    quantity?: Decimal | number | null;
    unitOfMeasureCode?: string | null;
    date?: Date | null;
    noticeOfIntentIndicator?: boolean | null;
    waiverIndicator?: boolean | null;
    exporterOrDestroyerName?: string | null;
    countryOfUltimateDestination?: string | null;
    billOfLadingIndicator?: string | null;
    billOfLadingCarrierCode?: string | null;
    scheduleBCode?: string | null;
  }[];
  naftaUsmcaLines?: {
    id: string;
    entryNumber?: string | null;
    entryDate?: Date | null;
    dutyPaidToForeignGovtLocalCurrency?: Decimal | number | null;
    exchangeRate?: Decimal | number | null;
    tariffNumber1?: string | null;
    tariffNumber2?: string | null;
    tariffNumber3?: string | null;
    countryOfExport?: string | null;
  }[];
};

/**
 * Options for Drawback filing conversion.
 */
export interface DrawbackFilingOptions extends EnvelopeHeaderOptions {
  drawbackFilingPort?: string;
  drawbackProvision?: string;
  claimantIdOrImporterRecordNumber?: string;
  electronicSignature?: string;
}

function boolToFlag(val?: boolean | null): string | undefined {
  if (val === true) return "Y";
  if (val === false) return "N";
  return undefined;
}

/**
 * Validates a DrawbackClaim model for ABI transmission.
 */
export function validateDrawbackClaim(
  claim: DrawbackClaimWithRelations,
  options?: Partial<DrawbackFilingOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  const claimNum = claim.cbpClaimNumber || options?.processingFilerCode;
  if (!claimNum) {
    missingFields.push("header.entryNumberOrDrawbackClaimNumber (requires cbpClaimNumber or processingFilerCode)");
  }

  const filingPort = options?.drawbackFilingPort || options?.processingDistrictPortCode;
  if (!filingPort) {
    missingFields.push("header.drawbackFilingPort (requires options.drawbackFilingPort or options.processingDistrictPortCode)");
  }

  const claimantId = options?.claimantIdOrImporterRecordNumber || options?.senderReceiverIdCode;
  if (!claimantId) {
    missingFields.push("header.claimantIdOrImporterRecordNumber (requires options.claimantIdOrImporterRecordNumber)");
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Converts a database DrawbackClaim record (and its loaded relations) to ABI Drawback input structures.
 */
export function fromDrawbackClaim(
  claim: DrawbackClaimWithRelations,
  options?: Partial<DrawbackFilingOptions>
): {
  header: DrawbackHeaderInput;
  bondInfo?: BondInfoInput;
  importLinks: LinkImportMfgInput[];
  exportDestroys: ExportDestroyInput[];
  tfteaExportDestroys: TfteaExportDestroyInput[];
  naftaUsmcaLines: NaftaUsmcaInput[];
} {
  const validation = validateDrawbackClaim(claim, options);
  if (!validation.valid) {
    throw new AbiFilingValidationError(claim.id, validation.missingFields);
  }

  const entryFilerCode = (options?.processingFilerCode || "123").slice(0, 3).toUpperCase();
  const claimNum = (claim.cbpClaimNumber || "00000000").replace(/[^A-Za-z0-9]/g, "").padStart(8, "0").slice(0, 8);
  const filingPort = (options?.drawbackFilingPort || options?.processingDistrictPortCode || "3501").slice(0, 4);

  const header: DrawbackHeaderInput = {
    summaryFilingActionRequestCode: "A",
    entryFilerCode,
    entryNumberOrDrawbackClaimNumber: claimNum,
    drawbackFilingPort: filingPort,
    brokerReferenceNumber: claim.brokerReferenceNumber ?? undefined,
    drawbackProvision: options?.drawbackProvision || "01",
    bondWaiverIndicator: boolToFlag(claim.bondWaiverIndicator),
    bondWaiverReasonCode: claim.bondWaiverReasonCode ?? undefined,
    acceleratedPaymentRequestIndicator: boolToFlag(claim.acceleratedPaymentRequestIndicator),
    oneTimeWaiverIndicator: boolToFlag(claim.oneTimeWaiverIndicator),
    electronicPetroleumCertification: boolToFlag(claim.electronicPetroleumCertification),
    oilSpillTaxCertification: boolToFlag(claim.oilSpillTaxCertification),
    naftaDrawbackClaimIndicator: boolToFlag(claim.naftaDrawbackClaimIndicator),
    usmcaDrawbackClaimIndicator: boolToFlag(claim.usmcaDrawbackClaimIndicator),
    billOfMaterialsFormulaCertification: boolToFlag(claim.billOfMaterialsFormulaCertification),
    retailSalesSubstitutionIndicator: boolToFlag(claim.retailSalesSubstitutionIndicator),
    superfundTaxCertification: boolToFlag(claim.superfundTaxCertification),
    designatedNotifyPartyNumber: claim.designatedNotifyPartyNumber ?? undefined,
    electronicSignature: options?.electronicSignature || "Y",
    claimantIdOrImporterRecordNumber: (options?.claimantIdOrImporterRecordNumber || "123456789000").slice(0, 12),
  };

  let bondInfo: BondInfoInput | undefined;
  if (claim.bond) {
    const isStb = claim.bond.bondType === "single_transaction";
    bondInfo = {
      bondTypeCode: isStb ? "9" : "8",
      bondDesignationTypeCode: "B",
      suretyCompanyCode: (claim.bond.suretyCode || "000").slice(0, 3),
      singleTransactionBondAmount: claim.bond.bondAmount ? new Decimal(claim.bond.bondAmount) : undefined,
      singleTransactionBondNumber: claim.bond.bondNumber || undefined,
    };
  }

  // Map import links (chunked by 15 ITINs)
  const importLinks: LinkImportMfgInput[] = [];
  const sortedLinks = [...(claim.importLinks || [])].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < sortedLinks.length; i += 15) {
    const chunk = sortedLinks.slice(i, i + 15);
    importLinks.push({
      importTrackingIdNumber1: chunk[0].importTrackingIdNumber,
      importTrackingIdNumber2: chunk[1]?.importTrackingIdNumber,
      importTrackingIdNumber3: chunk[2]?.importTrackingIdNumber,
      importTrackingIdNumber4: chunk[3]?.importTrackingIdNumber,
      importTrackingIdNumber5: chunk[4]?.importTrackingIdNumber,
      importTrackingIdNumber6: chunk[5]?.importTrackingIdNumber,
      importTrackingIdNumber7: chunk[6]?.importTrackingIdNumber,
      importTrackingIdNumber8: chunk[7]?.importTrackingIdNumber,
      importTrackingIdNumber9: chunk[8]?.importTrackingIdNumber,
      importTrackingIdNumber10: chunk[9]?.importTrackingIdNumber,
      importTrackingIdNumber11: chunk[10]?.importTrackingIdNumber,
      importTrackingIdNumber12: chunk[11]?.importTrackingIdNumber,
      importTrackingIdNumber13: chunk[12]?.importTrackingIdNumber,
      importTrackingIdNumber14: chunk[13]?.importTrackingIdNumber,
      importTrackingIdNumber15: chunk[14]?.importTrackingIdNumber,
    });
  }

  // Map export / destroy lines
  const exportDestroys: ExportDestroyInput[] = (claim.exportDestroys || []).map((row) => ({
    exportOrDestroyIndicator: "E",
    htsNumber: "0000000000",
    exportOrDestroyQuantity: new Decimal(1),
    unitOfMeasureCode: "PCS",
    exportOrDestroyDate: row.processingExaminationDate || new Date(),
    noticeOfIntentIndicator: boolToFlag(row.noticeOfIntentIndicator),
    waiverToDrawbackClaimRightsIndicator: boolToFlag(row.waiverToDrawbackClaimRightsIndicator),
    nameOfExporterOrDestroyer: row.examinerName || "EXPORTER",
    countryOfUltimateDestination: row.countryOfUltimateDestination ?? undefined,
    billOfLadingIndicator: row.billOfLadingIndicator ?? undefined,
    billOfLadingCarrierCode: row.billOfLadingCarrierCode ?? undefined,
  }));

  // Map TFTEA export / destroy lines
  const tfteaExportDestroys: TfteaExportDestroyInput[] = (claim.tfteaLines || []).map((row) => ({
    exportOrDestroyIndicator: row.exportOrDestroyIndicator || "E",
    htsNumber: row.htsNumber || "0000000000",
    exportOrDestroyQuantity: row.quantity ? new Decimal(row.quantity) : new Decimal(1),
    unitOfMeasureCode: row.unitOfMeasureCode || "PCS",
    exportOrDestroyDate: row.date || new Date(),
    noticeOfIntentIndicator: boolToFlag(row.noticeOfIntentIndicator),
    waiverToDrawbackClaimRightsIndicator: boolToFlag(row.waiverIndicator),
    nameOfExporterOrDestroyer: row.exporterOrDestroyerName || "EXPORTER",
    countryOfUltimateDestination: row.countryOfUltimateDestination ?? undefined,
    billOfLadingIndicator: row.billOfLadingIndicator ?? undefined,
    billOfLadingCarrierCode: row.billOfLadingCarrierCode ?? undefined,
    scheduleBCode: row.scheduleBCode ?? undefined,
  }));

  // Map NAFTA / USMCA lines
  const naftaUsmcaLines: NaftaUsmcaInput[] = (claim.naftaUsmcaLines || []).map((row) => ({
    entryNumber: row.entryNumber || "00000000",
    entryDate: row.entryDate || new Date(),
    dutyPaidToForeignGovtLocalCurrency: row.dutyPaidToForeignGovtLocalCurrency
      ? new Decimal(row.dutyPaidToForeignGovtLocalCurrency)
      : new Decimal(0),
    exchangeRate: row.exchangeRate ? new Decimal(row.exchangeRate) : new Decimal(1),
    tariffNumber1: row.tariffNumber1 || "0000000000",
    tariffNumber2: row.tariffNumber2 ?? undefined,
    tariffNumber3: row.tariffNumber3 ?? undefined,
    countryOfExport: row.countryOfExport || "CA",
  }));

  return {
    header,
    bondInfo,
    importLinks,
    exportDestroys,
    tfteaExportDestroys,
    naftaUsmcaLines,
  };
}

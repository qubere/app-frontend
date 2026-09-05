import { Decimal } from "@/lib/tariff/decimal";
import { AbiFilingValidationError, type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";
export { AbiFilingValidationError };
import type {
  DrawbackHeaderInput,
  BondInfoInput,
  LinkImportMfgInput,
  ExportDestroyInput,
  NoticeOfIntentInput,
  ExamWitnessInput,
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
 * Per-row data for a core (non-TFTEA) export/destroy event that has no home on
 * `DrawbackExportDestroy` today (that model has no htsNumber/quantity/
 * unitOfMeasureCode/exporter-name columns, and no export/destroy date distinct
 * from the exam date). Until the schema grows those columns (or a join key to
 * `ExportLineItem`/`ExportShipment` is added), the caller must supply them —
 * this function will not invent placeholder CATAIR data. Keyed by
 * `DrawbackExportDestroy.id`.
 */
export interface ExportDestroyLineDetails {
  htsNumber: string;
  exportOrDestroyQuantity: Decimal | number;
  unitOfMeasureCode: string;
  nameOfExporterOrDestroyer: string;
  exportOrDestroyDate: Date;
}

/**
 * A `Bond` row to attach as the claim's bond info. `DrawbackClaim` has no bond
 * relation in the schema, so the caller resolves and passes the bond (e.g. the
 * account's active continuous bond, or the shipment's single-transaction bond)
 * rather than this function guessing at one.
 */
export interface DrawbackBondInput {
  bondType: string;
  suretyCode?: string | null;
  bondNumber?: string | null;
  bondAmount?: Decimal | number | null;
}

/**
 * Options for Drawback filing conversion.
 */
export interface DrawbackFilingOptions extends EnvelopeHeaderOptions {
  drawbackFilingPort?: string;
  drawbackProvision?: string;
  claimantIdOrImporterRecordNumber?: string;
  electronicSignature?: string;
  bond?: DrawbackBondInput;
  exportDestroyDetailsById?: Record<string, ExportDestroyLineDetails>;
}

function boolToFlag(val?: boolean | null): string | undefined {
  if (val === true) return "Y";
  if (val === false) return "N";
  return undefined;
}

/** Space = Waived, X = Exam Required & Witnessed (this record's own code table). */
function examWitnessIndicatorCode(val?: boolean | null): string {
  return val === true ? "X" : " ";
}

/**
 * Validates a DrawbackClaim model and its relations for ABI transmission.
 * Every field the wire-format types require but the DB may not have is
 * checked here — none of it is silently defaulted in the builder below.
 */
export function validateDrawbackClaim(
  claim: DrawbackClaimWithRelations,
  options?: Partial<DrawbackFilingOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!claim.cbpClaimNumber) {
    missingFields.push("drawbackClaim.cbpClaimNumber");
  }
  if (!options?.processingFilerCode) {
    missingFields.push("options.processingFilerCode");
  }
  if (!options?.drawbackFilingPort && !options?.processingDistrictPortCode) {
    missingFields.push("options.drawbackFilingPort (or options.processingDistrictPortCode)");
  }
  if (!options?.claimantIdOrImporterRecordNumber) {
    missingFields.push("options.claimantIdOrImporterRecordNumber");
  }
  if (!options?.drawbackProvision) {
    missingFields.push("options.drawbackProvision");
  }
  if (!options?.electronicSignature) {
    missingFields.push("options.electronicSignature");
  }

  const exportDetails = options?.exportDestroyDetailsById || {};
  (claim.exportDestroys || []).forEach((row) => {
    if (!exportDetails[row.id]) {
      missingFields.push(
        `exportDestroys[${row.id}] (requires options.exportDestroyDetailsById["${row.id}"] — htsNumber/quantity/unitOfMeasureCode/exporter name/date have no source column on DrawbackExportDestroy)`
      );
    }
    if (row.examinationWitnessIndicator === true) {
      if (!row.examinerName) missingFields.push(`exportDestroys[${row.id}].examinerName`);
      if (!row.examinerBadgeNumber) missingFields.push(`exportDestroys[${row.id}].examinerBadgeNumber`);
      if (!row.examinerPhone) missingFields.push(`exportDestroys[${row.id}].examinerPhone`);
      if (!row.processingExaminationDate) missingFields.push(`exportDestroys[${row.id}].processingExaminationDate`);
    }
  });

  (claim.tfteaLines || []).forEach((row, i) => {
    if (!row.htsNumber) missingFields.push(`tfteaLines[${i}].htsNumber`);
    if (row.quantity == null) missingFields.push(`tfteaLines[${i}].quantity`);
    if (!row.unitOfMeasureCode) missingFields.push(`tfteaLines[${i}].unitOfMeasureCode`);
    if (!row.date) missingFields.push(`tfteaLines[${i}].date`);
    if (!row.exporterOrDestroyerName) missingFields.push(`tfteaLines[${i}].exporterOrDestroyerName`);
  });

  (claim.naftaUsmcaLines || []).forEach((row, i) => {
    if (!row.entryNumber) missingFields.push(`naftaUsmcaLines[${i}].entryNumber`);
    if (!row.entryDate) missingFields.push(`naftaUsmcaLines[${i}].entryDate`);
    if (!row.tariffNumber1) missingFields.push(`naftaUsmcaLines[${i}].tariffNumber1`);
    if (!row.countryOfExport) missingFields.push(`naftaUsmcaLines[${i}].countryOfExport`);
  });

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
  noticeOfIntents: NoticeOfIntentInput[];
  examWitnesses: ExamWitnessInput[];
  tfteaExportDestroys: TfteaExportDestroyInput[];
  naftaUsmcaLines: NaftaUsmcaInput[];
} {
  const validation = validateDrawbackClaim(claim, options);
  if (!validation.valid) {
    throw new AbiFilingValidationError(claim.id, validation.missingFields);
  }

  const entryFilerCode = options!.processingFilerCode!.slice(0, 3).toUpperCase();
  const claimNum = claim.cbpClaimNumber!.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).padStart(8, "0");
  const filingPort = (options!.drawbackFilingPort || options!.processingDistrictPortCode)!.slice(0, 4);

  const header: DrawbackHeaderInput = {
    summaryFilingActionRequestCode: "A",
    entryFilerCode,
    entryNumberOrDrawbackClaimNumber: claimNum,
    drawbackFilingPort: filingPort,
    brokerReferenceNumber: claim.brokerReferenceNumber ?? undefined,
    drawbackProvision: options!.drawbackProvision!,
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
    electronicSignature: options!.electronicSignature!,
    claimantIdOrImporterRecordNumber: options!.claimantIdOrImporterRecordNumber!.slice(0, 12),
  };

  let bondInfo: BondInfoInput | undefined;
  if (options?.bond) {
    const isStb = options.bond.bondType === "single_transaction";
    bondInfo = {
      bondTypeCode: isStb ? "9" : "8",
      bondDesignationTypeCode: "B",
      suretyCompanyCode: options.bond.suretyCode ? options.bond.suretyCode.slice(0, 3) : "",
      singleTransactionBondAmount: options.bond.bondAmount != null ? new Decimal(options.bond.bondAmount) : undefined,
      singleTransactionBondNumber: options.bond.bondNumber || undefined,
    };
  }

  // Map import links (chunked by 15 ITINs — Record 52's own repeating group size)
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

  // Map core export/destroy lines (Record 60) — htsNumber/quantity/UOM/exporter
  // name come from the caller-supplied details map (validated above), never fabricated.
  const exportDetails = options?.exportDestroyDetailsById || {};
  const exportDestroys: ExportDestroyInput[] = (claim.exportDestroys || []).map((row) => {
    const details = exportDetails[row.id];
    return {
      exportOrDestroyIndicator: row.billOfLadingIndicator ? "E" : "D",
      htsNumber: details.htsNumber,
      exportOrDestroyQuantity: new Decimal(details.exportOrDestroyQuantity),
      unitOfMeasureCode: details.unitOfMeasureCode,
      exportOrDestroyDate: details.exportOrDestroyDate,
      noticeOfIntentIndicator: boolToFlag(row.noticeOfIntentIndicator),
      waiverToDrawbackClaimRightsIndicator: boolToFlag(row.waiverToDrawbackClaimRightsIndicator),
      nameOfExporterOrDestroyer: details.nameOfExporterOrDestroyer,
      countryOfUltimateDestination: row.countryOfUltimateDestination ?? undefined,
      billOfLadingIndicator: row.billOfLadingIndicator ?? undefined,
      billOfLadingCarrierCode: row.billOfLadingCarrierCode ?? undefined,
    };
  });

  // Record 62 — Notice of Intent (space-fill Examination/Witness Indicator when not witnessed).
  const noticeOfIntents: NoticeOfIntentInput[] = (claim.exportDestroys || []).map((row) => ({
    intendedPortOfExport: row.intendedPortOfExport ?? undefined,
    examinationWitnessIndicator: examWitnessIndicatorCode(row.examinationWitnessIndicator),
    locationOfDestruction: row.locationOfDestruction ?? undefined,
    resultsOfExaminationOrWitnessOfDestruction: row.resultsOfExamination ?? undefined,
  }));

  // Record 63 — Exam Witness, only emitted when an exam was actually witnessed
  // (required fields validated above for exactly this case).
  const examWitnesses: ExamWitnessInput[] = (claim.exportDestroys || [])
    .filter((row) => row.examinationWitnessIndicator === true)
    .map((row) => ({
      recordIndicator: "E",
      nameOfCbpPersonnel: row.examinerName!,
      cbpPersonnelBadgeNumber: row.examinerBadgeNumber!,
      cbpPersonnelPhoneNumber: row.examinerPhone!,
      processingExaminationDate: row.processingExaminationDate!,
    }));

  // Map TFTEA export / destroy lines (Record 70) — this model does carry its
  // own htsNumber/quantity/UOM/exporter columns, so no caller-supplied details needed.
  const tfteaExportDestroys: TfteaExportDestroyInput[] = (claim.tfteaLines || []).map((row) => ({
    exportOrDestroyIndicator: row.exportOrDestroyIndicator!,
    htsNumber: row.htsNumber!,
    exportOrDestroyQuantity: new Decimal(row.quantity!),
    unitOfMeasureCode: row.unitOfMeasureCode!,
    exportOrDestroyDate: row.date!,
    noticeOfIntentIndicator: boolToFlag(row.noticeOfIntentIndicator),
    waiverToDrawbackClaimRightsIndicator: boolToFlag(row.waiverIndicator),
    nameOfExporterOrDestroyer: row.exporterOrDestroyerName!,
    countryOfUltimateDestination: row.countryOfUltimateDestination ?? undefined,
    billOfLadingIndicator: row.billOfLadingIndicator ?? undefined,
    billOfLadingCarrierCode: row.billOfLadingCarrierCode ?? undefined,
    scheduleBCode: row.scheduleBCode ?? undefined,
  }));

  // Map NAFTA / USMCA lines (Record 64)
  const naftaUsmcaLines: NaftaUsmcaInput[] = (claim.naftaUsmcaLines || []).map((row) => ({
    entryNumber: row.entryNumber!,
    entryDate: row.entryDate!,
    dutyPaidToForeignGovtLocalCurrency: row.dutyPaidToForeignGovtLocalCurrency
      ? new Decimal(row.dutyPaidToForeignGovtLocalCurrency)
      : new Decimal(0),
    exchangeRate: row.exchangeRate ? new Decimal(row.exchangeRate) : new Decimal(1),
    tariffNumber1: row.tariffNumber1!,
    tariffNumber2: row.tariffNumber2 ?? undefined,
    tariffNumber3: row.tariffNumber3 ?? undefined,
    countryOfExport: row.countryOfExport!,
  }));

  return {
    header,
    bondInfo,
    importLinks,
    exportDestroys,
    noticeOfIntents,
    examWitnesses,
    tfteaExportDestroys,
    naftaUsmcaLines,
  };
}

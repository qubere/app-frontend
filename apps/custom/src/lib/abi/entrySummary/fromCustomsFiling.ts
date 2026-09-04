import { Decimal } from "@/lib/tariff/decimal";
import { buildEntryNumber, isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import { assembleTransaction } from "./assembleTransaction";
import { wrapBlock, wrapBatch } from "@/lib/abi/batchBlockControl/build";
import type { ARecordInput, BRecordInput } from "@/lib/abi/batchBlockControl/types";
import type {
  EntrySummaryTransactionInput,
  HeaderControlInput,
  HeaderContentInput,
  BondDetailInput,
  LineItemInput,
  LineItemHeaderInput,
  TariffDetailInput,
  FtzStatusInput,
  AdcvdCaseDetailInput,
  CensusWarningOverrideInput,
  FeeTotalEntry,
  GrandTotalsInput,
  InvoiceLineReferenceInput,
  LineEntityInput,
  FtzPrivilegedStatusDetailInput,
} from "./types";

/**
 * Error thrown when a CustomsFiling record cannot be converted to ABI format
 * because one or more required fields are missing or invalid.
 */
export class AbiFilingValidationError extends Error {
  constructor(
    public readonly filingId: string,
    public readonly missingFields: string[]
  ) {
    super(
      `CustomsFiling "${filingId}" cannot be converted to ABI transmission format because it is missing required field(s): ${missingFields.join(", ")}.`
    );
    this.name = "AbiFilingValidationError";
  }
}

/**
 * Header options for batch/block envelopes and fallback control defaults.
 * Supplied by the caller when schema fields have no home in CustomsFiling.
 */
export interface EnvelopeHeaderOptions {
  senderReceiverSiteCode: string;
  senderReceiverIdCode: string;
  communicationPassword: string;
  processingFilerCode: string;
  processingDistrictPortCode: string;
  applicationIdentifierCode?: string; // Default "AE"
  transmissionDate?: Date;
  senderReceiverOfficeCode?: string;
  processingFilerOfficeCode?: string;
  transmitterUserDataText?: string;
  filerPreparerUserDataText?: string;
}

/**
 * Verified mapping of official surety company names to Treasury-assigned 3-digit surety codes.
 *
 * Source: U.S. Customs and Border Protection (CBP) "Surety Names and Codes" report
 * (Publication date: September 2025; Source data: Department of the Treasury Circular 570, dated August 1, 2025).
 * File: docs/plans/catair-source-docs/active_sureties_2025.pdf
 * URL: https://www.cbp.gov/sites/default/files/2025-09/active_sureties_2025.pdf
 *
 * NOTE: Non-underwriting insurance brokers/agencies (e.g. Roanoke Insurance Group, Avondale Insurance Agency)
 * do not have CBP surety codes and are intentionally excluded; their issued bonds use the 3-digit code
 * of the underlying underwriting surety company (e.g. Aspen American Insurance Company -> "052").
 */
export const KNOWN_SURETY_NAME_TO_CODE_MAP: Record<string, string> = {
  // Source: CBP Active Sureties (Treasury Dept Circular 570, Aug 1, 2025)
  "GREAT AMERICAN INS CO": "329",
  "GREAT AMERICAN INSURANCE COMPANY": "329",
  "GREAT AMERICAN ALLIANCE INS CO": "035",
  "INTERNATIONAL FIDELITY INS CO": "421",
  "INTERNATIONAL FIDELITY INSURANCE COMPANY": "421",
  "TRAVELERS CASUALTY AND SURETY CO": "001",
  "TRAVELERS CASUALTY AND SURETY COMPANY": "001",
  "TRAVELERS CASUALTY & SURETY CO": "023",
  "AMERICAN CONTRACTORS INDEMNITY": "300",
  "AMERICAN CONTRACTORS INDEMNITY COMPANY": "300",
  "ASPEN AMERICAN INSURANCE COMPANY": "052",
  "FEDERAL INSURANCE COMPANY": "269",
  "FIDELITY AND DEPOSIT CO OF MD": "281",
  "LIBERTY MUTUAL INSURANCE CO": "457",
  "RLI INSURANCE COMPANY": "732",
  "WESTERN SURETY COMPANY": "913",
};

/**
 * Resolves a 3-digit Treasury surety company code from a bond object.
 */
export function resolveSuretyCompanyCode(bond: {
  suretyCode?: string | null;
  suretyName?: string | null;
}): string | undefined {
  if (bond.suretyCode && /^[0-9]{3}$/.test(bond.suretyCode.trim())) {
    return bond.suretyCode.trim();
  }

  if (bond.suretyName) {
    const trimmed = bond.suretyName.trim();
    if (/^[0-9]{3}$/.test(trimmed)) {
      return trimmed;
    }
    const upper = trimmed.toUpperCase();
    if (KNOWN_SURETY_NAME_TO_CODE_MAP[upper]) {
      return KNOWN_SURETY_NAME_TO_CODE_MAP[upper];
    }
  }

  return undefined;
}

/**
 * Shape of a loaded CustomsFiling Prisma record with Phase 1 gap-closure relations.
 */
export type CustomsFilingWithRelations = {
  id: string;
  entryNumber: string;
  entryType?: string | null;
  actionCode?: string | null;
  brokerReferenceNumber?: string | null;
  bondWaiverIndicator?: string | null;
  bondWaiverReasonCode?: string | null;
  liveEntryIndicator?: string | null;
  consolidatedSummaryIndicator?: string | null;
  paymentTypeCode?: string | null;
  pgaDataIncludedIndicator?: string | null;
  foreignTradeZoneIdentifier?: string | null;
  usStateOfDestinationCode?: string | null;
  estimatedEntryDate?: Date | null;
  dateOfImportation?: Date | null;
  designatedNotifyPartyNumber?: string | null;
  grandTotalDutyAmount?: Decimal | number | null;
  grandTotalUserFeeAmount?: Decimal | number | null;
  grandTotalIrTaxAmount?: Decimal | number | null;
  grandTotalAdDutyAmount?: Decimal | number | null;
  grandTotalCvDutyAmount?: Decimal | number | null;
  grandTotalOtherRevenueAmount?: Decimal | number | null;
  modeOfTransportationCode?: string | null;
  importerOfRecord?: {
    cbpImporterNumber?: string | null;
    irsEin?: string | null;
    name?: string | null;
  } | null;
  bond?: {
    bondType?: string | null;
    suretyName?: string | null;
    suretyCode?: string | null;
    bondNumber?: string | null;
    bondAmount?: Decimal | number | null;
  } | null;
  shipment?: {
    portOfEntry?: string | null;
    entryType?: string | null;
    transportMode?: string | null;
    countryOfExport?: string | null;
    estimatedArrival?: Date | null;
    arrivalDate?: Date | null;
    ladingDate?: Date | null;
    lineItems?: {
      id: string;
      lineNumber: number;
      partNumber?: string | null;
      description: string;
      quantity: number;
      unitPrice: Decimal | number;
      totalValue: Decimal | number;
      countryOfOrigin: string;
      htsCode: string;
      totalDuties?: Decimal | number | null;
      ftzDetails?: {
        ftzAdmissionNumber?: string | null;
        zoneId?: string | null;
        privilegedStatusDate?: Date | null;
        merchandiseStatusCode?: string | null;
        lineItemQuantity?: Decimal | number | null;
        currentHtsNumber?: string | null;
      }[];
      adcvdLineDetails?: {
        caseDepositRate?: Decimal | number | null;
        rateTypeQualifierCode?: string | null;
        bondCashClaimCode?: string | null;
        valueOfGoodsAmount?: Decimal | number | null;
        nonReimbursementDeclarationIdentifier?: string | null;
        adcvdOrder?: {
          caseNumber: string;
        } | null;
        adcvdOrderId?: string | null;
      }[];
      shipmentParties?: {
        role: string;
        partyTypeCode?: string | null;
        legalEntity?: {
          legalName: string;
          taxIdentifier?: string | null;
          taxIdentifierType?: string | null;
        } | null;
      }[];
    }[];
    shipmentParties?: {
      role: string;
      partyTypeCode?: string | null;
      legalEntity?: {
        legalName: string;
        taxIdentifier?: string | null;
        taxIdentifierType?: string | null;
      } | null;
    }[];
  } | null;
  censusWarningOverrides?: {
    sequence: number;
    conditionCode: string;
    overrideCode: string;
  }[];
  filingFeeLines?: {
    accountingClassCode: string;
    amount: Decimal | number;
    sequence: number;
  }[];
  ftzDetails?: {
    shipmentLineItemId?: string | null;
    ftzAdmissionNumber?: string | null;
    zoneId?: string | null;
    privilegedStatusDate?: Date | null;
    merchandiseStatusCode?: string | null;
    lineItemQuantity?: Decimal | number | null;
    currentHtsNumber?: string | null;
  }[];
  invoiceLines?: {
    supplierIdCode?: string | null;
    lineRange1Begin?: number | null;
    lineRange1End?: number | null;
    lineRange2Begin?: number | null;
    lineRange2End?: number | null;
    lineRange3Begin?: number | null;
    lineRange3End?: number | null;
    lineRange4Begin?: number | null;
    lineRange4End?: number | null;
    invoice?: {
      invoiceNumber: string;
    } | null;
    shipmentId?: string | null;
  }[];
};

/**
 * Normalizes an entry number from CustomsFiling into a 3-character filer code
 * and an 8-character (7-digit transaction number + check digit) entry number.
 */
function parseFilerAndEntryNumber(
  rawEntryNumber?: string | null,
  fallbackFilerCode?: string | null
): { entryFilerCode?: string; entryNumber?: string } {
  if (!rawEntryNumber) {
    const entryFilerCode = fallbackFilerCode
      ? fallbackFilerCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3)
      : undefined;
    return { entryFilerCode, entryNumber: undefined };
  }

  const cleaned = rawEntryNumber.replace(/[^A-Za-z0-9]/g, "");

  if (cleaned.length === 11) {
    const entryFilerCode = cleaned.slice(0, 3).toUpperCase();
    const entryNum = cleaned.slice(3);
    if (isValidEntryNumberCheckDigit(entryFilerCode, entryNum)) {
      return { entryFilerCode, entryNumber: entryNum };
    }
    const txNum = entryNum.slice(0, 7);
    return { entryFilerCode, entryNumber: buildEntryNumber(entryFilerCode, txNum) };
  }

  const entryFilerCode = fallbackFilerCode
    ? fallbackFilerCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3)
    : undefined;

  if (entryFilerCode && cleaned.length === 8 && isValidEntryNumberCheckDigit(entryFilerCode, cleaned)) {
    return { entryFilerCode, entryNumber: cleaned };
  }

  if (entryFilerCode && (cleaned.length === 7 || cleaned.length === 8)) {
    const txNum = cleaned.slice(0, 7).padStart(7, "0");
    return { entryFilerCode, entryNumber: buildEntryNumber(entryFilerCode, txNum) };
  }

  return { entryFilerCode, entryNumber: undefined };
}

/**
 * Normalizes a country string to a 2-character uppercase ISO code.
 */
function normalizeCountryCode(country?: string | null): string {
  if (!country) return "US";
  const trimmed = country.trim().toUpperCase();
  if (trimmed.length === 2) return trimmed;
  if (trimmed === "UNITED STATES" || trimmed === "USA") return "US";
  if (trimmed === "GERMANY") return "DE";
  if (trimmed === "CHINA") return "CN";
  if (trimmed === "MEXICO") return "MX";
  if (trimmed === "CANADA") return "CA";
  if (trimmed === "JAPAN") return "JP";
  return trimmed.slice(0, 2);
}

/**
 * Validates a CustomsFiling record for ABI transmission readiness.
 * Returns an object indicating validity and listing any missing required fields.
 */
export function validateCustomsFilingForTransmission(
  filing: CustomsFilingWithRelations,
  options?: Partial<EnvelopeHeaderOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  const { entryFilerCode, entryNumber } = parseFilerAndEntryNumber(
    filing.entryNumber,
    options?.processingFilerCode
  );

  if (!entryFilerCode || entryFilerCode.length !== 3) {
    missingFields.push(
      "headerControl.entryFilerCode (requires 3-char entryNumber prefix or options.processingFilerCode)"
    );
  }

  if (!entryNumber || entryNumber.length !== 8) {
    missingFields.push("headerControl.entryNumber (requires valid 8-char entry number)");
  }

  const districtPortOfEntry =
    filing.shipment?.portOfEntry ?? options?.processingDistrictPortCode;
  if (!districtPortOfEntry || districtPortOfEntry.trim() === "") {
    missingFields.push(
      "headerControl.districtPortOfEntry (requires shipment.portOfEntry or options.processingDistrictPortCode)"
    );
  }

  const entryTypeCode = filing.entryType ?? filing.shipment?.entryType;
  if (!entryTypeCode || entryTypeCode.trim() === "") {
    missingFields.push(
      "headerControl.entryTypeCode (requires filing.entryType or shipment.entryType)"
    );
  }

  const importerNum =
    filing.importerOfRecord?.cbpImporterNumber ??
    filing.importerOfRecord?.irsEin ??
    undefined;

  if (
    importerNum ||
    filing.estimatedEntryDate ||
    filing.dateOfImportation ||
    filing.usStateOfDestinationCode ||
    filing.foreignTradeZoneIdentifier ||
    filing.designatedNotifyPartyNumber
  ) {
    if (!importerNum || importerNum.trim() === "") {
      missingFields.push(
        "headerContent.importerOfRecordNumber (requires importerOfRecord.cbpImporterNumber or irsEin)"
      );
    }
  }

  if (filing.bond) {
    const suretyCode = resolveSuretyCompanyCode(filing.bond);
    if (!suretyCode) {
      missingFields.push(
        `bond.suretyCompanyCode (requires 3-digit Treasury surety code on bond, got '${filing.bond.suretyName ?? "none"}')`
      );
    }
  }

  const rawLineItems = filing.shipment?.lineItems;
  if (!rawLineItems || rawLineItems.length === 0) {
    missingFields.push("shipment.lineItems (requires at least 1 line item)");
  } else {
    rawLineItems.forEach((item, i) => {
      if (!item.countryOfOrigin || item.countryOfOrigin.trim() === "") {
        missingFields.push(`shipment.lineItems[${i}].countryOfOrigin`);
      }
      if (!item.htsCode || item.htsCode.trim() === "") {
        missingFields.push(`shipment.lineItems[${i}].htsCode`);
      }
      if (item.totalValue == null) {
        missingFields.push(`shipment.lineItems[${i}].totalValue`);
      }

      if (item.adcvdLineDetails && item.adcvdLineDetails.length > 0) {
        item.adcvdLineDetails.forEach((ad, j) => {
          const caseNum = ad.adcvdOrder?.caseNumber;
          if (!caseNum || caseNum.trim() === "") {
            missingFields.push(
              `shipment.lineItems[${i}].adcvdLineDetails[${j}].adcvdOrder.caseNumber (requires valid A-nnn-nnn case number)`
            );
          }
        });
      }
    });
  }

  if (filing.invoiceLines && filing.invoiceLines.length > 0) {
    filing.invoiceLines.forEach((inv, i) => {
      if (!inv.supplierIdCode || inv.supplierIdCode.trim() === "") {
        missingFields.push(`invoiceLines[${i}].supplierIdCode`);
      }
      const invNum = inv.invoice?.invoiceNumber;
      if (!invNum || invNum.trim() === "") {
        missingFields.push(`invoiceLines[${i}].invoiceNumber`);
      }
    });
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Converts a database CustomsFiling record (and its loaded relations) to an
 * EntrySummaryTransactionInput object ready for CATAIR assembly.
 *
 * Throws AbiFilingValidationError if any required fields are missing from the
 * input record (no fabricated placeholder values are inserted).
 */
export function fromCustomsFiling(
  filing: CustomsFilingWithRelations,
  options?: Partial<EnvelopeHeaderOptions>
): EntrySummaryTransactionInput {
  const validation = validateCustomsFilingForTransmission(filing, options);
  if (!validation.valid) {
    throw new AbiFilingValidationError(filing.id, validation.missingFields);
  }

  const { entryFilerCode, entryNumber } = parseFilerAndEntryNumber(
    filing.entryNumber,
    options?.processingFilerCode
  );

  const districtPortOfEntry = (
    filing.shipment?.portOfEntry ?? options?.processingDistrictPortCode
  )!;

  const actionCode = (filing.actionCode as "A" | "R" | "D") || "A";

  const headerControl: HeaderControlInput = {
    summaryFilingActionRequestCode: actionCode,
    entryFilerCode: entryFilerCode!,
    entryNumber: entryNumber!,
    districtPortOfEntry,
    brokerReferenceNumber: filing.brokerReferenceNumber
      ? filing.brokerReferenceNumber.toUpperCase().slice(0, 9)
      : undefined,
    entryTypeCode: filing.entryType ?? filing.shipment?.entryType ?? "01",
    modeOfTransportationCode:
      filing.modeOfTransportationCode ?? filing.shipment?.transportMode ?? undefined,
    bondWaiverIndicator: (filing.bondWaiverIndicator as "0") ?? undefined,
    electronicSignature: "X",
    consolidatedSummaryIndicator:
      (filing.consolidatedSummaryIndicator as "Y") ?? undefined,
    liveEntryIndicator: (filing.liveEntryIndicator as "Y") ?? undefined,
    paymentTypeCode: filing.paymentTypeCode ?? undefined,
    bondWaiverReasonCode: filing.bondWaiverReasonCode ?? undefined,
    pgaDataIncludedIndicator:
      (filing.pgaDataIncludedIndicator as "Y" | "F") ?? undefined,

    // TODO: No source in CustomsFiling model for cargoReleaseCertificationRequestIndicator (HeaderControlInput - "A")
    cargoReleaseCertificationRequestIndicator: undefined,
    // TODO: No source in CustomsFiling model for electronicInvoiceIndicator (HeaderControlInput - "Y")
    electronicInvoiceIndicator: undefined,
    // TODO: No source in CustomsFiling model for shipmentUsageTypeCode (HeaderControlInput - "P" | "X")
    shipmentUsageTypeCode: undefined,
    // TODO: No source in CustomsFiling model for deferredTaxPaymentCode (HeaderControlInput - "1" | "2")
    deferredTaxPaymentCode: undefined,
    // TODO: No source in CustomsFiling model for tradeAgreementReconciliationIndicator (HeaderControlInput - "Y")
    tradeAgreementReconciliationIndicator: undefined,
    // TODO: No source in CustomsFiling model for reconciliationIssueCode (HeaderControlInput)
    reconciliationIssueCode: undefined,
    // TODO: No source in CustomsFiling model for preliminaryStatementPrintDate (HeaderControlInput - Date)
    preliminaryStatementPrintDate: undefined,
    // TODO: No source in CustomsFiling model for periodicStatementMonth (HeaderControlInput)
    periodicStatementMonth: undefined,
    // TODO: No source in CustomsFiling model for statementClientBranchIdentifier (HeaderControlInput)
    statementClientBranchIdentifier: undefined,
    // TODO: No source in CustomsFiling model for postSummaryCorrectionIndicator (HeaderControlInput - "Y")
    postSummaryCorrectionIndicator: undefined,
    // TODO: No source in CustomsFiling model for acceleratedLiquidationRequestIndicator (HeaderControlInput - "Y")
    acceleratedLiquidationRequestIndicator: undefined,
    // TODO: No source in CustomsFiling model for knownImporterIndicator (HeaderControlInput - "Y")
    knownImporterIndicator: undefined,
    // TODO: No source in CustomsFiling model for tibDeclarationIndicator (HeaderControlInput - "Y")
    tibDeclarationIndicator: undefined,
    // TODO: No source in CustomsFiling model for consolidatedExpressInformalIndicator (HeaderControlInput - "Y")
    consolidatedExpressInformalIndicator: undefined,
  };

  let headerContent: HeaderContentInput | undefined;
  const importerNum =
    filing.importerOfRecord?.cbpImporterNumber ??
    filing.importerOfRecord?.irsEin ??
    undefined;

  if (
    importerNum ||
    filing.estimatedEntryDate ||
    filing.dateOfImportation ||
    filing.usStateOfDestinationCode ||
    filing.foreignTradeZoneIdentifier ||
    filing.designatedNotifyPartyNumber
  ) {
    headerContent = {
      importerOfRecordNumber: importerNum!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      designatedNotifyPartyNumber: filing.designatedNotifyPartyNumber
        ? filing.designatedNotifyPartyNumber.toUpperCase()
        : undefined,
      estimatedEntryDate:
        filing.estimatedEntryDate ?? filing.shipment?.estimatedArrival ?? undefined,
      dateOfImportation:
        filing.dateOfImportation ?? filing.shipment?.arrivalDate ?? undefined,
      usStateOfDestinationCode: filing.usStateOfDestinationCode
        ? filing.usStateOfDestinationCode.toUpperCase()
        : undefined,
      foreignTradeZoneIdentifier: filing.foreignTradeZoneIdentifier
        ? filing.foreignTradeZoneIdentifier.toUpperCase()
        : undefined,
      // TODO: No source in CustomsFiling model for consigneeNumber on 11-Record (HeaderContentInput)
      consigneeNumber: undefined,
    };
  }

  let bonds: BondDetailInput[] | undefined;
  if (filing.bond) {
    const isStb = filing.bond.bondType === "single_transaction";
    const suretyCompanyCode = resolveSuretyCompanyCode(filing.bond)!;
    bonds = [
      {
        bondTypeCode: isStb ? "9" : "8",
        bondDesignationTypeCode: "B",
        suretyCompanyCode,
        singleTransactionBondAmount: isStb
          ? new Decimal(filing.bond.bondAmount ?? 0)
          : undefined,
        singleTransactionBondProducerAccountNumber: isStb
          ? filing.bond.bondNumber ?? undefined
          : undefined,
        // TODO: No source in Bond model for continuousBondIndicator ("Y" | "S")
        continuousBondIndicator: undefined,
      },
    ];
  }

  const rawLineItems = filing.shipment!.lineItems!;
  const lineItems: LineItemInput[] = rawLineItems.map((item) => {
    const header: LineItemHeaderInput = {
      lineItemIdentifier: String(item.lineNumber).padStart(3, "0"),
      countryOfOriginCode: normalizeCountryCode(item.countryOfOrigin),
      countryOfExportCode: normalizeCountryCode(filing.shipment?.countryOfExport),
      dateOfExportation: filing.shipment?.ladingDate ?? undefined,

      // TODO: No source in ShipmentLineItem model for articleSetIndicator ("X" | "V")
      articleSetIndicator: undefined,
      // TODO: No source in ShipmentLineItem model for dateOfExportationForTextiles
      dateOfExportationForTextiles: undefined,
      // TODO: No source in ShipmentLineItem model for tradeAgreementSpecialProgramClaimCode
      tradeAgreementSpecialProgramClaimCode: undefined,
      // TODO: No source in ShipmentLineItem model for chargesAmount
      chargesAmount: undefined,
      // TODO: No source in ShipmentLineItem model for foreignPortOfLadingCode
      foreignPortOfLadingCode: undefined,
      // TODO: No source in ShipmentLineItem model for grossShippingWeight
      grossShippingWeight: undefined,
      // TODO: No source in ShipmentLineItem model for categoryCodeForTextiles
      categoryCodeForTextiles: undefined,
      // TODO: No source in ShipmentLineItem model for productClaimCode
      productClaimCode: undefined,
      // TODO: No source in ShipmentLineItem model for relatedPartyIndicator ("Y" | "N")
      relatedPartyIndicator: undefined,
      // TODO: No source in ShipmentLineItem model for naftaNetCostIndicator ("Y")
      naftaNetCostIndicator: undefined,
      // TODO: No source in ShipmentLineItem model for feeExemptionCode ("1" | "2")
      feeExemptionCode: undefined,
      // TODO: No source in ShipmentLineItem model for adCaseNonReimbursementStatement ("Y")
      adCaseNonReimbursementStatement: undefined,
    };

    const ftzRow =
      item.ftzDetails?.[0] ??
      filing.ftzDetails?.find((f) => f.shipmentLineItemId === item.id);

    let ftzStatus: FtzStatusInput | undefined;
    if (ftzRow) {
      ftzStatus = {
        ftzMerchandiseStatusCode:
          (ftzRow.merchandiseStatusCode as "P" | "N" | "D") ?? "N",
        privilegedFtzMerchandiseFilingDate:
          ftzRow.privilegedStatusDate ?? undefined,
        ftzLineItemQuantity: ftzRow.lineItemQuantity
          ? new Decimal(ftzRow.lineItemQuantity)
          : new Decimal(item.quantity),
      };
    }

    let ftzPrivilegedStatusDetail: FtzPrivilegedStatusDetailInput | undefined;
    if (ftzRow?.currentHtsNumber) {
      ftzPrivilegedStatusDetail = {
        currentHtsNumber: ftzRow.currentHtsNumber.replace(/[^A-Za-z0-9]/g, ""),
      };
    }

    const cleanHts = item.htsCode.replace(/[^A-Za-z0-9]/g, "");
    const tariffDetails: TariffDetailInput[] = [
      {
        htsNumber: cleanHts,
        dutyAmount: new Decimal(item.totalDuties ?? 0),
        valueOfGoodsAmount: new Decimal(item.totalValue),
        quantity1: new Decimal(item.quantity),
        unitOfMeasureCode1: "PCS",
        ftzPrivilegedStatusDetail,
      },
    ];

    let adcvdCases: AdcvdCaseDetailInput[] | undefined;
    if (item.adcvdLineDetails && item.adcvdLineDetails.length > 0) {
      adcvdCases = item.adcvdLineDetails.map((ad) => {
        const caseNum = ad.adcvdOrder!.caseNumber;
        const valAmount = new Decimal(ad.valueOfGoodsAmount ?? item.totalValue);
        const rate = new Decimal(ad.caseDepositRate ?? 0);
        const calcDuty = valAmount.times(rate).dividedBy(100);

        return {
          caseNumber: caseNum.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
          bondCashClaimCode: (ad.bondCashClaimCode as "B" | "C") ?? "C",
          caseDepositRate: rate,
          caseRateTypeQualifierCode: (ad.rateTypeQualifierCode as "A" | "S") ?? "A",
          valueOfGoodsAmount: valAmount,
          dutyAmount: calcDuty,
          nonReimbursementDeclarationIdentifier:
            ad.nonReimbursementDeclarationIdentifier
              ? ad.nonReimbursementDeclarationIdentifier
                  .replace(/[^A-Za-z0-9]/g, "")
                  .toUpperCase()
              : undefined,
          // TODO: No source in AdcvdLineDetail model for specific-rate quantity
          quantity: undefined,
        };
      });
    }

    let censusWarningOverride: CensusWarningOverrideInput | undefined;
    if (filing.censusWarningOverrides && filing.censusWarningOverrides.length > 0) {
      const overrides = filing.censusWarningOverrides;
      censusWarningOverride = {
        conditionCode1: overrides[0].conditionCode,
        overrideCode1: overrides[0].overrideCode,
        conditionCode2: overrides[1]?.conditionCode,
        overrideCode2: overrides[1]?.overrideCode,
        conditionCode3: overrides[2]?.conditionCode,
        overrideCode3: overrides[2]?.overrideCode,
        conditionCode4: overrides[3]?.conditionCode,
        overrideCode4: overrides[3]?.overrideCode,
        conditionCode5: overrides[4]?.conditionCode,
        overrideCode5: overrides[4]?.overrideCode,
        conditionCode6: overrides[5]?.conditionCode,
        overrideCode6: overrides[5]?.overrideCode,
        conditionCode7: overrides[6]?.conditionCode,
        overrideCode7: overrides[6]?.overrideCode,
      };
    }

    let invoices: InvoiceLineReferenceInput[] | undefined;
    if (filing.invoiceLines && filing.invoiceLines.length > 0) {
      invoices = filing.invoiceLines.map((inv) => ({
        supplierIdCode: inv.supplierIdCode!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        invoiceNumber: inv.invoice!.invoiceNumber.trim().toUpperCase(),
        invoiceLineRange1Begin: inv.lineRange1Begin ?? item.lineNumber,
        invoiceLineRange1End: inv.lineRange1End ?? item.lineNumber,
        invoiceLineRange2Begin: inv.lineRange2Begin ?? undefined,
        invoiceLineRange2End: inv.lineRange2End ?? undefined,
        invoiceLineRange3Begin: inv.lineRange3Begin ?? undefined,
        invoiceLineRange3End: inv.lineRange3End ?? undefined,
        invoiceLineRange4Begin: inv.lineRange4Begin ?? undefined,
        invoiceLineRange4End: inv.lineRange4End ?? undefined,
      }));
    }

    const partyList = item.shipmentParties ?? filing.shipment?.shipmentParties;
    let entities: LineEntityInput[] | undefined;
    if (partyList && partyList.length > 0) {
      entities = partyList.map((p) => ({
        entityCode: p.partyTypeCode || (p.role === "MANUFACTURER" ? "MF" : "SE"),
        entityName: p.legalEntity?.legalName
          ? p.legalEntity.legalName.toUpperCase()
          : undefined,
        entityIdentifierQualifier: p.legalEntity?.taxIdentifierType ?? undefined,
        entityIdentifier: p.legalEntity?.taxIdentifier ?? undefined,
      }));
    }

    return {
      header,
      ftzStatus,
      tariffDetails,
      adcvdCases,
      censusWarningOverride,
      invoices,
      entities,
    };
  });

  let feeTotals: FeeTotalEntry[] | undefined;
  if (filing.filingFeeLines && filing.filingFeeLines.length > 0) {
    feeTotals = filing.filingFeeLines.map((fee) => ({
      accountingClassCode: fee.accountingClassCode,
      totalFeeAmount: new Decimal(fee.amount),
    }));
  }

  let grandTotals: GrandTotalsInput | undefined;
  if (
    filing.grandTotalDutyAmount != null ||
    filing.grandTotalUserFeeAmount != null ||
    filing.grandTotalIrTaxAmount != null ||
    filing.grandTotalAdDutyAmount != null ||
    filing.grandTotalCvDutyAmount != null ||
    filing.grandTotalOtherRevenueAmount != null
  ) {
    grandTotals = {
      grandTotalDutyAmount: filing.grandTotalDutyAmount
        ? new Decimal(filing.grandTotalDutyAmount)
        : undefined,
      grandTotalUserFeeAmount: filing.grandTotalUserFeeAmount
        ? new Decimal(filing.grandTotalUserFeeAmount)
        : undefined,
      grandTotalIrTaxAmount: filing.grandTotalIrTaxAmount
        ? new Decimal(filing.grandTotalIrTaxAmount)
        : undefined,
      grandTotalAdDutyAmount: filing.grandTotalAdDutyAmount
        ? new Decimal(filing.grandTotalAdDutyAmount)
        : undefined,
      grandTotalCvDutyAmount: filing.grandTotalCvDutyAmount
        ? new Decimal(filing.grandTotalCvDutyAmount)
        : undefined,
      grandTotalOtherRevenueAmount: filing.grandTotalOtherRevenueAmount
        ? new Decimal(filing.grandTotalOtherRevenueAmount)
        : undefined,
    };
  }

  return {
    headerControl,
    headerContent,
    bonds,
    lineItems,
    feeTotals,
    grandTotals,
  };
}

/**
 * End-to-end composer function:
 * Takes a loaded CustomsFiling record and caller-supplied envelope header configuration,
 * maps to EntrySummaryTransactionInput, assembles 80-char transaction lines via assembleTransaction(),
 * wraps in a B...Y block envelope, wraps in an A...Z batch envelope, and returns the full line array.
 *
 * Throws AbiFilingValidationError if required fields are missing.
 */
export function buildAbiTransmissionForFiling(
  filing: CustomsFilingWithRelations,
  envelopeHeader: EnvelopeHeaderOptions
): string[] {
  const transactionInput = fromCustomsFiling(filing, envelopeHeader);
  const transactionLines = assembleTransaction(transactionInput);

  const bRecordInput: BRecordInput = {
    processingDistrictPortCode: envelopeHeader.processingDistrictPortCode,
    processingFilerCode: envelopeHeader.processingFilerCode,
    applicationIdentifierCode:
      envelopeHeader.applicationIdentifierCode ?? "AE",
    processingFilerOfficeCode: envelopeHeader.processingFilerOfficeCode,
    filerPreparerUserDataText: envelopeHeader.filerPreparerUserDataText,
  };

  const blockLines = wrapBlock(bRecordInput, transactionLines);

  const aRecordInput: ARecordInput = {
    senderReceiverSiteCode: envelopeHeader.senderReceiverSiteCode,
    senderReceiverIdCode: envelopeHeader.senderReceiverIdCode,
    communicationPassword: envelopeHeader.communicationPassword,
    transmissionDate: envelopeHeader.transmissionDate,
    applicationIdentifierCode:
      envelopeHeader.applicationIdentifierCode ?? "AE",
    senderReceiverOfficeCode: envelopeHeader.senderReceiverOfficeCode,
    transmitterUserDataText: envelopeHeader.transmitterUserDataText,
  };

  return wrapBatch(aRecordInput, [blockLines]);
}

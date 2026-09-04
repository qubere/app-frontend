import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import {
  HEADER_CONTROL_SPEC,
  HEADER_CONTENT_SPEC,
  LINE_ITEM_HEADER_SPEC,
  TARIFF_DETAIL_SPEC,
  FEE_TOTAL_SPEC,
  GRAND_TOTALS_SPEC,
  BOND_DETAIL_SPEC,
  FTZ_STATUS_SPEC,
  FTZ_PRIVILEGED_STATUS_DETAIL_SPEC,
  ADCVD_CASE_DETAIL_SPEC,
  ADCVD_DUTY_TOTALS_SPEC,
  INVOICE_LINE_REFERENCE_SPEC,
  RULINGS_DETAIL_SPEC,
  COMMERCIAL_DESCRIPTION_SPEC,
  LICENSE_CERTIFICATE_PERMIT_SPEC,
  LINE_ENTITY_SPEC,
  LINE_ENTITY_GBI_SPEC,
  LINE_ENTITY_STREET_ADDRESS_SPEC,
  LINE_ENTITY_GEOGRAPHIC_AREA_SPEC,
  LINE_ENTITY_GBI_PARTY_TYPE_SPEC,
  HEADER_ENTITY_SPEC,
  HEADER_ENTITY_GBI_SPEC,
  HEADER_ENTITY_STREET_ADDRESS_SPEC,
  HEADER_ENTITY_GEOGRAPHIC_AREA_SPEC,
  HEADER_ENTITY_GBI_PARTY_TYPE_SPEC,
  ARTICLE_PARTY_SPEC,
  STANDARD_VISA_SPEC,
  IMPORTERS_ADDITIONAL_DECLARATION_SPEC,
  HEADER_FEES_SPEC,
  LINE_USER_FEE_SPEC,
  IR_TAX_SPEC,
  OTHER_REVENUE_SPEC,
  PSC_HEADER_REASONS_SPEC,
  PSC_FILING_EXPLANATION_SPEC,
  PSC_LINE_REASONS_SPEC,
  CENSUS_WARNING_OVERRIDE_SPEC,
} from "./recordSpecs";
import type {
  HeaderControlInput,
  HeaderContentInput,
  LineItemHeaderInput,
  TariffDetailInput,
  FeeTotalEntry,
  FeeTotalInput,
  GrandTotalsInput,
  BondDetailInput,
  FtzStatusInput,
  FtzPrivilegedStatusDetailInput,
  AdcvdCaseDetailInput,
  AdcvdDutyTotalsInput,
  InvoiceLineReferenceInput,
  RulingsDetailInput,
  CommercialDescriptionInput,
  LicenseCertificatePermitInput,
  LineEntityInput,
  LineEntityGbiInput,
  LineEntityStreetAddressInput,
  LineEntityGeographicAreaInput,
  GbiPartyTypeDescriptionInput,
  ArticlePartyInput,
  StandardVisaInput,
  ImportersAdditionalDeclarationInput,
  HeaderFeesInput,
  LineUserFeeInput,
  IrTaxInput,
  OtherRevenueInput,
  PscHeaderReasonsInput,
  PscFilingExplanationInput,
  PscLineReasonsInput,
  CensusWarningOverrideInput,
} from "./types";

/**
 * Builds the 10-Record. Validates the Entry Number's check digit against
 * Appendix E before encoding — a wrong check digit is a guaranteed CBP
 * rejection, so it's better to fail fast here than find out from ACE. Use
 * `buildEntryNumber()` from `@/lib/abi/entryNumber` to compute a correct one.
 */
export function buildHeaderControl(input: HeaderControlInput): string {
  if (!isValidEntryNumberCheckDigit(input.entryFilerCode, input.entryNumber)) {
    throw new AbiFixedWidthError(
      `10-Record: Entry Number "${input.entryNumber}" has an invalid check digit for Entry Filer Code "${input.entryFilerCode}" (Appendix E). Use buildEntryNumber() to compute one.`
    );
  }
  return encodeRecord(HEADER_CONTROL_SPEC, input);
}

export function buildHeaderContent(input: HeaderContentInput): string {
  return encodeRecord(HEADER_CONTENT_SPEC, input);
}

export function buildLineItemHeader(input: LineItemHeaderInput): string {
  return encodeRecord(LINE_ITEM_HEADER_SPEC, input);
}

export function buildTariffDetail(input: TariffDetailInput): string {
  return encodeRecord(TARIFF_DETAIL_SPEC, input);
}

/** Accepts 1-5 fee entries and maps them onto the 89-Record's 5 fixed positional pairs. */
export function buildFeeTotal(fees: FeeTotalEntry[]): string {
  if (fees.length < 1 || fees.length > 5) {
    throw new AbiFixedWidthError(
      `89-Record (Fee Total Detail): expects 1-5 fee entries, got ${fees.length}.`
    );
  }
  const input: Partial<FeeTotalInput> = {};
  fees.forEach((fee, i) => {
    const n = i + 1;
    (input as Record<string, unknown>)[`accountingClassCode${n}`] = fee.accountingClassCode;
    (input as Record<string, unknown>)[`totalFeeAmount${n}`] = fee.totalFeeAmount;
  });
  return encodeRecord(FEE_TOTAL_SPEC, input as FeeTotalInput);
}

export function buildGrandTotals(input: GrandTotalsInput): string {
  return encodeRecord(GRAND_TOTALS_SPEC, input);
}

/** Builds a 31-Record. The Bond Grouping allows up to 2 of these per summary
 * — callers assemble that occurrence limit themselves; this just encodes one. */
export function buildBondDetail(input: BondDetailInput): string {
  return encodeRecord(BOND_DETAIL_SPEC, input);
}

export function buildFtzStatus(input: FtzStatusInput): string {
  return encodeRecord(FTZ_STATUS_SPEC, input);
}

export function buildFtzPrivilegedStatusDetail(input: FtzPrivilegedStatusDetailInput): string {
  return encodeRecord(FTZ_PRIVILEGED_STATUS_DETAIL_SPEC, input);
}

/** Builds a 53-Record. Up to 2 of these are allowed per line item — callers
 * assemble that occurrence limit themselves; this just encodes one. */
export function buildAdcvdCaseDetail(input: AdcvdCaseDetailInput): string {
  return encodeRecord(ADCVD_CASE_DETAIL_SPEC, input);
}

export function buildAdcvdDutyTotals(input: AdcvdDutyTotalsInput): string {
  return encodeRecord(ADCVD_DUTY_TOTALS_SPEC, input);
}

export function buildInvoiceLineReference(input: InvoiceLineReferenceInput): string {
  return encodeRecord(INVOICE_LINE_REFERENCE_SPEC, input);
}

export function buildRulingsDetail(input: RulingsDetailInput): string {
  return encodeRecord(RULINGS_DETAIL_SPEC, input);
}

export function buildCommercialDescription(input: CommercialDescriptionInput): string {
  return encodeRecord(COMMERCIAL_DESCRIPTION_SPEC, input);
}

export function buildLicenseCertificatePermit(input: LicenseCertificatePermitInput): string {
  return encodeRecord(LICENSE_CERTIFICATE_PERMIT_SPEC, input);
}

export function buildLineEntity(input: LineEntityInput): string {
  return encodeRecord(LINE_ENTITY_SPEC, input);
}

export function buildLineEntityGbi(input: LineEntityGbiInput): string {
  return encodeRecord(LINE_ENTITY_GBI_SPEC, input);
}

export function buildLineEntityStreetAddress(input: LineEntityStreetAddressInput): string {
  return encodeRecord(LINE_ENTITY_STREET_ADDRESS_SPEC, input);
}

export function buildLineEntityGeographicArea(input: LineEntityGeographicAreaInput): string {
  return encodeRecord(LINE_ENTITY_GEOGRAPHIC_AREA_SPEC, input);
}

export function buildLineEntityGbiPartyType(input: GbiPartyTypeDescriptionInput): string {
  return encodeRecord(LINE_ENTITY_GBI_PARTY_TYPE_SPEC, input);
}

export function buildHeaderEntity(input: LineEntityInput): string {
  return encodeRecord(HEADER_ENTITY_SPEC, input);
}

export function buildHeaderEntityGbi(input: LineEntityGbiInput): string {
  return encodeRecord(HEADER_ENTITY_GBI_SPEC, input);
}

export function buildHeaderEntityStreetAddress(input: LineEntityStreetAddressInput): string {
  return encodeRecord(HEADER_ENTITY_STREET_ADDRESS_SPEC, input);
}

export function buildHeaderEntityGeographicArea(input: LineEntityGeographicAreaInput): string {
  return encodeRecord(HEADER_ENTITY_GEOGRAPHIC_AREA_SPEC, input);
}

export function buildHeaderEntityGbiPartyType(input: GbiPartyTypeDescriptionInput): string {
  return encodeRecord(HEADER_ENTITY_GBI_PARTY_TYPE_SPEC, input);
}

export function buildArticleParty(input: ArticlePartyInput): string {
  return encodeRecord(ARTICLE_PARTY_SPEC, input);
}

export function buildStandardVisa(input: StandardVisaInput): string {
  return encodeRecord(STANDARD_VISA_SPEC, input);
}

export function buildImportersAdditionalDeclaration(input: ImportersAdditionalDeclarationInput): string {
  return encodeRecord(IMPORTERS_ADDITIONAL_DECLARATION_SPEC, input);
}

export function buildHeaderFees(input: HeaderFeesInput): string {
  return encodeRecord(HEADER_FEES_SPEC, input);
}

export function buildLineUserFee(input: LineUserFeeInput): string {
  return encodeRecord(LINE_USER_FEE_SPEC, input);
}

export function buildIrTax(input: IrTaxInput): string {
  return encodeRecord(IR_TAX_SPEC, input);
}

export function buildOtherRevenue(input: OtherRevenueInput): string {
  return encodeRecord(OTHER_REVENUE_SPEC, input);
}

export function buildPscHeaderReasons(input: PscHeaderReasonsInput): string {
  return encodeRecord(PSC_HEADER_REASONS_SPEC, input);
}

export function buildPscFilingExplanation(input: PscFilingExplanationInput): string {
  return encodeRecord(PSC_FILING_EXPLANATION_SPEC, input);
}

export function buildPscLineReasons(input: PscLineReasonsInput): string {
  return encodeRecord(PSC_LINE_REASONS_SPEC, input);
}

export function buildCensusWarningOverride(input: CensusWarningOverrideInput): string {
  return encodeRecord(CENSUS_WARNING_OVERRIDE_SPEC, input);
}

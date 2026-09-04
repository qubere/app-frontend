import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR PGA (Participating Government Agencies) Message Set
// chapter (Chapter 8) — the 28 generic, cross-agency backbone input records
// (OI, PG01, PG02, PG04, PG06, PG07, PG08, PG10, PG13, PG14, PG18, PG19,
// PG20, PG21, PG22, PG24, PG25, PG26, PG27, PG29, PG30, PG32, PG34, PG50,
// PG51, PG55, PG60, PG00) plus the 7 agency-specific record variants (PG05
// FWS/APHIS Lacey Act scientific species, PG17 FWS live venomous
// wildlife/carton counts, PG23 FDA Affirmation of Compliance, PG28 FDA can
// dimensions & package tracking, PG31 NOAA NMFS harvesting vessel, PG33 NOAA
// NMFS geographic area, PG35 DOT NHTSA conformance bond). Source:
// docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf

/** OI-Record: exactly one per HTS line item, must precede all PG01 records
 * for that line (see `validatePg01Disclaimer`-style business rules). */
export interface OiLineItemInput {
  commercialDescription: string;
}

/** PG01-Record: PGA line number, agency & program header. One PG01 opens each
 * PGA line under a tariff line; line numbers restart at "001" per agency
 * code within a tariff line. */
export interface Pg01HeaderInput {
  /** 3-digit sequential PGA line number, e.g. "001" — restarts at 001 when
   * the agency code changes; leading zero significant. */
  pgaLineNumber: string;
  governmentAgencyCode: string;
  governmentAgencyProgramCode: string;
  governmentAgencyProcessingCode?: string;
  electronicImageSubmitted?: string;
  confidentialInformationIndicator?: string;
  globallyUniqueProductIdentificationCodeQualifier?: string;
  globallyUniqueProductIdentificationCode?: string;
  intendedUseCode?: string;
  intendedUseDescription?: string;
  correctionIndicator?: string;
  /** A=Not Regulated, B=Data Not Required, C=Filed Other Means, D=Filed Paper
   * (generic); E=FWS-only, F=FDA-only, G=USDA APHIS Lacey-only. */
  disclaimer?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
}

/** PG02-Record: at most one "P" (Product) record per PGA line, plus any
 * number of "C" (Component) records. */
export interface Pg02ProductComponentInput {
  itemType: "P" | "C";
  productCodeQualifier1?: string;
  productCodeNumber1?: string;
  productCodeQualifier2?: string;
  productCodeNumber2?: string;
  productCodeQualifier3?: string;
  productCodeNumber3?: string;
}

export interface Pg04ConstituentElementInput {
  constituentActiveIngredientQualifier?: string;
  nameOfConstituentElement?: string;
  /** Implied 2 decimal places on the wire. */
  quantityOfConstituentElement?: Decimal;
  unitOfMeasureConstituentElement?: string;
  /** Implied 4 decimal places on the wire. */
  percentOfConstituentElement?: Decimal;
}

export interface Pg06SourceProcessingInput {
  sourceTypeCode: string;
  countryCode?: string;
  geographicLocation?: string;
  /** MMDDCCYY, class N — see `dateFieldCCYY` in fixedWidth.ts. */
  processingStartDate?: Date;
  processingEndDate?: Date;
  processingTypeCode?: string;
  processingDescription?: string;
}

export interface Pg07TradeNameModelInput {
  tradeNameBrandName?: string;
  model?: string;
  /** MMCCYY (month + 4-digit year, no day component per the PDF's own note
   * that positions 55-56 — the month digits — "should be zero filled" when
   * only century/year is entered) — not a full calendar date, so kept as a
   * raw 6-char zero-padded string rather than `Date`. */
  manufactureMonthAndYear?: string;
  itemIdentityNumberQualifier?: string;
  itemIdentityNumber?: string;
}

export interface Pg08ItemIdentityOverflowInput {
  itemIdentityNumber1?: string;
  itemIdentityNumber2?: string;
  itemIdentityNumber3?: string;
  itemIdentityNumber4?: string;
}

export interface Pg10CategoryCharacteristicInput {
  categoryTypeCode?: string;
  categoryCode?: string;
  commodityQualifierCode?: string;
  commodityCharacteristicQualifier?: string;
  commodityCharacteristicDescription?: string;
}

export interface Pg13LpcoIssuerInput {
  issuerOfLpco?: string;
  lpcoIssuerGovernmentGeographicCodeQualifier?: string;
  locationOfIssuerOfTheLpco?: string;
  regionalDescriptionOfLocationOfAgencyIssuingLpco?: string;
}

export interface Pg14LpcoDetailsInput {
  /** 1=single use, 2=continuous, 3=general. */
  lpcoTransactionType?: number;
  lpcoType?: string;
  lpcoNumberOrName?: string;
  /** 1=Expiration Date, 2=Effective Date, 3=Date Issued or Signed, 4=Date Application Received. */
  lpcoDateQualifier?: number;
  /** MMDDCCYY, class N. */
  lpcoDate?: Date;
  /** Implied 4 decimal places on the wire. */
  lpcoQuantity?: Decimal;
  lpcoUnitOfMeasure?: string;
  exemptionCode?: string;
}

export interface Pg18HazmatInput {
  unDangerousGoodsCode?: string;
  hazardousClassCode?: string;
  epaHazardousWasteCode?: string;
  hazardousMaterialDescription?: string;
  /** UN packing group I/II/III as 1/2/3. */
  packagingGroupCode?: number;
}

export interface Pg19EntityIdentificationInput {
  entityRoleCode: string;
  entityIdentificationCode?: string;
  entityNumber?: string;
  entityName?: string;
  entityAddress1?: string;
}

export interface Pg20EntityAddressInput {
  entityAddress2?: string;
  entityApartmentSuiteNumber?: string;
  entityCity?: string;
  entityStateProvince?: string;
  entityCountry?: string;
  entityZipPostalCode?: string;
}

export interface Pg21IndividualContactInput {
  individualQualifier?: string;
  individualName?: string;
  telephoneNumberOfTheIndividual?: string;
  emailAddressOrFaxNumberForTheIndividual?: string;
}

export interface Pg22ImporterDeclarationInput {
  /** "Y" indicating the importer holds the substantiating document/signed confirmation. */
  importersSubstantiatingSignedDocument?: string;
  documentIdentifier?: string;
  conformanceDeclaration?: string;
  entityRoleCode?: string;
  declarationCode?: string;
  /** "Y" indicating the entity certifies the data or the signature is on file. */
  declarationCertification?: string;
  /** MMDDCCYY, class N — per the PDF: "Date of the signature in MMDDCCYY
   * (month, day, century, year) format." */
  dateOfSignature?: Date;
  invoiceNumber?: string;
  complianceDescription?: string;
}

export interface Pg24RemarksInput {
  remarksTypeCode?: string;
  remarksCode?: string;
  remarksText?: string;
}

export interface Pg25TemperatureLotValuesInput {
  temperatureQualifier?: string;
  degreeType?: string;
  /** "X" if the temperature is negative — `actualTemperature` itself is an
   * unsigned magnitude; sign is carried by this separate flag. */
  negativeNumber?: string;
  /** Implied 2 decimal places on the wire; unsigned magnitude — see `negativeNumber`. */
  actualTemperature?: Decimal;
  locationOfTemperatureRecording?: string;
  lotNumberQualifier?: string;
  lotNumber?: string;
  productionStartDateOfTheLot?: Date;
  productionEndDateOfTheLot?: Date;
  /** Whole US dollars — explicitly 0 implied decimals per the PDF, unlike
   * `pgaUnitValue` in this same record (2 implied decimals). */
  pgaLineValue?: Decimal;
  /** Implied 2 decimal places on the wire. */
  pgaUnitValue?: Decimal;
}

export interface Pg26PackagingBreakdownInput {
  /** 1 (outermost) through 6 (innermost); must be reported sequentially. */
  packagingQualifier: number;
  /** Implied 2 decimal places on the wire. */
  quantity?: Decimal;
  unitOfMeasurePackagingLevel?: string;
  packageIdentifier?: string;
  packagingMethod?: string;
  packageMaterial?: string;
  packageFiller?: string;
}

export interface Pg27ShippingContainerInput {
  containerNumber1: string;
  typeOfContainer1?: number;
  containerLength1?: number;
  containerNumber2?: string;
  typeOfContainer2?: number;
  containerLength2?: number;
  containerNumber3?: string;
  typeOfContainer3?: number;
  containerLength3?: number;
}

export interface Pg29CommodityQuantitiesInput {
  unitOfMeasurePgaLineNet?: string;
  /** Implied 2 decimal places on the wire. */
  commodityNetQuantityPgaLineNet?: Decimal;
  unitOfMeasurePgaLineGross?: string;
  commodityGrossQuantityPgaLineGross?: Decimal;
  unitOfMeasureIndividualUnitNet?: string;
  commodityNetQuantityIndividualUnitNet?: Decimal;
  unitOfMeasureIndividualUnitGross?: string;
  commodityGrossQuantityIndividualUnitGross?: Decimal;
}

export interface Pg30InspectionLocationInput {
  inspectionLaboratoryTestingStatus: string;
  /** MMDDCCYY, class N. */
  requestedOrScheduledDateOfInspection?: Date;
  /** Military HHMM, e.g. "0959" — leading zero significant, kept as a raw
   * zero-padded string rather than a lossy `parseInt`. */
  requestedOrScheduledTimeOfInspection?: string;
  inspectionOrArrivalLocationCode?: string;
  inspectionOrArrivalLocation?: string;
}

export interface Pg32CommodityRoutingInput {
  commodityRoutingTypeCode: string;
  commodityRoutingCountryCode?: string;
  commodityPoliticalSubunitOfRoutingQualifier?: string;
  commodityPoliticalSubunitOfRoutingNumber?: string;
  commodityPoliticalSubunitOfRoutingName?: string;
}

export interface Pg34TravelDocumentInput {
  travelDocumentTypeCode: string;
  travelDocumentNationality?: string;
  travelDocumentIdentifier?: string;
}

/** PG50/PG51 carry no data beyond the control identifier — the record's mere
 * presence marks the start/end of a repeating group (see
 * `validateGroupingStructure`-style business rules). */
export type Pg50GroupStartInput = Record<string, never>;
export type Pg51GroupEndInput = Record<string, never>;

export interface Pg55AdditionalEntityRolesInput {
  entityRoleCode1?: string;
  entityRoleCode2?: string;
  entityRoleCode3?: string;
  entityRoleCode4?: string;
  entityRoleCode5?: string;
  entityRoleCode6?: string;
  entityRoleCode7?: string;
  entityRoleCode8?: string;
  entityRoleCode9?: string;
  entityRoleCode10?: string;
}

export interface Pg60AdditionalReferenceInput {
  additionalInformationQualifierCode: string;
  additionalInformation: string;
}

export interface Pg00SubstitutionInput {
  substitutionIndicator: string;
  substitutionNumber: string;
}

// ── Agency-specific record variants (pp. 25, 33, 39, 44, 50, 52, 54) ───────

/** PG05-Record: FWS/USDA-APHIS Lacey Act scientific genus/species detail. Used
 * with PG06 to describe the genus/species-to-country-of-origin relationship. */
export interface Pg05ScientificSpeciesInput {
  scientificGenusName?: string;
  scientificSpeciesName?: string;
  scientificSubSpeciesName?: string;
  /** FWS Wildlife Category Code — see Appendix PGA. */
  scientificSpeciesCode?: string;
  /** FWS Description Code — see Appendix PGA (FWS Description Codes). */
  fwsDescriptionCode?: string;
}

/** PG17-Record: common name (specific/general) plus FWS live venomous
 * wildlife/carton-count detail. May repeat. */
export interface Pg17CommonNameVenomousInput {
  commonNameSpecific?: string;
  commonNameGeneral?: string;
  /** "Y" or "N". */
  liveVenomousWildlifeCode?: string;
  cartonsContainingWildlife?: number;
}

/** PG23-Record: FDA Affirmation of Compliance criteria. May repeat. */
export interface Pg23AffirmationOfComplianceInput {
  affirmationOfComplianceCode: string;
  affirmationOfComplianceDescription?: string;
}

/** PG28-Record: FDA can dimensions (acidified/low-acid canned foods) &
 * package tracking numbers. Can dimension sub-fields (inches + 16ths) carry
 * semantically significant leading zeros, so they're kept as raw zero-padded
 * strings rather than `parseInt`-derived numbers — same rationale as
 * `numericCodeField` elsewhere in this chapter. */
export interface Pg28CanDimensionsTrackingInput {
  canDimensions1?: string;
  canDimensions2?: string;
  canDimensions3?: string;
  packageTrackingNumberCode?: string;
  packageTrackingNumber?: string;
}

/** PG31-Record: NOAA/NMFS harvesting vessel characteristic. May repeat. */
export interface Pg31HarvestingVesselInput {
  commodityHarvestingVesselCharacteristicTypeCode: string;
  commodityHarvestingVesselCharacteristic: string;
  unitOfMeasureConveyance?: string;
  /** Kilograms; implied 2 decimal places on the wire. */
  harvestedCommodityNetWeight?: Decimal;
}

/** PG33-Record: NOAA/NMFS commodity geographic area (routing). */
export interface Pg33GeographicAreaInput {
  commodityGeographicAreaCode?: string;
  commodityGeographicAreaName?: string;
}

/** PG35-Record: DOT/NHTSA conformance bond detail. */
export interface Pg35ConformanceBondInput {
  dotSuretyCode?: string;
  dotBondSerialNumber?: string;
  /** 1=Single, 2=Continuous. */
  dotBondQualifier?: number;
  /** Whole US dollars — 0 implied decimals, same convention as PG25's
   * `pgaLineValue`. */
  dotBondAmount?: Decimal;
}

/** Structured payload shape for `PgaRequirement.agencyData Json?` */
export interface PgaAgencyDataPayload {
  fda?: {
    priorNoticeConfirmationNumber?: string;
    affirmationCodes?: string[];
    canDimensions?: {
      diameterInches?: string;
      diameterSixteenths?: string;
      heightInches?: string;
      heightSixteenths?: string;
    };
    temperatureControl?: {
      minTemperature?: number;
      maxTemperature?: number;
      unit?: string;
    };
    lotNumber?: string;
    expirationDate?: string;
  };
  epa?: {
    vehicleEngineClass?: string;
    modelYear?: string;
    engineFamilyName?: string;
    fuelType?: string;
    emissionsStandardCode?: string;
  };
  fws?: {
    genusName?: string;
    speciesName?: string;
    commonName?: string;
    wildlifeDescriptionCode?: string;
    quantityInPcs?: number;
    countryOfOriginOrHarvest?: string;
  };
  noaa?: {
    vesselName?: string;
    vesselFlagState?: string;
    gearCode?: string;
    catchAreaCode?: string;
    catchAreaName?: string;
    harvestStartDate?: string;
    harvestEndDate?: string;
  };
  usda?: {
    phytosanitaryCertificateNumber?: string;
    permitNumber?: string;
    treatmentCode?: string;
    treatmentMethod?: string;
  };
  cpsc?: {
    labIdCode?: string;
    labName?: string;
    testDate?: string;
    certificationContactName?: string;
  };
  additionalAttributes?: Record<string, unknown>;
}

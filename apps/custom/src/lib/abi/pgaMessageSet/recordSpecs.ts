import {
  dateFieldCCYY,
  filler,
  constantField,
  numericCodeField,
  type Designation,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import type {
  OiLineItemInput,
  Pg01HeaderInput,
  Pg02ProductComponentInput,
  Pg04ConstituentElementInput,
  Pg06SourceProcessingInput,
  Pg07TradeNameModelInput,
  Pg08ItemIdentityOverflowInput,
  Pg10CategoryCharacteristicInput,
  Pg13LpcoIssuerInput,
  Pg14LpcoDetailsInput,
  Pg18HazmatInput,
  Pg19EntityIdentificationInput,
  Pg20EntityAddressInput,
  Pg21IndividualContactInput,
  Pg22ImporterDeclarationInput,
  Pg24RemarksInput,
  Pg25TemperatureLotValuesInput,
  Pg26PackagingBreakdownInput,
  Pg27ShippingContainerInput,
  Pg29CommodityQuantitiesInput,
  Pg30InspectionLocationInput,
  Pg32CommodityRoutingInput,
  Pg34TravelDocumentInput,
  Pg50GroupStartInput,
  Pg51GroupEndInput,
  Pg55AdditionalEntityRolesInput,
  Pg60AdditionalReferenceInput,
  Pg00SubstitutionInput,
  Pg05ScientificSpeciesInput,
  Pg17CommonNameVenomousInput,
  Pg23AffirmationOfComplianceInput,
  Pg28CanDimensionsTrackingInput,
  Pg31HarvestingVesselInput,
  Pg33GeographicAreaInput,
  Pg35ConformanceBondInput,
} from "./types";

// RecordSpecs for the CATAIR PGA Message Set chapter (Chapter 8) — the 28
// generic, cross-agency backbone input records. Position math (including
// internal filler gaps) cross-checked against the extracted PDF tables.
// Source: docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf

/**
 * A right-justified, zero-padded numeric field with a per-field count of
 * implied decimal places, bound to `Decimal`. Unlike Statement Processing
 * (always 2 implied decimals) or eBond (always 0), PGA's implied-decimal
 * count varies field-by-field within the *same record* — e.g. PG25's PGA
 * Line Value (0 implied decimals, "in whole dollars") vs its PGA Unit Value
 * (2 implied decimals) — so the decimal count is a parameter here, not baked
 * into a chapter-wide helper.
 */
function impliedDecimalField<K extends string>(
  key: K,
  start: number,
  length: number,
  decimals: number,
  designation: Designation
): FieldSpec<K> {
  const scale = new Decimal(10).pow(decimals);
  return {
    key,
    start,
    length,
    class: "SN",
    designation,
    encodeValue: (raw) =>
      (raw as Decimal)
        .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
        .times(scale)
        .toDecimalPlaces(0)
        .toString()
        .padStart(length, "0"),
    decodeValue: (field) => {
      const trimmed = field.trim();
      return trimmed.length === 0 ? undefined : new Decimal(trimmed).dividedBy(scale);
    },
  };
}

export const OI_LINE_ITEM_SPEC: RecordSpec<OiLineItemInput> = {
  recordType: "OI-Record (Commercial Line Item Description)",
  length: 80,
  fields: [
    constantField(1, "OI"),
    filler(3, 8),
    { key: "commercialDescription", start: 11, length: 70, class: "X", designation: "M" },
  ],
};

export const PG01_HEADER_SPEC: RecordSpec<Pg01HeaderInput> = {
  recordType: "PG01-Record (PGA Line Number, Agency & Program Header)",
  length: 80,
  fields: [
    constantField(1, "PG01"),
    numericCodeField("pgaLineNumber", 5, 3, "M"),
    { key: "governmentAgencyCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "governmentAgencyProgramCode", start: 11, length: 3, class: "X", designation: "M" },
    { key: "governmentAgencyProcessingCode", start: 14, length: 3, class: "AN", designation: "C" },
    { key: "electronicImageSubmitted", start: 17, length: 1, class: "A", designation: "C" },
    { key: "confidentialInformationIndicator", start: 18, length: 1, class: "A", designation: "C" },
    { key: "globallyUniqueProductIdentificationCodeQualifier", start: 19, length: 4, class: "AN", designation: "C" },
    { key: "globallyUniqueProductIdentificationCode", start: 23, length: 19, class: "X", designation: "C" },
    { key: "intendedUseCode", start: 42, length: 16, class: "X", designation: "C" },
    { key: "intendedUseDescription", start: 58, length: 21, class: "X", designation: "C" },
    { key: "correctionIndicator", start: 79, length: 1, class: "X", designation: "C" },
    { key: "disclaimer", start: 80, length: 1, class: "A", designation: "C" },
  ],
};

export const PG02_PRODUCT_COMPONENT_SPEC: RecordSpec<Pg02ProductComponentInput> = {
  recordType: "PG02-Record (Product or Component Identifier)",
  length: 80,
  fields: [
    constantField(1, "PG02"),
    { key: "itemType", start: 5, length: 1, class: "A", designation: "M" },
    { key: "productCodeQualifier1", start: 6, length: 4, class: "AN", designation: "C" },
    { key: "productCodeNumber1", start: 10, length: 19, class: "X", designation: "C" },
    { key: "productCodeQualifier2", start: 29, length: 4, class: "AN", designation: "C" },
    { key: "productCodeNumber2", start: 33, length: 19, class: "X", designation: "C" },
    { key: "productCodeQualifier3", start: 52, length: 4, class: "AN", designation: "C" },
    { key: "productCodeNumber3", start: 56, length: 19, class: "X", designation: "C" },
    filler(75, 6),
  ],
};

export const PG04_CONSTITUENT_ELEMENT_SPEC: RecordSpec<Pg04ConstituentElementInput> = {
  recordType: "PG04-Record (Constituent Active Ingredient / Element)",
  length: 80,
  fields: [
    constantField(1, "PG04"),
    { key: "constituentActiveIngredientQualifier", start: 5, length: 1, class: "A", designation: "C" },
    { key: "nameOfConstituentElement", start: 6, length: 51, class: "X", designation: "C" },
    impliedDecimalField("quantityOfConstituentElement", 57, 12, 2, "C"),
    { key: "unitOfMeasureConstituentElement", start: 69, length: 5, class: "AN", designation: "C" },
    impliedDecimalField("percentOfConstituentElement", 74, 7, 4, "C"),
  ],
};

export const PG06_SOURCE_PROCESSING_SPEC: RecordSpec<Pg06SourceProcessingInput> = {
  recordType: "PG06-Record (Source / Processing / Origin)",
  length: 80,
  fields: [
    constantField(1, "PG06"),
    { key: "sourceTypeCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "countryCode", start: 8, length: 2, class: "X", designation: "C" },
    { key: "geographicLocation", start: 10, length: 20, class: "X", designation: "C" },
    dateFieldCCYY("processingStartDate", 30, "C"),
    dateFieldCCYY("processingEndDate", 38, "C"),
    { key: "processingTypeCode", start: 46, length: 5, class: "AN", designation: "C" },
    { key: "processingDescription", start: 51, length: 30, class: "X", designation: "C" },
  ],
};

export const PG07_TRADE_NAME_MODEL_SPEC: RecordSpec<Pg07TradeNameModelInput> = {
  recordType: "PG07-Record (Trade/Brand Name, Model & Item Identity Header)",
  length: 80,
  fields: [
    constantField(1, "PG07"),
    { key: "tradeNameBrandName", start: 5, length: 35, class: "X", designation: "C" },
    { key: "model", start: 40, length: 15, class: "X", designation: "C" },
    numericCodeField("manufactureMonthAndYear", 55, 6, "C"),
    { key: "itemIdentityNumberQualifier", start: 61, length: 3, class: "AN", designation: "C" },
    { key: "itemIdentityNumber", start: 64, length: 17, class: "X", designation: "C" },
  ],
};

export const PG08_ITEM_IDENTITY_OVERFLOW_SPEC: RecordSpec<Pg08ItemIdentityOverflowInput> = {
  recordType: "PG08-Record (Multiple Item Identity Numbers)",
  length: 80,
  fields: [
    constantField(1, "PG08"),
    { key: "itemIdentityNumber1", start: 5, length: 17, class: "X", designation: "C" },
    { key: "itemIdentityNumber2", start: 22, length: 17, class: "X", designation: "C" },
    { key: "itemIdentityNumber3", start: 39, length: 17, class: "X", designation: "C" },
    { key: "itemIdentityNumber4", start: 56, length: 17, class: "X", designation: "C" },
    filler(73, 8),
  ],
};

export const PG10_CATEGORY_CHARACTERISTIC_SPEC: RecordSpec<Pg10CategoryCharacteristicInput> = {
  recordType: "PG10-Record (Commodity Category & Characteristic)",
  length: 80,
  fields: [
    constantField(1, "PG10"),
    { key: "categoryTypeCode", start: 5, length: 6, class: "AN", designation: "C" },
    { key: "categoryCode", start: 11, length: 5, class: "AN", designation: "C" },
    { key: "commodityQualifierCode", start: 16, length: 4, class: "X", designation: "C" },
    { key: "commodityCharacteristicQualifier", start: 20, length: 4, class: "AN", designation: "C" },
    { key: "commodityCharacteristicDescription", start: 24, length: 57, class: "X", designation: "C" },
  ],
};

export const PG13_LPCO_ISSUER_SPEC: RecordSpec<Pg13LpcoIssuerInput> = {
  recordType: "PG13-Record (LPCO Issuer & Geographic Location)",
  length: 80,
  fields: [
    constantField(1, "PG13"),
    { key: "issuerOfLpco", start: 5, length: 35, class: "X", designation: "C" },
    { key: "lpcoIssuerGovernmentGeographicCodeQualifier", start: 40, length: 3, class: "A", designation: "C" },
    { key: "locationOfIssuerOfTheLpco", start: 43, length: 3, class: "A", designation: "C" },
    { key: "regionalDescriptionOfLocationOfAgencyIssuingLpco", start: 46, length: 25, class: "X", designation: "C" },
    filler(71, 10),
  ],
};

export const PG14_LPCO_DETAILS_SPEC: RecordSpec<Pg14LpcoDetailsInput> = {
  recordType: "PG14-Record (LPCO Details & Quantity)",
  length: 80,
  fields: [
    constantField(1, "PG14"),
    { key: "lpcoTransactionType", start: 5, length: 1, class: "N", designation: "C" },
    { key: "lpcoType", start: 6, length: 3, class: "AN", designation: "C" },
    { key: "lpcoNumberOrName", start: 9, length: 33, class: "X", designation: "C" },
    { key: "lpcoDateQualifier", start: 42, length: 1, class: "N", designation: "C" },
    dateFieldCCYY("lpcoDate", 43, "C"),
    impliedDecimalField("lpcoQuantity", 51, 16, 4, "C"),
    { key: "lpcoUnitOfMeasure", start: 67, length: 5, class: "AN", designation: "C" },
    { key: "exemptionCode", start: 72, length: 9, class: "X", designation: "C" },
  ],
};

export const PG18_HAZMAT_SPEC: RecordSpec<Pg18HazmatInput> = {
  recordType: "PG18-Record (Hazardous Material & Dangerous Goods)",
  length: 80,
  fields: [
    constantField(1, "PG18"),
    { key: "unDangerousGoodsCode", start: 5, length: 10, class: "AN", designation: "C" },
    { key: "hazardousClassCode", start: 15, length: 4, class: "X", designation: "C" },
    { key: "epaHazardousWasteCode", start: 19, length: 4, class: "AN", designation: "C" },
    { key: "hazardousMaterialDescription", start: 23, length: 50, class: "X", designation: "C" },
    { key: "packagingGroupCode", start: 73, length: 1, class: "N", designation: "C" },
    filler(74, 7),
  ],
};

export const PG19_ENTITY_IDENTIFICATION_SPEC: RecordSpec<Pg19EntityIdentificationInput> = {
  recordType: "PG19-Record (Entity Identification)",
  length: 80,
  fields: [
    constantField(1, "PG19"),
    { key: "entityRoleCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "entityIdentificationCode", start: 8, length: 3, class: "AN", designation: "C" },
    { key: "entityNumber", start: 11, length: 15, class: "X", designation: "C" },
    { key: "entityName", start: 26, length: 32, class: "X", designation: "C" },
    { key: "entityAddress1", start: 58, length: 23, class: "X", designation: "C" },
  ],
};

export const PG20_ENTITY_ADDRESS_SPEC: RecordSpec<Pg20EntityAddressInput> = {
  recordType: "PG20-Record (Entity Address Line 2 & City/State/Zip)",
  length: 80,
  fields: [
    constantField(1, "PG20"),
    { key: "entityAddress2", start: 5, length: 32, class: "X", designation: "C" },
    { key: "entityApartmentSuiteNumber", start: 37, length: 5, class: "X", designation: "C" },
    { key: "entityCity", start: 42, length: 21, class: "X", designation: "C" },
    { key: "entityStateProvince", start: 63, length: 3, class: "AN", designation: "C" },
    { key: "entityCountry", start: 66, length: 2, class: "A", designation: "C" },
    { key: "entityZipPostalCode", start: 68, length: 9, class: "X", designation: "C" },
    filler(77, 4),
  ],
};

export const PG21_INDIVIDUAL_CONTACT_SPEC: RecordSpec<Pg21IndividualContactInput> = {
  recordType: "PG21-Record (Individual Contact Information)",
  length: 80,
  fields: [
    constantField(1, "PG21"),
    { key: "individualQualifier", start: 5, length: 3, class: "AN", designation: "C" },
    { key: "individualName", start: 8, length: 23, class: "X", designation: "C" },
    { key: "telephoneNumberOfTheIndividual", start: 31, length: 15, class: "X", designation: "C" },
    { key: "emailAddressOrFaxNumberForTheIndividual", start: 46, length: 35, class: "X", designation: "C" },
  ],
};

export const PG22_IMPORTER_DECLARATION_SPEC: RecordSpec<Pg22ImporterDeclarationInput> = {
  recordType: "PG22-Record (Importer Declaration / Substantiating Document)",
  length: 80,
  fields: [
    constantField(1, "PG22"),
    { key: "importersSubstantiatingSignedDocument", start: 5, length: 1, class: "A", designation: "C" },
    { key: "documentIdentifier", start: 6, length: 7, class: "AN", designation: "C" },
    { key: "conformanceDeclaration", start: 13, length: 5, class: "X", designation: "C" },
    { key: "entityRoleCode", start: 18, length: 3, class: "AN", designation: "C" },
    { key: "declarationCode", start: 21, length: 4, class: "AN", designation: "C" },
    { key: "declarationCertification", start: 25, length: 1, class: "A", designation: "C" },
    dateFieldCCYY("dateOfSignature", 26, "C"),
    { key: "invoiceNumber", start: 34, length: 17, class: "X", designation: "C" },
    { key: "complianceDescription", start: 51, length: 30, class: "X", designation: "C" },
  ],
};

export const PG24_REMARKS_SPEC: RecordSpec<Pg24RemarksInput> = {
  recordType: "PG24-Record (Remarks)",
  length: 80,
  fields: [
    constantField(1, "PG24"),
    { key: "remarksTypeCode", start: 5, length: 3, class: "AN", designation: "C" },
    { key: "remarksCode", start: 8, length: 5, class: "AN", designation: "C" },
    { key: "remarksText", start: 13, length: 68, class: "X", designation: "C" },
  ],
};

export const PG25_TEMPERATURE_LOT_VALUES_SPEC: RecordSpec<Pg25TemperatureLotValuesInput> = {
  recordType: "PG25-Record (Temperature, Lot & PGA Values)",
  length: 80,
  fields: [
    constantField(1, "PG25"),
    { key: "temperatureQualifier", start: 5, length: 1, class: "A", designation: "C" },
    { key: "degreeType", start: 6, length: 1, class: "A", designation: "C" },
    { key: "negativeNumber", start: 7, length: 1, class: "A", designation: "C" },
    impliedDecimalField("actualTemperature", 8, 6, 2, "C"),
    { key: "locationOfTemperatureRecording", start: 14, length: 1, class: "A", designation: "C" },
    { key: "lotNumberQualifier", start: 15, length: 1, class: "AN", designation: "C" },
    { key: "lotNumber", start: 16, length: 25, class: "X", designation: "C" },
    dateFieldCCYY("productionStartDateOfTheLot", 41, "C"),
    dateFieldCCYY("productionEndDateOfTheLot", 49, "C"),
    impliedDecimalField("pgaLineValue", 57, 12, 0, "C"),
    impliedDecimalField("pgaUnitValue", 69, 12, 2, "C"),
  ],
};

export const PG26_PACKAGING_BREAKDOWN_SPEC: RecordSpec<Pg26PackagingBreakdownInput> = {
  recordType: "PG26-Record (Packaging Level Breakdown & Quantity)",
  length: 80,
  fields: [
    constantField(1, "PG26"),
    { key: "packagingQualifier", start: 5, length: 1, class: "N", designation: "M" },
    impliedDecimalField("quantity", 6, 12, 2, "C"),
    { key: "unitOfMeasurePackagingLevel", start: 18, length: 5, class: "X", designation: "C" },
    { key: "packageIdentifier", start: 23, length: 25, class: "X", designation: "C" },
    { key: "packagingMethod", start: 48, length: 3, class: "AN", designation: "C" },
    { key: "packageMaterial", start: 51, length: 15, class: "X", designation: "C" },
    { key: "packageFiller", start: 66, length: 15, class: "X", designation: "C" },
  ],
};

export const PG27_SHIPPING_CONTAINER_SPEC: RecordSpec<Pg27ShippingContainerInput> = {
  recordType: "PG27-Record (Shipping Container Information)",
  length: 80,
  fields: [
    constantField(1, "PG27"),
    { key: "containerNumber1", start: 5, length: 20, class: "AN", designation: "M" },
    { key: "typeOfContainer1", start: 25, length: 1, class: "N", designation: "C" },
    { key: "containerLength1", start: 26, length: 2, class: "N", designation: "C" },
    { key: "containerNumber2", start: 28, length: 20, class: "AN", designation: "C" },
    { key: "typeOfContainer2", start: 48, length: 1, class: "N", designation: "C" },
    { key: "containerLength2", start: 49, length: 2, class: "N", designation: "C" },
    { key: "containerNumber3", start: 51, length: 20, class: "AN", designation: "C" },
    { key: "typeOfContainer3", start: 71, length: 1, class: "N", designation: "C" },
    { key: "containerLength3", start: 72, length: 2, class: "N", designation: "C" },
    filler(74, 7),
  ],
};

export const PG29_COMMODITY_QUANTITIES_SPEC: RecordSpec<Pg29CommodityQuantitiesInput> = {
  recordType: "PG29-Record (Commodity Quantities & Unit of Measure)",
  length: 80,
  fields: [
    constantField(1, "PG29"),
    { key: "unitOfMeasurePgaLineNet", start: 5, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("commodityNetQuantityPgaLineNet", 8, 12, 2, "C"),
    { key: "unitOfMeasurePgaLineGross", start: 20, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("commodityGrossQuantityPgaLineGross", 23, 12, 2, "C"),
    { key: "unitOfMeasureIndividualUnitNet", start: 35, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("commodityNetQuantityIndividualUnitNet", 38, 12, 2, "C"),
    { key: "unitOfMeasureIndividualUnitGross", start: 50, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("commodityGrossQuantityIndividualUnitGross", 53, 12, 2, "C"),
    filler(65, 16),
  ],
};

export const PG30_INSPECTION_LOCATION_SPEC: RecordSpec<Pg30InspectionLocationInput> = {
  recordType: "PG30-Record (Inspection / Lab Test / Arrival Location)",
  length: 80,
  fields: [
    constantField(1, "PG30"),
    { key: "inspectionLaboratoryTestingStatus", start: 5, length: 1, class: "A", designation: "M" },
    dateFieldCCYY("requestedOrScheduledDateOfInspection", 6, "C"),
    numericCodeField("requestedOrScheduledTimeOfInspection", 14, 4, "C"),
    { key: "inspectionOrArrivalLocationCode", start: 18, length: 4, class: "AN", designation: "C" },
    { key: "inspectionOrArrivalLocation", start: 22, length: 50, class: "X", designation: "C" },
    filler(72, 9),
  ],
};

export const PG32_COMMODITY_ROUTING_SPEC: RecordSpec<Pg32CommodityRoutingInput> = {
  recordType: "PG32-Record (Commodity Routing)",
  length: 80,
  fields: [
    constantField(1, "PG32"),
    { key: "commodityRoutingTypeCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "commodityRoutingCountryCode", start: 8, length: 2, class: "A", designation: "C" },
    { key: "commodityPoliticalSubunitOfRoutingQualifier", start: 10, length: 3, class: "AN", designation: "C" },
    { key: "commodityPoliticalSubunitOfRoutingNumber", start: 13, length: 9, class: "X", designation: "C" },
    { key: "commodityPoliticalSubunitOfRoutingName", start: 22, length: 55, class: "X", designation: "C" },
    filler(77, 4),
  ],
};

export const PG34_TRAVEL_DOCUMENT_SPEC: RecordSpec<Pg34TravelDocumentInput> = {
  recordType: "PG34-Record (Travel Document)",
  length: 80,
  fields: [
    constantField(1, "PG34"),
    { key: "travelDocumentTypeCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "travelDocumentNationality", start: 8, length: 2, class: "A", designation: "C" },
    { key: "travelDocumentIdentifier", start: 10, length: 35, class: "X", designation: "C" },
    filler(45, 36),
  ],
};

export const PG50_GROUP_START_SPEC: RecordSpec<Pg50GroupStartInput> = {
  recordType: "PG50-Record (Start of Grouping)",
  length: 80,
  fields: [constantField(1, "PG50"), filler(5, 76)],
};

export const PG51_GROUP_END_SPEC: RecordSpec<Pg51GroupEndInput> = {
  recordType: "PG51-Record (End of Grouping)",
  length: 80,
  fields: [constantField(1, "PG51"), filler(5, 76)],
};

export const PG55_ADDITIONAL_ENTITY_ROLES_SPEC: RecordSpec<Pg55AdditionalEntityRolesInput> = {
  recordType: "PG55-Record (Additional Entity Roles)",
  length: 80,
  fields: [
    constantField(1, "PG55"),
    { key: "entityRoleCode1", start: 5, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode2", start: 8, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode3", start: 11, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode4", start: 14, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode5", start: 17, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode6", start: 20, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode7", start: 23, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode8", start: 26, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode9", start: 29, length: 3, class: "AN", designation: "C" },
    { key: "entityRoleCode10", start: 32, length: 3, class: "AN", designation: "C" },
    filler(35, 46),
  ],
};

export const PG60_ADDITIONAL_REFERENCE_SPEC: RecordSpec<Pg60AdditionalReferenceInput> = {
  recordType: "PG60-Record (Additional Reference / Overflow Information)",
  length: 80,
  fields: [
    constantField(1, "PG60"),
    { key: "additionalInformationQualifierCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "additionalInformation", start: 8, length: 73, class: "X", designation: "M" },
  ],
};

export const PG00_SUBSTITUTION_SPEC: RecordSpec<Pg00SubstitutionInput> = {
  recordType: "PG00-Record (Substitution Grouping)",
  length: 80,
  fields: [
    constantField(1, "PG00"),
    { key: "substitutionIndicator", start: 5, length: 1, class: "X", designation: "M" },
    { key: "substitutionNumber", start: 6, length: 4, class: "AN", designation: "M" },
    filler(10, 71),
  ],
};

// ── Agency-specific record variants (source PDF pp. 25, 33, 39, 44, 50, 52,
// 54) ─────────────────────────────────────────────────────────────────────
// Each record's "Control Identifier" (2A, always "PG") + "Record Type" (2N,
// e.g. "05") pair collapses into a single 4-char `constantField` (e.g.
// "PG05"), same as every generic backbone record above — a class mismatch
// against the PDF's own per-field table (which lists them as two separate
// fields), not a codec bug.

export const PG05_SCIENTIFIC_SPECIES_SPEC: RecordSpec<Pg05ScientificSpeciesInput> = {
  recordType: "PG05-Record (FWS/APHIS Scientific Genus/Species Detail)",
  length: 80,
  fields: [
    constantField(1, "PG05"),
    { key: "scientificGenusName", start: 5, length: 22, class: "X", designation: "C" },
    { key: "scientificSpeciesName", start: 27, length: 22, class: "X", designation: "C" },
    { key: "scientificSubSpeciesName", start: 49, length: 18, class: "X", designation: "C" },
    { key: "scientificSpeciesCode", start: 67, length: 7, class: "AN", designation: "C" },
    { key: "fwsDescriptionCode", start: 74, length: 7, class: "AN", designation: "C" },
  ],
};

export const PG17_COMMON_NAME_VENOMOUS_SPEC: RecordSpec<Pg17CommonNameVenomousInput> = {
  recordType: "PG17-Record (FWS Common Name & Venomous/Cartons Detail)",
  length: 80,
  fields: [
    constantField(1, "PG17"),
    { key: "commonNameSpecific", start: 5, length: 30, class: "X", designation: "C" },
    { key: "commonNameGeneral", start: 35, length: 30, class: "X", designation: "C" },
    { key: "liveVenomousWildlifeCode", start: 65, length: 1, class: "A", designation: "C" },
    { key: "cartonsContainingWildlife", start: 66, length: 5, class: "N", designation: "C" },
    filler(71, 10),
  ],
};

export const PG23_AFFIRMATION_OF_COMPLIANCE_SPEC: RecordSpec<Pg23AffirmationOfComplianceInput> = {
  recordType: "PG23-Record (FDA Affirmation of Compliance)",
  length: 80,
  fields: [
    constantField(1, "PG23"),
    { key: "affirmationOfComplianceCode", start: 5, length: 5, class: "X", designation: "M" },
    { key: "affirmationOfComplianceDescription", start: 10, length: 70, class: "X", designation: "C" },
    filler(80, 1),
  ],
};

export const PG28_CAN_DIMENSIONS_TRACKING_SPEC: RecordSpec<Pg28CanDimensionsTrackingInput> = {
  recordType: "PG28-Record (FDA Can Dimensions & Tracking Number)",
  length: 80,
  fields: [
    constantField(1, "PG28"),
    numericCodeField("canDimensions1", 5, 4, "C"),
    numericCodeField("canDimensions2", 9, 4, "C"),
    numericCodeField("canDimensions3", 13, 4, "C"),
    { key: "packageTrackingNumberCode", start: 17, length: 4, class: "AN", designation: "C" },
    { key: "packageTrackingNumber", start: 21, length: 50, class: "AN", designation: "C" },
    filler(71, 10),
  ],
};

export const PG31_HARVESTING_VESSEL_SPEC: RecordSpec<Pg31HarvestingVesselInput> = {
  recordType: "PG31-Record (NOAA/NMFS Harvesting Vessel Characteristic)",
  length: 80,
  fields: [
    constantField(1, "PG31"),
    { key: "commodityHarvestingVesselCharacteristicTypeCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "commodityHarvestingVesselCharacteristic", start: 8, length: 35, class: "X", designation: "M" },
    { key: "unitOfMeasureConveyance", start: 43, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("harvestedCommodityNetWeight", 46, 10, 2, "C"),
    filler(56, 25),
  ],
};

export const PG33_GEOGRAPHIC_AREA_SPEC: RecordSpec<Pg33GeographicAreaInput> = {
  recordType: "PG33-Record (NOAA/NMFS Commodity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "PG33"),
    { key: "commodityGeographicAreaCode", start: 5, length: 9, class: "X", designation: "C" },
    { key: "commodityGeographicAreaName", start: 14, length: 65, class: "X", designation: "C" },
    filler(79, 2),
  ],
};

export const PG35_CONFORMANCE_BOND_SPEC: RecordSpec<Pg35ConformanceBondInput> = {
  recordType: "PG35-Record (DOT/NHTSA Conformance Bond Detail)",
  length: 80,
  fields: [
    constantField(1, "PG35"),
    { key: "dotSuretyCode", start: 5, length: 3, class: "AN", designation: "C" },
    { key: "dotBondSerialNumber", start: 8, length: 30, class: "X", designation: "C" },
    { key: "dotBondQualifier", start: 38, length: 1, class: "N", designation: "C" },
    impliedDecimalField("dotBondAmount", 39, 8, 0, "C"),
    filler(47, 34),
  ],
};

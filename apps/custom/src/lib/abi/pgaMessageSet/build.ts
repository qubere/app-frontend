import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  OI_LINE_ITEM_SPEC,
  PG01_HEADER_SPEC,
  PG02_PRODUCT_COMPONENT_SPEC,
  PG04_CONSTITUENT_ELEMENT_SPEC,
  PG06_SOURCE_PROCESSING_SPEC,
  PG07_TRADE_NAME_MODEL_SPEC,
  PG08_ITEM_IDENTITY_OVERFLOW_SPEC,
  PG10_CATEGORY_CHARACTERISTIC_SPEC,
  PG13_LPCO_ISSUER_SPEC,
  PG14_LPCO_DETAILS_SPEC,
  PG18_HAZMAT_SPEC,
  PG19_ENTITY_IDENTIFICATION_SPEC,
  PG20_ENTITY_ADDRESS_SPEC,
  PG21_INDIVIDUAL_CONTACT_SPEC,
  PG22_IMPORTER_DECLARATION_SPEC,
  PG24_REMARKS_SPEC,
  PG25_TEMPERATURE_LOT_VALUES_SPEC,
  PG26_PACKAGING_BREAKDOWN_SPEC,
  PG27_SHIPPING_CONTAINER_SPEC,
  PG29_COMMODITY_QUANTITIES_SPEC,
  PG30_INSPECTION_LOCATION_SPEC,
  PG32_COMMODITY_ROUTING_SPEC,
  PG34_TRAVEL_DOCUMENT_SPEC,
  PG50_GROUP_START_SPEC,
  PG51_GROUP_END_SPEC,
  PG55_ADDITIONAL_ENTITY_ROLES_SPEC,
  PG60_ADDITIONAL_REFERENCE_SPEC,
  PG00_SUBSTITUTION_SPEC,
  PG05_SCIENTIFIC_SPECIES_SPEC,
  PG17_COMMON_NAME_VENOMOUS_SPEC,
  PG23_AFFIRMATION_OF_COMPLIANCE_SPEC,
  PG28_CAN_DIMENSIONS_TRACKING_SPEC,
  PG31_HARVESTING_VESSEL_SPEC,
  PG33_GEOGRAPHIC_AREA_SPEC,
  PG35_CONFORMANCE_BOND_SPEC,
} from "./recordSpecs";
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

export function buildOiLineItem(input: OiLineItemInput): string {
  return encodeRecord(OI_LINE_ITEM_SPEC, input);
}

export function buildPg01Header(input: Pg01HeaderInput): string {
  return encodeRecord(PG01_HEADER_SPEC, input);
}

export function buildPg02ProductComponent(input: Pg02ProductComponentInput): string {
  return encodeRecord(PG02_PRODUCT_COMPONENT_SPEC, input);
}

export function buildPg04ConstituentElement(input: Pg04ConstituentElementInput): string {
  return encodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, input);
}

export function buildPg06SourceProcessing(input: Pg06SourceProcessingInput): string {
  return encodeRecord(PG06_SOURCE_PROCESSING_SPEC, input);
}

export function buildPg07TradeNameModel(input: Pg07TradeNameModelInput): string {
  return encodeRecord(PG07_TRADE_NAME_MODEL_SPEC, input);
}

export function buildPg08ItemIdentityOverflow(input: Pg08ItemIdentityOverflowInput): string {
  return encodeRecord(PG08_ITEM_IDENTITY_OVERFLOW_SPEC, input);
}

export function buildPg10CategoryCharacteristic(input: Pg10CategoryCharacteristicInput): string {
  return encodeRecord(PG10_CATEGORY_CHARACTERISTIC_SPEC, input);
}

export function buildPg13LpcoIssuer(input: Pg13LpcoIssuerInput): string {
  return encodeRecord(PG13_LPCO_ISSUER_SPEC, input);
}

export function buildPg14LpcoDetails(input: Pg14LpcoDetailsInput): string {
  return encodeRecord(PG14_LPCO_DETAILS_SPEC, input);
}

export function buildPg18Hazmat(input: Pg18HazmatInput): string {
  return encodeRecord(PG18_HAZMAT_SPEC, input);
}

export function buildPg19EntityIdentification(input: Pg19EntityIdentificationInput): string {
  return encodeRecord(PG19_ENTITY_IDENTIFICATION_SPEC, input);
}

export function buildPg20EntityAddress(input: Pg20EntityAddressInput): string {
  return encodeRecord(PG20_ENTITY_ADDRESS_SPEC, input);
}

export function buildPg21IndividualContact(input: Pg21IndividualContactInput): string {
  return encodeRecord(PG21_INDIVIDUAL_CONTACT_SPEC, input);
}

export function buildPg22ImporterDeclaration(input: Pg22ImporterDeclarationInput): string {
  return encodeRecord(PG22_IMPORTER_DECLARATION_SPEC, input);
}

export function buildPg24Remarks(input: Pg24RemarksInput): string {
  return encodeRecord(PG24_REMARKS_SPEC, input);
}

export function buildPg25TemperatureLotValues(input: Pg25TemperatureLotValuesInput): string {
  return encodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, input);
}

export function buildPg26PackagingBreakdown(input: Pg26PackagingBreakdownInput): string {
  return encodeRecord(PG26_PACKAGING_BREAKDOWN_SPEC, input);
}

export function buildPg27ShippingContainer(input: Pg27ShippingContainerInput): string {
  return encodeRecord(PG27_SHIPPING_CONTAINER_SPEC, input);
}

export function buildPg29CommodityQuantities(input: Pg29CommodityQuantitiesInput): string {
  return encodeRecord(PG29_COMMODITY_QUANTITIES_SPEC, input);
}

export function buildPg30InspectionLocation(input: Pg30InspectionLocationInput): string {
  return encodeRecord(PG30_INSPECTION_LOCATION_SPEC, input);
}

export function buildPg32CommodityRouting(input: Pg32CommodityRoutingInput): string {
  return encodeRecord(PG32_COMMODITY_ROUTING_SPEC, input);
}

export function buildPg34TravelDocument(input: Pg34TravelDocumentInput): string {
  return encodeRecord(PG34_TRAVEL_DOCUMENT_SPEC, input);
}

export function buildPg50GroupStart(input: Pg50GroupStartInput = {}): string {
  return encodeRecord(PG50_GROUP_START_SPEC, input);
}

export function buildPg51GroupEnd(input: Pg51GroupEndInput = {}): string {
  return encodeRecord(PG51_GROUP_END_SPEC, input);
}

export function buildPg55AdditionalEntityRoles(input: Pg55AdditionalEntityRolesInput): string {
  return encodeRecord(PG55_ADDITIONAL_ENTITY_ROLES_SPEC, input);
}

export function buildPg60AdditionalReference(input: Pg60AdditionalReferenceInput): string {
  return encodeRecord(PG60_ADDITIONAL_REFERENCE_SPEC, input);
}

export function buildPg00Substitution(input: Pg00SubstitutionInput): string {
  return encodeRecord(PG00_SUBSTITUTION_SPEC, input);
}

export function buildPg05ScientificSpecies(input: Pg05ScientificSpeciesInput): string {
  return encodeRecord(PG05_SCIENTIFIC_SPECIES_SPEC, input);
}

export function buildPg17CommonNameVenomous(input: Pg17CommonNameVenomousInput): string {
  return encodeRecord(PG17_COMMON_NAME_VENOMOUS_SPEC, input);
}

export function buildPg23AffirmationOfCompliance(input: Pg23AffirmationOfComplianceInput): string {
  return encodeRecord(PG23_AFFIRMATION_OF_COMPLIANCE_SPEC, input);
}

export function buildPg28CanDimensionsTracking(input: Pg28CanDimensionsTrackingInput): string {
  return encodeRecord(PG28_CAN_DIMENSIONS_TRACKING_SPEC, input);
}

export function buildPg31HarvestingVessel(input: Pg31HarvestingVesselInput): string {
  return encodeRecord(PG31_HARVESTING_VESSEL_SPEC, input);
}

export function buildPg33GeographicArea(input: Pg33GeographicAreaInput): string {
  return encodeRecord(PG33_GEOGRAPHIC_AREA_SPEC, input);
}

export function buildPg35ConformanceBond(input: Pg35ConformanceBondInput): string {
  return encodeRecord(PG35_CONFORMANCE_BOND_SPEC, input);
}

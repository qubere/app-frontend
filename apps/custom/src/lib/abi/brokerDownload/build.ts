import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  MANIFEST_HEADER_SPEC,
  PORT_OF_CROSSING_SPEC,
  ISSUER_CODE_SPEC,
  BILL_OF_LADING_TRANSACTION_SPEC,
  ENTITY_NAME_SPEC,
  BILL_OF_LADING_CONTAINER_SPEC,
  BILL_CARGO_DESCRIPTION_SPEC,
  MARKS_AND_NUMBERS_SPEC,
  STATUS_NOTIFICATION_HEADER_SPEC,
  STATUS_NOTIFICATION_DETAIL_SPEC,
  HAZARDOUS_MATERIAL_DETAIL_SPEC,
  ADDITIONAL_HAZARDOUS_MATERIAL_DETAIL_SPEC,
  HAZARDOUS_MATERIAL_CLASSIFICATION_DETAIL_SPEC,
  STATUS_NOTIFICATION_CONTINUATION_SPEC,
  STATUS_NOTIFICATION_REMARKS_SPEC,
  STATUS_NOTIFICATION_CONTAINER_DETAIL_SPEC,
  MANIFEST_REFERENCE_IDENTIFIER_SPEC,
  BILL_OF_LADING_AMENDMENT_SPEC,
  BILL_OF_LADING_ADDITIONAL_SPEC,
  BILL_OF_LADING_REFERENCE_IDENTIFIER_SPEC,
  ENTITY_ADDRESS_SPEC,
  ENTITY_GEOGRAPHIC_AREA_SPEC,
  ADMIN_COMMUNICATION_CONTACT_SPEC,
  SUPPLEMENTAL_IN_BOND_DETAILS_SPEC,
  WATER_BORNE_EXPORT_IN_BOND_SPEC,
  MOTOR_VEHICLE_CONTROL_SPEC,
  HARMONIZED_TARIFF_SPEC,
} from "./recordSpecs";
import type {
  ManifestHeaderRecord,
  PortOfCrossingRecord,
  IssuerCodeRecord,
  BillOfLadingTransactionRecord,
  EntityNameRecord,
  BillOfLadingContainerRecord,
  BillCargoDescriptionRecord,
  MarksAndNumbersRecord,
  StatusNotificationHeaderRecord,
  StatusNotificationDetailRecord,
  HazardousMaterialDetailRecord,
  AdditionalHazardousMaterialDetailRecord,
  HazardousMaterialClassificationDetailRecord,
  StatusNotificationContinuationRecord,
  StatusNotificationRemarksRecord,
  StatusNotificationContainerDetailRecord,
  ManifestReferenceIdentifierRecord,
  BillOfLadingAmendmentRecord,
  BillOfLadingAdditionalRecord,
  BillOfLadingReferenceIdentifierRecord,
  EntityAddressRecord,
  EntityGeographicAreaRecord,
  AdminCommunicationContactRecord,
  SupplementalInBondDetailsRecord,
  WaterBorneExportInBondRecord,
  MotorVehicleControlRecord,
  HarmonizedTariffRecord,
} from "./types";

// ACE Broker Download is output-only — CBP pushes this data to ABI filers,
// there's no filer-submitted input side. These `buildX` wrappers exist to
// represent CBP's own encoding logic (useful for testing/simulating CBP
// responses against Qubere's decode path in `parse.ts`), not for anything
// Qubere itself transmits.

export function buildManifestHeader(input: ManifestHeaderRecord): string {
  return encodeRecord(MANIFEST_HEADER_SPEC, input);
}

export function buildPortOfCrossing(input: PortOfCrossingRecord): string {
  return encodeRecord(PORT_OF_CROSSING_SPEC, input);
}

export function buildIssuerCode(input: IssuerCodeRecord): string {
  return encodeRecord(ISSUER_CODE_SPEC, input);
}

export function buildBillOfLadingTransaction(input: BillOfLadingTransactionRecord): string {
  return encodeRecord(BILL_OF_LADING_TRANSACTION_SPEC, input);
}

export function buildEntityName(input: EntityNameRecord): string {
  return encodeRecord(ENTITY_NAME_SPEC, input);
}

export function buildBillOfLadingContainer(input: BillOfLadingContainerRecord): string {
  return encodeRecord(BILL_OF_LADING_CONTAINER_SPEC, input);
}

export function buildBillCargoDescription(input: BillCargoDescriptionRecord): string {
  return encodeRecord(BILL_CARGO_DESCRIPTION_SPEC, input);
}

export function buildMarksAndNumbers(input: MarksAndNumbersRecord): string {
  return encodeRecord(MARKS_AND_NUMBERS_SPEC, input);
}

export function buildStatusNotificationHeader(input: StatusNotificationHeaderRecord): string {
  return encodeRecord(STATUS_NOTIFICATION_HEADER_SPEC, input);
}

export function buildStatusNotificationDetail(input: StatusNotificationDetailRecord): string {
  return encodeRecord(STATUS_NOTIFICATION_DETAIL_SPEC, input);
}

export function buildHazardousMaterialDetail(input: HazardousMaterialDetailRecord): string {
  return encodeRecord(HAZARDOUS_MATERIAL_DETAIL_SPEC, input);
}

export function buildAdditionalHazardousMaterialDetail(input: AdditionalHazardousMaterialDetailRecord): string {
  return encodeRecord(ADDITIONAL_HAZARDOUS_MATERIAL_DETAIL_SPEC, input);
}

export function buildHazardousMaterialClassificationDetail(
  input: HazardousMaterialClassificationDetailRecord
): string {
  return encodeRecord(HAZARDOUS_MATERIAL_CLASSIFICATION_DETAIL_SPEC, input);
}

export function buildStatusNotificationContinuation(input: StatusNotificationContinuationRecord): string {
  return encodeRecord(STATUS_NOTIFICATION_CONTINUATION_SPEC, input);
}

export function buildStatusNotificationRemarks(input: StatusNotificationRemarksRecord): string {
  return encodeRecord(STATUS_NOTIFICATION_REMARKS_SPEC, input);
}

export function buildStatusNotificationContainerDetail(input: StatusNotificationContainerDetailRecord): string {
  return encodeRecord(STATUS_NOTIFICATION_CONTAINER_DETAIL_SPEC, input);
}

export function buildManifestReferenceIdentifier(input: ManifestReferenceIdentifierRecord): string {
  return encodeRecord(MANIFEST_REFERENCE_IDENTIFIER_SPEC, input);
}

export function buildBillOfLadingAmendment(input: BillOfLadingAmendmentRecord): string {
  return encodeRecord(BILL_OF_LADING_AMENDMENT_SPEC, input);
}

export function buildBillOfLadingAdditional(input: BillOfLadingAdditionalRecord): string {
  return encodeRecord(BILL_OF_LADING_ADDITIONAL_SPEC, input);
}

export function buildBillOfLadingReferenceIdentifier(input: BillOfLadingReferenceIdentifierRecord): string {
  return encodeRecord(BILL_OF_LADING_REFERENCE_IDENTIFIER_SPEC, input);
}

export function buildEntityAddress(input: EntityAddressRecord): string {
  return encodeRecord(ENTITY_ADDRESS_SPEC, input);
}

export function buildEntityGeographicArea(input: EntityGeographicAreaRecord): string {
  return encodeRecord(ENTITY_GEOGRAPHIC_AREA_SPEC, input);
}

export function buildAdminCommunicationContact(input: AdminCommunicationContactRecord): string {
  return encodeRecord(ADMIN_COMMUNICATION_CONTACT_SPEC, input);
}

export function buildSupplementalInBondDetails(input: SupplementalInBondDetailsRecord): string {
  return encodeRecord(SUPPLEMENTAL_IN_BOND_DETAILS_SPEC, input);
}

export function buildWaterBorneExportInBond(input: WaterBorneExportInBondRecord): string {
  return encodeRecord(WATER_BORNE_EXPORT_IN_BOND_SPEC, input);
}

export function buildMotorVehicleControl(input: MotorVehicleControlRecord): string {
  return encodeRecord(MOTOR_VEHICLE_CONTROL_SPEC, input);
}

export function buildHarmonizedTariff(input: HarmonizedTariffRecord): string {
  return encodeRecord(HARMONIZED_TARIFF_SPEC, input);
}

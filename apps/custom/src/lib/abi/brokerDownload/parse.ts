import { decodeRecord } from "@/lib/abi/fixedWidth";
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

export type BrokerDownloadLineType =
  | "1M"
  | "1P"
  | "1J"
  | "1B"
  | "0N"
  | "1C"
  | "1D"
  | "2D"
  | "1V"
  | "2V"
  | "3V"
  | "2M"
  | "1A"
  | "2B"
  | "4B"
  | "2N"
  | "3N"
  | "4N"
  | "1I"
  | "2I"
  | "2C"
  | "0D"
  | "NS05"
  | "NS30"
  | "NS40"
  | "NS50"
  | "NS60"
  | "UNKNOWN";

const KNOWN_BD_CODES: ReadonlySet<string> = new Set([
  "1M",
  "1P",
  "1J",
  "1B",
  "0N",
  "1C",
  "1D",
  "2D",
  "1V",
  "2V",
  "3V",
  "2M",
  "1A",
  "2B",
  "4B",
  "2N",
  "3N",
  "4N",
  "1I",
  "2I",
  "2C",
  "0D",
]);

/**
 * Classifies a Broker Download / Status Notification line by its control
 * identifier. Unlike the BD Application Grouping records (1M, 1P, 1J, 1B, 0N,
 * 1C, 1D, 2D, 1V, 2V, 3V, 2M, 1A, 2B, 4B, 2N, 3N, 4N, 1I, 2I, 2C, 0D), whose
 * first two bytes are the record's own literal identifier, the NS Application
 * Grouping's NS05/NS30/NS40/NS50/NS60 records carry only the bare 2-digit
 * "05"/"30"/"40"/"50"/"60" on the wire — the "NS" prefix returned here is a
 * chapter-level label distinguishing the grouping (Application Identifier
 * "NS" vs "BD"), not literally present in those two bytes. All 27 Broker
 * Download records are now modeled; "UNKNOWN" only covers non-Broker-Download
 * lines (e.g. Batch & Block Control envelope lines).
 */
export function classifyBrokerDownloadLine(line: string): BrokerDownloadLineType {
  const code = line.slice(0, 2);
  if (KNOWN_BD_CODES.has(code)) return code as BrokerDownloadLineType;
  if (code === "05") return "NS05";
  if (code === "30") return "NS30";
  if (code === "40") return "NS40";
  if (code === "50") return "NS50";
  if (code === "60") return "NS60";
  return "UNKNOWN";
}

export function parseManifestHeader(line: string): ManifestHeaderRecord {
  return decodeRecord(MANIFEST_HEADER_SPEC, line);
}

export function parsePortOfCrossing(line: string): PortOfCrossingRecord {
  return decodeRecord(PORT_OF_CROSSING_SPEC, line);
}

export function parseIssuerCode(line: string): IssuerCodeRecord {
  return decodeRecord(ISSUER_CODE_SPEC, line);
}

export function parseBillOfLadingTransaction(line: string): BillOfLadingTransactionRecord {
  return decodeRecord(BILL_OF_LADING_TRANSACTION_SPEC, line);
}

export function parseEntityName(line: string): EntityNameRecord {
  return decodeRecord(ENTITY_NAME_SPEC, line);
}

export function parseBillOfLadingContainer(line: string): BillOfLadingContainerRecord {
  return decodeRecord(BILL_OF_LADING_CONTAINER_SPEC, line);
}

export function parseBillCargoDescription(line: string): BillCargoDescriptionRecord {
  return decodeRecord(BILL_CARGO_DESCRIPTION_SPEC, line);
}

export function parseMarksAndNumbers(line: string): MarksAndNumbersRecord {
  return decodeRecord(MARKS_AND_NUMBERS_SPEC, line);
}

export function parseStatusNotificationHeader(line: string): StatusNotificationHeaderRecord {
  return decodeRecord(STATUS_NOTIFICATION_HEADER_SPEC, line);
}

export function parseStatusNotificationDetail(line: string): StatusNotificationDetailRecord {
  return decodeRecord(STATUS_NOTIFICATION_DETAIL_SPEC, line);
}

export function parseHazardousMaterialDetail(line: string): HazardousMaterialDetailRecord {
  return decodeRecord(HAZARDOUS_MATERIAL_DETAIL_SPEC, line);
}

export function parseAdditionalHazardousMaterialDetail(line: string): AdditionalHazardousMaterialDetailRecord {
  return decodeRecord(ADDITIONAL_HAZARDOUS_MATERIAL_DETAIL_SPEC, line);
}

export function parseHazardousMaterialClassificationDetail(
  line: string
): HazardousMaterialClassificationDetailRecord {
  return decodeRecord(HAZARDOUS_MATERIAL_CLASSIFICATION_DETAIL_SPEC, line);
}

export function parseStatusNotificationContinuation(line: string): StatusNotificationContinuationRecord {
  return decodeRecord(STATUS_NOTIFICATION_CONTINUATION_SPEC, line);
}

export function parseStatusNotificationRemarks(line: string): StatusNotificationRemarksRecord {
  return decodeRecord(STATUS_NOTIFICATION_REMARKS_SPEC, line);
}

export function parseStatusNotificationContainerDetail(line: string): StatusNotificationContainerDetailRecord {
  return decodeRecord(STATUS_NOTIFICATION_CONTAINER_DETAIL_SPEC, line);
}

export function parseManifestReferenceIdentifier(line: string): ManifestReferenceIdentifierRecord {
  return decodeRecord(MANIFEST_REFERENCE_IDENTIFIER_SPEC, line);
}

export function parseBillOfLadingAmendment(line: string): BillOfLadingAmendmentRecord {
  return decodeRecord(BILL_OF_LADING_AMENDMENT_SPEC, line);
}

export function parseBillOfLadingAdditional(line: string): BillOfLadingAdditionalRecord {
  return decodeRecord(BILL_OF_LADING_ADDITIONAL_SPEC, line);
}

export function parseBillOfLadingReferenceIdentifier(line: string): BillOfLadingReferenceIdentifierRecord {
  return decodeRecord(BILL_OF_LADING_REFERENCE_IDENTIFIER_SPEC, line);
}

export function parseEntityAddress(line: string): EntityAddressRecord {
  return decodeRecord(ENTITY_ADDRESS_SPEC, line);
}

export function parseEntityGeographicArea(line: string): EntityGeographicAreaRecord {
  return decodeRecord(ENTITY_GEOGRAPHIC_AREA_SPEC, line);
}

export function parseAdminCommunicationContact(line: string): AdminCommunicationContactRecord {
  return decodeRecord(ADMIN_COMMUNICATION_CONTACT_SPEC, line);
}

export function parseSupplementalInBondDetails(line: string): SupplementalInBondDetailsRecord {
  return decodeRecord(SUPPLEMENTAL_IN_BOND_DETAILS_SPEC, line);
}

export function parseWaterBorneExportInBond(line: string): WaterBorneExportInBondRecord {
  return decodeRecord(WATER_BORNE_EXPORT_IN_BOND_SPEC, line);
}

export function parseMotorVehicleControl(line: string): MotorVehicleControlRecord {
  return decodeRecord(MOTOR_VEHICLE_CONTROL_SPEC, line);
}

export function parseHarmonizedTariff(line: string): HarmonizedTariffRecord {
  return decodeRecord(HARMONIZED_TARIFF_SPEC, line);
}

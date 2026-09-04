import {
  dateField,
  dateFieldYYMMDD,
  filler,
  constantField,
  numericCodeField,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
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

// RecordSpecs for the CATAIR ACE Broker Download chapter (Chapter 9 / BD & NS
// Applications) — the 10 core mandatory backbone output records. Position
// math cross-checked against tests/abi-broker-download-specs.test.ts, itself
// independently spot-checked against the source PDF and confirmed
// byte-for-byte accurate.
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf

// ── 1M-Record: Manifest Header ───────────────────────────────────────────────

export const MANIFEST_HEADER_SPEC: RecordSpec<ManifestHeaderRecord> = {
  recordType: "1M-Record (Manifest Header)",
  length: 80,
  fields: [
    constantField(1, "1M"),
    { key: "carrierCode", start: 3, length: 4, class: "AN", designation: "M" },
    numericCodeField("transportationIndicator", 7, 2, "M"),
    { key: "countryCode", start: 9, length: 2, class: "A", designation: "C" },
    { key: "conveyanceName", start: 11, length: 23, class: "X", designation: "C" },
    { key: "tripData", start: 34, length: 5, class: "X", designation: "O" },
    filler(39, 5),
    numericCodeField("manifestSequenceNumber", 44, 6, "O"),
    filler(50, 1),
    { key: "vesselCode", start: 51, length: 7, class: "AN", designation: "C" },
    { key: "manifestTypeCode", start: 58, length: 1, class: "A", designation: "M" },
    filler(59, 22),
  ],
};

// ── 1P-Record: Port of Crossing ──────────────────────────────────────────────

export const PORT_OF_CROSSING_SPEC: RecordSpec<PortOfCrossingRecord> = {
  recordType: "1P-Record (Port of Crossing)",
  length: 80,
  fields: [
    constantField(1, "1P"),
    numericCodeField("portOfUnlading", 3, 4, "M"),
    dateField("originalScheduledArrivalDate", 7, "M"),
    filler(13, 5),
    { key: "firmsCode", start: 18, length: 4, class: "AN", designation: "O" },
    { key: "time", start: 22, length: 4, class: "AN", designation: "C" },
    filler(26, 55),
  ],
};

// ── 1J-Record: Issuer Code ───────────────────────────────────────────────────

export const ISSUER_CODE_SPEC: RecordSpec<IssuerCodeRecord> = {
  recordType: "1J-Record (Issuer Code)",
  length: 80,
  fields: [
    constantField(1, "1J"),
    { key: "issuerCode", start: 3, length: 4, class: "AN", designation: "M" },
    filler(7, 74),
  ],
};

// ── 1B-Record: Bill of Lading Transaction ────────────────────────────────────

export const BILL_OF_LADING_TRANSACTION_SPEC: RecordSpec<BillOfLadingTransactionRecord> = {
  recordType: "1B-Record (Bill of Lading Transaction)",
  length: 80,
  fields: [
    constantField(1, "1B"),
    { key: "billOfLading", start: 3, length: 12, class: "X", designation: "M" },
    numericCodeField("foreignPortOfLading", 15, 5, "M"),
    // Whole number — no implied decimals (Rail/Ocean required, not returned in Truck).
    { key: "manifestQuantity", start: 20, length: 10, class: "N", designation: "C" },
    { key: "manifestUnits", start: 30, length: 5, class: "X", designation: "C" },
    // Gross weight in whole numbers, no decimals per the source PDF's own note.
    { key: "weight", start: 35, length: 10, class: "N", designation: "C" },
    { key: "weightUnit", start: 45, length: 2, class: "A", designation: "C" },
    { key: "billStatusIndicator", start: 47, length: 1, class: "X", designation: "C" },
    { key: "masterInBondIndicator", start: 48, length: 1, class: "X", designation: "C" },
    { key: "houseBillNumber", start: 49, length: 12, class: "X", designation: "C" },
    numericCodeField("inBondEntryType", 61, 2, "C"),
    numericCodeField("inBondPortOfDestination", 63, 4, "M"),
    { key: "issuerCode", start: 67, length: 4, class: "AN", designation: "C" },
    filler(71, 10),
  ],
};

// ── 0N-Record: Entity Name ───────────────────────────────────────────────────
// The source PDF's own Filler field label reads "78AN" — a documented typo;
// position math (64-80 inclusive) is 17 characters, which is what's modeled
// here. See tests/abi-broker-download-specs.test.ts's dedicated audit test.

export const ENTITY_NAME_SPEC: RecordSpec<EntityNameRecord> = {
  recordType: "0N-Record (Entity Name)",
  length: 80,
  fields: [
    constantField(1, "0N"),
    { key: "entityIdCode", start: 3, length: 3, class: "AN", designation: "C" },
    { key: "name", start: 6, length: 35, class: "AN", designation: "C" },
    { key: "codeQualifier", start: 41, length: 2, class: "AN", designation: "C" },
    { key: "idCode", start: 43, length: 17, class: "AN", designation: "C" },
    { key: "entityRelationshipCode", start: 60, length: 2, class: "AN", designation: "O" },
    { key: "entityIdCodeReserved", start: 62, length: 2, class: "AN", designation: "O" },
    filler(64, 17), // PDF label says "78AN"; correct width per position math is 17.
  ],
};

// ── 1C-Record: Bill of Lading Container ──────────────────────────────────────

export const BILL_OF_LADING_CONTAINER_SPEC: RecordSpec<BillOfLadingContainerRecord> = {
  recordType: "1C-Record (Bill of Lading Container)",
  length: 80,
  fields: [
    constantField(1, "1C"),
    { key: "equipmentInitial", start: 3, length: 4, class: "AN", designation: "O" },
    { key: "equipmentNumber", start: 7, length: 10, class: "AN", designation: "M" },
    { key: "sealNumber1", start: 17, length: 15, class: "AN", designation: "C" },
    { key: "sealNumber2", start: 32, length: 15, class: "AN", designation: "C" },
    { key: "containerDescriptionCode", start: 47, length: 2, class: "AN", designation: "C" },
    numericCodeField("containerLength", 49, 5, "O"),
    { key: "height", start: 54, length: 8, class: "X", designation: "O" },
    { key: "width", start: 62, length: 8, class: "X", designation: "O" },
    { key: "containerType", start: 70, length: 4, class: "AN", designation: "O" },
    { key: "loadEmptyStatus", start: 74, length: 1, class: "A", designation: "O" },
    { key: "typeOfService", start: 75, length: 2, class: "AN", designation: "O" },
    filler(77, 4),
  ],
};

// ── 1D-Record: Bill Cargo Description ────────────────────────────────────────

export const BILL_CARGO_DESCRIPTION_SPEC: RecordSpec<BillCargoDescriptionRecord> = {
  recordType: "1D-Record (Bill Cargo Description)",
  length: 80,
  fields: [
    constantField(1, "1D"),
    // Smallest exterior package units — whole number, no implied decimals.
    { key: "pieceCount", start: 3, length: 10, class: "N", designation: "C" },
    { key: "description", start: 13, length: 45, class: "X", designation: "M" },
    { key: "c4Number", start: 58, length: 14, class: "AN", designation: "O" },
    { key: "manifestUnitCode", start: 72, length: 3, class: "AN", designation: "O" },
    { key: "countryCode", start: 75, length: 2, class: "AN", designation: "O" },
    filler(77, 4),
  ],
};

// ── 2D-Record: Marks and Numbers ─────────────────────────────────────────────

export const MARKS_AND_NUMBERS_SPEC: RecordSpec<MarksAndNumbersRecord> = {
  recordType: "2D-Record (Marks and Numbers)",
  length: 80,
  fields: [
    constantField(1, "2D"),
    { key: "marksAndNumbers", start: 3, length: 45, class: "AN", designation: "C" },
    filler(48, 33),
  ],
};

// ── NS05-Record: Status Notification Header (Conveyance Information) ────────
// Wire control identifier is the bare 2-char "05" — see types.ts's note on
// the "NS" Application Identifier grouping. Estimated Date of Arrival is
// class-N YYMMDD (year-month-day), not the usual MMDDYY — see
// `dateFieldYYMMDD` in fixedWidth.ts.

export const STATUS_NOTIFICATION_HEADER_SPEC: RecordSpec<StatusNotificationHeaderRecord> = {
  recordType: "NS05-Record (Status Notification Header - Conveyance Information)",
  length: 80,
  fields: [
    constantField(1, "05"),
    { key: "importingConveyanceName", start: 3, length: 23, class: "AN", designation: "O" },
    { key: "tripNumber", start: 26, length: 5, class: "X", designation: "O" },
    numericCodeField("port", 31, 4, "O"),
    dateFieldYYMMDD("estimatedArrivalDate", 35, "O"),
    numericCodeField("estimatedArrivalTime", 41, 6, "O"),
    filler(47, 34),
  ],
};

// ── NS30-Record: Status Notification Detail ──────────────────────────────────
// Wire control identifier is the bare 2-char "30". Action Date is
// class-N YYMMDD, same convention as NS05's Estimated Date of Arrival.

export const STATUS_NOTIFICATION_DETAIL_SPEC: RecordSpec<StatusNotificationDetailRecord> = {
  recordType: "NS30-Record (Status Notification Detail)",
  length: 80,
  fields: [
    constantField(1, "30"),
    { key: "dispositionCode", start: 3, length: 2, class: "AN", designation: "M" },
    { key: "issuerCodeMasterBill", start: 5, length: 4, class: "AN", designation: "C" },
    { key: "masterBillNumber", start: 9, length: 12, class: "AN", designation: "M" },
    { key: "issuerCodeHouseBill", start: 21, length: 4, class: "AN", designation: "C" },
    { key: "houseBillNumber", start: 25, length: 12, class: "AN", designation: "C" },
    { key: "issuerCodeSubHouseBill", start: 37, length: 4, class: "AN", designation: "C" },
    { key: "subHouseBillNumber", start: 41, length: 12, class: "AN", designation: "C" },
    // Total piece count affected — whole number, no implied decimals.
    { key: "quantity", start: 53, length: 10, class: "N", designation: "M" },
    { key: "negativeIndicator", start: 63, length: 1, class: "A", designation: "C" },
    dateFieldYYMMDD("actionDate", 64, "M"),
    numericCodeField("actionTime", 70, 4, "M"),
    { key: "inBondCarrierCode", start: 74, length: 4, class: "X", designation: "M" },
    filler(78, 3),
  ],
};

// ── 1V-Record: Hazardous Material Detail ─────────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.43.

export const HAZARDOUS_MATERIAL_DETAIL_SPEC: RecordSpec<HazardousMaterialDetailRecord> = {
  recordType: "1V-Record (Hazardous Material Detail)",
  length: 80,
  fields: [
    constantField(1, "1V"),
    { key: "hazardousMaterialCode", start: 3, length: 10, class: "X", designation: "M" },
    { key: "hazardousMaterialClass", start: 13, length: 4, class: "X", designation: "O" },
    { key: "hazardousMaterialCodeQualifier", start: 17, length: 1, class: "X", designation: "O" },
    { key: "hazardousMaterialDescription", start: 18, length: 30, class: "AN", designation: "O" },
    { key: "hazardousMaterialContact", start: 48, length: 24, class: "AN", designation: "O" },
    { key: "unHazardousMaterialPage", start: 72, length: 6, class: "AN", designation: "O" },
    filler(78, 3),
  ],
};

// ── 2V-Record: Additional Hazardous Material Detail (Flashpoint) ────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.44.
// Flashpoint Temperature is a measured quantity (paired with a Negative
// Indicator sign flag), not an identifier — plain class N, not
// `numericCodeField`, same rationale as 1B's `manifestQuantity`/`weight`.

export const ADDITIONAL_HAZARDOUS_MATERIAL_DETAIL_SPEC: RecordSpec<AdditionalHazardousMaterialDetailRecord> = {
  recordType: "2V-Record (Additional Hazardous Material Detail)",
  length: 80,
  fields: [
    constantField(1, "2V"),
    { key: "flashpointTemperature", start: 3, length: 3, class: "N", designation: "C" },
    { key: "unitOfMeasureCode", start: 6, length: 2, class: "X", designation: "C" },
    { key: "negativeIndicator", start: 8, length: 1, class: "A", designation: "C" },
    filler(9, 72),
  ],
};

// ── 3V-Record: Hazardous Material Classification Detail ─────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.45.

export const HAZARDOUS_MATERIAL_CLASSIFICATION_DETAIL_SPEC: RecordSpec<HazardousMaterialClassificationDetailRecord> = {
  recordType: "3V-Record (Hazardous Material Classification Detail)",
  length: 80,
  fields: [
    constantField(1, "3V"),
    { key: "hazardousMaterialDescription", start: 3, length: 30, class: "AN", designation: "O" },
    { key: "hazardousMaterialClassification", start: 33, length: 30, class: "AN", designation: "C" },
    filler(63, 18),
  ],
};

// ── NS40-Record: Status Notification Continuation ────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.49.
// Wire control identifier is the bare 2-char "40" — see
// `StatusNotificationHeaderRecord`'s note on the "NS" grouping prefix.

export const STATUS_NOTIFICATION_CONTINUATION_SPEC: RecordSpec<StatusNotificationContinuationRecord> = {
  recordType: "NS40-Record (Status Notification Continuation)",
  length: 80,
  fields: [
    constantField(1, "40"),
    numericCodeField("entryType", 3, 2, "C"),
    { key: "entryNumber", start: 5, length: 15, class: "AN", designation: "C" },
    numericCodeField("portOfTransaction", 20, 4, "M"),
    { key: "firmsCode", start: 24, length: 4, class: "AN", designation: "C" },
    { key: "containerNumber", start: 28, length: 14, class: "AN", designation: "C" },
    filler(42, 39),
  ],
};

// ── NS50-Record: Status Notification Remarks ─────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.50.
// Wire control identifier is the bare 2-char "50".

export const STATUS_NOTIFICATION_REMARKS_SPEC: RecordSpec<StatusNotificationRemarksRecord> = {
  recordType: "NS50-Record (Status Notification Remarks)",
  length: 80,
  fields: [
    constantField(1, "50"),
    { key: "remarks", start: 3, length: 45, class: "X", designation: "M" },
    filler(48, 33),
  ],
};

// ── NS60-Record: Status Notification Container Detail ────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.51.
// Wire control identifier is the bare 2-char "60". Action Indicator is an
// identifier-style flag ("1" or blank), not a quantity — `numericCodeField`,
// same rationale as 1B's `inBondEntryType`.

export const STATUS_NOTIFICATION_CONTAINER_DETAIL_SPEC: RecordSpec<StatusNotificationContainerDetailRecord> = {
  recordType: "NS60-Record (Status Notification Container Detail)",
  length: 80,
  fields: [
    constantField(1, "60"),
    numericCodeField("actionIndicator", 3, 1, "C"),
    { key: "containerNumber", start: 4, length: 14, class: "AN", designation: "C" },
    { key: "sealNumber1", start: 18, length: 15, class: "AN", designation: "C" },
    { key: "sealNumber2", start: 33, length: 15, class: "AN", designation: "C" },
    filler(48, 33),
  ],
};

// ── Final 11 records (conditional/optional/mode-specific). Field layouts
// cross-checked against tests/abi-broker-download-remaining.test.ts, itself
// independently spot-checked against the source PDF (2B and 0D confirmed
// byte-for-byte) — see recordSpecs.test.ts-style mismatches noted per field
// below where the PDF's own table class disagrees with its description text.

// ── 2M-Record: Manifest Reference Identifier ─────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.15.

export const MANIFEST_REFERENCE_IDENTIFIER_SPEC: RecordSpec<ManifestReferenceIdentifierRecord> = {
  recordType: "2M-Record (Manifest Reference Identifier)",
  length: 80,
  fields: [
    constantField(1, "2M"),
    { key: "carrierAssignedBatchNumber", start: 3, length: 30, class: "AN", designation: "M" },
    filler(33, 48),
  ],
};

// ── 1A-Record: Bill of Lading Amendment ──────────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf pp.18-19.
// Action Code is class A (not the table's "1N") since its values A/D/M/R are
// alphabetic — documented mismatch, see types.ts.

export const BILL_OF_LADING_AMENDMENT_SPEC: RecordSpec<BillOfLadingAmendmentRecord> = {
  recordType: "1A-Record (Bill of Lading Amendment)",
  length: 80,
  fields: [
    constantField(1, "1A"),
    { key: "carrierCode", start: 3, length: 4, class: "AN", designation: "M" },
    numericCodeField("cbpPort", 7, 4, "M"),
    { key: "actionCode", start: 11, length: 1, class: "A", designation: "C" },
    { key: "billOfLadingNumber", start: 12, length: 12, class: "AN", designation: "M" },
    { key: "quantity", start: 24, length: 10, class: "X", designation: "C" },
    { key: "amendmentCode", start: 34, length: 2, class: "X", designation: "C" },
    { key: "houseBillNumber", start: 36, length: 12, class: "X", designation: "C" },
    filler(48, 4),
    { key: "codeQualifier", start: 52, length: 3, class: "AN", designation: "C" },
    { key: "idCode", start: 55, length: 17, class: "AN", designation: "C" },
    { key: "issuerCode", start: 72, length: 4, class: "A", designation: "C" },
    filler(76, 5),
  ],
};

// ── 2B-Record: Bill of Lading Additional / Pre-Carrier Receipt ──────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.25.
// Independently spot-checked byte-for-byte, including the PDF's genuinely
// duplicated "Carrier Code" field label for the two Secondary Notify Party
// SCAC fields (positions 44-47 and 48-51) — see types.ts.

export const BILL_OF_LADING_ADDITIONAL_SPEC: RecordSpec<BillOfLadingAdditionalRecord> = {
  recordType: "2B-Record (Bill of Lading Additional / Pre-Carrier Receipt)",
  length: 80,
  fields: [
    constantField(1, "2B"),
    // Measured quantity, not an identifier — plain class N, not numericCodeField.
    { key: "measurement", start: 3, length: 10, class: "N", designation: "O" },
    { key: "measurementUnit", start: 13, length: 2, class: "A", designation: "C" },
    { key: "placeOfReceiptByPreCarrier", start: 15, length: 17, class: "AN", designation: "C" },
    filler(32, 12),
    { key: "secondaryNotifyParty1Scac", start: 44, length: 4, class: "AN", designation: "O" },
    { key: "secondaryNotifyParty2Scac", start: 48, length: 4, class: "AN", designation: "O" },
    filler(52, 29),
  ],
};

// ── 4B-Record: Bill of Lading Reference Identifier ──────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.26.

export const BILL_OF_LADING_REFERENCE_IDENTIFIER_SPEC: RecordSpec<BillOfLadingReferenceIdentifierRecord> = {
  recordType: "4B-Record (Bill of Lading Reference Identifier)",
  length: 80,
  fields: [
    constantField(1, "4B"),
    { key: "referenceQualifier", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "referenceNumber", start: 6, length: 30, class: "AN", designation: "M" },
    filler(36, 45),
  ],
};

// ── 2N-Record: Entity Address Lines 1 & 2 ────────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.30.

export const ENTITY_ADDRESS_SPEC: RecordSpec<EntityAddressRecord> = {
  recordType: "2N-Record (Entity Address Lines 1 & 2)",
  length: 80,
  fields: [
    constantField(1, "2N"),
    { key: "addressLine1", start: 3, length: 35, class: "X", designation: "M" },
    { key: "addressLine2", start: 38, length: 35, class: "X", designation: "C" },
    filler(73, 8),
  ],
};

// ── 3N-Record: Entity Geographic Area ────────────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.31.

export const ENTITY_GEOGRAPHIC_AREA_SPEC: RecordSpec<EntityGeographicAreaRecord> = {
  recordType: "3N-Record (Entity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "3N"),
    { key: "cityName", start: 3, length: 19, class: "AN", designation: "C" },
    { key: "stateProvince", start: 22, length: 2, class: "AN", designation: "O" },
    { key: "postalCode", start: 24, length: 9, class: "AN", designation: "O" },
    { key: "countryCode", start: 33, length: 2, class: "AN", designation: "O" },
    { key: "locationIdentifier", start: 35, length: 5, class: "AN", designation: "C" },
    filler(40, 41),
  ],
};

// ── 4N-Record: Administrative Communication Contact ─────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.33.
// Positions 53-79 are the PDF's own "reserved for future use" fields, reusing
// the "Comm Number Qualifier"/"Communications Number" labels — modeled as
// real optional fields (not raw filler), same convention as 0N-Record's
// `entityRelationshipCode`/`entityIdCodeReserved`.

export const ADMIN_COMMUNICATION_CONTACT_SPEC: RecordSpec<AdminCommunicationContactRecord> = {
  recordType: "4N-Record (Administrative Communication Contact)",
  length: 80,
  fields: [
    constantField(1, "4N"),
    { key: "contactName", start: 3, length: 23, class: "AN", designation: "O" },
    { key: "commNumberQualifier", start: 26, length: 2, class: "AN", designation: "C" },
    { key: "communicationsNumber", start: 28, length: 25, class: "AN", designation: "C" },
    { key: "reservedCommNumberQualifier", start: 53, length: 2, class: "AN", designation: "C" },
    { key: "reservedCommunicationsNumber", start: 55, length: 25, class: "AN", designation: "C" },
    filler(80, 1),
  ],
};

// ── 1I-Record: Supplemental In-Bond Details ──────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf pp.34-35.
// Value is whole-dollar, 0 implied decimals — plain `number`, not `Decimal`,
// same rationale as the module header's no-Decimal-fields note.

export const SUPPLEMENTAL_IN_BOND_DETAILS_SPEC: RecordSpec<SupplementalInBondDetailsRecord> = {
  recordType: "1I-Record (Supplemental In-Bond Details)",
  length: 80,
  fields: [
    constantField(1, "1I"),
    numericCodeField("inBondEntryType", 3, 2, "M"),
    { key: "fdaBtaConfirmationIndicator", start: 5, length: 1, class: "A", designation: "M" },
    filler(6, 1),
    numericCodeField("conventionalInBondNumber", 7, 9, "C"),
    { key: "inBondCarrierCode", start: 16, length: 4, class: "AN", designation: "C" },
    numericCodeField("usPortOfDestination", 20, 4, "C"),
    numericCodeField("foreignDestination", 24, 5, "C"),
    // Whole dollar value, 0 implied decimals — plain number, not Decimal.
    { key: "value", start: 29, length: 8, class: "N", designation: "M" },
    { key: "bondedCarrierIdNumber", start: 37, length: 12, class: "X", designation: "M" },
    { key: "paperlessInBond", start: 49, length: 11, class: "AN", designation: "C" },
    { key: "shipmentControlNumber", start: 60, length: 16, class: "AN", designation: "C" },
    filler(76, 5),
  ],
};

// ── 2I-Record: Water-Borne Export In-Bond ────────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.36.
// Transportation Indicator is class A (not the table's "2N") since its only
// valid value, "S", is alphabetic — documented mismatch, see types.ts.

export const WATER_BORNE_EXPORT_IN_BOND_SPEC: RecordSpec<WaterBorneExportInBondRecord> = {
  recordType: "2I-Record (Water-Borne Export In-Bond)",
  length: 80,
  fields: [
    constantField(1, "2I"),
    { key: "transportationIndicator", start: 3, length: 2, class: "A", designation: "O" },
    { key: "vesselName", start: 5, length: 23, class: "AN", designation: "O" },
    filler(28, 53),
  ],
};

// ── 2C-Record: Motor Vehicle Control (VIN) ───────────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.39.

export const MOTOR_VEHICLE_CONTROL_SPEC: RecordSpec<MotorVehicleControlRecord> = {
  recordType: "2C-Record (Motor Vehicle Control - VIN)",
  length: 80,
  fields: [
    constantField(1, "2C"),
    { key: "vin", start: 3, length: 30, class: "AN", designation: "M" },
    filler(33, 10),
    { key: "factoryCarOrderNumber", start: 43, length: 10, class: "AN", designation: "O" },
    filler(53, 28),
  ],
};

// ── 0D-Record: Harmonized Tariff Classification ──────────────────────────────
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf p.40.
// Independently spot-checked byte-for-byte, including the space-padding rule:
// Harmonized Number is class AN (not the table's "11N") since the PDF's own
// note says a 6-digit code is space-filled (not zero-filled) to 11 chars —
// left-justified, not right-justified/zero-padded like `numericCodeField` —
// documented mismatch, see types.ts. Value is whole-dollar, 0 implied
// decimals, and Weight is a whole number — both plain `number`, not
// `Decimal`, same rationale as 1I's Value.

export const HARMONIZED_TARIFF_SPEC: RecordSpec<HarmonizedTariffRecord> = {
  recordType: "0D-Record (Harmonized Tariff Classification)",
  length: 80,
  fields: [
    constantField(1, "0D"),
    { key: "harmonizedNumber", start: 3, length: 11, class: "AN", designation: "C" },
    { key: "value", start: 14, length: 8, class: "N", designation: "C" },
    { key: "weight", start: 22, length: 10, class: "N", designation: "C" },
    { key: "weightUnit", start: 32, length: 2, class: "A", designation: "C" },
    filler(34, 47),
  ],
};

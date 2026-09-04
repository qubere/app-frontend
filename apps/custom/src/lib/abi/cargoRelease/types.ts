import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR Cargo Release (SE) chapter — the mandatory backbone
// (SE10/SE11/SE13) plus core commercial extensions (bill of lading, conveyance,
// reference, entity/address/geo at header and line level, HTS line, output
// disposition, equipment, GBI pilot entity identifiers, FTZ detail). Source:
// docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
//
// PGA grouping (OI, PG01-PG35): this chapter's own PDF (record usage map,
// SE-27) lists the grouping but never defines its field layout — there is no
// "Record Identifier PG0x" section anywhere in this document. The layout is
// fully defined only in Chapter 8's PGA Message Set publication
// (docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf), already
// modeled generically at src/lib/abi/pgaMessageSet/ (OI_LINE_ITEM_SPEC,
// PG01_HEADER_SPEC, ... PG60_ADDITIONAL_REFERENCE_SPEC). Cargo Release reuses
// those same records by reference rather than redefining them here.
//
// Deferred (not modeled this slice): the ISF grouping (SF10-SF36) — unlike
// the PGA grouping, this *is* fully defined in this chapter's own PDF
// (pages 73-80+, Unified Entry/ISF Filing) as its own record family, not a
// reuse of another chapter's generic records — but it isn't covered by this
// slice's test fixtures.

export interface HeaderInput {
  actionCode: "A" | "R" | "D";
  entryFilerCode: string;
  /** 8-char (7-digit transaction number + check digit, Appendix E). */
  entryNumber: string;
  entryTypeCode: string;
  importerOfRecordType?: string;
  importerOfRecordNumber?: string;
  modeOfTransportationCode?: string;
  bondTypeCode?: "8" | "9";
  /** Whole US dollars — no implied decimals. */
  estimatedEntryValue: Decimal;
  plannedPortOfEntry?: string;
  splitShipmentReleaseCode?: string;
  portOfUnlading?: string;
}

export interface AdditionalHeaderInput {
  entryDateElectionCode?: string;
  /** MMDDYY. */
  electedEntryDate?: Date;
  locationOfGoodsFirms?: string;
  electedExamSiteFirms?: string;
  conveyanceNameOrFtzId?: string;
  voyageFlightTripManifestNumber?: string;
  generalOrderNumber?: string;
  cbpBondedWarehouseFirms?: string;
  originatingWarehouseEntryFilerCode?: string;
  originatingWarehouseEntryNumber?: string;
  immediateDeliveryIndicator?: string;
}

export interface ContactCancellationInput {
  contactName: string;
  contactPhone: string;
  cancellationReasonCode?: string;
  multipleCargoDispositionsIndicator?: number;
  disIndicator?: number;
  splitShipmentIndicator?: number;
}

export interface BillOfLadingInput {
  billTypeIndicator: string;
  issuerCodeOfBillOfLadingNumber?: string;
  billOfLadingNumber: string;
  /** Quantity manifested — a count, not money. */
  quantity?: number;
  nonAmsIndicator: string;
}

export interface ConveyanceInput {
  carrierCode: string;
  voyageFlightTripManifestNumber: string;
  /** MMDDYY. */
  dateOfArrival: Date;
  quantity: number;
  unitOfMeasure?: string;
  conveyanceName?: string;
}

export interface ReferenceInput {
  referenceIdentifierQualifier: string;
  referenceIdentifier: string;
}

export interface EntityInput {
  entityCode: string;
  entityName?: string;
  entityIdentifierQualifier?: string;
  entityIdentifier?: string;
}

export interface EntityAddressInput {
  addressComponentQualifier1: string;
  addressInformation1: string;
  addressComponentQualifier2?: string;
  addressInformation2?: string;
}

export interface EntityGeoInput {
  cityName: string;
  countrySubEntityCode?: string;
  postalCode?: string;
  countryCode: string;
}

export interface LineItemInput {
  /** 3-char sequential line identifier (e.g. "001") — leading zeros significant. */
  lineItemIdentifier: string;
  countryOfOrigin: string;
  commercialInvoiceDescription?: string;
}

export interface HtsLineInput {
  htsNumber: string;
  /** Whole US dollars — no implied decimals. */
  lineItemValue?: Decimal;
}

export interface OutputDispositionInput {
  messageTypeCode: string;
  messageIdentifierCode?: string;
  narrativeMessageText: string;
}

export interface EquipmentInput {
  /** SCAC prefix + equipment unit's serial number + check digit, as one string. */
  equipmentNumber: string;
}

/** Shared by SE31 (header) and SE51 (line) — both Entity GBI Identifier pilot records have an identical layout. */
export interface EntityGbiInput {
  /** LEI (GLEIF), GLN (GS1), or DUNS (Dun & Bradstreet) — Note 1. */
  gbiIdentifierQualifier: "LEI" | "GLN" | "DUNS";
  gbiIdentifier: string;
}

export interface FtzDetailInput {
  /** P = Privileged Foreign, N = Non-privileged Foreign, D = Domestic, Z = Zone restricted. */
  zoneStatus: "P" | "N" | "D" | "Z";
  /**
   * MMDDYY. Conditional: only used when Privileged Foreign status applies and
   * the SE60 HTS number is no longer active (Note 2) — space-filled otherwise.
   */
  privilegedFtzMerchandiseFilingDate?: Date;
  /** Quantity of this SE40/SE60 HTS line removed from the FTZ — a count, not money. Whole number > 0. */
  ftzLineItemQuantity: number;
}

export interface FtzPfHtsInput {
  /** Full 10-digit current HTS number for Privileged Foreign status merchandise (the SE60 HTS number is no longer active). */
  currentHtsNumberForPfStatusMerchandise: string;
}

export interface BillOfLadingGroupInput {
  /** 1 to 3 SE15 records per Bill of Lading grouping (e.g. for split shipment parts). */
  billsOfLading: [BillOfLadingInput, ...BillOfLadingInput[]] | BillOfLadingInput[];
  conveyances?: ConveyanceInput[];
  equipment?: EquipmentInput[];
}

export interface HeaderEntityGroupInput {
  entity: EntityInput;
  gbiIdentifiers?: EntityGbiInput[];
  streetAddresses?: EntityAddressInput[];
  geographicArea?: EntityGeoInput;
}

export interface LineEntityGroupInput {
  entity: EntityInput;
  gbiIdentifiers?: EntityGbiInput[];
  streetAddresses?: EntityAddressInput[];
  geographicArea?: EntityGeoInput;
}

export interface HtsLineGroupInput {
  htsLine: HtsLineInput;
  ftzPfHts?: FtzPfHtsInput;
}

export interface LineItemGroupInput {
  lineItem: LineItemInput;
  ftzStatus?: FtzDetailInput;
  entities?: LineEntityGroupInput[];
  htsLines: [HtsLineGroupInput, ...HtsLineGroupInput[]] | HtsLineGroupInput[];
  pgaLines?: string[];
}

export interface CargoReleaseTransactionInput {
  header: HeaderInput;
  additionalHeader?: AdditionalHeaderInput;
  contactCancellation: ContactCancellationInput;
  bills?: BillOfLadingGroupInput[];
  references?: ReferenceInput[];
  headerEntities?: HeaderEntityGroupInput[];
  lines?: LineItemGroupInput[];
}

// ── Output Response Types ──

export type CargoReleaseResponseScenario =
  | "ACCEPTED"
  | "REJECTED"
  | "ACCEPTED_WITH_WARNINGS"
  | "REFERRED_TO_HUMAN_REVIEW";

/** Wrapper associating a decoded record with its own SE90 error records (if any). */
export interface ParsedSeRecord<T> {
  record: T;
  errors: OutputDispositionInput[];
}

export interface ParsedBillOfLadingGroup {
  bill: ParsedSeRecord<BillOfLadingInput>;
  conveyances: ParsedSeRecord<ConveyanceInput>[];
  equipment: ParsedSeRecord<EquipmentInput>[];
}

export interface ParsedHeaderEntityGroup {
  entity: ParsedSeRecord<EntityInput>;
  gbiIdentifiers: ParsedSeRecord<EntityGbiInput>[];
  streetAddresses: ParsedSeRecord<EntityAddressInput>[];
  geographicArea?: ParsedSeRecord<EntityGeoInput>;
}

export interface ParsedLineEntityGroup {
  entity: ParsedSeRecord<EntityInput>;
  gbiIdentifiers: ParsedSeRecord<EntityGbiInput>[];
  streetAddresses: ParsedSeRecord<EntityAddressInput>[];
  geographicArea?: ParsedSeRecord<EntityGeoInput>;
}

export interface ParsedHtsLineGroup {
  htsLine: ParsedSeRecord<HtsLineInput>;
  ftzPfHts?: ParsedSeRecord<FtzPfHtsInput>;
}

export interface ParsedLineItemGroup {
  lineItem: ParsedSeRecord<LineItemInput>;
  ftzStatus?: ParsedSeRecord<FtzDetailInput>;
  entities: ParsedLineEntityGroup[];
  htsLines: ParsedHtsLineGroup[];
  pgaLines: string[];
}

export interface ParsedCargoReleaseHeaderGroup {
  scenario: CargoReleaseResponseScenario;
  header: ParsedSeRecord<HeaderInput>;
  additionalHeader?: ParsedSeRecord<AdditionalHeaderInput>;
  contactCancellation?: ParsedSeRecord<ContactCancellationInput>;
  bills: ParsedBillOfLadingGroup[];
  references: ParsedSeRecord<ReferenceInput>[];
  headerEntities: ParsedHeaderEntityGroup[];
  lines: ParsedLineItemGroup[];
  disposition?: OutputDispositionInput;
}

export interface ParsedCargoReleaseResponse {
  scenario: CargoReleaseResponseScenario;
  headerGroups: ParsedCargoReleaseHeaderGroup[];
  unrecognizedLines: string[];
}




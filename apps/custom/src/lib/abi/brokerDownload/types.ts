// Types for the CATAIR ACE Broker Download chapter (Chapter 9 / BD & NS
// Applications) — all 27 records (BD & NS Application Groupings). Unlike
// every other chapter modeled so far, Broker Download is output-only: CBP
// pushes this data to ABI filers (there is no filer-submitted input side), so
// Qubere's real usage is decoding what CBP sends, not encoding it.
// Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf (August
// 2024 DRAFT)
//
// Chapter coverage: 1M, 1P, 1J, 1B, 0N, 1C, 1D, 2D, NS05, NS30 (core
// mandatory backbone, first slice); 1V, 2V, 3V, NS40, NS50, NS60 (hazmat &
// status-notification detail, second slice, pages 43-45/49-51); 2M, 1A, 2B,
// 4B, 2N, 3N, 4N, 1I, 2I, 2C, 0D (final 11 conditional/optional/mode-specific
// records, this slice, pages 15/18-19/25/26/30/31/33/34-35/36/39/40) — all
// 27 records tests/abi-broker-download-specs.test.ts's DEFERRED_RECORDS
// registry originally catalogued as deferred are now modeled (that registry
// itself is a standalone audit fixture and is not re-synced here).
//
// No `Decimal`-bound fields exist anywhere in this chapter: every
// quantity/weight/value field the source PDF documents (1B's Manifest
// Quantity & Weight, 1D's Piece Count, NS30's Quantity, 1I's and 0D's Value
// — both explicitly "whole dollar value ... 0 decimals" — 0D's Weight) is
// explicitly a whole number with no implied decimal scaling — plain
// `number`, not `Decimal`. Don't add implied-decimal scaling here; nothing
// in the source PDF or test fixtures calls for it.

/** 1M-Record: Manifest Header. One per manifest; carrier, mode, conveyance,
 * and trip identification. */
export interface ManifestHeaderRecord {
  /** SCAC of the importing carrier. */
  carrierCode: string;
  /** 10=Vessel Non-Cont, 11=Vessel Cont, 20=Rail Non-Cont, 21=Rail Cont,
   * 30=Land Non-Cont. Kept as the raw zero-padded string (not `number`) since
   * it's an identifier code, not a count. */
  transportationIndicator: string;
  /** Mandatory in Ocean/Rail; not used in Truck. */
  countryCode?: string;
  /** Trip number in Truck mode ("SYSTEM" if preliminary and unknown). */
  conveyanceName?: string;
  /** Rail: Julian date YYDDD; Ocean: voyage number — class "5X" (alphanumeric),
   * not a date field, since it holds either format depending on mode. Kept as
   * a plain string, never bound to `Date`. */
  tripData?: string;
  /** Rail and Ocean only; defaults to "000001" — an identifier/sequence
   * value, not a count, so kept as a zero-padded string. */
  manifestSequenceNumber?: string;
  /** IMO code (Ocean). */
  vesselCode?: string;
  /** P=Preliminary, Y=Amendment, T=In-transit, W=Complete. */
  manifestTypeCode: "P" | "Y" | "T" | "W";
}

/** 1P-Record: Port of Crossing. */
export interface PortOfCrossingRecord {
  /** Schedule D port code — leading zero significant. */
  portOfUnlading: string;
  /** MMDDYY. Per the source PDF this field is labeled class "N", but it uses
   * the same 6-char MMDDYY wire format as every other chapter's class-D date
   * field, so it's bound to `Date` via the shared `dateField` helper (see
   * recordSpecs.ts) rather than treated as a new format. */
  originalScheduledArrivalDate?: Date;
  /** Rail only. */
  firmsCode?: string;
  /** HHMM (Rail & Truck) — kept as a raw string, not a full date/time. */
  time?: string;
}

/** 1J-Record: Issuer Code. */
export interface IssuerCodeRecord {
  /** SCAC of the party issuing the master bill / SCN. */
  issuerCode: string;
}

/** 1B-Record: Bill of Lading Transaction. */
export interface BillOfLadingTransactionRecord {
  /** Master bill number / SCN. */
  billOfLading: string;
  /** Schedule K code — leading zero significant. */
  foreignPortOfLading: string;
  /** Rail/Ocean required; whole number (not truncated by implied decimals) —
   * not returned in Truck. */
  manifestQuantity?: number;
  manifestUnits?: string;
  /** Gross weight in whole numbers, no decimals (per the source PDF's own
   * field note) — plain `number`, not `Decimal`. */
  weight?: number;
  /** LB, KG, LT, ST, ET, MT. */
  weightUnit?: string;
  /** Bill type: 0, 2-9, B, I, J, K, M, N, O, P, R, S, T, U — class X since the
   * value set mixes digits and letters. */
  billStatusIndicator?: string;
  /** "0"/space = Not MIB, "1" = MIB (Rail/Ocean). */
  masterInBondIndicator?: string;
  /** Truck & Ocean house bill. */
  houseBillNumber?: string;
  /** 61, 62, 63, 69, 70 — identifier code, kept as a zero-padded string. */
  inBondEntryType?: string;
  /** Schedule D port code — leading zero significant. */
  inBondPortOfDestination: string;
  /** SCAC of the house bill issuer. */
  issuerCode?: string;
}

/** 0N-Record: Entity Name. Note: the source PDF's own Filler field label
 * reads "78AN" (positions 64-80), but 64 to 80 inclusive is 17 characters —
 * a documented typo in CBP's source document, not a bug here. The filler is
 * modeled at its correct 17-char width. */
export interface EntityNameRecord {
  /** BN, C1, CB, CD, CN, IM, N1, N2, OO, PF, SF, SH, UC, SNP. */
  entityIdCode?: string;
  name?: string;
  /** 2=SCAC, 17=ABI Routing Code. */
  codeQualifier?: string;
  /** SCAC/FIRMS or ABI routing code. */
  idCode?: string;
  /** Reserved for future use. */
  entityRelationshipCode?: string;
  /** Reserved for future use. */
  entityIdCodeReserved?: string;
}

/** 1C-Record: Bill of Lading Container. */
export interface BillOfLadingContainerRecord {
  /** Equipment prefix. */
  equipmentInitial?: string;
  /** Equipment serial number ("No number" in Truck if unknown). */
  equipmentNumber: string;
  sealNumber1?: string;
  sealNumber2?: string;
  /** See Ocean Appendix B ("NC" if none). */
  containerDescriptionCode?: string;
  /** FFFII (feet + inches) composite code (Ocean only) — an identifier-style
   * packed value, not a plain integer, kept as a zero-padded string. */
  containerLength?: string;
  /** FFFFFFII format (Ocean only) — class X per the source PDF. */
  height?: string;
  /** FFFFFFII format (Ocean only) — class X per the source PDF. */
  width?: string;
  /** Ocean Appendix M (Ocean only). */
  containerType?: string;
  /** E/L for Rail/Ocean; C/I/A/B for Truck. */
  loadEmptyStatus?: string;
  /** BB, CS, CY, HH, HL, HP, MD, NC, PH, PP, RR (Ocean only). */
  typeOfService?: string;
}

/** 1D-Record: Bill Cargo Description. */
export interface BillCargoDescriptionRecord {
  /** Smallest exterior package units — whole number, not `Decimal`. */
  pieceCount?: number;
  description: string;
  /** CBP C4 line release number (Rail & Truck). */
  c4Number?: string;
  /** Manifest unit of measure. */
  manifestUnitCode?: string;
  /** ISO country code of origin (Rail & Truck). */
  countryCode?: string;
}

/** 2D-Record: Marks and Numbers. */
export interface MarksAndNumbersRecord {
  /** "No Marks or Numbers" if none exist (Rail and Ocean convention). */
  marksAndNumbers?: string;
}

/** NS05-Record: Status Notification Header — Conveyance Information. Wire
 * control identifier is the bare 2-char "05" (not "NS05" — the "NS" prefix
 * distinguishes this chapter's Application Identifier grouping from "BD", it
 * isn't literally present in the record's own first two bytes). */
export interface StatusNotificationHeaderRecord {
  importingConveyanceName?: string;
  /** Rail: Julian date YYDDD; Ocean: voyage number — class "5X", kept as a
   * plain string, same rationale as 1M's `tripData`. */
  tripNumber?: string;
  /** Schedule D port code — leading zero significant. */
  port?: string;
  /** YYMMDD — note the year-month-day field order, distinct from every other
   * chapter's MMDDYY convention. See `dateFieldYYMMDD` in fixedWidth.ts. */
  estimatedArrivalDate?: Date;
  /** HHMMSS (Rail only) — leading zero significant, kept as a raw
   * zero-padded string rather than a lossy numeric parse. */
  estimatedArrivalTime?: string;
}

/** NS30-Record: Status Notification Detail. Wire control identifier is the
 * bare 2-char "30" (see `StatusNotificationHeaderRecord`'s note on "NS"). */
export interface StatusNotificationDetailRecord {
  /** Posting action disposition code. */
  dispositionCode: string;
  /** SCAC — mandatory for Ocean. */
  issuerCodeMasterBill?: string;
  /** Master bill / SCN. */
  masterBillNumber: string;
  /** SCAC (Truck & Ocean). */
  issuerCodeHouseBill?: string;
  houseBillNumber?: string;
  /** Reserved space fill. */
  issuerCodeSubHouseBill?: string;
  /** Reserved space fill. */
  subHouseBillNumber?: string;
  /** Total piece count affected — whole number, not `Decimal`. */
  quantity: number;
  /** "N" for negative quantity, else space. */
  negativeIndicator?: string;
  /** YYMMDD — see `StatusNotificationHeaderRecord.estimatedArrivalDate`. */
  actionDate: Date;
  /** HHMM military format — leading zero significant, kept as a raw
   * zero-padded string. */
  actionTime: string;
  /** SCAC or IATA code. */
  inBondCarrierCode: string;
}

/** 1V-Record: Hazardous Material Detail. Conditional; may repeat up to ten
 * times. Rail/Ocean/Truck (per-field usage varies — see individual notes). */
export interface HazardousMaterialDetailRecord {
  /** UN/identification number assigned to the hazardous material. Rail,
   * Ocean and Truck. Class X per the source PDF (not AN) — kept as a plain
   * string. */
  hazardousMaterialCode: string;
  /** IMDG hazardous class/division code. Ocean only. */
  hazardousMaterialClass?: string;
  /** Code describing the hazardous material class. Rail and Ocean only. */
  hazardousMaterialCodeQualifier?: string;
  /** Proper shipping name of the hazardous material. Rail and Ocean only. */
  hazardousMaterialDescription?: string;
  /** Name and/or phone number of the emergency contact. Rail, Ocean and
   * Truck. */
  hazardousMaterialContact?: string;
  /** IMDG code page number where the hazardous material identification
   * appears. Ocean only. */
  unHazardousMaterialPage?: string;
}

/** 2V-Record: Additional Hazardous Material Detail (Flashpoint). Conditional;
 * Rail and Ocean only. */
export interface AdditionalHazardousMaterialDetailRecord {
  /** Lowest temperature at which the hazardous combustible liquid's vapor
   * ignites in air. A genuine measured quantity (paired with
   * `negativeIndicator` for sign), not an identifier — plain `number`, not
   * zero-pad-preserving. */
  flashpointTemperature?: number;
  /** Unit of measure for the flashpoint temperature — "CE" (Centigrade/
   * Celsius) is the only documented value. */
  unitOfMeasureCode?: string;
  /** "N" when the flashpoint temperature is negative (below 0 C), else
   * space. */
  negativeIndicator?: string;
}

/** 3V-Record: Hazardous Material Classification Detail. Conditional; may
 * repeat up to 99 times. Rail and Ocean only. */
export interface HazardousMaterialClassificationDetailRecord {
  /** Material name, special instructions and/or phone number. */
  hazardousMaterialDescription?: string;
  /** Free-form hazardous material classification/division/label
   * requirements. Ocean only. */
  hazardousMaterialClassification?: string;
}

/** NS40-Record: Status Notification Continuation. Wire control identifier is
 * the bare 2-char "40" (see `StatusNotificationHeaderRecord`'s note on the
 * "NS" Application Identifier grouping). Conditional; follows the associated
 * NS30 record when present. */
export interface StatusNotificationContinuationRecord {
  /** Entry category code (ACE Ocean Appendix B). Identifier with
   * leading-zero significance, not a quantity. */
  entryType?: string;
  /** CBP entry number, form number, or regulatory provision. */
  entryNumber?: string;
  /** Schedule D port code where the action occurred; always "9900" for
   * disposition code 1W status notifications. */
  portOfTransaction: string;
  /** FIRMS code for the location of the goods. */
  firmsCode?: string;
  /** Container/equipment number associated with the bill of lading. */
  containerNumber?: string;
}

/** NS50-Record: Status Notification Remarks. Wire control identifier is the
 * bare 2-char "50". Conditional; at most two per NS30 record. */
export interface StatusNotificationRemarksRecord {
  /** Free-text reason a hold is placed; may contain hold quantities or other
   * information. */
  remarks: string;
}

/** NS60-Record: Status Notification Container Detail. Wire control
 * identifier is the bare 2-char "60". Conditional; up to 999 per NS30
 * record. */
export interface StatusNotificationContainerDetailRecord {
  /** "1" indicates the NS30 disposition action was taken specifically
   * against this container; blank indicates it was not a container-level
   * action. Identifier-style flag, not a quantity. */
  actionIndicator?: string;
  /** Container/equipment number. */
  containerNumber?: string;
  /** Exporter/carrier seal number. */
  sealNumber1?: string;
  /** Exporter/carrier seal number. */
  sealNumber2?: string;
}

// ── Final 11 records (conditional/optional/mode-specific), pages
// 15/18-19/25/26/30/31/33/34-35/36/39/40 ─────────────────────────────────────

/** 2M-Record: Manifest Reference Identifier. Conditional; Rail only. */
export interface ManifestReferenceIdentifierRecord {
  /** Control number assigned by the carrier (Rail only). */
  carrierAssignedBatchNumber: string;
}

/** 1A-Record: Bill of Lading Amendment. Conditional; carries an
 * Add/Delete/Replace action against a previously transmitted bill of
 * lading. */
export interface BillOfLadingAmendmentRecord {
  /** SCAC of the importing carrier. */
  carrierCode: string;
  /** USCBP port of crossing or unlading — Schedule D port code, leading
   * zero significant. */
  cbpPort: string;
  /** A=Add, D=Delete, M=Replace segment, R=Replace manifest quantity. Class
   * A per the source PDF's own description text, not class N as the
   * table's "1N" heading claims — the value set A/D/M/R is alphabetic, not
   * numeric (documented mismatch). */
  actionCode?: string;
  /** Master bill of lading number / SCN. */
  billOfLadingNumber: string;
  /** Amended quantity, meaningful only when Action Code is R (Rail/Ocean).
   * Class X per the source PDF, not a plain numeric field — kept as a
   * string, not `number`. */
  quantity?: string;
  /** Reason code for the manifest amendment (ACE Ocean Appendix B). */
  amendmentCode?: string;
  /** House bill number (Truck and Ocean HBR). */
  houseBillNumber?: string;
  /** "ABI" = ABI Office Routing Code. */
  codeQualifier?: string;
  /** ABI office routing code (Port 4 + Filer 3 + Office 2 = 9 chars). */
  idCode?: string;
  /** SCAC of the house bill issuer (Truck and Ocean HBR). */
  issuerCode?: string;
}

/** 2B-Record: Bill of Lading Additional / Pre-Carrier Receipt. Conditional. */
export interface BillOfLadingAdditionalRecord {
  /** Measurement from the manifest; zero-filled if not transmitted. A
   * measured quantity, not an identifier — plain `number`. */
  measurement?: number;
  /** Unit of measure for `measurement`; required if measurement is given. */
  measurementUnit?: string;
  /** City/country where the pre-carrier took possession of the cargo. */
  placeOfReceiptByPreCarrier?: string;
  /** 1st Secondary Notify Party SCAC. Labeled "Carrier Code" in the source
   * PDF's own field table — the same label the PDF reuses for
   * `secondaryNotifyParty2Scac` below, a documented duplicate for two
   * distinct fields, not a copy-paste bug here. */
  secondaryNotifyParty1Scac?: string;
  /** 2nd Secondary Notify Party SCAC — see `secondaryNotifyParty1Scac`. */
  secondaryNotifyParty2Scac?: string;
}

/** 4B-Record: Bill of Lading Reference Identifier. Conditional; the source
 * PDF's own page intro text says it repeats up to ten times, while the
 * chapter's general repeat-record structure allows up to 999 — a documented
 * cardinality ambiguity, not resolved here since it doesn't affect the
 * per-record wire layout. */
export interface BillOfLadingReferenceIdentifierRecord {
  /** Reference type code (e.g. 8S, BEN, BL, BM, BN, CG, CN, CO, CR, CUB, CX,
   * ED, EP, FEN, FN, FP, GB, GR, HS, IN, LT, MA, MB). 2-char codes are
   * left-justified. */
  referenceQualifier: string;
  /** The number identified by `referenceQualifier`. */
  referenceNumber: string;
}

/** 2N-Record: Entity Address Lines 1 & 2. Conditional. */
export interface EntityAddressRecord {
  /** First line of the entity's address (or country). Labeled "Entity Party
   * Address" in the source PDF — the same label the PDF reuses for
   * `addressLine2` below, a documented duplicate, not a copy-paste bug
   * here. */
  addressLine1: string;
  /** Second line of the entity's address, if available — see
   * `addressLine1`. */
  addressLine2?: string;
}

/** 3N-Record: Entity Geographic Area. Conditional. */
export interface EntityGeographicAreaRecord {
  /** City name (limited to 19 chars for Rail). */
  cityName?: string;
  /** State/Province code (Rail and Ocean only). */
  stateProvince?: string;
  /** Postal/Zip code, without punctuation or blanks. */
  postalCode?: string;
  /** ISO country code. */
  countryCode?: string;
  /** Space-filled in Rail/Ocean; a 1-3 letter state/province code in Truck. */
  locationIdentifier?: string;
}

/** 4N-Record: Administrative Communication Contact. Conditional. */
export interface AdminCommunicationContactRecord {
  /** Contact person's name. */
  contactName?: string;
  /** Qualifier code (AU, CP, ED, EM, EX, FT, FX, HP, IT, PS, TE, TL, TM, TX,
   * WP). */
  commNumberQualifier?: string;
  /** Communications number, including country/area code where applicable
   * (Rail/Truck); truncated if longer than 25 chars. */
  communicationsNumber?: string;
  /** Reserved for future use; space-filled. Labeled "Comm Number Qualifier"
   * in the source PDF — the same label the PDF uses for
   * `commNumberQualifier` above, a documented duplicate, not a copy-paste
   * bug here. */
  reservedCommNumberQualifier?: string;
  /** Reserved for future use; space-filled — see
   * `reservedCommNumberQualifier`. */
  reservedCommunicationsNumber?: string;
}

/** 1I-Record: Supplemental In-Bond Details. Conditional. */
export interface SupplementalInBondDetailsRecord {
  /** 61=IT, 62=T&E, 63=IE, 69=Transit (US-CA-US), 70=Transit (CA-US-CA) —
   * identifier code, kept as a zero-padded string via `numericCodeField`. */
  inBondEntryType: string;
  /** Y=PN on file with FDA, N=No PN on file. */
  fdaBtaConfirmationIndicator: string;
  /** CF-7512 in-bond number; zero-filled if the carrier transmits a V
   * in-bond instead — identifier, kept as a zero-padded string via
   * `numericCodeField`. */
  conventionalInBondNumber?: string;
  /** SCAC of the in-bond carrier. */
  inBondCarrierCode?: string;
  /** Schedule D port of termination (61), export (62), or arrival (63) —
   * leading zero significant. */
  usPortOfDestination?: string;
  /** Schedule K code for the foreign port of destination (62/63); blank for
   * 61 — leading zero significant. */
  foreignDestination?: string;
  /** Whole dollar value (USD, 0 implied decimals); $20/kg if unknown, must
   * be greater than zero — plain `number`, matching this chapter's
   * established whole-number-amount precedent (see module header). */
  value: number;
  /** IRS (NN-NNNNNNNXX), CBP (YYDDPP-NNNN), or SSN (NNN-NN-NNNN) format,
   * with hyphens — class X per the source PDF, kept as a string. */
  bondedCarrierIdNumber: string;
  /** Carrier-assigned V in-bond number. */
  paperlessInBond?: string;
  /** Carrier-assigned shipment control number (Truck only). */
  shipmentControlNumber?: string;
}

/** 2I-Record: Water-Borne Export In-Bond. Conditional; Rail only. */
export interface WaterBorneExportInBondRecord {
  /** Must be "S" (Sea). Class A per the source PDF's own description text,
   * not class N as the table's "2N" heading claims — the only valid value
   * is alphabetic (documented mismatch). */
  transportationIndicator?: string;
  /** Name of the exporting vessel. */
  vesselName?: string;
}

/** 2C-Record: Motor Vehicle Control (VIN). Conditional. */
export interface MotorVehicleControlRecord {
  /** Vehicle Identification Number (Canadian finished vehicles). */
  vin: string;
  /** Canadian border car order number (Rail only). */
  factoryCarOrderNumber?: string;
}

/** 0D-Record: Harmonized Tariff Classification. Conditional. */
export interface HarmonizedTariffRecord {
  /** HTSUS code, left-justified; space-filled (not zero-filled) if only 6
   * digits are sent. Class AN per the source PDF's own field note, not
   * class N as the table's "11N" heading claims (documented mismatch) —
   * kept as a plain string, not `numericCodeField` (which right-justifies
   * and zero-pads; this field is left-justified and space-padded). */
  harmonizedNumber?: string;
  /** Whole dollar value (USD, 0 implied decimals), must be greater than
   * zero — plain `number`, same rationale as 1I's `value`. */
  value?: number;
  /** Net weight in pounds or kilos, must be greater than zero — whole
   * number, no implied decimals, matching this chapter's weight-field
   * precedent (1B's `weight`). */
  weight?: number;
  /** Unit of measure: LB, KG, LT, ST, ET, MT (Rail/Ocean); G, L, K, O, T
   * (Truck). */
  weightUnit?: string;
}

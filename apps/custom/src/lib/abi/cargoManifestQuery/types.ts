// Types for the CATAIR ACE Cargo Manifest/In-bond/Entry Status Query chapter
// (04b) — the 6 records forming one complete "query an entry, get its status
// back" round trip. Request messages use Application Identifier "CQ"
// (WR1-Input); response messages use "C1" (WR0, WO10, WO60, WR1-Output, WR2).
// Source: docs/plans/catair-source-docs/04b-cargo-manifest-bond-entry-status-query-v21.pdf
//
// Extended (below): WO20, WO30, WO40, WO42, WO50, WO70, WO71, WO72, WR3, WR4,
// WR5, WS4, WS5, WSA, WSB, WSC, WSD, WN0, WN1 — the remaining conditional/
// mode-specific output records, added once their field layouts were
// cross-checked against the source PDF (page citations noted per record).

/**
 * WR1-Record (Input): Cargo Manifest Query Request. Per the record's own
 * Note 1, only one type of query may be initiated per WR1 record: entry
 * (`entryFilerCode` + `entryNumber`), in-bond (`inBondNumber` alone), an
 * ocean/rail/truck bill (`issuerCode` + `billNumber`, i.e. SCAC + Master
 * Bill Number), or an air waybill (`airWaybillNumber`, optionally +
 * `houseAirWaybillNumber`). The WR1-Record (Input) may be repeated to submit
 * multiple queries in one transmission.
 */
export interface CargoManifestQueryRequestInput {
  entryFilerCode?: string;
  /** 8-char Appendix E entry number (7-digit transaction number + check
   * digit) — see `@/lib/abi/entryNumber`. Wire-encoded right-justified in a
   * 9-char field per the record's own field note ("The number must be right
   * justified"). */
  entryNumber?: string;
  /** The in-bond ("IT") number. Left-justified on the wire per the field note. */
  inBondNumber?: string;
  /** SCAC of the bill of lading issuer (ocean/rail/truck), or the air
   * carrier code (2-3 char) when querying an in-bond by air. */
  issuerCode?: string;
  /** Left-justified on the wire per the field note. */
  billNumber?: string;
  airWaybillNumber?: string;
  houseAirWaybillNumber?: string;
  /** "Y" to also return related House/Master Bills when querying an ocean
   * bill by Issuer Code + Bill Number. */
  requestRelatedBol?: "Y";
  /** "Y" to also return bill-of-lading status for any master/house bills or
   * in-bond numbers found on the queried entry. */
  requestBillAndEntryData?: "Y";
  /** Limits the number of notifications returned in the query response. */
  limitOutputOption?: "1" | "2";
}

/**
 * WR0-Record (Output): Entry Query Error. Conditional — returned only when
 * the original query involved an entry filer + entry number and CBP could
 * not process it.
 */
export interface CargoManifestQueryErrorOutput {
  entryFilerCode: string;
  entryNumber: string;
  /** See the CQ Query Error Appendix (record Note 1) for the code list. */
  errorMessageId: string;
  narrativeMessage: string;
}

/**
 * WO10-Record (Output): Entry Status Processing Header. Mandatory header of
 * a successful entry-status query response; mirrors ACE Cargo Release's
 * SO10 Notification Record.
 */
export interface EntryStatusHeaderOutput {
  /** Class N (leading zero significant) — see `numericCodeField`. */
  districtPortOfEntry?: string;
  entryFilerCode: string;
  /** 8-char entry number — plain, unlike the WR-Records' 9-char
   * right-justified variant (no field note here calling for right-justify). */
  entryNumber: string;
  /** Class N (leading zero significant), e.g. "01". */
  entryTypeCode: string;
  /** See the field's own Note 1 for valid formats (IRS/CBP-assigned/SSN). */
  importerOfRecordNumber: string;
  carrierCode?: string;
  vesselName?: string;
  voyageFlightTripNumber?: string;
  estimatedDateOfArrival?: Date;
  splitShipmentReleaseCode?: string;
  /** "P" indicates the response is due to a PGA CA (correction) request. */
  correctionResponseIndicator?: string;
}

/**
 * WO60-Record (Output): Disposition/Status Result. Repeats as often as
 * necessary — one per disposition event on the queried entry.
 */
export interface EntryDispositionResultOutput {
  dispositionActionDate: Date;
  /** Military HHMM, leading zero significant — see `numericCodeField` (same
   * convention as PGA's `requestedOrScheduledTimeOfInspection`). */
  dispositionActionTime: string;
  /** Class AN, not purely numeric — e.g. "1N" is a valid code per the
   * record's own Note 1 table alongside "22", "98", "04" etc. — so kept as a
   * raw string, not run through `numericCodeField`. */
  dispositionActionCode: string;
  narrativeMessage: string;
  /** Only returned if Disposition Action Code is 22 or 98. */
  releaseDate?: Date;
  /** Class N (leading zero significant); only returned if Disposition Action
   * Code is 22 or 98 — see Note 2's code table. */
  releaseOriginCode?: string;
  /** Per the source PDF's own inconsistency (position range stated as 65-67
   * but Length/Class stated as "6AN") — implemented here at positions 65-70
   * per the position-math resolution documented in recordSpecs.ts. */
  documentType?: string;
}

/**
 * WR1-Record (Output): Manifest Processing Results / Conveyance. A
 * completely different field layout from `CargoManifestQueryRequestInput`
 * above despite sharing the same 2-char "WR" + Record Type "1" control
 * identifier — the shared "WR1" name only identifies the record family
 * across the Input/Output split, not a single shared shape. Conditional;
 * returned once per successful query.
 */
export interface ManifestConveyanceResultOutput {
  /** Class N (leading zero significant). */
  districtPortOfEntry?: string;
  entryFilerCode?: string;
  /** 9-char right-justified on the wire, same convention as the WR1-Input's
   * `entryNumber` and WR0's `entryNumber` — see the field's own reused note. */
  entryNumber?: string;
  /** Class N (leading zero significant). */
  entryTypeCode?: string;
  importerOfRecordNumber?: string;
  brokerReferenceNumber?: string;
  carrierCode?: string;
  importingVesselCodeOrConveyanceName?: string;
  voyageFlightTripNumber: string;
  dateOfArrival: Date;
}

/**
 * WR2-Record (Output): Trip Number & FIRMS Cargo Location. Conditional;
 * returned once per successful entry query.
 */
export interface TripFirmsLocationOutput {
  /** MOT Truck trip number. */
  tripNumber: string;
  /** FIRMS code indicating the location of the air cargo. */
  firmsCode: string;
}

// ── WSA-Record (Output): In-Bond/Bill Query Error (page 23) ────────────────
// Conditional; returned instead of WR1-Output/WR2 when the original query
// involved an in-bond number, issuer code of master bill, or master bill
// number and CBP could not process it.

export interface InBondBillQueryErrorOutput {
  /** Left-justified per the field's own note. Mandatory when querying by
   * in-bond number. */
  inBondNumber?: string;
  /** SCAC or 2-3 char air carrier code of the master bill's issuer. Mandatory
   * when Master Bill Number is used, or when In-bond Number is used and the
   * mode of transportation is Air. */
  issuerCode?: string;
  /** Left-justified per the field's own note. Required when querying by
   * ocean/rail/truck bill, mandatory when the issuer code (SCAC) is used. */
  billNumber?: string;
  /** See the CQ Query Error Appendix for the code list. */
  errorMessageId: string;
  narrativeMessage: string;
}

// ── WSB-Record (Output): Air Waybill Query Error (page 24) ─────────────────
// Conditional; returned instead of WR1-Output/WR2 when the original query
// involved an air waybill (+ optional house air waybill) and CBP could not
// process it.

export interface AirWaybillQueryErrorOutput {
  airWaybillNumber: string;
  /** May only be sent together with `airWaybillNumber` per the field's own
   * note. */
  houseAirWaybillNumber?: string;
  /** See the CQ Query Error Appendix for the code list. */
  errorMessageId: string;
  narrativeMessage: string;
}

// ── WR3-Record (Output): Country of Origin & Tariff (page 27) ──────────────
// Conditional; used when the original query pertained to an entry. Per the
// record's own descriptive paragraph, this record is "reserved for future
// use and is not currently returned" — modeled anyway since CATAIR still
// documents its wire layout and a future CBP release could activate it.

export interface CountryOriginTariffResultOutput {
  /** Class N (leading zero significant) — see `numericCodeField`. Usually
   * the same Record Control Number transmitted on the original H5/40/SE40
   * input record's corresponding line. */
  recordControlNumber?: string;
  /** ISO country code (Appendix G). */
  countryOfOrigin: string;
  tariffNumber: string;
}

// ── WS4-Record (Output): In-Bond Status (Update) (page 31) ─────────────────
// Used once per surface in-bond query when there has been an update action
// at the in-bond level. Immediately followed by a WR1-Output + WR4 pair per
// bill associated with the in-bond, per the record's own note.

export interface InBondStatusUpdateOutput {
  /** See Note 1's code table (AR, CN, ER, EX, IF, IU, UA, OF). */
  inBondStatus?: string;
  inBondArrivalDate?: Date;
  inBondExportDate?: Date;
  /** Class AN, not numeric, despite the code list (61/62/63/69/70) being all
   * digits — kept as a raw string, not run through `numericCodeField`, same
   * rationale as WO60's `dispositionActionCode`. See Note 2's code table. */
  inBondEntryType?: string;
}

// ── WR4-Record (Output): In-Bond Bill Detail (page 29) ──────────────────────
// Repeats as necessary to report all in-bond entries posted to a specific
// Master or House bill of lading; latest in-bond listed first when more than
// one applies to a given bill.

export interface InBondBillDetailOutput {
  /** Left-justified; special characters (spaces, hyphens, slashes) stripped
   * per the field's own note. */
  inBondNumber?: string;
  masterBillNumber?: string;
  houseBillNumber?: string;
  subHouseBillNumber?: string;
  /** Right-justified, no implied decimal places (Note 2) — smallest exterior
   * packaging unit at the lowest reported bill level. */
  manifestQuantity?: number;
  /** Appendix N unit-of-measure code. */
  unit?: string;
  issuerCodeOfMasterBillNumber?: string;
  issuerCodeOfHouseBillNumber?: string;
  /** "0"=Regular/Simple, "M"=Master, "H"=House, "F"=FROB. */
  billOfLadingType?: string;
  /** "Y"/"N" — Ocean AMS only. */
  importerSecurityFilingIndicator?: string;
  /** "1"=Ocean, "2"=Rail, "3"=Truck. */
  modeOfTransportationCode?: string;
}

// ── WS5-Record (Output): In-Bond Status (Detail) (page 34) ─────────────────
// Same field shape as WS4, but used instead of it when there has been no
// update action at the in-bond level — repeated once per bill associated
// with the in-bond (preceded by a WR1-Output + WR4 pair per the record's own
// note), rather than WS4's single once-per-query cardinality.

export interface InBondStatusDetailOutput {
  /** See Note 1's code table (AR, CN, ER, EX, IF, IU, UA, OF). */
  inBondStatus?: string;
  /** Field note: all-zero (not blank) when there is no associated date. */
  inBondArrivalDate?: Date;
  /** Field note: all-zero (not blank) when there is no associated date. */
  inBondExportDate?: Date;
  /** Class AN — same rationale as WS4's `inBondEntryType`. */
  inBondEntryType?: string;
}

// ── WSC-Record (Output): Air In-Bond/Manifest Status Detail (pages 36-37) ──
// Conditional; may repeat as necessary. When there is more than one in-bond
// on a Master or House level, the latest in-bond is listed first.

export interface AirInBondManifestStatusOutput {
  importingCarrierCode: string;
  /** Normalized to 5 positions if fewer were transmitted on the manifest. */
  flightNumber: string;
  scheduledArrivalDate: Date;
  /** First 3 positions identify the air carrier; next 8 are a sequential
   * number. */
  airWaybillNumber: string;
  /** Alpha "split" identifier for a split master air waybill. */
  partIndicator?: string;
  /** Right-justified, no implied decimal places (Note 4). */
  manifestQuantity: number;
  /** Mandatory (per the field's own note) when `partIndicator` is present. */
  boardedQuantity?: number;
  /** Left-justified if under 12 chars — see `wscRecordVersion` for the
   * version note affecting justification. */
  houseAirWaybillNumber?: string;
  /** Alpha "split" identifier for a split house air waybill. */
  housePartIndicator?: string;
  houseManifestQuantity?: number;
  /** Mandatory (per the field's own note) when `housePartIndicator` is
   * present. */
  houseBoardedQuantity?: number;
  /** Class N (leading zero significant) — an 11 or 9-digit in-bond number
   * (CBP-assigned In-bond Number or Air Waybill Number per Note 1). */
  inBondNumber?: string;
  /** See WS4's `inBondStatus` code table. */
  inBondStatus?: string;
  /** Class AN — same rationale as WS4's `inBondEntryType`. */
  inBondEntryType?: string;
  /** Space = pre-existing version (House AWB right-justified); "1" = PROD
   * 1/16/2020 version (House AWB left-justified) — see Note 5. */
  wscRecordVersion?: string;
}

// ── WSD-Record (Output): Air Waybill Disposition Result (page 39) ──────────
// Conditional; may repeat as necessary. Not returned for a transaction
// associated with an error message (see WSB instead).

export interface AirWaybillDispositionResultOutput {
  dispositionActionDate: Date;
  /** HHMMSS (hour/minute/second), unlike every other disposition-time field
   * in this chapter (WO60/WO50/WR5 are HHMM) — see `numericCodeField`. */
  dispositionActionTime: string;
  /** See Note 1's Air Disposition Code examples (Appendix A has the full
   * list). Class AN, not purely numeric — same rationale as WO60's
   * `dispositionActionCode`. */
  dispositionCode: string;
  narrativeMessage: string;
  /** Left-justified if under 12 chars. */
  inBondOrEntryNumber?: string;
}

// ── WR5-Record (Output): In-Bond/Bill Disposition Result (pages 38-41) ─────
// Conditional; may repeat as necessary.

export interface InBondBillDispositionResultOutput {
  dispositionActionDate: Date;
  /** HHMM (hour/minute) — see `numericCodeField`. */
  dispositionActionTime: string;
  /** Class AN (3 chars), not purely numeric — Note 3 documents "NP" as a
   * valid code alongside the numeric Ocean CAMIR Appendix D codes, same
   * rationale as WO60's `dispositionActionCode`. */
  dispositionActionCode: string;
  narrativeMessage: string;
  /** Only returned if Disposition Action Code is 22. */
  releaseDate?: Date;
  /** Class N (leading zero significant); only returned if Disposition Action
   * Code is 22 — see Note 2's code table. */
  releaseOriginCode?: string;
  /** Right-justified, no implied decimal places (Note 4). */
  quantity?: number;
  /** Class N (leading zero significant) serial number for the transaction
   * sequence — see `numericCodeField`. */
  sequence?: string;
}

// ── WN0-Record (Output): Amended Bill Quantities (page 43) ─────────────────
// Reported for each bill of lading where an amended quantity is on file; may
// repeat as necessary.

export interface AmendedBillQuantitiesOutput {
  /** Right-justified, no implied decimal places (Note 1). */
  masterBillAmendedQuantity?: number;
  /** Right-justified, no implied decimal places (Note 1). */
  houseBillAmendedQuantity?: number;
}

// ── WN1-Record (Output): Port & Date Detail (pages 44-45) ──────────────────
// Conditional; may repeat as necessary (once per in-bond number associated
// with a bill/entry, latest listed first when more than one applies).

export interface PortDateDetailOutput {
  inBondEntryNumber?: string;
  /** Port of unlading/import as received in the inbound manifest, a carrier
   * amendment, or a QP (FTZ/bonded warehouse withdrawal) message. */
  manifestedPortOfUnladingImport: string;
  /** Rail/Truck only — actual port if different from the manifested one. */
  actualPortOfUnladingImport?: string;
  /** Ocean only (vessel diversion) — actual port if different from the
   * manifested one. */
  actualPortOfUnladingImportOceanVesselDiversion?: string;
  /** All modes — port where the in-bond movement originated. */
  inBondOriginatingPort?: string;
  /** All modes — original in-bond destination port as reported/amended. */
  manifestedInBondDestinationPort?: string;
  /** Manual (non-EDI) diversion to a destination other than manifested. */
  actualInBondDestinationManualDiversion?: string;
  /** Diversion via an EDI in-bond diversion request. */
  actualInBondDestinationEdiDiversion?: string;
  /** Census Schedule K foreign port code. */
  vesselDeparturePort?: string;
  vesselDepartureDate?: Date;
  /** Derived from Container Status Messages — may be absent/inaccurate since
   * those messages aren't mandatory (Note 1). */
  containerLoadPort?: string;
  /** Per the source PDF's own field table, this is class "6AN" — unlike
   * every other MMDDYY date field in this chapter (class N via
   * `dateFieldNumericMMDDYY`). Kept as a raw string rather than parsed as a
   * date to honor the documented class; derived from Container Status
   * Messages (Note 1), so may also be absent. */
  containerLoadDate?: string;
}

// ── WO20-Record (Output): Reference Data (page 48) ──────────────────────────
// Conditional. Per the source PDF, the section's descriptive paragraph says
// "(Output)" but the field-table header directly beneath it says "(Input)" —
// a copy-paste artifact in the source document. Treated as output-only per
// the chapter's own para (and every other CQ record body referencing WO20
// elsewhere in the PDF calls it an output record); this chapter models no
// dedicated request-side use for it.

export interface ReferenceDataOutput {
  /** See Note 1's code table (CR = filer-defined reference number, RSN =
   * rejection reason code, CMT = rejection comments, RRN = rail reference
   * number). */
  referenceIdentifierQualifier: string;
  referenceIdentifier: string;
}

// ── WO30-Record (Output): Country of Origin & Tariff (Line) (page 50) ──────
// Conditional; repeats as often as necessary (mirrors ACE Cargo Release's
// SO30 record, per WO10's own note that WO10-WO72 mimic SO10-SO72).

export interface CountryOriginTariffLineOutput {
  /** Same as the Line Item Number transmitted on the input SE40 record —
   * class N (leading zero significant), see `numericCodeField`. */
  lineItemIdentifier: string;
  /** ISO country code (Appendix G). */
  countryOfOrigin: string;
  tariffNumber: string;
}

// ── WO40-Record (Output): Bill Detail (page 51) ─────────────────────────────
// Conditional; provides in-bond/bill detail data pertaining to the entry.

export interface BillDetailOutput {
  /** "R"=Regular/Simple, "M"=Master, "H"=House, "S"=Sub-House (future use),
   * "T"=Express Carrier Tracking Number (Air only). */
  billTypeIndicator: string;
  /** Space-filled for Air mode of transportation. */
  issuerCode?: string;
  /** Left-justified; special characters stripped per the field's own note. */
  billNumber: string;
  /** Entered quantity, smallest exterior packaging unit (Note 1: for Air,
   * represents boarded quantity if the bill is split, entered+released
   * otherwise). Right-justified, class N. */
  quantity?: number;
  unitOfMeasure?: string;
  /** Per the source PDF's own field table, this is class "8X" — unlike this
   * record's own sibling `quantity` field (class N) and unlike every other
   * "no implied decimal" quantity field in this chapter. Kept as a raw
   * string to honor the documented class. */
  manifestedQuantity?: string;
}

// ── WO42-Record (Output): In-Bond Detail (page 52) ──────────────────────────
// Conditional; provides the in-bond number(s) associated with the bill(s)
// reported on the entry.

export interface InBondDetailOutput {
  inBondNumber: string;
  /** Class N (unlike WS4/WS5/WSC's same-named field, which is class AN) —
   * see `numericCodeField`. Codes per WS4's Note 2 (61/62/63/69/70). */
  inBondEntryType: string;
  /** Schedule D port code — class N (leading zero significant). */
  usPortOfInBondDeparture: string;
  /** Schedule D port code — class N (leading zero significant). */
  usPortOfInBondArrival: string;
  inBondCreateDate: Date;
  inBondArrivalDate?: Date;
  /** Used only when less than the full bill quantity; assumed to be the
   * full bill quantity if not provided. Right-justified, no implied
   * decimals. */
  inBondQuantity?: number;
}

// ── WO50-Record (Output): Bill Match Disposition (page 53) ─────────────────
// Conditional; repeated once for the bill number identified in the
// corresponding WO40 record.

export interface BillMatchDispositionOutput {
  dispositionDate: Date;
  /** HHMM (hour/minute) — see `numericCodeField`. */
  dispositionTime: string;
  /** See Note 1's code table. Class AN, not purely numeric — same rationale
   * as WO60's `dispositionActionCode`. */
  dispositionCode: string;
  narrativeMessage: string;
  /** "Y"/"N". */
  splitIndicator: string;
  carrierCode?: string;
  voyageFlightTripNumber?: string;
  dateOfArrival?: Date;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  districtPortOfArrival?: string;
}

// ── WO70-Record (Output): PGA Status Action Detail (page 58) ───────────────
// Conditional; repeats as often as necessary. Mirrors ACE Cargo Release's
// SO70 record. Field layout independently verified byte-for-byte against
// the source PDF. Not built on the generic PGA Message Set (Chapter 8, PG0x)
// records — this is a distinct query-response shape (status/disposition of a
// PGA's review) with no field overlap with the PG0x input records in
// `@/lib/abi/pgaMessageSet`.

export interface PgaStatusActionDetailOutput {
  /** Appendix V (Government Agency Codes). */
  governmentAgencyCode: string;
  /** Appendix PGA. */
  governmentAgencyProgramCode?: string;
  statusActionDate?: Date;
  /** HHMM (hour/minute) — see `numericCodeField`. */
  statusActionTime?: string;
  pgaEntryLevelStatusCode?: string;
  pgaEntryLevelStatusMessage?: string;
  /** "FUTURE USE" per the field's own description. */
  entryLineLevelStatusCode?: string;
  pgaLineLevelStatusCode?: string;
  statusReasonCode?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  beginningCbpLine?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  beginningTariffPosition?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  beginningPgaLine?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  endingCbpLine?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  endingTariffPosition?: string;
  /** Class N (leading zero significant) — see `numericCodeField`. */
  endingPgaLine?: string;
  documentTypeCode?: string;
  pgaEntryHold?: string;
}

// ── WO71-Record (Output): PGA Reference Identification Detail (pages 62-63) ─
// Conditional; multiple may accompany a single WO70 record. If used, a WO70
// must be provided.
//
// The extended test fixture's own field table (mirrored from an earlier pass
// at this record) mislabels this record's final 18 chars (position 63-80) as
// "Filler" — but the source PDF documents a *second* PGA Reference
// Identification Number Qualifier (61-62) + PGA Reference Identification
// Number (63-80) pair there, not filler. Position math alone can't catch
// this (both readings sum to 80), so this was only found by reading the
// PDF's field table directly. Modeled here per the PDF; the test fixture
// itself was corrected too (see the extended test file) since a real content
// bug is a genuine correctness reason to deviate from "trust the fixture."

export interface PgaReferenceIdentificationDetailOutput {
  /** See Note 1 (PGA Status Notification Codes doc, SO71 Output Related
   * Codes). */
  pgaReferenceIdentificationNumberQualifier?: string;
  /** For FDA: the prior notice confirmation number (Note 2). */
  pgaReferenceIdentificationNumber?: string;
  pgaReferenceIdentificationNumberReceiptDate?: Date;
  /** HHMMSS (hour/minute/second) — see `numericCodeField`. */
  pgaReferenceIdentificationNumberReceiptTime?: string;
  /** See Note 4 (PGA Status Notification Codes doc). Up to 10 may be
   * returned. */
  pgaLineSubReasonCode1?: string;
  pgaLineSubReasonCode2?: string;
  pgaLineSubReasonCode3?: string;
  pgaLineSubReasonCode4?: string;
  pgaLineSubReasonCode5?: string;
  pgaLineSubReasonCode6?: string;
  pgaLineSubReasonCode7?: string;
  pgaLineSubReasonCode8?: string;
  pgaLineSubReasonCode9?: string;
  pgaLineSubReasonCode10?: string;
  /** Second occurrence of the qualifier/number pair above (position 61-80)
   * — see the module comment. */
  pgaReferenceIdentificationNumberQualifier2?: string;
  pgaReferenceIdentificationNumber2?: string;
}

// ── WO72-Record (Output): PGA Narrative Comments to Trade (page 64) ────────
// Conditional; repeats as often as necessary. If used, a WO70 (and
// optionally a WO71) must be provided.

export interface PgaNarrativeCommentsOutput {
  commentsToTradeFromPga: string;
}

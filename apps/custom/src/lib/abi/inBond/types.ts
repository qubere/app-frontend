// Types for the CATAIR In-Bond chapter (Chapter 9) — the 13 in-scope records
// forming the QP (in-bond initiation) / WP (arrival, export, or transfer) /
// QT & WT (transaction responses) / NS (status notification) round trip.
// Source: docs/plans/catair-source-docs/06b-in-bond-v51-2026-04.pdf
// (Amendment 51, April 2026)
//
// Deferred (not modeled this slice): the QP-Long BOL detail records (QP40,
// QP50-52, QP55-57, QP60-62, QP65, QP70-72, QP75-76 — required only for
// non-automated-carrier/FTZ withdrawals), NS05 (the non-QP Customs Broker
// ABI filer equivalent of NS10), NS60 (container-level status notification),
// the batch/block transmission-structure error echo records (EA, EB, EY,
// EZ), WP10 Action Code 'Z' (Diversion request), and WP10 Action Code 'A'
// (Transfer of in-bond liability — WP20's City Name/State Code pair is only
// mandatory for this action code, which isn't modeled here).

/**
 * QP10-Record (Input): In-Bond Header. Mandatory; opens every QP transaction
 * (one QP10 per in-bond being added/deleted).
 */
export interface InBondHeaderInput {
  /** A=Add new in-bond, B=Delete from a specific bill, D=Delete from all bills. */
  actionCode: "A" | "B" | "D";
  /** 61=IT, 62=T&E, 63=IE. Class N (leading zero significant per the
   * `numericCodeField` convention for CATAIR enum/identifier codes, even
   * though none of the three valid values happen to start with a zero). */
  inBondEntryType?: string;
  /** Conventional 9-position in-bond number, left justified in this 12-char field. */
  inBondNumber: string;
  /** 4-digit SCAC, ICAO 3-letter, or IATA 2-char airline code. */
  inBondCarrierCode?: string;
  /** Schedule D port code (Class N, leading zero significant): IT=termination
   * port, T&E=port of exportation, IE=port of arrival. */
  usPortOfDest?: string;
  /** Schedule K code for T&E/IE; space or zero fill for IT. Class AN (not N)
   * — contrast with NS10's equivalent `foreignDestination`, which is 5N. */
  portOfForeignDest?: string;
  /** Whole dollars, no decimals (PDF p. INB-20 explicit: "No decimals") —
   * plain number, not `Decimal`. */
  value: number;
  /** IRS number or CBP-assigned bonded carrier ID. */
  bondedCarrierID?: string;
  /** Y=FTZ or bonded warehouse withdrawal; otherwise blank. */
  ftzWarehouseInd?: "Y";
  /** Y/N BTA/FDA indicator; required for T&E (in-bond entry type 62). */
  btaFdaIndicator?: "Y" | "N";
}

/**
 * QP20-Record (Input): Conveyance Information. Conditional; carries the
 * importing conveyance and estimated arrival date for a QP10 in-bond.
 */
export interface ConveyanceInfoInput {
  /** SCAC, ICAO, or IATA identifier of the importing carrier. */
  importingCarrierCode: string;
  /** 30=Truck, 40=Air, 70=Pipeline. Vessel codes (10/11) are valid for
   * WP20's export MOT but not here — see `InBondEventDetailInput.exportMOT`. */
  importMOT: string;
  /** ISO country code of the importing carrier's flag. */
  countryCode?: string;
  /** Conveyance name; not required for Air or FTZ. */
  importingConveyance?: string;
  /** Format NNN, NNNA, NNNN, or NNNNA. */
  voyageFlightTripNum?: string;
  /** Census Schedule D code (DDPP) of the port of unlading. */
  portOfImportArrival: string;
  /** MMDDYY format (PDF p. INB-24 explicit) — see `dateFieldNumericMMDDYY`.
   * NOT the same digit order as WP20's `date` or NS30's `actionDate`, both
   * YYMMDD; not required for FTZ. */
  estDateOfArrival?: Date;
  /** FIRMS code of the FTZ/warehouse when the FTZ flag is set on QP10. */
  ftzFirmsCode?: string;
}

/**
 * QP30-Record (Input): Bill of Lading Header. Conditional; one per bill of
 * lading covering the in-bond shipment.
 */
export interface BillOfLadingHeaderInput {
  /** A=Add bill data, D=Delete in-bond from bill. */
  actionCode: "A" | "D";
  /** Position of this QP30 record within the transmission; returned in
   * output for error association. Class AN (not N) despite looking numeric
   * — kept as a plain string, not run through `numericCodeField`. */
  sequenceNumber?: string;
  /** 4-digit SCAC or Air Waybill Prefix; FIRMS code for FTZ. */
  issuerCodeMasterBOL: string;
  /** Simple/regular/master bill number, left justified. */
  masterBOLNumber: string;
  /** Reserved for future use; space fill (PDF names this field explicitly —
   * not unlabeled filler). */
  issuerCodeHouseBill?: string;
  /** House bill as shown on the manifest; left justify; Air only. Reserved
   * for future use per the PDF, but explicitly named/typed, not filler. */
  houseBillNumber?: string;
  /** Reserved for future use; space fill. */
  issuerCodeSubHouse?: string;
  /** Reserved for future use; space fill. */
  subHouseBillNumber?: string;
  /** Previous in-bond number for subsequent moves; blank for FTZ. */
  prevInBondNumber?: string;
  /** Partial BOL quantity; space fill for Air; full BOL quantity assumed if
   * omitted. No decimal convention stated in the current PDF revision
   * (Amendment 51) — plain `number`, not `Decimal`. */
  inBondQuantity?: number;
}

/** QP32-Record (Input): Secondary Notify Parties. Optional; up to 4 SNPs. */
export interface SecondaryNotifyPartiesInput {
  /** SCAC or 9-char ABI routing code (format NNNNXXXNN). */
  snpCode1: string;
  snpCode2?: string;
  snpCode3?: string;
  snpCode4?: string;
}

/**
 * QP33-Record (Input): Reference Identifier. Conditional; e.g. BM=Bill of
 * Lading, FEN=Mexican Pedimento, BTA.
 */
export interface ReferenceIdentifierInput {
  /** Up to 3-char qualifier, e.g. "BM", "FEN", "BTA". */
  qualifier: string;
  /** Reference ID for the qualifier; a Pedimento reference is a 15-char
   * "yyppbbbbddddddd" string. */
  referenceIdentifier: string;
}

/**
 * WP10-Record (Input): In-Bond Event Header. Mandatory; opens every WP
 * transaction (arrival, export, or transfer report).
 */
export interface InBondEventHeaderInput {
  /** 1=Arrive entire in-bond, 2=Arrive specific BOL, 3=Arrive specific
   * container, 5=Export entire in-bond, 6=Export specific BOL, 7=Export
   * specific container, A=Transfer (deferred), Z=Diversion (deferred).
   * Class AN (not N) since it mixes digits and letters. */
  actionCode: "1" | "2" | "3" | "5" | "6" | "7";
  /** 9-digit or "V"-prefixed paperless in-bond number; mandatory for action
   * codes 1, 3, 5, 7 (and the deferred A, Z). */
  inBondNumber?: string;
  /** SCAC of the BOL issuer or Air Waybill Prefix; mandatory for action
   * codes 2, 3, 6, 7. */
  issuerCodeMasterBOL?: string;
  /** Master bill number; mandatory for action codes 2, 3, 6, 7 (8-digit AWB
   * serial number for Air). */
  masterBOLNumber?: string;
  /** Reserved for future use; space fill. */
  issuerCodeHouseBOL?: string;
  /** House bill as shown on the manifest; left justify; Air only. */
  houseBOLNumber?: string;
  /** FIRMS code at the destination port; mandatory for action codes 1, 2, 3;
   * not required for Air. */
  firmsLocation?: string;
  /** Container number as marked on the container; mandatory for action
   * codes 3 and 7; not required for Air. */
  containerNumber?: string;
}

/**
 * WP20-Record (Input): In-Bond Event Detail. Mandatory; always accompanies
 * a WP10 to report the actual arrival/export/transfer date, time, and
 * location.
 */
export interface InBondEventDetailInput {
  /** YYMMDD format (PDF p. INB-57 explicit) — see `dateFieldYYMMDD`. NOT
   * the same digit order as QP20's `estDateOfArrival` (MMDDYY); same digit
   * order as NS30's `actionDate`. */
  date: Date;
  /** HHMMSS, 24-hour clock. Leading-zero significant (e.g. midnight is
   * "000000") — kept as a zero-padded string via `numericCodeField`, not a
   * lossy `parseInt`. Unlike NS30's 4-char `actionTime` (HHMM only). */
  time: string;
  /** Schedule D port code; mandatory for action codes 1, 2, 3 (and the
   * deferred Z). */
  portOfArrival?: string;
  /** SCAC of the carrier assuming liability; mandatory for the deferred
   * action code A. */
  inBondCarrierCode?: string;
  /** IRS/SSN/CBP-assigned bonded carrier ID; mandatory for the deferred
   * action codes A or Z. */
  bondedCarrierID?: string;
  /** City where the liability transfer occurs; mandatory for the deferred
   * action code A. */
  cityName?: string;
  /** State code corresponding to `cityName` when provided. */
  stateCode?: string;
  /** MOT of the exporting conveyance; only codes 10/11 (Vessel) are valid;
   * optional for action codes 5, 6, 7. */
  exportMOT?: "10" | "11";
  /** Name of the exporting conveyance; optional for action codes 5, 6, 7. */
  exportConveyance?: string;
}

/**
 * QT95-Record / WT95-Record (Output): In-Bond Transaction Response Message.
 * Mandatory; the two records share an identical 80-column layout (same
 * positions/lengths/classes) — only their transaction context differs (QT
 * for a QP10/20/30/32/33 transaction, WT for a WP10/20 transaction) — so a
 * single shared type/spec covers both. See `recordSpecs.ts` for the shared
 * field builder and `parse.ts` for the separately-named decode functions.
 */
export interface InBondResponseMessageOutput {
  /** 01=Data Rejection, 02=Data Acceptance, 03=Acceptance with Warning.
   * Class N, leading zero significant. */
  narrativeMsgType: string;
  /** Code identifying the narrative message. */
  narrativeMsgId: string;
  /** Acceptance or rejection narrative text. */
  narrativeMessage: string;
}

/**
 * NS10-Record (Output): Status Notification Header In-Bond Information.
 * Conditional; the QP-filer-specific equivalent of the deferred NS05
 * (returned to non-QP Customs Broker ABI filers).
 */
export interface StatusNotificationHeaderOutput {
  /** 61=IT, 62=T&E, 63=IE. */
  inBondEntryType: string;
  /** Conventional 9-numeric in-bond number, left justified. */
  inBondNumber: string;
  /** Schedule D port code. */
  usPortOfDest: string;
  /** Schedule K foreign port code — Class N (all-numeric), unlike QP10's
   * `portOfForeignDest` equivalent (Class AN). Space fill for IT (61) entries. */
  foreignDestination?: string;
}

/**
 * NS30-Record (Output): Status Notification Detail. Mandatory; one per
 * disposition/posting action on the in-bond.
 */
export interface StatusNotificationDetailOutput {
  /** Posting action code; see ACE Ocean Appendix D or Air Appendix A. */
  dispositionCode: string;
  /** SCAC of the BOL issuer; FIRMS code if FTZ/warehouse. */
  issuerMasterBill: string;
  /** Simple/regular/master bill number, left justified. */
  masterBillNumber: string;
  /** Reserved for future use; space fill (PDF names this field explicitly —
   * not unlabeled filler, per the field's own table entry). */
  issuerHouseBill?: string;
  /** Reserved for future use; space fill. */
  houseBillNumber?: string;
  /** Reserved for future use; space fill. */
  issuerSubHouse?: string;
  /** Reserved for future use; space fill. */
  subHouseBillNumber?: string;
  /** Total number of pieces affected by the disposition action. */
  quantity: number;
  /** "N" when reporting a negative number with disposition code 1A/1B/1C;
   * otherwise space. */
  negativeIndicator?: "N";
  /** YYMMDD format (PDF pp. INB-64/65 explicit) — see `dateFieldYYMMDD`.
   * Same digit order as WP20's `date`; NOT the same as QP20's `estDateOfArrival`. */
  actionDate: Date;
  /** HHMM, 24-hour clock, Eastern time — 4 chars only (NOT 6-char HHMMSS
   * like WP20's `time`). Leading-zero significant — kept as a zero-padded
   * string via `numericCodeField`. */
  actionTime: string;
  /** SCAC of the in-bond carrier; FIRMS code if FTZ/warehouse. */
  inBondCarrierCode: string;
}

/**
 * NS40-Record (Output): Status Notification Detail Continuation.
 * Conditional; follows an NS30 when entry/port/container detail applies.
 */
export interface StatusNotificationContinuationOutput {
  /** Entry category code per ACE Ocean Appendix B. */
  entryType?: string;
  /** USCBP entry number, form number, or regulatory provision. */
  entryNumber?: string;
  /** Schedule D port code where the action occurred. */
  distPortTxn: string;
  /** FIRMS code representing the location of the goods. */
  firmsCode?: string;
  /** Container number as marked on the container; container-level
   * notifications only. */
  containerNum?: string;
}

/**
 * NS50-Record (Output): Status Notification Remarks. Conditional; free-form
 * CBP remarks on the BOL posting or conveyance status.
 */
export interface StatusNotificationRemarksOutput {
  /** Free-form USCBP remarks on BOL posting or conveyance status. */
  remarks: string;
}

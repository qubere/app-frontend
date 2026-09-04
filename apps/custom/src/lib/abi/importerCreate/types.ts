// Types for the ACE CATAIR Importer/Consignee Create/Update (Application Identifier TP)
// input and output records. Source:
// docs/plans/catair-source-docs/19-importer-consignee-create-update-5106-v12.pdf
// Version 12 (revision 15), March 2019.
//
// Mandatory input sequence: T1, T2, TD, TE, TF, TL
// Conditional/optional extras: TA, T3, TB, TC, TG, TH, TI+TJ, TK, TM, TN

// ── T1: Importer Account Header ───────────────────────────────────────────────
export interface T1Input {
  /** "A" = Add, "U" = Update existing, "N" = Apply for CBP-assigned number. */
  actionCode: "A" | "U" | "N";
  /** Importer #: IRS (NN-NNNNNNNXX), SSN (NNN-NN-NNNN), or CBP (NNNNNN-NNNNN).
   * Space-fill if actionCode is "N". Max 12. */
  importerNumber: string;
  /** Abbreviated importer name. Max 32. Full legal name >32 chars → add T3. */
  abbreviatedImporterName: string;
  /** First line of mailing address. Max 32. */
  mailingAddressLine1: string;
  /** Importer type. Required for U.S. importers. */
  importerType?: "C" | "P" | "I" | "S" | "F" | "G" | "L" | "K";
}

// ── TA: Name Qualifier / Alternate Name ────────────────────────────────────────
export interface TAInput {
  /** "DIV" | "DBA" | "AKA" */
  nameQualifier: string;
  /** Alternate importer name. Max 32. */
  alternateImporterName: string;
}

// ── T2: Mailing Address ────────────────────────────────────────────────────────
export interface T2Input {
  /** Second line of mailing address (optional). Max 32. Space fill if foreign. */
  mailingAddressLine2?: string;
  /** City. Max 21. */
  mailingCity: string;
  /** State code (2A). "FN" for non-US/CA/MX. */
  mailingStateCode: string;
  /** Postal code. Max 9. Required for US/CA addresses. */
  mailingPostalCode?: string;
  /** ISO 2-char country code. */
  mailingCountryCode: string;
}

// ── T3: Full Legal Importer Name ───────────────────────────────────────────────
export interface T3Input {
  /** Full legal name as registered. Max 30 chars in record; overflow to TN (max 100X total). */
  fullLegalImporterName: string;
}

// ── TB: Physical Address Lines ─────────────────────────────────────────────────
export interface TBInput {
  /** Physical address line 1. Max 32. Mandatory if mailing type is BSC/PO/Other. */
  physicalAddressLine1: string;
  /** Physical address line 2 (optional). Max 32. */
  physicalAddressLine2?: string;
}

// ── TC: Physical Address City/State/Postal/Country ─────────────────────────────
export interface TCInput {
  /** City of physical address. Max 21. */
  physicalCity: string;
  /** State code (2A). "FN" for non-US/CA/MX. */
  physicalStateCode: string;
  /** Postal code. Max 9. Required for US/CA. */
  physicalPostalCode?: string;
  /** ISO 2-char country code. */
  physicalCountryCode: string;
}

// ── TD: Identification Numbers & Phone ─────────────────────────────────────────
export interface TDInput {
  /** 1=1-4/yr, 2=5-24/yr, 3=25+/yr, 4=infrequent, 5=no intent. */
  entriesPerYear?: "1" | "2" | "3" | "4" | "5";
  /** "X" = Treat importer # as Importer of Record. */
  utilImporterOfRecord?: "X";
  /** "X" = Treat as Consignee. */
  utilConsignee?: "X";
  /** "X" = Drawback Claimant. */
  utilDrawback?: "X";
  /** "X" = Refunds/Bills. */
  utilRefunds?: "X";
  /** "X" = Other. */
  utilOther?: "X";
  /** Required if utilOther = "X". Max 15. */
  utilOtherDescription?: string;
  /** Program Code 1 (CTPAT/ISA/AEO/PIP). Max 5. */
  programCode1?: string;
  /** Program Code 2. Max 5. */
  programCode2?: string;
  /** Program Code 3. Max 5. */
  programCode3?: string;
  /** Program Code 4. Max 5. */
  programCode4?: string;
  /** Phone number. Max 15. Mandatory. */
  phone: string;
  /** Phone extension. Max 6. */
  phoneExtension?: string;
  /** "X" = has SSN, wishes CBP-assigned number. */
  cbpAssignedNumberRequestReasonIndicator?: "X";
  /** "X" = no SSN. */
  ssnIndicator?: "X";
  /** "X" = no IRS number. */
  irsIndicator?: "X";
  /** "X" = not applied for IRS/SSN. */
  irsOrSsnIndicator?: "X";
  /** "X" = not a U.S. resident. */
  usResidentIndicator?: "X";
}

// ── TE: Address Type & Business Description ────────────────────────────────────
export interface TEInput {
  /** Mailing address type code: 1-8. */
  mailingAddressType: string;
  /** Required if mailingAddressType = "8" (Other). Max 15. */
  mailingAddressExplanation?: string;
  /** Physical address type: 1-5 or 8. Required if TB is provided. */
  physicalAddressType?: string;
  /** Required if physicalAddressType = "8". Max 15. */
  physicalAddressExplanation?: string;
  /** Business description. Max 40. */
  businessDescription?: string;
}

// ── TF: Email, Website, Fax ───────────────────────────────────────────────────
export interface TFInput {
  /** Email address. Max 30 in record; overflow to TN (max 100X). */
  email: string;
  /** Website URL. Max 30 in record; overflow to TN. */
  website?: string;
  /** Fax number. Max 15AN. */
  fax?: string;
}

// ── TG: NAICS, DUNS, Filer Code, Year, Incorporation ──────────────────────────
export interface TGInput {
  /** 6-digit NAICS code. */
  naicsCode?: string;
  /** 9-digit DUNS number. */
  dunsNumber?: string;
  /** 3-char filer code (CBP-assigned). */
  filerCode?: string;
  /** Year established (4 digits). */
  yearEstablished?: string;
  /** State of incorporation (2A). */
  incorporationState?: string;
  /** Country of incorporation (2A ISO). */
  incorporationCountry?: string;
  /** Reference number (cert/articles of incorporation). Max 30. */
  referenceNumber?: string;
  /** SCAC (future use). Max 4. */
  scacIdentifier?: string;
  /** FIRMS code (future case). Max 4AN. */
  firmsCode?: string;
}

// ── TH: Primary Bank Information ──────────────────────────────────────────────
export interface THInput {
  /** Primary bank name. Max 30 in record; overflow TN (max 100). */
  primaryBankName?: string;
  /** Routing number. Max 11AN. */
  routingNumber?: string;
  /** Bank city. Max 30 in record; overflow TN. */
  bankCity?: string;
  /** Bank state (2A). */
  bankState?: string;
  /** Bank country ISO (2A). */
  bankCountry?: string;
}

// ── TI: Company Officer – Part 1 (Name, Title, SSN) ──────────────────────────
export interface TIOfficer {
  /** Sequential 2-digit line item, starting at "01". */
  lineItemNumber: string;
  /** "Last,First,Middle" format. Max 30 in record; overflow TN (max 100). */
  name: string;
  /** Officer title. Max 22. */
  title: string;
  /** SSN (required if CBP-assigned # request reason indicator set). Max 9N. */
  ssn?: string;
}

// ── TJ: Company Officer – Part 2 (Passport, Phone, Email) ────────────────────
export interface TJOfficer {
  /** Matches TI lineItemNumber. */
  lineItemNumber: string;
  /** Passport number. Max 13AN. */
  passportNumber?: string;
  /** Passport expiration date (MMDDYYYY). */
  passportExpirationDate?: Date;
  /** Country of passport issuance (2A ISO). Required if passport # provided. */
  passportCountryOfIssuance?: string;
  /** 1=Regular, 2=Official, 3=Diplomatic, 4=Passport Card. Required if passport # provided. */
  passportType?: "1" | "2" | "3" | "4";
  /** Officer phone. Max 15AN. Mandatory. */
  phone: string;
  /** Officer phone extension. Max 6. */
  phoneExtension?: string;
  /** Officer email. Max 30. Mandatory. */
  email: string;
}

// ── TK: Related Business ──────────────────────────────────────────────────────
export interface TKRelatedBusiness {
  /** Sequential 2-digit line item starting at "01". */
  lineItemNumber: string;
  /** "1" = Current, "2" = Previous. */
  relatedBusiness: "1" | "2";
  /** Full legal name of related entity. Max 30; overflow TN. */
  nameOfEntity: string;
  /** TIN/EIN/SSN/CBP number of entity. Max 12. */
  tinEinSsnCbp: string;
}

// ── TL: Individual Certification (Electronic Signature) ──────────────────────
export interface TLInput {
  /** Must be "X" (Filer's Electronic Signature). */
  electronicSignature: "X";
  /** "Last,First,Middle" format. Max 30; overflow TN. */
  certifyingIndividualFullName: string;
  /** Title of certifying individual. Max 22. */
  title: string;
}

// ── TM: Broker Certification ──────────────────────────────────────────────────
export interface TMInput {
  /** Broker name. Max 30; overflow TN. */
  brokersName?: string;
  /** Certifying individual phone. Max 15AN. */
  certifyingIndividualPhone?: string;
  /** Broker phone. Max 15AN. */
  brokersPhone?: string;
}

// ── TN: Overflow Record ───────────────────────────────────────────────────────
export interface TNInput {
  /** Qualifier code (IN1, CE1, CW1, BN1, BC1, CN1, CE2, NE1, IN2, BN2). Max 3AN. */
  additionalInfoQualifierCode: string;
  /** Overflow text. Max 70. */
  additionalInformation?: string;
}

// ── Output: E0 Condition Reference ───────────────────────────────────────────
export interface E0Output {
  referenceDataTypeCode: string;
  occurrencePosition: number;
  referenceDataText: string;
}

// ── Output: E1 Condition/Disposition Response ─────────────────────────────────
export interface E1Output {
  /** " " = not final, "A" = accepted, "R" = rejected. */
  dispositionTypeCode: " " | "A" | "R";
  /** "F" = fatal, "I" = informational, " " = no condition. */
  severityCode: "F" | "I" | " ";
  /** Condition/error code. Max 3AN. */
  conditionCode: string;
  /** Reason code (CBP internal). Max 3AN. */
  reasonCode?: string;
  /** Narrative/error text. Max 40AN. */
  narrativeText: string;
}

// ── Top-level transaction input (for buildTransaction) ─────────────────────────
export interface ImporterCreateInput {
  t1: T1Input;
  ta?: TAInput;
  t2: T2Input;
  t3?: T3Input;
  tb?: TBInput;
  tc?: TCInput;
  td: TDInput;
  te: TEInput;
  tf: TFInput;
  tg?: TGInput;
  th?: THInput;
  officers?: Array<{ ti: TIOfficer; tj: TJOfficer }>;
  relatedBusinesses?: TKRelatedBusiness[];
  tl: TLInput;
  tm?: TMInput;
}

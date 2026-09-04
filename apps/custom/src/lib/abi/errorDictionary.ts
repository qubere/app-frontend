/**
 * ACE Error Dictionary Reference Data Module
 * Source: docs/plans/catair-source-docs/10-error-dictionary-2026-07.xlsx (sheet "ACE Error Dictionary")
 * Total rows in sheet: 1055 (1 header row + 1054 data rows)
 * Total extracted data rows: 1054
 */

export interface ErrorDictionaryEntry {
  conditionCode: string;
  narrativeText: string;
  explanation: string;
  dateUpdated?: string | null;
}

/**
 * All 1054 raw data rows extracted programmatically from the "ACE Error Dictionary" spreadsheet.
 * Row count matches sheet data row count exactly.
 */
export const ABI_ERROR_DICTIONARY_ROWS: readonly ErrorDictionaryEntry[] = [
  {
    "conditionCode": "861",
    "narrativeText": "AUTO LICENSE INSUFFICIENT BALANCE",
    "explanation": "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "866",
    "narrativeText": "AUTO LICENSE PRESENT - DUTY NOT ALLOWED",
    "explanation": "An Automobile License for Importer's Additional Declaration Record Type '11' is submitted on a line, yet duty is present on the corresponding auto part ch.99 HTS number.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "869",
    "narrativeText": "COP PRIM SMELT CNTRY CD MISSING",
    "explanation": "A Primary Country of Smelt Code on the submitted Copper Smelt and Cast Country Detail (Importer's Additional Declaration type of '12') is required.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "870",
    "narrativeText": "COP PRIM SMELT CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Primary Country of Smelt Code on the submitted Copper Smelt and Cast Country Detail (Importer's Additional Declaration type of '12') is not a known ISO country code; or is not designated as \"OTH\".",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "871",
    "narrativeText": "COP SEC SMELT CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Secondary Country of Smelt Code on the submitted Copper Smelt and Cast Country Detail (Importer's Additional Declaration type of '12') is not a known ISO country code; or is not designated as \"OTH\".",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "872",
    "narrativeText": "COP RECENT CAST CNTRY CD MISSING",
    "explanation": "A Country of Most Recent Cast Code on the submitted Copper Smelt and Cast Country Detail (Importer's Additional Declaration type of '12') is required.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "873",
    "narrativeText": "COP RECENT CAST CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Country of Most Recent Cast Code on the submitted Copper Smelt and Cast Country Detail (Importer's Additional Declaration type of '12') is not a known ISO country code; or is not designated as \"OTH\".",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "874",
    "narrativeText": "QTY MUST BE LESS THAN CMDTY HTS",
    "explanation": "The submitted ch.99 HTS number has a requirement that its associated quantity (50-record, pos. 36-47, or 51-62, or 66-77) must be less than the quantity (e.g., kilogram weight) of the submitted Commodity (ch.1-97) HTS number.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "439",
    "narrativeText": "QUANTITY/UOM(S) MISSING",
    "explanation": "If there are no Quantity/UOM pairs reported on the 50-record (position 36-80) for an HTS this error will result. Note, this error does not apply to ch.98 HTS numbers and most ch.99 HTS numbers, however there are some exceptions where ch.99 HTS numbers require a Quantity and Unit of Measure.",
    "dateUpdated": "2026-07-18"
  },
  {
    "conditionCode": "875",
    "narrativeText": "IMPORTER INACTIVE FOR ENTRY PURPOSES",
    "explanation": "The importer of record number is ineligible to transmit an Entry Summary due to having exceeded the allowable time period since the last successfully submitted entry summary.",
    "dateUpdated": "2026-06-30"
  },
  {
    "conditionCode": "876",
    "narrativeText": "DUTY HTS REQUIRES NON-DUTY HTS",
    "explanation": "When an Entry Summary line contains a common Auto Part HTS number and a Medium and Heavy-Duty Vehicles (MHDV) HTS number, only one or the other may be a dutiable CH99 HTS (i.e., if the Auto Part HTS number is dutiable, then the MHDV CH99 HTS number must be non-dutiable and vice-versa). Note, however, it is permissible for the Auto Part HTS number and the MHDV HTS number to both be non-dutiable CH99 HTS numbers.",
    "dateUpdated": "2026-06-25"
  },
  {
    "conditionCode": "60D",
    "narrativeText": "LIC/CERT/PERM FOR HTS MISSING",
    "explanation": "A License Number/ Certificate Number / Permit Number (52-Record) is required for one or more of the HTS numbers cited on the ES line.",
    "dateUpdated": "2026-05-19"
  },
  {
    "conditionCode": "613",
    "narrativeText": "HTS RELATIONSHIP MISMATCH",
    "explanation": "A submitted HTS on a line does not conform with the parameters defined for the HTS number. For example, this error may be returned if a submitted HTS requires pairing with another HTS but that HTS is not provided; or if the submitted country of origin is not allowable for an HTS number due to its Column 1 or Column 2 classification.",
    "dateUpdated": "2026-05-19"
  },
  {
    "conditionCode": "865",
    "narrativeText": "HTS NOT ALLOWED FOR IMPORTER",
    "explanation": "One or more tariff numbers transmitted in the AE is not eligible for the submitted Importer of Record.",
    "dateUpdated": "2026-05-08"
  },
  {
    "conditionCode": "864",
    "narrativeText": "PSC NOT ALLOWED \u2013 REFUND REQUESTED",
    "explanation": "PSC is not allowed due to a CAPE Refund in process.",
    "dateUpdated": "2026-04-20"
  },
  {
    "conditionCode": "857",
    "narrativeText": "AUTO LICENSE UNKNOWN",
    "explanation": "The submitted Automobile License for Importer's Additional Declaration Record Type '11' meets one of the following conditions:\nIs not a valid license number. \n-or-\nIs not valid for use by the submitted Importer of Record.",
    "dateUpdated": "2025-11-01"
  },
  {
    "conditionCode": "852",
    "narrativeText": "HTS OUT OF SEQUENCE",
    "explanation": "This error is returned if the order of HTS numbers on a line does not conform to the sequece specified below:\n\na) If more than one Ch 98 is submitted, summary will be accepted without validating the HTS sequence (e.g., watches)\n-or-\nb) If there is one Ch. 98 submitted, HTS numbers must be in the following sequence: \n-Chapter 98\n-Chapter 99 \n-Chapter 1 to 97 Commodity HTS\n-or-\nc) If there is no Ch. 98 submitted, HTS numbers must be in the following sequence: \n-Chapter 99 \n-Chapter 1 to 97 Commodity HTS",
    "dateUpdated": "2025-05-29"
  },
  {
    "conditionCode": "856",
    "narrativeText": "UNKNOWN ALUM SMELT/CAST CTRY NOT ALLOWED",
    "explanation": "If a value of unknown (\"UN\"), is reported for primary aluminum as the Primary or Secondary Country of Smelt or as the Country of Cast on the Importer's Additional Declaration 54-Record Type '07'; this error will be returned as unknown (\"UN\") may only be reported for derivative aluminum.",
    "dateUpdated": "2025-05-29"
  },
  {
    "conditionCode": "60B",
    "narrativeText": "HTS REQUIRED FOR UNKNOWN SMELT/CAST CTRY",
    "explanation": "When a value of unknown (\"UN\"), is reported for derivative aluminum as the Primary or Secondary Country of Smelt or as the Country of Cast on the Importer's Additional Declaration 54-Record Type '07'; HTS number 99038568 is required.",
    "dateUpdated": "2025-05-29"
  },
  {
    "conditionCode": "646",
    "narrativeText": "Artcl Value Exceeds Infrml Limit for HTS",
    "explanation": "If an HTS number on the line requires a Formal Entry and the total Merchandise Value for the line is GT $2,500; this error will result.\n- or -\nIf the 10-Record Shipment Usage Type Code is a 'X' or a blank, and none of the HTS numbers on the line requires a Formal Entry and the line contains 9801.00.10 (various US goods returned) and the total Merchandise Value for the line is GT $10,000; this error will result.  \n- or -\nIf the 10-Record Shipment Usage Type Code is a 'X' or a blank, and none of the HTS numbers on the line requires a Formal Entry and the line is neither US goods returned, nor 9801.00.50 or 9801.00.60, and the summary is not consolidated and the total Merchandise Value for the line is GT $2,500; this error will result.",
    "dateUpdated": "2025-04-28"
  },
  {
    "conditionCode": "648",
    "narrativeText": "Total Value Exceeds Infrml Limit",
    "explanation": "If the ES has two or more lines, and the 10-Record Shipment Usage Type Code is a 'X', and  every line has an HTS number requires a Formal Entry and the total Merchandise Value for the entire summary is GT $2,500; this error will result.\n- or - \nIf the ES has two or more lines, and the 10-Record Shipment Usage Type Code is a 'X' (but not the case above) or a blank, and at least one line is US goods returned, and the total Merchandise Value for the entire summary is GT $10,000.00, this error will result.  \n- or - \nIf the ES has two or more lines, and the 10-Record Shipment Usage Type Code is a 'X' (but not the case above) or a blank, and none of the lines are neither US goods returned, nor 9801.00.50 or 9801.00.60, and the summary is not consolidated, and the total Merchandise Value for the entire summary is GT $2,500; this error will result.",
    "dateUpdated": "2025-04-28"
  },
  {
    "conditionCode": "664",
    "narrativeText": "Charges Amount Required",
    "explanation": "A 40-Record Charges Amount can be $0 when the entry type is informal (11, 12), or the MOT is Passenger Hand Carried (60), or country or origin is a US Insular Possession, or the filing is a consolidated Summary, or the line is a Set Component (V), or the line contains 9802.00.4040,  9802.00.5010,  9802.00.5060, 9802.00.8040,  9802.00.8060,  9813.00.0520, or 9813.00.0540 AND any HTS number on the line requires Formal Entry. Otherwise:\n\nIf the 40-Record Charges Amount = $0, and the line is classified as a repaired article (9802.00.40 or 9802.00.50) and the repair portion of the Merchandise Value is GT $1,250, this error will result.\n- or - \nIf the 40-Record Charges Amount = $0, and the line is classified as a returned article (9801.00.1000 thru 9801.00.1099) and the Merchandise Value is GT $10,000, this error will result.\n- or - \nIf the 40-Record Charges Amount = $0, and any HTS number on the line requires Formal Entry, and the Merchandise Value is GT $2,500, this error will result.\n- or - \nIf the 40-Record Charges Amount = $0, and the Merchandise Value is GT $1,250, this error will result.",
    "dateUpdated": "2025-04-28"
  },
  {
    "conditionCode": "127",
    "narrativeText": "Import Date Missing",
    "explanation": "If the date of importation on the 11 record, pos 48-53 is not present and it is required, this error will result.  Date of importation is required for entry type codes '21' (warehouse) and '23' (TIB) and when the filer makes a NAFTA Reconciliation claim.",
    "dateUpdated": "2025-03-12"
  },
  {
    "conditionCode": "60A",
    "narrativeText": "ADDTL HTS REQ/PAIR NOT ALWD FOR ENT TYP",
    "explanation": "For TIB Entry Type (\"23\") when both 9813.00.0520 and 5503.20.0025 are present on summary line, 9903.55.01 must be provided.\n\nor\n\nOne or more HTS pairing transmitted in the AE is not eligible for the submitted Entry Type.",
    "dateUpdated": "2024-11-22"
  },
  {
    "conditionCode": "844",
    "narrativeText": "STEEL MELT & POUR CNTRY APP CD NOT ALWD",
    "explanation": "The Country of Melt and Pour Applicability Code on the submitted Steel Melt and Pour Country Detail (Importer's Additional Declaration type of '08') is not allowed for submitted HTS Number or Country of Origin. An HTS Number associated with Primary Steel requires a Country of Melt and Pour Country Code.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "843",
    "narrativeText": "STEEL MELT & POUR CNTRY APPL CD CONFLICT",
    "explanation": "Both Country of Melt and Pour Country Code and Applicability Code are found present on the submitted Steel Melt and Pour Country Detail (Importer's Additional Declaration type of '08'); however only Country of Melt and Pour Country Code is required for Primary Steel, and either the Country of Melt and Pour Country Code or Applicability Code are required for Derivative Steel.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "842",
    "narrativeText": "STEEL MELT & POUR CNTRY APPL CD UNKNOWN",
    "explanation": "The Country of Melt and Pour Applicability Code on the submitted Steel Melt and Pour Country Detail (Importer's Additional Declaration type of '08') is not \"OTH\".",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "841",
    "narrativeText": "STEEL MELT & POUR CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Country of Melt and Pour Country Code on the submitted Steel Melt and Pour Country Detail (Importer's Additional Declaration type of '08') is not a known ISO country code.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "840",
    "narrativeText": "STEEL MELT & POUR CNTRY CD MISSING",
    "explanation": "A Country of Melt and Pour Country Code on the submitted Steel Melt and Pour Country Detail (Importer's Additional Declaration type of '08') is required.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "850",
    "narrativeText": "ALUM PRI & SEC SMELT CNTRY APPL CD CONFLICT",
    "explanation": "Both the Primary and Secondary Country of Smelt Applicability Codes are designated as \"N\" on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07'); however, one or the other must be \"Y\", with a known ISO country code submitted as the corresponding Primary or Secondary Country of Smelt Code.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "849",
    "narrativeText": "ALUM SEC SMELT CNTRY APPL CD MISSING",
    "explanation": "The Secondary Country of Smelt Applicability Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is required.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "848",
    "narrativeText": "ALUM PRI SMELT CNTRY APPL CD MISSING",
    "explanation": "The Primary Country of Smelt Applicability Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is required.",
    "dateUpdated": "2024-09-18"
  },
  {
    "conditionCode": "847",
    "narrativeText": "301 STS EXCLSN MISNG; REQ FOR EXCLSN HTS",
    "explanation": "A Section 301 exclusion 9903.91.09 has been used. However, the required 301 Ship-to-Shore Crane Exclusion (Importer's Additional Declaration type of '10') is missing.",
    "dateUpdated": "2024-09-17"
  },
  {
    "conditionCode": "846",
    "narrativeText": "EXLCSN HTS REQ FOR 301 STS EXCLSN",
    "explanation": "The Importer's Additional Declaration type of '10' (301 Ship-to-Shore Crane Exclusion) must be accompanied with the exclusion 9903.91.09 HTS number.",
    "dateUpdated": "2024-09-17"
  },
  {
    "conditionCode": "845",
    "narrativeText": "301 STS EXCLSN CERT UNKNOWN",
    "explanation": "301 Ship-to-Shore Crane Certification Designation text string on the submitted 301 Ship-to-Shore Crane Exclusion (Importer's Additional Declaration type of '10') must be \"301STS CERT\".",
    "dateUpdated": "2024-09-17"
  },
  {
    "conditionCode": "839",
    "narrativeText": "LIC/CERT/PERM COUNTRY ORIGIN MISMATCH",
    "explanation": "The License/Certificate/ Permit Type Code (52-Record, Type 31) and Country of Origin (40-record) is only applicable to Argentina. Exempt entry types include 21: Warehouse, 22-Re-Warehouse, 23: TIB.",
    "dateUpdated": "2024-08-10"
  },
  {
    "conditionCode": "838",
    "narrativeText": "EXLCSN HTS REQ FOR 201 EXCLSN",
    "explanation": "The Importer's Additional Declaration type of '09' (201 Bi-Facial Solar Exclusion) must be accompanied with the exclusion 9903.45.29 HTS number.",
    "dateUpdated": "2024-06-26"
  },
  {
    "conditionCode": "837",
    "narrativeText": "201 EXLCSN CERT UNKNOWN",
    "explanation": "201 Bifacial Certification Designation text string on the submitted 201 Bi-Facial Solar Exclusion (Importer's Additional Declaration type of '09') must be \"201BIFAC CERT\".",
    "dateUpdated": "2024-06-26"
  },
  {
    "conditionCode": "836",
    "narrativeText": "EXCLSN MISSING; REQUIRED FOR EXCLSN HTS",
    "explanation": "A Section 232 steel or aluminum TRQ exclusion ch99 has been used. However, the required Product Exclusion (Importer's Additional Declaration type of '02' or '03') is missing. Use of the TRQ exclusion ch99 HTS in an ES line requires pairing with an applicable Product Exclusion.\n\nor\n\nA Section 201 exclusion 9903.45.29 has been used. However, the required 201 Bi-Facial Solar Exclusion (Importer's Additional Declaration type of '09') is missing.",
    "dateUpdated": "2024-06-26"
  },
  {
    "conditionCode": "817",
    "narrativeText": "AD-CVD CERT DESIGNATION UNKNOWN",
    "explanation": "The AD/CVD Certification Designation text string on the submitted AD/CVD Certification Designation (Importer's Additional Declaration type of '06') must be \"ADCVD CERT\".",
    "dateUpdated": "2024-02-05"
  },
  {
    "conditionCode": "323",
    "narrativeText": "LV, REGULAR LICENSE TYPE CONFLICT",
    "explanation": "On a single entry summary that has multiple aluminum article (or steel article) lines, only the low-value ('LV' type) license numbers or the regular license numbers can be reported; they cannot be co-mingled on a single entry summary. If co-mingled, this condition will result.",
    "dateUpdated": "2023-10-12"
  },
  {
    "conditionCode": "624",
    "narrativeText": "EST DUTY/CALC\u2019D DUTY MISMATCH - LINE",
    "explanation": "If a \"Duty Free\" Trade Agreement/Special Program Claim Code is reported in the 40-record, positions 25-26 for this line and accepted, no duty must be reported in the 50-record for this line. Review Usage Note j) in the Summary CATAIR for additional clarification.\n\nThe duty calculated for the entry summary line item does not match the estimated duty as reported on the line. Each line on the entry summary should reflect the exact duty amount due based on the duty rate applicable to the tariff number.  However, CBP systems allow a difference per entry summary line of up to $2.99 between the calculated duty and the amount reported by the filer.",
    "dateUpdated": "2023-10-12"
  },
  {
    "conditionCode": "824",
    "narrativeText": "IMPORT DATE MISSING - REQD FOR CBMA",
    "explanation": "If the Date of Importation (AE 11 record, pos 48-53) is not present and the filer has made a CBMA claim on any line, this error will result.  Date of Importation is required if the filer is making a CBMA claim on an article of alcohol.",
    "dateUpdated": "2023-10-12"
  },
  {
    "conditionCode": "825",
    "narrativeText": "IMPORT DATE MISSING - REQD FOR CBMA",
    "explanation": "This is an informational message; not fatal. If the Date of Importation is not present and the filer has made a CBMA claim on any line, this error will result.  Date of Importation is required if the filer is making a CBMA claim on an article of alcohol.",
    "dateUpdated": "2023-10-12"
  },
  {
    "conditionCode": "Q13",
    "narrativeText": "QUOTA REQUESTED EXCEEDS RESERVE",
    "explanation": "An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If a refiled entry summary line reports a quantity that exceeds the Reserved Quota Quantity apportioned or prorated by CBP for the line, as reflected on the latest ACE Entry Summary Status Notification (UC), this error will result.",
    "dateUpdated": "2023-10-12"
  },
  {
    "conditionCode": "338",
    "narrativeText": "IMMED DELVRY \u2013 CNSL RLSE CONFLICT",
    "explanation": "A standalone Entry Summary, where the Consolidated Summary Indicator = 'Y', has been filed, yet only some (not all) of the Entries listed in the Consolidated Release Grouping - Release Detail (32-Record) have requested the Immediate Delivery (ID) procedure. I.e., there is a comingling of Entries that have requested the ID procedure and Entries that have not requested the ID procedure. For a consolidated Entry Summary to be accepted under the ID procedure, all the listed Entries must have requested the ID procedure. (As a possible resolution, two separate Consolidated summarys could be submitted - one with with all Entries requesting ID, the other with all Entires not requesting ID.)",
    "dateUpdated": "2023-06-21"
  },
  {
    "conditionCode": "339",
    "narrativeText": "CARGO RLSE CERT NOT ALLOWED-IMMED DELVRY",
    "explanation": "The Immediate Delivery (ID) procedure was requested on the corresponding Entry (via a step-one SE transaction), yet the follow up step-two summary is requesting a \"Certify for ACE Cargo Release\" action (Cargo Release Certification Request Indicator = A). A \"Certify for ACE Cargo Release\" action is not compatible with the ID procedure. The ID procedure must be activated with a strict two-step Entry/Entry Summary filing order: Entry SE transaction filing/acceptance first followed by the Entry Summary AE transaction filing/acceptance.",
    "dateUpdated": "2023-06-21"
  },
  {
    "conditionCode": "340",
    "narrativeText": "IMMED DELVRY NOT ALLOWED-ENTRY TYPE",
    "explanation": "The Immediate Delivery (ID) procedure was requested on the corresponding Entry (via a step-one SE transaction), yet the follow up step-two summary's Entry Type Code is not allowed to use the ID procedure. Warehouse Entry types 21 and 22 are not eligible for ID. This condition is likely the result of a mismatch between the type code declared on the Entry and the type code declared on the Entry Summary.",
    "dateUpdated": "2023-06-21"
  },
  {
    "conditionCode": "B22",
    "narrativeText": "Entry Summary To Entry Port Mismatch",
    "explanation": "The entry number is already on file in the CBP database with a different port of entry (POE) code.  Error occurs when filer makes entry at one POE and attempts to update to new port code via the ACE Cargo Release (SE) Update action without deleting the Summary (AE) data first. If SE Replace/Update is not an option to resolve, the filer may need to make new entry at correct POE and cancel the duplicate entry at the original POE.",
    "dateUpdated": "2023-06-20"
  },
  {
    "conditionCode": "124",
    "narrativeText": "EST ENTRY DATE MISSING",
    "explanation": "If the Estimated Entry Date (11-Record, position 42-47) is not present and it is required, this error will result. The Estimated Entry Date is required for Warehouse Withdrawal entry types 31-38. The date is used to compare to the Warehouse entry\u2019s Date of Importation to enforce the 5-Year rule.",
    "dateUpdated": "2023-04-12"
  },
  {
    "conditionCode": "826",
    "narrativeText": "ALUM PRIM SMELT CNTRY APPL CD UNKNOWN",
    "explanation": "The Primary Country of Smelt Applicability Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is neither \"Y\" nor \"N\".",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "827",
    "narrativeText": "ALUM PRIM SMELT CNTRY CD MISSING",
    "explanation": "A Primary Country of Smelt Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is required.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "828",
    "narrativeText": "ALUM PRIM SMELT CNTRY APPL CD CONFLICT",
    "explanation": "Both Primary Country of Smelt Applicability Code and Primary Country of Smelt Code found present on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07'); one or the other is required.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "829",
    "narrativeText": "ALUM PRIM SMELT CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Primary Country of Smelt Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is not a known ISO country code.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "830",
    "narrativeText": "ALUM SEC SMELT CNTRY APPL CD UNKNOWN",
    "explanation": "The Secondary Country of Smelt Applicability Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is neither \"Y\" nor \"N\".",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "831",
    "narrativeText": "ALUM SEC SMELT CNTRY CD MISSING",
    "explanation": "A Secondary Country of Smelt Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is required.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "832",
    "narrativeText": "ALUM SEC SMELT CNTRY APPL CD CONFLICT",
    "explanation": "Both Secondary Country of Smelt Applicability Code and Secondary Country of Smelt Code found present on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07'); one or the other is required.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "833",
    "narrativeText": "ALUM SEC SMELT CNTRY CD UNKNOWN CNTRY",
    "explanation": "The Secondary Country of Smelt Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is not a known ISO country code.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "834",
    "narrativeText": "ALUM CAST CNTRY CD MISSING",
    "explanation": "A Country of Cast Code is not found on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07').",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "835",
    "narrativeText": "ALUM CAST CNTRY CD UNKNOWN CNTRY",
    "explanation": "A Country of Cast Code on the submitted Aluminum Smelt and Cast Country Detail (Importer's Additional Declaration type of '07') is not a known ISO country code.",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "B71",
    "narrativeText": "PSC NOT ALLOWED - ADDITIONAL DUTY FOUND",
    "explanation": "A PSC cannot be filed because CPB has introduced a non-standard duty amount to the ES (e.g., a 'marking duty').",
    "dateUpdated": "2023-03-06"
  },
  {
    "conditionCode": "823",
    "narrativeText": "PRDCR ID UNKN; TTB CBMA CLAIM MAY FAIL",
    "explanation": "This is an informational message; not fatal. For shipments entered on or after 1/1/2023, the Foreign Producer Identifier submitted on the CBMA Product Detail (Importer's Additional Declaration type of '05') does not match an identifier issued by TTB. The ES line will be accepted, however, this may affect the refund requested from TTB.",
    "dateUpdated": "2022-10-06"
  },
  {
    "conditionCode": "L01",
    "narrativeText": "LIC/CERT/PERM NBR UNKNOWN",
    "explanation": "The license/certificate/permit number presented on the ES line does not match a number established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L02",
    "narrativeText": "VISA NBR UNKNOWN",
    "explanation": "The visa number presented on the ES line does not match a number established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L03",
    "narrativeText": "NON-STANDARD VISA NBR UNKNOWN",
    "explanation": "The visa number (non-standard) presented on the ES line does not match a number established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L04",
    "narrativeText": "LIC/CERT/PERM IMPORTER ID MISMATCH",
    "explanation": "The IOR number presented on the ES does not match the IOR number on the license/certificate/permit established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L05",
    "narrativeText": "VISA IMPORTER ID MISMATCH",
    "explanation": "The IOR number presented on the ES does not match the IOR number on the visa established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L06",
    "narrativeText": "LIC/CERT/PERM COUNTRY OF ORIGIN MISMATCH",
    "explanation": "The C/O code presented on the ES line does not match the C/O code on the license/certificate/permit established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L07",
    "narrativeText": "VISA COUNTRY OF ORIGIN MISMATCH",
    "explanation": "The C/O code presented on the ES line does not match the C/O code on the visa established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L08",
    "narrativeText": "LIC/CERT/PERM CANCELLED",
    "explanation": "The license/certificate/permit presented on the ES line has been cancelled in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L09",
    "narrativeText": "VISA CANCELLED",
    "explanation": "The visa presented on the ES line has been cancelled in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L10",
    "narrativeText": "NON-STANDARD VISA CANCELLED",
    "explanation": "The visa (non-standard) presented on the ES line has been cancelled in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L11",
    "narrativeText": "LIC/CERT/PERM NOT YET EFF OR EXP",
    "explanation": "The license/certificate/permit presented on the ES line is not yet effective or has expired in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L12",
    "narrativeText": "VISA NOT YET EFF OR EXP",
    "explanation": "The visa presented on the ES line is not yet effective or has expired in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L13",
    "narrativeText": "LIC/CERT/PERM HTS/UOM MISMATCH",
    "explanation": "The HTS number/Unit of Measure combination presented on the ES line does not match the HTS number/Unit of Measure combination on the license/certificate/permit established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L14",
    "narrativeText": "VISA HTS/UOM MISMATCH",
    "explanation": "The HTS number/Unit of Measure combination presented on the ES line does not match the HTS number/Unit of Measure combination on the visa established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L15",
    "narrativeText": "QUANTITY EXCEEDS LIC/CERT/PERM LIMIT",
    "explanation": "While there is an available balance on the license/certificate/permit established in the eCert system, the quantity presented on the ES line exceeds it. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L16",
    "narrativeText": "QUANTITY EXCEEDS VISA LIMIT",
    "explanation": "While there is an available balance on the visa established in the eCert system, the quantity presented on the ES line exceeds it. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L17",
    "narrativeText": "LIC/CERT/PERM LIMIT PREVIOUSLY REACHED",
    "explanation": "There is no available balance on the license/certificate/permit established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "L18",
    "narrativeText": "VISA LIMIT PREVIOUSLY REACHED",
    "explanation": "There is no available balance on the visa established in the eCert system. Depending on the direction of the participating country, the severity of the condition may be FATAL or INFORMATIONAL.",
    "dateUpdated": "2022-06-28"
  },
  {
    "conditionCode": "414",
    "narrativeText": "Canadian Prov Req'd As Origin for Type",
    "explanation": "Canadian Province Req\u2019d As Origin in 40 record position 9-10 for all Entry types other than 06, 11, 31, 32 and 34 where country of export is also Canada",
    "dateUpdated": "2022-05-09"
  },
  {
    "conditionCode": "B11",
    "narrativeText": "<eliminated>",
    "explanation": "",
    "dateUpdated": "2022-05-09"
  },
  {
    "conditionCode": "822",
    "narrativeText": "ASTERISK(\"*\") NOT ALLOWED IN LINE ITM ID",
    "explanation": "In a trade filing, an asterisk (\"*\") is not allowed in the any position of the Line Item Identifier.",
    "dateUpdated": "2022-01-03"
  },
  {
    "conditionCode": "B77",
    "narrativeText": "ACTION NOT ALLOWED-ENTRY TYPE CONFLICT",
    "explanation": "The Entry Number provided is not the type of entry that can be modified with this transactions. For example: a Reconciliation Entry (Type 09) cannot be modified by the AE transaction.",
    "dateUpdated": "2022-01-03"
  },
  {
    "conditionCode": "B78",
    "narrativeText": "DISTRICT/PORT OF ENTRY INACTIVE",
    "explanation": "The Port code specified in the EDI B-Record (Block) must be an active port.",
    "dateUpdated": "2022-01-03"
  },
  {
    "conditionCode": "337",
    "narrativeText": "PMS NOT ALLOWED-IOR ON SANCTION",
    "explanation": "Period monthly statements are not allowed if an Importer has been sanctioned. Only daily statements and single pay are allowed.",
    "dateUpdated": "2021-10-21"
  },
  {
    "conditionCode": "820",
    "narrativeText": "SUGAR CERT ISSUE YEAR TYPE NOT ALLOWED",
    "explanation": "The first character of the sugar license (C = calendar year, F = fiscal year) is the incorrect year 'type' for this particular sugar article. \n\nNote that this condition can occur if an HTS pairing is incorrect (e.g., an incorrect sugar HTS paired with the Colombia Trade Agreement HTS 9822.08.01). If applicable, please classify sugar entries as detailed in U.S. note 32 (c)(ii). See CSMS #49307446 - Colombia Trade Agreement Sugar Tariffs for details.",
    "dateUpdated": "2021-09-09"
  },
  {
    "conditionCode": "821",
    "narrativeText": "SUGAR CERT ISSUE YEAR MISMATCH",
    "explanation": "The second digit of the sugar license (i.e., the issuance year) does not match the pertinent date of the Entry Summary line item (i.e., the date used for purposes of classification; the Line Action Date). The referenced license is only allowed to be used in the year (calendar or fiscal) that it was issued.",
    "dateUpdated": "2021-08-10"
  },
  {
    "conditionCode": "818",
    "narrativeText": "LIC/CERT/PERM NOT ALLOWED-ENTRY TYPE",
    "explanation": "The submission of the license in the ES line is not allowed because of the entry type. Specifically, for Aluminum (as well as Steel) articles, a license is not allowed to be reported on the entry summary line if Entry Types 06 (FTZ withdrawal), 21 (Warehouse) or 22 (Re-warehouse).",
    "dateUpdated": "2021-08-03"
  },
  {
    "conditionCode": "136",
    "narrativeText": "FTZ Identifier Not Allowed for Ent Type",
    "explanation": "If the entry type is not 06, this field must be blank.  If any data is included in pos 63-71 of the 11 record, this error will result when the entry type is other than 06.",
    "dateUpdated": "2021-05-27"
  },
  {
    "conditionCode": "288",
    "narrativeText": "FTZ Identifier Missing",
    "explanation": "If the entry type code is '06' (FTZ) and the foreign trade zone identifier (11 record, pos 63-71) is space/blank, this error will result.",
    "dateUpdated": "2021-05-27"
  },
  {
    "conditionCode": "289",
    "narrativeText": "FTZ Identifier Unknown",
    "explanation": "If the entry type code is '06' (FTZ) and the foreign trade zone identifier (11 record, pos 63-71) is formatted incorrectly, this error will result. See 11 record 'Note 3' for formatting details.",
    "dateUpdated": "2021-05-27"
  },
  {
    "conditionCode": "322",
    "narrativeText": "MNFST CMPNT ID CANNOT CONTAIN SPEC CHAR",
    "explanation": "The Manifest Component Identifier cannot contain special characters; allowed values are A-Z, 0-9, and space/blank.",
    "dateUpdated": "2021-05-27"
  },
  {
    "conditionCode": "798",
    "narrativeText": "CBMA CLAIM REQUIRES CBMA DETAIL",
    "explanation": "A Product Claim Code of 'C' (Craft Beverage Modernization Act Refund Claim) requires an Importer's Additional Declaration type of '05' (CBMA Product Detail).",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "799",
    "narrativeText": "CBMA DETAIL REQUIRES CBMA CLAIM",
    "explanation": "An Importer's Additional Declaration type of '05' (CBMA Product Detail) requires the Product Claim Code to be 'C' (Craft Beverage Modernization Act Refund Claim).",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "800",
    "narrativeText": "CBMA CONTROLING GRP NAME MISSING",
    "explanation": "The Controlled Group Name is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "801",
    "narrativeText": "CBMA PRODUCER NBR MISSING",
    "explanation": "The Foreign Producer Identifier is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "802",
    "narrativeText": "CBMA PRODUCER NAME MISSING",
    "explanation": "The Foreign Producer Name is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "803",
    "narrativeText": "CBMA ALLOC QTY MISSING",
    "explanation": "The Allocation Quantity is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "804",
    "narrativeText": "CBMA ALLOC QTY CONTAINS NON-NUMERICS",
    "explanation": "The Allocation Quantity must be numeric on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "805",
    "narrativeText": "CBMA RATE DSGNTN CD MISSING",
    "explanation": "The CBMA Rate Designation Code is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "806",
    "narrativeText": "CBMA TTB TAX RATE MISSING",
    "explanation": "The TTB Tax Rate is missing on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "807",
    "narrativeText": "CBMA TTB TAX RATE CONTAINS NON-NUMERICS",
    "explanation": "The TTB Tax Rate must be numeric on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05').",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "808",
    "narrativeText": "CBMA RATE DSGNTN NOT FND",
    "explanation": "The CBMA Rate Designation Code submitted on the CBMA Product Detail is not found as a known code.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "809",
    "narrativeText": "CBMA RATE DSGNTN NOT EFFECTIVE",
    "explanation": "The CBMA Rate Designation Code submitted on the CBMA Product Detail is not found to be effective for the pertinent summary date (e.g., entry date).",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "810",
    "narrativeText": "CBMA TTB TAX RATE MISMATCH",
    "explanation": "The TTB Tax Rate submitted on the CBMA Product Detail (Importer's Additional Declaration type of '05') does not match the known tax rate assigned to the CBMA Rate Designation Code for the period.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "811",
    "narrativeText": "CBMA CLAIM REQUIRES IR TAX ESTIMATE",
    "explanation": "Submission of a CBMA Product Detail (Importer's Additional Declaration type of '05') on the line requires the submission of an IR tax estimate (i.e., IR Tax Information accounting class and estimate).",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "812",
    "narrativeText": "CBMA ACCOUNTING CLASS CODE MISMATCH",
    "explanation": "The submitted Accounting Class Code on the IR Tax Information is not eligible for the CBMA Rate Designation Code submitted on the CBMA Product Detail.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "814",
    "narrativeText": "CBMA FLVR CNTNT CRDT IND MUST BE Y",
    "explanation": "The Flavor Content Credit Indicator on the submitted CBMA Product Detail (Importer's Additional Declaration type of '05') must be value 'Y' (Yes) or left space/blank.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "815",
    "narrativeText": "CBMA FLVR CNTNT CRDT IND NOT ALLOWED",
    "explanation": "A Flavor Content Credit claim (Indicator = 'Y') is not allowed for the submitted CBMA Rate Designation Code.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "816",
    "narrativeText": "IR TAX ACCEPTED; FLAVOR CREDIT CLAIM",
    "explanation": "This is an informational message; not fatal. The Flavor Content Credit claim (Indicator = 'Y') was allowed / accepted for the submitted CBMA Rate Designation Code; the estimated IR Tax amount was accepted without verification.",
    "dateUpdated": "2021-01-04"
  },
  {
    "conditionCode": "208",
    "narrativeText": "PERIODIC STMT REQUIRES CONTINUOUS BOND",
    "explanation": "If payment 6, 7 or 8 is transmitted in the 10 record, pos 51, a continuous bond must on file for the importer and bond type \u20188\u2019 must be transmitted in the 31 record, pos 3, or Bond Waiver \u20180\u2019 in the 10 record, pos 38.",
    "dateUpdated": "2020-12-01"
  },
  {
    "conditionCode": "Q25",
    "narrativeText": "NO LINES ON ES SUBJECT TO QTA",
    "explanation": "This is an informational message; not fatal. An Entry Type 02, 07, 12, 32 or 38 Entry Summary has been submitted. None of the lines, however, are subject to a quota.",
    "dateUpdated": "2020-12-01"
  },
  {
    "conditionCode": "191",
    "narrativeText": "IN-BND/TRN DT CANNOT BE > EST ENTRY DT",
    "explanation": "The inbond date is transmitted in the 20 record, pos 52-57.  This date cannot be later than the estimated entry date reported in the 11 record.",
    "dateUpdated": "2020-03-30"
  },
  {
    "conditionCode": "273",
    "narrativeText": "NAFTA RECON IND NOT ALLOWED - CBP CNTL",
    "explanation": "A filing for an ES in 'CBP Control' (i.e., a PSC filing) cannot include a FTA recon claim. (i.e., NAFTA)",
    "dateUpdated": "2020-02-20"
  },
  {
    "conditionCode": "274",
    "narrativeText": "RECON ISSUE CODE NOT ALLOWED - CBP CNTL",
    "explanation": "A filing for an ES in 'CBP Control' (i.e., a PSC filing) cannot include a non-FTA recon claim.",
    "dateUpdated": "2020-02-20"
  },
  {
    "conditionCode": "796",
    "narrativeText": "PRDCT EXCLSN DEACTIVATED",
    "explanation": "The product exclusion ID specified has been deemed 'deactivated' for a quantity overage or other usage reason. This product exclusion ID cannot be used on a new entry summary.",
    "dateUpdated": "2020-01-06"
  },
  {
    "conditionCode": "797",
    "narrativeText": "PRDCT EXCLSN DEACTIVATED",
    "explanation": "This is an informational message; not fatal. The product exclusion ID specified has been deemed 'deactivated' for a quantity overage or other usage reason. This product exclusion ID can only be used in a correction, PSC, or other CBP initiated action.",
    "dateUpdated": "2020-01-06"
  },
  {
    "conditionCode": "783",
    "narrativeText": "DUPLICATE ADDTNL DEC TYP ENCOUNTERED",
    "explanation": "If more than one 54-Record reports the same type code for the same line, this error will result.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "790",
    "narrativeText": "HTS USE NOT ALLOWED - RESERVED",
    "explanation": "The HTS number reported in the 50-Record is reserved for CBP special use (e.g., quota).",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "791",
    "narrativeText": "EXP CERT NBR MISSING",
    "explanation": "The Importer\u2019s Additional Declaration Information (54-Record) is missing in a scenario where the Importer\u2019s Additional Declaration Type Code requires an export certificate/license number.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "792",
    "narrativeText": "MATCHING EXP CERT NBR NOT FND",
    "explanation": "The export/certificate number provided in the Importer's Additional Declaration Information data element does not exist in ACE.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "793",
    "narrativeText": "MATCHING EXP CERT NBR NOT FND",
    "explanation": "This is an informational message; not fatal. The export/certificate number provided in the Importer's Additional Declaration Information data element does not exist in ACE.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "794",
    "narrativeText": "ADDTNL DEC TYPE RQRD FOR ARTICLE",
    "explanation": "An Importer's Additional Declaration Detail is required for the article.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "795",
    "narrativeText": "ADDTNL DEC TYPE RQRD FOR ARTICLE",
    "explanation": "This is an informational message; not fatal. An Importer's Additional Declaration Detail is required for the article.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "A25",
    "narrativeText": "LOOP EXCEEDED-IMP ADDTNL DEC DETAILS",
    "explanation": "The Importer's Additional Declaration Detail grouping consists of a 54-record.  If this looping configuration is exceeded (more than 9 records), this error will result.",
    "dateUpdated": "2019-10-01"
  },
  {
    "conditionCode": "Q16",
    "narrativeText": "QUOTA HTS 1/HTS 2 MISMATCH",
    "explanation": "The HTS 1 and HTS 2 Entered on this ES line do not match any Quota ID records",
    "dateUpdated": "2019-07-29"
  },
  {
    "conditionCode": "784",
    "narrativeText": "CNSL XPRS INF CANNOT BE CNSLDT ES",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the Consolidated Summary Indicator cannot be marked 'Y'.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "785",
    "narrativeText": "CARGO RLSE CERT NOT ALLWD-CNSL XPRS INF",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the Cargo Release Certification Request Indicator cannot be marked 'A'.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "786",
    "narrativeText": "HDR FEE NOT ALLOWED FOR CNSL XPRS INF",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', an Entry Summary Header Fee (Accounting Class Code and Header Fee Amount) cannot be specified.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "787",
    "narrativeText": "IR TAX NOT ALLOWED FOR CNSL XPRS INF",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the IR Tax Information (Accounting Class Code and IR Tax Amount) cannot be specified.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "788",
    "narrativeText": "LINE FEE NOT ALLOWED FOR CNSL XPRS INF",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the Line User Fee Detail (Accounting Class Code and User Fee Amount) cannot be specified.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "789",
    "narrativeText": "USAGE NOT ALLOWED FOR CNSL XPRS INF",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', a Shipment Usage Type Code of 'P' (Personal Shipment) or 'X' (Sample Commercial Shipment) cannot be used.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "B73",
    "narrativeText": "CNSLDT XPRSS INFRML IND MUST BE Y",
    "explanation": "The Consolidated Express Informal Indicator must be 'Y' or space/blank.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "B74",
    "narrativeText": "CNSLDT XPRSS INFRML NOT ALLOWED FOR FLR",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the ES Filer must be an approved Express Consignment facility participant.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "B75",
    "narrativeText": "CNSLDT XPRSS INF MUST BE INFRML TYPE",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', the Entry Type Code must be '11' (Informal).",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "B76",
    "narrativeText": "CNSL XPRS INF NOT ALLWD-ENTRY ON FILE",
    "explanation": "If the Consolidated Express Informal Indicator is 'Y', a conventional Entry with the same Entry Number cannot have been filed.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "S06",
    "narrativeText": "Bond Desig Typ Code Not Valid For Bond Typ",
    "explanation": "This error will occur when a transaction is submitted with a Bond Designation Type Code that cannot be used with the Bond Type Code and/or the Bond Number.",
    "dateUpdated": "2019-04-26"
  },
  {
    "conditionCode": "417",
    "narrativeText": "PRODUCT CLAIM CD UNKNOWN",
    "explanation": "A 'secondary' special program or other type of code is claimed by transmitting a value in the 40 record, pos 55.  Five codes are currently approved for this field: C, F, G, H, OR M . If a different code is transmitted, this error will result.",
    "dateUpdated": "2018-07-24"
  },
  {
    "conditionCode": "776",
    "narrativeText": "PRDCT EXCLSN ID UNKNOWN",
    "explanation": "The Product Exclusion Identifier provided has not been found in the list of issued exclusions.",
    "dateUpdated": "2018-07-24"
  },
  {
    "conditionCode": "779",
    "narrativeText": "PRDCT EXCLSN NOT YET EFF OR EXPIRED",
    "explanation": "The Product Exclusion Identifier provided is not usable because the Line Action date falls outside of the effective period it was issued for.",
    "dateUpdated": "2018-07-17"
  },
  {
    "conditionCode": "780",
    "narrativeText": "PRDCT EXCLSN IOR MISMATCH",
    "explanation": "The Product Exclusion Identifier provided is not usable because it was not issued to the Importer of Record reported (11-Record).",
    "dateUpdated": "2018-07-17"
  },
  {
    "conditionCode": "781",
    "narrativeText": "PRDCT EXCLSN HTS MISMATCH",
    "explanation": "The Product Exclusion Identifier provided is not usable because it was not issued for the commodity HTS reported (50-Record).",
    "dateUpdated": "2018-07-17"
  },
  {
    "conditionCode": "782",
    "narrativeText": "PRDCT EXCLSN ORIG CTRY MISMATCH",
    "explanation": "The Product Exclusion Identifier provided is not usable because it was not issued for the Country of Origin reported (40-Record).",
    "dateUpdated": "2018-07-17"
  },
  {
    "conditionCode": "769",
    "narrativeText": "PRDCT EXCLSN ID MISSING",
    "explanation": "The Importer\u2019s Additional Declaration Information (54-Record) is missing in a scenario where the Importer\u2019s Additional Declaration Type Code requires a Product Exclusion Identifier (e.g., 02, 03).",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "770",
    "narrativeText": "PRDCT EXCLSN ID UNKNOWN FORMAT",
    "explanation": "The Importer\u2019s Additional Declaration Information (54-Record) provided in a scenario where the Importer\u2019s Additional Declaration Type Code requires a Product Exclusion Identifier (e.g., 02, 03) is not in the format specified by the Department of Commerce.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "771",
    "narrativeText": "TRFF ADJSTMNT HTS OR EXCLSN MISSING",
    "explanation": "The article, found to be subject to a remedy or other measure (e.g., a Section 232 or Section 301 measure), is missing either the required remedy HTS (50-Record) or an indication of an 'exclusion' (e.g., a 54-Record Product Exclusion Identifier).",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "772",
    "narrativeText": "TRFF ADJSTMNT EXCPTN/EXCLSN CONFLICT",
    "explanation": "Both the required remedy HTS (50-Record) and the indication of an 'exclusion' (e.g., a 54-Record Product Exclusion Identifier) has been submitted for the article found to be subject of a remedy or other measure. An article under a remedy requires either the remedy HTS or an indication of an exclusion.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "773",
    "narrativeText": "ADDTNL DEC TYPE NOT ALLWD FOR ARTICLE",
    "explanation": "The Importer\u2019s Additional Declaration Type Code (54-Record) specified is not allowed to be used with one or more of the HTS numbers (50-Record) specified for the ES line.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "774",
    "narrativeText": "ADDTNL DEC TYPE NOT ALLWD FOR CNTRY",
    "explanation": "The Importer\u2019s Additional Declaration Type Code (54-Record) specified is not allowed to be used with one Country of Origin Code (40-Record) specified for the ES line.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "775",
    "narrativeText": "TRFF ADJSTMNT HTS NOT ALLOWED",
    "explanation": "An HTS (50-Record) reserved for another remedy has been found submitted on the ES line,",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "777",
    "narrativeText": "ADDTNL DEC TYPE NOT YET EFF OR EXPIRED",
    "explanation": "The Importer\u2019s Additional Declaration Type Code (54-Record) is not yet considered as active/effective or is no longer available for use.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "778",
    "narrativeText": "TRFF ADJSTMNT CONFLICT - ENT TYPE",
    "explanation": "The article, normally found to be subject to a remedy or other measure (e.g., a Section 232 or Section 301 measure), is exempted from the remedy because of the Entry Type. The normal remedy HTS (50-Record) or the indication of an 'exclusion' (e.g., a 54-Record Product Exclusion Identifier) have been submitted; they are, however, not allowed for the ES line.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "B72",
    "narrativeText": "ACTION NOT ALLOWED; STMNT CONFLICT",
    "explanation": "This condition will occur when the Entry Summary is schedlued for a statement (10-Record Preliminary Statement Print Date) and during validation execution the actual statement generation program is running at the same time for that same date. Change the Preliminary Statement Print Date to the following day and try again.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "Q14",
    "narrativeText": "LINE SUBJECT TO ABSOLUTE QUOTA",
    "explanation": "This is an informational message; not fatal. The entry summary line is subject to an absolute quota based on its tariff number(s) and country of origin.",
    "dateUpdated": "2018-05-16"
  },
  {
    "conditionCode": "162",
    "narrativeText": "Importer Not Approved For Reconciliation",
    "explanation": "The 11-digit importer of record number, 11 record, pos 3-14, is listed on the reconciliation importer file as being NOT approved for reconciliation entries and/or the importer does not have a recondiliation bond rider.",
    "dateUpdated": "2018-02-01"
  },
  {
    "conditionCode": "572",
    "narrativeText": "Zero-Rate Case; Qual Must Be A",
    "explanation": "If BOTH the ad valorem and specific rates for an AD/CVD case are not present or zero, the case type qualifier must be \"A\" in pos 22 of the 53 record (i.e., Commerce requires that the case be reported as if ad valorem).",
    "dateUpdated": "2018-02-01"
  },
  {
    "conditionCode": "604",
    "narrativeText": "HTS Not Allowed for Entry Type",
    "explanation": "One or more tariff numbers transmitted in the AE is not eligible for the submitted entry type:   Chapter 9813 HTS number is only allowed for type 23 (TIB).\nChapter 9818 HTS number is only allowed for type 05 (Vessel Repair) - Not automated in AE.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "657",
    "narrativeText": "Fee Required for Article",
    "explanation": "If an HTS number on the line requires an AMS fee (must), and the line is submitted without that AMS fee class code/amount pair in the 62-Record and there are no exemptions, this error will result. Exemptions can include entry type, Port of Entry, HTS pairing, and/or submittion of an LPC number.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "665",
    "narrativeText": "OTH REV NOT ALLOWED - EXEMPT PORT",
    "explanation": "If the 10-Record District Port of Entry is NOT in Puerto Rico (district 49) and the line is submitted with a '672' class code/amount pair in the 61-Record and an HTS number on the line requires that submitted other revenue (may or must), this error will result. (E.g., the article is not a coffee importation into a Puerto Rico Port of Entry.)",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "666",
    "narrativeText": "OTH REV REQUIRED FOR ARTICLE",
    "explanation": "If an HTS number on the line requires an other revenue class (must) and the line is submitted without that other revenue class code/amount pair in the 61-Record and there is no additional exemption, this error will result. (E.g., an article of coffee into a Puerto Rico Port of Entry.)",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "667",
    "narrativeText": "OTH REV NOT ALLOWED FOR ARTICLE",
    "explanation": "If a line is submitted with an other revenue class code/amount pair in a 61-Record and no HTS number on the line requires that other revenue, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "668",
    "narrativeText": "OTH REV ACCEPTED; 'X' COMP CODE",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an other revenue class code/amount pair in a 61-Record and an HTS number on the line requires that other revenue (may or must), and the formula to compute the other revenue amount is a complex computation not verified by the system.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "669",
    "narrativeText": "EST OTH REV/CALC\u2019D OTH MISMATCH - LINE",
    "explanation": "If a line is submitted with an other revenue class code/amount pair in the 61-Record, and that other revenue class is allowed, and the filer's estimate of the amount falls outside $3.00 (plus or minus) of the system's calculation (using the rates and formula for the HTS), this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "698",
    "narrativeText": "EST OTH REV/CALC\u2019D OTH MISMATCH - TOTAL",
    "explanation": "If the filer's estimate of the other revenue total (in the 89-Record) falls outside $3.00 (plus or minus) of the sum of the individual system's calculation for each line with that other revenue class, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "699",
    "narrativeText": "CO RESTRICTED FOR HTS",
    "explanation": "Importation from the country of origin, while generally a country that is designated as 'imports restricted', does allow some articles. This error will result when the HTS specified on the line is not an allowed article from an otherwise 'imports restricted' country. (E.g., An article originating in Cuba that is not allowed by the U.S. Department of State.)",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "762",
    "narrativeText": "OTH REV NOT ALLOWED - SET COMPONENT",
    "explanation": "Other revenue cannot be reported on a 'V' line for a set.  Only the 'X' line can reflect other revenue (e.g., class code '672' - Coffee Imports to Puerto Rico \u2013 Duty Assessment).",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "763",
    "narrativeText": "OTH REV ACCT CLASS CODE MISSING",
    "explanation": "The class code for reporting other revenue amounts must be reported in the 61-Record. If the class code is not transmitted, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "764",
    "narrativeText": "OTH REV ACCT CLASS CODE UNKNOWN",
    "explanation": "If the 61-Record contains a non-space value other than a known other revenue class code this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "765",
    "narrativeText": "OTH REV ACCT CLASS CODE NOT ALLOWED",
    "explanation": "The accounting class code reported in the 61-Record is not an other revenue class code.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "766",
    "narrativeText": "OTH REV CONTAINS NON-NUMERICS",
    "explanation": "If the other revenue amount submitted in the 61-Record contains non-numeric characters or blanks, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "767",
    "narrativeText": "GRAND OTH REV TOT CONTAINS NON-NUMERICS",
    "explanation": "If the other revenue amount submitted in the 90-Record contains non-numeric characters, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "768",
    "narrativeText": "GRAND TOT OTH REV NOT = SUM OF EST OTH",
    "explanation": "The sum of  the amounts of other revenue transmitted in the 61-Records must agree to the penny with the total other revenue amount transmitted in the 90-Record. If the figures do not match, this error will result.",
    "dateUpdated": "2017-11-16"
  },
  {
    "conditionCode": "452",
    "narrativeText": "Non-Reimburse Stm Not Allowed - No Case",
    "explanation": "If the non-reimbursement statement indicator (\"Y\" in pos 60 of the 40 record) is transmitted on an AD/CVD type entry (03, 07, 34, 38; conditionally 06, 21, 22, 23), but there is no 53 record containing a valid case number, this error will result.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "463",
    "narrativeText": "Non-Reimburse Stm Not Allowed - Ent Typ",
    "explanation": "A non-reimbursement statement indicator (Y in pos 60 of th3 40 record) is not permitted if the entry type is not a AD/CVD type entry (03, 07, 34, 38; conditionally 06, 21, 22, 23).",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "465",
    "narrativeText": "Article May Be Subject to AD/CVD",
    "explanation": "This is an informational message; not fatal. ACE will scan the transmitted tariff numbers and country of origin to determine if there is an active, valid AD or CVD case for those tariff number/c/o combinations.  If so, and there is no 53 record included in the AE, this message will result.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "466",
    "narrativeText": "AD/CVD Case Not Allowed for Ent Type",
    "explanation": "If the entry type in the 10 record is not a AD/CVD type entry (03, 07, 34, 38; conditionally 06, 21, 22, 23), no AD/CVD data can be included in the entry.  If a 53 record is transmitted for such an entry type, this error will result.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "499",
    "narrativeText": "Foreign Exporter Missing - Required For Type",
    "explanation": "There must be a 47 record with party type E and an appropriate foreign exporter identification number if transmitted entry type is an AD/CVD type entry (03, 07, 34, 38; conditionally 06, 21, 22, 23).",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "577",
    "narrativeText": "Sold To Party Missing -Req'd for Type",
    "explanation": "There is no 47 record with code S (sold to party) for the identification number of this party. This  element is required for entry types 01, 02, 03, 06, 07, 21, 21, 23, 31, 32, 34, 38, 51, 52.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "578",
    "narrativeText": "Sold To Party Unknown",
    "explanation": "The identifying number for the entity listed as the 'sold to' party on the 47 (party identifier is S) record is not found on the importer database.  If the reported ID number for this party is an EIN, all 11 digits are required.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "598",
    "narrativeText": "STANDARD VISA NBR MISSING",
    "explanation": "There is no 51-Record submitted; article requires a standard visa.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "706",
    "narrativeText": "At Least One Line Requires AD/CVD Case",
    "explanation": "If entry type 03, 07, 34, 38 is transmitted, there must be at least one 53 record with AD/CVD case information.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "727",
    "narrativeText": "ADD/CVD Duty Totals not Allowed",
    "explanation": "If no AD/CVD case was transmitted in any line and an 88 record was transmitted, this error will result.  The 88 record is only allowed for reporting ADD or CVD amounts and cannot be used in any entry summary type other than a AD/CVD type entry (03, 07, 34, 38; conditionally 06, 21, 22, 23).",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "735",
    "narrativeText": "AD/CVD Duty Totals Missing",
    "explanation": "If AD/CVD entry type (03, 07, 34, 38; conditionally 06, 21, 22, 23) is transmitted , there must be an 88 record totaling the bonded/payable amounts of AD/CVD duties.",
    "dateUpdated": "2017-06-20"
  },
  {
    "conditionCode": "245",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "285",
    "narrativeText": "FLR/ENTRY DDPP PROFILE NOT FND FOR STMTS",
    "explanation": "A requisite 'account profile' has not been found for the Filer, Entry DDP combination in ACE. This is likely an oversight on the part of your Client Rep. Please contact CBP.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "306",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "313",
    "narrativeText": "PMS DAY NOT FOUND IN BROKER PROFILE",
    "explanation": "A periodic monthly statement 'day schedule' has not found in the 'broker account profile'. This is likely an oversight on the part of your Client Rep. Please contact CBP.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "314",
    "narrativeText": "PMS DAY NOT FOUND IN IMPORTER PROFILE",
    "explanation": "A periodic monthly statement 'day schedule' has not found in the 'importer account profile'. This is likely an oversight on the part of your Client Rep. Please contact CBP.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "321",
    "narrativeText": "WRHSE/WD PRELIM STMT PRINT DT CONFLICT",
    "explanation": "If scheduled for a statement, the Preliminary Statement Print Date of a submitted Re-Warehouse (22) or Warehouse Withdrawal (3x) summary cannot fall earlier than the Preliminary Statement Print Date (if any) of the Warehouse (21) or Re-Warehouse (22) summary to which it is referencing.\nIf scheduled for a statement, the Preliminary Statement Print Date of a submitted (as a correction) Warehouse (21) or Re-Warehouse (22) summary must fall no later than all Preliminary Statement Print Dates (if any) of all underlying Re-Warehouse (22) or Warehouse Withdrawal (3x) summaries which it covers.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "489",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "490",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "491",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "492",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "493",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "494",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "495",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "496",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "497",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "498",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "500",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "501",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "502",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "503",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "504",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "506",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "508",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "510",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "512",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "513",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "514",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "515",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "516",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "517",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "592",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "649",
    "narrativeText": "FEE NOT ALLOWED - EXEMPT ARTICLE",
    "explanation": "The submitted 056-Cotton Fee is not allowed to be reported for the line because the first HTS number in chapter 98 exempts the reporting requirement.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "A14",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B27",
    "narrativeText": "Action not allowed - non-ace summary",
    "explanation": "The entry number transmitted to ACE (in the AE) has been transmitted previously to ACS (by an EI or by CBP entering as non-ABI).",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B59",
    "narrativeText": "PSC Not Allowed - Under CBP Review",
    "explanation": "If an ACE conventional summary has been placed in a 'review' status by CBP, conditionally not yet liquidated, or extended by CBP, a PSC cannot be filed for that entry.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B60",
    "narrativeText": "PSC NOT ALLOWED \u2013 SUSPENDED",
    "explanation": "If an ACE conventional summary has been suspended (other than for AD/CVD reasons 43, 44, 45) a PSC cannot be filed for that entry.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B61",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B62",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B69",
    "narrativeText": "PSC NOT ALLOWED \u2013 TIB CLOSED",
    "explanation": "A PSC cannot be filed against a Entry Type 23 (TIB) entry summary that has already been closed (i.e., the close date is the same as, or earlier than, the date of PSC transmission).",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "B70",
    "narrativeText": "ENTRY NUMBER NOT ACTIVE",
    "explanation": "The Entry Number specified identifies an entry summary initially established in legacy ACS and subsequently relocated (converted) to ACE. The entry summary is not eligible to be updated.",
    "dateUpdated": "2017-01-24"
  },
  {
    "conditionCode": "173",
    "narrativeText": "FIRMS Required for Entry Type",
    "explanation": "The FIRMS code transmitted in the 20 record, pos 17-20 is required for Entry Type codes FTZ (06), Warehouse (21, 22), and Warehouse Withdrawals (31, 32, 34, 38).",
    "dateUpdated": "2016-07-27"
  },
  {
    "conditionCode": "148",
    "narrativeText": "Cargo Rlse Cert Not Allowd -Line Release",
    "explanation": "An ACE Entry summary cannot request ACE cargo certification (Cargo Release Certification Indicator = A) if a release via the Line Release program has already been accepted.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "150",
    "narrativeText": "RLF Requires Cargo Rlse Certification",
    "explanation": "With the exception of entry types '3n' (warehouse withdrawal) and '51' (Military-DCMA), RLF summaries must be certified for ACE cargo release.  If the 10 record, pos 40, does not include a 'A' (ACE), this error will result.  For a cargo certification request of ACE, the requirement applies to every transmission of the RLF summary.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "221",
    "narrativeText": "RLF Requires Elec Invoice",
    "explanation": "n/a\nNote: Marking the 10-Record Electronic Invoice Indicator with a \u2018Y\u2019 (an EIP claim) is not allowed when the filer also specifies an \u2018A\u2019 in 10-Record Cargo Release Certification Request Indicator (Certify for ACE Cargo Release).",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "230",
    "narrativeText": "Cnsldtn Not Allwd \u2013 Already Rlsed",
    "explanation": "If a consolidating entry summary claim is made ('Y' in 10 record, position 42) and an entry (e.g., ACE SE or other type of release) is already filed, this error will result.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "256",
    "narrativeText": "Cargo Rlse Cert Not Allwd\u2013Cnsl Rej Corr",
    "explanation": "If the entry summary is in CBP control, rejected, and is being submitted as a correction, if the summary on file is a consolidated summary and the filer has made a request for cargo certification (A=ACE), this error will result. An entry summary that has been consolidated cannot be used for cargo release purposes.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "292",
    "narrativeText": "Cargo Release Cert Ind Unknown",
    "explanation": "If the 10 record pos 4 contains a value other than 'A' this error will result.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "310",
    "narrativeText": "Cargo Rlse Cert Not Allowd - Entry Typ",
    "explanation": "If the entry type code is '3n' (warehouse withdrawal) or '51' (Military-DCMA), and the 10 record pos 40 (Cargo Release Certification Request Ind) is 'A' (ACE) this error will result. There entry types never have a corresponding entry.",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "749",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "B63",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "B67",
    "narrativeText": "Es Type - Cargo Release Conflict",
    "explanation": "If the summary entry type code is '3n' (warehouse withdrawal) or '51' (DCMA) and the entry number has been found to be already established as an entry (in ACE), this error will result. (Warehouse withdrawals or DCMA summaries do not have entries. Note that in this scenario, the found entry would NEVER have a '3n' or '51' entry type code.)",
    "dateUpdated": "2016-07-12"
  },
  {
    "conditionCode": "317",
    "narrativeText": "PGA Data Incld Ind Unknown",
    "explanation": "The PGA Data Includer Indicator in the 10-Record, position 68, is other than a 'Y', 'F', or space.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "318",
    "narrativeText": "PGA Data Incld Ind/Cargo Cert Conflict",
    "explanation": "The PGA Data Included Indicator in the 10-Record, position 68, cannot be 'Y' or 'F' if the Cargo Release Certification Request Indicator (postion 40) is 'A' (ACE Cargo Release).",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "319",
    "narrativeText": "PGA Data Incld Ind/Entry Type Conflict",
    "explanation": "The PGA Data Included Indicator in the 10-Record, position 68, cannot be 'F' if the Entry Type Code is not '06' (FTZ).",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "320",
    "narrativeText": "Cargo Rlse Cert Required for Entry Typ",
    "explanation": "A Cargo Release Certification Request Indicator of 'A' (ACE Cargo Release) is required for the Entry Type Code. (A quota Entry Type entry summary is required to certified for ACE cargo release.)",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "548",
    "narrativeText": "HTS Not Found on ADCVD Case; Confirm HTS",
    "explanation": "This is an informational message; not fatal. The case number reported in the 53 record, pos 3-12, does not inlcude the tariff number reported in the 50 record, pos 3-12.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "684",
    "narrativeText": "<eliminated>",
    "explanation": "n/a",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "685",
    "narrativeText": "Visa Number Required",
    "explanation": "This is an informational message; not fatal. A Standard Visa Number (51-Record) is required for the commodity/article. (Currently generated for certain Haitian textile articles.)",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "686",
    "narrativeText": "Matching Visa Number Not Found",
    "explanation": "This is an informational message; not fatal. The Standard Visa Number (51-Record) provided has not been found as a pre-established visa number in ACE.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "687",
    "narrativeText": "Lic/Cert/Perm Required",
    "explanation": "A License Number/ Certificate Number / Permit Number (52-Record) is required for one or more of the HTS numbers cited on the ES line. For the specific License/Certificate/ Permit Type Code submitted, the corresponding licensing agency does not grant an exception. (Note this is the fatal version of 688.)",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "688",
    "narrativeText": "Lic/Cert/Perm for HTS Missing",
    "explanation": "This is an informational message; not fatal. A License Number/ Certificate Number / Permit Number (52-Record) is required for one or more of the HTS numbers cited on the ES line. For the specific License/Certificate/ Permit Type Code submitted, the corresponding licensing agency does not (currently) strictly require the number.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "690",
    "narrativeText": "Lic/Cert/Perm Code Not Allowed for HTS",
    "explanation": "The License Number/ Certificate Number / Permit Number submitted (52-Record) is not allowed for any of the HTS numbers on the ES line.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "691",
    "narrativeText": "Lic/Cert/Perm Number Unknown",
    "explanation": "The License Number/ Certificate Number / Permit Number submitted (52-Record) is not formatted correctly.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "692",
    "narrativeText": "Matching Lic/Cert/Perm Number Not Found",
    "explanation": "This is an informational message; not fatal. The License Number/ Certificate Number / Permit Number submitted (52-Record) has not been found as a pre-established identifier. For the specific License/Certificate/ Permit Type Code submitted, the corresponding licensing/issuing agency does not require an exact match.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "693",
    "narrativeText": "Matching Lic/Cert/Perm Number Not Found",
    "explanation": "The License Number/ Certificate Number / Permit Number submitted (52-Record) has not been found as a pre-established identifier. For the specific License/Certificate/ Permit Type Code submitted, the corresponding licensing/issuing agency requires an exact match. (Note this is the fatal version of 692.)",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "694",
    "narrativeText": "Duplicate Lic/Cert/Perm Number",
    "explanation": "The License Number/ Certificate Number / Permit Number submitted (52-Record) has already exceeded its usage on other Entry Summaries or Entry Summary lines; the corresponding licensing/issuing agency has set a usage limit on this specific instrument.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "695",
    "narrativeText": "Lic/Cert/Perm Number Previously Used",
    "explanation": "The License Number/ Certificate Number / Permit Number submitted (52-Record) has already been used on another Entry Summary; the corresponding licensing/issuing agency allows only a single use.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "696",
    "narrativeText": "Allowed Value Exceeded for Lic/Cert/Perm",
    "explanation": "The merchandise value of the Entry Summary line as it relates to the License Number/ Certificate Number / Permit Number submitted (52-Record) has exceeded the merchandise value limits set forth by the corresponding licensing/issuing agency.",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "B68",
    "narrativeText": "Remote Preparer Not Authrzd for Port",
    "explanation": "Note: Not yet implemented. The RLF port of entry in the B record, pos 4-7 has not been associated to the Entry Port Code (10-Record). (Previously this condition generated an X31 error.)",
    "dateUpdated": "2016-06-20"
  },
  {
    "conditionCode": "315",
    "narrativeText": "TIB Declaration Ind Not Allowed for Type",
    "explanation": "The TIB Declaration Indicator in the 10-Record, position 69, must be blank/space if the Entry Type Code is other than '23' (TIB).",
    "dateUpdated": "2015-12-07"
  },
  {
    "conditionCode": "316",
    "narrativeText": "TIB Declaration Ind Must be Y",
    "explanation": "The TIB Declaration Indicator in the 10-Record, position 69, must be 'Y' if the Entry Type Code is '23' (TIB).",
    "dateUpdated": "2015-12-07"
  },
  {
    "conditionCode": "680",
    "narrativeText": "FTZ Line Qty Not Allowed for Ent Type",
    "explanation": "If the entry type code is NOT '06' (FTZ) and position 10-19 of the 41-record contains a value, this error will result.",
    "dateUpdated": "2015-10-01"
  },
  {
    "conditionCode": "681",
    "narrativeText": "FTZ Line Qty Missing",
    "explanation": "If the entry type code is '06' (FTZ) and position 10-19 of the 41-record contains space/blank, this error will result.",
    "dateUpdated": "2015-10-01"
  },
  {
    "conditionCode": "682",
    "narrativeText": "FTZ Line Qty Contains Non-Numerics",
    "explanation": "If the entry type code is '06' (FTZ) and position 10-19 of the 41-record contains other than a numeric value, this error will result.",
    "dateUpdated": "2015-10-01"
  },
  {
    "conditionCode": "683",
    "narrativeText": "FTZ Line Qty Must be GT Zero",
    "explanation": "If the entry type code is '06' (FTZ) and position 10-19 of the 41-record contains all zeroes, this error will result.",
    "dateUpdated": "2015-10-01"
  },
  {
    "conditionCode": "107",
    "narrativeText": "Consignee Nbr Ineligible",
    "explanation": "Ultimate consignee numbers at the entry header level (11 rec, pos 15-26) must be in one of the acceptable formats listed in the ACE ABI CATAIR.  00-000000000 or 000-00-0000 are allowed to be used as an ultimate consignee number only if the entry type is 11 or 12 or if the entry summary is a consolidating summary.  For other entry types, this number is not allowed.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "135",
    "narrativeText": "Tax May Not Be Deferred - Entry Type",
    "explanation": "The deferred tax indicator is transmitted in the 10 record, pos 45. Type 2 in this field indicates an electronic funds transfer deferral has been arranged.  This option is not permitted for informal entries.  If code '2' is transmitted with entry type 11 or 12, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "142",
    "narrativeText": "Surety Cancelled",
    "explanation": "If the Surety reported in the 31-record, position 6-8, is considered as cancelled, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "143",
    "narrativeText": "Surety Revoked",
    "explanation": "If the Surety reported in the 31-record, position 6-8, is considered as revoked, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "149",
    "narrativeText": "Cargo Rlse Cert Not Authorized",
    "explanation": "The filer's ACS ABE record has not been updated to operational status for cargo release processing. This error will only occur when the filer has requested ACS cargo release certification - Cargo Release Certification Indicator = Y.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "156",
    "narrativeText": "Recon Issue Not Allowed - Quota",
    "explanation": "If the entry type code is 02 (Quota), and the Reconciliation Issue Code is '002', '004', '006', or '007', this error will result.\nIf the entry type code is 02 (Quota), ONLY a Reconciliation Issue Code of \u2018001\u2019 (Value), \u2018003\u2019 (Chapter 9802), or \u2018005\u2019 (Value and Chapter 9802) is allowed.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "163",
    "narrativeText": "Whrse Withdrwl Info Not Allowed",
    "explanation": "If warehouse data is transmitted in the 30 record for other than entry type code '3x' (withdrawals) and '22' (re-warehouse) this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "164",
    "narrativeText": "MOT Code Missing",
    "explanation": "The Mode of Transportation code (MOT) is required for entry types 01, 02, 03, 07, 21, 23, 51, and 52.  It is transmitted in the 10 record, pos 36-37.  If the code is omitted, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "185",
    "narrativeText": "BOL/In-Bond Number(s) Missing",
    "explanation": "If a 22-record is submitted in an AE, yet it is not followed by 1 or more 23-records this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "195",
    "narrativeText": "Dsgntd Exam Site Not Allowed/Ent Conflct",
    "explanation": "If the entry has been established in ACS, and that ACS entry shows a designated exam site but the DES transmitted in the entry summary does not match the one on file, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "229",
    "narrativeText": "Cnsldtn Not Allwd - Entry Type",
    "explanation": "If a consolidating entry summary claim is made ('Y' in 10 record, position 42) and the entry type code of the submission is neither 01, 11, or 06, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "242",
    "narrativeText": "Rlse Entry Dist Not = To Cnsldtd Dist",
    "explanation": "If the district code of the 32-record release entry number does not match the 'district' in the 10-record position 18-19, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "243",
    "narrativeText": "Rlse Entry Already Consolidated",
    "explanation": "If the 32-record release entry number is already consolidate to another entry summary, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "244",
    "narrativeText": "Rlse Entry 7-Day Period Exceeded",
    "explanation": "If the cargo release dates of the 32-record release entry numbers to not all fall within a 7-day period of each other, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "247",
    "narrativeText": "Rlse Entry Mot Mismatch",
    "explanation": "If the MOT codes of the 32-record release entry numbers are not all the same, this error will result. Note a release with no MOT code is not used in this comparison.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "255",
    "narrativeText": "Consignee Nbr missing",
    "explanation": "An ultimate consignee must be transmitted in the 11 record, pos 15-26. If this element is left blank, this error will result.  The consignee number is not required for an informal entry, type 11.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "257",
    "narrativeText": "Cnsldtn Not Allwd - Rejected Correction",
    "explanation": "If the entry summary is in CBP control, rejected, and is being submitted as a correction, if the filer has made a consolidated summary request ('Y' in the 10-Record, position 42), this error will result. A consolidating summary claim cannot be made after the summary is in CBP control. (Note that this does not change the consolidating claim / release list made while the summary was in trade control.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "290",
    "narrativeText": "Entry Type Not Allowed From Filer",
    "explanation": "If the entry type code is '51' (Military-DCMA), and the filer of the AE is other than an authorized DCMA filer code, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "291",
    "narrativeText": "Entry Type Not Allowed From Importer",
    "explanation": "If the entry type code is '51' (Military-DCMA), and the importer of record (11 record, pos 3-14) is other than the authorized DCMA importer ID, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "293",
    "narrativeText": "Assoc Wrhse Filer Code Missing",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 is blank/space this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "294",
    "narrativeText": "Assoc Wrhse Entry Number Missing",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 8-15 is blank/space this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "295",
    "narrativeText": "Assoc Wrhse Entry Dist/Port Missing",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 17-20 is blank/space this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "296",
    "narrativeText": "Final Wrhse Withdrawal Ind Must Be Y",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 21 is other than blank/space or 'Y' this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "297",
    "narrativeText": "Import Date Not Allowed On Re-Warehouse",
    "explanation": "If the date of importation on the 11 record, pos 48-53 is present and the entry type code is '22' (Re-warehouse), this error will result. Note that the Re-warehouse entry summary inherits the date of importation from the parent warehouse entry (i.e., the initial '21').",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "298",
    "narrativeText": "Assoc Wrhse Entry Not Found On File",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is not found as a previously established ACE entry summary, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "299",
    "narrativeText": "Assoc Wrhse Entry Not A Wrhse Entry",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE entry summary but its entry type code is neither '21' nor '22', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "300",
    "narrativeText": "Assoc Wrhse Entry Dist/Port Mismatch",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary but the 30 record pos 17-20 does not match that summary's district/port code, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "301",
    "narrativeText": "Assoc Wrhse Entry Finalized / Paid",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary but the found ACE entry summary has been 'paid', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "302",
    "narrativeText": "Assoc Wrhse Entry Has Liquidated",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary but the found ACE entry summary has been 'liquidated', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "303",
    "narrativeText": "Assoc Wrhse Entry Has Been Cancelled",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary but the found ACE entry summary has been 'cancelled', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "304",
    "narrativeText": "Assoc Wrhse Entry Period Has Expired",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary, but the 11 record position 42-47 (estimated entry date) is beyond the original '21' entry summary's date of importation by more than 5 years, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "305",
    "narrativeText": "Assoc Wrhse Entry Already Finalized",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary, and the found summary has already been 'finalized', and this AE filing is a 'new' withdrawal (not currently linked to the '21' or '22', this error will result. Once 'finalized' a 'new' withdrawal is not allowed be linked to the '21' or '22' entry summary. Once 'finalized' an 'existing' withdrawal (one already linked), can be modified, however.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "307",
    "narrativeText": "Assoc Wrhse Ent Nbr Cannot = Wd Ent Nbr",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 match the 10 records Filer Code / Entry Number this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "308",
    "narrativeText": "Assoc Wrhse Entry Has Been Inactivated",
    "explanation": "If the entry type code is '22', '31', '32', '34', or '38' and the 30 record pos 3-5 and 8-15 (filer code, entry number) is found as a previously established ACE '21' or '22' entry summary but the found ACE entry summary has been 'inactivated', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "309",
    "narrativeText": "Mot Not Allowed - Entry Type",
    "explanation": "If the entry type code is '3n' (warehouse withdrawal), and the 10 record pos 36-37 (MOT code) is present, this error will result. There entry types never allow transportation related information.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "311",
    "narrativeText": "Bond Detail Not Allowed - Entry Type",
    "explanation": "** Not currently generated **; bond detail is allowed on any entry summary.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "312",
    "narrativeText": "Elec Invoice Not Allowed \u2013 ACE Certify",
    "explanation": "Per the CATAIR: Until further notice, marking the 10 record pos 41 (Electronic Invoice Indicator) with a \u2018Y\u2019 (an EIP claim) is not allowed when the filer also specifies an \u2018A\u2019 in 10-Record Cargo Release Certification Request Indicator (Certify for ACE Cargo Release); if marked this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "412",
    "narrativeText": "Country of Export Cannot Be US",
    "explanation": "If the entry type is other than warehouse ('21'), re-warehouse ('22'), or warehouse withdrawal ('3n'), If the country of export is transmitted in the 40 record, pos 11-12, is \"US\", this error will result. 'US' is allowed as the C/E for '21', '22', and '3x'.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "441",
    "narrativeText": "Quantity/UOM Mismatch",
    "explanation": "50 record pos 36-50, pos 51-65, and pos 66-80 are used to report up to three quantity / UOM 'pairs'. For each pair, if the quantity is reported as zero, yet the UOM is reported as other than 'X' and does not match what is prescribed in HTS, this error will result. If the tariff number does not require a quantity, no UOM can be reported. [See 9802004040..no reporting quantity is attached to this tariff number, hence the UOM field must be blank].",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "442",
    "narrativeText": "UOM Mismatch",
    "explanation": "50 record pos 36-50, pos 51-65, and pos 66-80 are used to report up to three quantity / UOM 'pairs'. For each pair, if the quantity is reported greater than zero, yet the reported UOM does not match what is prescribed in HTS, this error will result. Note if the tariff number does not permit the reporting of a UOM (chapter 98 and 99 numbers, usually), this error will also result if the filer provides a UOM.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "443",
    "narrativeText": "Second quantity/UOM Missing",
    "explanation": "If the HTS number in the 50-record requires a 2nd quantity/UOM pair and it is missing, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "444",
    "narrativeText": "Third Quantity/Uom Missing",
    "explanation": "If the HTS number in the 50-record requires and 3rd quantity/UOM pair and it is missing, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "445",
    "narrativeText": "Duty Not Allowed - Set Component",
    "explanation": "If the 40 record pos 8 is a 'Y' (a component of a 'set'), 50 record pos 14-23 (duty) must be zero. Duty is only allowed to be reported on the 'set header'.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "454",
    "narrativeText": "1st Invoice Line Nbr Cannot Be Zero",
    "explanation": "If either 42 record pos 36-39 or pos 41-44 is zero, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "476",
    "narrativeText": "IR Tax Not Allowed - Set Header",
    "explanation": "If the 40 record pos 8 is an 'X' (the 'header' of a 'set'), a 60 record is not allowed. IR tax is only allowed to be reported on a 'set component'.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "478",
    "narrativeText": "Fee Not Allowed - Set Header",
    "explanation": "If the 40 record pos 8 is an 'X' (the 'header' of a 'set') a 62 record where the class code is an AMS fee is not allowed. An AMS fee is only allowed to be reported on a 'set component'.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "479",
    "narrativeText": "Mpf Not Allowed - Set Component",
    "explanation": "If the 40 record pos 8 is a 'Y' (a component of a 'set'), a 62 record where class code = '499' is not allowed. MPF is only allowed to be reported on the 'set header'.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "525",
    "narrativeText": "Addtnl Declaration Type Code Missing",
    "explanation": "If 54 record pos 3-4 contains space/blank, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "532",
    "narrativeText": "IR Tax Acct Class Code Unknown",
    "explanation": "If 60 record pos 3-5 contains a non-space value other than '016', '017', '018', or '022' this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "534",
    "narrativeText": "Mfgr Missing-Req'd For CA Import",
    "explanation": "If there is no 47 record where position 3 = M (Manufacturer) and the entry type is '22' (Re-warehouse) or '23' (TIB) and the line country or origin or country of export is 'Canada' , this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "670",
    "narrativeText": "FTZ Status Code Missing",
    "explanation": "If the entry type code is '06' (FTZ) and position 3 of the 41-record is blank (or the 41-record is not present) this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "671",
    "narrativeText": "FTZ Status Code Unknown",
    "explanation": "If the entry type code is '06' (FTZ) and position 3 of the 41-record is not P, N, or D, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "672",
    "narrativeText": "FTZ Filing Date Not Allowed For Ent Type",
    "explanation": "If the entry type code is NOT '06' (FTZ) and position 4-9 of the 41-record contains a value, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "673",
    "narrativeText": "FTZ Filing Date Not Allowed For Status",
    "explanation": "If the entry type code is '06' (FTZ) and position 3 of the 41-record is N or D, and position 4-9 of the 41-record contains a value, this error will result. (FTZ Filing Date only allowed when FTZ Status Code = P.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "674",
    "narrativeText": "FTZ Filing Date Missing",
    "explanation": "If the entry type code is '06' (FTZ) and position 3 of the 41-record is P, and position 4-9 of the 41-record is blank this error will result. (FTZ Filing Date required when FTZ Status Code = P.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "675",
    "narrativeText": "FTZ Filing Date Unknown",
    "explanation": "If the entry type code is '06' (FTZ) and position 3 of the 41-record is P, and position 4-9 of the 41-record is not a legitimate date this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "676",
    "narrativeText": "HTS Must Be TIB 9813",
    "explanation": "If the entry type code is '23' (TIB) and the first HTS number of an entry summary line does not begin with '9813' this error will result. (Note that the '9813' must always be accompanied by another HTS number.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "677",
    "narrativeText": "HTS Must Be Emergency War Materials",
    "explanation": "If the entry type code is '51' (Military-DCMA) and the first HTS number of an entry summary line is not '9808.00.3000' this error will result. (Note that the '9808.00.3000' must always be accompanied by another HTS number.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "678",
    "narrativeText": "FTZ Status Code Not Allowed For Ent Type",
    "explanation": "If the entry type code is NOT '06' (FTZ) and position 3 of the 41-record contains a value, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "679",
    "narrativeText": "Fee Not Allowed - Entry Type",
    "explanation": "If the entry type code is '23' (TIB) and a 62 record is submitted with an AMS (e.g., '053' - Beef fee), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "701",
    "narrativeText": "Grand Totals Missing",
    "explanation": "If the 90 record is not present in an 'add' or 'replace' AE transaction, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "734",
    "narrativeText": "Acct Class Code Unknown For Tot",
    "explanation": "If an Accounting Class Code on an 89 record is not a known header or line level fee code, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "750",
    "narrativeText": "OGA DT Reporting Conflict",
    "explanation": "This is a transitional error that will be in effect until the ACS EI transaction is decommissioned. It occurs for the following reasons:\n\n- DT records are included and the filer has marked the Cargo Release Certification Indicator = \u2018A\u2019 (ACE request) or 'space' (no cargo release certification request).\n- DT records are included and the filer has marked the Cargo Release Certification Indicator = \u2018Y\u2019 (ASC request) but the cargo has been already released by a BRASS, FAST, or rail line release program or there is an ACE entry on file.\n\nDT records can ONLY be imbedded in an ACE AE when the filer certifies for ACS cargo release ('Y') and there is no conflict with a previous line release or ACE release. The filer should use the PGA message set (NOT the DT records) in the AE to transmit required DOT information if the filer is certifying for ACE cargo release.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "751",
    "narrativeText": "Known Importer Ind Must Be Y",
    "explanation": "If 10 record position 67 is other than space/blank or 'Y', this error will result",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "752",
    "narrativeText": "No STB Found for Filer/Entry Number",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was not established in the eBond system prior to the filing, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "753",
    "narrativeText": "STB In Void Status",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, but is in a void status, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "754",
    "narrativeText": "STB Bond Designation Type Do Not Match",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, but the 31 record position 4 Bond Designation Type Code does not match the eBond on file, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "755",
    "narrativeText": "STB Entry Type Do Not Match",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, but the 10 record entry type code does not match the eBond on file, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "756",
    "narrativeText": "STB Amounts Do Not Match",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, but the 31 record position 9-18 Single Transaction Bond Amount does not match eBond on file, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "757",
    "narrativeText": "No STB Found For Importer",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, but the 11 record position 3-14 Importer of Record was not found as a Principal, co-Principal or user on the eBond on file, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "758",
    "narrativeText": "Importer No Longer Valid For STB",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and the 10 record entry number was established in the eBond system prior to the filing, and the 11 record position 3-14 Importer of Record was found as a Principal, co-Principal or user on the eBond on file, but has expired as the active user, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "759",
    "narrativeText": "Basic, Supersed/Substitute Bond Missing",
    "explanation": "If 31 record position 3 Bond Type Code = '9' (STB) and 31 record position 4 Bond Designation Type Code neither 'B' nor 'U' nor 'E', this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "760",
    "narrativeText": "TIB Period Has Expired",
    "explanation": "When no ES exists or an existing ES is in trade control, if entry type is '23' (TIB): \n\nIf any line contains 9813.00.75, if the submitted import date (10 record pos 48-53) is more than 6 months earlier than the AE submission date, this error will result. \n\nIf no line contains 9813.00.75, if the submitted import date (10 record pos 48-53) is more than 12 months earlier than the AE submission date, this error will result.  \n \nWhen an existing ES is in CBP control, if entry type is '23' (TIB): \n\nIf any line contains 9813.00.75, if the submitted import date (10 record pos 48-53) is more than 6 months earlier than the original create date of the ES, this error will result. \n\nIf no line contains 9813.00.75, if the submitted import date (10 record pos 48-53) is more than 12 months earlier than the original create date of the ES, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "761",
    "narrativeText": "Bond Cannot Be Waived for Non-CA Artcles",
    "explanation": "When the entry type is '23' (TIB) and the 10 record position 38 = '0' (bond waived), if any submitted line's country of origin is other than 'CA' or a Canadian Province Code, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A05",
    "narrativeText": "Loop Exceeded-Cargo Manifest Details",
    "explanation": "The cargo manifest grouping consists of a 22 record followed by up to 23 records.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A07",
    "narrativeText": "Loop Exceeded-Release Details",
    "explanation": "The consolidated release grouping consists of a 32-record.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A08",
    "narrativeText": "Loop Exceeded-Line Items",
    "explanation": "The line item grouping consists of a 40-record and numerous lower level groupings.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A09",
    "narrativeText": "Loop Exceeded-Invoice Reference Details",
    "explanation": "The EIP invoice grouping  consists of a 42-record followed conditionally by 43-, and 44-records.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A10",
    "narrativeText": "Loop Exceeded-Commercial Descriptions",
    "explanation": "The commercial description grouping consists of a 44-record.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A11",
    "narrativeText": "Loop Exceeded-Tariff/Value/Qty Details",
    "explanation": "The tariff grouping consists of a 50-record, followed conditionally by PGA data groupings.  If this looping configuration is exceeded (more than 8 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A12",
    "narrativeText": "Loop Exceeded-DOT HS-7 Lines",
    "explanation": "The DOT grouping consists of a conditional OI-record, followed by DT01-, DT02-records.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A13",
    "narrativeText": "Loop Exceeded-DOT HS-7 Vehicles",
    "explanation": "The DOT vehicle grouping consists of a DT03-record.  If this looping configuration is exceeded (more than 9,999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A15",
    "narrativeText": "Loop Exceeded-FDA 701 Lines",
    "explanation": "The FDA grouping consists of a conditional OI-record, followed by FD01-, FD02-, FD03-, FD04-records.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A16",
    "narrativeText": "Loop Exceeded-FDA 701 Act\u2019s",
    "explanation": "The FDA affirmation of compliance grouping consists of a FD05-record.  If this looping configuration is exceeded (more than 999 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A18",
    "narrativeText": "Loop Exceeded-Add/Cvd Case Details",
    "explanation": "The AD/CVD case grouping consists of a 53-record.  If this looping configuration is exceeded (more than 2 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A19",
    "narrativeText": "Loop Exceeded-Line User Fee Details",
    "explanation": "The line user fee grouping consists of a 62-record.  If this looping configuration is exceeded (more than 5 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "A20",
    "narrativeText": "Loop Exceeded-Fee Total Details",
    "explanation": "The fee total grouping consists of an 89-record.  If this looping configuration is exceeded (more than 9 records), this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B05",
    "narrativeText": "Entry Filer Missing",
    "explanation": "The filer code is transmitted in the 10 record, pos 4-6.  The field cannot be left blank or this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B15",
    "narrativeText": "Entry Number Must Be Numeric",
    "explanation": "The entry number is transmitted in the 10 record, pos 9-16.  The value must be numeric or this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B18",
    "narrativeText": "Entry Type Code Unknown",
    "explanation": "The entry type code is required to be transmitted in every AE transaction.  It is transmitted in the 10 record, pos 34-35.  If this code is not one of the recognized entry types, this error will result. AE now accepts the following entry type codes: 01, 02, 03, 06, 07, 11, 12, 21, 22, 23, 31, 32, 34, 38, 51, and 52.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B23",
    "narrativeText": "RLF Not Allowed - Non RLF Entry Filed",
    "explanation": "An ACE summary may not be transmitted as RFL if a pre-existing, accepted, ACS non-RLF entry is on file in ACS. (Note this validation is not in place for an ACE entry.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B28",
    "narrativeText": "Action Not Allowed - Already Cnsldtd",
    "explanation": "The entry number transmitted to ACE (in the AE) has been used as a release entry that is already consolidated to another summary.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B33",
    "narrativeText": "Ent Typ Chng Not Allowed Post Acceptance",
    "explanation": "Once an ACE entry summary has been paid in (or accepted if no money is due) via statement/ACH acceptance, a retransmission of the summary can conditionally be used to change the entry type, even if the entry has been put into rejected status. However there are limitations. If the change is not allowed, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B37",
    "narrativeText": "RLF Not Allowed - Line Release",
    "explanation": "An RLF entry is not allowed if the entry number used refers to an 'entry' where the cargo has been released via a \u2018line release\u2019 program; namely Border Release Advanced Screening and Selectivity (BRASS), Free and Secure Trade (FAST) or Rail Line Release.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B49",
    "narrativeText": "PSC Not Allowed - Cannot Be Informal",
    "explanation": "A PSC filing with entry type 11 or 12 is not permitted.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B55",
    "narrativeText": "Action not allowed - ES in Use by CBP",
    "explanation": "An entry summary cannot be accepted if the ACE system is currently processing (or otherwise holding) the records. If this occurs, wait a few minutes and try again.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B64",
    "narrativeText": "PSC Entry Type Change Not Allowed",
    "explanation": "A PSC submission of the summary can conditionally be used to change the entry type. However there are limitations. If the change is not allowed, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B65",
    "narrativeText": "Type Chg Not Allwd - Withdrwl(s) Linked",
    "explanation": "If the filer attempts to change the entry type of an entry summary (in Trade Control) with an entry type code of \u201821\u2019 (Warehouse) or \u201822\u2019 (Re-Warehouse) and there have been one or more Warehouse Withdrawal ES\u2019s made against it, this error will result. (The filer could 'delete' the linked Warehouse Withdrawals and then change the type, if needed.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "B66",
    "narrativeText": "Delete Not Allwd - Withdrwl(s) Linked",
    "explanation": "If the filer attempts to delete an entry summary with an entry type code of \u201821\u2019 (Warehouse) or \u201822\u2019 (Re-Warehouse) and there have been one or more Warehouse Withdrawal ES\u2019s made against it, this error will result. (The filer could 'delete' the linked Warehouse Withdrawals and then delete the ES, if needed.)",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q03",
    "narrativeText": "Quota Filled",
    "explanation": "An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If an entry summary line is subject to quota and the CBP Quota module for that quota master record has a status of Filled, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q04",
    "narrativeText": "Quota Filled Or Expired",
    "explanation": "An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If an entry summary line is subject to quota and the CBP Quota module for that quota master record has a status of Expired, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q05",
    "narrativeText": "Banned Import",
    "explanation": "An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If an entry summary line is subject to quota and the CBP Quota module for that quota master record has a status of Banned, this error will result. The tariff numbers cannot be used for that country.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q06",
    "narrativeText": "Quota On Hold",
    "explanation": "This is an informational message; not fatal.  An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If an entry summary line is subject to quota and the CBP Quota module for that quota master record has a status of Hold, this informational message will result. Processing of the quota lines will not occur until the Quota Branch removes the hold.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q07",
    "narrativeText": "Quota Potentially Filled",
    "explanation": "This is an informational message; not fatal. An entry summary line is subject to quota based on the  tariff numbers, country of origin, and presentation date. If an entry summary line is subject to quota and the CBP Quota module for that quota master record has a status of Potentially Filled, this informational message will result. The Potentially Filled status is set when the quota allocation reaches a certain threshold, usually 95%.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q08",
    "narrativeText": "Quota Process Pending",
    "explanation": "This is an informational message; not fatal. This informational message will result for all quota lines. Quota is processed after close of business for all ports. Quota lines will be processed if the goods have been arrived in the manifest system, the entry summary has been accepted, and the entry summary is either schedule for a statement or is fully paid. Once quota is processed, a UC message will be sent to the filer indicating whether quota has been accepted, rejected, or reserved for proration (partially accepted).",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q09",
    "narrativeText": "Quota Not Allowed For Entry Type",
    "explanation": "If a line on the entry summary is subject to quota and the entry type is a Type 01, 03, 11, 31, or 34, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q10",
    "narrativeText": "Line Subject Quota",
    "explanation": "This is an informational message; not fatal.  If the line has tariff numbers and a country of origin that are subject to quota, this informational message will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q11",
    "narrativeText": "Quota Not Scheduled Pending Payment",
    "explanation": "This is an informational message; not fatal.  If the payment type code in the 10 record, position 51 is 1 (Individual Payment) and payment has not been received, this informational message will result. The quota lines will not be processed until payment is received.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q12",
    "narrativeText": "Quota Not Scheduled Pending Arrival",
    "explanation": "This is an informational message; not fatal.  If the manifest for the entry summary has not been arrived in the manifest system, this informational message will result. The quota lines will not be processed until the manifest has been arrived.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q20",
    "narrativeText": "License Number Unknown",
    "explanation": "If the license type in the 52 record, position 3-4 is 14 (Agricultural License), the license number in the 52 record, position 5-14 must match a license number in the USDA License Quota module. If the license number does not exist in the USDA License Quota module, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q21",
    "narrativeText": "Quantity Not Allowed For License",
    "explanation": "If the license type in the 52 record, position 3-4 is 14 (Agricultural License) and the license number in the 52 record, position 5-14 is a valid USDA license, the quantity in the 50 record, position 36-47 cannot exceed the amount available on the license. If the quantity for the line exceeds the amount available on the USDA license, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q22",
    "narrativeText": "HTS Nbr Not Allowed For License",
    "explanation": "If the license type in the 52 record, position 3-4 is 14 (Agricultural License) and the license number in the 52 record, position 5-14 is a valid USDA license, the HTS number in the 50 record, position 3-12 must be an HTS number associated with that license number. If the HTS number does not apply to that license, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q23",
    "narrativeText": "Country Not Allowed For License",
    "explanation": "If the license type in the 52 record, position 3-4 is 14 (Agricultural License) and the license number in the 52 record, position 5-14 is a valid USDA license, the country or origin in the 40 record, position 9-10 must be a  country associated with that license number. If the country of origin does not apply to that license, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "Q24",
    "narrativeText": "Importer Not Allowed For License",
    "explanation": "If the license type in the 52 record, position 3-4 is 14 (Agricultural License) and the license number in the 52 record, position 5-14 is a valid USDA license, the importer of record number in the 11 record, position 3-14 must be an IR# associated with that license number. If the IR# does not apply to that license, this error will result.",
    "dateUpdated": "2015-07-24"
  },
  {
    "conditionCode": "145",
    "narrativeText": "Reported Surety/Bond Surety Mismatch",
    "explanation": "The surety code reported in the 31 record, pos 6-8, does not agree with the surety code listed in the ACCOUNTS tab for the importer of record number for a current, active bond.  If bond information appears correct in ACE and/or ACS, it is possible that the DB2 tables are incorreclty coding the bond status.  Notify your CBP client representative.",
    "dateUpdated": "2015-01-22"
  },
  {
    "conditionCode": "B29",
    "narrativeText": "Entry Summary Under CBP Control",
    "explanation": "A retransmission of an ACE Entry Summary that has appeared on a statement will receive this error if: 1) Entry Summary was not deleted from statement or a new future statement date was not requested in an HP transaction in ACS;  2) Entry Summary is paid, that is a collection has been received;  3) or the Entry Summary is under CBP Review.  Filers can identify an Entry Summary under CBP review as they have received one or more UC messages for the Entry Summary indicating that documents are required.\n\nIf conditions 2 or 3 apply, the filer must have the CBP port reject the entry summary back to them or file a PSC in order to replace the ES in ACE.  \nIf condition 1 applies, the filer may delete the entry summary from statement in ACS (move it to a future statement or make it single pay) \u2013 this will move the ES back to trade control in ACE and then it can be replaced by the filer until it once again appears on statement (or is paid).",
    "dateUpdated": "2015-01-20"
  },
  {
    "conditionCode": "S01",
    "narrativeText": "10 Record Missing",
    "explanation": "This error will occur when a transaction is submitted which does not include a 10 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S02",
    "narrativeText": "10 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than 999 10 records within one B-Y Block.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S03",
    "narrativeText": "Bad Input Record",
    "explanation": "This error will occur when a transaction is submitted with a record not supported in the eBond CB Implementation Guide (IG).",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S04",
    "narrativeText": "Bond Desig Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a space in the Designation Type Code or a code not valid per the Implementation Guide.  The only acceptable codes are: 'B','A','V','C','U','E', 'R', or 'T'.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S05",
    "narrativeText": "Bond Type Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a space in the Bond Type Code or a code not valid per the Implementation Guide.  The only acceptable codes are: '8' or '9'.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S07",
    "narrativeText": "Cannot Add STB Already On-File  For Tran",
    "explanation": "This error will be returned when the transaction is submitted:\n- with Bond Type of '9' and the Designation Type Code is 'B', but a bond already exists for the Transaction ID.\n- with Bond Type of '9' and the Designation Type Code is 'U', but a bond with a  Designation Type Code = 'U' already exists for the Transaction ID and it is not in void status.\n- with Bond Type of '9' and the Designation Type Code is 'U', but a bond with a  Designation Type Code =  'E' already exists for the Transaction ID and it is not in void status.\n- with Bond Type of '9' and the Designation Type Code is 'E', but a bond with a  Designation Type Code = 'U' already exists for the Transaction ID and it is not in void status.\n- with Bond Type of '9' and the Designation Type Code is 'E', but a bond with a  Designation Type Code =  'E' already exists for the Transaction ID and it is not in void status.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S08",
    "narrativeText": "STB Already Matched To Transaction",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Designation Type Code is \u2018V\u2019, but the bond / transaction match has already occurred.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S09",
    "narrativeText": "STB Already Void",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Designation Type Code is \u2018V\u2019 or 'C', but the STB has already been 'Void'.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S10",
    "narrativeText": "STB Not Matched To Transaction",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Designation Type Code is \u2018U\u2019 or 'E', but the bond / transaction match has not occurred.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S11",
    "narrativeText": "Action Not Allowed After Entry Summary",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Designation Type Code is \u2018U', the bond / transaction match has occurred, but the Entry Summary has been filed.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S12",
    "narrativeText": "Not Allowed Entry Filed Over 90 Days Ago",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9', the Designation Type Code is \u2018E\u2019, and the Transaction ID Type Code = '1', but the Entry Create Date is over 90 days ago.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S13",
    "narrativeText": "Cont Bond Already Terminated",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '8' and the Designation Type Code is \u2018T\u2019, but the bond has already been 'Terminated'.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S14",
    "narrativeText": "Bond Activity Type Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with the Bond Activity Type Code:\n- with a space\n- with a code not valid per the IG.\n- with a code not valid to be used with the Bond Type Code submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S15",
    "narrativeText": "Bond Amount Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with all spaces or all zeros in the Bond Amount.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S16",
    "narrativeText": "Execution Date Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with the Execution Date:\n- with all spaces\n- with a date in format other than MMDDYY\n- with a date that is after the Effective Date and the Bond Type is '8'.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S17",
    "narrativeText": "Effective Date Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '8' and the Effective Date:\n- with all spaces\n- with a date in format other than MMDDYY\n- with a date that is before the Execution Date in positions 18-23 of the 10 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S18",
    "narrativeText": "Effective Date Not Used For STB",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Effective Date in positions 33-38 is not space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S19",
    "narrativeText": "Not Used With Bnd Typ",
    "explanation": "This error will occur when a transaction is submitted with the Bond Type of '9' and the Termination Date is not space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S20",
    "narrativeText": "Not Used With This Bnd Desig Typ Code",
    "explanation": "This error will occur when a transaction is submitted with a field that is not used with the Bond Designation Type Code submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S21",
    "narrativeText": "Termination Date Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with the Termination Date that is not formatted correctly or is before the Effective Date in positions 33-38 of the 10 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S22",
    "narrativeText": "Bond Number Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with the Designation Type Code of \u2018V\u2019,'R', 'C', or 'T' and the Bond Number is space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S23",
    "narrativeText": "Bond Number Not On-File",
    "explanation": "This error will occur when a transaction is submitted with the Designation Type Code of \u2018V\u2019, 'C', 'R', or 'T' and the Bond Number submitted in positions 45-54 of the 10 record is not on-file in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S24",
    "narrativeText": "20 Record Not Used For Cont Bonds",
    "explanation": "This error will occur when a transaction is submitted with the Bond Type of '8' and the 20 record is submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S25",
    "narrativeText": "20 Record Missing",
    "explanation": "This error will occur when a transaction is submitted with a Bond Designation Type Code = 'B','A','U', or 'E' and Bond Type = '9', but the 20 record is not included.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S26",
    "narrativeText": "20 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than one 20 record per 10 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S27",
    "narrativeText": "Trans Id Type Cd Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '9' and the Transaction ID Type Code in position 3 is space filled or contains anything other than the allowed codes for Transaction ID Type Code.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S28",
    "narrativeText": "Entry Typ Required For Trans Id Typ",
    "explanation": "This error will occur when a transaction is submitted with the Transaction ID Type Code = '1' and the Entry Type in positions 4-5 space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S29",
    "narrativeText": "Entry Typ Not Used For Trans Id Typ",
    "explanation": "This error will occur when a transaction is submitted with the Transaction ID Type Code not equaled to '1' and the Entry Type in positions 4-5 is not space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S30",
    "narrativeText": "Trans Id Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a Transaction ID that is space filled or is not in a valid format.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S31",
    "narrativeText": "30 Record Missing",
    "explanation": "This error will occur when a transaction is submitted with the Designation Type Code of \u2018B\u2019,'A','U',or 'E' and the 30 record is not submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S32",
    "narrativeText": "Princ Id Num Type Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a valid 30 record and the Principal ID Number Type is space filled or contains anything other than the allowed codes.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S33",
    "narrativeText": "Princ Id Num Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a Principal ID Number that is space filled or is not in a valid format.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S34",
    "narrativeText": "Princ Id Num Not In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Principal ID Number that is not on file in ACE/does not have an ACE Importer Account.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S35",
    "narrativeText": "Princ Id Num Not Active In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Principal ID Number that is not active in ACE/has an ACE Importer Account, but it is not active.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S36",
    "narrativeText": "Name Must Be Space Filled",
    "explanation": "This error will occur when a transaction is submitted with a Principal Name, Co-Principal Name, Bond User Name, Surety Name, or Co-Surety Name that is not space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S37",
    "narrativeText": "35 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than 99 35 records per 30 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S38",
    "narrativeText": "Co-Princ Id Num Type Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a valid 35 record and the Co-Principal ID Number Type is space filled or contains anything other than the allowed codes.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S39",
    "narrativeText": "Co-Princ Id Num Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a Co-Principal ID Number that is space filled or is not in a valid format.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S40",
    "narrativeText": "Co-Princ Id Num Not In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Co-Principal ID Number that is not on file in ACE/does not have an ACE Importer Account.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S41",
    "narrativeText": "Co-Princ Id Num Not Active In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Co-Principal ID Number that is not active in ACE/has an ACE Importer Account, but it is not active.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S42",
    "narrativeText": "Duplicate Co-Principal Id Number",
    "explanation": "This error will occur when a transaction is submitted with a Co-Principal ID Number that is a duplicate of another Co-Prinicipal ID Number submitted for the same bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S43",
    "narrativeText": "36 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than 999 36 records per 30 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S44",
    "narrativeText": "Bnd Usr Id Num Type Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a valid 36 record and the Bond User ID Number Type is space filled or contains anything other than the allowed codes.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S45",
    "narrativeText": "Bnd Usr Id Num Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a Bond User ID Number that is space filled or is not in a valid format.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S46",
    "narrativeText": "Bnd Usr Id Num Not In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Bond User ID Number that is not on file in ACE/does not have an ACE Importer Account.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S47",
    "narrativeText": "Bnd Usr Id Num Not Active In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Bond User ID Number that is not active in ACE/has an ACE Importer Account, but it is not active.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S48",
    "narrativeText": "Duplicate Bond User Id Number",
    "explanation": "This error will occur when a transaction is submitted with a Bond User ID Number that is a duplicate of another Bond User ID Number submitted for the same bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S49",
    "narrativeText": "40 Record Missing",
    "explanation": "This error will occur when a transaction is submitted with the Designation Type Code of \u2018B\u2019,'A','U',or 'E' and the 40 record is not submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S50",
    "narrativeText": "Surety Code Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with a Surety Code that is space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S51",
    "narrativeText": "Surety Code Not In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Surety Code that is not on file in ACE/does not have an ACE Surety Account.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S52",
    "narrativeText": "Agent Id Num Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with an Agent ID Number that is space filled or is not in a valid format.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S53",
    "narrativeText": "Agent Id Num Not In ACE",
    "explanation": "This error will occur when a transaction is submitted with an Agent ID Number that is not on file in ACE/does not have an Agent ID Number in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S54",
    "narrativeText": "Agent Id Num Not POA For Surety In ACE",
    "explanation": "This error will occur when a transaction is submitted with an Agent ID Number that is not assigned to the Surety Code submitted in positions 3-5 in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S55",
    "narrativeText": "Duplicate Co-Surety Code",
    "explanation": "This error will occur when a transaction is submitted with a Co-Surety Code that is a duplicate of another Co-Surety Code submitted for the same bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S56",
    "narrativeText": "Surety Liability Required With Co-Surety",
    "explanation": "This error will occur when a transaction is submitted with a 45 record for a Co-Surety, but the Surety Liability Amount data element in the 40 record is space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S57",
    "narrativeText": "Surety/Co-Sur Code Not On File For Bond",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code is 'C\u2019 and the Co-Surety Code is submitted, but it is not a Co-Surety code already on file for the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S58",
    "narrativeText": "Co-Princ Id Num Cannot Equal Co-Princ Id Nu",
    "explanation": "This error will occur when a transaction is submitted with a valid 35 record and the Co-Principal ID Number is equal to the Principal ID Number in the 30 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S59",
    "narrativeText": "Bnd Usr Id Num Cannot Equal Princ Id Num",
    "explanation": "This error will occur when a transaction is submitted with a valid 36 record and the Bond User ID Number is equal to the Principal ID Number in the 30 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S60",
    "narrativeText": "Bnd Usr Id Num Cannot Equal Co-Princ Id",
    "explanation": "This error will occur when a transaction is submitted with a valid 36 record and the Bond User ID Number is equal to the Co-Principal ID Number in the 35 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S61",
    "narrativeText": "Co-Surety Cannot Equal Surety Code",
    "explanation": "This error will occur when a transaction is submitted with a valid 45 record and the Co-Surety Code is equal to the Surety Code in the 40 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S62",
    "narrativeText": "12 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than one 12 record per 10 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S63",
    "narrativeText": "Invalid SNP - XXXXXXXXX",
    "explanation": "This error will occur when a transaction is submitted with the 12 record, but the first Secondary Notify Party in positions 3 to 11 is not be provided.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S64",
    "narrativeText": "Invalid SNP Profile - XXXXXXXXX",
    "explanation": "This error will occur when a transaction is submitted with the 12 record, but the Secondary Notify Party (SCAC, FIRMS, or ABI Routing Code) does not have a valid EDI profile in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S65",
    "narrativeText": "Bond Desig Requires ACE Entry On File",
    "explanation": "This error will occur when a transaction is submitted with Designation Type Code = \u2018A\u2019 and Transaction ID Type Code = 1, but no entry is on file in ACE for the Transaction ID/Entry # submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S66",
    "narrativeText": "30 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than one 30 record per 10/20 record combination.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S67",
    "narrativeText": "40 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than one 40 record per 10/20 record combination.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S68",
    "narrativeText": "45 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than 99 45 records per 10/20 record combination.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S69",
    "narrativeText": "Action Not Allowed Before Cargo Release",
    "explanation": "This error will occur when a transaction is submitted with Bond Type = '9', the Designation Type Code = 'U',  and the Transaction ID Type Code = '1', but the cargo has not been released in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S70",
    "narrativeText": "Entry Typ Not Valid With Bond Actvty",
    "explanation": "This error will occur when a transaction is submitted with Bond Type = '9',  Bond Activity Code = '1A', and the Entry Type Code in positions 4-5 of the 20 do not = 41-46.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S71",
    "narrativeText": "Out Of Sequence Record Found",
    "explanation": "This error will occur when the record sequencing does not following the Input Message Structure Map in the Implementation Guide based on the Bond Designation Type Code submitted.  If records are submitted out of that order, the submission is invalid.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S72",
    "narrativeText": "Id Num Must Match Princ Or Co-Princ Num",
    "explanation": "This error will occur when a transaction is submitted with Bond User ID Number Type is 'EI', but the first nine numbers do not match that of the Principal ID Number in the 30 record or that of any of the Co-Principal ID Numbers in the 35 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S73",
    "narrativeText": "Bnd Amount Must Equal Sum Of Surety Liab",
    "explanation": "This error will occur when a transaction is submitted with the bond designation type code = 'B', 'A', 'U', '\u2018E\u2019, or 'C', the 45 record is submitted, and the Bond Amount does not equal the sum of the Surety Liability Amount (40 Record) and the Co-Surety Liability Amounts (45 records).",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S74",
    "narrativeText": "Cannot Term Bond Not In Active Status",
    "explanation": "This error will occur when a transaction is submitted with Bond Type of '8' and the Designation Type Code is \u2018T\u2019, but the bond status is not active in ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S75",
    "narrativeText": "Surety Code Not Active In ACE",
    "explanation": "This error will occur when a transaction is submitted with a Surety Code that is on file in ACE, but not active.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S76",
    "narrativeText": "Surety Liability Amount Invalid",
    "explanation": "This error will occur when a transaction is submitted with the 45 record, but the Surety Liability Amount data element is not numeric or is not greater than zero.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S77",
    "narrativeText": "Must Be Space Filled With Bond Desig Typ",
    "explanation": "A field is required to be space filled with the bond designation type code submitted..",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S78",
    "narrativeText": "Actn Not Allowed Before Ace Entry Filed",
    "explanation": "This error will occur when a transaction is submitted with Designation Type Code = \u2018E\u2019, Transaction ID Type Code = 1, and the entry is on file in the ENTRY table, but the Entry Create Date is greater than today.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S79",
    "narrativeText": "Invalid Entry Type",
    "explanation": "This error will occur when a transaction is submitted with an invalid Entry Type in positions 4-5 of the 20 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S80",
    "narrativeText": "Not Allowed Not Original Filer Of Bond",
    "explanation": "This error will occur when a transaction is submitted with bond designation type code = 'V', 'T', 'C', or 'R', but the Filer in the B record is not the original Filer of the Bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S81",
    "narrativeText": "Rider Not Allowed Due To Bond Status",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code is 'R', but the existing bond is not in On File, Active, or Matched status in ACE,",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S82",
    "narrativeText": "Invalid Recon Flag",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the Reconciliation Bond Rider Flag data element contains anything other than Y, N, or space.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S83",
    "narrativeText": "Invalid Recon Rider Action Request",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the Reconciliation Bond Rider Flag is 'Y', but the Recon Flag has already been set\nor the Bond Designation Type Code is 'R' and Reconciliation Bond Rider Flag is 'N', but the Recon Flag has aleady been removed.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S84",
    "narrativeText": "Invalid USVI Flag",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the USVI Bond Rider Flag data element contains anything other than Y or space.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S85",
    "narrativeText": "Invalid USVI Rider Action Request",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the USVI Bond Rider Flag is 'Y', but the USVI Bond Rider Flag has already been set on the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S86",
    "narrativeText": "Invalid User Rider Action Code",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R', the 36 Record is submitted, and the User Rider Action Code data element contains anything other than A or D.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S87",
    "narrativeText": "Cannot Delete Bnd Usr Not On-File",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the User Rider Action Code data element contains a 'D', but the User specified is not on file for the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S88",
    "narrativeText": "Cannot Delete Bnd Usr Already Deleted",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the User Rider Action Code data element contains a 'D', but the User specified has already been deleted from the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S89",
    "narrativeText": "Cannot Add Bnd Usr Aleady On-File",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and User Rider Action Code data element contains an 'A', but the User specified is already on the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S90",
    "narrativeText": "Not Used With This Usr Rider Action Code",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R', the User Rider Action Code = 'D', but the User Add Date in positions 59-64 of the 36 is not space filled or with Bond Designation Type Code = 'R', the User Rider Action Code = 'A', but the User Delete Date in positions 65-70 of the 36 is not space filled.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S91",
    "narrativeText": "User Add Date Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the User Rider Action Code data element contains an 'A', but the User Add Date is space filled, contains a date in a format other than MMDDYY for CATAIR, or contains a date that is not equal to or greater than the Execution Date submitted.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S92",
    "narrativeText": "User Delete Date Invalid Or Missing",
    "explanation": "This error will occur when a transaction is submitted with Bond Designation Type Code = 'R' and the User Rider Action Code data element contains a 'D', but the User Delete Date is space filled, contains a date in a format other than MMDDYY for CATAIR, or contains a date that is not at least 10 days from the Execution Date.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S93",
    "narrativeText": "Bnd Amt Exceeds Surety Underwriting Lmt",
    "explanation": "This error will occur when a transaction is submitted with the bond designation type code = 'B', 'A', 'U', '\u2018E\u2019, or 'C', only the 40 record is submitted, and the Bond Amount is greater than the Surety's Underwriting Limit.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S94",
    "narrativeText": "Bnd Amt Exceeds Sum Of Underwriting Lmts",
    "explanation": "This error will occur when a transaction is submitted with the bond designation type code = 'B', 'A', 'U', '\u2018E\u2019, or 'C', at least one 45 record is submitted, and the Bond Amount is greater than the sum of the Underwriting Limits of the Surety (40 Record) and the Co-Surety(s) (45 records).",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S95",
    "narrativeText": "Not Authorized To Transmit For Surety",
    "explanation": "This error will be returned when the transaction is submitted:\n- the Surety Agent Filer Code located in positions 8-10 of the B record has not been authorized to transmit bonds on behalf of the surety.\n- the Surety Agent Filer Code located in positions 8-10 of the B record has not been authorized to transmit bonds on behalf of the co-surety.\n- the Surety Agent Filer Code located in positions 8-10 of the B record has not been authorized to transmit bonds on behalf of the re-insurer.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S96",
    "narrativeText": "Acnnot Add Bond Already On-file For IR",
    "explanation": "This error will be returned when the transaction is submitted:\n- with Bond Type of '8' and the Designation Type Code is 'B', but the Princ IR # submitted already has an active bond on file in ACE for the Bond Activity Type Code.\n- with Bond Type of '8' and the Designation Type Code is 'B', but the Co-Princ IR # submitted already has an active bond on file in ACE for the Bond Activity Type Code.\n- with Bond Type of '8' and the Designation Type Code is 'B', but the User IR # submitted already has an active bond on file in ACE for the Bond Activity Type Code.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S97",
    "narrativeText": "Liab Amt Exceeds Agent Limit by Surety",
    "explanation": "This error will be returned when the transaction is submitted with an Agent ID Number that is assigned to the Surety Code submitted in ACE, but the liability amount exceeds the limit assigned to the agent by the Surety.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S98",
    "narrativeText": "Transaction Data Rejected",
    "explanation": "This error will occur at the message level and will be returned in addition to the record level error(s).",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "S99",
    "narrativeText": "ACE System Failure",
    "explanation": "This error will be returned when the transaction is submitted with an issue or issues not recognized by ACE.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "SR1",
    "narrativeText": "46 Record Count Exceeded",
    "explanation": "This error will occur when a transaction is submitted with more than one 46 record per 40 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "SR2",
    "narrativeText": "46 Record Not Valid With 45 Record",
    "explanation": "This error will occur when a transaction is submitted with a 45 record and a 46 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "SR3",
    "narrativeText": "Re-Insurer Cannot Equal Surety Code",
    "explanation": "This error will occur when a transaction is submitted with the same Surety Code for Re-insurer as sibmitted as the Surety in the 40 record.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "SR4",
    "narrativeText": "Re-Insurer Not On File For Bond",
    "explanation": "This error will occur when a transaction is submitted with Designation Type Code= 'C\u2019 and the Surety Code for the Re-Insurer is submitted, but it is not a surety code already on file as the Re-insurer for the bond.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "SR5",
    "narrativeText": "Bnd Amt Exceeds Reinsur Underwriting Lmt",
    "explanation": "This error will occur when a transaction is submitted with the bond designation type code = 'B', 'A', 'U', '\u2018E\u2019, or 'C, a 46 record is submitted for a Re-insurer, and the Bond Amount is greater than to the Re-insurer's Underwriting Limit.",
    "dateUpdated": "2015-01-05"
  },
  {
    "conditionCode": "X17",
    "narrativeText": "Filer Not Authorized",
    "explanation": "The B record filer/port is not authorized for the transaction.  Verify these 2 fields to determine if correct and if so contact your CBP client representative for assistance.",
    "dateUpdated": "2014-11-25"
  },
  {
    "conditionCode": "014",
    "narrativeText": "Date Range Exceeds Query Limit",
    "explanation": "In a Census Warning Query, the date range being queried (the difference between the requested from date and the requested to date) exceeds 31 days.",
    "dateUpdated": "2014-09-18"
  },
  {
    "conditionCode": "751",
    "narrativeText": "Known importer ind must be a Y",
    "explanation": "The Known Importer Indicator as reported in the 10-record, position 67 must either be a space or a Y.",
    "dateUpdated": "2014-09-12"
  },
  {
    "conditionCode": "622",
    "narrativeText": "Duty Accepted; \"X\" Duty Comp Code",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an HTS number on the line which requires duty, and the formula to compute the duty is a complex computation not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "623",
    "narrativeText": "Duty Accepted; Unsupported Formula",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an HTS number on the line which requires duty, and the duty is not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "626",
    "narrativeText": "Duty Accepted; HTS or Other Exception",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an HTS number on the line which requires duty, and the duty is not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "628",
    "narrativeText": "Duty Accepted; Complex Line",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an HTS number on the line which requires duty, and the formula to compute the duty is a complex computation not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "658",
    "narrativeText": "IR Tax Accepted  'X' Comp Code",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an IR tax class code/amount pair in a 60-Record and an HTS number on the line requires that tax (may or must), and the formula to compute the tax is a complex computation not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "659",
    "narrativeText": "Fee Accepted; 'X' Comp Code",
    "explanation": "This is an informational message; not fatal. This condition will be generated if a line is submitted with an AMS fee class code/amount pair in a 62-Record and an HTS number on the line requires that AMS fee (may or must), and  the formula to compute the fee is a complex computation not verified by the system.",
    "dateUpdated": "2014-08-19"
  },
  {
    "conditionCode": "574",
    "narrativeText": "Specific Rate Not Found for Case",
    "explanation": "If the filer transmits indicator \"S\" in position 22 of the 53 record, indicating that the reported AD/CVD case has as specific rate of duty, this error will result if the case details do not indicate a specific rate of duty or the Case Deposit Rate in the 53 record positions 14-21 does not match the current active case specific rate or is left blank.",
    "dateUpdated": "2014-08-05"
  },
  {
    "conditionCode": "121",
    "narrativeText": "Producer acct nbr missing",
    "explanation": "If a type '9' bond is transmitted, the 31 record must include the surety's producer account number in pos 19-28.  If that field is blank or zero filled, this error will result.  The producer account number is the Surety Reference Number located on CBP Form 301.",
    "dateUpdated": "2014-07-26"
  },
  {
    "conditionCode": "565",
    "narrativeText": "Cases May Not Be Related",
    "explanation": "This is an informational message; not fatal. The cases reported in consecutive 53 records for the same customs line are not listed on the AD/CVD database as being related to one another.",
    "dateUpdated": "2014-07-26"
  },
  {
    "conditionCode": "597",
    "narrativeText": "PGA Form Cannot Be Both Dsclmd & Submittd",
    "explanation": "This error will occur when both an FDA disclaimer and FDA data or a DOT disclaimer and DOT data are submitted on the same entry summary line.  A PGA disclaimer and PGA data from the same PGA cannot be submitted on the same entry summary line.",
    "dateUpdated": "2014-07-26"
  },
  {
    "conditionCode": "645",
    "narrativeText": "HTS / Shipment Usage Reqs Formal Entry",
    "explanation": "If the 10-Record Shipment Usage Type Code is a 'P' or a blank and an HTS number on the line requires a Formal Entry, this error will result.\n- or - \nIf the 10-Record Shipment Usage Type Code is an 'X', and an HTS number on the line requires a Formal Entry and the total Merchandise Value for the line is GT $250, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "286",
    "narrativeText": "IOR Change Not Allowed for PSC",
    "explanation": "If a change to the Importer of Record \u00a0(IOR) is needed.\u00a0 Prior to PSC filing, the trade must send a request to change the IOR to CBP with CF 3347. See ACE Entry Summary Business Rules and Process Document for additional guidance.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "593",
    "narrativeText": "Delivered To Party Format Cannot Be Used",
    "explanation": "When reporting the line level delivered to party, one of the acceptable formats must be used.  If the format of nnnn-nnnnn (old CBP assigned format) is transmitted, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "594",
    "narrativeText": "Delivered To Party Unknown Format",
    "explanation": "The delivered to party number must be in one of the acceptable formats.  If any other formats are used, or if any characters other than alpha or numerics are used, this error will result.  Note: encrypted IRS or SSN numbers are not accepted in an AE transaction.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "595",
    "narrativeText": "Sold To Party Format Cannot Be Used",
    "explanation": "When reporting the line level sold to party, one of the acceptable formats must be used.  If the format of nnnn-nnnnn (old CBP assigned format) is transmitted, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "596",
    "narrativeText": "Sold To Party Unknown Format",
    "explanation": "The sold to party number must be in one of the acceptable formats.  If any other formats are used, or if any characters other than alpha or numerics are used, this error will result.  Note: encrypted IRS or SSN numbers are not accepted in an AE transaction.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "644",
    "narrativeText": "Usage Not Allowed for Cnsl Summ",
    "explanation": "If the 10-Record Shipment Usage Type Code is a 'P' or an 'X', and the 10-Record Consolidated Summary Indicator is a 'Y', this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "647",
    "narrativeText": "Commrcl Sample Article Combo Not Allowed",
    "explanation": "If the ES has two or more lines, and the 10-Record Shipment Usage Type Code is a 'X', and  any one line has an HTS number which requires Formal Entry, then every line must also have an HTS number which requires Formal Entry, If not, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "651",
    "narrativeText": "IR Tax Not Allowed - Exempt Port",
    "explanation": "If the 10-Record District Port of Entry is in Puerto Rico (district 49) and the line is submitted with an IR tax class code/amount pair in the 60-Record and an HTS number on the line requires that submitted tax (may or must), this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "652",
    "narrativeText": "Fee Not Allowed - Exempt Port",
    "explanation": "If the 10-Record District Port of Entry is in Puerto Rico (district 49) or the Virgin Islands (district 51) and the line is submitted with an '053' beef AMS fee class code/amount pair in a 62-Record and an HTS number on the line requires a beef fee (may or must), this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "653",
    "narrativeText": "Fee / Exempt Claim Conflict",
    "explanation": "If a line is submitted with an AMS fee class code/amount pair in a 62-Record, and an HTS number on the line requires that AMS fee (may or must) and the filer has also made a conflicting exemption claim (either a value in the 40-Record Fee Exemption Code or an exemption certificate in a 52-Record), this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "654",
    "narrativeText": "IR Tax Not Allowed for Article",
    "explanation": "If a line is submitted with an IR tax class code/amount pair in a 60-Record and no HTS number on the line requires that IR tax, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "655",
    "narrativeText": "Fee Not Allowed for Article",
    "explanation": "If a line is submitted with an AMS fee class code/amount pair in a 62-Record and no HTS number on the line requires that AMS fee, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "656",
    "narrativeText": "IR Tax Required for Article",
    "explanation": "If an HTS number on the line requires an IR tax (must) and the line is submitted without that IR tax class code/amount pair in the 60-Record and the District Port of Entry is not an exempt port, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "660",
    "narrativeText": "Est IR Tax/Calc\u2019d Tax Mismatch - Line",
    "explanation": "If a line is submitted with an IR tax class code/amount pair in the 60-Record (other than 016) and the IR tax class is allowed and the filer's estimate of the IR tax falls outside $3.00 (plus or minus) of the system's calculation (using the rates and formula for the HTS), this error will result.\n- or - \nIf a line is submitted with an IR tax 016 distilled spirits class code/amount pair in the 60-Record, and the IR tax class 016 is allowed and the filer's estimate of the IR tax falls outside $3.00 (minus only) of the system's calculation (using the rates and formula for the HTS), this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "661",
    "narrativeText": "Est Fee/Calc'd Fee Mismatch - Line",
    "explanation": "If a line is submitted with an AMS fee class code/amount pair in the 62-Record, and the AMS fee class is allowed, and filer's estimate of the AMS fee falls outside $3.00 (plus or minus) of the system's calculation (using the rates and formula for the HTS), this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "662",
    "narrativeText": "Est IR Tax/Calc'd Tax Mismatch - Total",
    "explanation": "If the filer's estimate of the IR tax, combined class total (in the 90-Record), when no IR tax 016 reported on any line, falls outside $3.00 (plus or minus) of the sum of the individual system's calculation for each line with an IR tax class, this error will result.\n- or -\nIf the filer's estimate of the IR tax, combined class total (in the 90-Record), when at least one line has an IR tax 016 (distilled spirits) reported, falls outside $3.00 (minus only) of the sum of the individual system's calculation for each line with an IR tax class, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "663",
    "narrativeText": "Est Fee/Calc'd Fee Mismatch - Total",
    "explanation": "For each AMS fee class submitted in the summary, if the filer's estimate of the AMS fee total (in the 89-Record) falls outside $3.00 (plus or minus) of the sum of the individual system's calculation for each line with that AMS class, this error will result.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "710",
    "narrativeText": "AD/CVD Case(s) Requires STB",
    "explanation": "This error will occur: 1) if ANY single AD/CVD case is submitted where the basic bond claimed is continuous and the rate used for that case is an Ad Valorem Rate equal to or greater than 5% or 2) if ANY single case is submitted where the basic bond claimed is continuous and the rate used for that case is a Specific Rate.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "B30",
    "narrativeText": "Entry Summary Has Been Liquidated",
    "explanation": "If an ACE Entry summary has been scheduled for liquidation, a retransmission of the AE is not permitted.  This error will result.   If an ACE Entry summary has been scheduled for liquidation, a transmission of the CW is not permitted.  After payment, unresolved census warnings can be resolved by transmitting a PSC with the proper census override codes.",
    "dateUpdated": "2014-07-12"
  },
  {
    "conditionCode": "MS0",
    "narrativeText": "Multiple Reqsts Not Alwed In A Block",
    "explanation": "This error will occur when more than one QR-record is included in a B-Y block of the MO transaction.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS1",
    "narrativeText": "Input Reroute Request Missing",
    "explanation": "This error will occur when no QR-record is submitted in a B-Y block of an MO transaction.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS2",
    "narrativeText": "Trans Date Of Stmt Beyond 60 Days",
    "explanation": "This error will occur if the transmission date provided in the QR-record is more than 60 days in the past.  Only statements within the past 60 days may be rerouted.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS3",
    "narrativeText": "Trans Data Of Stmt Missing Or Invalid",
    "explanation": "The transmission date of the periodic statement(s) requested is a mandatory field in the QR-record; it must be provided and must be in a valid MMDDYY format or this error will occur.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS4",
    "narrativeText": "Importer Of Record Unknown",
    "explanation": "The importer of record (if present in the QR-record) must be a valid IOR and exist in the ACE importer account data base.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS5",
    "narrativeText": "Statement Number Unknown",
    "explanation": "This error will occur if the transmission date and type of statement(s) to reroute are valid however, no statement is found for the filer/port in the B-record associated with the statement number provided in the QR-record.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS6",
    "narrativeText": "Scope Indicator Invalid",
    "explanation": "If the scope indicator is submitted in the QR-record, the only valid values are \"A\" and space otherwise this error will be returned.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS7",
    "narrativeText": "Stmt Request (Prel or Final) Invalid",
    "explanation": "If either of the fields Preliminary Periodic Monthly Statement Request or Final Periodic Monthly Statement Request values are submitted yet not equal to \"Y\" or \"N\", this error will occur.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS8",
    "narrativeText": "Optional Request Field(s) Use Invalid",
    "explanation": "This error will occur if the importer of record number or client branch indicator are used in combination with the statement number or scope indicator.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MS9",
    "narrativeText": "No Statement Found To Reroute",
    "explanation": "If any and all periodic monthly statement reroute request criteria provided in the QR-record are valid and no statement is found to reroute, this error will occur.  Verify the transmission date and/or statement number and/or preliminary or final request indicators submitted are correct.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MSA",
    "narrativeText": "Total Number Of Statements Rerouted",
    "explanation": "This condition will occur when statement(s) have been found based on the request criteria and have been rerouted.  The count of successfully rerouted statement(s) will also be provided.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MSB",
    "narrativeText": "Statement Number Invalid",
    "explanation": "A request to reroute a specific periodic monthly statement has been submitted yet the periodic statement number provided in the QR-record is less than 10 digits.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MSC",
    "narrativeText": "Stmt Request (Prel or Final) Required",
    "explanation": "If either of the fields Preliminary Periodic Monthly Statement Request or Final Periodic Monthly Statement Request values are not submitted (that is, submitted as a space), this error will occur.",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "MSD",
    "narrativeText": "Filer Not Auth For Stmt Requested",
    "explanation": "This error will occur; if the scope indicator is \"A\" and the A-record filer/port of the MO transaction do not match the A-record filer/port of the originally created statement(s) or if the scope indicator is a space and the B-record filer/port of the MO transaction do not match the B-record filer/port of the originally created statement(s).",
    "dateUpdated": "2014-03-24"
  },
  {
    "conditionCode": "P00",
    "narrativeText": "PGA Data Missing per PGA Flag",
    "explanation": "This error will occur when a transaction is submitted with no PGA data (PGxx records do not exist in the transaction), when the PGA tariff flag is set to 'Y'",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P01",
    "narrativeText": "Missing OI Record",
    "explanation": "This error will occur when a transaction is submitted without a commercial description in an OI Record but a PG01 Record exists.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P02",
    "narrativeText": "Missing OI PGA Line Item Description",
    "explanation": "This error will occur when a transaction is submitted which includes an OI Record yet there is no PGA Line Item description in the OI Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P03",
    "narrativeText": "Missing PG01 Record",
    "explanation": "This error will occur when a transaction is submitted without a PG01 Record, but an OI Record was submitted.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P04",
    "narrativeText": "Missing PGA Line Number",
    "explanation": "This error will occur when a transaction is submitted which includes a PG01 Record yet no PGA Line Number is reported in the PG01 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P05",
    "narrativeText": "Missing Government Agency Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG01 Record yet no Government Agency Code was reported in the PG01 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P06",
    "narrativeText": "Missing or Invalid Govt Agency Prog Code",
    "explanation": "This error will occur when a transaction is submitted for which a Government Agency Program Code is not reported in the PG01 Record or if it is reported, it must be on the approved list provided by the PGA.  (See document \"Agency Tariff Code to Agency Program Cross Reference\" located on CBP.GOV)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P07",
    "narrativeText": "Invalid Item Type",
    "explanation": "This error will occur when a transaction is submitted with an invalid Item Type in a PG02 Record.  The first PG02 Record encountered on a PGA line must have an Item Type of 'P'.  If subsequent PG02 Records appear in this line, they must have an item type of 'C'.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P08",
    "narrativeText": "Missing Intended Use Description",
    "explanation": "This error will occur when a transaction is submitted with no Intended Use Description in the PG01 Record if a 980.000 Intended Use Code is reported in the PG01 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P09",
    "narrativeText": "Invalid Unit of Measure",
    "explanation": "This error will occur when a transaction is submitted which includes a PG04 Record, however, the Unit of Measure code reported is invalid.  (For Lacey Act requirements see ACE ABI CATAIR Appendix PGA. For non-Lacey Act requirements see ACS ABI CATAIR Appendix C.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P10",
    "narrativeText": "Missing Source Type Code",
    "explanation": "This error will occur when a transaction is submitted without a Source Type Code in the PG06 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P11",
    "narrativeText": "Invalid Source Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG06 Record however, the Source Type Code reported is not on file. (For Lacey Act requirements see ACE ABI CATAIR Appendix PGA. For non-Lacey Act requirements see ACS ABI CATAIR Appendix C.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P12",
    "narrativeText": "Missing Entity Role Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG19 Record yet without an Entity Role Code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P13",
    "narrativeText": "Invalid Entity Role Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG19 Record however, the Entity Role code reported is not on file. (See ACE ABI CATAIR Appendix PGA for valid codes.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P14",
    "narrativeText": "Missing Affirmation of Compliance Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG23 Record yet without an Affirmation of Compliance Code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P15",
    "narrativeText": "Invalid Affirmation of Compliance Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG23 Record with an Affirmation of Compliance Code that is not on file with FDA.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P16",
    "narrativeText": "Missing Packaging Qualifier",
    "explanation": "This error will occur when a transaction is submitted which includes a PG26 Record yet without a Packaging Qualifier.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P17",
    "narrativeText": "Invalid Packaging Qualifier",
    "explanation": "This error will occur when a transaction is submitted which includes a PG26 Record, however, the Packaging Qualifier is not a numeric value of 1, 2, 3, 4, 5, or 6.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P18",
    "narrativeText": "Missing Container Number",
    "explanation": "This error will occur when a transaction is submitted which includes a PG27 Record yet without a Container Number (Equipment ID).",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P19",
    "narrativeText": "Missing INSP/LAB Testing Status Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG30 Record yet without an Inspection/Laboratory Testing Status code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P20",
    "narrativeText": "Invalid INSP/LAB Testing Status Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG30 Record and includes an INSP/LAB Testing Status code that is not listed in the description associated with the PG30 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P21",
    "narrativeText": "Missing Cmdty Harv Vessel Char Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG31 Record yet without a Commodity Harvesting Vessel Characteristic Type Code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P22",
    "narrativeText": "Invalid Cmdty Harv Vessel Char Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG31 Record however, the Commodity Harvesting Vessel Characteristic Type Code reported is not on file. (See ACE ABI CATAIR Appendix PGA for valid codes.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P23",
    "narrativeText": "Missing Cmdty Routing Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG32 Record yet without a Commodity Routing Type Code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P24",
    "narrativeText": "Invalid Cmdty Routing Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG32 Record however, the Commodity Routing Type Code reported is not on file.  (See ACE ABI CATAIR Appendix PGA for valid codes.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P25",
    "narrativeText": "Missing Travel Document Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG34 Record yet without a  Travel Document Type Code.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P26",
    "narrativeText": "Invalid Travel Document Type Code",
    "explanation": "This error will occur when a transaction is submitted which includes a PG34 Record, however, the Travel Document Type Code is not a numeric 1, 2, 3 or 4.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P27",
    "narrativeText": "Missing Processing Descrip with 017",
    "explanation": "This error will occur when a transaction is submitted which includes a PG06 Record and a Processing Type Code of 017 in the PG06 Record yet no Processing Description is submitted.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P28",
    "narrativeText": "Missing PG07 Record",
    "explanation": "This error will occur when a transaction is submitted which includes a PG08 Record however, the transaction does not include a PG07 record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P29",
    "narrativeText": "Missing PG14 Record",
    "explanation": "This error will occur when a transaction is submitted which includes a PG13 Record however, the transaction does not include a PG14 record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P30",
    "narrativeText": "Missing Cmdty Pol Subunit Routing Name",
    "explanation": "This error will occur when a transaction is submitted which includes a PG32 Record including a Commodity Political Subunit of Routing Qualifier however, it was reported without a Commodity Political Subunit of Routing Name.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P31",
    "narrativeText": "Missing Cmdty Geo Area Code Or Name",
    "explanation": "This error will occur when a transaction is submitted with a PG33 Record that contains no data (beyond the control identifier and record type). One of the two data elements (Commodity Geographic Area Code or Commodity Geographic Area Name) must be provided.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P32",
    "narrativeText": "Records Not Allowed in Group",
    "explanation": "This error will occur when a transaction is submitted with records within a group that are not allowed.  For example, multiple PG05 and PG06 Records may follow a PG04 Record, multiple PG14 Records may follow a PG13 Record, etc.  Please see Partner Government Agencies ACE ABI CATAIR chapter for further guidance on record groups.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P33",
    "narrativeText": "Missing PG19 Record",
    "explanation": "This error will occur when a transaction is submitted which includes a PG20 Record however, the transaction does not include a PG19 record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P34",
    "narrativeText": "Invalid Data Relationship",
    "explanation": "This error will occur when a transaction is submitted which includes a PG21 Record however, the transaction does not include a PG19, PG20, PG22 or PG30 record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P35",
    "narrativeText": "Invalid Grouping",
    "explanation": "This error will occur when a transaction is submitted which includes a grouping (PG50 - PG51 record bookends for a grouping) that appears immediately after a PG01 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P36",
    "narrativeText": "Invalid Document Identifier Per PGA",
    "explanation": "This error will occur when a transaction is submitted which includes a PG22 Record Document Identifier that does not match one that is required based on the Government Agency Program Code as reported in the PG01 Record.  (See ACE ABI CATAIR Appendix PGA for valid codes.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P37",
    "narrativeText": "Missing PG24 Record Per PGA",
    "explanation": "This error will occur when a transaction is submitted which includes a Document Identifier in the PG22 Record however, the transaction does not include a PG24 Record as required by the PGA.  (See ACE ABI CATAIR Appendix PGA for agency requirements.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P38",
    "narrativeText": "Mssng/Invld Rmk Typ Code In PG24 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which includes one or more PG24 Records however, none of the PG24 Records includes a Remarks Type Code as required by the PGA.  (See ACE ABI CATAIR Appendix PGA for valid codes.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P39",
    "narrativeText": "Missing Cmdty Harv Vessel Characteristic",
    "explanation": "This error will occur when a transaction is submitted which includes a PG31 Record yet without a Commodity Harvesting Vessel Characteristic.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P40",
    "narrativeText": "Invalid PGA Profile",
    "explanation": "This error will occur when a transaction is submitted and one of the following codes is inactive or invalid for the PGA pilots: Filer, Port, Agency, Agency Program Code",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P41",
    "narrativeText": "Missing Remarks Code Or Text",
    "explanation": "This error will occur when a transaction is submitted which includes a PG24 Record and a Remarks Type Code is reported - yet neither a Remarks Code or Remarks Text are reported in the PG 24 Record.  (See ACE ABI CATAIR Appendix PGA for Remarks requirements.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P42",
    "narrativeText": "More Than One OI Under Single HTS",
    "explanation": "This error will occur when a transaction is submitted which includes more than one OI Record following an HTS code for the same PGA set of PG Records.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P43",
    "narrativeText": "Missing PG06 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG06 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P44",
    "narrativeText": "Missing PG13 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG13 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P45",
    "narrativeText": "Missing PG14 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG14 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P46",
    "narrativeText": "Missing PG19 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG19 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P47",
    "narrativeText": "Missing PG21 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG21 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P48",
    "narrativeText": "Missing PG22 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG22 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P49",
    "narrativeText": "Missing PG30 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG30 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P50",
    "narrativeText": "Missing PG10 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG10 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P51",
    "narrativeText": "Missing PG25 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG25 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P52",
    "narrativeText": "Missing PG26 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG26 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P53",
    "narrativeText": "Missing PG29 Per PGA",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG29 record as required by the PGA.  (See the appropriate PGA supplemental guidance located on the ACE ABI CATAIR CBP.GOV web page.)",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "P54",
    "narrativeText": "Missing PG02 Record",
    "explanation": "This error will occur when a transaction is submitted which does not include a PG02 record and no disclaimer is declared in the PG01 Record.",
    "dateUpdated": "2014-01-27"
  },
  {
    "conditionCode": "629",
    "narrativeText": "Formal MPF Not Allowed - Set Component",
    "explanation": "If a formal class code '499' fee has been submitted for the line but the line is a 'set component' type (pos 8 of the 40-Record = 'V'), this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "630",
    "narrativeText": "Formal MPF Not Allowed - Infrml Summary",
    "explanation": "If a formal class code '499' fee has been submitted for the line but the Entry Type is an informal type (e.g., '11'), this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "631",
    "narrativeText": "Line Not Evaluated for MPF Exemption",
    "explanation": "This is an informational message; not fatal. This condition may be generated in a scenario where a line's MPF exempt status cannot be determined.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "632",
    "narrativeText": "Formal MPF Not Allowed - Article Exempt",
    "explanation": "If a formal class code '499' fee has been submitted for the line of a formal summary but the article is MPF exempt, this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "633",
    "narrativeText": "Formal MPF Required - Article Not Exempt",
    "explanation": "If a formal class code '499' fee has not been submitted for the line of a formal summary but the article is not MPF exempt, this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "634",
    "narrativeText": "Est MPF/Calc'd MPF Mismatch - Line",
    "explanation": "If a formal class code '499' fee has been submitted for the non-exempt line of a formal summary but the amount is the incorrect product of 'value times rate', this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "639",
    "narrativeText": "Formal MPF Minimum Amount Required",
    "explanation": "If the system computed amount of MPF for the summary is less than or equal to the minimum MPF amount owed and if a formal class code '499' total fee has been submitted in the 89-Record but is not this minimum amount, this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "640",
    "narrativeText": "Formal MPF Maximum Amount Required",
    "explanation": "If the system computed amount of MPF for the summary is equal to or greater than the maximum MPF amount owed and if a formal class code '499' total fee has been submitted in the 89-Record but is not this maximum amount, this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "641",
    "narrativeText": "Est MPF/Calc'd MPF Mismatch - Total",
    "explanation": "If the system computed amount of MPF owed on the summary falls in between the minimum and maximum and if a formal class code '499' total fee has been submitted in the 89-Record, but is not this amount (within a tolerance), this error will result.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "642",
    "narrativeText": "ESV Failure <reason description>",
    "explanation": "This information condition may be generated in a scenario where an internal system problem has been encountered. Note that the text may include a detailed reason.  Wait a few minutes and retry/retransmit the transaction.  It is possible that a system resource was temporarily unavailable.",
    "dateUpdated": "2014-01-16"
  },
  {
    "conditionCode": "625",
    "narrativeText": "Duty Not Allowed - Set Component",
    "explanation": "If the line item details as reported in the 40-record indicate that the line is a set component, that is, the article set indicator reported in position 8 = \"V\", then duty cannot be reported on this line - only on the set header (if duty applies).",
    "dateUpdated": "2014-01-06"
  },
  {
    "conditionCode": "627",
    "narrativeText": "Est Duty/Calc\u2019d Duty Mismatch - Total",
    "explanation": "Each line on the entry summary should reflect the exact duty amount due based on the duty rate applicable to the tariff number.  However, CBP systems allow a difference per entry summary line of up to $2.99 between the calculated duty and the amount reported by the filer.  The $2.99 difference also applies to the entry summary as a whole.  Individual lines may be discrepant up to $2.99, however, the entry summary will be rejected if the estimated total duty amount as reported in the 90-record, positions 3-13 is $2.99 more than or less than the amount calculated by CBP systems for all lines on the entry summary.",
    "dateUpdated": "2014-01-06"
  },
  {
    "conditionCode": "590",
    "narrativeText": "Notify Party Unknown Format",
    "explanation": "Designated notify (4811) party identification numbers must be in one of the acceptable formats listed in Usage Note (f) of the ACE ABI Entry Summary Create/Update chapter of the ACE ABI CATAIR.  Any format other than one of those shown in this note will result in this reject.",
    "dateUpdated": "2013-11-12"
  },
  {
    "conditionCode": "591",
    "narrativeText": "Notify Party Unknown",
    "explanation": "The designated notify (4811) party identification number, as reported in the entry summary transaction 11 record, pos 27-38, is not an existing account in ACE as found on the ACCOUNTS tab.",
    "dateUpdated": "2013-11-12"
  },
  {
    "conditionCode": "PGA",
    "narrativeText": "PGA Data Rejected",
    "explanation": "Partner Government Agency data as reported in PGA Message Set records (PGxx) has not been accepted.",
    "dateUpdated": "2013-11-12"
  },
  {
    "conditionCode": "ZZZ",
    "narrativeText": "ACE System Failure",
    "explanation": "In the unlikely event that an entry summary AX response returns an indication of ACE system failure (E1-Record Condition Code = ZZZ; Narrative Text = ** ACE SYSTEM FAILURE **) the transmitter/receiver of the message should take the following actions:\n\n1. Wait a few minutes and retry/retransmit the transaction.  It is possible that a system resource was temporarily unavailable.  If the retry/retransmit does not reproduce the system failure then no further action is needed.   \n\n2. If a retry/retransmit continues to result in an ACE system failure, scan/search the Cargo Systems Messaging Service (CSMS) for a recent trade notification that outlines the reason and resolution for the problem encountered. \n\n3. If no CSMS notification has been published, within one hour, call your CBP Client Representative to report the problem and/or receive further instructions.  \n\nNote: When an ACE system failure has occurred, the transaction has NOT successfully been processed.  Once the system failure reason has been resolved, the transaction must be retransmitted and successfully accepted.",
    "dateUpdated": "2013-11-12"
  },
  {
    "conditionCode": "001",
    "narrativeText": "Return Detail Request Ind Must Be Y",
    "explanation": "In an Entry Summary Query, if the 'return detail request indicator' is any character except a \"Y\", this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "002",
    "narrativeText": "Case Number Missing",
    "explanation": "THIS ERROR CONDITION DOES NOT FUNCTION, AS OF JAN 2013.  In an AD/CVD Query, if the Q1 record is used in the query,  there must be at least 7 characters in the Q1 record.  If fewer than 7 characters are transmitted in the case number field, this error will result.  THIS CONDITION HAS NOT BEEN PROGRAMMED AS OF JAN 2013.",
    "dateUpdated": null
  },
  {
    "conditionCode": "002",
    "narrativeText": "Query Request Missing",
    "explanation": "In an Entry Summary Query, if the J0 record is used, it must be followed by a J1 record.  If the J1 record is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "003",
    "narrativeText": "Case Number Not Found for Query",
    "explanation": "In an AD/CVD Query, the case number reported in the Q2 record is not found on the AD/CVD database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "003",
    "narrativeText": "Entry Filer Code Missing",
    "explanation": "In a Census Warning Query, the CJ1 record must contain a filer code in pos 20-22",
    "dateUpdated": null
  },
  {
    "conditionCode": "003",
    "narrativeText": "Entry Filer Code Missing",
    "explanation": "In an Entry Summary Query, the J1 record must contain a filer code in pos 6-8.",
    "dateUpdated": null
  },
  {
    "conditionCode": "004",
    "narrativeText": "Company Case Status Unknown",
    "explanation": "In an AD/CVD Query, the case status, Q2 record, pos 4, must be transmitted.  If this field is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "004",
    "narrativeText": "Entry Number Missing",
    "explanation": "In a Census Warning Query, if no date range is transmitted, an entry number is required in pos 25-32 (if only one entry is being queried)",
    "dateUpdated": null
  },
  {
    "conditionCode": "004",
    "narrativeText": "Entry Number Missing",
    "explanation": "In an Entry Summary Query, the J1 record must contain an entry number in pos 11-18.",
    "dateUpdated": null
  },
  {
    "conditionCode": "005",
    "narrativeText": "Country Code Unknown",
    "explanation": "If the Q2 record in an AD/CVD Query, contains an invalid ISO country code in pos 6-7, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "005",
    "narrativeText": "Criteria QueryType Code Missing",
    "explanation": "In an Entry Summary Query, the J2 record must show one of the valid 'criteria query type code' values in pos 4-6.  If the field is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "006",
    "narrativeText": "Criteria QueryType Code Unknown",
    "explanation": "In an Entry Summary Query, the J2 record must show one of the valid 'criteria query type code' values in pos 4-6.  If any three character code other than the ones listed for this field are transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "006",
    "narrativeText": "Entry Summary Not Found for Query",
    "explanation": "In a Census Warning Query, the entry number queried was not found in ACE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "006",
    "narrativeText": "HTS Number Unknown",
    "explanation": "In an AD/CVD Query, the Q2 record has a tariff number that is not found on the HSAL database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "007",
    "narrativeText": "No Unrslved Warnings Found For Summary",
    "explanation": "In a Census Warning Query, the entry number queried did not have any unresolved Census Warnings.",
    "dateUpdated": null
  },
  {
    "conditionCode": "007",
    "narrativeText": "TSUSA Number Unknown",
    "explanation": "In an AD/CVD Query, this refers to the old tariff numbers\u2026may not be valid any longer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "007",
    "narrativeText": "Request From Date Time Missing",
    "explanation": "In an Entry Summary Query, the J2 record has a field for a range of dates for which the query is to be applied.  If the 'Requested From Date/Time' is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "008",
    "narrativeText": "HTS and TSUSA Number Not Allowed",
    "explanation": "In an AD/CVD Query, this refers to the old tariff numbers\u2026may not be valid any longer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "008",
    "narrativeText": "Request From Date Time Unknown",
    "explanation": "In an Entry Summary Query, the J2 record has a field for a range of dates for which the query is to be applied.  If the 'Requested From Date/Time' is not transmitted as specified in the description record for this element, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "009",
    "narrativeText": "Manufacturer  ID Code Unknown",
    "explanation": "In an AD/CVD query, MID provided in the Q2 record contains an MID that is not found on the MID database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "009",
    "narrativeText": "Requested From Date Missing",
    "explanation": "In a Census Warning Query, the CJ1 record, if the filer transmits a 'requested to' date, a 'requested from' date is required.",
    "dateUpdated": null
  },
  {
    "conditionCode": "009",
    "narrativeText": "Requested To Date  Time Missing",
    "explanation": "In an Entry Summary Query, the J2 record has a field for a range of dates for which the query is to be applied.  If the 'Requested To Date/Time' is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "010",
    "narrativeText": "Foreign Exporter ID Code Unknown",
    "explanation": "In a AD/CVD Query, the Q2 record contains an MID for the foreign exporter and the MID is not found on the MID database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "010",
    "narrativeText": "Requested From Date Unknown",
    "explanation": "In a Census Warning Query, the 'requested from' date must be a valid date in MMDDYY format.",
    "dateUpdated": null
  },
  {
    "conditionCode": "010",
    "narrativeText": "Requested To Date  Time Unknown",
    "explanation": "In an Entry Summary Query, the J2 record has a field for a range of dates for which the query is to be applied.  If the 'Requested To Date/Time' is not transmitted as specified in the description record for this element, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "011",
    "narrativeText": "Additional Query Criteria Required",
    "explanation": "If an AD/CVD Query input record reports the Q2 record with one of the valid company case status codes in pos 4, at least one more of the conditional fields is required in the Q2 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "011",
    "narrativeText": "Requested To Date < Requested From Date",
    "explanation": "In an Entry Summary Query, the J2 record allows the filer to make a query for a range of dates in which the query is to be applied.  If the 'Requested To Date/Time' is prior to the 'Requested From Date/Time', this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "011",
    "narrativeText": "Requested To Date Missing",
    "explanation": "In a Census Warning Query,  if the CJ1 record transmits a 'requested from' date, a 'requested to' date is required.",
    "dateUpdated": null
  },
  {
    "conditionCode": "012",
    "narrativeText": "Date Range Day Limit Exceeded",
    "explanation": "In an Entry Summary Query, the number of days between the 'from' and 'to' date range is limited to 31 days.  If a 'to' date is transmitted that exceeds 31 days, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "012",
    "narrativeText": "Date Since Last Update Unknown",
    "explanation": "In an AD/CVD Query, the 'date since last update' field must be a valid calendar date in MMDDYY format.",
    "dateUpdated": null
  },
  {
    "conditionCode": "012",
    "narrativeText": "Requested To Date Unknown",
    "explanation": "In a Census Warning Query, the 'requested to' date must be a valid date in MMDDYY format.",
    "dateUpdated": null
  },
  {
    "conditionCode": "013",
    "narrativeText": "Date Range Exceeds Query Limit",
    "explanation": "In an AD/CVD Query, the 'date since last update' field cannot be earlier than 7 calendar days preceding the date the query was transmitted to ACE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "013",
    "narrativeText": "Entry Summary Not Found for Query",
    "explanation": "In an Entry Summary Query, the entry number queried is not on the ACE database.  This can mean that either the entry has never been persisted in ACE or that the entry was filed in  ACS.",
    "dateUpdated": null
  },
  {
    "conditionCode": "013",
    "narrativeText": "Requested To Date < Requested From Date",
    "explanation": "In an Census Warning Query, the CJ1 record allows the filer to make a query for a range of dates in which the query is to be applied.  If the 'Requested To Date' is prior to the 'Requested From Date', this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "014",
    "narrativeText": "Query Complete No AD/CVD Cases Found",
    "explanation": "In an AD/CVD query, there were no cases found for the tariff/country listed in the AD input record",
    "dateUpdated": null
  },
  {
    "conditionCode": "014",
    "narrativeText": "Query Not Permitted for Entry Number",
    "explanation": "In an Entry Summary Query, if the J1 record is used, at least one entry number being queried must be from the same filer code as transmitted in the B record for the query.",
    "dateUpdated": null
  },
  {
    "conditionCode": "015",
    "narrativeText": "Entry District/Port Unknown",
    "explanation": "In a Census Warning Query, the CJ1 record must contain a valid DDPP (listed on RDPL) in pos 4-7.",
    "dateUpdated": null
  },
  {
    "conditionCode": "015",
    "narrativeText": "Query Complete No Summaries Found",
    "explanation": "In an Entry Summary Query, if there are no summaries that satisfy the conditions transmitted in the J2 record, this message will be issued.",
    "dateUpdated": null
  },
  {
    "conditionCode": "016",
    "narrativeText": "Output Limit Reached - Addtnl ES Found",
    "explanation": "In an Entry Summary Query, if the J2 record is used for the query and the query results yield more than 5000 entries, this message will be generated.",
    "dateUpdated": null
  },
  {
    "conditionCode": "016",
    "narrativeText": "Query Complete - No Summaries Found",
    "explanation": "In a Census Warning Query, there were no summaries found for the filer code in pos 20-22.",
    "dateUpdated": null
  },
  {
    "conditionCode": "017",
    "narrativeText": "Future Requested To Date Not Allowed",
    "explanation": "In an Entry Summary Query, the J2 record field 'requested to date/time' cannot be  a date later than the transmission date of the query.",
    "dateUpdated": null
  },
  {
    "conditionCode": "100",
    "narrativeText": "Importer Nbr Missing",
    "explanation": "If the importer of record number is blank in the 11 record, pos 3-14, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "101",
    "narrativeText": "Importer Unknown",
    "explanation": "The importer of record number, 11 record, pos 3-14, is not on the importer file in the ACCOUNTS tab.",
    "dateUpdated": null
  },
  {
    "conditionCode": "102",
    "narrativeText": "Importer Nbr Unknown Format",
    "explanation": "Importer numbers must be in one of the acceptable formats listed in Usage Note (f) of the ACE ABI Entry Summary Create/Update chapter of the ACE ABI CATAIR.  Any format other than one of those shown in this note will result in this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "103",
    "narrativeText": "Importer Nbr Ineligible",
    "explanation": "If importer of record number 00-000000000 or 000-00-0000 is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "104",
    "narrativeText": "Importer  Void",
    "explanation": "If the importer of record number in the 11 record, pos 3-14, has a status of 'voided', this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "105",
    "narrativeText": "Ult Consignee Nbr Unknown Format",
    "explanation": "The ultimate consignee number must be in one of the acceptable formats.  If any other formats are used, or if any characters other than alpha or numerics are used, this error will result.  Note: encrypted IRS or SSN numbers are not accepted in an AE transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "106",
    "narrativeText": "Ultimate Consignee Void",
    "explanation": "If the ultimate consignee number, as reported in either the 11 record or the 47 record, shows 'void' on the SRE file, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "108",
    "narrativeText": "Format Req's A Known Ult Consignee",
    "explanation": "The 11 record, pos 15-26, is used to report the ultimate consignee for an entry summary.  The number provided in this field must be active in the importer database.  If the number is not on file, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "109",
    "narrativeText": "Entry Port Req's a Known Consignee",
    "explanation": "The consignee number in the 11 record must be on file in the importer database.  If it is not, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "110",
    "narrativeText": "Notify Format Cannot Be Used",
    "explanation": "If the filer elects to report a CBPF 4811 relationship by transmitting the broker's identification data in the 11 record, pos 27-38, one of the acceptable formats must be used.  If the format of nnnn-nnnnn (old CBP assigned format) is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "111",
    "narrativeText": "Importer Inactive",
    "explanation": "The importer of record number, 11 record, pos 3-14, is listed as inactive on the importer file in the ACCOUNTS tab.",
    "dateUpdated": null
  },
  {
    "conditionCode": "112",
    "narrativeText": "Bond Type Code Must Be 8 or 9",
    "explanation": "The bond type code is transmitted in the 31 record, pos 3.  Only types 8 and 9 can be transmitted in this field.  Any other letter or number will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "113",
    "narrativeText": "No continuous bond found for importer",
    "explanation": "If the bond portlet under the Accounts tab does not indicate a continuous bond for the importer of record on an entry summary, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "114",
    "narrativeText": "No Valid Continuous Bond Found",
    "explanation": "If bond type 8 is transmitted in the 31 record, pos 3, a valid continuous bond must be on file for the importer of record with the surety code reported in the 31 record.  If no bond is on file, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "115",
    "narrativeText": "Continuous Bond Not Yet Effective",
    "explanation": "If the continuous bond for the importer of record is not effective as of the duty comp date for the entry, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "116",
    "narrativeText": "Continuous Bond Insufficient",
    "explanation": "The bond for the importer of record has been coded as insufficient by the NFC.",
    "dateUpdated": null
  },
  {
    "conditionCode": "117",
    "narrativeText": "Continuous Bond Has Terminated",
    "explanation": "The bond for the importer of record has expired or been terminated as of the duty comp date transmitted in this entry transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "119",
    "narrativeText": "Bond Detail Missing - Entry Type",
    "explanation": "If an entry type is one that requires a bond, there must be a 31 record transmitted to report the bond details.",
    "dateUpdated": null
  },
  {
    "conditionCode": "120",
    "narrativeText": "Bond Detail Not Allowed - Bond Waived",
    "explanation": "If a bond waiver has been requested (\"0\" in pos 38 of the 10 record), then no bond information is permitted in the form of a 31 record.  If a 31 record is included in the AE transaction, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "122",
    "narrativeText": "Bond  Waiver Ind Must Be 0",
    "explanation": "The bond waiver field replaced the bond type indicator in the 10 record, pos 8.  If any code other than 0 is sent in the 10 record, pos 38, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "123",
    "narrativeText": "Bond Amount Contains Non-Numerics",
    "explanation": "The bond amount is transmitted in the 31 record, pos 3-12.  Only numerics can be sent in this field. (will change when A2.3.1a goes live)",
    "dateUpdated": null
  },
  {
    "conditionCode": "125",
    "narrativeText": "Est Entry Date Not a Known Date",
    "explanation": "The estimated entry date is transmitted in the 11 record, pos 42-47.  It must be transmitted in MMDDYY format.  If the date transmitted does not conform to this format, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "126",
    "narrativeText": "STB Account Not Allowed for Bond Type",
    "explanation": "If the filer indicates a continuous bond (\"8\" in pos 3 of the 31 record), bond producer account data is not allowed in pos 19-28 of that record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "128",
    "narrativeText": "Import Date is Not a Known Date",
    "explanation": "The import date is transmitted in the 11 record, pos 48-53  It must be transmitted in MMDDYY format.  If the date transmitted does not conform to this format, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "129",
    "narrativeText": "Live Entry Ind Must Be Y",
    "explanation": "The live entry indicator is transmitted in the 10 record, pos 44.  ACE will only accept a \"Y\" in this field. Any other character will result in this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "130",
    "narrativeText": "Bnd Waiver Reason Not Allowed-Not Waived",
    "explanation": "If the bond waiver reason code is transmitted in pos 62-64 of the 10 record, and there is no bond waiver request ('0' in pos 38 of the 10 record), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "131",
    "narrativeText": "Shipment Usage Code Must be P or X",
    "explanation": "The usage code for personal cargo or samples is transmitted by providing a \"P\" or an \"X\" in the 10 record, pos 43.  Any other character in this field will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "132",
    "narrativeText": "State of Destination Missing",
    "explanation": "The state of destination is transmitted in the 11 record, pos 61-62.  If this field is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "133",
    "narrativeText": "State of Destination Unknown",
    "explanation": "The state of destination is transmitted in the 11 record, pos 61-62.  If this field does not contain a valid, 2-character U.S. state code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "134",
    "narrativeText": "Def Tax Ind Must Be 1 or 2",
    "explanation": "The deferred tax indicator is transmitted in the 10 record, pos 45.  The only acceptable indicator is a \"1\" or \"2\".  Any other character in this field will result in this reject message.",
    "dateUpdated": null
  },
  {
    "conditionCode": "137",
    "narrativeText": "Surety Code Missing",
    "explanation": "When the surety code is required, it must be transmitted in the 31 record, pos 6-8.  If the entry type and bond type require a surety code and one is not transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "138",
    "narrativeText": "Surety Code Unknown",
    "explanation": "The surety code reported in the 31 record, pos 6-8, does not appear as a valid surety code on the surety database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "139",
    "narrativeText": "Bond Waiver Code Missing",
    "explanation": "If bond type 0 is transmitted in the 31 record, pos 3, a valid \"bond waiver reason code\" must be transmitted in pos 62-64 of the 10 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "140",
    "narrativeText": "Bond Waiver Reason Code Unknown",
    "explanation": "The bond waiver reason code, 10 record, pos 62-64, must be one of the allowable codes listed in table 4 of the ACE CATAIR.",
    "dateUpdated": null
  },
  {
    "conditionCode": "141",
    "narrativeText": "Bond Waiver Not Allowed -Ent Type",
    "explanation": "Bond waivers are only valid for specific entry types.  Usage Note \"i)\" in the ACE ABI CATAIR specifies the conditions and entry types that permit a request for a bond waiver (10 record, pos 38).  If the entry type does not permit a bond waiver, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "147",
    "narrativeText": "Cargo Rlse Cert Not Allwd-Consolidated",
    "explanation": "If an AE input contains one or more 32 records with entry numbers that have been previously released, the instant AE cannot be certified for cargo release (10 record, \"Y\" in pos 40), as the AE is merely reporting a consolidated summary for entries already released.  This error will also occur if no 32 records are included, but the cargo release indicator is present in pos 40.",
    "dateUpdated": null
  },
  {
    "conditionCode": "151",
    "narrativeText": "Missing Document Code Unknown",
    "explanation": "The missing document indicator(s) is transmitted in the 33 record, pos 3-4 and 5-6 (if necessary).  Only specific two character codes will be accepted in this field.  If other codes are transmitted, this error will result.  See Table 7 of the ACE ABI CATAIR for allowable codes",
    "dateUpdated": null
  },
  {
    "conditionCode": "152",
    "narrativeText": "Missing Document Duplicate Encountered",
    "explanation": "If a missing document code is reported in the 33 record, that code cannot be reported in both pos 3-4 and 5-6.",
    "dateUpdated": null
  },
  {
    "conditionCode": "153",
    "narrativeText": "1st Missing Document Code Cannot Be 99",
    "explanation": "If missing document(s) are reported in the 33 record, the first code must represent one of the missing documents listed in Table 4 or code 98 (other document not listed).  The second code, if applicable, be another missing document, or code 98, or code 99 (more than two documents missing.  However code 99 cannot be transmitted in pos 3-4 as the 'first missing document'.",
    "dateUpdated": null
  },
  {
    "conditionCode": "154",
    "narrativeText": "Continuous Bond Req for Reconciliation",
    "explanation": "An import entry being flagged for any type of reconciliation entry must provide a continuous bond indicator (\"8\") in the 10 record, pos 38.",
    "dateUpdated": null
  },
  {
    "conditionCode": "155",
    "narrativeText": "Reconciliation Issue Unknown",
    "explanation": "Reconciliation issues are identified in the 10 record, pos 47-49, using one of the 7 prescribed codes listed in the ACE CATAIR.  If any code other than an allowable code is transmitted in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "157",
    "narrativeText": "NAFTA Recon Ind Must Be Y",
    "explanation": "The request for a free-trade recon posting to an AE is transmitted in the 10 record, pos 46.  The only acceptable indicator is a \"Y\".  If any other character is used in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "158",
    "narrativeText": "Entry  Summary Already Reconciled",
    "explanation": "A reconciliation issue code has been transmitted on an eligible import entry, but that entry has already been reconciled on a type 09 entry.",
    "dateUpdated": null
  },
  {
    "conditionCode": "159",
    "narrativeText": "NAFTA Recon Not Allowed - Entry Type",
    "explanation": "A free trade reconciliation code was transmitted in pos 47-49 of the 10 record, but the entry type is not one that can be used to report an FTA reconciliation code.",
    "dateUpdated": null
  },
  {
    "conditionCode": "160",
    "narrativeText": "Other Recon Not Allowed - Entry Type",
    "explanation": "A reconciliation code was transmitted in pos 47-49 of the 10 record, but the entry type does not permit reporting a request for a reconciliation action.",
    "dateUpdated": null
  },
  {
    "conditionCode": "165",
    "narrativeText": "MOT Code Unknown",
    "explanation": "The MOT is transmitted in the 10 record, pos 36-37.  Only codes listed in Table 3 of the ACE CATAIR are allowed in this field.  If a code not listed in Table 3 is transmitted in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "166",
    "narrativeText": "Unlading D/P Unknown",
    "explanation": "The port of unlading is transmitted in the 20 record, pos 7-10.  The port code reported must be a valid port code which supports cargo processing.  If a port code is not valid for the MOT reported in the 10 record, pos 36-37, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "167",
    "narrativeText": "Unlading D/P Required for MOT",
    "explanation": "If the MOT in the 10 record, pos 36-37 is ocean/rail/air, a valid Schedule D port code is required in the 20 record, pos 7-10.",
    "dateUpdated": null
  },
  {
    "conditionCode": "168",
    "narrativeText": "Unlading D/P Not a Cargo Port",
    "explanation": "The port code for the port listed in the 20 record, pos 7-10, as the port of unlading is not operational as an unlading port in the RDP file.",
    "dateUpdated": null
  },
  {
    "conditionCode": "169",
    "narrativeText": "Unlading D/P Not a Vessel Cargo Port",
    "explanation": "The port of unlading in the 20 record, pos 7-10, is not valid for ocean shipments.",
    "dateUpdated": null
  },
  {
    "conditionCode": "170",
    "narrativeText": "Unlading D/P Not an Air Cargo Port",
    "explanation": "The port of unlading in the 20 record, pos 7-10, is not valid for air shipments.",
    "dateUpdated": null
  },
  {
    "conditionCode": "171",
    "narrativeText": "Est Arrival Date Not  Known Date",
    "explanation": "The estimated arrival date is transmitted in the 20 record, pos 11-16.  If a valid date in mmddyy format is not transmitted in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "172",
    "narrativeText": "Firms Code Unknown",
    "explanation": "The FIRMS code transmitted in the 20 record, pos 17-20, is not listed in the Facility Operator section of the Accounts tab as an entity.",
    "dateUpdated": null
  },
  {
    "conditionCode": "174",
    "narrativeText": "FIRMS Not a Cargo Location",
    "explanation": "The FIRMS code, transmitted in the 20 record, pos 17-20, is not a cargo location.  Customs' offices or administrative sites are not permitted to be used as reportable FIRMS locations.",
    "dateUpdated": null
  },
  {
    "conditionCode": "175",
    "narrativeText": "FIRMS Not an Active Facility",
    "explanation": "The FIRMS code transmitted in the 20 record, pos 17-20, is not on file in ACE as an active location.",
    "dateUpdated": null
  },
  {
    "conditionCode": "176",
    "narrativeText": "Carrier Code Missing",
    "explanation": "A carrier code is required for air/ocean shipments.  If the 20 record, pos 3-6 is left blank for MOT air or ocean, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "177",
    "narrativeText": "Carrier Code Unknown",
    "explanation": "If the carrier code field on the 20 record, pos 3-6, is not found on the CARL file, or is omitted entirely, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "178",
    "narrativeText": "Carrier Code Unknown Format",
    "explanation": "If the MOT is other than vessel or air, and the carrier code in the 20 record, pos 3-6, contains spaces between any of the transmitted characters (alpha or numeric), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "179",
    "narrativeText": "Carrier Not  Known IATA Code",
    "explanation": "The carrier code, transmitted in the 20 rec, pos 3-4 does not represent an air carrier that is listed on the CARL file read by ACE.  If the code does appear in CARL, check the CARS record to determine if the expiration date of the code is in the past.",
    "dateUpdated": null
  },
  {
    "conditionCode": "180",
    "narrativeText": "Vessel Code Not Allowed for MOT",
    "explanation": "The vessel code, which applies only to ocean vessels and is also known as the Lloyd's code, is transmitted in the 20 record, pos 41-47.  If the MOT transmitted in the 10 record, pos 36-37, is OTHER than 10 or 11, this error will result if a vessel code is transmitted.",
    "dateUpdated": null
  },
  {
    "conditionCode": "181",
    "narrativeText": "Conveyance Name Missing",
    "explanation": "For ocean shipments, a conveyance name is required in the 20 record, pos 21-40.  If the name is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "182",
    "narrativeText": "Bnd Waiver Reason Not Allowed-Ent Type",
    "explanation": "Bond waiver reason codes are only valid for specific entry types.  Usage Note \"i)\" in the ACE ABI CATAIR specifies the conditions and entry types that permit a request for a bond waiver (10 record, pos 38).  If the entry type does not permit a bond waiver, a bond waiver reason code is similarly not permitted.  If one is transmitted in the 10 record, pos 62-64, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "183",
    "narrativeText": "Manifest Detail Required for MOT",
    "explanation": "If the MOT in the 10 record, pos 36-37 is ocean/rail/air, an appropriate bill of lading, air waybill, rail bill, etc is required to be reported in the 23 record.  If that data is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "184",
    "narrativeText": "Manifest Detail Not Allowed W/O MOT",
    "explanation": "If an acceptable MOT (see Table 3 of the ACE CATAIR) is not reported in the 10 record, manifest detail information is not allowed to be reported in the 23 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "186",
    "narrativeText": "Mnfst Component Typ Must Be I, H, M, or S",
    "explanation": "The manifest component type is transmitted in the 23 record, pos 3.  Only four alpha characters are authorized for this field.  If any character other than I, M, H, or S is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "187",
    "narrativeText": "Mfst Components Out of Seq or Dup",
    "explanation": "A manifest component cannot be repeated with the same manifest component grouping of a 22 record plus up to 4 23 records. (cannot report the same bill number or the same inbond number more than once).  If the component is duplicated, this error will result.  Also, the sequence of data elements must be reported per note 1 for the 23 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "188",
    "narrativeText": "Unlad DP Cannot = Entry DP for Inbond",
    "explanation": "If the 23 record reports an inbond number (code \"I\" in pos 3), the unlading port (20 record, pos 7-10)  cannot be the same as the port of entry (10 record, pos 18-21).",
    "dateUpdated": null
  },
  {
    "conditionCode": "189",
    "narrativeText": "In-Bnd/Trn Date Not a Known Date",
    "explanation": "The inbond date is transmitted in the 20 record, pos 52-57.  If it is not in MMDDYY format and represents a valid date on the calendar, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "190",
    "narrativeText": "Import Date Cannot Be > In-Bnd/Trn Date",
    "explanation": "The import date is transmitted in the 11 record, pos 48-53  After the export date, it must be the earliest date reported of all the dates transmitted in the summary.  If the inbond date, for example, is earlier than the import date, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "192",
    "narrativeText": "In-Bnd/Trn Dt Cannot Be > 2 Yrs In Past",
    "explanation": "The inbond date reported in the 20 record, pos 52-57, cannot be more than 2 years earlier than the transmission date of the AE to CBP.",
    "dateUpdated": null
  },
  {
    "conditionCode": "193",
    "narrativeText": "Multiple Continuous  Bonds Not Allowed",
    "explanation": "If the ACE entry has a 31 record with bond type 8, a second 31 record, if transmitted, cannot use bond type 8 again.",
    "dateUpdated": null
  },
  {
    "conditionCode": "194",
    "narrativeText": "Dsgntd Exam Site Unknown",
    "explanation": "The DES is transmitted in the 20 record, pos 48-51.  This field must be a valid U.S. CBP port code, listed in Sched K.  If a port code in this field is not a valid Sch K code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "196",
    "narrativeText": "Dsgntd Exam Site Not Allowed-Not RLF",
    "explanation": "The filer has transmitted a designated exam site in the 20 record, pos 48-51. If the entry summary is not an RLF entry summary, this error will occur.",
    "dateUpdated": null
  },
  {
    "conditionCode": "197",
    "narrativeText": "Payment Type Code Unknown",
    "explanation": "Valid payment type codes, 10 record, pos 51, are 1 through 8.  Any other code in this field will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "199",
    "narrativeText": "Prelim Stmt Date Not Allowed",
    "explanation": "If the payment type indicator in the 10 record, pos 51 is a \"1\", then the payment date field, pos 52-57, must be blank.  If a payment date is included in this field with a payment type code of \"1\", this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "200",
    "narrativeText": "Periodic Stmt Month Not Allowed",
    "explanation": "If the payment type indicator in the 10 record, pos 51 is other than 6, 7, or 8, the payment month field, pos 58-59 of the 10 record must be blank. If any data is transmitted in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "201",
    "narrativeText": "Stmt Client Branch Not Allowed",
    "explanation": "If the 'branch' indicator on the filer's ABE record is not set to \"y\", inclusion of a branch indicator in the 10 record, pos 60-61, will cause this error.  ACE uses the port code in the B record to make this determination.",
    "dateUpdated": null
  },
  {
    "conditionCode": "202",
    "narrativeText": "Prelim Stmt Date Missing",
    "explanation": "If the filer transmits a payment type other than 1 in the 10 record, pos 51, a statement print date is required in pos 52-57.  If that date is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "203",
    "narrativeText": "Prelim Stmt Date Not a Known Date",
    "explanation": "The preliminary statement date is transmitted in mmddyy format.  Any other format will cause this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "204",
    "narrativeText": "Prelim Stmt Date is Sat, Sun, or Hol",
    "explanation": "The statement print date, transmitted in the 10 record, pos 52-57, cannot be on a Saturday, Sunday or designated federal holiday.  Local holidays will also generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "205",
    "narrativeText": "Prelim Stmt Date Must be in Future",
    "explanation": "The preliminary payment print date, transmitted in the 10 record, pos 52-57, must be at least one business day in the future.  If the date is in the past or equal to the transmission date of the summary, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "206",
    "narrativeText": "Prelim Stmt Date > 90 Days in Future",
    "explanation": "The statement print date, transmitted in the 10 record, pos 52-57, cannot be more than 90 days in the future, as compared to the system transmission date.",
    "dateUpdated": null
  },
  {
    "conditionCode": "207",
    "narrativeText": "Statement Processing Not Authorized",
    "explanation": "The filer's ACS ABE record has not been updated to operational status for statement processing.",
    "dateUpdated": null
  },
  {
    "conditionCode": "209",
    "narrativeText": "Periodic Statement Requires ACE Filer",
    "explanation": "10 rec, pos 51, contains the payment type indicator.  If type 6, 7, or 8 is used, the filer (broker or importer)  must be a PMS participant.",
    "dateUpdated": null
  },
  {
    "conditionCode": "210",
    "narrativeText": "Periodic Stmt Requires ACE Importer",
    "explanation": "10 rec, pos 51, contains the payment type indicator.  If type 6, 7, or 8 is used, the importer of record in the 11 rec, pos 3-14,  must be a PMS participant.",
    "dateUpdated": null
  },
  {
    "conditionCode": "211",
    "narrativeText": "Periodic Stmt Month Missing",
    "explanation": "If a filer elects to use PMS for an AE submission, the requested payment month must be transmitted in pos 58-59 of the 10 record. If payment type 6, 7, or 8 is transmitted in pos 51, and no payment month is included, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "212",
    "narrativeText": "Periodic Statement Month Unknown",
    "explanation": "The month of statement payment for a PMS statement is transmitted in the 10 record, pois 58-59.  That field must indicate \"01\" through \"12\".  Any other code in that field will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "213",
    "narrativeText": "Periodic Stmt Month Too Far Into Future",
    "explanation": "The periodic statement month is transmitted in the 10 record, pos 58-59. This field requires a two-numeric month indicator (01 through 12).  The month selected can be no further into the future than two months following the month of the release.",
    "dateUpdated": null
  },
  {
    "conditionCode": "214",
    "narrativeText": "STB Amount Not Allowed for Bond Type",
    "explanation": "f the filer indicates a continuous bond (\"B\" in pos 3 of the 31 record), the STB amount field (pos 19-28 of the 31 record) must be blank.",
    "dateUpdated": null
  },
  {
    "conditionCode": "215",
    "narrativeText": "Prelim Stmt Day > Periodic Stmt Day",
    "explanation": "If the filer transmits a periodic statement print date that is after the date that the periodic monthly statement will generate for the statement month requested, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "216",
    "narrativeText": "Prelim Stmt for Date Already Produced",
    "explanation": "If the AE  contains a statement print date (10 record, pos 52-57) that is equal to or earlier than the date of transmission of the AE, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "217",
    "narrativeText": "Pymt Info Not Allwd - Post Pymnt Corrctn",
    "explanation": "Once an ACE entry summary has been paid in via statement/ACH acceptance, a retransmission of the summary cannot reference any data in the statement payment fields (cannot use any payment type nor any date in the payment date field)  This error will also occur if an ACE summary is rejected by CBP prior to the scheduled payment date.",
    "dateUpdated": null
  },
  {
    "conditionCode": "218",
    "narrativeText": "Estimated Entry Dt Cannot Be > Stmt Dt",
    "explanation": "The estimated entry date is transmitted in the 11 record, pos 42-47.  This date cannot be later than the statement print date, transmitted in the 10 record, pos 52-57.",
    "dateUpdated": null
  },
  {
    "conditionCode": "219",
    "narrativeText": "Stmt Client Branch Missing",
    "explanation": "If the filer's ABE profile is set to \"Y\" in the branch field, a branch indicator is always required in the 10 record, pos 60-61.  If the branch indicator is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "220",
    "narrativeText": "Elec Invoice Indicator Must Be Y",
    "explanation": "The indicator that the filer is submitting an electronic entry is transmitted in the 10 record, pos 41.  The only acceptable value for this field is a \"Y\".  Any other character will cause this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "222",
    "narrativeText": "Elec Invoice Requires Summary on Stmt",
    "explanation": "An ACE entry summary which reports a Y in pos 41 of the 10 record, indicating an electronic entry, must be scheduled for statement (ACH) processing in pos 51 of the 10 record.  If a '1' is transmitted in pos 51 for such an entry, this error will result. If the entry is a PSC filing, the requirement for an electronic entry to be scheduled for ACH is waived and position 51 of the 10 record must be blank.",
    "dateUpdated": null
  },
  {
    "conditionCode": "223",
    "narrativeText": "Cont Superseded Bond Ind Not Allowed",
    "explanation": "If a filer wishes to report a superseding continuous bond, the indicator to be transmitted for this purpose is \"Y\" in pos 5 of the 31 record.  Any other character in this field will generate this reject message.",
    "dateUpdated": null
  },
  {
    "conditionCode": "224",
    "narrativeText": "Elec Invoice Requires Continuous Bond",
    "explanation": "If an AE has a \"y\" in pos 41 of the 10 record, indicating an electronic entry, a continuous bond must be obligated.  If the 10 record, pos 38, does not show \"8\", this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "225",
    "narrativeText": "Elec Invoice Not  Allowed - Ent D/P Not AII",
    "explanation": "The transmitted port of entry is not eligible for EIP or RLF processing.",
    "dateUpdated": null
  },
  {
    "conditionCode": "226",
    "narrativeText": "Elec Invoice Not  Allowed - Filer Not AII",
    "explanation": "The filer's ABE record was not set to operational for AII prior to the transmission of an AE with \"y\" in pos 41 of the 10 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "227",
    "narrativeText": "Correction Requires  Elec Invoice",
    "explanation": "If an ACE entry summary which has been accepted by CBP is an electronic entry, any further transmissions of that entry number must include a 42 record with an invoice number.  If the AE is transmitted without a 42 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "228",
    "narrativeText": "Consolidated Summ Ind Must Be Y",
    "explanation": "A consolidated entry summary is indicated by an indicator in the 10 record, pos 42.  The only acceptable value for this field is a \"Y\".  Any other indicator will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "232",
    "narrativeText": "Release Detail Missing",
    "explanation": "If the AE has a \"Y\" in pos 42 of the 10 record, indicating that this summary is a consolidated summary, there must be at least one 32 record listing at least two entry numbers.",
    "dateUpdated": null
  },
  {
    "conditionCode": "233",
    "narrativeText": "Release Detail Not Allowed",
    "explanation": "If a 32 record is included in an entry summary and pos 42 of the 10 record is not transmitted with a \"Y\", this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "234",
    "narrativeText": "Rlse Entry Filer Code Missing",
    "explanation": "A consolidated entry is reported in the 32 record.  The filer code of the entry is required for each entry number reported.  If the filer code is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "235",
    "narrativeText": "Rlse Entry Number Missing",
    "explanation": "Entry numbers reported as part of a consolidated summary are listed in the 32 record.  The filer code of each release must be accompanied by the actual entry number.  If a release filer code is transmitted without the associated entry number, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "236",
    "narrativeText": "Rlse Entry Filer Not = Cnsldtd Filer",
    "explanation": "Released entries reported in the 32 record must have the same filer code as the filer of the consolidated summary.  If a different filer code is reported in any of the 'filer code' fields in the 32 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "237",
    "narrativeText": "Rlse Entry Not Previously Established",
    "explanation": "If a consolidated entry is indicated in the 10 record, pos 42, any entry numbers listed in the 32 record must be on file in ACE has having a release associated with that entry number(s).  If there is no release on file for the listed entry number(s), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "239",
    "narrativeText": "Rlse Entry Nbr = To Cnsldtd Ent Nbr",
    "explanation": "Consolidated entries must use a different entry number from any of the consolidated releases reported in the 32 record.  If the entry numbers are the same, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "240",
    "narrativeText": "Bond Amount Cannot Be $0",
    "explanation": "The bond amount for a single transaction bond is transmitted in the 31 record, pos 9-18.  That field cannot reflect zero as the bond amount.",
    "dateUpdated": null
  },
  {
    "conditionCode": "241",
    "narrativeText": "Rlse Entry Not A Release",
    "explanation": "The 32 record lists one or more entry numbers that have not been established in the cargo selectivity file to be reviewed for a release.",
    "dateUpdated": null
  },
  {
    "conditionCode": "246",
    "narrativeText": "Cont Superseded Bond Ind Must Be Y",
    "explanation": "If the filer wishes to report a superseding bond, pos 5 of the 31 record must be \"Y\".  If no superseding bond is reported, the position should be space filled.  If any character other than a \"Y\" is transmitted in pos 5, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "248",
    "narrativeText": "Acct Class Code Missing",
    "explanation": "If a fee is reported at the header level for the AE input (informal entry fee, for example), in a 34 record, the 89 record for the same accounting code is required.  If the 89 record omits the code used in the 34 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "249",
    "narrativeText": "Acct Class Code Unknown",
    "explanation": "Classification codes for fees are reported in the appropriate record (34, 62, and 89).  The class code must be a valid, pre-established code.  If a code that is not currently on file is used in one of these records, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "250",
    "narrativeText": "Acct Class Code Not Allowed",
    "explanation": "Certain fee class codes must be reported in the 62 record and others are reported in the 34 record.  If a code that is reportable only in the 34 record is reported in a 62 record, or vice versa, this error will result. Further, if the same class code is reported twice (identical 62 records, e.g.) this error will also be generated.  Also, if the fee is not reportable due to exemptions that exist (LDDC, NAFTA country), this error will be issued if the fee is reported.",
    "dateUpdated": null
  },
  {
    "conditionCode": "252",
    "narrativeText": "User Fee Amount Missing",
    "explanation": "If a header level (34 record) fee code is transmitted, but the fee amount is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "253",
    "narrativeText": "User Fee Amount Contains Non-Numerics",
    "explanation": "If spaces are sent in a user fee field, this error will result.  Only numeric characters are allowed.",
    "dateUpdated": null
  },
  {
    "conditionCode": "254",
    "narrativeText": "Duplicate Account Class Encountered",
    "explanation": "The same accounting class code (for fees) cannot appear in the 89 record more than once.  In the AE that caused this reject, the filer sent 000 in the entire record, so ACE read each set of 000 that appeared in the 2nd and subsequent class code fields(pos 17-19,31-33, etc) as a duplicate fee class code.",
    "dateUpdated": null
  },
  {
    "conditionCode": "258",
    "narrativeText": "Manifest Qty Must Be > Zero",
    "explanation": "If the field for quantity is completed in the 22 record, pos 3-10, it must be a whole number greater than zero.",
    "dateUpdated": null
  },
  {
    "conditionCode": "259",
    "narrativeText": "Manifest Qty Missing",
    "explanation": "For an MOT that requires manifest quantity reporting, the 22 record, pos 3-10, must reflect a quantity (greater than zero).  If the field is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "260",
    "narrativeText": "Manifest Qty UOM Missing",
    "explanation": "If any quantity is transmitted in the 22 record, a unit of measure for that quantity is required in pos 11-15.",
    "dateUpdated": null
  },
  {
    "conditionCode": "261",
    "narrativeText": "In-Bnd/Trn Dt Req'd with In-Bnd/Trn Nbr",
    "explanation": "If the 23 record reports an inbond number (code \"I\" in pos 3), an inbond origination date is required.  This is transmitted in the 20 record, pos 52-57.  If the date is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "262",
    "narrativeText": "In-Bnd/Trn Dt Not Allowed W/O In-Bnd Nbrs",
    "explanation": "If the filer transmits an inbond date in the 20 record, pos 52-57, there must be a 23 record with manifest component type I and a valid inbond number.  If the inbond number is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "263",
    "narrativeText": "Payment Type Code Missing",
    "explanation": "All AE entry summaries must indicate a payment type code in the 10 record, pos 51.  If this field is blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "264",
    "narrativeText": "Manifest Qty Contains Non-Numerics",
    "explanation": "The quantity field in the 22 record, pos 3-10, can only include numeric characters.",
    "dateUpdated": null
  },
  {
    "conditionCode": "265",
    "narrativeText": "Bond amount missing",
    "explanation": "If a type '9' bond is transmitted, the 31 record must include the amount of the single transaction bond in pos 9-18.  If that field is blank or zero filled, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "266",
    "narrativeText": "Bond Designation Must Be A or B",
    "explanation": "The 31 record transmits bond information, including whether the bond is a basic bond ('b\") for the entry or an additional bond (\"a\") for AD/CVD requirements.  Any code besides 'a' or 'b' will reject with this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "267",
    "narrativeText": "Continuous Bond Must Be for Basic Use",
    "explanation": "If a continuous bond is reported in the 31 record, its bond designation type code must be \"B\", for basic.   A continuous bond cannot be reported as an additional bond, code \"A\".",
    "dateUpdated": null
  },
  {
    "conditionCode": "268",
    "narrativeText": "STB Must be Designated Additional",
    "explanation": "If the filer elects to report two 31 records, one must be designated for additional bond coverage (code A in pos 4).  If two 31 records are transmitted with code \"B\" in pos 4, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "269",
    "narrativeText": "Basic Bond Missing",
    "explanation": "For entry types which require a bond, at least one 31 record is required and must reference 'bond designation type code\" B.  If only one 31 record transmitted in the AE and does not reference code \"B\", this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "270",
    "narrativeText": "Cnsldtn Not Allowed - PSC",
    "explanation": "A PSC filing is not permitted to include a list of consolidated entry releases in a 32 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "271",
    "narrativeText": "Cargo Rlse Cert Not Allowed PSC",
    "explanation": "A post entry summary correction (PSC) cannot be transmitted with a certification for cargo release in the 10 record, pos 40.",
    "dateUpdated": null
  },
  {
    "conditionCode": "272",
    "narrativeText": "Live Ind Not Allowed - PSC",
    "explanation": "A PSC filing cannot include the 'live' entry indicator in the 10 record, pos 44.",
    "dateUpdated": null
  },
  {
    "conditionCode": "275",
    "narrativeText": "Accelerated Liq Req Ind Unknown",
    "explanation": "A request for accelerated liquidation on a PSC can only be a \"Y\".  Any other character in this field (10 record, pos 66) will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "276",
    "narrativeText": "Accelerated Liq Req Ind Not Allowed",
    "explanation": "A conventional ACE entry summary cannot have any data in position 66 of the 10 record.  This is reserved for use in a PSC.",
    "dateUpdated": null
  },
  {
    "conditionCode": "277",
    "narrativeText": "PSC Filing Explanation Not Allowed",
    "explanation": "A conventional ACE entry summary cannot include a 36-record (the PSC filing explanation).  This is reserved for use in a PSC submission.",
    "dateUpdated": null
  },
  {
    "conditionCode": "278",
    "narrativeText": "Header PSC Code Unknown",
    "explanation": "A PSC was transmitted with a header reason code not found in Table 14 of the ACE Entry Summary Create/Update chapter of the ACE CATAIR.",
    "dateUpdated": null
  },
  {
    "conditionCode": "279",
    "narrativeText": "Hdr PSC Code  Duplicate Encountered",
    "explanation": "A PSC filing has reported two or more identical header reason codes.",
    "dateUpdated": null
  },
  {
    "conditionCode": "280",
    "narrativeText": "FIRMS Not Allowed - PSC",
    "explanation": "A Facilities Information and Resources Management System (FIRMS) code is not permitted to be included in a PSC transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "281",
    "narrativeText": "Enttype No Chng - PSC Reas Not Allowed",
    "explanation": "A PSC was transmitted with the same entry type as the conventional entry but included a reason code for a change to the entry type (H01/H03)",
    "dateUpdated": null
  },
  {
    "conditionCode": "282",
    "narrativeText": "Enttype Changed - PSC Reason Missing",
    "explanation": "A PSC transaction has changed the entry type, but no header reason code has been included in the PSC transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "283",
    "narrativeText": "Hdr Changed - PSC Reasons Missing",
    "explanation": "A PSC transaction changed one or more header elements and no 35 record was included to report one of the header change reason codes.",
    "dateUpdated": null
  },
  {
    "conditionCode": "284",
    "narrativeText": "Header PSC Reasons Not Allowed",
    "explanation": "A conventional ACE entry summary cannot report PSC Header reason codes (35 record).",
    "dateUpdated": null
  },
  {
    "conditionCode": "287",
    "narrativeText": "PSC Filing Explanation Missing",
    "explanation": "A PSC was transmitted without an explanation for the change being included via the 36 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "400",
    "narrativeText": "Line Item(s) Missing",
    "explanation": "If the summary action filing request code in the 10 record, pos 3 is 'a' or 'r', line item data is required, starting in the 40 record.  If no line item data is provided, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "402",
    "narrativeText": "Line Item Identifier Missing",
    "explanation": "Each 40 record must have a unique identifier, in pos 5-7.  If the line item identifier is missing, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "403",
    "narrativeText": "Article Set Ind Must Be X or V",
    "explanation": "The indicator for a set is transmitted in the 40 record, pos 8.  The only acceptable indicators are \"X\" or \"V\".  If another character is transmitted in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "404",
    "narrativeText": "Set Component Not Preceded by Set Hdr",
    "explanation": "If line item details reported in the 40 record, pos 8 with a \"v\" are transmitted without a preceding 40 record with an \"x\" in pos 8, this error will result.  There cannot be two or more \"v\" lines without an \"x\" line before the first \"v\" line.",
    "dateUpdated": null
  },
  {
    "conditionCode": "405",
    "narrativeText": "Prev Set Incomplete;Component Missing",
    "explanation": "If a tariff line is identified as a set header (\"x\" in 40 record, pos 8), the next tariff line must repeat the tariff number and use identifier \"v\" in pos 8.  If the 2nd tariff line omits the \"v\" in the 40 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "406",
    "narrativeText": "First Set Component/Header Mismatch",
    "explanation": "The tariff number transmitted in the first \"V\"-indicated 50 record is not the same number as reported in the \"X\"-indicated 50 record which precedes the first V line.",
    "dateUpdated": null
  },
  {
    "conditionCode": "407",
    "narrativeText": "Country of Origin Missing",
    "explanation": "The country of origin must be transmitted in the 40 record, pos 9-10.  If it is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "408",
    "narrativeText": "Country of Origin Unknown",
    "explanation": "If the country of origin is reported in pos 9-10 of the 40 record using any data other than a valid ISO country code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "409",
    "narrativeText": "Restricted Country",
    "explanation": "If the country of origin, transmitted in the 40 record, pos 9-10, is coded as 'restricted' on the ACE country file, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "410",
    "narrativeText": "Country of Export Missing",
    "explanation": "If the 40 record, pos 11-12 is blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "411",
    "narrativeText": "Country of Export Unknown",
    "explanation": "If the country of export transmitted in the 40 record, pos 11-12, is not one of the valid ISO country codes, this error will result.  Note that Canadian province codes are NOT valid for country of export reporting, nor is \"US\".  Also occurs if c/e is \"**\"",
    "dateUpdated": null
  },
  {
    "conditionCode": "413",
    "narrativeText": "Origin Country Cannot Be Unknown",
    "explanation": "If the country of origin is transmitted as \"**\", and the country of export is also not a valid ISO country code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "415",
    "narrativeText": "Related Party Ind Must Be Y or N",
    "explanation": "The related party indicator is transmitted in the 40 record, pos 56.   The indicator is required for entry type 01.  If the field is left blank on entry type 01, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "416",
    "narrativeText": "Trade Agree/Spec Pgm Claim Cd Unknown",
    "explanation": "Trade Agreements or Special Program indicators are transmitted in the 40 record, pos 25-26.  Only codes published with tariff numbers may be transmitted in this field.  If other codes are sent, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "418",
    "narrativeText": "Export Date Missing",
    "explanation": "The export date is transmitted in the 40 record, pos 11-12.  If that date is omitted for an entry type that requires an export date, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "419",
    "narrativeText": "Export Date Not a Known Date",
    "explanation": "The date of export is transmitted in the 40 record, pos 13-18 and must be in MMDDYY format.  If the date is not in this format and is a valid date on the calendar, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "420",
    "narrativeText": "Export Dt Cannot Be > In-Bnd/Trn Dt",
    "explanation": "The date of export transmitted in the 40 record, pos 13-18 cannot be greater than (that is, cannot be later than) the date of any reported inbond number in the 20 record, pos 52-57.",
    "dateUpdated": null
  },
  {
    "conditionCode": "421",
    "narrativeText": "Gross Shp Wgt Contains Non-numerics",
    "explanation": "Gross shipping weight is transmitted in the 40 record, pos42-51.  If this field is left blank, this error will result.  Zeroes can be transmitted if gross shipping weight does not apply to the entry, but the field cannot be space filled.",
    "dateUpdated": null
  },
  {
    "conditionCode": "422",
    "narrativeText": "FTA Ned Cost Ind Must Be Y",
    "explanation": "If a FTA net cost claim is made, the 40 record, pos 57, must be a \"Y\".  Any other character will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "423",
    "narrativeText": "Fee Exemption Code Must Be 1 or 2",
    "explanation": "The indicator which claims exemption from a fee is transmitted in the 40 record, pos 58.  The only acceptable indicators are a 1 or a 2.  Any other character transmitted in this field will cause this rejection.",
    "dateUpdated": null
  },
  {
    "conditionCode": "424",
    "narrativeText": "Charges Contains Non-Numerics",
    "explanation": "Charges are transmitted in the 40 record, pos 27-36.  Only numeric characters are permitted in this field.  If any other character is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "425",
    "narrativeText": "Category Code unknown",
    "explanation": "40 rec, pos 52-54 requires a valid textile category from the HTS file.  If a category number not shown on the HSA record for the tariff number is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "426",
    "narrativeText": "Export Date Cannot Be > Import Date",
    "explanation": "The date of export transmitted in the 40 record, pos 13-18 cannot be later (greater than) the date of import in the 11 record, pos 48-53.",
    "dateUpdated": null
  },
  {
    "conditionCode": "427",
    "narrativeText": "Export Date Cannot Be > Flr Ent Date",
    "explanation": "If the entry date has been revised by an ACS 'DN' transaction, the AE entry summary date of export cannot be greater (later than) the revised entry filer date.",
    "dateUpdated": null
  },
  {
    "conditionCode": "428",
    "narrativeText": "Foreign port unknown",
    "explanation": "40 rec, pos 37-41 requires a valid sch K port code.  If a code that is not on the Sch K list is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "429",
    "narrativeText": "Foreign Port Req'd for MOT",
    "explanation": "Ocean shpments require a Sch K foreign port of lading to be reported in the 40 record, pos 37-41.  If this field is omitted for MOT 10 or 11, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "430",
    "narrativeText": "Textile Export Date Not a Known Date",
    "explanation": "The textile export date, 40 record, pos 19-24, must be a valid date in MMDDYY format.",
    "dateUpdated": null
  },
  {
    "conditionCode": "431",
    "narrativeText": "Tariff/Value/Quantity Detail Missing",
    "explanation": "For every 40 record transmitted, there must be at least one 50 record to report a tariff number, value and quantity.",
    "dateUpdated": null
  },
  {
    "conditionCode": "432",
    "narrativeText": "HTS Nbr Missing",
    "explanation": "If the 50 record, pos 3-12, is blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "433",
    "narrativeText": "HTS Nbr Unknown",
    "explanation": "The tariff number reported in the 50 record, pos 3-12, is not on file in the tariff database.  If the tariff number is 8 digits, the last two positions of this record must be space filled.",
    "dateUpdated": null
  },
  {
    "conditionCode": "434",
    "narrativeText": "HTS Number Not Active",
    "explanation": "The tariff number reported in the 50 record, pos 3-12, is not on file in the tariff database as of the duty comp date used in the summary (estimated entry, etc).",
    "dateUpdated": null
  },
  {
    "conditionCode": "436",
    "narrativeText": "Duplicate HTS Number Encountered",
    "explanation": "Each 50 record must report a unique HTS number for a given line.  If a tariff number is repeated in a 50 record, this error will result.  Note: this does not apply to chapter 9802 numbers for commodities such as watches or clocks, but the 9802 HTS cannot be transmitted in consecutive 50 records",
    "dateUpdated": null
  },
  {
    "conditionCode": "437",
    "narrativeText": "Value Contains Non-Numerics",
    "explanation": "The value of an article is reported in the 50 record, pos 25-34.  If this field contains spaces in any position, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "438",
    "narrativeText": "Duty Contains Non-Numerics",
    "explanation": "The duty amount reported in the 50 record(s), pos 14-23, must reflect only numeric characters.  Any other character will cause this error.  Also, if a space is transmitted between two numeric characters or before or after a numeric, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "440",
    "narrativeText": "Quantity Contains Non-Numerics",
    "explanation": "The quantity field(s) in the 50 record (pos 36-47, 51-62, and 66-77), can only include numeric characters.",
    "dateUpdated": null
  },
  {
    "conditionCode": "446",
    "narrativeText": "Invoice Detail Missing",
    "explanation": "If the entry summary reports code \"Y\" in pos 41 of the 10 record, ACE will expect the related invoice data to be reported in the 42 record.  If no 42 record is provided, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "447",
    "narrativeText": "Invoice Detail Not Allowed",
    "explanation": "If the entry summary is not coded as an electronic summary ('y' in position 41 of the 10 record), the filer may not include a 42 record, \"invoice line reference detail\".",
    "dateUpdated": null
  },
  {
    "conditionCode": "448",
    "narrativeText": "Invoice Nbr Missing",
    "explanation": "If a 42 record is transmitted, an invoice number, pos 18-34, is required in addition to the supplier ID.  If no invoice number is reported, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "449",
    "narrativeText": "Invoice Number Ineligible",
    "explanation": "The invoice number element of the 42 record, pos 18-34, cannot contain a space or other non-alphanumeric character.  If spaces or non-numerics are included in this field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "450",
    "narrativeText": "Foreign Exporter Unknown",
    "explanation": "The foreign exporter is reported in the 47 record, using code \"E\" in pos 3.  If the exporter MID is not on file in the CBP MID database, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "451",
    "narrativeText": "Supplier ID Code Missing",
    "explanation": "The invoice detail record (42) must include a supplier ID code (MID) in pos 3-17.  If that code is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "455",
    "narrativeText": "Invoice Line Range(s) Missing",
    "explanation": "Electronic invoice data transmitted in the 42 record must have at least one line number range, starting in pos 36-39 fro the beginning line number and ending in pos 41-44 for the ending line number.  If this range is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "456",
    "narrativeText": "Invoice Line Range Contains Non-Numerics",
    "explanation": "An invoice line requires at least one beginning range number (42 record, pos 36-39) and an ending range number (pos 41-44).  If the beginning range is supplied, but the ending range is not transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "457",
    "narrativeText": "Invoice Line Nbr Cannot Be Zero",
    "explanation": "The invoice beginning and ending line numbers are transmitted in the 42 record.  This field represents the line numbers on an invoice that apply to the entry summary line.  The invoice line number must begin with \"1\".  If a zero is reported in an invoice line number field, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "458",
    "narrativeText": "Begin Ln Nbr Cannot be GT End for Range",
    "explanation": "The beginning line number for an invoice (42 record, pos 36-39) cannot be a higher number than the ending line number in pos 41-44 (and so on for the other line ranges in the 42 record)",
    "dateUpdated": null
  },
  {
    "conditionCode": "459",
    "narrativeText": "Line Range Overlap Found on Invoice",
    "explanation": "The invoice number referenced on the 42 record cannot reflect the same invoice line number or range of line numbers on the same line (40 record) of the entry summary.",
    "dateUpdated": null
  },
  {
    "conditionCode": "460",
    "narrativeText": "Ruling Type Code Missing",
    "explanation": "If a 43 record is transmitted, a ruling type code is required in pos 3.  If a code is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "461",
    "narrativeText": "Ruling Type Code Unknown",
    "explanation": "The 43 record is used to transmit an administrative ruling.  Three codes are available to indicate which type of ruling is being reported.  The codes are listed in the ACE ABI CATAIR, page ESF-42.  If a code other than C, P, or R is transmitted in pos 3 of the 43 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "464",
    "narrativeText": "Comm Desc Text Missing",
    "explanation": "If a 44 record is included in the AE transaction, there must be text for the commercial description in pos 3-72.",
    "dateUpdated": null
  },
  {
    "conditionCode": "468",
    "narrativeText": "Standard Visa Country Unknown",
    "explanation": "The visa number is transmitted in the 51 record, pos 3-11.  If pos 4-5 of the record does not contain a valid ISO country code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "469",
    "narrativeText": "Standard Visa Seq Not Numeric",
    "explanation": "In the 51 record, the visa number must have 6 numerics in pos 6-11.",
    "dateUpdated": null
  },
  {
    "conditionCode": "470",
    "narrativeText": "Standard Visa Year Unknown",
    "explanation": "In the 51 record, the visa year must represent a valid numeric year with 0-9 in pos 3.  If any other character, or a blank, is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "471",
    "narrativeText": "Lic/Cert/Perm Type Code Missing",
    "explanation": "The type of license, certificate or permit transmitted in the 52 is sent in pos 3-4.  This is a mandatory field in the 52 record and its omission will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "472",
    "narrativeText": "Lic/Cert/Perm Type Code Unknown",
    "explanation": "License/certificate/permits are transmitted in the 52 record.  Each such item must be described by a valid type code in pos 3-4 of this record.  The acceptable codes are listed in the ACE ABI CATAIR record layout for the 52 record.  The inclusion of a type code other than one listed in the current version of the CATAIR will cause this rejection message.",
    "dateUpdated": null
  },
  {
    "conditionCode": "473",
    "narrativeText": "Duplicate Line/Cert/Perm Type Code",
    "explanation": "If more than 52 record reports the same license or permit code for the same line, this error will result.  As of Feb 2013, ACE does not permit more than 1 52 record per entry line, so this error will not be in production until a future date.",
    "dateUpdated": null
  },
  {
    "conditionCode": "474",
    "narrativeText": "Lic/Cert/Perm Number Missing",
    "explanation": "The license, certificate or permit number is transmitted in the 52 in pos 5-14.  If a license, certificate or permit type code is present in pos 3-4 of this record, the actual license, certificate, or permit number must be included or this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "475",
    "narrativeText": "Non-Reimburse Stmnt Must Be Space or Y",
    "explanation": "The AD/CVD non-reimbursement statement is optional for the filer.  If used, only a \"Y\" is allowed in pos 60 of the 40 record.  Any other character will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "477",
    "narrativeText": "IR Tax Contains Non-Numerics",
    "explanation": "If the IR tax submitted in the 60 record, pos 6-15, contains non-numeric characters or blanks, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "480",
    "narrativeText": "HMF Not Allowed - Set Component",
    "explanation": "HMF cannot be reported on the 'V' lines for a set.  Only the 'X' lines can reflect HMF.",
    "dateUpdated": null
  },
  {
    "conditionCode": "481",
    "narrativeText": "HMF Not Allowed For Entry Type",
    "explanation": "HMF cannot be reported on an informal entry (type 11), an FTZ entry (06) or warehouse withdrawal entries type 31, 32, 34, and 38.",
    "dateUpdated": null
  },
  {
    "conditionCode": "482",
    "narrativeText": "HMF Not Allowed for MOT",
    "explanation": "HMF cannot be reported on an entry that reports MOT other than 10,  11 or 12.",
    "dateUpdated": null
  },
  {
    "conditionCode": "483",
    "narrativeText": "Mfgr Code Missing-Req'd for Entry Type",
    "explanation": "An MID is required for entry type 01 AE transactions.  If there is no 47 record with code \"m\" and an MID included in the entry summary input, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "484",
    "narrativeText": "Census Warning Cond Cd Unknown",
    "explanation": "Census warning condition codes (see Table 10 of the ACE CATAIR) are transmitted in the CW02 record.  If the code transmitted in pos 10-12 is not listed in Table 10, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "485",
    "narrativeText": "Census Warning Cond not found for ovrd",
    "explanation": "The CW record Census warning code is transmitted in the CW02 record, starting in pos 10-12.  If this code, or any other code transmitted in the CW02 record, is not one that has occurred during processing of the ACE entry summary, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "486",
    "narrativeText": "Census Warning Cond Ovrd Cd Unknown",
    "explanation": "The Census warning override code is transmitted in the CW02 record, pos 13-14.   If a warning condition is reported in pos 10-12, a warning override code is required in pos 13-14.  If no code, or a code not found in table 10, is transmitted in this record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "487",
    "narrativeText": "Census Ovrd Cd Not Allowed for Condition",
    "explanation": "Each Census warning code (27 series) can be overriden with a specific override code, listed in Table 11 of the ACE CATAIR.  For a given Census warning only the permitted codes will be accepted in the CW02 record.  If a code is transmitted that does apply to the Census warning message, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "488",
    "narrativeText": "Duplicate Census Warning CD Encountered",
    "explanation": "Within the same CW02 record, a Census Warning code cannot be repeated.",
    "dateUpdated": null
  },
  {
    "conditionCode": "505",
    "narrativeText": "Consignee Missing - Req'd for Type",
    "explanation": "A 47 record with an article-party-type-code of C and an appropriate consignee identification number is required for most entry types (certain informal entries may use all zeros for the consignee).",
    "dateUpdated": null
  },
  {
    "conditionCode": "507",
    "narrativeText": "AD/CVD Case Not Allowed - Set Header",
    "explanation": "If an entry line is a set header line (\"x\" in pos 8 of the 40 record) and the line reports an AD/CVD case in the 53 record, this error will result.   The case must be reported on the entry line with a \"v\" in pos 8.",
    "dateUpdated": null
  },
  {
    "conditionCode": "509",
    "narrativeText": "AD/CVD Case Not Allowed For  Article",
    "explanation": "Any line on a summary that invokes tariff 98020040 or 98020050 cannot be subject to AD/CVD reporting.  If case data is provided in the 53 record for such a line, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "511",
    "narrativeText": "Bond/Cash Claim Must Be B or C",
    "explanation": "In the 53 record, pos 13, the filer indicates whether the reported AD/CVD case is covered by a cash deposit or may be bonded.  The only acceptable codes for this reporting are B or C.  Any other character transmitted in pos 13 will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "518",
    "narrativeText": "Duplicate Line Identifier Encountered",
    "explanation": "AE summaries indicate different tariff lines by the line counter in the 40 record, pos 5-7.  If a previously reported line number is used on a subsequent line, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "519",
    "narrativeText": "Article Party Type Unknown",
    "explanation": "The article party is transmitted in the 47 record.  Only four article party type codes are permitted: M (manufacturer), S (sold-to), C (delivered-to) and E (exporter).  Any other party type code will be rejected.",
    "dateUpdated": null
  },
  {
    "conditionCode": "520",
    "narrativeText": "Duplicate Party Type Encountered",
    "explanation": "If the same consignee number is reported in more than one 47 record per entry summary line, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "521",
    "narrativeText": "Article Party Identifier Missing",
    "explanation": "If a 47 record includes an Article Party Type code in pos 3, an identifier for the party type code is required in pos 4-18.  If that field is left blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "522",
    "narrativeText": "Ult Consignee Nbr Not Allowed W/O Hdr",
    "explanation": "If the 11 record consignee field (pos 15-26) is blank, one or more 47 records with article party type code \"C\" is not permitted.",
    "dateUpdated": null
  },
  {
    "conditionCode": "523",
    "narrativeText": "Mfg Code Unknown",
    "explanation": "The MID transmitted on the 47 record is not found in the ACE MID database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "526",
    "narrativeText": "Addtnl Declaration Type Code Unknown",
    "explanation": "The 54 record is used to report additional declarations to ACE.  The only type code permitted as of May 2009 is '01' for Canadian Softwood Lumber imports.  If any type code other than '01' is transmitted in the 54 record, pos 3-4, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "527",
    "narrativeText": "Softwood Declaration Must Be Y or N",
    "explanation": "The softwood lumber declaration indictor is transmitted in position 5 of the 54 record.  The only two acceptable indicators are \"Y\" or \"N\".  Any other indicator, including a space in pos 5, will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "528",
    "narrativeText": "Softwood Price Contains Non-numerics",
    "explanation": "If the filer reports softwood lumber information in the 54 record, a dollar value is required in pos 6-15 for the 'softwood lumber export price' field.  If the field is blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "529",
    "narrativeText": "Softwood Charges Contains Non-numerics",
    "explanation": "If softwood lumber charges are reported in the 54 record, pos 16-25, only numeric characters are permitted.",
    "dateUpdated": null
  },
  {
    "conditionCode": "531",
    "narrativeText": "IR Tax  Acct Class Code Missing",
    "explanation": "The class code for reporting IR tax amounts must be reported in the 60 record, in pos 3-5.   If the class code is not transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "533",
    "narrativeText": "IR Tax Acct Class Code Not Allowed",
    "explanation": "The IR tax accounting class codes are based on the code attached to the tariff number.  The codes are transmitted in the 60 record, pos 3-5.  If the submitted code is not listed on the tariff number database record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "535",
    "narrativeText": "Mfgr Code Prefix Must Be Canadian Prov",
    "explanation": "If the country of origin is Canada, the MID must start with one of the valid province codes.  Any other code will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "536",
    "narrativeText": "Case Deposit Rate Contains Non-Numerics",
    "explanation": "The case deposit rate is transmitted in the 53 record, pos 14-21.  Only numeric characters can be transmitted for this field.",
    "dateUpdated": null
  },
  {
    "conditionCode": "537",
    "narrativeText": "AD/CVD Value Contains Non-Numerics",
    "explanation": "The AD/CVD value field in the 53 record, pos 25-34, can only contain numeric characters.",
    "dateUpdated": null
  },
  {
    "conditionCode": "538",
    "narrativeText": "AD/CVD Qty Contains Non-Numerics",
    "explanation": "The AD/CVD quantity field in the 53 record, pos 35-46, can only contain numeric characters.",
    "dateUpdated": null
  },
  {
    "conditionCode": "539",
    "narrativeText": "AD/CVD Duty Contains Non-Numerics",
    "explanation": "The AD/CVD duty field in the 53 record, pos 47-56, can only contain numeric characters.",
    "dateUpdated": null
  },
  {
    "conditionCode": "540",
    "narrativeText": "Rate Qualifier Must Be A or S",
    "explanation": "In the 53 record, pos 22, the filer indicates whether the reported AD/CVD case duty rate is ad valorem or specific.  The only acceptable codes for the case status are reporting are A or S.  Any other character transmitted in pos 22 will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "541",
    "narrativeText": "AD/CVD Qty Not Allowed for Ad Valorem",
    "explanation": "If the case reported by the filer has only an ad valorem AD/CVD duty rate, the filer may not transmit an AD/CVD quantity in the 53 record, pos 35-46.",
    "dateUpdated": null
  },
  {
    "conditionCode": "542",
    "narrativeText": "AD/CVD Value Not Allowed for Specific",
    "explanation": "The 53 record, pos 25-34, is used to report a value that will be used to compute AD/CVD duties instead of the line item value reported in the 50 record, pos 25-34.  If the filer reports the case as having a specific rate of duty (indicator \"S\" in pos 22 of the 53 record), the AD/CVD value field must be blank.",
    "dateUpdated": null
  },
  {
    "conditionCode": "543",
    "narrativeText": "Case Number Missing",
    "explanation": "The 53 record must have a 10 character case number reported in pos 3-12",
    "dateUpdated": null
  },
  {
    "conditionCode": "544",
    "narrativeText": "Case Nbr Must Begin with A or C",
    "explanation": "In the 53 record, pos 3 is the beginning of the AD/CVD case number.  Cases must begin with A or C.  Any other character transmitted in pos 3 will generate this error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "545",
    "narrativeText": "Duplicate Case Type Encountered",
    "explanation": "If two AD or two CVD case numbers are reported for the same Customs line on an ACE entry summary, this error will be generated.",
    "dateUpdated": null
  },
  {
    "conditionCode": "546",
    "narrativeText": "Case Unknown",
    "explanation": "The AD or CVD case number reported in the 53 record does not exist on the AD/CVD database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "547",
    "narrativeText": "Case Not Applicable for C/O",
    "explanation": "The case number reported in the 53 record, pos 3-12, is for a country which does not match the country of origin reported in the 40 record, pos 9-10.",
    "dateUpdated": null
  },
  {
    "conditionCode": "549",
    "narrativeText": "Case Mfgr Mis-Match",
    "explanation": "If the AD/CVD case reported in the 53 record has an MID for the manufacturer listed on the case reference data, and the filer's 47 record with code \"M\" reflects a different MID from the case MID, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "550",
    "narrativeText": "Case Exporter Mis-Match",
    "explanation": "If the AD/CVD case reported in the 53 record has an MID for the exporter listed on the case reference data, and the filer's 47 record with code \"E\" reflects a different MID from the case MID, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "551",
    "narrativeText": "Case Found for Specific Mfgr Use",
    "explanation": "This is an informational message; not fatal. If the 47 record, code \"M\" reports an MID that equals an MID for the manufacturer on any specific AD/CVD case and the filer transmits an AD/CVD case number that is NOT company specific (ending in 000), this informational message will result.  This edit applies only if there is no exporter ID code on file for a company specific case.",
    "dateUpdated": null
  },
  {
    "conditionCode": "552",
    "narrativeText": "Case Found for Specific Exporter Use",
    "explanation": "This is an informational message; not fatal. If the 47 record, code \"E\" reports an exporter ID code that equals an exporter ID code for the exporter on any specific AD/CVD case and the filer transmits an AD/CVD case number that is NOT company specific (ending in 000), this informational message will result.  This edit applies only if there is no manufacturer MID on file for a company specific case.",
    "dateUpdated": null
  },
  {
    "conditionCode": "553",
    "narrativeText": "Case Found for Specific Mfgr/Exptr Use",
    "explanation": "This is an informational message; not fatal. If the 47 records with code \"M\" and code \"E\" report an MID that equals an MID for the manufacturer and exporter on any specific AD/CVD case and the filer transmits an AD/CVD case number that is NOT company specific (ending in 000), this informational message will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "554",
    "narrativeText": "Non-Reimb Declartn Unknown",
    "explanation": "A declaration that a non-reimbursement statement exists for a case is reported via the 53 record, pos 57-66.  The number reported in this field must correspond exactly to a previously assigned identifier, issued by CBP, after a non-reimbursement declaration has been made for the case  on the Importer's Account. If the exact identifier does not exist on the Importer Account detail record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "555",
    "narrativeText": "Non-Reimb Declartn Not Yet Effective",
    "explanation": "The non-reimbursement statement number, 53 record pos 57-66, has a begin date (effective date) that is prior to the case action date of the case being reported.  In such a case, the non-reimb declaration cannot be reported.",
    "dateUpdated": null
  },
  {
    "conditionCode": "556",
    "narrativeText": "Non-Reimb Declartn Expired",
    "explanation": "The non-reimbursement statement number, 53 record pos 57-66, has expired.  These numbers can be viewed on the 'declarations' link in the importer's account record in the Portal.",
    "dateUpdated": null
  },
  {
    "conditionCode": "557",
    "narrativeText": "Non-Reimb Declartn Does Not Cover Case",
    "explanation": "If the non-reimbursement statement declaration number is for a declaration that does not pertain to the case reported, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "558",
    "narrativeText": "Case Cannot Be Used - Company Excluded",
    "explanation": "If the case in the 53 has a  final exclusion status on file, the case cannot be reported in an AE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "559",
    "narrativeText": "Case Cannot Be Used - Revoked",
    "explanation": "A revoked AD or CVD case cannot be reported in an ACE Entry Summary.",
    "dateUpdated": null
  },
  {
    "conditionCode": "560",
    "narrativeText": "Case Cannot Be Used - Deactivated",
    "explanation": "If the case in the 53 record has a 'deactivated' status on file, the case cannot be reported.",
    "dateUpdated": null
  },
  {
    "conditionCode": "561",
    "narrativeText": "Case Cannot Be Used- In Initial Stage",
    "explanation": "AD/CVD cases that are in the status of \"initiated\" cannot be reported in an ACE Entry Summary.  This error will be generated if such a case is reported.   Note:  if the case number transmitted does not start with an A or C, this error may also result from the incorrect case number.",
    "dateUpdated": null
  },
  {
    "conditionCode": "562",
    "narrativeText": "Case Cannot Be Used - Terminated",
    "explanation": "If the case in the 53 has a 'terminated' status on file, the case cannot be reported in an AE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "563",
    "narrativeText": "Case Cannot Be Used - Not Suspending",
    "explanation": "If the case being reported in the 53 record has a 'stop liq susp' date on file and the entry date for the ACE summary is after the stop-liq-susp date, the case is not reportable.",
    "dateUpdated": null
  },
  {
    "conditionCode": "564",
    "narrativeText": "Related Case May Be Missing",
    "explanation": "This is an informational message; not fatal. The the case reported in the 53 record may have a related case that was not reported in a second 53 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "566",
    "narrativeText": "Case Cannot Be Used - No B/C Desgntn",
    "explanation": "Case data on the ACE AD/CVD database must show a bond or cash status of B or C in order to be reportable on an AD/CVD entry via ACE.  If the case does not show either B or C, it cannot be reported.",
    "dateUpdated": null
  },
  {
    "conditionCode": "567",
    "narrativeText": "Case Requires Cash - Bond Not Allowed",
    "explanation": "The cash/bond indicated transmitted in the 53 record, pos 13, is a \"B\", but the case record on file indicates that cash is required.",
    "dateUpdated": null
  },
  {
    "conditionCode": "568",
    "narrativeText": "Case Cannot Be Used - No Rates Estbl",
    "explanation": "For the case reported in the 53 record, there are no rates on file in the case reference database or the effective date of the rates is after the case action date.",
    "dateUpdated": null
  },
  {
    "conditionCode": "569",
    "narrativeText": "Zero-Rate Case; Rate Not Allowed",
    "explanation": "If the ad valorem rate for an AD/CVD case is zero, a case rate is not permitted to be reported in the 53 record, pos 14-21",
    "dateUpdated": null
  },
  {
    "conditionCode": "570",
    "narrativeText": "Zero-Rate Case; Duty Not Allowed",
    "explanation": "If the ad valorem rate for an AD/CVD case is zero, an AD/CVD duty amount is not permitted to be reported in the 53 record, pos 47-56.",
    "dateUpdated": null
  },
  {
    "conditionCode": "571",
    "narrativeText": "Zero-Rate Case; Qty Not Allowed",
    "explanation": "If the ad valorem rate for an AD/CVD case is zero, a quantity is not permitted to be reported in the 53 record, pos 35-46.",
    "dateUpdated": null
  },
  {
    "conditionCode": "573",
    "narrativeText": "Ad Valorem Rate Not Found For Case",
    "explanation": "The case rate is transmitted in the 53 record, pos 14-21.  If the transmitted rate is an ad valorem rate (indicator \"A\" in pos 22 of the 53 record), but is not listed as a valid rate on the case rate link for the reported case, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "575",
    "narrativeText": "AD/CVD Qty Missing - Rqrd for Specific",
    "explanation": "If the case rate indicator in the 53 record is \"S\", an AD/CVD quantity is required in the 53 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "576",
    "narrativeText": "Estimate Duty/Calc'd Duty Mismatch",
    "explanation": "The transmitted amount of AD or CVD duty does not agree with the calculated amount for the same element.  The duty must agree to the penny, including rounding requirements.",
    "dateUpdated": null
  },
  {
    "conditionCode": "579",
    "narrativeText": "Sold to Party Void",
    "explanation": "The sold-to party reported in the 47 record (code S) is shown as 'void' on the importer file .",
    "dateUpdated": null
  },
  {
    "conditionCode": "580",
    "narrativeText": "Line PSC Reasons Not Allowed",
    "explanation": "If a conventional ACE entry summary is transmitted with 63 record(s) to report PSC line change reason codes, this error will occur.",
    "dateUpdated": null
  },
  {
    "conditionCode": "582",
    "narrativeText": "Line PSC Code Unknown",
    "explanation": "A PSC has been filed with line changes, but the code transmitted in the 63 record is not found listed in Table 15 of the Entry  Summary Create/Update chapter of the ACE CATAIR.",
    "dateUpdated": null
  },
  {
    "conditionCode": "583",
    "narrativeText": "Line PSC Code Duplicate Encountered",
    "explanation": "A PSC cannot report the same line reason code more than once for a given line on the entry.",
    "dateUpdated": null
  },
  {
    "conditionCode": "588",
    "narrativeText": "Delivered to Party Unknown",
    "explanation": "The identifying number for the entity listed as the 'delivered to' party on the 47 (party identifier is C) record is not found on the importer database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "589",
    "narrativeText": "Delivered to Party Void",
    "explanation": "The delivered-to party reported in the 47 record (code C) is shown as 'void' on the importer file.",
    "dateUpdated": null
  },
  {
    "conditionCode": "600",
    "narrativeText": "MOT Requires HMF",
    "explanation": "The entry reflects MOT 12  and there is no HMF reported.",
    "dateUpdated": null
  },
  {
    "conditionCode": "601",
    "narrativeText": "Estimated HMF/Calc'd HMF Mismatch",
    "explanation": "The transmitted HMF is not correctly calculated for the line.",
    "dateUpdated": null
  },
  {
    "conditionCode": "602",
    "narrativeText": "HMF Not Allowed - De Minimus",
    "explanation": "If the entered value for the entry is such that the calculated HMF is $3 or less, and no other duties, taxes or fees are estimated for the entry, but filer has transmitted HMF for any line or lines on the entry, this error will result. (even if the transmitted HMF is correct for any line or lines).",
    "dateUpdated": null
  },
  {
    "conditionCode": "603",
    "narrativeText": "CO Not Allowed for HTS",
    "explanation": "The country of origin does not agree with the tariff number restrictions on eligible country (s) of origin for that tariff number.",
    "dateUpdated": null
  },
  {
    "conditionCode": "605",
    "narrativeText": "SP Code Cannot Be Used - Not in Effect",
    "explanation": "The special program indicator code cannot be used as it is not yet in effect.",
    "dateUpdated": null
  },
  {
    "conditionCode": "606",
    "narrativeText": "SP Code Cannot Be Used - Expired",
    "explanation": "The special program indicator code cannot be used because it has an expiration date that is equal to or earlier than the duty computation date in the AE input.",
    "dateUpdated": null
  },
  {
    "conditionCode": "607",
    "narrativeText": "Unknown CO Not Allowed for SP Claim",
    "explanation": "If a special program code is listed in pos 25-26 of the 40 record, but the country of origin in pos 9-10 is unknown or blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "608",
    "narrativeText": "CO Not Allowed for SP Claim",
    "explanation": "If a special program code is listed in pos 25-26 of the 40 record, but the country of origin in pos 9-10 is not eligible for that trade agreement, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "609",
    "narrativeText": "Single HTS Not Allowed; Second HTS  Reqd",
    "explanation": "The tariff number reported in the first 50 record requires at least one additional tariff number to be reported in a second (or more) 50 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "610",
    "narrativeText": "HTS Does Not Allow an SP Claim",
    "explanation": "If an SP indicator is transmitted in the 40 record and the tariff number reported in the 50 record is a number that is ineligible for any special program claim, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "611",
    "narrativeText": "HTS Requires $0 Value of Goods",
    "explanation": "Per CSMS messages 01-0388, 01-0390, 04-0859, and 06-0315, selected chapter 98 or 99 tariff numbers must show a zero value in the 50 record.  The value must be reported with the non-98 or 99 tariff number.",
    "dateUpdated": null
  },
  {
    "conditionCode": "612",
    "narrativeText": "CE Not Allowed for SP Claim",
    "explanation": "If the claimed special program (pos 25-26 of the 40 record) is not allowed for the reported country of export, this error will result.  Related to error code 608.",
    "dateUpdated": null
  },
  {
    "conditionCode": "614",
    "narrativeText": "HTS Not Eligible for SP Claim",
    "explanation": "The reported tariff number is not eligible for the special program code reported in the 40 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "615",
    "narrativeText": "CE Not Allowed for HTS",
    "explanation": "The country of export does not agree with the tariff number restrictions on eligible country (s) of export for that tariff number.",
    "dateUpdated": null
  },
  {
    "conditionCode": "616",
    "narrativeText": "Article Not Eligible for SP Claim",
    "explanation": "If two (or more) tariff numbers are reported on the line and the special program code transmitted in pos 25-26 of the 40 record is not eligible for any of the tariff numbers, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "617",
    "narrativeText": "CO Not Allowed for GSP Claim/HTS",
    "explanation": "If the claimed special program (pos 25-26 of the 40 record) is 'A' (GSP), and the submitted CO is a GSP country, but the tariff number tariff is marked as 'A*' and specifically excludes the country, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "618",
    "narrativeText": "CO/CE GSP Mismatch",
    "explanation": "If the claimed special program (pos 25-26 of the 40 record) is 'A' (GSP), and If the country of origin and country of export are not the same, and not a member of the same 'sub group', this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "619",
    "narrativeText": "HTS Does Not Allow a  GSP Claim",
    "explanation": "If an SP indicator is transmitted in the 40 record is 'A' and the tariff number reported in the 50 record is in chapter '9802', this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "620",
    "narrativeText": "HTS Not Allowed for Article Classification",
    "explanation": "If the two tariff numbers reported on an entry line do not conform to special pairing rules, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "635",
    "narrativeText": "Infrml MPF Not Allowed-Summary Exempt",
    "explanation": "If an informal class code '311' fee has been submitted for an informal summary but the summary is MPF exempt, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "636",
    "narrativeText": "Infrml MPF Required-Summary Not Exempt",
    "explanation": "If an informal class code '311' fee has not been submitted for an informal summary but the summary is not MPF exempt, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "637",
    "narrativeText": "Infrml MPF Not Allowed-Formal Summary",
    "explanation": "If an informal class code '311' fee has been submitted for the summary but the Entry Type is a formal type (e.g., '01'), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "638",
    "narrativeText": "Infrml MPF Fixed Amount Incorrect",
    "explanation": "If an informal class code '311' fee has been submitted for a non-exempt informal summary but the amount is not the fixed amount, this error will result. (Note amount exceptions for consolidating summaries and fixed transport shipments.)",
    "dateUpdated": null
  },
  {
    "conditionCode": "700",
    "narrativeText": "Entry Summary Totals Missing",
    "explanation": "If no 89 or 90 records are included in the AE input, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "702",
    "narrativeText": "Mult C/E Not Allowed for Consol Summ",
    "explanation": "If the AE input is a consolidated entry summary, each line of the entry must have the same country of export.  If different c/e's are reported, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "703",
    "narrativeText": "Mult C/O Not Allowed for Consol Summ",
    "explanation": "If the AE input is a consolidated entry summary, each line of the entry must have the same country of origin. (or same Canadian province code).  If different c/o's are reported, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "712",
    "narrativeText": "Fee Total Detail Not Allowed",
    "explanation": "If an 89 record is reported, there must be at least one 34 or 62 record for the reported fee.  This error will also result if the 89 record transmits zeroes for the fee class code and no 34 or 62 record is transmitted",
    "dateUpdated": null
  },
  {
    "conditionCode": "714",
    "narrativeText": "Total Fee Amount Contains Non-Numerics",
    "explanation": "The 89 record, pos 6-16, must show a numeric value for the total fee amount by class code.  If this field is blank or has other non-numeric characters, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "715",
    "narrativeText": "Fee Tot Missing for Hdr Fee",
    "explanation": "If a fee is reported at the header level for the AE input (informal entry fee, for example), a 89 record for the fee is required.  If the 89 record is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "716",
    "narrativeText": "Fee Tot Missing for Line Fee",
    "explanation": "An AE input with fees reported on the 62 record requires an 89 record to summarize the various fee categories and amounts.  If that record is not transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "717",
    "narrativeText": "Fee Tot Not Found on Hdr/Line Fee",
    "explanation": "There is an 89 record a reported amount for a fee class code that differs from the line level amount for the same class code.  This error will also result if the 89 record reports zero for the fee class code amount and the there is no 34 or 62 record transmitted for the same class code.",
    "dateUpdated": null
  },
  {
    "conditionCode": "718",
    "narrativeText": "IR Tax Not Allwd on On Mnthly Perdc Stmt",
    "explanation": "Entries that report cargo subject to IRS excise taxes cannot be included on a periodic monthly statement as of Apr 2009",
    "dateUpdated": null
  },
  {
    "conditionCode": "719",
    "narrativeText": "Total HMF Fee Not = Sum of Line Est Fee",
    "explanation": "Fee totals are transmitted in the 89 record, by class code.  If the total amount of the HMF in the 89 record is not equal to the 62 record totals for HMF, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "720",
    "narrativeText": "Tot Oth Fee Not = Sum of Est Oth Fee",
    "explanation": "Fee totals are transmitted in the 89 record, by class code.  If the total amount of the fee in the 89 record for a given class code is not equal to the 62 record totals for the same class code, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "721",
    "narrativeText": "Grand Total Duty Contains Non-numerics",
    "explanation": "The 90 record field for total duty totals, pos 3-13, must contain at least one numeric character.  If all spaces are sent in this field, this error will result. [as of July 2009, the edit is not working properly]",
    "dateUpdated": null
  },
  {
    "conditionCode": "722",
    "narrativeText": "Grand Total Duty Not = Sum of Est Duty",
    "explanation": "The duty amounts reported in the 50 record(s), pos 14-23, must agree with the grand total duty amount reported in the 90 record, pos 3-13.  If there is a discrepancy of any amount, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "723",
    "narrativeText": "Grand IR Tax Totals Contains Non-numerics",
    "explanation": "The 90 record field for total  IR tax, pos 27-37, must contain at least one numeric character.  If all spaces are sent in this field, this error will result. [as of July 2009, the edit is not working properly]",
    "dateUpdated": null
  },
  {
    "conditionCode": "724",
    "narrativeText": "Grand Tot IR Tax Not = Sum of Est IR Tax",
    "explanation": "The amount of IR tax transmitted in the 60 record, pos 6-15 must agree to the penny with the total IR tax transmitted in the 90 record, pos 27-37.  If the figures do not match, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "725",
    "narrativeText": "Grand Total Fee Contains Non-numerics",
    "explanation": "The 90 record field for total fees, pos 15-25, must contain at least one numeric character.  If all spaces are sent in this field, this error will result. [as of July 2009, the edit is not working properly]",
    "dateUpdated": null
  },
  {
    "conditionCode": "726",
    "narrativeText": "Grand Total Fee Not = Sum of Est Fee",
    "explanation": "The total fee reported in the 89 record does not agree with the totals from the various 34 or 62 records.  If the 89 record amount equals the sum of the 34 or 62 records, however, check to see that the same total appears in the 90 record, pos 15-25.",
    "dateUpdated": null
  },
  {
    "conditionCode": "728",
    "narrativeText": "Grand ADD Duty Tot Contains Non-numerics",
    "explanation": "The 90 record field for total ADD duty, pos 39-49, must contain at least one numeric character.  If all spaces are sent in this field, this error will result. [as of July 2009, the edit is not working properly]",
    "dateUpdated": null
  },
  {
    "conditionCode": "729",
    "narrativeText": "Grand CVD Duty Tot Contains Non-numerics",
    "explanation": "The 90 record field for total CVD duty, pos 51-61, must contain at least one numeric character.  If all spaces are sent in this field, this error will result. [as of July 2009, the edit is not working properly]",
    "dateUpdated": null
  },
  {
    "conditionCode": "730",
    "narrativeText": "Tot Mail Fee Not = Hdr Mail Fee",
    "explanation": "If the mail fee is transmitted in the 34 record, the same dollar amount must be transmitted in the 89 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "731",
    "narrativeText": "Tot Informal Fee Not = Hdr Informal Fee",
    "explanation": "The total of the informal entry fee in the 34 record is not the same amount as reported in the 89 record for class code 311.",
    "dateUpdated": null
  },
  {
    "conditionCode": "732",
    "narrativeText": "Tot MPF Surchrge Not = Hdr MPF Surchrge",
    "explanation": "If class code 500 is sent in the 34 record (MPF surcharge for filers not operational for cargo selectivity), the same amount must be sent in the 89 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "736",
    "narrativeText": "Tot Bonded AD Duty Contains Non-Numerics",
    "explanation": "The 88 record, pos 3-13, must contain only numeric characters to report bonded AD duty amounts",
    "dateUpdated": null
  },
  {
    "conditionCode": "737",
    "narrativeText": "Total Bonded AD Not=Sum of Case Est",
    "explanation": "The total amount of AD duties reported in the various 53 records, pos 47-56, does not equal the total amount of bonded AD duties reported in the 88 record, pos 3-13.  They must agree to the penny.",
    "dateUpdated": null
  },
  {
    "conditionCode": "738",
    "narrativeText": "Tot Cash AD Duty Contains Non-Numerics",
    "explanation": "The 88 record, pos 15-25, must contain only numeric characters to report payable AD duty amounts.",
    "dateUpdated": null
  },
  {
    "conditionCode": "739",
    "narrativeText": "Total Cash AD Not = Sum of Case Est",
    "explanation": "The 88 record, pos 15-25, reports the total amount of payable (cash)AD duties from the sum of the 53 records.  If these two amounts do not agree to the penny, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "740",
    "narrativeText": "Tot Bonded CV Duty Contains Non-Numerics",
    "explanation": "The 88 record, pos 27-37, must contain only numeric characters to report payable CV duty amounts.",
    "dateUpdated": null
  },
  {
    "conditionCode": "741",
    "narrativeText": "Total Bonded CV Not=Sum of Case Est",
    "explanation": "The total amount of CV duties reported in the various 53 records, pos 47-56, does not equal the total amount of bonded CV duties reported in the 88 record, pos 27-37.",
    "dateUpdated": null
  },
  {
    "conditionCode": "742",
    "narrativeText": "Tot Cash CV Duty Contains Non-Numerics",
    "explanation": "The 88 record, pos 39-49, must contain only numeric characters to report payable CV duty amounts.",
    "dateUpdated": null
  },
  {
    "conditionCode": "743",
    "narrativeText": "Total Cash CV Not = Sum of Case Est",
    "explanation": "The amount of total payable CV duty reported in all of the transmitted 53 records does not equal the total amount reported in the payable CV duty field in the 88 record (pos 39-49).",
    "dateUpdated": null
  },
  {
    "conditionCode": "744",
    "narrativeText": "Grand Tot AD Duty Not Allowed",
    "explanation": "If the transmitted entry type is not one that encompasses AD/CVD reporting, the 90 record, pos 38-49, must be all zeros.  If an amount other than zero is reported for such an entry type, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "745",
    "narrativeText": "Grand Total AD Not = Sum of Est AD",
    "explanation": "The total of all AD duties, from the payable and bondable amounts reported in the 88 record, is reported in the 90 record, pos 39-49.  If these two records do not match, this error will result",
    "dateUpdated": null
  },
  {
    "conditionCode": "746",
    "narrativeText": "Grand Tot CV Duty Not Allowed",
    "explanation": "If the transmitted entry type is not one that encompasses AD/CVD reporting, the 90 record, pos 51-61, must be all zeros.  If an amount other than zero is reported for such an entry type, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "747",
    "narrativeText": "Grand Total CV Not = Sum of Est CV",
    "explanation": "The total of all CVD duties, from the payable and bondable amounts reported in the 88 record, is reported in the 90 record, pos 51-61.  If these two records do not match, this error will result",
    "dateUpdated": null
  },
  {
    "conditionCode": "748",
    "narrativeText": "PSC Reason Code Missing",
    "explanation": "A PSC filing must contain at least one reason code.  The code may be at the header (35 record) or line (63 record) level.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A00",
    "narrativeText": "Entry Summary Hdr Control Missing",
    "explanation": "There is no 10 record in the B-Y block for the AE input transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A01",
    "narrativeText": "CW Query Request Missing",
    "explanation": "In the CJ input transaction, Census Warning Query, if the input record is not CJ1, this error will be generated.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A02",
    "narrativeText": "Unknown Record ID Found in Grouping",
    "explanation": "If data for a record is transmitted without the record ID (e.g., mpf fees without a '62' at the beginning of the input line), this error will result.  If a input record that is not a current record for the AE input is transmitted, this error will also occur.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A03",
    "narrativeText": "Record: xxxx Starting Position: nn",
    "explanation": "This record will follow another record to identify the exact position where a syntax error has been found. For example - in a situation where a looping error has occurred, the A03 informational message will identify which input record has the looping error and the A03 will also identify the starting position (usually 01) in the record that caused the looping error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A04",
    "narrativeText": "Out of Sequence Record Found in Grouping",
    "explanation": "If input data records are received by CBP that do not conform to the 'structure map' documented in the CATAIR chapter, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A04",
    "narrativeText": "Out of Sequence Record Found in Grouping",
    "explanation": "In a Census Warning Query, if an entry(s) is being queried, the first available field for the entry number cannot be blank.  If it is and there is an entry number in the 2nd or succeeding entry number fields, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A06",
    "narrativeText": "Loop Exceeded-BOL/In-Bond Details",
    "explanation": "The BOL/in-bond grouping consists of a 23 record.  If this looping configuration is exceeded (more than 4 records), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A17",
    "narrativeText": "Loop Exceeded-Lic/Certif/Permit Details",
    "explanation": "The 52 record is used to report license information on an AE line.  Only one 52 record per line is permitted.  If more than 52 record is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A22",
    "narrativeText": "Non-contiguous item found in grouping",
    "explanation": "This error will result if the fields in a record with multiple 'side-by-side' repeating data elements are not left justified (i.e., a 'gap' found). This condition can be generated for several input records: e.g., release detail (32-record), entry summary header fee (34-record), quantity/UOM pairs (50-recrod), etc.  \n\nFurther 50-record example: if two quantities to report, they must occupy the first two quantity fields.   If field one is used, and the 2nd quantity is reported in field 3, this is the error that will result.  The AX output message will identify the record with the error.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A23",
    "narrativeText": "Loop Exceeded- Article Parties",
    "explanation": "If the current version of AE permits a finite number of records (in this case, the number of parties that can be included in the  47 record in version A2.2), and more than the allowed number of such records are transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "A24",
    "narrativeText": "Loop Exceeded",
    "explanation": "This error can apply to any input record that is repeatable.  If the maximum number of identical records is exceeded (check the ACE ABI CATAIR for each record's allowable maximum number of iterations), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B01",
    "narrativeText": "Action Request Code Missing",
    "explanation": "The action (add, replace or delete) code is transmitted in the 10 record, pos 3.  If the code field is blank, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B02",
    "narrativeText": "Action Request Code Unknown",
    "explanation": "The 10 record, pos 3, requires one of three action codes \"A\", \"R\", or \"D\".  If any other code is transmitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B03",
    "narrativeText": "District/Port of Entry Missing",
    "explanation": "The DDPP is required to be transmitted in every AE transaction.  It is transmitted in the 10 record, pos 18-21.  If this element is missing, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B04",
    "narrativeText": "District/Port of Entry Unknown",
    "explanation": "The district port of entry is transmitted in the 10 record, pos 18-21.  The field cannot be left blank and must use a valid CBP entry port code.  If either of these conditions is not met, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B06",
    "narrativeText": "Entry Filer Unknown",
    "explanation": "The entry filer code, transmitted in the 10 record, pos 4-6, must be active in ABI as a permitted ABI filer and must be established in ACE as a permitted filer.  If these conditions are not met, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B10",
    "narrativeText": "Entry Dist Not = Processing Dist",
    "explanation": "The entry port in the 10 record, pos 18-21 must equal the processing port in the B record, pos 4-7.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B12",
    "narrativeText": "Entry Flr Not = RLF Preparer Flr",
    "explanation": "The filer code in the 10 record, pos 3-6, is not the same filer as is preparing the RLF entry (B record, pos 51-53).",
    "dateUpdated": null
  },
  {
    "conditionCode": "B13",
    "narrativeText": "Remote Filing Location Unknown",
    "explanation": "If the preparer of the RLF entry (B record, pos 47-53) does not have an ABJ record for RLF-filed entries in the port of entry (10 record, pos 18-21), this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B14",
    "narrativeText": "Entry Number Missing",
    "explanation": "The entry number is transmitted in the 10 record, pos 9-16.  An AE input without an entry number will receive this reject message.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B16",
    "narrativeText": "Entry Number Check Digit Mismatch",
    "explanation": "The entry number has the wrong check digit for the check digit factor currently assigned to the filer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B17",
    "narrativeText": "Entry Type Code Missing",
    "explanation": "The entry type code is required to be transmitted in every AE transaction.  It is transmitted in the 10 record, pos 34-35.  If this element is missing, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B24",
    "narrativeText": "Extraneous Data Not Allowed - Delete",
    "explanation": "The filer has sent a complete AE input transaction for a delete action code in the 10 record.  If a delete of an AE entry summary is being requested, only the elements listed as Mandatory for all 10 record actions can be transmitted.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B25",
    "narrativeText": "Entry Summary Not Found for Delete",
    "explanation": "There is no pre-existing accepted entry summary to be deleted by the submitted AE transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B26",
    "narrativeText": "Entry Summary Held By CBP",
    "explanation": "An ACE entry number that has a liquidation holding code cannot be deleted by an ACE AE delete transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B31",
    "narrativeText": "Entry Summary Has Been Cancelled",
    "explanation": "The AE transaction is for an entry number that in 'cancelled' status in the ACE entry summary database.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B32",
    "narrativeText": "Entry Summary Filed in Another Port",
    "explanation": "The entry number in question is already on file in a different port of entry from the one listed in the 10 record, pos 18-21",
    "dateUpdated": null
  },
  {
    "conditionCode": "B34",
    "narrativeText": "Broker Reference Number Missing",
    "explanation": "If the filer's ABE profile is set to \"B\" in the sequence field, a broker's reference number is required in the 10 record, pos 22-30, on an initial \"A\" or \"R\" entry summary input transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B35",
    "narrativeText": "Re-add Requires Broker Ref Nbr to Match",
    "explanation": "In order to use the 'add' action code in the 10 record, pos 3, the instant transaction must contain the identical broker reference number as was transmitted in the original AE for the entry.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B39",
    "narrativeText": "Electronic Signature Missing",
    "explanation": "All \"A\" or \"R\" AE transactions require an electronic signature ('X') in pos 39 of the 10 record.  If that signature indicator is omitted, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B40",
    "narrativeText": "Electronic Signature Must Be X",
    "explanation": "All ACE summaries require a signature which is transmitted in the 10 record, pos 39.  The only acceptable indicator is an \"X\".",
    "dateUpdated": null
  },
  {
    "conditionCode": "B41",
    "narrativeText": "PSC Ind Unknown",
    "explanation": "Only a \"Y\" or space may be reported as the PSC indicator.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B42",
    "narrativeText": "Entry  Summary Not Found for PSC",
    "explanation": "A PSC cannot be filed against an entry summary that does not exist in ACE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B43",
    "narrativeText": "PSC Delete Not Allowed",
    "explanation": "A PSC with action code D (delete) is not permitted.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B44",
    "narrativeText": "PSC Not Allowed - Entry D/P Mismatch",
    "explanation": "A PSC must use the port of entry that was used when the conventional entry summary was filed.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B45",
    "narrativeText": "PSC Not Allowed-ES Not Under CBP Control",
    "explanation": "A PSC is not allowed for an entry that is still in trade control (not yet on a statement or otherwise not yet accepted by CBP).",
    "dateUpdated": null
  },
  {
    "conditionCode": "B46",
    "narrativeText": "PSC Not Allowed - ES Not Curr Accepted",
    "explanation": "A PSC is not permitted to be transmitted on an conventional (or PSC) ACE entry summary which is in rejected status, awaiting a correcting AE transmission from the filer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B47",
    "narrativeText": "PSC Not Allowed - ES Not Yet Paid",
    "explanation": "A PSC cannot be filed until the conventional entry summary has been accepted and paid.  This means that, for PMS entries, the collection of the monthly PMS statement must have occurred prior to transmission of the PSC entry.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B48",
    "narrativeText": "PSC Not Allowed - Too Far Beyond Ent Date",
    "explanation": "A PSC cannot be filed if the entry date is more than 269 days in the past as compared to the transmission date of the PSC.  This applies to the initial PSC or any subsequent PSC submission.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B50",
    "narrativeText": "PSC Not Allowed - ES Liquidated",
    "explanation": "A PSC cannot be filed against an entry that has already been liquidated (liquidation date is the same as, or earlier than, the date of PSC transmission).",
    "dateUpdated": null
  },
  {
    "conditionCode": "B51",
    "narrativeText": "PSC Not Allowed - Too Close To Liq Date",
    "explanation": "A PSC cannot be filed if the liquidation date of the conventional (or existing PSC) entry summary is 15 days or fewer in the future.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B52",
    "narrativeText": "PSC Not Allowed - Summary Reconciled",
    "explanation": "A PSC is not permitted for a conventional entry summary that has been accepted with either a FTA or non-FTA reconciliation issue.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B53",
    "narrativeText": "Entry Flr Not = Processing Flr",
    "explanation": "If the AE is not an RLF PSC entry or a regular PSC entry, the filer code  in the B record, pos 8-10 must equal the entry filer code in the 10 record, pos 4-6. (A PSC is allowed to be filed by a filer that is not the original filer; the new PSC filer takes 'ownership' of the summary at the point of acceptance.)",
    "dateUpdated": null
  },
  {
    "conditionCode": "B54",
    "narrativeText": "Action Not  Allowed - PSC On File",
    "explanation": "A conventional ACE entry summary transaction (AE) is not permitted if the entry number has had a successful PSC filed against it.",
    "dateUpdated": null
  },
  {
    "conditionCode": "B56",
    "narrativeText": "PSC Not Allowed - ES Cancelled",
    "explanation": "A PSC cannot be filed on a cancelled entry summary.",
    "dateUpdated": null
  },
  {
    "conditionCode": "C02",
    "narrativeText": "Entry Summary Not Found",
    "explanation": "If a Census Override transaction is submitted for an entry number that does not exist in ACE, this error will result.  (Check to see if the entry was filed in ACS)",
    "dateUpdated": null
  },
  {
    "conditionCode": "C03",
    "narrativeText": "Override Not Permitted for Entry Number",
    "explanation": "If the filer of the Census Override is not the same filer as the entry filer listed in the CW01 record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "C04",
    "narrativeText": "Entry Not in Accepted Status",
    "explanation": "An entry summary with a Census warning must be in Customs Accepted status before the filer can submit a Census Override transaction (CW).  If the entry has been rejected by CBP, the reject must be removed to return the entry to accepted status.",
    "dateUpdated": null
  },
  {
    "conditionCode": "C05",
    "narrativeText": "Entry Summary Line Does Not Exist",
    "explanation": "This error message is generated in reply to a Census Warning Override input.  The CW02 record, pos 7-9, is used to specify which line of the AE contains the Census Warning that is being overridden.  The line number must be three numerics in length.  If fewer than three numerics are transmitted for the line number, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X01",
    "narrativeText": "Batch Control Record Missing - A record",
    "explanation": "Self-explanatory",
    "dateUpdated": null
  },
  {
    "conditionCode": "X02",
    "narrativeText": "Response Cannot Be Delivered",
    "explanation": "Due to other errors in the ABYZ records, the reply to the trade partner cannot be sent. (as of Jan 2013)",
    "dateUpdated": null
  },
  {
    "conditionCode": "X03",
    "narrativeText": "Block Control Record Missing - B record",
    "explanation": "Self-explanatory",
    "dateUpdated": null
  },
  {
    "conditionCode": "X04",
    "narrativeText": "Transaction Detail Missing",
    "explanation": "There are no detail records in the B-Y block.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X05",
    "narrativeText": "Block Control Record Missing - Y record",
    "explanation": "Self-explanatory",
    "dateUpdated": null
  },
  {
    "conditionCode": "X06",
    "narrativeText": "Batch Control Record Missing - Z record",
    "explanation": "Self-explanatory",
    "dateUpdated": null
  },
  {
    "conditionCode": "X07",
    "narrativeText": "Sender/Receiver Site Code Missing",
    "explanation": "The A or Z record is missing the DDPP of the sender in pos 2-5",
    "dateUpdated": null
  },
  {
    "conditionCode": "X08",
    "narrativeText": "Sender/Receiver ID Code Missing",
    "explanation": "The A or Z record is missing the ID code in pos 6-8 for the transmitter of the data.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X09",
    "narrativeText": "Sender/Receiver Not Authorized",
    "explanation": "There is no ABE record on file for the DDPP/Flr/Off code found in the A record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X10",
    "narrativeText": "Transmission Date Unknown",
    "explanation": "The date of transmission, in MMDDYY format, must be included in the A record, pos 15-20.  If a different format is used, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X11",
    "narrativeText": "Application ID Code Missing",
    "explanation": "The application ID is not found in the A record, pos 26-27.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X12",
    "narrativeText": "Not a Known ACE Application ID Code",
    "explanation": "The application ID code is not recognized by ACE.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X13",
    "narrativeText": "Application Currently Not Available",
    "explanation": "If the application ID in the A record is not enabled in the ACE database, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X14",
    "narrativeText": "Z-Rec Does Not Match A-Rec",
    "explanation": "The data elements \"Sender/Receiver Site Code\", \"Sender/Receiver ID Code\", \"Transmission Date\", and \"Sender/Receiver Office Code\" must be identical in both the A and Z records.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X15",
    "narrativeText": "Processing Port Code Missing",
    "explanation": "The B record does not contain a valid port code for the filer's transaction.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X16",
    "narrativeText": "Filer Code Missing",
    "explanation": "The B record does not contain a filer code in pos 8-10.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X18",
    "narrativeText": "Proc Port/Flr Not Authrzd for Sendr/Rcvr",
    "explanation": "The A record port code in the AE is not listed as an active dp-site for the port code transmitted in the B record for the filer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X19",
    "narrativeText": "Block App ID/Batch App ID Conflict",
    "explanation": "The application ID in the A record, pos 26-27, does not agree with the code in the B record, pos 11-12.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X20",
    "narrativeText": "Filer Not Authorized for Application ID",
    "explanation": "The filer's ABE record has not been updated to permit them to send ACE Entry summaries.  This error was also generated when no ABE record existed for the B record port for the filer.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X21",
    "narrativeText": "Remotely Filed Ind Unknown",
    "explanation": "Pos 56 of the B record permits only a \"1\" or \"2\" to reflect remotely filed entries.  Any other character will generate this message (as of Jan 2013).",
    "dateUpdated": null
  },
  {
    "conditionCode": "X22",
    "narrativeText": "Remote Preparer/Remote Ind Conflict",
    "explanation": "The B record contains remote preparer information in pos 47-53, but the ABE profile for the preparer is not operational for RLF.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X23",
    "narrativeText": "Remote Filing Not Allowed For Applctn ID",
    "explanation": "Remote preparer information in the B record, pos 47-53, was transmitted for an application that is not eligible for RLF processing\u2026in this case, a TI.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X24",
    "narrativeText": "Remote Preparer Port Code Missing",
    "explanation": "The DDPP of the remote preparer is blank in the B record, pos 47-50",
    "dateUpdated": null
  },
  {
    "conditionCode": "X25",
    "narrativeText": "Remote Preparer Filer Code Missing",
    "explanation": "The filer code of the remote preparer is blank in the B record, pos 51-53.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X26",
    "narrativeText": "Remote and Prssing  Filer Not the Same",
    "explanation": "The filer code of the remote preparer in the B record, pos 51-53, is not equal to the filer code of the processing filer in the B record, pos 8-10.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X27",
    "narrativeText": "Bkr Does Not Hold National Permit",
    "explanation": "If the filer code in the B record preparer filer field, pos 51-53, does not have an active national permit on the broker's account record, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X28",
    "narrativeText": "Remote Preparer Unknown",
    "explanation": "There is no ABE record for the DDPP/Flr code shown in pos 47-53 of the B record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X29",
    "narrativeText": "Remote Preparer Not Authorized",
    "explanation": "The ABE record for the DDPP/Flr code in the B record (pos 47-53) is not set to operational status for RLF entries.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X30",
    "narrativeText": "Remove Prepare Not Authorzd for App ID",
    "explanation": "The ABE record for the DDPP/Flr code in the B record (pos 47-53) is not set to operational status for ACE Entry Summaries.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X31",
    "narrativeText": "Remote Preparer Not  Authrzd for Port",
    "explanation": "The RLF port of entry in the B record, pos 4-7  has not been created for the preparer/filer in the B record, pos 47-53",
    "dateUpdated": null
  },
  {
    "conditionCode": "X32",
    "narrativeText": "Y-Rec Does Not Match B-Rec",
    "explanation": "The port code in the B record, pos 4-7, does not equal the port code in the Y record, pos 4-7.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X34",
    "narrativeText": "Unknown Record ID Found in Grouping",
    "explanation": "If a filer transmits a record ID that is not listed in the ACE CATAIR for that application, this error will result. (i.e., a Q3 record in an AD/CVD query)",
    "dateUpdated": null
  },
  {
    "conditionCode": "X35",
    "narrativeText": "Out of Sequence Record Found in Grouping",
    "explanation": "In the current (May 2011) Entry Summary Query, the filer cannot include both a J1 and a J2 record.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X37",
    "narrativeText": "Missing Data Record Found in Grouping",
    "explanation": "In the AD/CVD query, if the first case field in the Q1 record is left blank, this error will result.  The ACE AD/CVD query chapter, Q1 record, note 1, states that the Q1 record must start with the first field, regardless of how many cases are being queried.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X38",
    "narrativeText": "Non-contiguous item found in grouping",
    "explanation": "If an AD/CVD input record contains no data, this error will result.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X39",
    "narrativeText": "Data Found In Filler",
    "explanation": "If the filer includes data in a 'space fill' field, this error will result",
    "dateUpdated": null
  },
  {
    "conditionCode": "X40",
    "narrativeText": "Non-standard data found",
    "explanation": "Any non-printable character found in any input record (from A through Z) will cause this reject.",
    "dateUpdated": null
  },
  {
    "conditionCode": "X41",
    "narrativeText": "Multiple Queries in Batch Not Allowed",
    "explanation": "An entry summary query in ACE (JC) can have only 1 B-Y query block per A-Z batch",
    "dateUpdated": null
  },
  {
    "conditionCode": "X42",
    "narrativeText": "Last Record Less Than 80-Char Length",
    "explanation": "The last record in the batch (Z record) has fewer than 80 characters.",
    "dateUpdated": null
  }
];

/**
 * Lookup Map keyed by condition code (as a string, preserving leading zeros and alphanumeric codes like "60D").
 * For codes appearing in multiple query contexts, `new Map()` construction means later
 * rows overwrite earlier ones for the same key, so this stores the LAST occurrence.
 * Use `ABI_ERROR_DICTIONARY_ALL` or `getAllAbiErrors(code)` for all matching entries.
 */
export const ABI_ERROR_DICTIONARY: Map<string, ErrorDictionaryEntry> = new Map(
  ABI_ERROR_DICTIONARY_ROWS.map((entry) => [entry.conditionCode, entry])
);

/**
 * Lookup Record keyed by condition code (as a string).
 */
export const ABI_ERROR_DICTIONARY_RECORD: Record<string, ErrorDictionaryEntry> = Object.fromEntries(
  ABI_ERROR_DICTIONARY_ROWS.map((entry) => [entry.conditionCode, entry])
);

/**
 * Lookup Map keyed by condition code returning all matching entries for that code.
 */
export const ABI_ERROR_DICTIONARY_ALL: Map<string, ErrorDictionaryEntry[]> = (() => {
  const map = new Map<string, ErrorDictionaryEntry[]>();
  for (const entry of ABI_ERROR_DICTIONARY_ROWS) {
    const existing = map.get(entry.conditionCode);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.conditionCode, [entry]);
    }
  }
  return map;
})();

/**
 * Helper to look up an error condition by code string.
 */
export function getAbiError(code: string): ErrorDictionaryEntry | undefined {
  return ABI_ERROR_DICTIONARY.get(code);
}

/**
 * Helper to look up all error conditions for a code string.
 */
export function getAllAbiErrors(code: string): ErrorDictionaryEntry[] {
  return ABI_ERROR_DICTIONARY_ALL.get(code) ?? [];
}

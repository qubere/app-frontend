/**
 * Reference table of CATAIR "Application Identifier Code" pairs (input code / the
 * response code CBP returns), as published in the ABI Batch & Block Control
 * CATAIR chapter (rev 23, June 2023), pages B&B-10–11 and B&B-21–23.
 *
 * NOT enforced by this slice's encode/decode paths — Batch & Block Control only
 * validates the format (2 alphanumeric characters); membership is CBP's own X12
 * rejection ("NOT A KNOWN ACE APPLICATION ID CODE"). This table exists so later
 * chapter-specific slices (Entry Summary AE/AX, Cargo Release SE/SX, etc.) don't
 * have to re-transcribe it from the PDF, and for readability/documentation.
 *
 * Source: docs/plans/catair-source-docs/01-batch-block-control-v23.pdf
 */
export interface ApplicationIdentifierCode {
  transactionName: string;
  inputCode?: string;
  responseCode?: string;
}

export const APPLICATION_IDENTIFIER_CODES: ReadonlyArray<ApplicationIdentifierCode> = [
  { transactionName: "ACE Reference Data Query/Extract", inputCode: "FQ", responseCode: "FO" },
  { transactionName: "ACE Currency Exchange Rates Query", inputCode: "FI", responseCode: "FR" },
  { transactionName: "ACE Currency Exchange Rates Update", responseCode: "%R" },
  { transactionName: "AD/CVD Case Information Query", inputCode: "AD", responseCode: "AC" },
  { transactionName: "AMS Broker Download (eMAN)", responseCode: "BD" },
  { transactionName: "ASI SEACATS Extract", inputCode: "AH", responseCode: "AR" },
  { transactionName: "Cargo Release (Create/Update)", inputCode: "SE", responseCode: "SX" },
  { transactionName: "Cargo Release Status Notification", responseCode: "SO" },
  { transactionName: "Cargo/Manifest/Entry Release Query", inputCode: "CQ", responseCode: "C1" },
  { transactionName: "Census Warning Override", inputCode: "CW", responseCode: "CO" },
  { transactionName: "Census Warning Query", inputCode: "CJ", responseCode: "CL" },
  { transactionName: "Courtesy Notice (of Liquidation)", responseCode: "NR" },
  { transactionName: "Customs eBond Create/Update", inputCode: "CB", responseCode: "CX" },
  { transactionName: "Customs eBond Status Notification", responseCode: "BS" },
  { transactionName: "Drawback Entry Summary Create/Update", inputCode: "DE", responseCode: "DX" },
  { transactionName: "eCERT Certificate Query", inputCode: "EC", responseCode: "EZ" },
  { transactionName: "Entry Summary Create/Update", inputCode: "AE", responseCode: "AX" },
  { transactionName: "Entry Summary Query", inputCode: "EQ", responseCode: "ER" },
  { transactionName: "Entry Summary Status Notification", responseCode: "UC" },
  { transactionName: "Daily Statement", responseCode: "PF" },
  { transactionName: "FTZ Admission Create/Update", inputCode: "FT", responseCode: "NF" },
  {
    transactionName: "FTZ Manifest Quantity Concurrence / Permit to Transfer / Arrival",
    inputCode: "FZ",
    responseCode: "NF",
  },
  { transactionName: "FTZ Output for Broker Download", responseCode: "ZD" },
  { transactionName: "Global Business Identifier Create/Update", inputCode: "GE", responseCode: "GX" },
  { transactionName: "Global Business Identifier Disposition Notification", responseCode: "GO" },
  { transactionName: "Harmonized Tariff Schedule - Extract Reference File Query", inputCode: "HB", responseCode: "HZ" },
  { transactionName: "Harmonized Tariff Schedule - Query", inputCode: "HA", responseCode: "HY" },
  { transactionName: "Importer/Bond Query", inputCode: "KI", responseCode: "KR" },
  { transactionName: "Importer/Consignee Create/Update", inputCode: "TP", responseCode: "TT" },
  { transactionName: "Importer Security Filing", inputCode: "SF", responseCode: "SN" },
  { transactionName: "In-bond Arrival/Export/Transfer of Liability (eMAN)", inputCode: "WP", responseCode: "WT" },
  { transactionName: "In-bond Transaction Processing Results (eMAN)", inputCode: "QP", responseCode: "QT" },
  { transactionName: "Manufacturer Name/Address Add", inputCode: "$I", responseCode: "$R" },
  { transactionName: "Manufacturer Query", inputCode: "MA", responseCode: "MY" },
  { transactionName: "NAFTA Duty Deferral Create/Update", inputCode: "NE", responseCode: "NX" },
  { transactionName: "Partner Government Agency Correction", inputCode: "CA", responseCode: "CC" },
  { transactionName: "Periodic Monthly Statement", responseCode: "MS" },
  { transactionName: "Periodic Monthly Statement - Request Reroute", inputCode: "MO", responseCode: "MQ" },
  { transactionName: "Quota Query", inputCode: "QA", responseCode: "QB" },
  { transactionName: "Reconciliation Entry Summary Create/Update", inputCode: "RE", responseCode: "RX" },
  { transactionName: "Standalone Prior Notice", inputCode: "PE", responseCode: "PX" },
  { transactionName: "Standalone Prior Notice Status Notification", responseCode: "PO" },
  { transactionName: "Statement Update", inputCode: "SU", responseCode: "SQ" },
  { transactionName: "Status Notification (eMAN)", responseCode: "NS" },
  { transactionName: "Temporary Importation Bond Expiration Notice", responseCode: "TS" },
  { transactionName: "Temporary Importation Bond Extension/Close Request", inputCode: "TE", responseCode: "TX" },
  { transactionName: "ACH Debit Authorization/Entry Summary Presentation", inputCode: "RM", responseCode: "PZ" },
];

export function findByInputCode(code: string): ApplicationIdentifierCode | undefined {
  return APPLICATION_IDENTIFIER_CODES.find((c) => c.inputCode === code);
}

export function findByResponseCode(code: string): ApplicationIdentifierCode | undefined {
  return APPLICATION_IDENTIFIER_CODES.find((c) => c.responseCode === code);
}

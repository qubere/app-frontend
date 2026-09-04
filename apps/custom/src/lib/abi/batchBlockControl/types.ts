// Types for the CBP ABI Batch & Block Control envelope (input A/B/Y/Z records,
// output A/B/Y/Z records, and the X0/X1 condition/diagnostic records).
// Source: docs/plans/catair-source-docs/01-batch-block-control-v23.pdf

export interface ARecordInput {
  senderReceiverSiteCode: string; // 4AN, M
  senderReceiverIdCode: string; // 3AN, M
  communicationPassword: string; // 6AN, M
  /** Encoded as MMDDYY. Omit to space-fill. */
  transmissionDate?: Date;
  applicationIdentifierCode: string; // 2AN, M
  senderReceiverOfficeCode?: string; // 2AN, C
  transmitterUserDataText?: string; // 21X, O
}

export interface ZRecordInput {
  senderReceiverSiteCode: string; // 4AN, M — must equal the batch's A-Record
  senderReceiverIdCode: string; // 3AN, M — must equal the batch's A-Record
  transmissionDate?: Date;
  senderReceiverOfficeCode?: string; // 2AN, C
}

export interface BRecordInput {
  processingDistrictPortCode: string; // 4AN, M
  processingFilerCode: string; // 3AN, M
  applicationIdentifierCode: string; // 2AN, M
  processingFilerOfficeCode?: string; // 2AN, C
  preparerDistrictPortCode?: string; // 4AN, C
  preparerFilerCode?: string; // 3AN, C
  preparerOfficeCode?: string; // 2AN, C
  /** "1" = preparer data reported. */
  preparerIndicator?: "1";
  filerPreparerUserDataText?: string; // 21X, O
}

export interface YRecordInput {
  processingDistrictPortCode: string; // 4AN, M — must equal the block's B-Record
  processingFilerCode: string; // 3AN, M — must equal the block's B-Record
  applicationIdentifierCode: string; // 2AN, M
  processingFilerOfficeCode?: string; // 2AN, C
}

// ── Output records ──────────────────────────────────────────────────────────
// A and Z mirror the input layout byte-for-byte (some fields loosen to
// conditional). B and Y do not: Y adds outputTransactionImageCount.

export interface OutputARecord {
  senderReceiverSiteCode: string;
  senderReceiverIdCode: string;
  transmissionDate?: Date;
  /** Blank when the batch was rejected. */
  applicationIdentifierCode?: string;
  senderReceiverOfficeCode?: string;
  transmitterUserDataText?: string;
}

export interface OutputZRecord {
  senderReceiverSiteCode: string;
  senderReceiverIdCode: string;
  transmissionDate?: Date;
  senderReceiverOfficeCode?: string;
}

export interface OutputBRecord {
  processingDistrictPortCode: string;
  processingFilerCode: string;
  applicationIdentifierCode: string;
  processingFilerOfficeCode?: string;
  preparerDistrictPortCode?: string;
  preparerFilerCode?: string;
  preparerOfficeCode?: string;
  preparerIndicator?: "1";
  filerPreparerUserDataText?: string;
}

export interface OutputYRecord {
  processingDistrictPortCode: string;
  processingFilerCode: string;
  applicationIdentifierCode: string;
  /** Number of output detail records returned in the block (excludes B/Y themselves). */
  outputTransactionImageCount: number;
  processingFilerOfficeCode?: string;
}

// ── ACE-generated fallback records (used only when a batch/block/transaction
// syntax problem occurs — B, Y, Z each have a distinct, mostly-blank layout; A
// has no fallback variant, per the spec). ──────────────────────────────────

export interface AceGeneratedBRecord {
  /** Always "B" — repeated at both position 1 and 80 per the spec. */
  recordIndicator: "B";
}

export interface AceGeneratedYRecord {
  recordIndicator: "Y";
  outputTransactionImageCount: number;
}

export interface AceGeneratedZRecord {
  recordIndicator: "Z";
}

// ── Condition / diagnostic records ──────────────────────────────────────────

export type ReferenceDataTypeCode = "BLOCK" | "TRNACT";

export interface X0BlockReference {
  referenceDataTypeCode: "BLOCK";
  occurrencePosition: number;
  processingDistrictPortCode: string;
  processingFilerCode: string;
  processingFilerOfficeCode: string;
  applicationIdentifierCode: string;
  filerPreparerUserDataText: string;
  preparerDistrictPortCode: string;
  preparerFilerCode: string;
  preparerOfficeCode: string;
  preparerIndicator: string;
}

export interface X0TransactionReference {
  referenceDataTypeCode: "TRNACT";
  occurrencePosition: number;
  /** Relative position of the 80-char record within the batch. */
  recordPositionInBatch: number;
  /** Relative position of the syntax problem within that record; "00" = whole record. */
  positionOfProblemInRecord: number;
}

export type X0Record = X0BlockReference | X0TransactionReference;

export interface X1Record {
  /** " " = not the final disposition; "R" = final, batch rejected. */
  dispositionTypeCode: string;
  /** Always "F" per the spec. */
  severityCode: string;
  /** e.g. "X12", or "999" for the final disposition record. */
  conditionCode: string;
  reasonCode?: string;
  narrativeText: string;
  isFinalDisposition: boolean;
}

// ── High-level parse result ─────────────────────────────────────────────────

export interface ParsedBlock {
  header: OutputBRecord;
  trailer: OutputYRecord;
  /** Opaque 80-char detail lines between the B- and Y-Record — not interpreted this slice. */
  transactionRecords: string[];
}

/**
 * Batch & Block Control acceptance is binary at the envelope level (see spec
 * usage notes + all 3 rejection worked examples): any batch/block/transaction
 * syntax problem rejects the *entire* batch, with a single synthetic
 * ACE-generated block carrying the diagnostics. Per-transaction *content*
 * validity is a concern of the specific transaction chapter, not this layer.
 */
export type ParsedBatchResult =
  | {
      scenario: "ACCEPTED";
      aRecord: OutputARecord;
      zRecord: OutputZRecord;
      blocks: ParsedBlock[];
    }
  | {
      scenario: "REJECTED";
      /** Which of CBP's 3 documented rejection scenarios produced this result. */
      level: "BATCH" | "BLOCK" | "TRANSACTION";
      /** A always mirrors input, even on rejection (per the worked examples). */
      aRecord: OutputARecord;
      /** On any rejection CBP returns the blank ACE-generated Z fallback, not a
       * populated Z-Record — confirmed byte-for-byte in all 3 rejection examples
       * (e.g. "Z" + spaces + "Z", no site/id code echoed back). */
      zRecord: AceGeneratedZRecord;
      /**
       * Present for BLOCK and TRANSACTION levels. NOTE: CBP's own examples show a
       * single rejected batch can contain more than one BLOCK diagnostic (e.g. two
       * separate problem blocks, each with its own X1 condition(s)). This slice
       * models only the single most-recent reference of each type — `conditions`
       * still carries every X1 in order, but the pairing between a specific X0 and
       * its X1(s) is lost when more than one BLOCK/TRNACT reference appears.
       * Extend to a list of {reference, conditions} pairs if that granularity is
       * needed by a later slice.
       */
      blockReference?: X0BlockReference;
      /** Present for TRANSACTION level only. Same multi-reference caveat as above. */
      transactionReference?: X0TransactionReference;
      /** All non-final X1 condition records, in the order CBP returned them. */
      conditions: X1Record[];
      /** The "999" / BATCH REJECTED record. */
      finalDisposition: X1Record;
    };

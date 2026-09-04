import {
  dateField,
  filler,
  constantField,
  conditionReferencePrefix,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import type {
  ARecordInput,
  ZRecordInput,
  BRecordInput,
  YRecordInput,
  OutputARecord,
  OutputZRecord,
  OutputBRecord,
  OutputYRecord,
  AceGeneratedBRecord,
  AceGeneratedYRecord,
  AceGeneratedZRecord,
  X0BlockReference,
  X0TransactionReference,
  X1Record,
} from "./types";

// RecordSpecs for the CBP ABI Batch & Block Control envelope.
// Source: docs/plans/catair-source-docs/01-batch-block-control-v23.pdf (rev 23, June 2023)
// Position math for every field below is cross-checked against the spec's stated
// ranges; see the plan doc for the full derivation.

// ── Input records ────────────────────────────────────────────────────────────

export const A_INPUT_SPEC: RecordSpec<ARecordInput> = {
  recordType: "A-Record (Batch Control Header)",
  length: 80,
  fields: [
    constantField(1, "A"),
    { key: "senderReceiverSiteCode", start: 2, length: 4, class: "AN", designation: "M" },
    { key: "senderReceiverIdCode", start: 6, length: 3, class: "AN", designation: "M" },
    { key: "communicationPassword", start: 9, length: 6, class: "AN", designation: "M" },
    dateField("transmissionDate", 15, "O"),
    filler(21, 5),
    { key: "applicationIdentifierCode", start: 26, length: 2, class: "AN", designation: "M" },
    filler(28, 10),
    { key: "senderReceiverOfficeCode", start: 38, length: 2, class: "AN", designation: "C" },
    filler(40, 20),
    { key: "transmitterUserDataText", start: 60, length: 21, class: "X", designation: "O" },
  ],
};

export const Z_INPUT_SPEC: RecordSpec<ZRecordInput> = {
  recordType: "Z-Record (Batch Control Trailer)",
  length: 80,
  fields: [
    constantField(1, "Z"),
    { key: "senderReceiverSiteCode", start: 2, length: 4, class: "AN", designation: "M" },
    { key: "senderReceiverIdCode", start: 6, length: 3, class: "AN", designation: "M" },
    filler(9, 6),
    dateField("transmissionDate", 15, "C"),
    filler(21, 17),
    { key: "senderReceiverOfficeCode", start: 38, length: 2, class: "AN", designation: "C" },
    filler(40, 41),
  ],
};

export const B_INPUT_SPEC: RecordSpec<BRecordInput> = {
  recordType: "B-Record (Block Control Header)",
  length: 80,
  fields: [
    constantField(1, "B"),
    filler(2, 2),
    { key: "processingDistrictPortCode", start: 4, length: 4, class: "AN", designation: "M" },
    { key: "processingFilerCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "applicationIdentifierCode", start: 11, length: 2, class: "AN", designation: "M" },
    filler(13, 32),
    { key: "processingFilerOfficeCode", start: 45, length: 2, class: "AN", designation: "C" },
    { key: "preparerDistrictPortCode", start: 47, length: 4, class: "AN", designation: "C" },
    { key: "preparerFilerCode", start: 51, length: 3, class: "AN", designation: "C" },
    { key: "preparerOfficeCode", start: 54, length: 2, class: "AN", designation: "C" },
    { key: "preparerIndicator", start: 56, length: 1, class: "AN", designation: "C" },
    filler(57, 3),
    { key: "filerPreparerUserDataText", start: 60, length: 21, class: "X", designation: "O" },
  ],
};

export const Y_INPUT_SPEC: RecordSpec<YRecordInput> = {
  recordType: "Y-Record (Block Control Trailer)",
  length: 80,
  fields: [
    constantField(1, "Y"),
    filler(2, 2),
    { key: "processingDistrictPortCode", start: 4, length: 4, class: "AN", designation: "M" },
    { key: "processingFilerCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "applicationIdentifierCode", start: 11, length: 2, class: "AN", designation: "M" },
    filler(13, 32),
    { key: "processingFilerOfficeCode", start: 45, length: 2, class: "AN", designation: "C" },
    filler(47, 34),
  ],
};

// ── Output records (normal — A/Z mirror input byte-for-byte; B/Y do not) ────

export const A_OUTPUT_SPEC: RecordSpec<OutputARecord> = {
  recordType: "A-Record (Batch Control Header, output)",
  length: 80,
  fields: [
    constantField(1, "A"),
    { key: "senderReceiverSiteCode", start: 2, length: 4, class: "AN", designation: "M" },
    { key: "senderReceiverIdCode", start: 6, length: 3, class: "AN", designation: "M" },
    filler(9, 6),
    dateField("transmissionDate", 15, "C"),
    filler(21, 5),
    { key: "applicationIdentifierCode", start: 26, length: 2, class: "AN", designation: "C" },
    filler(28, 10),
    { key: "senderReceiverOfficeCode", start: 38, length: 2, class: "AN", designation: "C" },
    filler(40, 20),
    { key: "transmitterUserDataText", start: 60, length: 21, class: "X", designation: "C" },
  ],
};

export const Z_OUTPUT_SPEC: RecordSpec<OutputZRecord> = {
  recordType: "Z-Record (Batch Control Trailer, output)",
  length: 80,
  fields: [
    constantField(1, "Z"),
    { key: "senderReceiverSiteCode", start: 2, length: 4, class: "AN", designation: "M" },
    { key: "senderReceiverIdCode", start: 6, length: 3, class: "AN", designation: "M" },
    filler(9, 6),
    dateField("transmissionDate", 15, "C"),
    filler(21, 17),
    { key: "senderReceiverOfficeCode", start: 38, length: 2, class: "AN", designation: "C" },
    filler(40, 41),
  ],
};

export const B_OUTPUT_SPEC: RecordSpec<OutputBRecord> = {
  recordType: "B-Record (Block Control Header, output)",
  length: 80,
  fields: [
    constantField(1, "B"),
    filler(2, 2),
    { key: "processingDistrictPortCode", start: 4, length: 4, class: "AN", designation: "M" },
    { key: "processingFilerCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "applicationIdentifierCode", start: 11, length: 2, class: "AN", designation: "M" },
    // 13-44: Daily/Periodic Monthly Statement fields (Statement Status, Number,
    // Preliminary Print Date, Payment Type, IOR Number, Client Branch Id) — only
    // populated for PF/MS transactions. Statement Processing is a later slice;
    // treated as unmodeled filler here.
    filler(13, 32),
    { key: "processingFilerOfficeCode", start: 45, length: 2, class: "AN", designation: "C" },
    { key: "preparerDistrictPortCode", start: 47, length: 4, class: "AN", designation: "C" },
    { key: "preparerFilerCode", start: 51, length: 3, class: "AN", designation: "C" },
    { key: "preparerOfficeCode", start: 54, length: 2, class: "AN", designation: "C" },
    { key: "preparerIndicator", start: 56, length: 1, class: "AN", designation: "C" },
    filler(57, 3),
    { key: "filerPreparerUserDataText", start: 60, length: 21, class: "X", designation: "C" },
  ],
};

export const Y_OUTPUT_SPEC: RecordSpec<OutputYRecord> = {
  recordType: "Y-Record (Block Control Trailer, output)",
  length: 80,
  fields: [
    constantField(1, "Y"),
    filler(2, 2),
    { key: "processingDistrictPortCode", start: 4, length: 4, class: "AN", designation: "M" },
    { key: "processingFilerCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "applicationIdentifierCode", start: 11, length: 2, class: "AN", designation: "M" },
    { key: "outputTransactionImageCount", start: 13, length: 5, class: "N", designation: "M" },
    filler(18, 27),
    { key: "processingFilerOfficeCode", start: 45, length: 2, class: "AN", designation: "C" },
    filler(47, 34),
  ],
};

// ── ACE-generated fallback records (used only on batch/block/transaction
// syntax rejection; A has no fallback variant). ─────────────────────────────

export const B_ACE_GENERATED_SPEC: RecordSpec<AceGeneratedBRecord> = {
  recordType: "B-Record (ACE Generated)",
  length: 80,
  fields: [
    constantField(1, "B"),
    filler(2, 78),
    { key: "recordIndicator", start: 80, length: 1, class: "A", designation: "M" },
  ],
};

export const Y_ACE_GENERATED_SPEC: RecordSpec<AceGeneratedYRecord> = {
  recordType: "Y-Record (ACE Generated)",
  length: 80,
  fields: [
    constantField(1, "Y"),
    filler(2, 11),
    { key: "outputTransactionImageCount", start: 13, length: 5, class: "N", designation: "M" },
    filler(18, 62),
    { key: "recordIndicator", start: 80, length: 1, class: "A", designation: "M" },
  ],
};

export const Z_ACE_GENERATED_SPEC: RecordSpec<AceGeneratedZRecord> = {
  recordType: "Z-Record (ACE Generated)",
  length: 80,
  fields: [
    constantField(1, "Z"),
    filler(2, 78),
    { key: "recordIndicator", start: 80, length: 1, class: "A", designation: "M" },
  ],
};

// ── Condition / diagnostic records ──────────────────────────────────────────

export const X0_BLOCK_SPEC: RecordSpec<X0BlockReference> = {
  recordType: "X0-Record (Block Condition Reference)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("X0"),
    { key: "processingDistrictPortCode", start: 26, length: 4, class: "AN", designation: "C" },
    filler(30, 1),
    { key: "processingFilerCode", start: 31, length: 3, class: "AN", designation: "C" },
    filler(34, 1),
    { key: "processingFilerOfficeCode", start: 35, length: 2, class: "AN", designation: "C" },
    filler(37, 1),
    { key: "applicationIdentifierCode", start: 38, length: 2, class: "AN", designation: "C" },
    filler(40, 1),
    { key: "filerPreparerUserDataText", start: 41, length: 21, class: "X", designation: "C" },
    filler(62, 1),
    { key: "preparerDistrictPortCode", start: 63, length: 4, class: "AN", designation: "C" },
    { key: "preparerFilerCode", start: 67, length: 3, class: "AN", designation: "C" },
    { key: "preparerOfficeCode", start: 70, length: 2, class: "AN", designation: "C" },
    { key: "preparerIndicator", start: 72, length: 1, class: "AN", designation: "C" },
    filler(73, 8),
  ],
};

export const X0_TRNACT_SPEC: RecordSpec<X0TransactionReference> = {
  recordType: "X0-Record (Transaction Condition Reference)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("X0"),
    { key: "recordPositionInBatch", start: 26, length: 7, class: "N", designation: "M" },
    filler(33, 1),
    { key: "positionOfProblemInRecord", start: 34, length: 2, class: "N", designation: "M" },
    filler(36, 45),
  ],
};

export const X1_SPEC: RecordSpec<Omit<X1Record, "isFinalDisposition">> = {
  recordType: "X1-Record (Condition/Disposition Response)",
  length: 80,
  fields: [
    constantField(1, "X1"),
    { key: "dispositionTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "severityCode", start: 4, length: 1, class: "AN", designation: "M" },
    { key: "conditionCode", start: 5, length: 3, class: "AN", designation: "M" },
    filler(8, 2),
    { key: "reasonCode", start: 10, length: 1, class: "AN", designation: "C" },
    // Class is 40AN per spec, though some real condition narratives contain "/"
    // (e.g. X18, X43) which strict AN excludes. This field is decode-only — we
    // never build X1 records (CBP does) — so encodeRecord's class validation is
    // never exercised here; documented as spec-stated for fidelity.
    { key: "narrativeText", start: 11, length: 40, class: "AN", designation: "M" },
    filler(51, 30),
  ],
};

import {
  dateField,
  filler,
  constantField,
  numericCodeField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import type {
  HeaderInput,
  SecondaryNotifyInput,
  SingleTransactionBondInput,
  PrincipalInput,
  CoPrincipalInput,
  BondUserInput,
  SuretyInput,
  CoSuretyInput,
  ReinsurerInput,
  OutputMessageInput,
} from "./types";

// RecordSpecs for the CATAIR eBond Create/Update chapter.
// Source: docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf
// Record 10's position math (including the internal 1S filler at pos 54)
// independently re-verified against a fresh PDF extraction before implementation.

/** A whole-dollar (no implied decimals) numeric amount field, bound to `Decimal`
 * — eBond's currency fields are explicitly whole US dollars, unlike Entry
 * Summary/Statement Processing's 2-implied-decimal convention. */
function wholeDollarField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  return {
    key,
    start,
    length,
    class: "SN",
    designation,
    encodeValue: (raw) => roundToCents(raw as Decimal).toDecimalPlaces(0).toString().padStart(length, "0"),
    decodeValue: (field) => {
      const trimmed = field.trim();
      return trimmed.length === 0 ? undefined : new Decimal(trimmed);
    },
  };
}

export const RECORD_10_HEADER_SPEC: RecordSpec<HeaderInput> = {
  recordType: "Record 10 (Bond Header Record)",
  length: 80,
  fields: [
    constantField(1, "10"),
    { key: "bondDesignationTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "bondTypeCode", start: 4, length: 1, class: "N", designation: "M" },
    { key: "bondActivityCode", start: 5, length: 3, class: "AN", designation: "C" },
    wholeDollarField("bondAmount", 8, 10, "C"),
    dateField("executionDate", 18, "C"),
    { key: "suretyReferenceNumber", start: 24, length: 9, class: "X", designation: "O" },
    dateField("effectiveDate", 33, "C"),
    dateField("terminationDate", 39, "C"),
    { key: "bondNumber", start: 45, length: 9, class: "AN", designation: "C" },
    filler(54, 1),
    { key: "reconciliationBondRiderFlag", start: 55, length: 1, class: "AN", designation: "C" },
    { key: "usviBondRiderFlag", start: 56, length: 1, class: "AN", designation: "C" },
    filler(57, 24),
  ],
};

export const RECORD_12_SECONDARY_NOTIFY_SPEC: RecordSpec<SecondaryNotifyInput> = {
  recordType: "Record 12 (Secondary Notify Parties Record)",
  length: 80,
  fields: [
    constantField(1, "12"),
    { key: "secondaryNotifyPartyCode1", start: 3, length: 9, class: "AN", designation: "M" },
    { key: "secondaryNotifyPartyCode2", start: 12, length: 9, class: "AN", designation: "O" },
    { key: "secondaryNotifyPartyCode3", start: 21, length: 9, class: "AN", designation: "O" },
    { key: "secondaryNotifyPartyCode4", start: 30, length: 9, class: "AN", designation: "O" },
    filler(39, 42),
  ],
};

export const RECORD_20_STB_SPEC: RecordSpec<SingleTransactionBondInput> = {
  recordType: "Record 20 (Single Transaction Bond Record)",
  length: 80,
  fields: [
    constantField(1, "20"),
    { key: "transactionIdTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "entryTypeCode", start: 4, length: 2, class: "AN", designation: "C" },
    { key: "transactionId", start: 6, length: 40, class: "X", designation: "M" },
    filler(46, 35),
  ],
};

export const RECORD_30_PRINCIPAL_SPEC: RecordSpec<PrincipalInput> = {
  recordType: "Record 30 (Principal Record)",
  length: 80,
  fields: [
    constantField(1, "30"),
    { key: "principalIdNumberType", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "principalIdNumber", start: 6, length: 12, class: "X", designation: "M" },
    { key: "principalName", start: 18, length: 40, class: "X", designation: "C" },
    filler(58, 23),
  ],
};

export const RECORD_35_CO_PRINCIPAL_SPEC: RecordSpec<CoPrincipalInput> = {
  recordType: "Record 35 (Co-principal Record)",
  length: 80,
  fields: [
    constantField(1, "35"),
    { key: "coPrincipalIdNumberType", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "coPrincipalIdNumber", start: 6, length: 12, class: "X", designation: "M" },
    { key: "coPrincipalName", start: 18, length: 40, class: "X", designation: "C" },
    filler(58, 23),
  ],
};

export const RECORD_36_BOND_USER_SPEC: RecordSpec<BondUserInput> = {
  recordType: "Record 36 (Bond User Record)",
  length: 80,
  fields: [
    constantField(1, "36"),
    { key: "bondUserIdNumberType", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "bondUserIdNumber", start: 6, length: 12, class: "X", designation: "M" },
    { key: "bondUserName", start: 18, length: 40, class: "X", designation: "C" },
    { key: "userRiderActionCode", start: 58, length: 1, class: "AN", designation: "C" },
    dateField("userAddDate", 59, "C"),
    dateField("userDeleteDate", 65, "C"),
    filler(71, 10),
  ],
};

export const RECORD_40_SURETY_SPEC: RecordSpec<SuretyInput> = {
  recordType: "Record 40 (Surety Record)",
  length: 80,
  fields: [
    constantField(1, "40"),
    numericCodeField("suretyCode", 3, 3, "M"),
    { key: "agentIdNumber", start: 6, length: 11, class: "X", designation: "M" },
    { key: "suretyName", start: 17, length: 40, class: "X", designation: "C" },
    wholeDollarField("suretyLiabilityAmount", 57, 10, "C"),
    filler(67, 14),
  ],
};

export const RECORD_45_CO_SURETY_SPEC: RecordSpec<CoSuretyInput> = {
  recordType: "Record 45 (Co-surety Record)",
  length: 80,
  fields: [
    constantField(1, "45"),
    numericCodeField("coSuretyCode", 3, 3, "M"),
    { key: "agentIdNumber", start: 6, length: 11, class: "X", designation: "M" },
    { key: "coSuretyName", start: 17, length: 40, class: "X", designation: "C" },
    wholeDollarField("coSuretyLiabilityAmount", 57, 10, "M"),
    filler(67, 14),
  ],
};

export const RECORD_46_RE_INSURER_SPEC: RecordSpec<ReinsurerInput> = {
  recordType: "Record 46 (Re-insurer Record)",
  length: 80,
  fields: [
    constantField(1, "46"),
    numericCodeField("suretyCodeForReinsurer", 3, 3, "M"),
    { key: "agentIdNumber", start: 6, length: 11, class: "X", designation: "M" },
    { key: "suretyName", start: 17, length: 40, class: "X", designation: "C" },
    filler(57, 24),
  ],
};

export const RECORD_90_MESSAGE_SPEC: RecordSpec<OutputMessageInput> = {
  recordType: "Record 90 (Error or Accept/Reject Message Record)",
  length: 80,
  fields: [
    constantField(1, "90"),
    { key: "dispositionTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "severityCode", start: 4, length: 1, class: "AN", designation: "M" },
    { key: "conditionCode", start: 5, length: 3, class: "AN", designation: "M" },
    filler(8, 2),
    { key: "narrativeText", start: 10, length: 71, class: "X", designation: "M" },
  ],
};

// RecordSpecs for the ACE CATAIR Importer/Consignee Create/Update (TP) records.
// Source: docs/plans/catair-source-docs/19-importer-consignee-create-update-5106-v12.pdf
// Version 12 (revision 15), March 2019. Pages ADD-20 through ADD-47.

import { filler, constantField, conditionReferencePrefix, type RecordSpec } from "@/lib/abi/fixedWidth";
import type {
  T1Input,
  TAInput,
  T2Input,
  T3Input,
  TBInput,
  TCInput,
  TDInput,
  TEInput,
  TFInput,
  TGInput,
  THInput,
  TIOfficer,
  TJOfficer,
  TKRelatedBusiness,
  TLInput,
  TMInput,
  TNInput,
  E0Output,
  E1Output,
} from "./types";

// T1: Importer Account Header (mandatory)
// Positions 1-1: "T", 2-2: "1", 3-3: Action Code, 4-15: Importer#, 16-47: Abbreviated Name
// 48-79: Mailing Address Line 1, 80-80: Importer Type
export const RECORD_T1_SPEC: RecordSpec<T1Input> = {
  recordType: "T1-Record (Importer Account Header)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "1"),
    { key: "actionCode", start: 3, length: 1, class: "A", designation: "M" },
    { key: "importerNumber", start: 4, length: 12, class: "X", designation: "M" },
    { key: "abbreviatedImporterName", start: 16, length: 32, class: "X", designation: "M" },
    { key: "mailingAddressLine1", start: 48, length: 32, class: "X", designation: "M" },
    { key: "importerType", start: 80, length: 1, class: "X", designation: "C" },
  ],
};

// TA: Name Qualifier / Alternate Importer Name (optional)
// 1-1:"T", 2-2:"A", 3-5: Name Qualifier (3A), 6-37: Alternate Name (32X), 38-80: filler
export const RECORD_TA_SPEC: RecordSpec<TAInput> = {
  recordType: "TA-Record (Name Qualifier / Alternate Name)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "A"),
    { key: "nameQualifier", start: 3, length: 3, class: "A", designation: "M" },
    { key: "alternateImporterName", start: 6, length: 32, class: "X", designation: "M" },
    filler(38, 43),
  ],
};

// T2: Mailing Address (mandatory)
// 1-1:"T", 2-2:"2", 3-14: filler, 15-46: Line2 (32X), 47-67: City (21X),
// 68-69: State (2A), 70-78: Postal (9AN), 79-80: Country (2A)
export const RECORD_T2_SPEC: RecordSpec<T2Input> = {
  recordType: "T2-Record (Mailing Address)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "2"),
    filler(3, 12),
    { key: "mailingAddressLine2", start: 15, length: 32, class: "X", designation: "O" },
    { key: "mailingCity", start: 47, length: 21, class: "X", designation: "M" },
    { key: "mailingStateCode", start: 68, length: 2, class: "A", designation: "M" },
    { key: "mailingPostalCode", start: 70, length: 9, class: "AN", designation: "C" },
    { key: "mailingCountryCode", start: 79, length: 2, class: "A", designation: "M" },
  ],
};

// T3: Full Legal Importer Name (conditional)
// 1-1:"T", 2-2:"3", 3-32: Full Legal Name (30X), 33-80: filler
export const RECORD_T3_SPEC: RecordSpec<T3Input> = {
  recordType: "T3-Record (Full Legal Importer Name)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "3"),
    { key: "fullLegalImporterName", start: 3, length: 30, class: "X", designation: "M" },
    filler(33, 48),
  ],
};

// TB: Physical Address Lines (conditional)
// 1-1:"T", 2-2:"B", 3-34: Line1 (32X), 35-66: Line2 (32X), 67-80: filler
export const RECORD_TB_SPEC: RecordSpec<TBInput> = {
  recordType: "TB-Record (Physical Address Lines)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "B"),
    { key: "physicalAddressLine1", start: 3, length: 32, class: "X", designation: "M" },
    { key: "physicalAddressLine2", start: 35, length: 32, class: "X", designation: "C" },
    filler(67, 14),
  ],
};

// TC: Physical Address City/State/Postal/Country (conditional)
// 1-1:"T", 2-2:"C", 3-23: City (21X), 24-25: State (2A), 26-34: Postal (9AN), 35-36: Country (2A), 37-80: filler
export const RECORD_TC_SPEC: RecordSpec<TCInput> = {
  recordType: "TC-Record (Physical Address City/State/Postal/Country)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "C"),
    { key: "physicalCity", start: 3, length: 21, class: "X", designation: "M" },
    { key: "physicalStateCode", start: 24, length: 2, class: "A", designation: "M" },
    { key: "physicalPostalCode", start: 26, length: 9, class: "AN", designation: "C" },
    { key: "physicalCountryCode", start: 35, length: 2, class: "A", designation: "M" },
    filler(37, 44),
  ],
};

// TD: Identification Numbers & Phone (mandatory)
// Very wide record — detailed positions per ADD-28/ADD-29
// 1-1:"T", 2-2:"D"
// 3-3: entriesPerYear(1N or 1S), 4-4: utilIOR, 5-5: utilConsignee, 6-6: utilDrawback
// 7-7: utilRefunds, 8-8: utilOther, 9-23: utilOtherDescription(15X)
// 24-28: programCode1(5AN), 29-33: programCode2, 34-38: programCode3, 39-43: programCode4
// 44-58: phone(15AN), 59-64: extension(6N or 6S), 65-65: cbpAssignedReq, 66-66: ssnInd
// 67-67: irsInd, 68-68: irsOrSsnInd, 69-69: usResidentInd, 70-80: filler
export const RECORD_TD_SPEC: RecordSpec<TDInput> = {
  recordType: "TD-Record (ID Numbers & Phone)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "D"),
    { key: "entriesPerYear", start: 3, length: 1, class: "X", designation: "O" },
    { key: "utilImporterOfRecord", start: 4, length: 1, class: "X", designation: "C" },
    { key: "utilConsignee", start: 5, length: 1, class: "X", designation: "C" },
    { key: "utilDrawback", start: 6, length: 1, class: "X", designation: "C" },
    { key: "utilRefunds", start: 7, length: 1, class: "X", designation: "C" },
    { key: "utilOther", start: 8, length: 1, class: "X", designation: "C" },
    { key: "utilOtherDescription", start: 9, length: 15, class: "X", designation: "C" },
    { key: "programCode1", start: 24, length: 5, class: "AN", designation: "O" },
    { key: "programCode2", start: 29, length: 5, class: "AN", designation: "O" },
    { key: "programCode3", start: 34, length: 5, class: "AN", designation: "O" },
    { key: "programCode4", start: 39, length: 5, class: "AN", designation: "O" },
    { key: "phone", start: 44, length: 15, class: "AN", designation: "M" },
    { key: "phoneExtension", start: 59, length: 6, class: "X", designation: "O" },
    { key: "cbpAssignedNumberRequestReasonIndicator", start: 65, length: 1, class: "X", designation: "C" },
    { key: "ssnIndicator", start: 66, length: 1, class: "X", designation: "C" },
    { key: "irsIndicator", start: 67, length: 1, class: "X", designation: "C" },
    { key: "irsOrSsnIndicator", start: 68, length: 1, class: "X", designation: "C" },
    { key: "usResidentIndicator", start: 69, length: 1, class: "X", designation: "C" },
    filler(70, 11),
  ],
};

// TE: Address Type & Business Description (mandatory)
// 1-1:"T", 2-2:"E", 3-3: mailingAddressType(1N or 1S), 4-18: mailingExplanation(15X)
// 19-19: physicalAddressType, 20-34: physicalExplanation(15X)
// 35-74: businessDescription(40X), 75-80: filler
export const RECORD_TE_SPEC: RecordSpec<TEInput> = {
  recordType: "TE-Record (Address Type & Business Description)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "E"),
    { key: "mailingAddressType", start: 3, length: 1, class: "X", designation: "M" },
    { key: "mailingAddressExplanation", start: 4, length: 15, class: "X", designation: "C" },
    { key: "physicalAddressType", start: 19, length: 1, class: "X", designation: "C" },
    { key: "physicalAddressExplanation", start: 20, length: 15, class: "X", designation: "C" },
    { key: "businessDescription", start: 35, length: 40, class: "X", designation: "O" },
    filler(75, 6),
  ],
};

// TF: Email, Website, Fax (mandatory)
// 1-1:"T", 2-2:"F", 3-32: email(30X), 33-62: website(30X), 63-77: fax(15AN), 78-80: filler
export const RECORD_TF_SPEC: RecordSpec<TFInput> = {
  recordType: "TF-Record (Email, Website, Fax)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "F"),
    { key: "email", start: 3, length: 30, class: "X", designation: "M" },
    { key: "website", start: 33, length: 30, class: "X", designation: "O" },
    { key: "fax", start: 63, length: 15, class: "AN", designation: "O" },
    filler(78, 3),
  ],
};

// TG: NAICS, DUNS, Filer Code, Year, Incorporation (optional)
// 1-1:"T", 2-2:"G", 3-8: naics(6N/6S), 9-17: duns(9N/9S), 18-20: filerCode(3AN)
// 21-24: yearEstablished(4N/4S), 25-26: state(2A/2S), 27-28: country(2A/2S)
// 29-58: reference(30X), 59-62: scac(4A/4S), 63-66: firms(4AN), 67-80: filler
export const RECORD_TG_SPEC: RecordSpec<TGInput> = {
  recordType: "TG-Record (NAICS/DUNS/Filer/Incorporation)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "G"),
    { key: "naicsCode", start: 3, length: 6, class: "AN", designation: "O" },
    { key: "dunsNumber", start: 9, length: 9, class: "AN", designation: "O" },
    { key: "filerCode", start: 18, length: 3, class: "AN", designation: "O" },
    { key: "yearEstablished", start: 21, length: 4, class: "AN", designation: "O" },
    { key: "incorporationState", start: 25, length: 2, class: "A", designation: "O" },
    { key: "incorporationCountry", start: 27, length: 2, class: "A", designation: "O" },
    { key: "referenceNumber", start: 29, length: 30, class: "X", designation: "O" },
    { key: "scacIdentifier", start: 59, length: 4, class: "AN", designation: "O" },
    { key: "firmsCode", start: 63, length: 4, class: "AN", designation: "O" },
    filler(67, 14),
  ],
};

// TH: Primary Bank Information (optional)
// 1-1:"T", 2-2:"H", 3-32: bankName(30X), 33-43: routing(11AN), 44-73: bankCity(30X)
// 74-75: state(2A/2S), 76-77: country(2A/2S), 78-80: filler
export const RECORD_TH_SPEC: RecordSpec<THInput> = {
  recordType: "TH-Record (Primary Bank Information)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "H"),
    { key: "primaryBankName", start: 3, length: 30, class: "X", designation: "O" },
    { key: "routingNumber", start: 33, length: 11, class: "AN", designation: "O" },
    { key: "bankCity", start: 44, length: 30, class: "X", designation: "O" },
    { key: "bankState", start: 74, length: 2, class: "A", designation: "O" },
    { key: "bankCountry", start: 76, length: 2, class: "A", designation: "O" },
    filler(78, 3),
  ],
};

// TI: Company Officer Part 1 (conditional)
// 1-1:"T", 2-2:"I", 3-4: lineItemNumber(2N), 5-34: name(30X), 35-56: title(22X)
// 57-65: ssn(9N/9S), 66-80: filler
export const RECORD_TI_SPEC: RecordSpec<TIOfficer> = {
  recordType: "TI-Record (Officer Part 1 – Name/Title/SSN)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "I"),
    { key: "lineItemNumber", start: 3, length: 2, class: "N", designation: "M" },
    { key: "name", start: 5, length: 30, class: "X", designation: "M" },
    { key: "title", start: 35, length: 22, class: "X", designation: "M" },
    { key: "ssn", start: 57, length: 9, class: "AN", designation: "C" },
    filler(66, 15),
  ],
};

// TJ: Company Officer Part 2 (conditional)
// 1-1:"T", 2-2:"J", 3-4: lineItemNumber(2N), 5-17: passportNumber(13AN)
// 18-25: expirationDate(8N/8S MMDDYYYY), 26-27: countryIssuance(2A/2S)
// 28-28: passportType(1N/1S), 29-43: phone(15AN), 44-49: extension(6N/6S)
// 50-79: email(30X), 80-80: filler
export const RECORD_TJ_SPEC: RecordSpec<TJOfficer> = {
  recordType: "TJ-Record (Officer Part 2 – Passport/Phone/Email)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "J"),
    { key: "lineItemNumber", start: 3, length: 2, class: "N", designation: "M" },
    { key: "passportNumber", start: 5, length: 13, class: "AN", designation: "O" },
    {
      key: "passportExpirationDate",
      start: 18,
      length: 8,
      class: "N",
      designation: "C",
      encodeValue: (raw) => {
        const d = raw as Date;
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yyyy = String(d.getFullYear()).padStart(4, "0");
        return `${mm}${dd}${yyyy}`;
      },
      decodeValue: (field) => {
        if (field.trim().length === 0) return undefined;
        const mm = parseInt(field.slice(0, 2), 10);
        const dd = parseInt(field.slice(2, 4), 10);
        const yyyy = parseInt(field.slice(4, 8), 10);
        return new Date(yyyy, mm - 1, dd);
      },
    },
    { key: "passportCountryOfIssuance", start: 26, length: 2, class: "A", designation: "C" },
    { key: "passportType", start: 28, length: 1, class: "AN", designation: "C" },
    { key: "phone", start: 29, length: 15, class: "AN", designation: "M" },
    { key: "phoneExtension", start: 44, length: 6, class: "AN", designation: "O" },
    { key: "email", start: 50, length: 30, class: "X", designation: "M" },
    filler(80, 1),
  ],
};

// TK: Related Business (optional, repeating)
// 1-1:"T", 2-2:"K", 3-4: lineItemNumber(2N), 5-5: relatedBusiness(1AN)
// 6-35: nameOfEntity(30X), 36-47: tinEinSsnCbp(12X), 48-80: filler
export const RECORD_TK_SPEC: RecordSpec<TKRelatedBusiness> = {
  recordType: "TK-Record (Related Business)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "K"),
    { key: "lineItemNumber", start: 3, length: 2, class: "N", designation: "M" },
    { key: "relatedBusiness", start: 5, length: 1, class: "AN", designation: "M" },
    { key: "nameOfEntity", start: 6, length: 30, class: "X", designation: "M" },
    { key: "tinEinSsnCbp", start: 36, length: 12, class: "X", designation: "M" },
    filler(48, 33),
  ],
};

// TL: Individual Certification / Electronic Signature (mandatory)
// 1-1:"T", 2-2:"L", 3-3: signature(1A), 4-33: certifyingName(30X), 34-55: title(22X), 56-80: filler
export const RECORD_TL_SPEC: RecordSpec<TLInput> = {
  recordType: "TL-Record (Individual Certification)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "L"),
    { key: "electronicSignature", start: 3, length: 1, class: "A", designation: "M" },
    { key: "certifyingIndividualFullName", start: 4, length: 30, class: "X", designation: "M" },
    { key: "title", start: 34, length: 22, class: "X", designation: "M" },
    filler(56, 25),
  ],
};

// TM: Broker Certification (optional)
// 1-1:"T", 2-2:"M", 3-32: brokersName(30X), 33-47: certIndividualPhone(15AN),
// 48-62: brokersPhone(15AN), 63-80: filler
export const RECORD_TM_SPEC: RecordSpec<TMInput> = {
  recordType: "TM-Record (Broker Certification)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "M"),
    { key: "brokersName", start: 3, length: 30, class: "X", designation: "O" },
    { key: "certifyingIndividualPhone", start: 33, length: 15, class: "AN", designation: "O" },
    { key: "brokersPhone", start: 48, length: 15, class: "AN", designation: "O" },
    filler(63, 18),
  ],
};

// TN: Overflow Record (optional)
// 1-1:"T", 2-2:"N", 3-5: qualifierCode(3AN), 6-75: additionalInfo(70X), 76-80: filler
export const RECORD_TN_SPEC: RecordSpec<TNInput> = {
  recordType: "TN-Record (Overflow)",
  length: 80,
  fields: [
    constantField(1, "T"),
    constantField(2, "N"),
    { key: "additionalInfoQualifierCode", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "additionalInformation", start: 6, length: 70, class: "X", designation: "C" },
    filler(76, 5),
  ],
};

// E0: Importer Create/Update Condition Reference (output)
// 1-2:"E0", 3-3: filler, 4-9: referenceDataTypeCode(6AN), 10-10: filler
// 11-16: occurrencePosition(6N), 17-17: filler, 18-24: "REF ID:" constant
// 25-25: filler, 26-80: referenceDataText(55X)
export const RECORD_E0_SPEC: RecordSpec<E0Output> = {
  recordType: "E0-Record (Condition Reference)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("E0"),
    { key: "referenceDataText", start: 26, length: 55, class: "X", designation: "M" },
  ],
};

// E1: Importer Create/Update Condition/Disposition Response (output)
// 1-2:"E1", 3-3: dispositionTypeCode(1AN), 4-4: severityCode(1AN)
// 5-7: conditionCode(3AN), 8-10: reasonCode(3AN), 11-50: narrativeText(40AN), 51-80: filler
export const RECORD_E1_SPEC: RecordSpec<E1Output> = {
  recordType: "E1-Record (Condition/Disposition Response)",
  length: 80,
  fields: [
    constantField(1, "E1"),
    { key: "dispositionTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "severityCode", start: 4, length: 1, class: "AN", designation: "M" },
    { key: "conditionCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "reasonCode", start: 8, length: 3, class: "AN", designation: "C" },
    { key: "narrativeText", start: 11, length: 40, class: "AN", designation: "M" },
    filler(51, 30),
  ],
};

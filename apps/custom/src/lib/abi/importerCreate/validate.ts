// Validation for 5106 Importer/Consignee Create/Update input before ABI transmission.
// Source: docs/plans/catair-source-docs/19-importer-consignee-create-update-5106-v12.pdf

import type { ImporterCreateInput } from "./types";

export interface ValidationError {
  field: string;
  message: string;
}

const IRS_EIN_RE = /^\d{2}-\d{7}[A-Z0-9]{2}$/;
const SSN_RE = /^\d{3}-\d{2}-\d{4}$/;
const CBP_ASSIGNED_RE = /^\d{6}-\d{5}$/;

/** Validate the importerNumber format based on action code and type. */
function validateImporterNumber(num: string, actionCode: string): ValidationError | null {
  if (actionCode === "N") return null; // space-filled, not validated
  const stripped = num.trim();
  if (stripped.length === 0) {
    return { field: "t1.importerNumber", message: "Importer number required for actionCode A or U." };
  }
  if (!IRS_EIN_RE.test(stripped) && !SSN_RE.test(stripped) && !CBP_ASSIGNED_RE.test(stripped)) {
    return {
      field: "t1.importerNumber",
      message:
        "Importer number must be IRS EIN (NN-NNNNNNNXX), SSN (NNN-NN-NNNN), or CBP-assigned (NNNNNN-NNNNN).",
    };
  }
  return null;
}

/** Validate a phone number — digits and spaces only, 7-15 chars. */
function validatePhone(phone: string, field: string): ValidationError | null {
  const stripped = phone.replace(/\s/g, "");
  if (stripped.length < 7 || stripped.length > 15 || !/^\d+$/.test(stripped)) {
    return { field, message: "Phone must be 7-15 digits (spaces allowed)." };
  }
  return null;
}

/**
 * Validate an ImporterCreateInput and return a list of validation errors.
 * An empty array means the input is ready to encode.
 */
export function validateImporterCreateInput(input: ImporterCreateInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // T1
  const numErr = validateImporterNumber(input.t1.importerNumber, input.t1.actionCode);
  if (numErr) errors.push(numErr);

  if (!input.t1.abbreviatedImporterName.trim()) {
    errors.push({ field: "t1.abbreviatedImporterName", message: "Abbreviated importer name is required." });
  }
  if (input.t1.abbreviatedImporterName.length > 32) {
    errors.push({ field: "t1.abbreviatedImporterName", message: "Abbreviated importer name exceeds 32 characters." });
  }
  if (!input.t1.mailingAddressLine1.trim()) {
    errors.push({ field: "t1.mailingAddressLine1", message: "Mailing address line 1 is required." });
  }

  // T2
  if (!input.t2.mailingCity.trim()) {
    errors.push({ field: "t2.mailingCity", message: "Mailing city is required." });
  }
  if (!input.t2.mailingStateCode.trim()) {
    errors.push({ field: "t2.mailingStateCode", message: "Mailing state code is required." });
  }
  if (!input.t2.mailingCountryCode.trim()) {
    errors.push({ field: "t2.mailingCountryCode", message: "Mailing country code is required." });
  }
  const country = input.t2.mailingCountryCode.toUpperCase();
  if ((country === "US" || country === "CA") && !input.t2.mailingPostalCode?.trim()) {
    errors.push({ field: "t2.mailingPostalCode", message: "Postal code required for US/CA addresses." });
  }

  // TB / TC – if TB present, TC must be present too
  if (input.tb && !input.tc) {
    errors.push({ field: "tc", message: "TC (physical city/state/postal/country) required when TB is provided." });
  }

  // TD
  const phoneErr = validatePhone(input.td.phone, "td.phone");
  if (phoneErr) errors.push(phoneErr);

  if (input.td.utilOther === "X" && !input.td.utilOtherDescription?.trim()) {
    errors.push({
      field: "td.utilOtherDescription",
      message: "Utilization description required when utilOther = X.",
    });
  }

  // TE
  const validMailingTypes = ["1", "2", "3", "4", "5", "6", "7", "8"];
  if (!validMailingTypes.includes(input.te.mailingAddressType)) {
    errors.push({ field: "te.mailingAddressType", message: "Mailing address type must be 1-8." });
  }
  if (input.te.mailingAddressType === "8" && !input.te.mailingAddressExplanation?.trim()) {
    errors.push({
      field: "te.mailingAddressExplanation",
      message: "Mailing address explanation required when type = 8 (Other).",
    });
  }
  if (input.tb && !input.te.physicalAddressType) {
    errors.push({
      field: "te.physicalAddressType",
      message: "Physical address type required when physical address (TB) is provided.",
    });
  }

  // TF
  if (!input.tf.email.trim()) {
    errors.push({ field: "tf.email", message: "Email address is required." });
  }

  // Officers: TI + TJ must always come in pairs
  if (input.officers) {
    for (let i = 0; i < input.officers.length; i++) {
      const { ti, tj } = input.officers[i];
      if (ti.lineItemNumber !== tj.lineItemNumber) {
        errors.push({
          field: `officers[${i}]`,
          message: `TI/TJ line item numbers must match (TI=${ti.lineItemNumber}, TJ=${tj.lineItemNumber}).`,
        });
      }
      if (!ti.name.trim()) {
        errors.push({ field: `officers[${i}].ti.name`, message: "Officer name is required." });
      }
      if (!ti.title.trim()) {
        errors.push({ field: `officers[${i}].ti.title`, message: "Officer title is required." });
      }
      if (input.td.cbpAssignedNumberRequestReasonIndicator === "X" && !ti.ssn?.trim()) {
        errors.push({
          field: `officers[${i}].ti.ssn`,
          message: "SSN required when CBP-Assigned Number Request Reason Indicator is set.",
        });
      }
      const officerPhoneErr = validatePhone(tj.phone, `officers[${i}].tj.phone`);
      if (officerPhoneErr) errors.push(officerPhoneErr);
      if (!tj.email.trim()) {
        errors.push({ field: `officers[${i}].tj.email`, message: "Officer email is required." });
      }
      if (tj.passportNumber && !tj.passportType) {
        errors.push({
          field: `officers[${i}].tj.passportType`,
          message: "Passport type required when passport number is provided.",
        });
      }
    }
  }

  // TL – signature must be "X"
  if (input.tl.electronicSignature !== "X") {
    errors.push({ field: "tl.electronicSignature", message: "Electronic signature must be X." });
  }
  if (!input.tl.certifyingIndividualFullName.trim()) {
    errors.push({ field: "tl.certifyingIndividualFullName", message: "Certifying individual full name is required." });
  }
  if (!input.tl.title.trim()) {
    errors.push({ field: "tl.title", message: "Certifying individual title is required." });
  }

  return errors;
}

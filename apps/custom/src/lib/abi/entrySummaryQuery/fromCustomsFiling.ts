import { buildEntryNumber, isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import { assembleEntryNumberQuery, type AssembleQueryOptions } from "./assembleQuery";
import { wrapBlock, wrapBatch } from "@/lib/abi/batchBlockControl/build";
import type { ARecordInput, BRecordInput } from "@/lib/abi/batchBlockControl/types";
import type { EntryReference } from "./types";
import { type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";

export { type EnvelopeHeaderOptions };

/**
 * Error thrown when one or more CustomsFiling records cannot be converted to
 * Entry Summary Query (ESQ) request format due to missing or invalid fields.
 */
export class AbiQueryFilingValidationError extends Error {
  constructor(
    public readonly filingId: string,
    public readonly missingFields: string[]
  ) {
    super(
      `CustomsFiling "${filingId}" cannot be converted to ABI Entry Summary Query format: ${missingFields.join(", ")}.`
    );
    this.name = "AbiQueryFilingValidationError";
  }
}

export type CustomsFilingQueryInput = {
  id?: string;
  entryNumber: string;
};

export type AbiFilerCredentialLike = string | { filerCode: string };

/**
 * Resolves the 3-character Entry Filer Code from an explicit filerCode string or AbiFilerCredential.
 */
function resolveFilerCode(credentialLike: AbiFilerCredentialLike): string {
  const code = typeof credentialLike === "string" ? credentialLike : credentialLike.filerCode;
  const cleaned = (code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(cleaned)) {
    throw new Error(
      `AbiFilerCredential filerCode must be exactly 3 uppercase alphanumeric characters, got "${code}".`
    );
  }
  return cleaned;
}

/**
 * Extracts and validates an 8-character Entry Number (7-digit transaction number + Appendix E check digit)
 * for a single CustomsFiling record.
 */
export function extractEntryReference(
  filing: CustomsFilingQueryInput,
  resolvedFilerCode: string
): EntryReference {
  const rawNumber = filing.entryNumber ? filing.entryNumber.trim() : "";
  if (!rawNumber) {
    throw new AbiQueryFilingValidationError(filing.id ?? "unknown", [
      "entryNumber is required",
    ]);
  }

  const cleaned = rawNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Scenario 1: 11-char string containing 3-char filer code + 8-char entry number (e.g. "N0150000037")
  if (cleaned.length === 11) {
    const entryFilerCode = cleaned.slice(0, 3);
    const entryNum = cleaned.slice(3);
    if (isValidEntryNumberCheckDigit(entryFilerCode, entryNum)) {
      return { entryFilerCode, entryNumber: entryNum };
    }
    // Recompute check digit using 7 tx digits
    const txNum = entryNum.slice(0, 7);
    return {
      entryFilerCode,
      entryNumber: buildEntryNumber(entryFilerCode, txNum),
    };
  }

  // Scenario 2: 8-char string (7 tx digits + 1 check digit)
  if (cleaned.length === 8) {
    if (isValidEntryNumberCheckDigit(resolvedFilerCode, cleaned)) {
      return { entryFilerCode: resolvedFilerCode, entryNumber: cleaned };
    }
    // Recompute check digit using 7 tx digits
    const txNum = cleaned.slice(0, 7);
    return {
      entryFilerCode: resolvedFilerCode,
      entryNumber: buildEntryNumber(resolvedFilerCode, txNum),
    };
  }

  // Scenario 3: 7-char string (7 tx digits, missing check digit)
  if (cleaned.length === 7) {
    return {
      entryFilerCode: resolvedFilerCode,
      entryNumber: buildEntryNumber(resolvedFilerCode, cleaned),
    };
  }

  throw new AbiQueryFilingValidationError(filing.id ?? "unknown", [
    `entryNumber "${rawNumber}" is invalid (must be 7 tx digits, 8-char entry number, or 11-char filer+entry number)`,
  ]);
}

/**
 * Converts one or more database CustomsFiling records (and explicit AbiFilerCredential)
 * into an array of EntryReference pairs ready for Entry Summary Query assembly.
 */
export function extractEntryReferencesFromCustomsFilings(
  filings: CustomsFilingQueryInput | CustomsFilingQueryInput[],
  filerCredentialLike: AbiFilerCredentialLike
): EntryReference[] {
  const filerCode = resolveFilerCode(filerCredentialLike);
  const items = Array.isArray(filings) ? filings : [filings];

  if (items.length === 0) {
    throw new Error("At least one CustomsFiling record must be provided to query.");
  }

  return items.map((f) => extractEntryReference(f, filerCode));
}

/**
 * End-to-end composer function for Entry Summary Query (request side):
 * Takes one or more CustomsFiling records and a resolved AbiFilerCredential / filerCode,
 * maps them to EntryReference[], calls assembleEntryNumberQuery(),
 * wraps in a B...Y block envelope and A...Z batch envelope, and returns the full transmittable line array.
 */
export function buildAbiQueryTransmissionForFilings(
  filings: CustomsFilingQueryInput | CustomsFilingQueryInput[],
  filerCredentialLike: AbiFilerCredentialLike,
  envelopeHeader: EnvelopeHeaderOptions,
  opts: AssembleQueryOptions = {}
): string[] {
  const entries = extractEntryReferencesFromCustomsFilings(filings, filerCredentialLike);
  const queryLines = assembleEntryNumberQuery(entries, opts);

  const filerCode = resolveFilerCode(filerCredentialLike);
  // "EQ" per src/lib/abi/batchBlockControl/applicationIdentifierCodes.ts
  // ("Entry Summary Query", inputCode "EQ") -- NOT "JC", which is the Entry
  // Summary Status Detail *output record's* own 2-char prefix inside the
  // response, an unrelated namespace from the batch/block envelope's
  // Application Identifier Code field.
  const applicationIdentifierCode = envelopeHeader.applicationIdentifierCode ?? "EQ";

  const bRecordInput: BRecordInput = {
    processingDistrictPortCode: envelopeHeader.processingDistrictPortCode,
    processingFilerCode: envelopeHeader.processingFilerCode || filerCode,
    applicationIdentifierCode,
    processingFilerOfficeCode: envelopeHeader.processingFilerOfficeCode,
    filerPreparerUserDataText: envelopeHeader.filerPreparerUserDataText,
  };

  const blockLines = wrapBlock(bRecordInput, queryLines);

  const aRecordInput: ARecordInput = {
    senderReceiverSiteCode: envelopeHeader.senderReceiverSiteCode,
    senderReceiverIdCode: envelopeHeader.senderReceiverIdCode,
    communicationPassword: envelopeHeader.communicationPassword,
    transmissionDate: envelopeHeader.transmissionDate,
    applicationIdentifierCode,
    senderReceiverOfficeCode: envelopeHeader.senderReceiverOfficeCode,
    transmitterUserDataText: envelopeHeader.transmitterUserDataText,
  };

  return wrapBatch(aRecordInput, [blockLines]);
}

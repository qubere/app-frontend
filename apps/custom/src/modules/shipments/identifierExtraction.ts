/**
 * Transport-identifier extraction from free text (email subjects, parsed
 * document bodies) for deterministic shipment matching.
 *
 * Philosophy mirrors `shipmentMatching.ts`: patterns here are deliberately
 * permissive -- they generate *candidate tokens*, not matches. The only thing
 * that turns a token into a match is an exact (normalized) lookup against a
 * real row in `Shipment` / `ShipmentTrackingIdentifier`. A loose regex that
 * over-generates is fine; the database is the filter. What we must not do is
 * fuzzy-match a token to a shipment.
 */

export type MatchIdentifierType =
  | "SHIPMENT_NUMBER"
  | "PO_REFERENCE"
  | "MBL"
  | "HBL"
  | "CONTAINER"
  | "BOOKING"
  | "MAWB"
  | "HAWB";

export interface IdentifierCandidates {
  shipmentNumbers: string[];
  poReferences: string[];
  /** ISO 6346 container numbers (check-digit validity tracked separately). */
  containers: string[];
  /** Ocean bill-of-lading / booking style tokens (SCAC + alphanumerics). */
  billsOfLading: string[];
  /** Air waybill tokens (111-12345678 master style + freeform house). */
  airWaybills: string[];
}

// System-generated, unique per account -- the strongest possible signal.
const SHIPMENT_NUMBER_PATTERN = /\bSHP-(?:\d{4}-\d{6}|[A-Z0-9]{2,12}-\d{4}-\d{3,8})\b/gi;

// "PO-778899", "P.O. 778899", "PO#778899" -- capture the whole token so
// normalization stays format-insensitive without losing the "PO" identity.
const PO_REFERENCE_PATTERN = /\bP\.?O\.?[-\s#:]*[A-Z0-9-]{3,20}\b/gi;

// ISO 6346: 3-letter owner code, equipment category (U/J/Z), 6-digit serial,
// 1 check digit. Whitespace/hyphen between groups is common in documents.
const CONTAINER_PATTERN = /\b([A-Z]{3})[\s-]?([UJZ])[\s-]?(\d{6})[\s-]?(\d)\b/gi;

// Ocean BL / booking: a 2-4 letter prefix (often a SCAC) followed by 6-16
// alphanumerics. Over-generates heavily on purpose -- DB lookup filters.
const OCEAN_BL_PATTERN = /\b[A-Z]{2,4}[A-Z0-9]{6,16}\b/g;

// Master air waybill: 3-digit airline prefix, optional hyphen, 8-digit serial.
const MAWB_PATTERN = /\b(\d{3})-?(\d{8})\b/g;

// House air waybill: 2-4 letters then 4-12 digits (freeform, forwarder-issued).
const HAWB_PATTERN = /\b[A-Z]{2,4}\d{4,12}\b/g;

/** Uppercase + strip everything that is not A-Z0-9. */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * ISO 6346 check-digit validation for a normalized 11-character container
 * number (4 letters + 7 digits). Returns false for anything not matching that
 * shape.
 */
export function isValidContainerNumber(normalized: string): boolean {
  if (!/^[A-Z]{4}\d{7}$/.test(normalized)) return false;

  // Letter values per ISO 6346 -- the alphabet numbered from 10, skipping
  // every multiple of 11 (so 11, 22, 33 are never used).
  const VALUES: Record<string, number> = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = normalized[i];
    const value = i < 4 ? VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  const remainder = sum % 11;
  const check = remainder === 10 ? 0 : remainder;
  return check === Number(normalized[10]);
}

function dedupeUpper(matches: RegExpMatchArray | null): string[] {
  return Array.from(new Set((matches ?? []).map((v) => v.toUpperCase())));
}

export function extractIdentifierCandidates(text: string): IdentifierCandidates {
  const shipmentNumbers = dedupeUpper(text.match(SHIPMENT_NUMBER_PATTERN));

  const poReferences = Array.from(
    new Set((text.match(PO_REFERENCE_PATTERN) ?? []).map(normalizeIdentifier))
  );

  const containers = Array.from(
    new Set(
      Array.from(text.matchAll(CONTAINER_PATTERN)).map((m) =>
        normalizeIdentifier(`${m[1]}${m[2]}${m[3]}${m[4]}`)
      )
    )
  );

  const billsOfLading = Array.from(
    new Set([
      ...(text.match(OCEAN_BL_PATTERN) ?? []).map((v) => v.toUpperCase()),
    ])
  ).filter(
    // A valid container is not also a BL token; keep the buckets disjoint.
    (tok) => !isValidContainerNumber(normalizeIdentifier(tok))
  );

  const airWaybills = Array.from(
    new Set([
      ...Array.from(text.matchAll(MAWB_PATTERN)).map((m) => `${m[1]}${m[2]}`),
      ...(text.match(HAWB_PATTERN) ?? []).map((v) => v.toUpperCase()),
    ])
  );

  return { shipmentNumbers, poReferences, containers, billsOfLading, airWaybills };
}

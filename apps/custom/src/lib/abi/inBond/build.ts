import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  IN_BOND_HEADER_SPEC,
  CONVEYANCE_INFO_SPEC,
  BOL_HEADER_SPEC,
  SECONDARY_NOTIFY_PARTIES_SPEC,
  REFERENCE_IDENTIFIER_SPEC,
  IN_BOND_EVENT_HEADER_SPEC,
  IN_BOND_EVENT_DETAIL_SPEC,
} from "./recordSpecs";
import type {
  InBondHeaderInput,
  ConveyanceInfoInput,
  BillOfLadingHeaderInput,
  SecondaryNotifyPartiesInput,
  ReferenceIdentifierInput,
  InBondEventHeaderInput,
  InBondEventDetailInput,
} from "./types";

// Thin buildX(input): string wrappers, one per In-Bond chapter input record
// (QP10/20/30/32/33, WP10/20). Mirrors every other chapter's build.ts —
// validation beyond field-level (mandatory/class/length) is left to
// `encodeRecord` itself; no extra business-rule layer here since none of
// these records has a cross-field invariant analogous to e.g. Cargo Manifest
// Query's "exactly one query type" rule.

/** Builds the QP10-Record (In-Bond Header). */
export function buildInBondHeader(input: InBondHeaderInput): string {
  return encodeRecord(IN_BOND_HEADER_SPEC, input);
}

/** Builds the QP20-Record (Conveyance Information). */
export function buildConveyanceInfo(input: ConveyanceInfoInput): string {
  return encodeRecord(CONVEYANCE_INFO_SPEC, input);
}

/** Builds the QP30-Record (Bill of Lading Header). */
export function buildBillOfLadingHeader(input: BillOfLadingHeaderInput): string {
  return encodeRecord(BOL_HEADER_SPEC, input);
}

/** Builds the QP32-Record (Secondary Notify Parties). */
export function buildSecondaryNotifyParties(input: SecondaryNotifyPartiesInput): string {
  return encodeRecord(SECONDARY_NOTIFY_PARTIES_SPEC, input);
}

/** Builds the QP33-Record (Reference Identifier). */
export function buildReferenceIdentifier(input: ReferenceIdentifierInput): string {
  return encodeRecord(REFERENCE_IDENTIFIER_SPEC, input);
}

/** Builds the WP10-Record (In-Bond Event Header). */
export function buildInBondEventHeader(input: InBondEventHeaderInput): string {
  return encodeRecord(IN_BOND_EVENT_HEADER_SPEC, input);
}

/** Builds the WP20-Record (In-Bond Event Detail). */
export function buildInBondEventDetail(input: InBondEventDetailInput): string {
  return encodeRecord(IN_BOND_EVENT_DETAIL_SPEC, input);
}

import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  RECORD_10_HEADER_SPEC,
  RECORD_12_SECONDARY_NOTIFY_SPEC,
  RECORD_20_STB_SPEC,
  RECORD_30_PRINCIPAL_SPEC,
  RECORD_35_CO_PRINCIPAL_SPEC,
  RECORD_36_BOND_USER_SPEC,
  RECORD_40_SURETY_SPEC,
  RECORD_45_CO_SURETY_SPEC,
  RECORD_46_RE_INSURER_SPEC,
} from "./recordSpecs";
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
} from "./types";

export function buildHeader(input: HeaderInput): string {
  return encodeRecord(RECORD_10_HEADER_SPEC, input);
}

export function buildSecondaryNotify(input: SecondaryNotifyInput): string {
  return encodeRecord(RECORD_12_SECONDARY_NOTIFY_SPEC, input);
}

export function buildSingleTransactionBond(input: SingleTransactionBondInput): string {
  return encodeRecord(RECORD_20_STB_SPEC, input);
}

export function buildPrincipal(input: PrincipalInput): string {
  return encodeRecord(RECORD_30_PRINCIPAL_SPEC, input);
}

export function buildCoPrincipal(input: CoPrincipalInput): string {
  return encodeRecord(RECORD_35_CO_PRINCIPAL_SPEC, input);
}

export function buildBondUser(input: BondUserInput): string {
  return encodeRecord(RECORD_36_BOND_USER_SPEC, input);
}

export function buildSurety(input: SuretyInput): string {
  return encodeRecord(RECORD_40_SURETY_SPEC, input);
}

export function buildCoSurety(input: CoSuretyInput): string {
  return encodeRecord(RECORD_45_CO_SURETY_SPEC, input);
}

export function buildReinsurer(input: ReinsurerInput): string {
  return encodeRecord(RECORD_46_RE_INSURER_SPEC, input);
}

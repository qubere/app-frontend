import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE17_EQUIPMENT_SPEC,
  SE20_REFERENCE_SPEC,
  SE30_HEADER_ENTITY_SPEC,
  SE31_HEADER_ENTITY_GBI_SPEC,
  SE35_HEADER_ENTITY_ADDRESS_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE41_FTZ_DETAIL_SPEC,
  SE50_LINE_ENTITY_SPEC,
  SE51_LINE_ENTITY_GBI_SPEC,
  SE55_LINE_ENTITY_ADDRESS_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE60_HTS_LINE_SPEC,
  SE61_FTZ_PF_HTS_SPEC,
} from "./recordSpecs";
import type {
  HeaderInput,
  AdditionalHeaderInput,
  ContactCancellationInput,
  BillOfLadingInput,
  ConveyanceInput,
  ReferenceInput,
  EntityInput,
  EntityAddressInput,
  EntityGeoInput,
  LineItemInput,
  HtsLineInput,
  EquipmentInput,
  EntityGbiInput,
  FtzDetailInput,
  FtzPfHtsInput,
} from "./types";

export function buildHeader(input: HeaderInput): string {
  return encodeRecord(SE10_HEADER_SPEC, input);
}

export function buildAdditionalHeader(input: AdditionalHeaderInput): string {
  return encodeRecord(SE11_ADDITIONAL_HEADER_SPEC, input);
}

export function buildContactCancellation(input: ContactCancellationInput): string {
  return encodeRecord(SE13_CONTACT_CANCEL_SPEC, input);
}

export function buildBillOfLading(input: BillOfLadingInput): string {
  return encodeRecord(SE15_BILL_OF_LADING_SPEC, input);
}

export function buildConveyance(input: ConveyanceInput): string {
  return encodeRecord(SE16_CONVEYANCE_SPEC, input);
}

export function buildEquipment(input: EquipmentInput): string {
  return encodeRecord(SE17_EQUIPMENT_SPEC, input);
}

export function buildReference(input: ReferenceInput): string {
  return encodeRecord(SE20_REFERENCE_SPEC, input);
}

export function buildHeaderEntity(input: EntityInput): string {
  return encodeRecord(SE30_HEADER_ENTITY_SPEC, input);
}

export function buildHeaderEntityGbi(input: EntityGbiInput): string {
  return encodeRecord(SE31_HEADER_ENTITY_GBI_SPEC, input);
}

export function buildHeaderEntityAddress(input: EntityAddressInput): string {
  return encodeRecord(SE35_HEADER_ENTITY_ADDRESS_SPEC, input);
}

export function buildHeaderEntityGeo(input: EntityGeoInput): string {
  return encodeRecord(SE36_HEADER_ENTITY_GEO_SPEC, input);
}

export function buildLineItem(input: LineItemInput): string {
  return encodeRecord(SE40_LINE_ITEM_SPEC, input);
}

export function buildFtzDetail(input: FtzDetailInput): string {
  return encodeRecord(SE41_FTZ_DETAIL_SPEC, input);
}

export function buildLineEntity(input: EntityInput): string {
  return encodeRecord(SE50_LINE_ENTITY_SPEC, input);
}

export function buildLineEntityGbi(input: EntityGbiInput): string {
  return encodeRecord(SE51_LINE_ENTITY_GBI_SPEC, input);
}

export function buildLineEntityAddress(input: EntityAddressInput): string {
  return encodeRecord(SE55_LINE_ENTITY_ADDRESS_SPEC, input);
}

export function buildLineEntityGeo(input: EntityGeoInput): string {
  return encodeRecord(SE56_LINE_ENTITY_GEO_SPEC, input);
}

export function buildHtsLine(input: HtsLineInput): string {
  return encodeRecord(SE60_HTS_LINE_SPEC, input);
}

export function buildFtzPfHts(input: FtzPfHtsInput): string {
  return encodeRecord(SE61_FTZ_PF_HTS_SPEC, input);
}

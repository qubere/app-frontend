import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { A_INPUT_SPEC, B_INPUT_SPEC, Y_INPUT_SPEC, Z_INPUT_SPEC } from "./recordSpecs";
import type { ARecordInput, BRecordInput, YRecordInput, ZRecordInput } from "./types";

export function buildARecord(input: ARecordInput): string {
  return encodeRecord(A_INPUT_SPEC, input);
}

export function buildBRecord(input: BRecordInput): string {
  return encodeRecord(B_INPUT_SPEC, input);
}

export function buildYRecord(input: YRecordInput): string {
  return encodeRecord(Y_INPUT_SPEC, input);
}

export function buildZRecord(input: ZRecordInput): string {
  return encodeRecord(Z_INPUT_SPEC, input);
}

function assertOpaqueRecordLength(line: string, expectedLength: number, index: number): void {
  if (line.length !== expectedLength) {
    throw new AbiFixedWidthError(
      `Transaction detail record at index ${index} is ${line.length} chars, expected exactly ${expectedLength}.`
    );
  }
}

/**
 * Wraps opaque transaction detail lines in a B...Y block envelope. The Y-Record's
 * fields that must equal the B-Record (per the spec's "MUST be identical" rule)
 * are derived from `header` automatically rather than left to the caller.
 */
export function wrapBlock(header: BRecordInput, transactionRecords: string[]): string[] {
  transactionRecords.forEach((line, i) => assertOpaqueRecordLength(line, 80, i));

  const yRecord: YRecordInput = {
    processingDistrictPortCode: header.processingDistrictPortCode,
    processingFilerCode: header.processingFilerCode,
    applicationIdentifierCode: header.applicationIdentifierCode,
    processingFilerOfficeCode: header.processingFilerOfficeCode,
  };

  return [buildBRecord(header), ...transactionRecords, buildYRecord(yRecord)];
}

/**
 * Wraps one or more already-wrapped blocks in an A...Z batch envelope. The
 * Z-Record's fields that must equal the A-Record are derived from `header`.
 */
export function wrapBatch(header: ARecordInput, blocks: string[][]): string[] {
  if (blocks.length === 0) {
    throw new AbiFixedWidthError("A batch must enclose at least one block control grouping.");
  }

  const zRecord: ZRecordInput = {
    senderReceiverSiteCode: header.senderReceiverSiteCode,
    senderReceiverIdCode: header.senderReceiverIdCode,
    transmissionDate: header.transmissionDate,
    senderReceiverOfficeCode: header.senderReceiverOfficeCode,
  };

  return [buildARecord(header), ...blocks.flat(), buildZRecord(zRecord)];
}

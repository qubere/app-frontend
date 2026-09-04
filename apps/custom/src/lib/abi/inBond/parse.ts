import { decodeRecord } from "@/lib/abi/fixedWidth";
import {
  QT95_RESPONSE_SPEC,
  WT95_RESPONSE_SPEC,
  STATUS_NOTIFICATION_HEADER_SPEC,
  STATUS_NOTIFICATION_DETAIL_SPEC,
  STATUS_NOTIFICATION_CONTINUATION_SPEC,
  STATUS_NOTIFICATION_REMARKS_SPEC,
} from "./recordSpecs";
import type {
  InBondResponseMessageOutput,
  StatusNotificationHeaderOutput,
  StatusNotificationDetailOutput,
  StatusNotificationContinuationOutput,
  StatusNotificationRemarksOutput,
} from "./types";

// Decode/classify helpers for the In-Bond chapter's output records: QT95,
// WT95 (both Transaction Response Message — see recordSpecs.ts for why they
// share a field layout but keep separately-named decode functions), and the
// NS10/NS30/NS40/NS50 Status Notification stream.

/**
 * Decodes a QT95-Record (In-Bond Transaction Response Message — QP context).
 * Structurally identical to `parseWt95Response` (see recordSpecs.ts's
 * `responseMessageFields`), but kept as a separate function per record
 * identity, matching every other chapter's one-function-per-record pattern.
 */
export function parseQt95Response(line: string): InBondResponseMessageOutput {
  return decodeRecord(QT95_RESPONSE_SPEC, line);
}

/** Decodes a WT95-Record (Arrival/Export/Transfer Response Message — WP context). */
export function parseWt95Response(line: string): InBondResponseMessageOutput {
  return decodeRecord(WT95_RESPONSE_SPEC, line);
}

export function parseStatusNotificationHeader(line: string): StatusNotificationHeaderOutput {
  return decodeRecord(STATUS_NOTIFICATION_HEADER_SPEC, line);
}

export function parseStatusNotificationDetail(line: string): StatusNotificationDetailOutput {
  return decodeRecord(STATUS_NOTIFICATION_DETAIL_SPEC, line);
}

export function parseStatusNotificationContinuation(line: string): StatusNotificationContinuationOutput {
  return decodeRecord(STATUS_NOTIFICATION_CONTINUATION_SPEC, line);
}

export function parseStatusNotificationRemarks(line: string): StatusNotificationRemarksOutput {
  return decodeRecord(STATUS_NOTIFICATION_REMARKS_SPEC, line);
}

export type InBondStatusNotificationLineType = "NS10" | "NS30" | "NS40" | "NS50" | "UNKNOWN";

/**
 * Classifies a line from an NS (status notification) stream by its 4-char
 * control identifier. "UNKNOWN" covers NS05 (the non-QP filer equivalent of
 * NS10) and NS60 (container-level status notification) — both explicitly
 * out of scope this slice — as well as any batch/block envelope line.
 */
export function classifyStatusNotificationLine(line: string): InBondStatusNotificationLineType {
  const four = line.slice(0, 4);
  if (four === "NS10" || four === "NS30" || four === "NS40" || four === "NS50") {
    return four;
  }
  return "UNKNOWN";
}

/** One NS30 disposition/posting event plus the continuation/remarks records
 * that structurally follow it, if present. */
export interface StatusNotificationDetailGroup {
  detail: StatusNotificationDetailOutput;
  continuation?: StatusNotificationContinuationOutput;
  remarks?: StatusNotificationRemarksOutput;
}

/** One in-bond's full status notification: the NS10 header plus 1+ NS30
 * detail groups. */
export interface InBondStatusNotificationResult {
  header?: StatusNotificationHeaderOutput;
  details: StatusNotificationDetailGroup[];
  /** Lines that don't classify as NS10/NS30/NS40/NS50 — NS05, NS60, or a
   * batch/block envelope line. Preserved in original order rather than
   * silently dropped. */
  unrecognizedLines: string[];
}

/**
 * Walks a raw NS (status notification) stream: the NS10 header sets
 * `header`; each NS30 opens a new detail group; a following NS40 or NS50
 * attaches to the most recently opened group (per the record structure —
 * NS40/NS50 only ever follow the NS30 they elaborate on).
 */
export function parseInBondStatusNotification(lines: string[]): InBondStatusNotificationResult {
  const result: InBondStatusNotificationResult = { details: [], unrecognizedLines: [] };
  let current: StatusNotificationDetailGroup | undefined;

  for (const line of lines) {
    const type = classifyStatusNotificationLine(line);
    switch (type) {
      case "NS10":
        result.header = parseStatusNotificationHeader(line);
        break;
      case "NS30":
        current = { detail: parseStatusNotificationDetail(line) };
        result.details.push(current);
        break;
      case "NS40":
        if (current) current.continuation = parseStatusNotificationContinuation(line);
        else result.unrecognizedLines.push(line);
        break;
      case "NS50":
        if (current) current.remarks = parseStatusNotificationRemarks(line);
        else result.unrecognizedLines.push(line);
        break;
      default:
        result.unrecognizedLines.push(line);
    }
  }

  return result;
}

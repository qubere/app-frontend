import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import {
  DETAIL_RETURN_REQUEST_SPEC,
  ENTRY_NUMBER_QUERY_REQUEST_SPEC,
  CRITERIA_QUERY_REQUEST_SPEC,
} from "./recordSpecs";
import type { EntryReference, EntryNumberQueryRequestInput, CriteriaQueryRequestInput } from "./types";

const ENTRIES_PER_J1_RECORD = 5;

/** Builds the J0-Record. Its presence in a query is itself the "include detail" signal. */
export function buildDetailReturnRequest(): string {
  return encodeRecord(DETAIL_RETURN_REQUEST_SPEC, { returnDetailRequestIndicator: "Y" });
}

function assertValidEntryReference(entry: EntryReference): void {
  if (!isValidEntryNumberCheckDigit(entry.entryFilerCode, entry.entryNumber)) {
    throw new AbiFixedWidthError(
      `J1-Record: Entry Number "${entry.entryNumber}" has an invalid check digit for Entry Filer Code "${entry.entryFilerCode}" (Appendix E).`
    );
  }
}

/** Builds one J1-Record from 1-5 entry references. Use `buildEntryNumberQueryRequests`
 * to query more than 5 by chunking across repeated J1-Records. */
export function buildEntryNumberQueryRequest(entries: EntryReference[]): string {
  if (entries.length < 1 || entries.length > ENTRIES_PER_J1_RECORD) {
    throw new AbiFixedWidthError(
      `J1-Record (Entry Number Query Request): expects 1-5 entry references, got ${entries.length}.`
    );
  }
  entries.forEach(assertValidEntryReference);

  const input: Partial<EntryNumberQueryRequestInput> = {};
  entries.forEach((entry, i) => {
    const n = i + 1;
    (input as Record<string, unknown>)[`entryFilerCode${n}`] = entry.entryFilerCode;
    (input as Record<string, unknown>)[`entryNumber${n}`] = entry.entryNumber;
  });
  return encodeRecord(ENTRY_NUMBER_QUERY_REQUEST_SPEC, input as EntryNumberQueryRequestInput);
}

/** Chunks an arbitrary list of entry references into as many J1-Records as needed. */
export function buildEntryNumberQueryRequests(entries: EntryReference[]): string[] {
  if (entries.length === 0) {
    throw new AbiFixedWidthError("Entry Number Query Request needs at least one entry reference.");
  }
  const records: string[] = [];
  for (let i = 0; i < entries.length; i += ENTRIES_PER_J1_RECORD) {
    records.push(buildEntryNumberQueryRequest(entries.slice(i, i + ENTRIES_PER_J1_RECORD)));
  }
  return records;
}

export function buildCriteriaQueryRequest(input: CriteriaQueryRequestInput): string {
  if (input.requestedToDateTime < input.requestedFromDateTime) {
    throw new AbiFixedWidthError(
      "J2-Record: Requested To Date/Time must not be before Requested From Date/Time."
    );
  }
  const spanMs = input.requestedToDateTime.getTime() - input.requestedFromDateTime.getTime();
  const spanDays = spanMs / (1000 * 60 * 60 * 24);
  if (spanDays > 31) {
    throw new AbiFixedWidthError(
      `J2-Record: date range spans more than 31 days (${spanDays.toFixed(1)}) — CBP rejects with DATE RANGE DAY LIMIT EXCEEDED.`
    );
  }
  return encodeRecord(CRITERIA_QUERY_REQUEST_SPEC, input);
}

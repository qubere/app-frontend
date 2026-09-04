import { buildDetailReturnRequest, buildEntryNumberQueryRequests, buildCriteriaQueryRequest } from "./build";
import type { EntryReference, CriteriaQueryRequestInput } from "./types";

export interface AssembleQueryOptions {
  /** Adds the optional J0-Record, requesting full AE 10-90 content back for each match. */
  includeDetail?: boolean;
}

/**
 * Assembles an Entry Number Query Request: optional J0, then one or more
 * J1-Records (chunked 5 entries per record). Per the Input Record Structure Map,
 * only ONE query type (entry-number or criteria) may appear per Block Control
 * envelope — modeled here as two distinct functions rather than one input type,
 * so the exclusivity is enforced by which function is called.
 */
export function assembleEntryNumberQuery(entries: EntryReference[], opts: AssembleQueryOptions = {}): string[] {
  const records: string[] = [];
  if (opts.includeDetail) records.push(buildDetailReturnRequest());
  records.push(...buildEntryNumberQueryRequests(entries));
  return records;
}

/** Assembles an Entry Summary Criteria Query Request: optional J0, then a single J2-Record. */
export function assembleCriteriaQuery(criteria: CriteriaQueryRequestInput, opts: AssembleQueryOptions = {}): string[] {
  const records: string[] = [];
  if (opts.includeDetail) records.push(buildDetailReturnRequest());
  records.push(buildCriteriaQueryRequest(criteria));
  return records;
}

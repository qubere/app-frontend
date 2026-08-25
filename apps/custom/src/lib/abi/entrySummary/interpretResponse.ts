import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";
import type {
  ParsedEntrySummaryResponse,
  E1Record,
  E0Record,
} from "./types";

export interface InterpretedCondition {
  /** The original parsed E1Record condition line. */
  condition: E1Record;
  /** Preceding E0 reference records indicating what caused this condition. */
  references: E0Record[];
  /** Code looked up in the ACE Error Dictionary (conditionCode or reasonCode). */
  lookupCode: string;
  /**
   * All matching entries from the ACE Error Dictionary for this code.
   * Multiple entries are preserved when a code is shared across ACE chapters (ambiguous context).
   */
  matchedErrors: ErrorDictionaryEntry[];
  /** Primary narrative title (from E1Record or dictionary narrative text). */
  title: string;
  /** Human-readable description explaining the error condition. */
  description: string;
}

export interface InterpretedEntrySummaryResponse {
  /** Overall transaction scenario ("ACCEPTED" or "REJECTED"). */
  scenario: "ACCEPTED" | "REJECTED";
  /** Final disposition E1Record (dispositionTypeCode "A" or "R"). */
  finalDisposition: E1Record;
  /** Matched error dictionary entries for final disposition condition/reason code if any. */
  finalDispositionErrors: ErrorDictionaryEntry[];
  /** All non-final condition records with error dictionary enrichment. */
  conditions: InterpretedCondition[];
  /** True if any condition record has severityCode === "F" (fatal error). */
  hasFatalErrors: boolean;
  /** Summary breakdown of condition severities. */
  summaryCounts: {
    fatal: number;
    warning: number;
    informational: number;
    total: number;
  };
}

/**
 * Shape of data ready for insertion into Prisma `CustomsResponse` table.
 */
export interface CustomsResponseRecordData {
  accountId: string;
  filingId: string;
  code: string;
  title: string;
  description: string;
  status: string;
}

/**
 * Enriches a single E1Record's conditionCode/reasonCode against the ACE Error Dictionary.
 * Returns all matched dictionary entries (preserving multi-match ambiguity) along with
 * derived human-readable title and description.
 */
export function enrichE1Record(
  e1: E1Record,
  references: E0Record[] = []
): InterpretedCondition {
  const code = (e1.conditionCode || e1.reasonCode || "").trim();
  const matchedErrors = code ? getAllAbiErrors(code) : [];

  let title: string;
  let description: string;

  if (matchedErrors.length > 0) {
    title = e1.narrativeText.trim() || matchedErrors[0].narrativeText;

    if (matchedErrors.length === 1) {
      description = matchedErrors[0].explanation;
    } else {
      // Multiple matches exist across ACE chapters -- surface all explanations cleanly
      description = matchedErrors
        .map(
          (err, i) =>
            `[Match ${i + 1} - ${err.narrativeText}]: ${err.explanation}`
        )
        .join("\n\n");
    }
  } else {
    title = e1.narrativeText.trim() || (code ? `CBP Code ${code}` : "CBP Condition");
    description = e1.narrativeText.trim()
      ? `CBP returned condition code "${code}": ${e1.narrativeText.trim()}`
      : `CBP returned condition code "${code}" with no additional explanation.`;
  }

  return {
    condition: e1,
    references,
    lookupCode: code,
    matchedErrors,
    title,
    description,
  };
}

/**
 * Takes the parsed output of `parseEntrySummaryResponse` (flat E0/E1 records)
 * and enriches all E1 condition records with human-readable error dictionary entries,
 * surfacing all matches without collapsing ambiguous codes.
 */
export function interpretEntrySummaryResponse(
  parsed: ParsedEntrySummaryResponse
): InterpretedEntrySummaryResponse {
  const conditions: InterpretedCondition[] = parsed.conditions.map((item) =>
    enrichE1Record(item.condition, item.references)
  );

  const finalCode = (
    parsed.finalDisposition.conditionCode ||
    parsed.finalDisposition.reasonCode ||
    ""
  ).trim();
  const finalDispositionErrors = finalCode ? getAllAbiErrors(finalCode) : [];

  let fatalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const c of conditions) {
    const sev = c.condition.severityCode;
    if (sev === "F") fatalCount++;
    else if (sev === "W" || sev === "P") warningCount++;
    else if (sev === "I") infoCount++;
  }

  return {
    scenario: parsed.scenario,
    finalDisposition: parsed.finalDisposition,
    finalDispositionErrors,
    conditions,
    hasFatalErrors: fatalCount > 0,
    summaryCounts: {
      fatal: fatalCount,
      warning: warningCount,
      informational: infoCount,
      total: conditions.length,
    },
  };
}

/**
 * Converts an interpreted Entry Summary response into `CustomsResponse` record inputs
 * suitable for `db.customsResponse.create()`.
 */
export function buildCustomsResponseRecords(
  interpreted: InterpretedEntrySummaryResponse,
  accountId: string,
  filingId: string
): CustomsResponseRecordData[] {
  const records: CustomsResponseRecordData[] = [];

  // Record each non-final condition
  for (const cond of interpreted.conditions) {
    const status =
      cond.condition.severityCode === "F"
        ? "REJECTED"
        : cond.condition.severityCode === "W"
        ? "WARNING"
        : "INFORMATIONAL";

    records.push({
      accountId,
      filingId,
      code: cond.lookupCode || "E1",
      title: cond.title,
      description: cond.description,
      status,
    });
  }

  // Record final disposition
  const finalCode =
    interpreted.finalDisposition.conditionCode ||
    interpreted.finalDisposition.reasonCode ||
    "E1";
  const finalTitle =
    interpreted.scenario === "ACCEPTED"
      ? "Entry Summary Accepted by CBP"
      : "Entry Summary Rejected by CBP";

  records.push({
    accountId,
    filingId,
    code: finalCode,
    title: finalTitle,
    description: interpreted.finalDisposition.narrativeText.trim()
      ? interpreted.finalDisposition.narrativeText.trim()
      : `Transaction ${interpreted.scenario.toLowerCase()} by CBP.`,
    status: interpreted.scenario,
  });

  return records;
}

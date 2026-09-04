/**
 * Cross-document reconciliation engine (B-1).
 *
 * Takes ExtractionField rows grouped by document type and applies the rule
 * table from reconciliationRules.ts. Returns one ReconciliationResult per
 * rule that could be evaluated (both document types present and field
 * extracted from each).
 *
 * Pure and database-free — callers supply the data, this module only compares.
 */

import { RECONCILIATION_RULES, type DiscrepancyType, type NormalizationFn } from "./reconciliationRules";
import { REVIEW_REQUIRED_BELOW } from "@/modules/documents/extractionReview";

export interface FieldRow {
  fieldName: string;
  value: string;
  confidence?: number | null;
}

export interface DocumentGroup {
  documentId: string;
  docType: string;
  fields: FieldRow[];
}

export interface ReconciliationResult {
  ruleId: string;
  fieldName: string;
  docTypeA: string;
  documentIdA: string;
  valueA: string;
  docTypeB: string;
  documentIdB: string;
  valueB: string;
  match: boolean;
  discrepancyType: DiscrepancyType;
  /** BLOCKING maps to "Critical", WARNING to "Warning", INFO to "Info". */
  severity: "BLOCKING" | "WARNING" | "INFO";
  description: string;
}

export interface EngineOutput {
  results: ReconciliationResult[];
  /** Rules that ran but found no discrepancy. */
  evaluatedRuleIds: string[];
  /** Rules that could not run because a document type or field was absent. */
  skippedRuleIds: string[];
}

// ── Normalization ─────────────────────────────────────────────────────────────

const LEGAL_SUFFIX_MAP: Record<string, string> = {
  " ltd": " limited",
  " llc": " limited liability company",
  " inc": " incorporated",
  " corp": " corporation",
  " co\\.": " company",
  " pvt": " private",
};

function applyNorm(value: string, fn: NormalizationFn): string | null {
  const raw = value.trim();
  if (raw === "") return null;

  switch (fn) {
    case "text":
      return raw.toLowerCase().replace(/\s+/g, " ");

    case "number": {
      const cleaned = raw.replace(/[^0-9.\-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) && cleaned !== "" ? String(parsed) : null;
    }

    case "currency_amount": {
      // Strip currency symbols, codes (USD, EUR, CNY …), commas, spaces
      const stripped = raw.replace(/[^0-9.\-]/g, "");
      const parsed = Number(stripped);
      return Number.isFinite(parsed) && stripped !== "" ? String(parsed) : null;
    }

    case "party_name": {
      let s = raw.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
      for (const [abbr, full] of Object.entries(LEGAL_SUFFIX_MAP)) {
        s = s.replace(new RegExp(`${abbr}$`, "i"), full);
      }
      return s.trim();
    }

    case "container_id":
      return raw.toUpperCase().replace(/[\s\-]/g, "");

    case "quantity_unit": {
      // Strip unit words (EA, PCS, PC, PIECE(S), UNIT(S)) and separators, keep the number.
      const stripped = raw
        .toLowerCase()
        .replace(/\b(ea|pcs?|pieces?|units?)\b/g, "")
        .replace(/[^0-9.\-]/g, "");
      const parsed = Number(stripped);
      return Number.isFinite(parsed) && stripped !== "" ? String(parsed) : null;
    }

    case "weight_unit": {
      // Extract the numeric part and a recognized weight unit, convert to kilograms.
      const m = raw.toLowerCase().match(/(-?[0-9,.]+)\s*(kgs?|kilograms?|g|grams?|lbs?|pounds?)?/);
      if (!m) return null;
      const num = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(num)) return null;
      const unit = m[2] ?? "kg";
      let kg: number;
      if (/^(g|grams?)$/.test(unit)) kg = num / 1000;
      else if (/^(lbs?|pounds?)$/.test(unit)) kg = num * 0.453592;
      else kg = num; // kg/kilograms, or no unit given → assume kg
      return String(kg);
    }
  }
}

function withinTolerance(a: string, b: string, tolerancePct: number): boolean {
  if (tolerancePct === 0) return a === b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || na === 0) return a === b;
  return Math.abs(na - nb) / Math.abs(na) <= tolerancePct / 100;
}

// ── Engine ────────────────────────────────────────────────────────────────────

function docTypeMatches(docType: string, pattern: string): boolean {
  return docType.toLowerCase().includes(pattern.toLowerCase());
}

function pickField(group: DocumentGroup, fieldKey: string): FieldRow | null {
  const row = group.fields.find((f) => f.fieldName === fieldKey);
  return row?.value?.trim() ? row : null;
}

/** BLOCKING -> WARNING -> INFO, one step down. INFO stays INFO. */
function downgradeSeverity(severity: ReconciliationResult["severity"]): ReconciliationResult["severity"] {
  if (severity === "BLOCKING") return "WARNING";
  if (severity === "WARNING") return "INFO";
  return "INFO";
}

export function runReconciliationEngine(documents: DocumentGroup[]): EngineOutput {
  const results: ReconciliationResult[] = [];
  const evaluatedRuleIds: string[] = [];
  const skippedRuleIds: string[] = [];

  for (const rule of RECONCILIATION_RULES) {
    const groupsA = documents.filter((d) => docTypeMatches(d.docType, rule.docTypeA));
    const groupsB = documents.filter((d) => docTypeMatches(d.docType, rule.docTypeB));

    if (groupsA.length === 0 || groupsB.length === 0) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    // Compare across the first matching document of each type. When a shipment
    // carries two invoices, only the first is used — multi-document sets are
    // handled by calling the engine separately per unique document pair.
    const groupA = groupsA[0];
    const groupB = groupsB[0];

    // Skip a rule where both sides matched the same document.
    if (groupA.documentId === groupB.documentId) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    const fieldA = pickField(groupA, rule.fieldKey);
    const fieldB = pickField(groupB, rule.fieldKey);

    if (fieldA === null || fieldB === null) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    const rawA = fieldA.value.trim();
    const rawB = fieldB.value.trim();

    const normA = applyNorm(rawA, rule.normalizationFn);
    const normB = applyNorm(rawB, rule.normalizationFn);

    if (normA === null || normB === null) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    const match = withinTolerance(normA, normB, rule.tolerancePct);
    let severity: ReconciliationResult["severity"] = match
      ? "INFO"
      : rule.blocksFiling
        ? "BLOCKING"
        : "WARNING";

    const lowConfidence =
      (fieldA.confidence != null && fieldA.confidence < REVIEW_REQUIRED_BELOW) ||
      (fieldB.confidence != null && fieldB.confidence < REVIEW_REQUIRED_BELOW);
    if (!match && lowConfidence) {
      severity = downgradeSeverity(severity);
    }

    evaluatedRuleIds.push(rule.id);

    if (!match) {
      results.push({
        ruleId: rule.id,
        fieldName: rule.fieldKey,
        docTypeA: groupA.docType,
        documentIdA: groupA.documentId,
        valueA: rawA,
        docTypeB: groupB.docType,
        documentIdB: groupB.documentId,
        valueB: rawB,
        match: false,
        discrepancyType: rule.discrepancyType,
        severity,
        description: rule.description,
      });
    }
  }

  return { results, evaluatedRuleIds, skippedRuleIds };
}

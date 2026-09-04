/**
 * Planned-vs-actual (plan drift) detection.
 *
 * Treats the first-ever reading of a business-critical field on a shipment as
 * its implicit "plan," and flags when a later reading (a correction, or a
 * newly-extracted document) disagrees with that baseline beyond the field's
 * cross-document tolerance. Reuses the RECONCILIATION_RULES tolerance table
 * and the applyNorm/withinTolerance helpers from reconciliationEngine.ts so
 * this doesn't invent a second field taxonomy or normalization scheme.
 *
 * Pure and database-free — callers supply the readings, this module only compares.
 */

import { RECONCILIATION_RULES, type DiscrepancyType, type NormalizationFn } from "./reconciliationRules";
import { applyNorm, withinTolerance } from "./reconciliationEngine";

interface TrackedField {
  discrepancyType: DiscrepancyType;
  normalizationFn: NormalizationFn;
  tolerancePct: number;
}

export const PLAN_TRACKED_FIELDS: ReadonlyMap<string, TrackedField> = (() => {
  const map = new Map<string, TrackedField>();
  for (const rule of RECONCILIATION_RULES) {
    const existing = map.get(rule.fieldKey);
    if (!existing) {
      map.set(rule.fieldKey, {
        discrepancyType: rule.discrepancyType,
        normalizationFn: rule.normalizationFn,
        tolerancePct: rule.tolerancePct,
      });
    } else if (rule.tolerancePct > existing.tolerancePct) {
      map.set(rule.fieldKey, { ...existing, tolerancePct: rule.tolerancePct });
    }
  }
  return map;
})();

export interface PlanFieldReading {
  fieldKey: string;
  value: string;
  createdAt: string;
  documentId: string;
  docType: string;
}

export interface PlanChangeResult {
  fieldKey: string;
  discrepancyType: DiscrepancyType;
  baselineValue: string;
  baselineAt: string;
  baselineDocType: string;
  baselineDocumentId: string;
  currentValue: string;
  changedAt: string;
  currentDocType: string;
  currentDocumentId: string;
}

export interface PlanChangeOutput {
  results: PlanChangeResult[];
  /** Tracked fields with >=2 readings and parseable baseline/current values. */
  evaluatedFieldKeys: string[];
}

export function detectPlanChanges(readings: PlanFieldReading[]): PlanChangeOutput {
  const results: PlanChangeResult[] = [];
  const evaluatedFieldKeys: string[] = [];

  const byField = new Map<string, PlanFieldReading[]>();
  for (const reading of readings) {
    if (!PLAN_TRACKED_FIELDS.has(reading.fieldKey)) continue;
    const group = byField.get(reading.fieldKey);
    if (group) group.push(reading);
    else byField.set(reading.fieldKey, [reading]);
  }

  for (const [fieldKey, group] of byField) {
    if (group.length < 2) continue;

    const tracked = PLAN_TRACKED_FIELDS.get(fieldKey)!;
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const baseline = sorted[0];
    const current = sorted[sorted.length - 1];

    const normBaseline = applyNorm(baseline.value, tracked.normalizationFn);
    const normCurrent = applyNorm(current.value, tracked.normalizationFn);
    if (normBaseline === null || normCurrent === null) continue;

    evaluatedFieldKeys.push(fieldKey);

    if (withinTolerance(normBaseline, normCurrent, tracked.tolerancePct)) continue;

    results.push({
      fieldKey,
      discrepancyType: tracked.discrepancyType,
      baselineValue: baseline.value,
      baselineAt: baseline.createdAt,
      baselineDocType: baseline.docType,
      baselineDocumentId: baseline.documentId,
      currentValue: current.value,
      changedAt: current.createdAt,
      currentDocType: current.docType,
      currentDocumentId: current.documentId,
    });
  }

  return { results, evaluatedFieldKeys };
}

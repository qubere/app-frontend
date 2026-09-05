/**
 * JSON API serializer (U10): a stable, versioned envelope around the pure
 * EntrySummaryDraft. Pure function: no DB, no I/O; `generatedAt` comes from
 * the injected `clock`, never `new Date()` inline.
 *
 * Deviation from the issue text, same root cause as U8/U9: the pure
 * `EntrySummaryDraft` (U1 model) carries no `shipmentId`/`draftId`/
 * `draftVersion` — only the U7-persisted `EntrySummaryDraftRow` does. Those
 * three identifiers are accepted as an explicit `opts` parameter rather than
 * derived from `draft`.
 *
 * Reuses draft.service.ts's own `DraftNotExportable` error class (it already
 * carries shipmentId/version/blockingCount, which this module has via
 * `opts`) rather than defining a second, differently-shaped error of the
 * same conceptual meaning.
 */

import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import type { EntrySummaryDraft } from "../model";
import type { EntrySummaryField } from "../provenance";
import type { FilerProfileRecord } from "../filerProfile";
import type { ValidationResult } from "../validation/engine";
import { DraftNotExportable } from "../draft.service";

export const ENTRY_SUMMARY_JSON_SCHEMA_VERSION = "1.0.0";

export interface SerializeJsonOptions {
  clock: () => Date;
  shipmentId: string;
  draftId: string;
  draftVersion: number;
}

export interface SerializedFile {
  filename: string;
  contentType: string;
  body: string;
}

interface JsonFieldMapConfig {
  includeProvenance: boolean;
}

function parseJsonFieldMap(raw: unknown): JsonFieldMapConfig {
  const obj = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const includeProvenance = typeof obj.includeProvenance === "boolean" ? obj.includeProvenance : true;
  return { includeProvenance };
}

function isOtherFeeArray(value: unknown): value is Array<{ code: string; label: string; amount: Decimal }> {
  return Array.isArray(value);
}

function serializeFieldValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return roundToCents(value).toFixed(2);
  if (isOtherFeeArray(value)) {
    return value.map((fee) => ({
      code: fee.code,
      label: fee.label,
      amount: roundToCents(fee.amount as Decimal).toFixed(2),
    }));
  }
  return value;
}

function buildValuesMap(fields: Record<string, EntrySummaryField<unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields).sort()) {
    out[key] = serializeFieldValue(fields[key].value);
  }
  return out;
}

function buildProvenanceMap(fields: Record<string, EntrySummaryField<unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields).sort()) {
    out[key] = fields[key].provenance;
  }
  return out;
}

function asFieldMap(fields: unknown): Record<string, EntrySummaryField<unknown>> {
  return fields as unknown as Record<string, EntrySummaryField<unknown>>;
}

/**
 * Builds the stable JSON envelope. Throws `DraftNotExportable` (never
 * silently serializes a draft with BLOCKING findings) — a caller must pass
 * the `ValidationResult` for the exact draft version being exported.
 */
export function serializeJson(
  draft: EntrySummaryDraft,
  profile: FilerProfileRecord,
  validation: ValidationResult,
  opts: SerializeJsonOptions
): SerializedFile {
  if (!validation.isExportable) {
    throw new DraftNotExportable(opts.shipmentId, opts.draftVersion, validation.blockingCount);
  }

  const fieldMap = parseJsonFieldMap(profile.fieldMap);

  const headerFields = asFieldMap(draft.header.fields);
  const lines = draft.lines.map((line) => ({
    lineNumber: line.lineNumber,
    sourceLineNumber: line.sourceLineNumber,
    parentLineNumber: line.parentLineNumber,
    fields: buildValuesMap(asFieldMap(line.fields)),
  }));

  const envelope: Record<string, unknown> = {
    schemaVersion: ENTRY_SUMMARY_JSON_SCHEMA_VERSION,
    generatedAt: opts.clock().toISOString(),
    filerCode: profile.filerCode,
    source: {
      shipmentId: opts.shipmentId,
      draftId: opts.draftId,
      draftVersion: opts.draftVersion,
    },
    entrySummary: {
      header: buildValuesMap(headerFields),
      lines,
    },
  };

  if (fieldMap.includeProvenance) {
    envelope.provenance = {
      header: buildProvenanceMap(headerFields),
      lines: draft.lines.map((line) => buildProvenanceMap(asFieldMap(line.fields))),
    };
  }

  envelope.validation = {
    warnings: validation.findings.filter((f) => f.severity !== "BLOCKING"),
  };

  const body = JSON.stringify(envelope, null, 2);
  const filename = `${profile.filerCode}_${opts.shipmentId}_v${opts.draftVersion}.json`;

  return { filename, contentType: "application/json", body };
}

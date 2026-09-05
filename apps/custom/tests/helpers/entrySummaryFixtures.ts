/**
 * Shared test fixture builders for the U8-U11 serializer/export test suites
 * (issue #219 Phase B). Not a *.test.ts file, so vitest does not collect it.
 *
 * Builds a fully-populated (every block present, defaulting to MISSING)
 * EntrySummaryDraft + FilerProfileRecord so each test only needs to override
 * the handful of blocks it actually cares about.
 */

import { Decimal } from "@/lib/tariff/decimal";
import {
  HEADER_BLOCK_IDS,
  LINE_BLOCK_IDS,
  type EntrySummaryDraft,
  type EntrySummaryLine,
  type HeaderBlockId,
  type HeaderFields,
  type LineBlockId,
  type LineFields,
} from "@/modules/entrySummary/model";
import type { EntrySummaryField } from "@/modules/entrySummary/provenance";
import type { FilerProfileRecord } from "@/modules/entrySummary/filerProfile";

export const FIXTURE_ASOF = "2026-01-01T00:00:00.000Z";

function missingField<T>(blockId: HeaderBlockId | LineBlockId): EntrySummaryField<T> {
  return { blockId, value: null, provenance: { source: "MISSING", asOf: FIXTURE_ASOF } } as EntrySummaryField<T>;
}

export function userField<T>(blockId: HeaderBlockId | LineBlockId, value: T): EntrySummaryField<T> {
  return { blockId, value, provenance: { source: "USER", asOf: FIXTURE_ASOF, fieldApprovalId: "fa_1" } } as EntrySummaryField<T>;
}

export function buildEmptyHeaderFields(): HeaderFields {
  const fields = {} as Record<string, EntrySummaryField<unknown>>;
  for (const id of HEADER_BLOCK_IDS) fields[id] = missingField(id);
  return fields as unknown as HeaderFields;
}

export function buildEmptyLineFields(): LineFields {
  const fields = {} as Record<string, EntrySummaryField<unknown>>;
  for (const id of LINE_BLOCK_IDS) fields[id] = missingField(id);
  return fields as unknown as LineFields;
}

export function buildLine(
  lineNumber: number,
  overrides: Partial<Record<LineBlockId, unknown>> = {},
  opts: { sourceLineNumber?: number | null; parentLineNumber?: number | null } = {}
): EntrySummaryLine {
  const fields = buildEmptyLineFields() as unknown as Record<string, EntrySummaryField<unknown>>;
  for (const [k, v] of Object.entries(overrides)) {
    fields[k] = userField(k as LineBlockId, v);
  }
  return {
    lineNumber,
    sourceLineNumber: opts.sourceLineNumber === undefined ? lineNumber : opts.sourceLineNumber,
    parentLineNumber: opts.parentLineNumber ?? null,
    fields: fields as unknown as LineFields,
  };
}

export function buildDraft(
  lines: EntrySummaryLine[],
  headerOverrides: Partial<Record<HeaderBlockId, unknown>> = {},
  generatedAt: string = FIXTURE_ASOF
): EntrySummaryDraft {
  const fields = buildEmptyHeaderFields() as unknown as Record<string, EntrySummaryField<unknown>>;
  for (const [k, v] of Object.entries(headerOverrides)) {
    fields[k] = userField(k as HeaderBlockId, v);
  }
  return { header: { fields: fields as unknown as HeaderFields }, lines, generatedAt };
}

export function buildFilerProfile(overrides: Partial<FilerProfileRecord> = {}): FilerProfileRecord {
  return {
    id: "fp_1",
    accountId: "acct_1",
    name: "Test Filer",
    filerCode: "ABC",
    defaultPortCode: "2704",
    format: "CSV",
    formatVersion: "1.0",
    fieldMap: {},
    transport: "DOWNLOAD",
    transportConfig: null,
    active: true,
    ...overrides,
  };
}

export function money(v: string | number): Decimal {
  return new Decimal(v);
}

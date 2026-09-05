/**
 * Extraction review model.
 *
 * A correction is stored as a NEW ExtractionField row rather than an update, so
 * the machine's original reading is never overwritten and the correction history
 * is immutable by construction. `source` distinguishes the two, and the ordering
 * rules here — not a raw `confidence DESC` — decide which reading is current.
 *
 * Pure: no database, no React. Everything here is exercised directly by tests.
 */
import type { DocumentType } from "@prisma/client";
import { getFieldExpectation, getRequiredFields, type FieldExpectation } from "@/lib/documents/extractionSchemas";
import { resolveField, canonicalizeFieldKey } from "@/lib/documents/fieldDictionary";
import { FIELD_VERIFICATION_STATES, type FieldVerificationState } from "./fieldVerification";

export const HUMAN_CORRECTION_SOURCE = "HUMAN_CORRECTION";

/**
 * A reviewed value is not a model prediction, so it carries no model score.
 * Confidence stays null on a correction; `source` is what makes it authoritative.
 */
export const REVIEW_REQUIRED_BELOW = 80;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawExtractionField {
  id: string;
  fieldName: string;
  value: string;
  confidence: number | null;
  pageNumber: number | null;
  bbox: unknown;
  source: string;
  createdAt: Date | string;
}

export interface FieldRevision {
  id: string;
  value: string;
  confidence: number | null;
  source: string;
  createdAt: string;
  isCorrection: boolean;
}

export interface ReviewField {
  fieldName: string;
  /** The reading in force: the newest human correction, else the best machine read. */
  currentValue: string;
  /** The machine's first reading. Null when the field only ever came from a human. */
  originalValue: string | null;
  /** Model confidence of the machine reading. Null when never scored. */
  confidence: number | null;
  pageNumber: number | null;
  bbox: BoundingBox | null;
  corrected: boolean;
  /**
   * True when a reviewer should look at it: low or absent confidence,
   * uncorrected. Derived from `verification` — kept as a boolean alias so
   * existing callers (DocumentReviewPanel, nextReviewIndex) don't need to
   * change; true for NEEDS_REVIEW, MISSING_REQUIRED, and CONFLICT.
   */
  needsReview: boolean;
  /** Why this field is (or isn't) in a state a reviewer must act on. */
  verification: FieldVerificationState;
  /** Stable code from fieldVerification.ts's REVIEW_REASONS, or null when nothing to explain. */
  reasonCode: string | null;
  /** Newest first. Every reading ever stored for this field. */
  history: FieldRevision[];
}

/**
 * The 5-state verification outcome for one field, plus why (see
 * fieldVerification.ts's REVIEW_REASONS for reasonCode meanings).
 *
 * Precedence: a field that doesn't belong on this document type is
 * NOT_APPLICABLE regardless of anything else. A required field with no
 * machine read and no correction is MISSING_REQUIRED — genuinely absent, not
 * just low-confidence. A field the caller has flagged as conflicting with
 * another document takes CONFLICT next. Otherwise a corrected or
 * high-confidence field is AUTO_VERIFIED; anything else NEEDS_REVIEW.
 */
export function evaluateFieldVerification(field: {
  corrected: boolean;
  confidence: number | null;
  expectation: FieldExpectation;
  hasMachineRead: boolean;
  hasConflict?: boolean;
}): { state: FieldVerificationState; reasonCode: string | null } {
  if (field.expectation === "NOT_EXPECTED") {
    return { state: "NOT_APPLICABLE", reasonCode: null };
  }
  if (field.expectation === "EXPECTED" && !field.hasMachineRead && !field.corrected) {
    return { state: "MISSING_REQUIRED", reasonCode: "MISSING_ON_SOURCE_DOCUMENT" };
  }
  if (field.hasConflict) {
    return { state: "CONFLICT", reasonCode: "CROSS_DOCUMENT_CONFLICT" };
  }
  if (field.corrected || (field.confidence !== null && field.confidence >= REVIEW_REQUIRED_BELOW)) {
    return { state: "AUTO_VERIFIED", reasonCode: null };
  }
  return { state: "NEEDS_REVIEW", reasonCode: "LOW_CONFIDENCE" };
}

/** Accepts the stored Json column, which may be anything. */
export function parseBoundingBox(raw: unknown): BoundingBox | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const x = candidate.x;
  const y = candidate.y;
  const width = candidate.width;
  const height = candidate.height;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function newestFirst(a: FieldRevision, b: FieldRevision): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Groups raw rows into one entry per field name.
 *
 * Precedence for the current reading is explicit: the newest human correction
 * wins outright. Confidence only breaks ties between machine readings, because a
 * reviewed value is not competing on model score.
 */
export function buildReviewFields(
  rows: RawExtractionField[],
  docType?: DocumentType | null,
  conflictedFieldNames?: ReadonlySet<string>
): ReviewField[] {
  // ExtractionField rows come from sources that speak different fieldName
  // vocabularies (OCR_AI_AGENT's freeform LLM labels vs. DOC_INTEL_STRUCTURED's
  // fixed reconciliation keys) for the same real-world fact. Group by the
  // dictionary's canonical key when a row's name resolves, so both spellings
  // land in one ReviewField instead of two; an unresolvable freeform label
  // just keeps its own bucket, same as before this normalization existed.
  const byName = new Map<string, RawExtractionField[]>();
  for (const row of rows) {
    const key = resolveField(row.fieldName)?.canonicalKey ?? row.fieldName;
    const bucket = byName.get(key);
    if (bucket) bucket.push(row);
    else byName.set(key, [row]);
  }

  const conflictedCanonicalKeys = conflictedFieldNames
    ? new Set([...conflictedFieldNames].map((name) => canonicalizeFieldKey(name) ?? name))
    : null;

  const fields: ReviewField[] = [];
  const presentSchemaNames = new Set<string>();

  for (const [groupKey, group] of byName) {
    const resolved = resolveField(groupKey);
    // Display/schema-facing name: prefer the extractionSchemas.ts snake_case
    // spelling, then the reconciliation camelCase spelling, so getFieldExpectation
    // and existing callers (including the cross-document reconcile route, which
    // keys its own rules by the reconciliation vocabulary) keep working against
    // their expected vocabulary regardless of which source wrote this. Falling
    // back to the dictionary's dotted canonicalKey here would hand callers a
    // spelling nothing else in the app uses, so fall back to the row's own
    // fieldName instead -- identical to groupKey when nothing resolved.
    const fieldName = resolved?.extractionSchemaKeys[0] ?? resolved?.reconciliationKey ?? group[0].fieldName;
    presentSchemaNames.add(fieldName);
    const history: FieldRevision[] = group
      .map((row) => ({
        id: row.id,
        value: row.value,
        confidence: row.confidence,
        source: row.source,
        createdAt: toIso(row.createdAt),
        isCorrection: row.source === HUMAN_CORRECTION_SOURCE,
      }))
      .sort(newestFirst);

    const corrections = history.filter((rev) => rev.isCorrection);
    const machineReads = group.filter((row) => row.source !== HUMAN_CORRECTION_SOURCE);

    // Best machine read: highest confidence, and among equals the newest.
    const bestMachineRead = [...machineReads].sort((a, b) => {
      const aScore = a.confidence ?? -1;
      const bScore = b.confidence ?? -1;
      if (aScore !== bScore) return bScore - aScore;
      return toIso(b.createdAt).localeCompare(toIso(a.createdAt));
    })[0];

    // Oldest machine read is what the extractor first said.
    const firstMachineRead = [...machineReads].sort((a, b) =>
      toIso(a.createdAt).localeCompare(toIso(b.createdAt))
    )[0];

    const current = corrections[0] ?? history[0];
    const corrected = corrections.length > 0;

    // Provenance follows the machine read; a correction inherits where the value
    // was found rather than claiming a location a reviewer never pointed at.
    const provenance = bestMachineRead ?? group[0];

    // Without a docType, there's no schema to say whether this field even
    // applies here -- fall back to OPTIONAL (a neutral expectation) rather
    // than NOT_EXPECTED, so confidence-based review still fires the way it
    // always has for callers that don't pass one.
    const verification = evaluateFieldVerification({
      corrected,
      confidence: bestMachineRead?.confidence ?? null,
      expectation: docType ? getFieldExpectation(docType, fieldName) : "OPTIONAL",
      hasMachineRead: machineReads.length > 0,
      hasConflict: conflictedCanonicalKeys?.has(resolved?.canonicalKey ?? groupKey) ?? false,
    });

    fields.push({
      fieldName,
      currentValue: current.value,
      originalValue: firstMachineRead?.value ?? null,
      confidence: bestMachineRead?.confidence ?? null,
      pageNumber: provenance?.pageNumber ?? null,
      bbox: parseBoundingBox(provenance?.bbox ?? null),
      corrected,
      needsReview: verification.state === "NEEDS_REVIEW" || verification.state === "MISSING_REQUIRED" || verification.state === "CONFLICT",
      verification: verification.state,
      reasonCode: verification.reasonCode,
      history,
    });
  }

  // Required fields the pipeline never wrote a row for at all are otherwise
  // silently absent from this list — indistinguishable from a field that
  // simply doesn't apply to this document type. Synthesize a placeholder so
  // "genuinely missing" is visible and flagged.
  if (docType) {
    for (const schemaField of getRequiredFields(docType)) {
      if (presentSchemaNames.has(schemaField.fieldName)) continue;
      fields.push({
        fieldName: schemaField.fieldName,
        currentValue: "",
        originalValue: null,
        confidence: null,
        pageNumber: null,
        bbox: null,
        corrected: false,
        needsReview: true,
        verification: "MISSING_REQUIRED",
        reasonCode: "MISSING_ON_SOURCE_DOCUMENT",
        history: [],
      });
    }
  }

  return fields.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
}

/**
 * Priority order for review: a field a reviewer must act on before this
 * document can be trusted comes first, fields that are already settled come
 * last. Ties within a bucket keep buildReviewFields's own alphabetical order.
 */
const REVIEW_PRIORITY: Record<FieldVerificationState, number> = {
  MISSING_REQUIRED: 0,
  CONFLICT: 1,
  NEEDS_REVIEW: 2,
  AUTO_VERIFIED: 3,
  HUMAN_CONFIRMED: 3,
  HUMAN_CORRECTED: 3,
  REJECTED: 4,
  NOT_APPLICABLE: 5,
};

/** Stable sort: highest-priority verification state first, alphabetical within a state. */
export function sortByReviewPriority(fields: ReviewField[]): ReviewField[] {
  return [...fields].sort((a, b) => {
    const priorityDiff = REVIEW_PRIORITY[a.verification] - REVIEW_PRIORITY[b.verification];
    if (priorityDiff !== 0) return priorityDiff;
    return a.fieldName.localeCompare(b.fieldName);
  });
}

/** Count of fields in each verification state, for a panel-header rollup. */
export function summarizeVerification(fields: ReviewField[]): Record<FieldVerificationState, number> {
  const counts = Object.fromEntries(FIELD_VERIFICATION_STATES.map((state) => [state, 0])) as Record<
    FieldVerificationState,
    number
  >;
  for (const field of fields) {
    counts[field.verification] += 1;
  }
  return counts;
}

/**
 * Whether this document is done: no field still needs a reviewer's attention
 * (missing, conflicting, or low-confidence) and no cross-document conflict
 * referencing it is still open. Reconciliation state is passed in rather than
 * queried here, keeping this module database-free.
 */
export function isDocumentFullyReviewed(fields: ReviewField[], hasOpenReconciliationIssues: boolean): boolean {
  if (hasOpenReconciliationIssues) return false;
  const counts = summarizeVerification(fields);
  return counts.MISSING_REQUIRED === 0 && counts.CONFLICT === 0 && counts.NEEDS_REVIEW === 0;
}

/** Pages that actually carry a located field, so navigation cannot offer empty pages. */
export function pagesWithFields(fields: ReviewField[]): number[] {
  const pages = new Set<number>();
  for (const field of fields) {
    if (field.pageNumber !== null) pages.add(field.pageNumber);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Index of the next field needing review, wrapping around. Returns -1 when none
 * do, so the caller can say "nothing left to review" rather than moving focus.
 */
export function nextReviewIndex(fields: ReviewField[], from: number): number {
  if (fields.length === 0) return -1;
  for (let step = 1; step <= fields.length; step += 1) {
    const index = (from + step + fields.length * 2) % fields.length;
    if (fields[index].needsReview) return index;
  }
  return -1;
}

export interface CorrectionValidation {
  ok: boolean;
  reason?: string;
  value?: string;
}

export const CORRECTION_MAX_LENGTH = 2000;

/** A correction that matches the current reading is not a correction. */
export function validateCorrection(
  raw: unknown,
  currentValue: string
): CorrectionValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "A corrected value must be text." };
  }
  const value = raw.trim();
  if (value === "") {
    return { ok: false, reason: "A corrected value cannot be empty." };
  }
  if (value.length > CORRECTION_MAX_LENGTH) {
    return {
      ok: false,
      reason: `A corrected value cannot exceed ${CORRECTION_MAX_LENGTH} characters.`,
    };
  }
  if (value === currentValue) {
    return { ok: false, reason: "The value is unchanged." };
  }
  return { ok: true, value };
}

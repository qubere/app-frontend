/**
 * Field verification state and review-trigger reason codes.
 *
 * `ReviewField.needsReview` (extractionReview.ts) only says whether a
 * reviewer should look at a field, not why. This adds the "why": a
 * verification outcome plus a stable reason code, computed by
 * `evaluateFieldVerification` in extractionReview.ts.
 *
 * HUMAN_CONFIRMED / HUMAN_CORRECTED / REJECTED distinguish the three ways a
 * human can act on a field from AUTO_VERIFIED (never touched by a person):
 * confirmed as-is, edited to a new value, or explicitly rejected as wrong.
 * A caller with no way to tell "confirmed" from "corrected" apart (no action
 * history) may still just emit AUTO_VERIFIED/NEEDS_REVIEW as before -- these
 * are additive, not a forced migration.
 *
 * This is a sibling of rejectionReasons.ts, not an extension of it —
 * rejection reasons record why a human rejected a decision; these record why
 * the system itself flagged a field. `CROSS_DOCUMENT_CONFLICT` and
 * `UNREADABLE_FIELD` deliberately echo fieldStateGenerator.ts's
 * FIELD_CONFLICT/UNREADABLE_FIELD naming rather than inventing synonyms.
 *
 * Plain data plus pure functions — no imports — safe in client and server code.
 */

export const FIELD_VERIFICATION_STATES = [
  "AUTO_VERIFIED",
  "HUMAN_CONFIRMED",
  "HUMAN_CORRECTED",
  "NEEDS_REVIEW",
  "CONFLICT",
  "MISSING_REQUIRED",
  "REJECTED",
  "NOT_APPLICABLE",
] as const;

export type FieldVerificationState = (typeof FIELD_VERIFICATION_STATES)[number];

export interface ReviewReason {
  /** Stable code stored alongside a ReviewField. Never rename. */
  code: string;
  label: string;
  hint?: string;
}

export const REVIEW_REASONS: readonly ReviewReason[] = [
  {
    code: "LOW_CONFIDENCE",
    label: "Low extraction confidence",
    hint: "The model's read confidence fell below the review threshold.",
  },
  {
    code: "MISSING_ON_SOURCE_DOCUMENT",
    label: "Not found on document",
    hint: "This field is required for this document type but wasn't located.",
  },
  {
    code: "CROSS_DOCUMENT_CONFLICT",
    label: "Conflicts with another document",
    hint: "This value disagrees with the same field on another shipment document.",
  },
  {
    code: "UNREADABLE_FIELD",
    label: "Field unreadable",
    hint: "The document image or text was too degraded to extract this field.",
  },
  {
    code: "NORMALIZATION_FAILED",
    label: "Could not normalize value",
    hint: "The extracted value couldn't be converted to a comparable unit or format.",
  },
] as const;

const BY_CODE = new Map(REVIEW_REASONS.map((r) => [r.code, r]));

export function getReviewReason(code: string): ReviewReason | null {
  return BY_CODE.get(code) ?? null;
}

export function isValidReviewReasonCode(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

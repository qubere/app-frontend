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
 * the system itself flagged a field. `CROSS_DOCUMENT_CONFLICT` deliberately
 * echoes fieldStateGenerator.ts's FIELD_CONFLICT naming rather than inventing
 * a synonym.
 *
 * This list intentionally excludes UNREADABLE_FIELD and NORMALIZATION_FAILED:
 * nothing upstream of evaluateFieldVerification (extractionReview.ts) can
 * currently tell "unreadable" or "failed to normalize" apart from a plain low
 * confidence score -- ExtractionField has no per-row legibility flag, and
 * there is no normalization step in this pipeline to fail. A hydration-module
 * pipeline (fieldStateGenerator.ts, fieldReviewService.ts) does have a real
 * per-candidate isUnreadable/reasonCodes signal, but it is a separate data
 * model (HydrationCandidate, not ExtractionField) feeding a separate review
 * surface -- add a matching reason code here only once this pipeline gains an
 * equivalent real signal, not preemptively.
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
] as const;

const BY_CODE = new Map(REVIEW_REASONS.map((r) => [r.code, r]));

export function getReviewReason(code: string): ReviewReason | null {
  return BY_CODE.get(code) ?? null;
}

export function isValidReviewReasonCode(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

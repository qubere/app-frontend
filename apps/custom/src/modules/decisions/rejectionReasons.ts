/**
 * Decision rejection reason picklist — v1 (issue #202, 1.3.4).
 *
 * `humanNotes` on a REJECT is already mandatory. This adds a stable code beside
 * the free text: the code is analytics ("why are specialists rejecting HTS
 * proposals this quarter?"), the note is the story. Adding a code is
 * non-breaking; removing one needs a migration that rewrites stored values.
 *
 * Plain data — no imports — so it is safe in both client components and API
 * routes.
 */

export interface RejectionReason {
  /** Stable code stored to AgentDecision.rejectionReasonCode. Never rename. */
  code: string;
  /** Human-readable label shown in the reject dialog. */
  label: string;
  /** One-line hint shown under the label. */
  hint?: string;
}

export const REJECTION_REASONS: readonly RejectionReason[] = [
  {
    code: "WRONG_CLASSIFICATION",
    label: "Wrong HTS classification",
    hint: "The proposed tariff code does not fit this product.",
  },
  {
    code: "WRONG_VALUATION",
    label: "Wrong customs value",
    hint: "The declared or computed value is incorrect.",
  },
  {
    code: "WRONG_ORIGIN",
    label: "Wrong country of origin or preference",
    hint: "Origin or a trade-program claim is not supported.",
  },
  {
    code: "INSUFFICIENT_EVIDENCE",
    label: "Not enough evidence",
    hint: "More source documentation is needed before this can be accepted.",
  },
  {
    code: "CONTRADICTS_DOCUMENT",
    label: "Contradicts the source document",
    hint: "The proposal disagrees with the invoice, packing list, or BOL.",
  },
  {
    code: "CONTRADICTS_RULING",
    label: "Contradicts a CBP ruling or guidance",
    hint: "A binding ruling or established practice says otherwise.",
  },
  {
    code: "NEEDS_SPECIALIST",
    label: "Needs a licensed specialist",
    hint: "Route to a broker or subject-matter specialist for sign-off.",
  },
  {
    code: "DUPLICATE",
    label: "Duplicate decision",
    hint: "Another decision already covers this line item.",
  },
  {
    code: "STALE",
    label: "Superseded by newer data",
    hint: "The shipment data changed after this decision was produced.",
  },
  {
    code: "POLICY",
    label: "Against client or brokerage policy",
    hint: "A standing instruction or policy blocks this.",
  },
  {
    code: "OTHER",
    label: "Other — see note",
  },
] as const;

const BY_CODE = new Map(REJECTION_REASONS.map((r) => [r.code, r]));

export function getRejectionReason(code: string): RejectionReason | null {
  return BY_CODE.get(code) ?? null;
}

export function isValidRejectionReasonCode(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

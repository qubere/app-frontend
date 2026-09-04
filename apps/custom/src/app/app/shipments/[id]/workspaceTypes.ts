/**
 * Shapes shared across the shipment workspace panels.
 *
 * These panels used `any[]` for the same three shapes in five different files,
 * so a field renamed in one place produced no error in the others. Declaring
 * them once is type-level only: nothing here changes what the panels render.
 */

/**
 * A line item as the workspace panels receive it.
 *
 * `unitPrice` and `totalValue` are numbers, not Prisma `Decimal`s: the server
 * component converts them with `Number(...)` before passing them down, because a
 * Decimal cannot cross the server/client boundary.
 */
export interface ShipmentLineItemRow {
  id: string;
  lineNumber: number;
  partNumber?: string | null;
  description: string;
  quantity: number;
  /**
   * Null when the source never carried a price — extraction routinely recovers a
   * line's total without its unit price, and vice versa. Coercing either to 0
   * makes an unknown amount render as a real "0.00", so the absence survives to
   * the renderer and shows as missing instead.
   */
  unitPrice: number | null;
  totalValue: number | null;
  countryOfOrigin: string;
  htsCode: string;
  htsConfidence?: number | null;
  productId?: string | null;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * A line item as persisted inside a document's `extractedJson`.
 *
 * Historical rows carry either the current `totalAmount`/`sku` names or the older
 * `totalValue`/`partNumber` ones, so both are accepted and readers fall back
 * across them. Numbers may arrive as strings from the extractor, which is why
 * `numberOrNull` is applied at every use.
 */
export interface ExtractedLineItem {
  lineNumber?: number | null;
  sku?: string | null;
  partNumber?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  totalAmount?: number | string | null;
  totalValue?: number | string | null;
  countryOfOrigin?: string | null;
  htsCode?: string | null;
}

/**
 * Whether a document's parse pipeline produced a usable result.
 *
 * - `passed`  — a parse run completed (or the document already carries an
 *               extraction confidence), so the content is available.
 * - `failed`  — the most recent parse run ended in FAILED and nothing newer
 *               succeeded.
 * - `pending` — a run is queued/in-flight, or nothing has run yet.
 */
export type DocumentParseState = "passed" | "failed" | "pending";

interface ParseVersionLike {
  status?: string | null;
  version?: number | null;
  createdAt?: Date | string | null;
}

/**
 * Derives a single parse state from a document's parse-run history.
 *
 * `activeParseVersionId` is authoritative: it is set only after a run validates,
 * persists its artifacts and passes the quality gate, so its presence always
 * means `passed` regardless of a later retry's transient state. Otherwise the
 * newest run's status decides, and a document with no runs falls back to whether
 * an extraction confidence was ever recorded.
 */
export function deriveDocumentParseState(doc: {
  confidence?: number | null;
  activeParseVersionId?: string | null;
  parseVersions?: ParseVersionLike[] | null;
}): DocumentParseState {
  if (doc.activeParseVersionId) return "passed";

  const runs = doc.parseVersions ?? [];
  if (runs.length === 0) {
    return doc.confidence !== null && doc.confidence !== undefined ? "passed" : "pending";
  }

  const latest = [...runs].sort((a, b) => {
    const byVersion = (b.version ?? 0) - (a.version ?? 0);
    if (byVersion !== 0) return byVersion;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  })[0];

  const status = (latest.status ?? "").toUpperCase();
  if (status === "FAILED") return "failed";
  if (status === "SUCCEEDED" || status === "NEEDS_REVIEW") return "passed";
  return "pending";
}

/** Reads a numeric field that may be absent, keeping "missing" distinct from 0. */
export function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

/**
 * A line's extended amount, or null when no source carried one.
 *
 * Prefers the total the document stated over one multiplied out here — the two
 * disagree whenever the invoice discounts a line or prices per pack. Falls back
 * to quantity x unit price only when a unit price is genuinely present. A real 0
 * survives every branch, because a free-of-charge line is a fact, while an
 * unknown amount rendered as "0.00" is a false one.
 */
export function extendedAmount(item: {
  quantity: number;
  unitPrice: number | null;
  totalValue: number | null;
}): number | null {
  if (item.totalValue !== null && item.totalValue !== undefined) return item.totalValue;
  if (item.unitPrice === null || item.unitPrice === undefined) return null;
  return Number(item.quantity) * item.unitPrice;
}

/**
 * One autocomplete result from `/api/v1/hts/search`.
 *
 * Both the inline line-item editor and the exception resolution modal render the
 * same three fields from it.
 */
export interface HtsSuggestion {
  id: string;
  htsNumberDisplay: string;
  description: string;
}

/** An open `ExceptionItem` row, limited to the fields the drawer reads. */
export interface DbExceptionItem {
  id: string;
  version: number;
  status?: string | null;
  description: string;
  /**
   * Which agent raised it. The drawer trusts the real `category` column instead
   * of description keywords for Compliance Agent findings, whose wording can
   * coincidentally match another rule's phrase.
   */
  sourceAgent?: string | null;
  category?: string | null;
  severity?: string | null;
  /**
   * Set on per-document field exceptions (`MISSING_EXTRACTION:*`) — the document
   * the field was missing from, the snake_case field key, and the stable code.
   * When present, the exception resolves by correcting the value, not by waiving.
   */
  documentId?: string | null;
  fieldKey?: string | null;
  code?: string | null;
}

/**
 * A drawer card that maps to a real `ExceptionItem` row, so it carries the ids
 * the resolution modal needs to write back.
 */
export interface ResolvableException {
  id: string;
  dbId: string;
  version: number;
  category: string;
  title: string;
  desc: string;
  actionText: string;
  actionType: string;
  /** Present on per-document field exceptions — routes the modal to a "correct the value" input. */
  documentId?: string | null;
  fieldKey?: string | null;
  code?: string | null;
  /** Real ExceptionItem.category column, for filtering the waive reason picklist. */
  dbCategory?: string | null;
  /** Prefill for the correction input, when the value is already extracted but unconfirmed. */
  currentValue?: string | null;
  /** Cross-document conflict values, from the linked ReconciliationIssue. */
  conflict?: { field: string; expectedValue: string; actualValue: string; sources: string[] } | null;
}

/**
 * One card rendered in the exceptions drawer.
 *
 * `actionType` and `actionHref` are both optional because the two kinds of card
 * differ in exactly that way, and the render branches on it: a card with an
 * `actionType` opens a resolution flow, a card without one links out via
 * `actionHref`. `dbId`/`version` are absent on synthetic cards (a required
 * document that was never uploaded has no exception row to resolve), and are
 * left undefined rather than filled with a placeholder id.
 */
export interface ExceptionCard {
  id: string;
  category: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  actionText: string;
  actionType?: string;
  actionHref?: string;
  dbId?: string;
  version?: number;
  documentId?: string | null;
  fieldKey?: string | null;
  code?: string | null;
  dbCategory?: string | null;
  currentValue?: string | null;
  conflict?: { field: string; expectedValue: string; actualValue: string; sources: string[] } | null;
  /** Source document label, for grouping the flat list (finding #8). */
  groupLabel?: string;
}

/** True when a card carries the ids the resolution modal writes back with. */
export function isResolvableException(card: ExceptionCard): card is ExceptionCard & ResolvableException {
  return (
    typeof card.dbId === "string" &&
    typeof card.version === "number" &&
    typeof card.actionType === "string"
  );
}

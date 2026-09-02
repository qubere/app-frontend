/**
 * Deterministic, weighted, multi-identifier shipment matching for inbound
 * documents (emailed or API-ingested).
 *
 * v1 matched only `Shipment.shipmentNumber` and `Shipment.poReference` with an
 * exact lookup and a hardcoded confidence of 1.0. v2 keeps the "exact lookup,
 * never fuzzy" stance but:
 *
 *  - also resolves container / bill-of-lading / booking / air-waybill tokens
 *    against `ShipmentTrackingIdentifier` (the identifier side-table already
 *    populated by the tracking + leg-inference pipelines);
 *  - scores each candidate shipment by a weighted sum of the identifier types
 *    that resolved to it, with a bonus when multiple *independent* identifiers
 *    agree and a penalty for an invalid container check digit;
 *  - auto-attaches only above a threshold, and only when no rival shipment is
 *    even plausible -- otherwise the candidates are persisted for a human to
 *    pick from ("why didn't this match?" must always be answerable, and a match
 *    is never a silent guess).
 *
 * No AI/LLM call is used for matching itself: regex token extraction, then
 * exact normalized database lookups.
 */

import { db } from "@/lib/db";
import type { NormalizedParserResult } from "@/modules/documents/parser/contracts";
import {
  extractIdentifierCandidates,
  isValidContainerNumber,
  normalizeIdentifier,
  type MatchIdentifierType,
} from "@/modules/shipments/identifierExtraction";

export { extractIdentifierCandidates } from "@/modules/shipments/identifierExtraction";
export type { MatchIdentifierType } from "@/modules/shipments/identifierExtraction";

export const ALGORITHM_VERSION = "v2-weighted-multi-identifier";

/**
 * Flattens a completed parse's normalized result down to plain text for
 * identifier scanning. Kept out of documentProcessingWorker.ts deliberately:
 * that file is asserted (see tests/document-processing-integrity.test.ts) to
 * never reference the full rendered document content, only identifiers and
 * codes, to keep document contents out of its logs.
 */
export function plainTextFromParsedResult(normalized: NormalizedParserResult): string {
  return normalized.markdown ?? normalized.sections.map((s) => s.content).join("\n");
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Per-identifier-type base weight. Higher = stronger, less ambiguous signal. */
const IDENTIFIER_WEIGHTS: Record<MatchIdentifierType, number> = {
  SHIPMENT_NUMBER: 0.95,
  MBL: 0.9,
  MAWB: 0.88,
  HBL: 0.86,
  HAWB: 0.84,
  CONTAINER: 0.8,
  BOOKING: 0.78,
  PO_REFERENCE: 0.5,
};

/** A container token that resolved to a shipment but failed its check digit. */
const INVALID_CONTAINER_WEIGHT = 0.55;

/** +this per *additional* agreeing distinct identifier type, capped below. */
const AGREEMENT_BONUS = 0.15;
const MAX_AGREEMENT_STEPS = 3;

/** At or above this a single unrivalled candidate is auto-attached. */
export const AUTO_ATTACH_THRESHOLD = 0.85;
/** At or above this a candidate is surfaced as a suggestion for a human. */
export const SUGGEST_THRESHOLD = 0.5;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// ---------------------------------------------------------------------------
// Lookup port (injectable for tests)
// ---------------------------------------------------------------------------

export interface ResolvedShipmentRef {
  id: string;
}

export interface TrackingIdentifierHit {
  shipmentId: string;
  type: MatchIdentifierType;
  /** The normalized stored value that matched. */
  normalizedValue: string;
}

export interface ScoreBreakdown {
  score: number;
  base: number;
  agreementBonus: number;
  signals: Array<{
    type: MatchIdentifierType;
    value: string;
    source: MatchSource;
    weight: number;
    note?: string;
  }>;
}

export interface CandidateRecord {
  accountId: string;
  documentId: string;
  shipmentId: string;
  matchedIdentifierType: MatchIdentifierType;
  matchedValue: string;
  matchedSource: MatchSource;
  autoSelected: boolean;
  confidenceScore: number;
  algorithmVersion: string;
  matchMethod: string;
  scoreBreakdown: ScoreBreakdown;
}

export interface ShipmentIdentifierLookup {
  findByShipmentNumber(accountId: string, shipmentNumber: string): Promise<ResolvedShipmentRef | null>;
  /** Case/punctuation-insensitive over the account's shipments. */
  findByPoReference(accountId: string, normalizedPoReference: string): Promise<ResolvedShipmentRef[]>;
  /** Resolve any of the normalized tokens against ShipmentTrackingIdentifier. */
  findByTrackingIdentifiers(accountId: string, normalizedTokens: string[]): Promise<TrackingIdentifierHit[]>;
  /** Clear prior candidates for this document so a re-match is idempotent. */
  deleteCandidatesForDocument(documentId: string): Promise<void>;
  recordCandidate(record: CandidateRecord): Promise<void>;
}

/** DB TrackingIdentifierType -> our match type. Types we don't match on map to null. */
const TRACKING_TYPE_MAP: Record<string, MatchIdentifierType | null> = {
  MBL: "MBL",
  HBL: "HBL",
  BOOKING: "BOOKING",
  CONTAINER: "CONTAINER",
  MAWB: "MAWB",
  HAWB: "HAWB",
  PRO: null,
  TRACKING: null,
};

export const scopedShipmentIdentifierLookup = (clientId?: string | null): ShipmentIdentifierLookup => ({
  async findByShipmentNumber(accountId, shipmentNumber) {
    return db.shipment.findFirst({
      where: { accountId, shipmentNumber, deletedAt: null, ...(clientId !== undefined ? { clientId } : {}) },
      select: { id: true },
    });
  },

  async findByPoReference(accountId, normalizedPoReference) {
    const shipments = await db.shipment.findMany({
      where: { accountId, poReference: { not: null }, deletedAt: null, ...(clientId !== undefined ? { clientId } : {}) },
      select: { id: true, poReference: true },
    });
    return shipments
      .filter((s) => s.poReference !== null && normalizeIdentifier(s.poReference) === normalizedPoReference)
      .map((s) => ({ id: s.id }));
  },

  async findByTrackingIdentifiers(accountId, normalizedTokens) {
    if (normalizedTokens.length === 0) return [];
    const wanted = new Set(normalizedTokens);
    const rows = await db.shipmentTrackingIdentifier.findMany({
      where: { accountId, shipment: { accountId, deletedAt: null, ...(clientId !== undefined ? { clientId } : {}) } },
      select: { shipmentId: true, type: true, value: true },
    });
    const hits: TrackingIdentifierHit[] = [];
    for (const row of rows) {
      const mapped = TRACKING_TYPE_MAP[row.type];
      if (!mapped) continue;
      const normalized = normalizeIdentifier(row.value);
      if (wanted.has(normalized)) {
        hits.push({ shipmentId: row.shipmentId, type: mapped, normalizedValue: normalized });
      }
    }
    return hits;
  },

  async deleteCandidatesForDocument(documentId) {
    await db.documentShipmentCandidate.deleteMany({ where: { documentId } });
  },

  async recordCandidate(record) {
    await db.documentShipmentCandidate.create({
      data: {
        accountId: record.accountId,
        documentId: record.documentId,
        shipmentId: record.shipmentId,
        matchedIdentifierType: record.matchedIdentifierType,
        matchedValue: record.matchedValue,
        matchedSource: record.matchedSource,
        autoSelected: record.autoSelected,
        confidenceScore: record.confidenceScore,
        algorithmVersion: record.algorithmVersion,
        matchMethod: record.matchMethod,
        scoreBreakdown: record.scoreBreakdown as unknown as object,
      },
    });
  },
});
export const databaseShipmentIdentifierLookup = scopedShipmentIdentifierLookup();

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchSource = "EMAIL_SUBJECT" | "PARSED_DOCUMENT_TEXT";

export interface MatchShipmentInput {
  accountId: string;
  documentId: string;
  clientId?: string | null;
  autoAttachThreshold?: number;
  requireReview?: boolean;
  emailSubject: string | null;
  parsedText: string | null;
}

interface Signal {
  shipmentId: string;
  type: MatchIdentifierType;
  value: string;
  source: MatchSource;
  weight: number;
  note?: string;
}

export interface ScoredCandidate {
  shipmentId: string;
  score: number;
  matchMethod: string;
  breakdown: ScoreBreakdown;
  best: Signal;
}

function sources(input: MatchShipmentInput): Array<[string, MatchSource]> {
  const out: Array<[string, MatchSource]> = [];
  if (input.emailSubject) out.push([input.emailSubject, "EMAIL_SUBJECT"]);
  if (input.parsedText) out.push([input.parsedText, "PARSED_DOCUMENT_TEXT"]);
  return out;
}

async function collectSignals(
  input: MatchShipmentInput,
  lookup: ShipmentIdentifierLookup
): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const [text, source] of sources(input)) {
    const cands = extractIdentifierCandidates(text);

    for (const value of cands.shipmentNumbers) {
      const hit = await lookup.findByShipmentNumber(input.accountId, value);
      if (hit) {
        signals.push({
          shipmentId: hit.id,
          type: "SHIPMENT_NUMBER",
          value,
          source,
          weight: IDENTIFIER_WEIGHTS.SHIPMENT_NUMBER,
        });
      }
    }

    for (const value of cands.poReferences) {
      const hits = await lookup.findByPoReference(input.accountId, value);
      for (const hit of hits) {
        signals.push({
          shipmentId: hit.id,
          type: "PO_REFERENCE",
          value,
          source,
          weight: IDENTIFIER_WEIGHTS.PO_REFERENCE,
        });
      }
    }

    // Container / BL / booking / AWB tokens all resolve through the tracking
    // identifier table; one query per source covers every type.
    const trackingTokens = [
      ...cands.containers,
      ...cands.billsOfLading.map(normalizeIdentifier),
      ...cands.airWaybills.map(normalizeIdentifier),
    ];
    const hits = await lookup.findByTrackingIdentifiers(input.accountId, trackingTokens);
    for (const hit of hits) {
      const invalidContainer = hit.type === "CONTAINER" && !isValidContainerNumber(hit.normalizedValue);
      signals.push({
        shipmentId: hit.shipmentId,
        type: hit.type,
        value: hit.normalizedValue,
        source,
        weight: invalidContainer ? INVALID_CONTAINER_WEIGHT : IDENTIFIER_WEIGHTS[hit.type],
        note: invalidContainer ? "container check digit invalid" : undefined,
      });
    }
  }

  return signals;
}

function scoreShipment(shipmentId: string, signals: Signal[]): ScoredCandidate {
  const mine = signals.filter((s) => s.shipmentId === shipmentId);
  const distinctTypes = new Set(mine.map((s) => s.type));
  const base = Math.max(...mine.map((s) => s.weight));
  const agreementSteps = Math.min(distinctTypes.size - 1, MAX_AGREEMENT_STEPS);
  const agreementBonus = AGREEMENT_BONUS * agreementSteps;
  const score = clamp01(base + agreementBonus);

  // The signal that set the base weight is the "headline" identifier.
  const best = mine.reduce((a, b) => (b.weight > a.weight ? b : a));

  const matchMethod =
    distinctTypes.size > 1
      ? "MULTI_SIGNAL"
      : best.type === "SHIPMENT_NUMBER"
        ? "EXACT_SHIPMENT_NUMBER"
        : best.type === "PO_REFERENCE"
          ? "EXACT_PO"
          : "EXACT_TRACKING_IDENTIFIER";

  return {
    shipmentId,
    score,
    matchMethod,
    best,
    breakdown: {
      score,
      base,
      agreementBonus,
      signals: mine.map((s) => ({
        type: s.type,
        value: s.value,
        source: s.source,
        weight: s.weight,
        note: s.note,
      })),
    },
  };
}

/**
 * Attempts to match a document to exactly one shipment.
 *
 * Auto-attaches only when the top candidate scores at/above
 * `AUTO_ATTACH_THRESHOLD` *and* no other candidate is even plausible
 * (>= `SUGGEST_THRESHOLD`). Every candidate that resolved to a real shipment is
 * persisted regardless, so a human can review the ranking. Never "pick the
 * first one."
 */
export async function matchShipmentForDocument(
  input: MatchShipmentInput,
  lookup: ShipmentIdentifierLookup = scopedShipmentIdentifierLookup(input.clientId)
): Promise<{ matchedShipmentId: string | null; candidates: ScoredCandidate[] }> {
  const signals = await collectSignals(input, lookup);
  if (signals.length === 0) {
    await lookup.deleteCandidatesForDocument(input.documentId);
    return { matchedShipmentId: null, candidates: [] };
  }

  const shipmentIds = Array.from(new Set(signals.map((s) => s.shipmentId)));
  const scored = shipmentIds
    .map((id) => scoreShipment(id, signals))
    .sort((a, b) => b.score - a.score);

  const [top, second] = scored;
  const rivalPlausible = second !== undefined && second.score >= SUGGEST_THRESHOLD;
  const matchedShipmentId =
    !input.requireReview && top.score >= (input.autoAttachThreshold ?? AUTO_ATTACH_THRESHOLD) && !rivalPlausible ? top.shipmentId : null;

  await lookup.deleteCandidatesForDocument(input.documentId);
  for (const cand of scored) {
    await lookup.recordCandidate({
      accountId: input.accountId,
      documentId: input.documentId,
      shipmentId: cand.shipmentId,
      matchedIdentifierType: cand.best.type,
      matchedValue: cand.best.value,
      matchedSource: cand.best.source,
      autoSelected: matchedShipmentId === cand.shipmentId,
      confidenceScore: cand.score,
      algorithmVersion: ALGORITHM_VERSION,
      matchMethod: cand.matchMethod,
      scoreBreakdown: cand.breakdown,
    });
  }

  return { matchedShipmentId, candidates: scored };
}

/**
 * True when the matcher found no confident single shipment but two or more are
 * plausible -- i.e. a human needs to pick. Distinct from "no match at all"
 * (zero candidates) and from a clean auto-attach.
 */
export function isMatchConflict(result: {
  matchedShipmentId: string | null;
  candidates: ScoredCandidate[];
}): boolean {
  return (
    result.matchedShipmentId === null &&
    result.candidates.filter((c) => c.score >= SUGGEST_THRESHOLD).length >= 2
  );
}

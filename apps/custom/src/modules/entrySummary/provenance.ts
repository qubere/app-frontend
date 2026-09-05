/**
 * Field-level provenance for the CBP Form 7501 Entry Summary draft (U1).
 *
 * Every value that lands on the draft must be traceable to exactly one of:
 * a source document + page, a human edit, an approved agent decision, a
 * master-data record, a computation, the filer's own profile, or — when none
 * of those apply — explicitly MISSING. Nothing is ever defaulted quietly.
 *
 * C2 (no invented values): a field whose source is "MISSING" must carry
 * value: null. This is enforced both at the type level (callers should use
 * `missing()` rather than construct the object by hand) and at runtime via
 * `assertProvenanceInvariant` / the zod schema in model.ts.
 */

import type { Block } from "./model";

export type ProvenanceSource =
  | "DOCUMENT"
  | "USER"
  | "AGENT"
  | "MASTER_DATA"
  | "COMPUTED"
  | "FILER_PROFILE"
  | "MISSING";

export interface FieldProvenance {
  source: ProvenanceSource;
  documentId?: string;
  documentPage?: number;
  factId?: string;
  agentDecisionId?: string;
  fieldApprovalId?: string;
  masterRecord?: { model: string; id: string };
  computedFrom?: string[];
  confidence?: number;
  /** ISO-8601 timestamp. Always injected — never `new Date()` inside this module. */
  asOf: string;
}

export interface EntrySummaryField<T> {
  blockId: Block;
  value: T | null;
  provenance: FieldProvenance;
}

export class InvalidProvenanceError extends Error {
  constructor(blockId: Block) {
    super(`Block ${blockId} is sourced MISSING but carries a non-null value. A MISSING field must have value: null.`);
    this.name = "InvalidProvenanceError";
  }
}

/** Throws if a MISSING-sourced field carries a non-null value (C2 invariant). */
export function assertProvenanceInvariant<T>(field: EntrySummaryField<T>): void {
  if (field.provenance.source === "MISSING" && field.value !== null) {
    throw new InvalidProvenanceError(field.blockId);
  }
}

/**
 * Builds a MISSING field. `reason` is not persisted on the field itself (there
 * is no schema slot for it) but is accepted so call sites can document *why*
 * a block came up empty without that reasoning being lost at the call site;
 * callers that need the reason surfaced (e.g. in a UI) should log/report it
 * themselves.
 */
export function missing<T>(blockId: Block, reason: string, clock: () => Date = () => new Date()): EntrySummaryField<T> {
  void reason;
  return {
    blockId,
    value: null,
    provenance: { source: "MISSING", asOf: clock().toISOString() },
  };
}

/** Minimal shape of a Fact row (or a Fact-like projection) needed for provenance. */
export interface FactLike {
  id: string;
  documentId?: string | null;
  documentPage?: number | null;
  confidence?: number | null;
  createdAt: Date | string;
}

/** Builds a DOCUMENT-sourced field from a Fact-like row. */
export function fromFact<T>(
  fact: FactLike,
  blockId: Block,
  value: T,
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "DOCUMENT",
      documentId: fact.documentId ?? undefined,
      documentPage: fact.documentPage ?? undefined,
      factId: fact.id,
      confidence: fact.confidence ?? undefined,
      asOf: clock().toISOString(),
    },
  };
}

export function fromUser<T>(
  blockId: Block,
  value: T,
  opts: { fieldApprovalId?: string; asOf?: string } = {},
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "USER",
      fieldApprovalId: opts.fieldApprovalId,
      asOf: opts.asOf ?? clock().toISOString(),
    },
  };
}

export function fromAgent<T>(
  blockId: Block,
  value: T,
  agentDecisionId: string,
  opts: { confidence?: number } = {},
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "AGENT",
      agentDecisionId,
      confidence: opts.confidence,
      asOf: clock().toISOString(),
    },
  };
}

export function fromMasterData<T>(
  blockId: Block,
  value: T,
  masterRecord: { model: string; id: string },
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "MASTER_DATA",
      masterRecord,
      asOf: clock().toISOString(),
    },
  };
}

export function computed<T>(
  blockId: Block,
  value: T,
  computedFrom: string[],
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "COMPUTED",
      computedFrom,
      asOf: clock().toISOString(),
    },
  };
}

export function fromFilerProfile<T>(
  blockId: Block,
  value: T,
  filerProfileId: string,
  clock: () => Date = () => new Date()
): EntrySummaryField<T> {
  return {
    blockId,
    value,
    provenance: {
      source: "FILER_PROFILE",
      masterRecord: { model: "FilerProfile", id: filerProfileId },
      asOf: clock().toISOString(),
    },
  };
}

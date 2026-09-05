/**
 * Draft persistence and versioning (U7).
 *
 * C6: every query below filters on accountId. Regenerating with an unchanged
 * input is idempotent (same inputHash returns the existing version, no new
 * row). An approved version is immutable — any further write throws
 * DraftLocked; approving a version that is not exportable throws
 * DraftNotExportable and writes nothing.
 */

import { createHash } from "crypto";
import type { EntrySummaryDraft } from "./model";
import type { ValidationResult } from "./validation/engine";

/**
 * Minimal database surface this service needs, decoupled from Prisma's own
 * (multi-overload) `$transaction` typings so callers can pass either the real
 * `db` client (which structurally satisfies this) or a plain test mock (as
 * used in tests/entry-summary-draft-service.test.ts) without fighting
 * generated-client type gymnastics.
 */
export interface DraftDbClient {
  entrySummaryDraft: {
    findFirst(args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }): Promise<EntrySummaryDraftRow | null>;
    create(args: { data: Record<string, unknown> }): Promise<EntrySummaryDraftRow>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<EntrySummaryDraftRow>;
  };
  $transaction<T>(fn: (tx: DraftDbClient) => Promise<T>): Promise<T>;
}

export class DraftNotExportable extends Error {
  constructor(readonly shipmentId: string, readonly version: number, readonly blockingCount: number) {
    super(`EntrySummaryDraft v${version} for shipment ${shipmentId} is not exportable (${blockingCount} blocking finding(s)).`);
    this.name = "DraftNotExportable";
  }
}

export class DraftLocked extends Error {
  constructor(readonly shipmentId: string, readonly version: number) {
    super(`EntrySummaryDraft v${version} for shipment ${shipmentId} is approved and immutable.`);
    this.name = "DraftLocked";
  }
}

export interface EntrySummaryDraftRow {
  id: string;
  accountId: string;
  shipmentId: string;
  filingId: string | null;
  version: number;
  draftData: unknown;
  validationData: unknown;
  isExportable: boolean;
  blockingCount: number;
  warningCount: number;
  generatedBy: string;
  supersededAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  inputHash: string;
  createdAt: Date;
}

/** Deterministic (key-order independent) JSON stringify, for stable hashing. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableStringify);
  if (value != null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortForStableStringify((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function computeInputHash(normalizedInput: unknown): string {
  return createHash("sha256").update(stableStringify(normalizedInput)).digest("hex");
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return typeof err === "object" && err != null && "code" in err && (err as { code?: unknown }).code === "P2002";
}

export interface GenerateDraftInput {
  accountId: string;
  shipmentId: string;
  filingId?: string | null;
  normalizedInput: unknown;
  draft: EntrySummaryDraft;
  validation: ValidationResult;
  generatedBy: string;
  /**
   * U11 hook: called with the prior version's row id right after a genuine
   * new version is committed (never on the idempotent no-op return path).
   * Wired by callers to `export.service.ts`'s `supersedeExportsForDraft` so
   * regenerating a draft marks that prior version's FilerExport rows
   * Superseded. Best-effort, called AFTER the transaction commits (not
   * inside it) — DraftDbClient's minimal surface deliberately does not know
   * about the FilerExport table, so this can't be folded into the same `tx`
   * without widening that interface; a failure here does not roll back the
   * new draft version, same "notification is a nicety" pattern as
   * notify.ts.
   */
  onSuperseded?: (priorDraftId: string) => Promise<void>;
}


/**
 * Regenerates the draft for a shipment. Idempotent: if the newly-computed
 * inputHash matches the latest version's hash, that version is returned with
 * no write. Otherwise a new version is created and the prior one's
 * supersededAt is stamped, both inside one transaction. Safe under
 * concurrency via a unique-constraint retry on [shipmentId, version] rather
 * than a read-then-write race.
 */
export async function generateDraft(db: DraftDbClient, input: GenerateDraftInput): Promise<EntrySummaryDraftRow> {
  const inputHash = computeInputHash(input.normalizedInput);

  const latest = await latestVersion(db, input.accountId, input.shipmentId);
  if (latest && latest.inputHash === inputHash && latest.supersededAt == null) {
    return latest;
  }

  const maxAttempts = 5;
  let nextVersion = (latest?.version ?? 0) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const created = await db.$transaction(async (tx: DraftDbClient) => {
        if (latest) {
          await tx.entrySummaryDraft.update({
            where: { id: latest.id },
            data: { supersededAt: new Date() },
          });
        }
        return (await tx.entrySummaryDraft.create({
          data: {
            accountId: input.accountId,
            shipmentId: input.shipmentId,
            filingId: input.filingId ?? null,
            version: nextVersion,
            draftData: input.draft as unknown as object,
            validationData: input.validation as unknown as object,
            isExportable: input.validation.isExportable,
            blockingCount: input.validation.blockingCount,
            warningCount: input.validation.warningCount,
            generatedBy: input.generatedBy,
            inputHash,
          },
        })) as EntrySummaryDraftRow;
      });
      if (latest && input.onSuperseded) {
        await input.onSuperseded(latest.id);
      }
      return created;
    } catch (err) {
      if (isUniqueConstraintViolation(err) && attempt < maxAttempts - 1) {
        nextVersion += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`generateDraft: exhausted ${maxAttempts} version-collision retries for shipment ${input.shipmentId}.`);
}

export async function latestVersion(db: DraftDbClient, accountId: string, shipmentId: string): Promise<EntrySummaryDraftRow | null> {
  const row = await db.entrySummaryDraft.findFirst({
    where: { accountId, shipmentId },
    orderBy: { version: "desc" },
  });
  return (row as EntrySummaryDraftRow | null) ?? null;
}

/** Cross-account-safe: never returns another account's row. */
export async function getDraft(db: DraftDbClient, accountId: string, shipmentId: string, version: number): Promise<EntrySummaryDraftRow | null> {
  const row = await db.entrySummaryDraft.findFirst({ where: { accountId, shipmentId, version } });
  return (row as EntrySummaryDraftRow | null) ?? null;
}

export interface ApproveDraftInput {
  accountId: string;
  shipmentId: string;
  version: number;
  approvedBy: string;
}

export async function approveDraft(db: DraftDbClient, input: ApproveDraftInput): Promise<EntrySummaryDraftRow> {
  const row = await getDraft(db, input.accountId, input.shipmentId, input.version);
  if (!row) throw new Error(`EntrySummaryDraft v${input.version} for shipment ${input.shipmentId} not found.`);
  if (row.approvedAt != null) throw new DraftLocked(input.shipmentId, input.version);
  if (!row.isExportable) throw new DraftNotExportable(input.shipmentId, input.version, row.blockingCount);

  return (await db.entrySummaryDraft.update({
    where: { id: row.id },
    data: { approvedAt: new Date(), approvedBy: input.approvedBy },
  })) as EntrySummaryDraftRow;
}

export interface UpdateDraftDataInput {
  accountId: string;
  shipmentId: string;
  version: number;
  draftData: EntrySummaryDraft;
}

/** Any write to an approved version other than approving itself is refused. */
export async function updateDraftData(db: DraftDbClient, input: UpdateDraftDataInput): Promise<EntrySummaryDraftRow> {
  const row = await getDraft(db, input.accountId, input.shipmentId, input.version);
  if (!row) throw new Error(`EntrySummaryDraft v${input.version} for shipment ${input.shipmentId} not found.`);
  if (row.approvedAt != null) throw new DraftLocked(input.shipmentId, input.version);

  return (await db.entrySummaryDraft.update({
    where: { id: row.id },
    data: { draftData: input.draftData as unknown as object },
  })) as EntrySummaryDraftRow;
}

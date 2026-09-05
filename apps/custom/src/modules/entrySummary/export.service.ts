/**
 * Export dispatch and idempotency (U11).
 *
 * Turns an approved, exportable EntrySummaryDraft into bytes (via the U8/U9/
 * U10 serializers), persists those exact bytes to durable storage, and hands
 * them to a filer-configured transport — all recorded on a `FilerExport` row
 * that is idempotent per (accountId, draftId, filerProfileId, format).
 *
 * Like draft.service.ts's `DraftDbClient`, this module talks to a minimal,
 * structurally-typed `ExportDbClient` rather than the generated Prisma
 * client directly, so a plain test mock satisfies it without fighting
 * generated-client typings (the FilerExport model does not exist in the
 * generated client in this sandbox — no live DB to run `prisma generate`
 * against after the schema change; see the Phase A precedent in
 * draft.service.ts/filerProfile.ts for the same reasoning).
 */

import { createHash } from "crypto";
import { storeGeneratedFile } from "@/lib/storage";
import { notify } from "../notifications/notify";
import type { EntrySummaryDraft } from "./model";
import type { EntrySummaryDraftRow } from "./draft.service";
import { DraftNotExportable } from "./draft.service";
import type { FilerProfileRecord } from "./filerProfile";
import type { ValidationResult } from "./validation/engine";
import { serializeCsv } from "./serializers/csv";
import { serializeCatair } from "./serializers/catair";
import { serializeJson } from "./serializers/json";

export const FILER_EXPORT_FORMATS = ["CSV", "CATAIR_AE", "JSON_API"] as const;
export type FilerExportFormat = (typeof FILER_EXPORT_FORMATS)[number];

export const FILER_EXPORT_STATUSES = ["Pending", "Delivered", "Failed", "Superseded"] as const;
export type FilerExportStatus = (typeof FILER_EXPORT_STATUSES)[number];

export class DraftNotApproved extends Error {
  constructor(readonly shipmentId: string, readonly version: number) {
    super(`EntrySummaryDraft v${version} for shipment ${shipmentId} has not been approved and cannot be exported.`);
    this.name = "DraftNotApproved";
  }
}

export class UnknownExportFormatError extends Error {
  constructor(readonly format: string) {
    super(`Unknown export format "${format}".`);
    this.name = "UnknownExportFormatError";
  }
}

export interface FilerExportRow {
  id: string;
  accountId: string;
  draftId: string;
  filerProfileId: string;
  format: string;
  transport: string;
  status: FilerExportStatus;
  idempotencyKey: string;
  payloadHash: string;
  payloadSize: number;
  storageUrl: string | null;
  attemptCount: number;
  lastError: string | null;
  requestedBy: string;
  deliveredAt: Date | null;
  createdAt: Date;
}

/** Minimal DB surface this service needs — see module doc for why it's not the generated Prisma client. */
export interface ExportDbClient {
  filerExport: {
    findFirst(args: { where: Record<string, unknown> }): Promise<FilerExportRow | null>;
    /**
     * Used only by `listExportsForShipment` (U13 — the review UI's export
     * history list). Filters via a nested `draft: { shipmentId }` clause,
     * which the real Prisma client supports natively; a test mock that never
     * exercises this path does not need to implement nested-relation
     * filtering.
     */
    findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }): Promise<FilerExportRow[]>;
    create(args: { data: Record<string, unknown> }): Promise<FilerExportRow>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<FilerExportRow>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return typeof err === "object" && err != null && "code" in err && (err as { code?: unknown }).code === "P2002";
}

export function computeIdempotencyKey(draftId: string, filerProfileId: string, format: string): string {
  return createHash("sha256").update(`${draftId}:${filerProfileId}:${format}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

export type TransportDeliverResult = { ok: true } | { ok: false; error: string };

export interface FilerTransport {
  kind: "DOWNLOAD" | "SFTP" | "HTTPS_WEBHOOK";
  deliver(bytes: Buffer, config: unknown): Promise<TransportDeliverResult>;
}

/**
 * DOWNLOAD has no network call: `requestExport` leaves the row Pending and
 * returns immediately. This transport object exists only so callers can
 * still pass a uniform `FilerTransport` value; its `deliver` is never
 * invoked by `requestExport`.
 */
export const downloadTransport: FilerTransport = {
  kind: "DOWNLOAD",
  async deliver() {
    return { ok: false, error: "DOWNLOAD transport has no deliver(); call markDownloadDelivered() instead." };
  },
};

export interface HttpsWebhookConfig {
  url: string;
  /** Points at a vault entry — never a plain secret (see filerProfile.ts's assertNoInlineSecrets). */
  secretRef?: string;
}

/**
 * GAP (documented, not implemented): FilerProfile.transportConfig may carry
 * a `secretRef` per filerProfile.ts's own convention (a pointer, never the
 * secret itself), but no real secret-store integration exists yet anywhere
 * in this codebase for entrySummary exports. This throws rather than
 * fabricating a value. Wiring a real vault lookup is Phase C+ scope.
 */
export async function resolveSecretRef(ref: string): Promise<string> {
  throw new Error(`resolveSecretRef("${ref}") is not implemented — no secret-store integration exists yet (Phase C+ gap).`);
}

/** Real HTTPS_WEBHOOK transport: POSTs the exact bytes as the request body — never in a URL or query string. */
export function createHttpsWebhookTransport(): FilerTransport {
  return {
    kind: "HTTPS_WEBHOOK",
    async deliver(bytes, config) {
      const cfg = config as HttpsWebhookConfig;
      if (!cfg?.url) {
        return { ok: false, error: "HTTPS_WEBHOOK transportConfig is missing a url." };
      }
      try {
        const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
        if (cfg.secretRef) {
          const secret = await resolveSecretRef(cfg.secretRef);
          headers.Authorization = `Bearer ${secret}`;
        }
        const res = await fetch(cfg.url, { method: "POST", headers, body: new Uint8Array(bytes) });
        if (!res.ok) {
          return { ok: false, error: `HTTPS webhook responded ${res.status} ${res.statusText}` };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

/**
 * In-memory fake for tests only — NOT production-ready. A real SFTP client
 * is a new npm dependency decision outside U11's scope (flagged in the
 * Phase B report); this only exists so the retry/failure logic can be
 * exercised without one.
 */
export function createFakeSftpTransport(behavior: "success" | "fail" | Array<"success" | "fail">): FilerTransport {
  let calls = 0;
  return {
    kind: "SFTP",
    async deliver() {
      const outcome = Array.isArray(behavior) ? behavior[Math.min(calls, behavior.length - 1)] : behavior;
      calls++;
      return outcome === "success" ? { ok: true } : { ok: false, error: "FakeSftpTransport: simulated delivery failure" };
    },
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Serializer dispatch
// ---------------------------------------------------------------------------

function serializeForFormat(
  format: FilerExportFormat,
  draft: EntrySummaryDraft,
  profile: FilerProfileRecord,
  validation: ValidationResult,
  draftRow: EntrySummaryDraftRow,
  opts: { shipmentNumber?: string; sequence?: () => number; clock: () => Date }
): { filename: string; contentType: string; body: string } {
  switch (format) {
    case "CSV":
      return serializeCsv(draft, profile, { shipmentNumber: opts.shipmentNumber, version: draftRow.version });
    case "CATAIR_AE":
      if (!opts.sequence) {
        throw new Error("CATAIR_AE export requires a `sequence` port on RequestExportInput.");
      }
      return serializeCatair(draft, profile, {
        sequence: opts.sequence,
        shipmentNumber: opts.shipmentNumber,
        version: draftRow.version,
      });
    case "JSON_API":
      return serializeJson(draft, profile, validation, {
        clock: opts.clock,
        shipmentId: draftRow.shipmentId,
        draftId: draftRow.id,
        draftVersion: draftRow.version,
      });
    default:
      throw new UnknownExportFormatError(format);
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export interface RequestExportInput {
  accountId: string;
  draftRow: EntrySummaryDraftRow;
  /** Parsed `draftRow.draftData` (the caller owns validating it against `entrySummaryDraftSchema`). */
  draft: EntrySummaryDraft;
  /** Parsed `draftRow.validationData`. */
  validation: ValidationResult;
  profile: FilerProfileRecord;
  format: FilerExportFormat;
  transport: FilerTransport;
  requestedBy: string;
  clock: () => Date;
  /** Required for CATAIR_AE; ignored otherwise. */
  sequence?: () => number;
  /** Overridable in tests to skip real backoff delays. Defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Target for the after-3-failures notification. Resolving "the shipment's
   * assigned broker" would require DB access this otherwise-pure-ish service
   * doesn't have — the caller (which already has the shipment loaded) passes
   * the userId directly. No notification is sent if omitted.
   */
  brokerUserId?: string;
  shipmentNumber?: string;
}

/**
 * Requests an export of an approved, exportable draft. Idempotent: a repeat
 * call with the same (accountId, draftId, filerProfileId, format) returns
 * the existing row and performs no serialization, storage write, or
 * transport call. A DOWNLOAD-transport row is left `Pending`; call
 * `markDownloadDelivered` once the payload has actually been downloaded.
 * Any other transport is delivered (with retry) before returning.
 */
export async function requestExport(db: ExportDbClient, input: RequestExportInput): Promise<FilerExportRow> {
  const { draftRow, profile, format, transport } = input;

  if (!draftRow.isExportable) {
    throw new DraftNotExportable(draftRow.shipmentId, draftRow.version, draftRow.blockingCount);
  }
  if (draftRow.approvedAt == null) {
    throw new DraftNotApproved(draftRow.shipmentId, draftRow.version);
  }

  const idempotencyKey = computeIdempotencyKey(draftRow.id, profile.id, format);

  const existing = await db.filerExport.findFirst({ where: { accountId: input.accountId, idempotencyKey } });
  if (existing) return existing;

  const { filename, contentType, body } = serializeForFormat(format, input.draft, profile, input.validation, draftRow, {
    shipmentNumber: input.shipmentNumber,
    sequence: input.sequence,
    clock: input.clock,
  });

  const bytes = Buffer.from(body, "utf8");
  const payloadHash = createHash("sha256").update(bytes).digest("hex");
  const payloadSize = bytes.byteLength;

  const objectPath = `entry-summary-exports/${input.accountId}/${draftRow.shipmentId}/v${draftRow.version}/${filename}`;
  const stored = await storeGeneratedFile({ objectPath, filename, contentType, body: bytes });

  let row: FilerExportRow;
  try {
    row = await db.filerExport.create({
      data: {
        accountId: input.accountId,
        draftId: draftRow.id,
        filerProfileId: profile.id,
        format,
        transport: transport.kind,
        status: "Pending",
        idempotencyKey,
        payloadHash,
        payloadSize,
        storageUrl: stored.url,
        attemptCount: 0,
        lastError: null,
        requestedBy: input.requestedBy,
        deliveredAt: null,
      },
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      const raced = await db.filerExport.findFirst({ where: { accountId: input.accountId, idempotencyKey } });
      if (raced) return raced;
    }
    throw err;
  }

  if (transport.kind === "DOWNLOAD") {
    return row;
  }

  return deliverWithRetry(db, row, bytes, transport, input);
}

const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS = 3;

async function deliverWithRetry(
  db: ExportDbClient,
  row: FilerExportRow,
  bytes: Buffer,
  transport: FilerTransport,
  input: RequestExportInput
): Promise<FilerExportRow> {
  const sleep = input.sleep ?? defaultSleep;
  let current = row;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await transport.deliver(bytes, input.profile.transportConfig);
    current = await db.filerExport.update({ where: { id: current.id }, data: { attemptCount: attempt } });

    if (result.ok) {
      return db.filerExport.update({
        where: { id: current.id },
        data: { status: "Delivered", deliveredAt: input.clock(), lastError: null },
      });
    }

    current = await db.filerExport.update({ where: { id: current.id }, data: { lastError: result.error } });

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS[attempt - 1]);
    }
  }

  current = await db.filerExport.update({ where: { id: current.id }, data: { status: "Failed" } });

  if (input.brokerUserId) {
    await notify({
      accountId: input.accountId,
      userId: input.brokerUserId,
      type: "FILER_EXPORT_FAILED",
      message: `Export of EntrySummaryDraft v${input.draftRow.version} (shipment ${input.draftRow.shipmentId}) to filer "${input.profile.name}" failed after ${MAX_ATTEMPTS} attempts.`,
      entityType: "FilerExport",
      entityId: current.id,
    });
  }

  return current;
}

/** Transitions a DOWNLOAD-transport export to Delivered once the payload has actually been downloaded (wired up by a Phase C route). */
export async function markDownloadDelivered(
  db: ExportDbClient,
  accountId: string,
  exportId: string,
  clock: () => Date = () => new Date()
): Promise<FilerExportRow> {
  const row = await db.filerExport.findFirst({ where: { id: exportId, accountId } });
  if (!row) throw new Error(`FilerExport ${exportId} not found for account ${accountId}.`);
  return db.filerExport.update({ where: { id: row.id }, data: { status: "Delivered", deliveredAt: clock() } });
}

/** Cross-account-safe single-record read: never returns another account's row. */
export async function getExport(db: ExportDbClient, accountId: string, exportId: string): Promise<FilerExportRow | null> {
  return (await db.filerExport.findFirst({ where: { id: exportId, accountId } })) ?? null;
}

/**
 * Marks every FilerExport row for a prior draft version Superseded. Wired as
 * `draft.service.ts`'s `generateDraft({ onSuperseded })` hook by callers.
 */
export async function supersedeExportsForDraft(db: ExportDbClient, accountId: string, draftId: string): Promise<void> {
  await db.filerExport.updateMany({ where: { accountId, draftId }, data: { status: "Superseded" } });
}

/**
 * All FilerExport rows across every draft version of a shipment, newest
 * first (U13 — the review UI's export history list). No list-by-shipment
 * endpoint existed before this unit; FilerExport only carries a `draftId`,
 * so this reaches the shipment via the `draft` relation rather than a
 * denormalized shipmentId column.
 */
export async function listExportsForShipment(db: ExportDbClient, accountId: string, shipmentId: string): Promise<FilerExportRow[]> {
  return db.filerExport.findMany({
    where: { accountId, draft: { shipmentId } },
    orderBy: { createdAt: "desc" },
  });
}

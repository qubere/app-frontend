// Unified compliance execution audit envelope -- persistence helper.
//
// Records ONE row per compliance-check invocation (RPS, embargo,
// classification, forced labor, end-use/end-user, military end-use,
// anti-boycott) into ComplianceExecution, so a shipment's/party's full
// compliance timeline can be reconstructed and searched WITHOUT touching any
// domain's own matching/decision logic or authoritative result tables
// (RestrictedPartyScreeningResult, EmbargoUsageHeader, ClassificationRun,
// ComplianceScreeningFinding). Kept isolated from business-rule code, in the
// same spirit as embargoAudit.ts: audit-write failures are always best-effort
// and must never flip, delay, or throw out of a real compliance decision.
import { db } from "@/lib/db";
import crypto from "crypto";
import { logAgentError } from "@/modules/agents/agentLogger";
import type { Prisma, ComplianceExecutionType, ComplianceExecutionStatus, ComplianceExecutionSource } from "@prisma/client";

/** Case-insensitive key match -- never persist these, regardless of allow-list. */
const SECRET_KEY_PATTERN = /(authorization|cookie|token|password|secret|api[_-]?key)/i;

/** Soft cap on a single sanitized snapshot's serialized size. */
const MAX_SNAPSHOT_BYTES = 32 * 1024;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redact(value: unknown, allowList?: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, allowList));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (allowList && allowList.length > 0 && !allowList.includes(key)) continue;
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = redact(val, allowList);
    }
    return out;
  }
  return value;
}

/**
 * Strips/redacts secret-shaped keys (authorization, cookie, token, password,
 * secret, api key -- case-insensitive) from an arbitrary payload and bounds
 * its serialized size, so a compliance snapshot can never leak credentials
 * or blow up storage. Returns undefined for a nullish payload -- callers
 * should omit the field entirely rather than persist an empty snapshot.
 */
export function sanitizeSnapshot(payload: unknown, allowList?: string[]): Record<string, unknown> | undefined {
  if (payload === undefined || payload === null) return undefined;
  const redacted = redact(payload, allowList);
  const asObject = isPlainObject(redacted) ? redacted : { value: redacted };
  const serialized = JSON.stringify(asObject);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) return asObject;
  return {
    __truncated: true,
    __originalSizeBytes: serialized.length,
    __preview: serialized.slice(0, MAX_SNAPSHOT_BYTES),
  };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Deterministic SHA-256 hex hash of a payload, stable regardless of key insertion order. Returns null for an undefined payload. */
export function computeContentHash(payload: unknown): string | null {
  if (payload === undefined) return null;
  const stable = JSON.stringify(sortKeysDeep(payload));
  return crypto.createHash("sha256").update(stable).digest("hex");
}

export interface RecordComplianceExecutionInput {
  accountId: string;
  executionType: ComplianceExecutionType;
  status: ComplianceExecutionStatus;
  correlationId: string;
  requestId?: string | null;
  parentExecutionId?: string | null;
  shipmentId?: string | null;
  lineItemId?: string | null;
  partyId?: string | null;
  productId?: string | null;
  countryRole?: string | null;
  countryChecked?: string | null;
  source: ComplianceExecutionSource;
  initiatedByUserId?: string | null;
  /** Raw request payload -- sanitized/size-bounded internally before persistence. Never pass headers/cookies directly; pass the parsed body. */
  requestSnapshot?: unknown;
  /** Raw response/result payload -- sanitized/size-bounded internally before persistence. */
  responseSnapshot?: unknown;
  requestSnapshotAllowList?: string[];
  responseSnapshotAllowList?: string[];
  rulesetVersion?: string | null;
  referenceDataAsOf?: Date | null;
  agentName?: string | null;
  modelProvider?: string | null;
  modelVersion?: string | null;
  promptVersion?: string | null;
  resultRefType?: string | null;
  resultRefId?: string | null;
  finalStatus?: string | null;
  finalSummary?: string | null;
  errorCategory?: string | null;
  errorCode?: string | null;
  failedStage?: string | null;
  startedAt?: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
}

/**
 * Creates one ComplianceExecution row. Best-effort only: any failure (bad
 * connection, stale client, constraint violation) is caught, logged via the
 * existing agent-error logger, and reported as null -- it must NEVER throw,
 * since a caller invoking this alongside a real compliance check must never
 * have that check's own result affected by an audit-recording failure.
 */
export async function recordComplianceExecution(input: RecordComplianceExecutionInput): Promise<string | null> {
  try {
    const requestSnapshot = sanitizeSnapshot(input.requestSnapshot, input.requestSnapshotAllowList);
    const responseSnapshot = sanitizeSnapshot(input.responseSnapshot, input.responseSnapshotAllowList);

    const execution = await db.complianceExecution.create({
      data: {
        accountId: input.accountId,
        executionType: input.executionType,
        status: input.status,
        correlationId: input.correlationId,
        requestId: input.requestId ?? null,
        parentExecutionId: input.parentExecutionId ?? null,
        shipmentId: input.shipmentId ?? null,
        lineItemId: input.lineItemId ?? null,
        partyId: input.partyId ?? null,
        productId: input.productId ?? null,
        countryRole: input.countryRole ?? null,
        countryChecked: input.countryChecked ?? null,
        source: input.source,
        initiatedByUserId: input.initiatedByUserId ?? null,
        requestSnapshot: (requestSnapshot as Prisma.InputJsonValue) ?? undefined,
        responseSnapshot: (responseSnapshot as Prisma.InputJsonValue) ?? undefined,
        inputHash: computeContentHash(input.requestSnapshot),
        outputHash: computeContentHash(input.responseSnapshot),
        rulesetVersion: input.rulesetVersion ?? null,
        referenceDataAsOf: input.referenceDataAsOf ?? null,
        agentName: input.agentName ?? null,
        modelProvider: input.modelProvider ?? null,
        modelVersion: input.modelVersion ?? null,
        promptVersion: input.promptVersion ?? null,
        resultRefType: input.resultRefType ?? null,
        resultRefId: input.resultRefId ?? null,
        finalStatus: input.finalStatus ?? null,
        finalSummary: input.finalSummary ?? null,
        errorCategory: input.errorCategory ?? null,
        errorCode: input.errorCode ?? null,
        failedStage: input.failedStage ?? null,
        ...(input.startedAt ? { startedAt: input.startedAt } : {}),
        completedAt: input.completedAt ?? null,
        durationMs: input.durationMs ?? null,
      },
    });
    return execution.id;
  } catch (err) {
    logAgentError(
      "Compliance Execution History",
      input.shipmentId ?? input.partyId ?? input.accountId,
      "recordComplianceExecution",
      err
    );
    return null;
  }
}

/** Best-effort back-link from a ComplianceScreeningFinding to the ComplianceExecution that produced it. Never throws. */
export async function linkScreeningFinding(findingId: string, executionId: string): Promise<void> {
  try {
    await db.complianceScreeningFinding.update({
      where: { id: findingId },
      data: { executionId },
    });
  } catch (err) {
    logAgentError("Compliance Execution History", findingId, "linkScreeningFinding", err);
  }
}

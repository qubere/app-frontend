import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { createExceptionItem } from "@/lib/exceptions/createException";
import { ProviderMetadata } from "@/lib/providers";
import {
  decodeCursor,
  encodeCursor,
  keysetWhere,
  KEYSET_ORDER_BY,
} from "@/lib/api/keysetCursor";
import {
  EXCEPTION_STATES,
  isRiskAcceptance,
  isTerminalExceptionState,
  normalizeExceptionStatus,
  requiresResolutionReason,
  statusVariants,
  type ExceptionState,
} from "./exceptionState";
import { validateReasonCode, isRiskAcceptanceReason, type ExceptionCategory } from "./resolutionReasons";
import { notify } from "@/modules/notifications/notify";
import type { DocumentType } from "@prisma/client";
import { getRequiredFields } from "@/lib/documents/extractionSchemas";
import { resolveField } from "@/lib/documents/fieldDictionary";

export interface ExceptionListQuery {
  status?: string;
  severity?: string;
  assignedToMe?: boolean;
}

/** Canonical severity values as stored on ExceptionItem.severity. */
export const EXCEPTION_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

const SEVERITY_BY_LOWER = new Map(
  EXCEPTION_SEVERITIES.map((s) => [s.toLowerCase(), s]),
);

/**
 * Map a client-supplied severity onto its canonical stored form so the query
 * can use an index-friendly exact match instead of `mode: "insensitive"`
 * (which forces a sequential scan / `ILIKE`). Unknown values return null and
 * the caller narrows the result to nothing rather than widening it.
 */
export function normalizeExceptionSeverity(
  raw: string | null | undefined,
): ExceptionSeverity | null {
  if (typeof raw !== "string") return null;
  return SEVERITY_BY_LOWER.get(raw.trim().toLowerCase()) ?? null;
}

export interface ExceptionListPagination {
  /** Defaults to 25, hard-capped at 100. */
  limit?: number;
  cursor?: string;
  /**
   * Opt-in total count. Off by default: a `count` over every exception in the
   * account is a second round trip the list UI does not need on each page.
   */
  withCount?: boolean;
}

/**
 * Narrow projection for the exception *list*. Every scalar column is kept
 * (they are all small), but related records are reduced to the identifiers
 * and labels the list actually renders. Full `shipment` / `filing` /
 * `assignedToUser` objects, and `resolutionReasonCode`, are intentionally
 * excluded — callers that need them use `GET /api/exceptions/:id`.
 */
export const EXCEPTION_LIST_SELECT = {
  id: true,
  accountId: true,
  shipmentId: true,
  filingId: true,
  documentId: true,
  fieldKey: true,
  code: true,
  category: true,
  type: true,
  severity: true,
  description: true,
  status: true,
  blocking: true,
  requiredAction: true,
  sourceAgent: true,
  version: true,
  assignedToUserId: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
  resolvedByName: true,
  resolutionNote: true,
  history: true,
  shipment: { select: { id: true, shipmentNumber: true } },
  filing: { select: { id: true, entryNumber: true } },
  assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export interface ExceptionUpdateInput {
  status?: string;
  assignedToUserId?: string;
  /** Null detaches the exception; a string must name a shipment in the same account. */
  shipmentId?: string | null;
  resolutionReason?: string;
  /** Picklist code from resolutionReasons.ts. Must be valid for the exception's category. */
  resolutionReasonCode?: string;
  resolutionEvidence?: string;
  source?: string;
  expectedVersion: number;
}

export interface ExceptionResolver {
  userId: string;
  name: string;
}

export const VALID_EXCEPTION_STATES: readonly string[] = EXCEPTION_STATES;

export class ExceptionService {
  static async listExceptions(
    accountId: string,
    userId: string,
    query: ExceptionListQuery,
    pagination?: ExceptionListPagination
  ) {
    const where: import("@prisma/client").Prisma.ExceptionItemWhereInput = { accountId };

    if (query.status && query.status !== "all") {
      const normalized = normalizeExceptionStatus(query.status);
      // An unrecognised status must not widen the result to everything.
      where.status = normalized ? { in: statusVariants(normalized) } : { in: [] };
    }
    if (query.severity && query.severity !== "all") {
      const normalized = normalizeExceptionSeverity(query.severity);
      // Unknown severity narrows to nothing rather than widening to everything.
      where.severity = normalized ? { equals: normalized } : { in: [] };
    }
    if (query.assignedToMe) {
      where.assignedToUserId = userId;
    }

    // Keyset pagination on (createdAt DESC, id DESC). Throws InvalidCursorError
    // for a malformed token — the route maps that to a 400.
    const position = pagination?.cursor ? decodeCursor(pagination.cursor) : undefined;
    const keyset = keysetWhere(position);
    if (keyset) {
      where.AND = [keyset];
    }

    const limit = Math.min(Math.max(1, pagination?.limit ?? 25), 100);

    // Fetch one extra row to learn whether a further page exists without a
    // second COUNT query.
    const rows = await db.exceptionItem.findMany({
      where,
      select: EXCEPTION_LIST_SELECT,
      orderBy: KEYSET_ORDER_BY,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const exceptions = hasMore ? rows.slice(0, limit) : rows;
    const last = exceptions[exceptions.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last) : null;

    const total = pagination?.withCount
      ? await db.exceptionItem.count({ where })
      : null;

    return {
      exceptions,
      pagination: { nextCursor, hasMore, total },
      metadata: {
        providerName: "InternalExceptionEngine",
        datasetVersion: "2026.1",
        retrievedAt: new Date().toISOString(),
        completenessStatus: "COMPLETE",
      } as ProviderMetadata,
    };
  }

  static async updateException(
    accountId: string,
    exceptionId: string,
    input: ExceptionUpdateInput,
    resolver?: ExceptionResolver | null
  ) {
    const existing = await db.exceptionItem.findFirst({
      where: { id: exceptionId, accountId },
      omit: { resolutionReasonCode: true },
    });

    if (!existing) {
      throw new Error("NOT_FOUND");
    }

    if (existing.version !== input.expectedVersion) {
      throw new Error("STALE_VERSION");
    }

    let nextStatus: ExceptionState | undefined;
    if (input.status) {
      const normalized = normalizeExceptionStatus(input.status);
      if (!normalized) {
        throw new Error(`Invalid exception status state: ${input.status}`);
      }
      if (requiresResolutionReason(normalized) && !input.resolutionReason?.trim()) {
        throw new Error(`A stated reason is required to move this exception to ${normalized}`);
      }
      // Waiving requires a picklist reason code in addition to the free-text note.
      if (isRiskAcceptance(normalized) && !input.resolutionReasonCode?.trim()) {
        throw new Error(`Waiving an exception requires a reason code from the approved picklist.`);
      }
      // Validate the picklist code when provided.
      if (input.resolutionReasonCode?.trim()) {
        const category = (existing.category as ExceptionCategory | null) ?? null;
        const codeError = validateReasonCode(input.resolutionReasonCode.trim(), category);
        if (codeError) throw new Error(codeError);
        // A risk-acceptance reason code requires the WAIVED status.
        if (isRiskAcceptanceReason(input.resolutionReasonCode.trim()) && normalized !== "WAIVED") {
          throw new Error(`Reason code "${input.resolutionReasonCode}" is a risk acceptance and requires WAIVED status.`);
        }
      }
      nextStatus = normalized;
    }

    if (input.shipmentId) {
      const owned = await db.shipment.findFirst({
        where: { id: input.shipmentId, accountId },
        select: { id: true },
      });
      if (!owned) {
        throw new Error("SHIPMENT_NOT_FOUND");
      }
    }

    // The audit entry records the reason alongside the transition itself, and it
    // fails closed: a closed exception with no stated reason is the outcome this
    // guard exists to prevent.
    const isClosing = Boolean(nextStatus && isTerminalExceptionState(nextStatus));
    if (nextStatus && requiresResolutionReason(nextStatus)) {
      await createAuditLog({
        accountId,
        userId: resolver?.userId ?? null,
        action: AuditAction.EXCEPTION_RESOLVED,
        entity: "ExceptionItem",
        entityId: exceptionId,
        source: (input.source as any) || "UI",
        metadata: {
          fromStatus: existing.status,
          toStatus: nextStatus,
          resolutionReason: input.resolutionReason,
          resolutionEvidence: input.resolutionEvidence ?? null,
        },
        failClosed: true,
      });
    }

    // Append a history entry for this transition.
    const historyEntry = {
      timestamp: new Date().toISOString(),
      userId: resolver?.userId ?? "SYSTEM",
      action: nextStatus
        ? `status_changed:${nextStatus}`
        : input.assignedToUserId !== undefined
          ? `assigned:${input.assignedToUserId ?? "unassigned"}`
          : "updated",
      note: input.resolutionReason?.trim() || undefined,
    };
    const currentHistory = Array.isArray(existing.history) ? (existing.history as object[]) : [];
    const updatedHistory = [...currentHistory, historyEntry];

    const updated = await db.exceptionItem.update({
      where: { id: exceptionId },
      data: {
        status: nextStatus,
        assignedToUserId: input.assignedToUserId !== undefined ? input.assignedToUserId : undefined,
        shipmentId: input.shipmentId !== undefined ? input.shipmentId : undefined,
        resolvedAt: isClosing ? new Date() : undefined,
        resolvedBy: isClosing ? resolver?.userId : undefined,
        resolvedByName: isClosing ? resolver?.name : undefined,
        resolutionNote: isClosing ? input.resolutionReason : undefined,
        resolutionReasonCode: isClosing && input.resolutionReasonCode?.trim()
          ? input.resolutionReasonCode.trim()
          : undefined,
        history: updatedHistory,
        version: { increment: 1 },
      },
      include: {
        shipment: true,
        filing: true,
        assignedToUser: true,
      },
    });

    if (
      input.assignedToUserId &&
      input.assignedToUserId !== existing.assignedToUserId
    ) {
      await notify({
        accountId,
        userId: input.assignedToUserId,
        type: "EXCEPTION_ASSIGNED",
        message: `Exception "${existing.description}" has been assigned to you.`,
        entityType: "ExceptionItem",
        entityId: exceptionId,
      });
    }

    return updated;
  }


  /**
   * C-5: Sync MISSING_DATA exceptions for per-document-type required fields.
   *
   * For every required field in the extraction schema for `documentType`:
   * - Opens a new MISSING_DATA ExceptionItem if the field was not extracted.
   * - Resolves the existing open ExceptionItem if the field was extracted.
   *
   * Only one open exception per (documentId, fieldName) code is maintained.
   */
  static async syncExtractionFieldExceptions(input: {
    accountId: string;
    shipmentId: string;
    documentId: string;
    documentType: DocumentType;
    fileName: string;
    writtenFieldNames: Set<string>;
  }) {
    const requiredFields = getRequiredFields(input.documentType);
    for (const field of requiredFields) {
      const { fieldName, label } = field;
      const code = `MISSING_EXTRACTION:${fieldName}`;
      const isPresent = input.writtenFieldNames.has(fieldName);

      const existingOpen = await db.exceptionItem.findFirst({
        where: { documentId: input.documentId, fieldKey: fieldName, code, status: { not: "Resolved" } },
        omit: { resolutionReasonCode: true },
      });

      if (!isPresent) {
        if (!existingOpen) {
          await createExceptionItem({
            accountId: input.accountId,
            shipmentId: input.shipmentId,
            documentId: input.documentId,
            fieldKey: fieldName,
            code,
            category: "MISSING_DATA",
            type: "missing_document",
            severity: "Medium",
            blocking: false,
            description: `${label} was not extracted from ${input.fileName}.`,
            requiredAction: `Review document and provide ${label}, or confirm it is not applicable.`,
            sourceAgent: "Document Intelligence Agent",
          });
        }
      } else if (existingOpen) {
        await db.exceptionItem.update({
          where: { id: existingOpen.id },
          data: {
            status: "Resolved",
            resolvedAt: new Date(),
            resolvedBy: "SYSTEM",
            resolvedByName: "Automated re-extraction",
            resolutionNote: `${label} was found on reprocessing.`,
          },
        });
      }
    }
  }

  /**
   * Resolves the open exception (if any) for one document field, with real
   * approver identity -- used by the field-review route so approving/editing
   * a field also clears its exception instead of leaving a stale duplicate.
   */
  static async resolveDocumentFieldException(
    documentId: string,
    fieldKey: string,
    accountId: string,
    resolver: ExceptionResolver,
    note: string
  ) {
    // Exceptions are stored under the snake_case extraction-schema key
    // (`bl_number`), while callers pass whatever spelling their surface uses
    // (`transportDocumentNumber`, `tracking.billOfLading`). Resolve every open
    // exception on this document whose stored key maps to the same dictionary
    // field, so approving/editing a value clears its exception regardless of
    // which vocabulary raised it.
    const field = resolveField(fieldKey);
    const keyForms = new Set<string>([fieldKey]);
    if (field) {
      keyForms.add(field.inventory.legacyKey);
      if (field.tradeMetadataKey) keyForms.add(field.tradeMetadataKey);
      for (const k of field.extractionSchemaKeys) keyForms.add(k);
    }

    const openForDoc = await db.exceptionItem.findMany({
      where: { documentId, accountId, status: { not: "Resolved" }, fieldKey: { not: null } },
      omit: { resolutionReasonCode: true },
    });
    const matches = openForDoc.filter(
      (ex) => ex.fieldKey && (keyForms.has(ex.fieldKey) || resolveField(ex.fieldKey)?.canonicalKey === field?.canonicalKey)
    );
    if (matches.length === 0) return null;

    await db.exceptionItem.updateMany({
      where: { id: { in: matches.map((m) => m.id) } },
      data: {
        status: "Resolved",
        resolvedAt: new Date(),
        resolvedBy: resolver.userId,
        resolvedByName: resolver.name,
        resolutionNote: note,
      },
    });
    return matches[0];
  }
}

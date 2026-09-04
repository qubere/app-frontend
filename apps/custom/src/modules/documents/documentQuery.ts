export const DOCUMENT_PAGE_SIZE_DEFAULT = 25;
export const DOCUMENT_PAGE_SIZE_MAX = 100;

import type { DocumentEntityType, Prisma } from "@prisma/client";

const DOCUMENT_ENTITY_TYPES: readonly DocumentEntityType[] = [
  "SHIPMENT",
  "PARTY",
  "PRODUCT",
  "LICENSE",
  "FILING",
];

function parseEntityType(value: string | null): DocumentEntityType | null {
  return value && (DOCUMENT_ENTITY_TYPES as readonly string[]).includes(value)
    ? (value as DocumentEntityType)
    : null;
}

export const DOCUMENT_SORT_COLUMNS = [
  "fileName",
  "docType",
  "shipmentNumber",
  "status",
  "confidence",
  "createdAt",
] as const;
export type DocumentSortColumn = (typeof DOCUMENT_SORT_COLUMNS)[number];
export type SortDirection = "asc" | "desc";

export interface DocumentQuery {
  search: string | null;
  docType: string | null;
  status: string | null;
  /** A client id, or `UNASSIGNED` for documents whose shipment carries no client. */
  clientId: string | null;
  /** A shipment id, or `UNATTACHED` for documents not attached to any shipment. */
  shipmentId: string | null;
  /** Restricts to documents with an active DocumentAssociation to this entity type/id pair. */
  linkedEntityType: DocumentEntityType | null;
  linkedEntityId: string | null;
  /** User ids whose shipments' documents to show; empty means every assignee. */
  assignedBrokerIds: string[];
  /** `archive` restricts to documents on shipments done with filing, or deleted. See ARCHIVE_SHIPMENT_STATUSES. */
  archivedOnly: boolean;
  /** Inclusive createdAt lower bound. */
  createdFrom: Date | null;
  /** Inclusive createdAt upper bound. */
  createdTo: Date | null;
  sort: DocumentSortColumn;
  direction: SortDirection;
  page: number;
  pageSize: number;
}

/**
 * Shipment lifecycle states that count as "done with filing" for the vault's
 * archive scope. A shipment can also qualify by being soft-deleted regardless
 * of status -- see buildDocumentWhere.
 */
export const ARCHIVE_SHIPMENT_STATUSES = ["Submitted", "Completed", "DELIVERED", "Delivered with Exception"];

/** Sentinel for "no client", which is a real filter and not the absence of one. */
export const UNASSIGNED_CLIENT = "UNASSIGNED";

/**
 * Sentinel for "detached". Detaching a document nulls its shipmentId but keeps the
 * row and its extraction, so these documents must stay reachable in the console.
 */
export const UNATTACHED_SHIPMENT = "UNATTACHED";

function positiveInt(raw: string | null, fallback: number, max: number): number {
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function trimmed(raw: string | null): string | null {
  const value = raw?.trim();
  return value ? value : null;
}

function idList(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))];
}

function dateParam(raw: string | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDocumentQuery(params: URLSearchParams): DocumentQuery {
  const requestedSort = trimmed(params.get("sort"));
  const sort = DOCUMENT_SORT_COLUMNS.includes(requestedSort as DocumentSortColumn)
    ? (requestedSort as DocumentSortColumn)
    : "createdAt";
  const requestedDirection = trimmed(params.get("dir"))?.toLowerCase();

  return {
    search: trimmed(params.get("search")),
    docType: trimmed(params.get("docType")),
    status: trimmed(params.get("status")),
    clientId: trimmed(params.get("clientId")),
    shipmentId: trimmed(params.get("shipmentId")),
    linkedEntityType: parseEntityType(trimmed(params.get("linkedEntityType"))),
    linkedEntityId: trimmed(params.get("linkedEntityId")),
    assignedBrokerIds: idList(params.get("assignedBrokerIds")),
    archivedOnly: params.get("scope") === "archive",
    createdFrom: dateParam(params.get("from")),
    createdTo: dateParam(params.get("to")),
    sort,
    direction:
      requestedDirection === "asc" || requestedDirection === "desc"
        ? requestedDirection
        : sort === "createdAt"
          ? "desc"
          : "asc",
    page: positiveInt(params.get("page"), 1, Number.MAX_SAFE_INTEGER),
    pageSize: positiveInt(params.get("pageSize"), DOCUMENT_PAGE_SIZE_DEFAULT, DOCUMENT_PAGE_SIZE_MAX),
  };
}

export type DocumentOrderBy =
  | { fileName: SortDirection }
  | { docType: SortDirection }
  | { status: SortDirection }
  | { createdAt: SortDirection }
  | { id: SortDirection }
  | { confidence: { sort: SortDirection; nulls: "last" } }
  | { shipment: { shipmentNumber: SortDirection } };

/**
 * A missing confidence is unknown, not low, so it sorts last in both directions
 * rather than crowding the top of a descending sort the way Postgres defaults to.
 * The trailing id keeps paging stable when the sorted column repeats.
 */
export function buildDocumentOrderBy(query: DocumentQuery): DocumentOrderBy[] {
  const dir = query.direction;

  const primary: DocumentOrderBy =
    query.sort === "confidence"
      ? { confidence: { sort: dir, nulls: "last" } }
      : query.sort === "shipmentNumber"
        ? { shipment: { shipmentNumber: dir } }
        : ({ [query.sort]: dir } as DocumentOrderBy);

  return query.sort === "createdAt" ? [primary, { id: "desc" }] : [primary, { createdAt: "desc" }, { id: "desc" }];
}

/**
 * accountId is always present so the filter cannot be widened past the caller's tenant
 * by any combination of query parameters.
 */
export function buildDocumentWhere(accountId: string, query: DocumentQuery): Prisma.ShipmentDocumentWhereInput {
  const where: Prisma.ShipmentDocumentWhereInput = { accountId };
  const predicates: Prisma.ShipmentDocumentWhereInput[] = [];

  if (query.docType) where.docType = query.docType;
  if (query.status) where.status = query.status;

  if (query.shipmentId) {
    where.shipmentId =
      query.shipmentId === UNATTACHED_SHIPMENT ? null : query.shipmentId;
  }

  if (query.linkedEntityType) {
    where.associations = {
      some: {
        entityType: query.linkedEntityType,
        ...(query.linkedEntityId ? { entityId: query.linkedEntityId } : {}),
        active: true,
      },
    };
  }

  // New capture paths stamp clientId directly on the document; legacy attached
  // documents inherit it from their shipment. Search/filter both representations.
  if (query.clientId) {
    predicates.push(
      query.clientId === UNASSIGNED_CLIENT
        ? { clientId: null, OR: [{ shipmentId: null }, { shipment: { clientId: null } }] }
        : { OR: [{ clientId: query.clientId }, { shipment: { clientId: query.clientId } }] }
    );
  }

  if (query.assignedBrokerIds.length > 0) {
    predicates.push({
      OR: [
        { assignedToUserId: { in: query.assignedBrokerIds } },
        { shipment: { assignedBrokerId: { in: query.assignedBrokerIds } } },
      ],
    });
  }

  // The vault: a document belongs here once its shipment is done with filing,
  // or the shipment itself was deleted -- either way it has left the active
  // workflow and become a compliance record rather than work in progress.
  if (query.archivedOnly) {
    predicates.push({
      shipment: { OR: [
        { status: { in: ARCHIVE_SHIPMENT_STATUSES } },
        { deletedAt: { not: null } },
      ] },
    });
  }

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {};
    if (query.createdFrom) where.createdAt.gte = query.createdFrom;
    if (query.createdTo) where.createdAt.lte = query.createdTo;
  }

  if (query.search) {
    const contains = { contains: query.search, mode: "insensitive" as const };
    predicates.push({
      OR: [
        { fileName: contains },
        { docType: contains },
        { uploadedByName: contains },
        { uploadedByEmail: contains },
        { parsedSearchText: contains },
        { extractedJson: contains },
        { rawContent: contains },
        { extractionFields: { some: { OR: [{ fieldName: contains }, { value: contains }] } } },
        { client: { name: contains } },
        { shipment: { shipmentNumber: contains } },
        { shipment: { client: { name: contains } } },
      ],
    });
  }

  if (predicates.length > 0) where.AND = predicates;

  return where;
}

export function documentSkip(query: DocumentQuery): number {
  return (query.page - 1) * query.pageSize;
}

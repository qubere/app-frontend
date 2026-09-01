import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import type {
  DocumentAssociation,
  DocumentAssociationSource,
  DocumentEntityType,
  DocumentRelationshipType,
} from "@prisma/client";
import { resolveAssociationEntity } from "./entityResolver";

export class DocumentAssociationError extends Error {
  constructor(
    message: string,
    public readonly code: "DOCUMENT_NOT_FOUND" | "ENTITY_NOT_FOUND" | "ASSOCIATION_NOT_FOUND"
  ) {
    super(message);
  }
}

export interface LinkDocumentInput {
  accountId: string;
  documentId: string;
  entityType: DocumentEntityType;
  entityId: string;
  relationshipType?: DocumentRelationshipType;
  source?: DocumentAssociationSource;
  /** Actor recorded as linkedBy. Server-controlled -- never taken from client-forgeable fields. */
  linkedBy: string;
  auditSource?: "UI" | "API" | "SYSTEM";
}

/**
 * Creates (or idempotently reuses) an active association between a document
 * and a business entity, both scoped to the caller's account.
 *
 * Duplicate-active-link protection: this repo has no partial-unique-index
 * support in the Prisma schema for a soft-deletable uniqueness constraint, so
 * duplication is prevented transactionally (find active row inside the same
 * transaction, create only if absent) -- the same "claim" pattern already
 * used elsewhere in this codebase for idempotent dispatcher/backfill jobs.
 * Safe to call repeatedly (e.g. from an Inngest retry) -- never creates a
 * second active row for the same (documentId, entityType, entityId).
 */
export async function linkDocument(input: LinkDocumentInput): Promise<{
  association: DocumentAssociation;
  created: boolean;
}> {
  const document = await db.shipmentDocument.findFirst({
    where: { id: input.documentId, accountId: input.accountId },
    select: { id: true, fileName: true },
  });
  if (!document) {
    throw new DocumentAssociationError("Document not found in this account", "DOCUMENT_NOT_FOUND");
  }

  const entity = await resolveAssociationEntity(input.accountId, input.entityType, input.entityId);
  if (!entity) {
    throw new DocumentAssociationError("Target entity not found in this account", "ENTITY_NOT_FOUND");
  }

  const { association, created } = await db.$transaction(async (tx) => {
    const existing = await tx.documentAssociation.findFirst({
      where: {
        accountId: input.accountId,
        documentId: document.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
        active: true,
      },
    });
    if (existing) {
      return { association: existing, created: false };
    }

    const row = await tx.documentAssociation.create({
      data: {
        accountId: input.accountId,
        documentId: document.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityDisplayId: entity.entityDisplayId,
        relationshipType: input.relationshipType ?? "GENERAL",
        source: input.source ?? "USER",
        linkedBy: input.linkedBy,
      },
    });
    return { association: row, created: true };
  });

  if (created) {
    await createAuditLog({
      accountId: input.accountId,
      userId: input.linkedBy,
      action: AuditAction.DOCUMENT_ASSOCIATION_CREATED,
      entity: "DocumentAssociation",
      entityId: association.id,
      source: input.auditSource ?? "UI",
      metadata: {
        documentId: document.id,
        fileName: document.fileName,
        entityType: entity.entityType,
        entityId: entity.entityId,
        relationshipType: association.relationshipType,
        associationSource: association.source,
      },
      success: true,
    });
  }

  return { association, created };
}

export interface UnlinkDocumentInput {
  accountId: string;
  associationId: string;
  /** Actor recorded as unlinkedBy. Server-controlled. */
  unlinkedBy: string;
  auditSource?: "UI" | "API" | "SYSTEM";
}

/** Soft-unlinks an association. Never deletes the row -- history is permanent. */
export async function unlinkDocument(input: UnlinkDocumentInput): Promise<DocumentAssociation> {
  const existing = await db.documentAssociation.findFirst({
    where: { id: input.associationId, accountId: input.accountId },
  });
  if (!existing) {
    throw new DocumentAssociationError("Association not found in this account", "ASSOCIATION_NOT_FOUND");
  }
  if (!existing.active) {
    return existing;
  }

  const updated = await db.documentAssociation.update({
    where: { id: existing.id },
    data: {
      active: false,
      unlinkedBy: input.unlinkedBy,
      unlinkedAt: new Date(),
    },
  });

  await createAuditLog({
    accountId: input.accountId,
    userId: input.unlinkedBy,
    action: AuditAction.DOCUMENT_ASSOCIATION_UNLINKED,
    entity: "DocumentAssociation",
    entityId: updated.id,
    source: input.auditSource ?? "UI",
    metadata: {
      documentId: updated.documentId,
      entityType: updated.entityType,
      entityId: updated.entityId,
    },
    success: true,
  });

  return updated;
}

/** All active associations for one document, newest link first. */
export async function getDocumentAssociations(accountId: string, documentId: string) {
  return db.documentAssociation.findMany({
    where: { accountId, documentId, active: true },
    orderBy: { linkedAt: "desc" },
  });
}

/** Full chronological history (active + inactive) for one document. */
export async function getDocumentAssociationHistory(accountId: string, documentId: string) {
  return db.documentAssociation.findMany({
    where: { accountId, documentId },
    orderBy: { linkedAt: "desc" },
  });
}

/** All active documents linked to one business entity. */
export async function getEntityDocuments(
  accountId: string,
  entityType: DocumentEntityType,
  entityId: string
) {
  return db.documentAssociation.findMany({
    where: { accountId, entityType, entityId, active: true },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          docType: true,
          documentType: true,
          status: true,
          confidence: true,
          createdAt: true,
          source: true,
        },
      },
    },
    orderBy: { linkedAt: "desc" },
  });
}

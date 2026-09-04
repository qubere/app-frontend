import { db } from "@qubere/db";

export interface IncludeDocumentInput {
  accountId: string;
  userId: string;
  customsCaseId: string;
  documentId: string;
  documentRole?: string;
}

export interface ExcludeDocumentInput {
  accountId: string;
  userId: string;
  customsCaseId: string;
  documentId: string;
  reason?: string;
}

export async function includeDocument(input: IncludeDocumentInput) {
  const { accountId, userId, customsCaseId, documentId, documentRole } = input;

  const customsCase = await db.customsCase.findFirst({
    where: { id: customsCaseId, accountId, deletedAt: null },
  });

  if (!customsCase) {
    throw new Error(`CustomsCase ${customsCaseId} not found or unauthorized.`);
  }

  const doc = await db.shipmentDocument.findFirst({
    where: { id: documentId, accountId },
  });

  if (!doc) {
    throw new Error(`Document ${documentId} not found or unauthorized.`);
  }

  const updated = await db.$transaction(async (tx) => {
    const link = await tx.customsCaseDocument.upsert({
      where: {
        customsCaseId_documentId: {
          customsCaseId,
          documentId,
        },
      },
      create: {
        accountId,
        customsCaseId,
        documentId,
        status: "INCLUDED",
        documentRole: documentRole || doc.docType || "Trade Document",
        includedAt: new Date(),
        includedByUserId: userId,
        sourceChecksum: doc.checksum,
        documentVersionId: doc.version,
      },
      update: {
        status: "INCLUDED",
        includedAt: new Date(),
        includedByUserId: userId,
        excludedAt: null,
        excludedByUserId: null,
        documentRole: documentRole || doc.docType || undefined,
        sourceChecksum: doc.checksum,
        documentVersionId: doc.version,
      },
    });

    await tx.auditLog.create({
      data: {
        accountId,
        userId,
        action: "CUSTOMS_DOCUMENT_INCLUDED",
        entity: "CustomsCaseDocument",
        entityId: link.id,
        metadata: {
          customsCaseId,
          documentId,
          sourceChecksum: doc.checksum,
          version: doc.version,
        },
      },
    });

    return link;
  });

  return updated;
}

export async function excludeDocument(input: ExcludeDocumentInput) {
  const { accountId, userId, customsCaseId, documentId, reason } = input;

  const customsCase = await db.customsCase.findFirst({
    where: { id: customsCaseId, accountId, deletedAt: null },
  });

  if (!customsCase) {
    throw new Error(`CustomsCase ${customsCaseId} not found or unauthorized.`);
  }

  const doc = await db.shipmentDocument.findFirst({
    where: { id: documentId, accountId },
  });

  if (!doc) {
    throw new Error(`Document ${documentId} not found or unauthorized.`);
  }

  const updated = await db.$transaction(async (tx) => {
    const link = await tx.customsCaseDocument.update({
      where: {
        customsCaseId_documentId: {
          customsCaseId,
          documentId,
        },
      },
      data: {
        status: "EXCLUDED",
        excludedAt: new Date(),
        excludedByUserId: userId,
        relevanceReason: reason || "Explicitly excluded by customs broker",
      },
    });

    await tx.auditLog.create({
      data: {
        accountId,
        userId,
        action: "CUSTOMS_DOCUMENT_EXCLUDED",
        entity: "CustomsCaseDocument",
        entityId: link.id,
        metadata: {
          customsCaseId,
          documentId,
          reason,
        },
      },
    });

    return link;
  });

  return updated;
}

export async function listCaseDocuments(accountId: string, customsCaseId: string) {
  const customsCase = await db.customsCase.findFirst({
    where: { id: customsCaseId, accountId, deletedAt: null },
  });

  if (!customsCase) {
    throw new Error(`CustomsCase ${customsCaseId} not found or unauthorized.`);
  }

  return db.customsCaseDocument.findMany({
    where: { accountId, customsCaseId },
    include: {
      document: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

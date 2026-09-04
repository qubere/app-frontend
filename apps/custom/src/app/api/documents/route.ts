import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api/auth-guards";
import { db, withAccountIdContext } from "@/lib/db";
import {
  buildDocumentOrderBy,
  buildDocumentWhere,
  buildDocumentWhereWithOptions,
  documentSkip,
  isParsedSearchCompatibilityError,
  parseDocumentQuery,
} from "@/modules/documents/documentQuery";

export async function GET(req: Request) {
  const { ctx, errorResponse } = await authorizeRequest();
  if (!ctx) {
    return errorResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await withAccountIdContext(ctx.accountId, async () => {
      const query = parseDocumentQuery(new URL(req.url).searchParams);
      const where = buildDocumentWhere(ctx.accountId, query);

      const loadPage = (whereFilter: typeof where) => Promise.all([
        db.shipmentDocument.count({ where: whereFilter }),
        db.shipmentDocument.findMany({
          where: whereFilter,
          select: {
            id: true,
            fileName: true,
            docType: true,
            documentType: true,
            documentTypeConfidence: true,
            status: true,
            pageCount: true,
            confidence: true,
            createdAt: true,
            shipmentId: true,
            source: true,
            uploadedByName: true,
            uploadedByEmail: true,
            uploadedByUserId: true,
            uploadedByType: true,
            uploadedAt: true,
            channel: true,
            channelMeta: true,
            assignedToUserId: true,
            assignedToUser: {
              select: { firstName: true, lastName: true, email: true },
            },
            clientId: true,
            client: { select: { name: true } },
            shipment: {
              select: {
                shipmentNumber: true,
                clientId: true,
                assignedBrokerId: true,
                assignedBroker: {
                  select: { firstName: true, lastName: true, email: true },
                },
                status: true,
                deletedAt: true,
                client: { select: { name: true } },
              },
            },
            _count: { select: { extractionFields: true } },
          },
          orderBy: buildDocumentOrderBy(query),
          skip: documentSkip(query),
          take: query.pageSize,
        }),
      ]);

      let pageResult: Awaited<ReturnType<typeof loadPage>>;
      try {
        pageResult = await loadPage(where);
      } catch (error) {
        // Keep search available during a rolling/local migration. The fallback
        // still searches persisted extraction fields, raw content, and all
        // repository metadata; the complete normalized projection joins it as
        // soon as the schema migration and generated client are current.
        if (!query.search || !isParsedSearchCompatibilityError(error)) throw error;
        console.warn(
          "GET /api/documents: parsedSearchText is unavailable; using legacy parsed-field search until migration 20260904220000_document_parsed_search is applied."
        );
        pageResult = await loadPage(
          buildDocumentWhereWithOptions(ctx.accountId, query, { includeParsedSearchText: false })
        );
      }

      const [total, documents] = pageResult;

      const documentIds = documents.map((doc) => doc.id);
      const associationCounts =
        documentIds.length > 0
          ? await db.documentAssociation.groupBy({
              by: ["documentId"],
              where: { accountId: ctx.accountId, documentId: { in: documentIds }, active: true },
              _count: { _all: true },
            })
          : [];
      const linkedCountByDocId = new Map(associationCounts.map((row) => [row.documentId, row._count._all]));

      return NextResponse.json({
        documents: documents.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          docType: doc.docType,
          documentType: doc.documentType ?? null,
          documentTypeConfidence: doc.documentTypeConfidence ?? null,
          status: doc.status,
          pageCount: doc.pageCount,
          confidence: doc.confidence,
          createdAt: doc.createdAt,
          shipmentId: doc.shipmentId,
          source: doc.source,
          channel: doc.channel,
          uploadedByUserId: doc.uploadedByUserId,
          uploadedByType: doc.uploadedByType,
          uploadedByName: doc.uploadedByName,
          uploadedByEmail: doc.uploadedByEmail,
          uploadedAt: doc.uploadedAt,
          channelMeta: doc.channelMeta,
          shipmentNumber: doc.shipment?.shipmentNumber ?? null,
          clientId: doc.clientId ?? doc.shipment?.clientId ?? null,
          clientName: doc.client?.name ?? doc.shipment?.client?.name ?? null,
          assignedBrokerId: doc.assignedToUserId ?? doc.shipment?.assignedBrokerId ?? null,
          assignedBroker: doc.assignedToUser ?? doc.shipment?.assignedBroker ?? null,
          shipmentStatus: doc.shipment?.status ?? null,
          shipmentDeleted: Boolean(doc.shipment?.deletedAt),
          extractedFieldCount: doc._count.extractionFields,
          linkedEntityCount: linkedCountByDocId.get(doc.id) ?? 0,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
        sort: query.sort,
        direction: query.direction,
      });
    });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

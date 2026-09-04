import { db } from "@/lib/db";
import { documentViewUrl } from "@/lib/documentUrl";
import {
  buildDocumentWhereWithOptions,
  isParsedSearchCompatibilityError,
  parseDocumentQuery,
} from "@/modules/documents/documentQuery";
import { normalizeIdentifier as partyNormalizeIdentifier } from "@/modules/party/partyNormalization";
import { partyDisplayName } from "@/modules/party/partyDisplay";
import {
  normalizeClassificationCode,
  normalizeIdentifier as productNormalizeIdentifier,
} from "@/modules/product/productNormalization";
import { PartyFactStatus, type Prisma } from "@prisma/client";

export interface UnifiedSearchInput {
  accountId: string;
  clientId?: string | null;
  query: string;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  kind: "party" | "product" | "document";
  title: string;
  subtitle: string;
  status: string;
  reviewStatus?: string | null;
  matchReason: string;
  sourceLabel: string;
  sourceDocumentId?: string | null;
  href: string;
  updatedAt: Date;
}

function includesIgnoreCase(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
}

function compactMatchValue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

export async function unifiedSearch(input: UnifiedSearchInput): Promise<{
  results: SearchResultItem[];
  total: number;
}> {
  const queryTrimmed = input.query.trim();
  if (!queryTrimmed) {
    return { results: [], total: 0 };
  }

  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const bucketLimit = Math.ceil(limit / 3);

  const containsInsensitive = { contains: queryTrimmed, mode: "insensitive" as const };

  // Party query construction
  const partyNormalizedId = partyNormalizeIdentifier(queryTrimmed);
  const partyWhere: Prisma.PartyWhereInput = {
    accountId: input.accountId,
    deletedAt: null,
    OR: [
      { internalPartyCode: containsInsensitive },
      { names: { some: { rawName: containsInsensitive, status: PartyFactStatus.ACTIVE } } },
      ...(partyNormalizedId !== ""
        ? [
            {
              identifiers: {
                some: { normalizedValue: { contains: partyNormalizedId }, status: PartyFactStatus.ACTIVE },
              },
            },
          ]
        : []),
    ],
  };

  // Product query construction
  const productNormalizedId = productNormalizeIdentifier(queryTrimmed);
  const productDigits = normalizeClassificationCode(queryTrimmed);

  const productWhere: Prisma.ProductWhereInput = {
    accountId: input.accountId,
    deletedAt: null,
    OR: [
      { productName: containsInsensitive },
      { internalSku: containsInsensitive },
      { brand: containsInsensitive },
      { model: containsInsensitive },
      { commercialDescription: containsInsensitive },
      { customsDescription: containsInsensitive },
      ...(productNormalizedId !== ""
        ? [{ identifiers: { some: { normalizedValue: { contains: productNormalizedId } } } }]
        : []),
      ...(productDigits.length >= 4
        ? [{ classifications: { some: { normalizedCode: { startsWith: productDigits } } } }]
        : []),
    ],
  };

  if (input.clientId === "unassigned") {
    partyWhere.clientId = null;
    productWhere.clientId = null;
  } else if (input.clientId) {
    partyWhere.clientId = input.clientId;
    productWhere.clientId = input.clientId;
  }

  const documentParams = new URLSearchParams({
    search: queryTrimmed,
    page: "1",
    pageSize: String(bucketLimit),
  });
  if (input.clientId) {
    documentParams.set("clientId", input.clientId === "unassigned" ? "UNASSIGNED" : input.clientId);
  }
  const documentQuery = parseDocumentQuery(documentParams);
  const loadDocuments = (where: Prisma.ShipmentDocumentWhereInput) => Promise.all([
    db.shipmentDocument.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        docType: true,
        status: true,
        uploadedByName: true,
        uploadedByEmail: true,
        updatedAt: true,
        shipment: { select: { shipmentNumber: true } },
        extractionFields: {
          where: {
            OR: [
              { fieldName: containsInsensitive },
              { value: containsInsensitive },
            ],
          },
          select: { fieldName: true, value: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: bucketLimit,
    }),
    db.shipmentDocument.count({ where }),
  ]);
  const documentSearch = loadDocuments(
    buildDocumentWhereWithOptions(input.accountId, documentQuery)
  ).catch((error) => {
    if (!isParsedSearchCompatibilityError(error)) throw error;
    console.warn(
      "Unified search: parsedSearchText is unavailable; using legacy parsed-field search until migration 20260904220000_document_parsed_search is applied."
    );
    return loadDocuments(
      buildDocumentWhereWithOptions(input.accountId, documentQuery, { includeParsedSearchText: false })
    );
  });

  // Execute database queries in parallel
  const [parties, partyCount, products, productCount, [documents, documentCount]] = await Promise.all([
    db.party.findMany({
      where: partyWhere,
      include: {
        names: { where: { status: PartyFactStatus.ACTIVE } },
        identifiers: { where: { status: PartyFactStatus.ACTIVE } },
        evidence: {
          where: { sourceDocumentId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            sourceDocumentId: true,
            sourceDocument: { select: { fileName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: bucketLimit,
    }),
    db.party.count({ where: partyWhere }),
    db.product.findMany({
      where: productWhere,
      include: {
        identifiers: true,
        classifications: true,
        evidence: {
          where: { sourceDocumentId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            sourceDocumentId: true,
            sourceDocument: { select: { fileName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: bucketLimit,
    }),
    db.product.count({ where: productWhere }),
    documentSearch,
  ]);

  const partyResults: SearchResultItem[] = parties.map((p) => {
    const evidence = p.evidence[0];
    const matchReason = p.names.some((name) => includesIgnoreCase(name.rawName, queryTrimmed))
      ? "Party name"
      : includesIgnoreCase(p.internalPartyCode, queryTrimmed)
        ? "Internal party code"
        : "Party identifier";
    return {
      id: p.id,
      kind: "party",
      title: partyDisplayName(p),
      subtitle: p.internalPartyCode ? `Code: ${p.internalPartyCode}` : "Party Record",
      status: p.status,
      reviewStatus: p.reviewStatus,
      matchReason,
      sourceLabel: evidence?.sourceDocument?.fileName ?? "Party master record",
      sourceDocumentId: evidence?.sourceDocumentId ?? null,
      href: `/app/parties/${p.id}?tab=evidence`,
      updatedAt: p.updatedAt,
    };
  });

  const productResults: SearchResultItem[] = products.map((prod) => {
    const evidence = prod.evidence[0];
    const matchReason = includesIgnoreCase(prod.productName, queryTrimmed)
      ? "Product name"
      : includesIgnoreCase(prod.internalSku, queryTrimmed)
        ? "Internal SKU"
        : [prod.brand, prod.model, prod.commercialDescription, prod.customsDescription]
            .some((value) => includesIgnoreCase(value, queryTrimmed))
          ? "Product description"
          : productDigits.length >= 4 && prod.classifications.some((classification) =>
              classification.normalizedCode.startsWith(productDigits)
            )
            ? "Tariff classification"
            : "Product identifier";
    return {
      id: prod.id,
      kind: "product",
      title: prod.productName,
      subtitle: prod.internalSku ? `SKU: ${prod.internalSku}` : "Product Record",
      status: prod.status,
      reviewStatus: prod.reviewStatus,
      matchReason,
      sourceLabel: evidence?.sourceDocument?.fileName ?? "Product master record",
      sourceDocumentId: evidence?.sourceDocumentId ?? null,
      href: `/app/products/${prod.id}?tab=evidence`,
      updatedAt: prod.updatedAt,
    };
  });

  const documentResults: SearchResultItem[] = documents.map((document) => {
    const field = document.extractionFields[0];
    const matchReason = field
      ? `${field.fieldName}: ${compactMatchValue(field.value)}`
      : includesIgnoreCase(document.fileName, queryTrimmed)
        ? "File name"
        : includesIgnoreCase(document.docType, queryTrimmed)
          ? "Document type"
          : includesIgnoreCase(document.uploadedByName, queryTrimmed) ||
              includesIgnoreCase(document.uploadedByEmail, queryTrimmed)
            ? "Uploader"
            : "Parsed document content";
    return {
      id: document.id,
      kind: "document",
      title: document.fileName,
      subtitle: document.shipment?.shipmentNumber
        ? `${document.docType} · ${document.shipment.shipmentNumber}`
        : document.docType,
      status: document.status,
      matchReason,
      sourceLabel: document.fileName,
      sourceDocumentId: document.id,
      href: documentViewUrl(document.id),
      updatedAt: document.updatedAt,
    };
  });

  // Interleave / sort merged results by updatedAt
  const combined = [...partyResults, ...productResults, ...documentResults].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return {
    results: combined.slice(0, limit),
    total: partyCount + productCount + documentCount,
  };
}

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
import { HybridMemoryRetriever } from "@/modules/memory/memory.retriever";
import { SearchIndexRepository, type SearchIndexSuggestion } from "@/modules/search/searchIndexRepository";
import { PartyFactStatus, type Prisma } from "@prisma/client";

export interface UnifiedSearchInput {
  accountId: string;
  clientId?: string | null;
  query: string;
  limit?: number;
  /** Skip the semantic "suggestions" lane (embedding call + vector query) -- callers that only need exact/lexical jump results can opt out of the extra cost. */
  includeSuggestions?: boolean;
}

export type SearchResultKind = "party" | "product" | "document" | "shipment" | "client" | "importer" | "person";

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
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

export type { SearchIndexSuggestion } from "@/modules/search/searchIndexRepository";

/**
 * Result ordering when kinds tie on match quality. A customs broker jumping
 * from the omnibox is most often chasing a specific shipment or the document
 * that just landed on it; reference/master records (client, importer, party)
 * are usually a secondary lookup once the shipment is already in view.
 */
const KIND_PRIORITY: Record<SearchResultKind, number> = {
  shipment: 7,
  document: 6,
  person: 5,
  product: 4,
  importer: 3,
  party: 3,
  client: 2,
};

function includesIgnoreCase(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
}

function compactMatchValue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

/** 3 = exact title match, 2 = title starts with the query, 1 = query merely appears somewhere, 0 = no title signal (matched on a different field entirely). */
function matchQuality(title: string, query: string): number {
  const t = title.toLocaleLowerCase();
  const q = query.toLocaleLowerCase();
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

function rankResults(items: SearchResultItem[], query: string, limit: number): SearchResultItem[] {
  return [...items]
    .sort((a, b) => {
      const scoreA = matchQuality(a.title, query) * 100 + KIND_PRIORITY[a.kind];
      const scoreB = matchQuality(b.title, query) * 100 + KIND_PRIORITY[b.kind];
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit);
}

export async function unifiedSearch(input: UnifiedSearchInput): Promise<{
  results: SearchResultItem[];
  suggestions: SearchIndexSuggestion[];
  total: number;
}> {
  const queryTrimmed = input.query.trim();
  if (!queryTrimmed) {
    return { results: [], suggestions: [], total: 0 };
  }

  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  // Every kind fetches up to the full limit, not an even split -- a query
  // that only matches parties (say 15 of them) used to be capped at ~1/3 of
  // the limit per kind regardless of how the matches were actually
  // distributed, silently dropping 2/3 of the display budget on kinds with
  // zero results. Ranking + slice below does the real allocation.
  const perKindLimit = limit;

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
    pageSize: String(perKindLimit),
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
      take: perKindLimit,
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

  // Shipment/client/importer/person only match on the columns the
  // 20260905090000 migration actually indexed (shipmentNumber/name/email
  // etc.) -- broader free-text over shipment attributes like importerName or
  // carrierName is handled by the semantic suggestions lane instead, which
  // doesn't need a live indexed column per field.
  const shipmentWhere: Prisma.ShipmentWhereInput = {
    accountId: input.accountId,
    deletedAt: null,
    shipmentNumber: containsInsensitive,
    ...(input.clientId === "unassigned"
      ? { clientId: null }
      : input.clientId
        ? { clientId: input.clientId }
        : {}),
  };

  const clientWhere: Prisma.ClientWhereInput = {
    accountId: input.accountId,
    name: containsInsensitive,
  };

  const importerWhere: Prisma.ImporterOfRecordWhereInput = {
    accountId: input.accountId,
    OR: [{ name: containsInsensitive }, { cbpImporterNumber: containsInsensitive }],
    ...(input.clientId === "unassigned"
      ? { clientId: null }
      : input.clientId
        ? { clientId: input.clientId }
        : {}),
  };

  const personWhere: Prisma.AccountMembershipWhereInput = {
    accountId: input.accountId,
    status: "ACTIVE",
    deletedAt: null,
    user: {
      OR: [
        { firstName: containsInsensitive },
        { lastName: containsInsensitive },
        { email: containsInsensitive },
      ],
    },
  };

  // Execute database queries in parallel
  const [
    parties,
    partyCount,
    products,
    productCount,
    [documents, documentCount],
    shipments,
    shipmentCount,
    clients,
    clientCount,
    importers,
    importerCount,
    people,
    personCount,
  ] = await Promise.all([
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
      take: perKindLimit,
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
      take: perKindLimit,
    }),
    db.product.count({ where: productWhere }),
    documentSearch,
    db.shipment.findMany({
      where: shipmentWhere,
      select: { id: true, shipmentNumber: true, status: true, updatedAt: true, client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: perKindLimit,
    }),
    db.shipment.count({ where: shipmentWhere }),
    db.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: perKindLimit,
    }),
    db.client.count({ where: clientWhere }),
    db.importerOfRecord.findMany({
      where: importerWhere,
      select: { id: true, name: true, cbpImporterNumber: true, registrationStatus: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: perKindLimit,
    }),
    db.importerOfRecord.count({ where: importerWhere }),
    db.accountMembership.findMany({
      where: personWhere,
      select: {
        userId: true,
        updatedAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      take: perKindLimit,
    }),
    db.accountMembership.count({ where: personWhere }),
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

  const shipmentResults: SearchResultItem[] = shipments.map((s) => ({
    id: s.id,
    kind: "shipment",
    title: s.shipmentNumber,
    subtitle: s.client?.name ?? "No client",
    status: s.status,
    matchReason: "Shipment number",
    sourceLabel: "Shipment record",
    href: `/app/shipments/${s.id}`,
    updatedAt: s.updatedAt,
  }));

  const clientResults: SearchResultItem[] = clients.map((c) => ({
    id: c.id,
    kind: "client",
    title: c.name,
    subtitle: "Client",
    status: c.status,
    matchReason: "Client name",
    sourceLabel: "Client record",
    href: `/app/clients/${c.id}`,
    updatedAt: c.updatedAt,
  }));

  const importerResults: SearchResultItem[] = importers.map((i) => ({
    id: i.id,
    kind: "importer",
    title: i.name,
    subtitle: i.cbpImporterNumber ? `CBP #: ${i.cbpImporterNumber}` : i.registrationStatus,
    status: i.registrationStatus,
    matchReason: includesIgnoreCase(i.name, queryTrimmed) ? "Importer name" : "CBP importer number",
    sourceLabel: "Importer of record",
    href: `/app/importers-of-record`,
    updatedAt: i.updatedAt,
  }));

  const personResults: SearchResultItem[] = people.map((m) => ({
    id: m.userId,
    kind: "person",
    title: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email,
    subtitle: m.user.email,
    status: "ACTIVE",
    matchReason: includesIgnoreCase(m.user.email, queryTrimmed) ? "Email" : "Name",
    sourceLabel: "Team member",
    // No shipment-list route currently reads an assignedBrokerId query param
    // (that filter is client-side-only state on ShipmentsWorkbenchClient), so
    // the only real, working destination for a person result is the admin
    // roster today.
    href: `/app/admin/users`,
    updatedAt: m.updatedAt,
  }));

  const combined = [
    ...partyResults,
    ...productResults,
    ...documentResults,
    ...shipmentResults,
    ...clientResults,
    ...importerResults,
    ...personResults,
  ];

  const results = rankResults(combined, queryTrimmed, limit);

  let suggestions: SearchIndexSuggestion[] = [];
  if (input.includeSuggestions !== false) {
    try {
      const embedding = await HybridMemoryRetriever.embedQuery(queryTrimmed);
      const rawSuggestions = await SearchIndexRepository.vectorSuggestions(embedding, limit, {
        accountId: input.accountId,
      });
      const shown = new Set(results.map((r) => `${r.kind}:${r.id}`));
      suggestions = rawSuggestions.filter((s) => !shown.has(`${s.kind}:${s.entityId}`)).slice(0, 8);
    } catch (error) {
      // Semantic suggestions are additive; a failure here (e.g. the search
      // index hasn't been backfilled yet, or the embedding call errors)
      // must never take down the exact/lexical results above.
      console.warn("Unified search: semantic suggestions unavailable", error);
    }
  }

  return {
    results,
    suggestions,
    total:
      partyCount + productCount + documentCount + shipmentCount + clientCount + importerCount + personCount,
  };
}

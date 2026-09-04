import { db } from "@/lib/db";
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
  kind: "party" | "product";
  title: string;
  subtitle: string;
  status: string;
  reviewStatus?: string | null;
  href: string;
  updatedAt: Date;
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
  const halfLimit = Math.ceil(limit / 2);

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

  // Execute database queries in parallel
  const [parties, partyCount, products, productCount] = await Promise.all([
    db.party.findMany({
      where: partyWhere,
      include: {
        names: { where: { status: PartyFactStatus.ACTIVE } },
      },
      orderBy: { updatedAt: "desc" },
      take: halfLimit,
    }),
    db.party.count({ where: partyWhere }),
    db.product.findMany({
      where: productWhere,
      orderBy: { updatedAt: "desc" },
      take: halfLimit,
    }),
    db.product.count({ where: productWhere }),
  ]);

  const partyResults: SearchResultItem[] = parties.map((p) => ({
    id: p.id,
    kind: "party",
    title: partyDisplayName(p),
    subtitle: p.internalPartyCode ? `Code: ${p.internalPartyCode}` : "Party Record",
    status: p.status,
    reviewStatus: p.reviewStatus,
    href: `/app/parties/${p.id}?tab=evidence`,
    updatedAt: p.updatedAt,
  }));

  const productResults: SearchResultItem[] = products.map((prod) => ({
    id: prod.id,
    kind: "product",
    title: prod.productName,
    subtitle: prod.internalSku ? `SKU: ${prod.internalSku}` : "Product Record",
    status: prod.status,
    reviewStatus: prod.reviewStatus,
    href: `/app/products/${prod.id}?tab=evidence`,
    updatedAt: prod.updatedAt,
  }));

  // Interleave / sort merged results by updatedAt
  const combined = [...partyResults, ...productResults].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return {
    results: combined.slice(0, limit),
    total: partyCount + productCount,
  };
}

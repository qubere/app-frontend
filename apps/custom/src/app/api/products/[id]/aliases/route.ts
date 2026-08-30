import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { productIdParamSchema } from "@/modules/product/productSchemas";

type Params = { id: string };

const createAliasBodySchema = z.object({
  canonicalProductId: z.string().min(1),
  aliasName: z.string().min(1).max(512),
  source: z.string().max(128).optional(),
});

export const GET = withAuthenticatedRoute<Params>(async ({ ctx, params, requestId }) => {
  const path = validatePathParams(params, productIdParamSchema, requestId);
  if ("response" in path) return path.response;

  const exists = await db.product.findFirst({
    where: { id: path.data.id, accountId: ctx.accountId, deletedAt: null },
    select: { id: true },
  });

  if (exists === null) {
    return buildErrorResponse(404, "PRODUCT_NOT_FOUND", "No such product.", undefined, requestId);
  }

  const canonicalProducts = await db.canonicalProduct.findMany({
    where: { productId: path.data.id, accountId: ctx.accountId },
    select: {
      id: true,
      canonicalName: true,
      sku: true,
      htsCode: true,
      aliases: {
        select: { id: true, aliasName: true, source: true, matchConfidence: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Approved classification decisions that could be promoted onto one of these
  // canonical records (and cascaded to this product) via
  // POST /api/v1/products/canonical/:id/bind-classification.
  const cpIds = canonicalProducts.map((c) => c.id);
  const decisions =
    cpIds.length === 0
      ? []
      : await db.classificationDecision.findMany({
          where: {
            decisionStatus: "APPROVED",
            case: {
              accountId: ctx.accountId,
              subjects: { some: { canonicalProductId: { in: cpIds } } },
            },
          },
          select: {
            id: true,
            attestedAt: true,
            approvedNode: { select: { htsNumberDisplay: true } },
            case: {
              select: {
                jurisdiction: true,
                subjects: { select: { canonicalProductId: true } },
              },
            },
          },
          orderBy: { attestedAt: "desc" },
        });

  const bindableByCp = new Map<string, { id: string; htsCode: string; jurisdiction: string; attestedAt: string }[]>();
  for (const decision of decisions) {
    const entry = {
      id: decision.id,
      htsCode: decision.approvedNode.htsNumberDisplay,
      jurisdiction: decision.case.jurisdiction ?? "US",
      attestedAt: decision.attestedAt.toISOString(),
    };
    for (const subject of decision.case.subjects) {
      if (subject.canonicalProductId === null || !cpIds.includes(subject.canonicalProductId)) continue;
      const list = bindableByCp.get(subject.canonicalProductId) ?? [];
      if (!list.some((d) => d.id === entry.id)) list.push(entry);
      bindableByCp.set(subject.canonicalProductId, list);
    }
  }

  return NextResponse.json({
    canonicalProducts: canonicalProducts.map((cp) => ({
      ...cp,
      bindableDecisions: bindableByCp.get(cp.id) ?? [],
    })),
    requestId,
  });
});

export const POST = withAuthenticatedRoute<Params>(
  async ({ req, ctx, params, requestId }) => {
    const path = validatePathParams(params, productIdParamSchema, requestId);
    if ("response" in path) return path.response;

    const body = await parseAndValidateBody(req, createAliasBodySchema, requestId);
    if ("response" in body) return body.response;

    const canonicalProduct = await db.canonicalProduct.findFirst({
      where: {
        id: body.data.canonicalProductId,
        productId: path.data.id,
        accountId: ctx.accountId,
      },
      select: { id: true },
});

    if (canonicalProduct === null) {
      return buildErrorResponse(
        404,
        "CANONICAL_PRODUCT_NOT_FOUND",
        "No such canonical product linked to this product.",
        undefined,
        requestId
      );
    }

    const duplicate = await db.productAlias.findFirst({
      where: { canonicalProductId: body.data.canonicalProductId, aliasName: body.data.aliasName },
      select: { id: true },
    });

    if (duplicate !== null) {
      return buildErrorResponse(
        409,
        "ALIAS_ALREADY_EXISTS",
        "This alias already exists on this canonical product.",
        undefined,
        requestId
      );
    }

    const alias = await db.productAlias.create({
      data: {
        canonicalProductId: body.data.canonicalProductId,
        aliasName: body.data.aliasName,
        source: body.data.source ?? "User Entry",
        matchConfidence: 100,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "product.alias.create",
      entity: "ProductAlias",
      entityId: alias.id,
      metadata: { productId: path.data.id, canonicalProductId: body.data.canonicalProductId, aliasName: body.data.aliasName },
    });

    return NextResponse.json({ alias, requestId });
  
}, { permission: "products.edit", write: true });

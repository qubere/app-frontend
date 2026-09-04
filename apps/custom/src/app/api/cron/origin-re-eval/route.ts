import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db, runWithAccountId } from "@/lib/db";
import { reevaluateProductLineItems } from "@/lib/origin/originReEvalService";

export const maxDuration = 300;

async function handleReevaluation(req: Request, requestId: string) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");

  if (productId) {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const res = await runWithAccountId(product.accountId, () =>
      reevaluateProductLineItems(product.id, product.accountId)
    );
    return NextResponse.json({ status: "COMPLETED", productId, ...res, requestId });
  }

  // Sweep products updated in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const updatedFacts = await db.productCountryFact.findMany({
    where: { updatedAt: { gte: oneDayAgo } },
    select: { productId: true, accountId: true },
  });

  const uniqueProducts = Array.from(new Set(updatedFacts.map((f) => `${f.productId}:${f.accountId}`)));
  let totalEvaluated = 0;
  let totalUpdated = 0;

  for (const item of uniqueProducts) {
    const [pId, aId] = item.split(":");
    const res = await runWithAccountId(aId, () => reevaluateProductLineItems(pId, aId));
    totalEvaluated += res.evaluatedLineItems;
    totalUpdated += res.updatedDeterminations;
  }

  return NextResponse.json({
    status: "COMPLETED",
    productsProcessed: uniqueProducts.length,
    totalEvaluated,
    totalUpdated,
    requestId,
  });
}

export const GET = withCronRoute(async ({ req, requestId }) => {
  return handleReevaluation(req, requestId);
});

export const POST = withCronRoute(async ({ req, requestId }) => {
  return handleReevaluation(req, requestId);
});

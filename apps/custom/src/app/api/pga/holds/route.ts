import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { DomainError } from "@/lib/api/error";
import { listHolds, recordHold } from "@/lib/pga/holdService";
import { z } from "zod";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams;
  const page = z.coerce.number().int().min(0).max(10000).parse(q.get("page") ?? 0);
  if ((q.has("agency") || q.has("importer") || q.has("sort")) && !await hasPermission("pga.review")) throw new DomainError("PGA review permission is required for portfolio filters.", "FORBIDDEN", 403);
  return NextResponse.json(await listHolds(ctx.accountId, { shipmentId: q.get("shipmentId") || undefined, agency: q.get("agency") || undefined, importer: q.get("importer")?.slice(0,200) || undefined, page, oldestFirst: q.get("sort") !== "newest" }));
}, { permission: "pga.read" });
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => NextResponse.json({ hold: await recordHold(ctx.accountId, ctx.userId, await req.json()) }, { status: 201 }), { permission: "pga.update", write: true });

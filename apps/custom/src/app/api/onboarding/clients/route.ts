import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

// Small, searchable options for onboarding; no shipments or billing records.
export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100);
  const clients = await db.client.findMany({
    where: { accountId: ctx.accountId, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    select: { id: true, name: true, contactEmail: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 50,
  });
  return NextResponse.json({ clients }, { headers: { "Cache-Control": "no-store" } });
}, { permission: "onboarding.manage" });

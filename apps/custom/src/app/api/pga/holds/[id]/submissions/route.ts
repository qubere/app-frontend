import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { DomainError } from "@/lib/api/error";
import { db } from "@/lib/db";
import { z } from "zod";

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const page = z.coerce.number().int().min(0).max(10000).parse(new URL(req.url).searchParams.get("page") ?? 0);
  const hold = await db.pgaHold.findFirst({
    where: { id: params.id, accountId: ctx.accountId, shipment: { accountId: ctx.accountId, deletedAt: null } },
    select: { id: true },
  });
  if (!hold) throw new DomainError("Hold not found.", "NOT_FOUND", 404);
  const where = { accountId: ctx.accountId, pgaHoldId: hold.id };
  const [submissions, total] = await Promise.all([
    db.pgaHoldSubmission.findMany({ where, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 20, skip: page * 20 }),
    db.pgaHoldSubmission.count({ where }),
  ]);
  return NextResponse.json({ submissions, total, page });
}, { permission: "pga.read" });

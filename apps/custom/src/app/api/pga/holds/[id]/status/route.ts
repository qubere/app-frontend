import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/api/error";
import { holdResponseSchema } from "@/lib/pga/holdContracts";
import { recordAgencyResponse } from "@/lib/pga/holdService";
export const GET = withAuthenticatedRoute<{id: string}>(async ({ ctx, params }) => {
  const hold = await db.pgaHold.findFirst({ where: { id: params.id, accountId: ctx.accountId, shipment: { accountId: ctx.accountId, deletedAt: null } }, select: { id: true, status: true, version: true, closedAt: true } });
  if (!hold) throw new DomainError("Hold not found.", "NOT_FOUND", 404);
  return NextResponse.json({ hold, livePolling: false, source: "Recorded agency evidence" });
}, { permission: "pga.read" });
// Until live transport exists, changes require an operator and original evidence.
// GET polls never manufacture acceptance or interpret a carrier release as a PGA release.
export const PATCH = withAuthenticatedRoute<{id: string}>(async ({ req, ctx, params }) =>
  NextResponse.json(await recordAgencyResponse(ctx.accountId, ctx.userId, params.id, holdResponseSchema.parse(await req.json()))),
{ permission: "pga.approve", write: true });

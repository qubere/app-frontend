/**
 * POST /api/compliance/licenses/[id]/parties -- attach a Party to a license (or one of its lines) with a role.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const createPartySchema = z.object({
  partyId: z.string().min(1),
  role: z.enum(["PURCHASER", "END_USER", "CONSIGNEE", "LICENSEE", "OTHER"]),
  lineId: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = createPartySchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const license = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!license) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }
    const party = await db.party.findFirst({ where: { id: parsed.data.partyId, accountId: ctx.accountId } });
    if (!party) {
      return buildErrorResponse(404, "NOT_FOUND", "Party not found.", undefined, requestId);
    }

    const licenseParty = await db.licenseParty.create({
      data: {
        accountId: ctx.accountId,
        licenseId: license.id,
        lineId: parsed.data.lineId ?? null,
        partyId: party.id,
        role: parsed.data.role,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_PARTY_ATTACHED",
      entity: "LicenseParty",
      entityId: licenseParty.id,
      source: "UI",
      metadata: { licenseId: license.id, partyId: party.id, role: parsed.data.role },
    });

    return NextResponse.json({ licenseParty, requestId }, { status: 201 });
  },
  { permission: "licenses.manage_parties", write: true }
);

/**
 * POST /api/v1/parties/[partyId]/restricted-party-screening/pre-approval
 *
 * Grants Party-level Pre-Approval: an explicit, reviewer-issued permission to
 * reuse this Party's already-satisfied Restricted Party Screening obligation
 * in eligible reuse contexts (see preApproval.ts), for the party's *current*
 * identity snapshot only. Distinct from a candidate-level FALSE_POSITIVE
 * disposition (see the /disposition route) -- the two are never conflated.
 * Requires `compliance.restricted_party.approve` (stronger than ordinary
 * party-create authority).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import {
  createPreApproval,
  PartyNotFoundForApprovalError,
  PartyHasNoActiveIdentityForApprovalError,
} from "@/modules/agents/compliance/restrictedParty/preApproval";

const paramsSchema = z.object({ partyId: z.string().min(1) });

const bodySchema = z.object({
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  sourceScreeningResultId: z.string().optional(),
});

export const POST = withAuthenticatedRoute<{ partyId: string }>(
  async ({ ctx, req, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;

    const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;

    const party = await db.party.findFirst({ where: { id: paramsVal.data.partyId, accountId: ctx.accountId }, select: { id: true } });
    if (!party) {
      return NextResponse.json({ error: "Party not found", requestId }, { status: 404 });
    }

    try {
      const approval = await createPreApproval({
        accountId: ctx.accountId,
        partyId: party.id,
        approvedByUserId: ctx.userId,
        reason: bodyVal.data.reason ?? null,
        expiresAt: bodyVal.data.expiresAt ? new Date(bodyVal.data.expiresAt) : null,
        sourceScreeningResultId: bodyVal.data.sourceScreeningResultId ?? null,
        requestId,
      });

      return NextResponse.json({ success: true, approval, requestId }, { status: 201 });
    } catch (error) {
      if (error instanceof PartyNotFoundForApprovalError) {
        return NextResponse.json({ error: error.message, requestId }, { status: 404 });
      }
      if (error instanceof PartyHasNoActiveIdentityForApprovalError) {
        return NextResponse.json({ error: error.message, requestId }, { status: 422 });
      }
      throw error;
    }
  },
  { permission: "compliance.restricted_party.approve", write: true }
);

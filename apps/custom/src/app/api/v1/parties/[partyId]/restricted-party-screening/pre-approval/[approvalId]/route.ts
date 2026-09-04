/**
 * PATCH /api/v1/parties/[partyId]/restricted-party-screening/pre-approval/[approvalId]
 *
 * Revokes a Party-level Pre-Approval. Revocation is a one-way transition
 * (PRE_APPROVED -> REVOKED); approval history is never rewritten or deleted.
 * Requires `compliance.restricted_party.revoke` (stronger than ordinary
 * party-create authority).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { revokePreApproval, PreApprovalNotFoundError } from "@/modules/agents/compliance/restrictedParty/preApproval";

const paramsSchema = z.object({ partyId: z.string().min(1), approvalId: z.string().min(1) });

const bodySchema = z.object({ reason: z.string().optional() });

export const PATCH = withAuthenticatedRoute<{ partyId: string; approvalId: string }>(
  async ({ ctx, req, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;

    const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;

    const approval = await db.partyScreeningApproval.findFirst({
      where: { id: paramsVal.data.approvalId, accountId: ctx.accountId, partyId: paramsVal.data.partyId },
      select: { id: true },
    });
    if (!approval) {
      return NextResponse.json({ error: "Pre-approval not found", requestId }, { status: 404 });
    }

    try {
      const revoked = await revokePreApproval({
        accountId: ctx.accountId,
        approvalId: approval.id,
        revokedByUserId: ctx.userId,
        reason: bodyVal.data.reason ?? null,
        requestId,
      });

      return NextResponse.json({ success: true, approval: revoked, requestId }, { status: 200 });
    } catch (error) {
      if (error instanceof PreApprovalNotFoundError) {
        return NextResponse.json({ error: error.message, requestId }, { status: 404 });
      }
      throw error;
    }
  },
  { permission: "compliance.restricted_party.revoke", write: true }
);

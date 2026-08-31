import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export const POST = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    try {
      const profile = await db.brokerComplianceProfile.upsert({
        where: { accountId: ctx.accountId },
        create: {
          accountId: ctx.accountId,
          responsibleSupervisionAttestedByUserId: ctx.userId,
          responsibleSupervisionAttestedAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          responsibleSupervisionAttestedByUserId: ctx.userId,
          responsibleSupervisionAttestedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerComplianceProfile",
        entityId: profile.id,
        source: "UI",
        metadata: { attestationType: "responsible_supervision_19cfr111" },
      });

      return NextResponse.json({ profile, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to record attestation", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

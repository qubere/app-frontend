import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const pqoSchema = z.object({
  name: z.string().min(1),
  individualLicenseNumber: z.string().min(1),
  districts: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, pqoSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const data = bodyVal.data;

    try {
      const profile = await db.brokerComplianceProfile.upsert({
        where: { accountId: ctx.accountId },
        create: { accountId: ctx.accountId, updatedAt: new Date() },
        update: {},
      });

      const pqo = await db.brokerPQO.create({
        data: {
          profileId: profile.id,
          name: data.name,
          individualLicenseNumber: data.individualLicenseNumber,
          districts: data.districts,
          active: data.active,
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerPQO",
        entityId: pqo.id,
        source: "UI",
        metadata: { action: "create", name: data.name },
      });

      return NextResponse.json({ pqo, requestId }, { status: 201 });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to add PQO", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

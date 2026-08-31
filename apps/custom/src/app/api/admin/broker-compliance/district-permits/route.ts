import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const permitSchema = z.object({
  districtCode: z.string().min(1),
  permitNumber: z.string().nullable().optional(),
  status: z.enum(["active", "pending", "suspended"]).default("active"),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, permitSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const data = bodyVal.data;

    try {
      const profile = await db.brokerComplianceProfile.upsert({
        where: { accountId: ctx.accountId },
        create: { accountId: ctx.accountId, updatedAt: new Date() },
        update: {},
      });

      const permit = await db.brokerDistrictPermit.upsert({
        where: { profileId_districtCode: { profileId: profile.id, districtCode: data.districtCode } },
        create: {
          profileId: profile.id,
          districtCode: data.districtCode,
          permitNumber: data.permitNumber ?? null,
          status: data.status,
        },
        update: {
          permitNumber: data.permitNumber ?? null,
          status: data.status,
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerDistrictPermit",
        entityId: permit.id,
        source: "UI",
        metadata: { districtCode: data.districtCode },
      });

      return NextResponse.json({ permit, requestId }, { status: 201 });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to save district permit", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

export const DELETE = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const districtCode = String(body.districtCode ?? "");
    if (!districtCode) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "districtCode required", undefined, requestId);
    }

    try {
      const profile = await db.brokerComplianceProfile.findUnique({ where: { accountId: ctx.accountId } });
      if (!profile) return buildErrorResponse(404, "NOT_FOUND", "Profile not found", undefined, requestId);

      await db.brokerDistrictPermit.deleteMany({
        where: { profileId: profile.id, districtCode },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerDistrictPermit",
        entityId: profile.id,
        source: "UI",
        metadata: { action: "delete", districtCode },
      });

      return NextResponse.json({ deleted: true, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to delete permit", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

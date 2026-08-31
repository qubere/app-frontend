import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  active: z.boolean().optional(),
  districts: z.array(z.string()).optional(),
  individualLicenseNumber: z.string().optional(),
});

export const PATCH = withAuthenticatedRoute(
  async ({ req, ctx, requestId, params }) => {
    const pqoId = (params as Record<string, string>).pqoId;
    const bodyVal = await parseAndValidateBody(req, patchSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const data = bodyVal.data;

    try {
      const pqo = await db.brokerPQO.findFirst({
        where: { id: pqoId },
        include: { profile: { select: { accountId: true } } },
      });
      if (!pqo || pqo.profile.accountId !== ctx.accountId) {
        return buildErrorResponse(404, "NOT_FOUND", "PQO not found", undefined, requestId);
      }

      const updated = await db.brokerPQO.update({
        where: { id: pqoId },
        data: {
          ...(data.active !== undefined && { active: data.active }),
          ...(data.districts !== undefined && { districts: data.districts }),
          ...(data.individualLicenseNumber !== undefined && { individualLicenseNumber: data.individualLicenseNumber }),
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerPQO",
        entityId: pqoId,
        source: "UI",
        metadata: { action: "patch", ...data },
      });

      return NextResponse.json({ pqo: updated, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to update PQO", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

export const DELETE = withAuthenticatedRoute(
  async ({ ctx, requestId, params }) => {
    const pqoId = (params as Record<string, string>).pqoId;

    try {
      const pqo = await db.brokerPQO.findFirst({
        where: { id: pqoId },
        include: { profile: { select: { accountId: true } } },
      });
      if (!pqo || pqo.profile.accountId !== ctx.accountId) {
        return buildErrorResponse(404, "NOT_FOUND", "PQO not found", undefined, requestId);
      }

      await db.brokerPQO.delete({ where: { id: pqoId } });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerPQO",
        entityId: pqoId,
        source: "UI",
        metadata: { action: "delete" },
      });

      return NextResponse.json({ deleted: true, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to delete PQO", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

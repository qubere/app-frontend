import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const profileSchema = z.object({
  licenseType: z.enum(["INDIVIDUAL", "CORPORATE", "PARTNERSHIP"]).optional(),
  brokerLicenseNumber: z.string().nullable().optional(),
  nationalPermitNumber: z.string().nullable().optional(),
  nationalPermitStatus: z.enum(["none", "pending", "active", "suspended", "revoked"]).optional(),
  filerCode: z.string().nullable().optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const profile = await db.brokerComplianceProfile.findUnique({
      where: { accountId: ctx.accountId },
      include: { permitQualifyingOfficers: true, districtPermits: true },
    });
    return NextResponse.json({ profile, requestId });
  },
  { permission: "broker_compliance.manage" }
);

export const PUT = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, profileSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const data = bodyVal.data;

    try {
      const existing = await db.brokerComplianceProfile.findUnique({ where: { accountId: ctx.accountId } });

      const profileData = {
        ...(data.licenseType && { licenseType: data.licenseType }),
        ...(data.brokerLicenseNumber !== undefined && { brokerLicenseNumber: data.brokerLicenseNumber }),
        ...(data.nationalPermitNumber !== undefined && { nationalPermitNumber: data.nationalPermitNumber }),
        ...(data.nationalPermitStatus && { nationalPermitStatus: data.nationalPermitStatus }),
        ...(data.filerCode !== undefined && { filerCode: data.filerCode }),
        updatedAt: new Date(),
      };

      // Compute status
      const permitStatus = data.nationalPermitStatus ?? existing?.nationalPermitStatus ?? "none";
      const hasLicense = !!(data.brokerLicenseNumber ?? existing?.brokerLicenseNumber);
      const status = hasLicense && permitStatus === "active" ? "ready" : "incomplete";

      const profile = await db.brokerComplianceProfile.upsert({
        where: { accountId: ctx.accountId },
        create: {
          accountId: ctx.accountId,
          ...profileData,
          status,
        },
        update: { ...profileData, status },
        include: { permitQualifyingOfficers: true, districtPermits: true },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "BROKER_COMPLIANCE_UPDATED",
        entity: "BrokerComplianceProfile",
        entityId: profile.id,
        source: "UI",
        metadata: data as Record<string, unknown>,
      });

      return NextResponse.json({ profile, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to save profile", undefined, requestId);
    }
  },
  { permission: "broker_compliance.manage", write: true }
);

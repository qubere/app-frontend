/**
 * GET/PATCH /api/compliance/restricted-party-screening/notification-settings
 *
 * Account-scoped RPS email notification preferences (AccountScreeningConfig's
 * rps* fields). GET requires read access to RPS settings; PATCH requires
 * compliance.restrictedParty.settings.manage. No credential/provider fields
 * are ever exposed here -- delivery provider is configured platform-wide via
 * environment variables (see modules/email/emailConfig.ts), not per-account.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { normalizeRecipientList } from "@/modules/compliance/notifications/recipients";

const patchSchema = z.object({
  rpsEmailAlertsEnabled: z.boolean().optional(),
  rpsGeneralRecipients: z.array(z.string()).optional(),
  rpsHitRecipients: z.array(z.string()).optional(),
  rpsPalRescreenRecipients: z.array(z.string()).optional(),
  rpsEmailFormat: z.enum(["HTML", "TEXT"]).optional(),
  rpsSecureEmailEnabled: z.boolean().optional(),
  rpsSuppressEmailAlerts: z.boolean().optional(),
});

function toSettingsView(config: {
  rpsEmailAlertsEnabled: boolean | null;
  rpsGeneralRecipients: string[];
  rpsHitRecipients: string[];
  rpsPalRescreenRecipients: string[];
  rpsEmailFormat: string | null;
  rpsSecureEmailEnabled: boolean | null;
  rpsSuppressEmailAlerts: boolean | null;
} | null) {
  return {
    rpsEmailAlertsEnabled: config?.rpsEmailAlertsEnabled ?? false,
    rpsGeneralRecipients: config?.rpsGeneralRecipients ?? [],
    rpsHitRecipients: config?.rpsHitRecipients ?? [],
    rpsPalRescreenRecipients: config?.rpsPalRescreenRecipients ?? [],
    rpsEmailFormat: config?.rpsEmailFormat ?? "HTML",
    rpsSecureEmailEnabled: config?.rpsSecureEmailEnabled ?? false,
    rpsSuppressEmailAlerts: config?.rpsSuppressEmailAlerts ?? false,
  };
}

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const config = await db.accountScreeningConfig.findUnique({ where: { accountId: ctx.accountId } });
    return NextResponse.json({ settings: toSettingsView(config), requestId });
  },
  { permission: "compliance.restrictedParty.settings.manage" }
);

export const PATCH = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues, requestId }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await db.accountScreeningConfig.findUnique({ where: { accountId: ctx.accountId } });
    const before = toSettingsView(existing);

    const generalRecipients = data.rpsGeneralRecipients !== undefined ? normalizeRecipientList(data.rpsGeneralRecipients) : undefined;
    const hitRecipients = data.rpsHitRecipients !== undefined ? normalizeRecipientList(data.rpsHitRecipients) : undefined;
    const palRecipients = data.rpsPalRescreenRecipients !== undefined ? normalizeRecipientList(data.rpsPalRescreenRecipients) : undefined;

    const alertsEnabled = data.rpsEmailAlertsEnabled ?? existing?.rpsEmailAlertsEnabled ?? false;
    if (alertsEnabled) {
      const effectiveHit = hitRecipients ?? existing?.rpsHitRecipients ?? [];
      const effectivePal = palRecipients ?? existing?.rpsPalRescreenRecipients ?? [];
      const effectiveGeneral = generalRecipients ?? existing?.rpsGeneralRecipients ?? [];
      if (effectiveHit.length === 0 && effectivePal.length === 0 && effectiveGeneral.length === 0) {
        return NextResponse.json(
          { error: "At least one recipient list must be non-empty to enable RPS email alerts.", requestId },
          { status: 400 }
        );
      }
    }

    const updateData = {
      ...data,
      ...(generalRecipients !== undefined ? { rpsGeneralRecipients: generalRecipients } : {}),
      ...(hitRecipients !== undefined ? { rpsHitRecipients: hitRecipients } : {}),
      ...(palRecipients !== undefined ? { rpsPalRescreenRecipients: palRecipients } : {}),
    };

    const updated = await db.accountScreeningConfig.upsert({
      where: { accountId: ctx.accountId },
      create: { accountId: ctx.accountId, ...updateData },
      update: updateData,
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.RPS_NOTIFICATION_SETTINGS_UPDATED,
      entity: "AccountScreeningConfig",
      entityId: updated.id,
      source: "UI",
      beforeJson: before,
      afterJson: toSettingsView(updated),
      requestId,
    });

    return NextResponse.json({ settings: toSettingsView(updated), requestId });
  },
  { permission: "compliance.restrictedParty.settings.manage", write: true }
);

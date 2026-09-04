import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const [sla, rules, recentEvents] = await Promise.all([
    db.slaPolicy.findMany({
      where: { accountId: ctx.accountId },
      orderBy: [{ workKind: "asc" }, { priority: "asc" }],
    }),
    db.escalationRule.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.escalationEvent.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ sla, rules, recentEvents });
}, { permission: "settings.manage" });

export const PUT = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const { sla, rules } = body;

  const upsertedSla = [];
  const upsertedRules = [];

  if (Array.isArray(sla)) {
    for (const s of sla) {
      if (!s.workKind) continue;
      const row = await db.slaPolicy.upsert({
        where: {
          accountId_workKind_priority: {
            accountId: ctx.accountId,
            workKind: s.workKind,
            priority: s.priority || null,
          },
        },
        create: {
          accountId: ctx.accountId,
          workKind: s.workKind,
          priority: s.priority || null,
          reviewHours: Number(s.reviewHours || 4),
          resolveHours: s.resolveHours ? Number(s.resolveHours) : null,
          businessHoursOnly: s.businessHoursOnly ?? true,
        },
        update: {
          reviewHours: Number(s.reviewHours || 4),
          resolveHours: s.resolveHours ? Number(s.resolveHours) : null,
          businessHoursOnly: s.businessHoursOnly ?? true,
        },
      });
      upsertedSla.push(row);
    }
  }

  if (Array.isArray(rules)) {
    for (const r of rules) {
      const data = {
        appliesToKinds: Array.isArray(r.appliesToKinds) ? r.appliesToKinds : ["decision", "exception"],
        trigger: r.trigger || "SLA_BREACH",
        thresholdHours: Number(r.thresholdHours || 2),
        escalateTo: r.escalateTo || "TEAM_MANAGER",
        maxLevel: Number(r.maxLevel || 2),
        notifyChannel: r.notifyChannel || "both",
        active: r.active ?? true,
      };

      if (r.id) {
        // Scope the update to this account; updateMany returns count 0 rather
        // than throwing when the id belongs to another account.
        const res = await db.escalationRule.updateMany({
          where: { id: r.id, accountId: ctx.accountId },
          data,
        });
        if (res.count > 0) {
          const updated = await db.escalationRule.findUnique({ where: { id: r.id } });
          if (updated) upsertedRules.push(updated);
        }
      } else {
        const created = await db.escalationRule.create({
          data: { accountId: ctx.accountId, ...data },
        });
        upsertedRules.push(created);
      }
    }
  }

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "ESCALATION_RULES_UPDATED",
    entity: "EscalationRule",
    entityId: ctx.accountId,
    source: "UI",
    metadata: { slaCount: upsertedSla.length, ruleCount: upsertedRules.length },
    success: true,
  });

  return NextResponse.json({ sla: upsertedSla, rules: upsertedRules });
}, { permission: "settings.manage", write: true });

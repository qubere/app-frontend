import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sla, rules, recentEvents] = await Promise.all([
    db.slaPolicy.findMany({
      where: { accountId: context.accountId },
      orderBy: [{ workKind: "asc" }, { priority: "asc" }],
    }),
    db.escalationRule.findMany({
      where: { accountId: context.accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.escalationEvent.findMany({
      where: { accountId: context.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ sla, rules, recentEvents });
}

export async function PUT(request: NextRequest) {
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sla, rules } = body;

  const upsertedSla = [];
  const upsertedRules = [];

  if (Array.isArray(sla)) {
    for (const s of sla) {
      if (!s.workKind) continue;
      const row = await db.slaPolicy.upsert({
        where: {
          accountId_workKind_priority: {
            accountId: context.accountId,
            workKind: s.workKind,
            priority: s.priority || null,
          },
        },
        create: {
          accountId: context.accountId,
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
      if (r.id) {
        const updated = await db.escalationRule.update({
          where: { id: r.id, accountId: context.accountId },
          data: {
            appliesToKinds: r.appliesToKinds || ["decision", "exception"],
            trigger: r.trigger || "SLA_BREACH",
            thresholdHours: Number(r.thresholdHours || 2),
            escalateTo: r.escalateTo || "TEAM_MANAGER",
            maxLevel: Number(r.maxLevel || 2),
            notifyChannel: r.notifyChannel || "both",
            active: r.active ?? true,
          },
        });
        upsertedRules.push(updated);
      } else {
        const created = await db.escalationRule.create({
          data: {
            accountId: context.accountId,
            appliesToKinds: r.appliesToKinds || ["decision", "exception"],
            trigger: r.trigger || "SLA_BREACH",
            thresholdHours: Number(r.thresholdHours || 2),
            escalateTo: r.escalateTo || "TEAM_MANAGER",
            maxLevel: Number(r.maxLevel || 2),
            notifyChannel: r.notifyChannel || "both",
            active: r.active ?? true,
          },
        });
        upsertedRules.push(created);
      }
    }
  }

  return NextResponse.json({ sla: upsertedSla, rules: upsertedRules });
}

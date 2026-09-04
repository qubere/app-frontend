import { db } from "@/lib/db";
import { notify } from "@/modules/notifications/notify";

export interface SlaSweepResult {
  breachedDecisions: number;
  breachedExceptions: number;
  escalationsCreated: number;
  atRiskWarnings: number;
}

/**
 * How far ahead of an SLA deadline an assigned, untouched item earns a
 * one-time "heads up" notification to its assignee. Deliberately short -- a
 * broker wants the nudge when there is still time to act, not days out.
 */
const AT_RISK_LEAD_MS = 4 * 60 * 60 * 1000;

/**
 * Runs periodic SLA sweep across open decisions and exceptions.
 * Marks SLA breaches, evaluates active EscalationRule entries, bumps escalation levels,
 * assigns work items to escalated target users, creates EscalationEvents, and fires Notifications.
 */
export async function runSlaSweep(accountId?: string): Promise<SlaSweepResult> {
  const now = new Date();
  const accountFilter = accountId ? { accountId } : {};

  // 1. Find open decisions with reviewSlaDueAt past now and not yet marked breached
  const unbreachedDecisions = await db.agentDecision.findMany({
    where: {
      ...accountFilter,
      triageState: "NEEDS_REVIEW",
      reviewSlaDueAt: { lte: now },
      slaBreachedAt: null,
      firstTouchedAt: null,
    },
    select: { id: true, accountId: true },
  });

  for (const d of unbreachedDecisions) {
    await db.agentDecision.update({
      where: { id: d.id },
      data: { slaBreachedAt: now },
    });
  }

  // 2. Find open exceptions with slaDueAt past now and not yet marked breached
  const unbreachedExceptions = await db.exceptionItem.findMany({
    where: {
      ...accountFilter,
      status: "Open",
      slaDueAt: { lte: now },
      slaBreachedAt: null,
      firstTouchedAt: null,
    },
    select: { id: true, accountId: true },
  });

  for (const e of unbreachedExceptions) {
    await db.exceptionItem.update({
      where: { id: e.id },
      data: { slaBreachedAt: now },
    });
  }

  // 2b. Warn the assignee of an item that is assigned, untouched, and within
  // AT_RISK_LEAD_MS of its SLA deadline -- once (notify() dedupes on the
  // (account, user, type, entity) tuple, so repeated sweeps do not re-nag).
  const atRiskCutoff = new Date(now.getTime() + AT_RISK_LEAD_MS);
  let atRiskWarnings = 0;

  const [atRiskDecisions, atRiskExceptions] = await Promise.all([
    db.agentDecision.findMany({
      where: {
        ...accountFilter,
        triageState: "NEEDS_REVIEW",
        slaBreachedAt: null,
        firstTouchedAt: null,
        assignedToUserId: { not: null },
        reviewSlaDueAt: { gt: now, lte: atRiskCutoff },
      },
      select: {
        id: true,
        accountId: true,
        assignedToUserId: true,
        reviewSlaDueAt: true,
        agentName: true,
        shipment: { select: { shipmentNumber: true } },
      },
    }),
    db.exceptionItem.findMany({
      where: {
        ...accountFilter,
        status: "Open",
        slaBreachedAt: null,
        firstTouchedAt: null,
        assignedToUserId: { not: null },
        slaDueAt: { gt: now, lte: atRiskCutoff },
      },
      select: {
        id: true,
        accountId: true,
        assignedToUserId: true,
        slaDueAt: true,
        description: true,
        shipment: { select: { shipmentNumber: true } },
      },
    }),
  ]);

  const hoursUntil = (due: Date) => Math.max(1, Math.round((due.getTime() - now.getTime()) / 3_600_000));

  for (const d of atRiskDecisions) {
    const res = await notify({
      accountId: d.accountId,
      userId: d.assignedToUserId!,
      type: "SLA_AT_RISK",
      message: `${d.agentName} on ${d.shipment?.shipmentNumber ?? "a shipment"} — review SLA due in ~${hoursUntil(d.reviewSlaDueAt!)}h`,
      entityType: "AgentDecision",
      entityId: d.id,
      dedupe: true,
    });
    if (res.created) atRiskWarnings += 1;
  }

  for (const e of atRiskExceptions) {
    const res = await notify({
      accountId: e.accountId,
      userId: e.assignedToUserId!,
      type: "SLA_AT_RISK",
      message: `Exception on ${e.shipment?.shipmentNumber ?? "a shipment"} — SLA due in ~${hoursUntil(e.slaDueAt!)}h: ${e.description}`,
      entityType: "ExceptionItem",
      entityId: e.id,
      dedupe: true,
    });
    if (res.created) atRiskWarnings += 1;
  }

  let escalationsCreated = 0;

  // 3. Evaluate active EscalationRules for accounts
  const activeRules = await db.escalationRule.findMany({
    where: {
      ...accountFilter,
      active: true,
      trigger: "SLA_BREACH",
    },
    include: {
      account: { select: { id: true, ownerUserId: true } },
    },
  });

  for (const rule of activeRules) {
    const thresholdMs = rule.thresholdHours * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - thresholdMs);

    // Evaluate decisions matching rule
    if (rule.appliesToKinds.includes("decision")) {
      const decisionCandidates = await db.agentDecision.findMany({
        where: {
          accountId: rule.accountId,
          triageState: "NEEDS_REVIEW",
          reviewSlaDueAt: { lte: cutoff },
          escalationLevel: { lt: rule.maxLevel },
          // Wait a full thresholdHours between successive bumps — otherwise a
          // 15-min sweep walks an item to maxLevel within half an hour
          // regardless of the rule's configured threshold.
          OR: [{ escalatedAt: null }, { escalatedAt: { lte: cutoff } }],
        },
        include: {
          shipment: { select: { shipmentNumber: true, lineItems: { select: { totalValue: true } } } },
        },
      });

      for (const dec of decisionCandidates) {
        const targetUserId = await resolveEscalationUser(rule.escalateTo, rule.accountId, rule.account?.ownerUserId);
        const newLevel = dec.escalationLevel + 1;
        const breachHours = dec.reviewSlaDueAt
          ? Math.round((now.getTime() - dec.reviewSlaDueAt.getTime()) / (1000 * 60 * 60))
          : rule.thresholdHours;

        const valSum = dec.shipment?.lineItems.reduce((s, li) => s + Number(li.totalValue || 0), 0) || 0;
        const valText = valSum > 0 ? ` · $${Math.round(valSum / 1000)}k declared value` : "";
        const reason = `Review SLA breached by ${breachHours}h${valText}`;

        // Create EscalationEvent
        await db.escalationEvent.create({
          data: {
            accountId: rule.accountId,
            workKind: "decision",
            workItemId: dec.id,
            ruleId: rule.id,
            fromUserId: dec.assignedToUserId,
            toUserId: targetUserId,
            level: newLevel,
            reason,
          },
        });

        // Update Decision
        await db.agentDecision.update({
          where: { id: dec.id },
          data: {
            escalationLevel: newLevel,
            escalatedAt: now,
            assignedToUserId: targetUserId || dec.assignedToUserId,
          },
        });

        // Send notification
        if (targetUserId) {
          await notify({
            accountId: rule.accountId,
            userId: targetUserId,
            type: "WORK_ESCALATED",
            message: `${dec.agentName} on ${dec.shipment?.shipmentNumber || "Shipment"}: ${reason}`,
            entityType: "AgentDecision",
            entityId: dec.id,
          });
        }

        escalationsCreated++;
      }
    }

    // Evaluate exceptions matching rule
    if (rule.appliesToKinds.includes("exception")) {
      const exceptionCandidates = await db.exceptionItem.findMany({
        where: {
          accountId: rule.accountId,
          status: "Open",
          slaDueAt: { lte: cutoff },
          escalationLevel: { lt: rule.maxLevel },
          OR: [{ escalatedAt: null }, { escalatedAt: { lte: cutoff } }],
        },
        include: {
          shipment: { select: { shipmentNumber: true } },
        },
      });

      for (const exc of exceptionCandidates) {
        const targetUserId = await resolveEscalationUser(rule.escalateTo, rule.accountId, rule.account?.ownerUserId);
        const newLevel = exc.escalationLevel + 1;
        const breachHours = exc.slaDueAt
          ? Math.round((now.getTime() - exc.slaDueAt.getTime()) / (1000 * 60 * 60))
          : rule.thresholdHours;
        const reason = `Exception SLA breached by ${breachHours}h · ${exc.description}`;

        await db.escalationEvent.create({
          data: {
            accountId: rule.accountId,
            workKind: "exception",
            workItemId: exc.id,
            ruleId: rule.id,
            fromUserId: exc.assignedToUserId,
            toUserId: targetUserId,
            level: newLevel,
            reason,
          },
        });

        await db.exceptionItem.update({
          where: { id: exc.id },
          data: {
            escalationLevel: newLevel,
            escalatedAt: now,
            assignedToUserId: targetUserId || exc.assignedToUserId,
          },
        });

        if (targetUserId) {
          await notify({
            accountId: rule.accountId,
            userId: targetUserId,
            type: "WORK_ESCALATED",
            message: reason,
            entityType: "ExceptionItem",
            entityId: exc.id,
          });
        }

        escalationsCreated++;
      }
    }
  }

  return {
    breachedDecisions: unbreachedDecisions.length,
    breachedExceptions: unbreachedExceptions.length,
    escalationsCreated,
    atRiskWarnings,
  };
}

async function resolveEscalationUser(
  escalateTo: string,
  accountId: string,
  accountOwnerUserId?: string | null
): Promise<string | null> {
  if (escalateTo === "ACCOUNT_OWNER") {
    return accountOwnerUserId || null;
  }

  if (escalateTo === "TEAM_MANAGER") {
    // A real team manager is an AccountTeamMembership with role MANAGER, not
    // an arbitrary active account member. Fall back to the account owner when
    // no team manager exists (solo operator / flat team).
    const manager = await db.accountTeamMembership.findFirst({
      where: { role: "MANAGER", team: { accountId } },
      select: { userId: true },
    });
    return manager?.userId || accountOwnerUserId || null;
  }

  if (escalateTo.startsWith("ROLE:")) {
    const roleName = escalateTo.replace("ROLE:", "");
    if (roleName === "LICENSED_BROKER") {
      const brokerUser = await db.user.findFirst({
        where: {
          brokerLicenseNumber: { not: null },
          memberships: { some: { accountId, status: "ACTIVE" } },
        },
        select: { id: true },
      });
      return brokerUser?.id || accountOwnerUserId || null;
    }
  }

  if (escalateTo.startsWith("USER:")) {
    return escalateTo.replace("USER:", "");
  }

  return accountOwnerUserId || null;
}

import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { REPORT_RUN_REQUESTED_EVENT } from "@/lib/inngest/functions/reportRun";

function addOccurrence(base: Date, frequency: string): Date {
  const next = new Date(base);
  if (frequency === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/** Clamps a requested day-of-month to the last valid day of that month (documented deterministic policy). */
function clampDayOfMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

export function computeNextRun(schedule: {
  frequency: string;
  scheduleConfig: unknown;
  lastRunAt: Date | null;
}): Date | null {
  if (schedule.frequency === "ONCE") return schedule.lastRunAt ? null : new Date();

  const config = (schedule.scheduleConfig ?? {}) as { runAtHour?: number; runAtMinute?: number; dayOfMonth?: number };
  const hour = config.runAtHour ?? 0;
  const minute = config.runAtMinute ?? 0;
  const base = schedule.lastRunAt ?? new Date();
  const next = addOccurrence(base, schedule.frequency);

  if (schedule.frequency === "MONTHLY" && config.dayOfMonth) {
    const day = clampDayOfMonth(next.getUTCFullYear(), next.getUTCMonth(), config.dayOfMonth);
    next.setUTCDate(day);
  }
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

/**
 * Finds schedules due to run, atomically claims each one (optimistic lock via
 * lockedAt), computes and persists its next occurrence, and enqueues exactly
 * one ReportRun per claimed schedule -- preventing duplicate execution across
 * concurrent cron invocations.
 */
export async function dispatchDueReportSchedules(): Promise<{ dispatched: number; errors: number }> {
  const now = new Date();
  const due = await db.reportSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } }],
    },
    include: { reportDefinition: true },
    take: 200,
  });

  let dispatched = 0;
  let errors = 0;

  for (const schedule of due) {
    const claim = await db.reportSchedule.updateMany({
      where: { id: schedule.id, OR: [{ lockedAt: null }, { lockedAt: schedule.lockedAt ?? undefined }] },
      data: { lockedAt: now },
    });
    if (claim.count === 0) continue; // another worker claimed it first

    try {
      const run = await db.reportRun.create({
        data: {
          accountId: schedule.accountId,
          reportDefinitionId: schedule.reportDefinitionId,
          scheduleId: schedule.id,
          reportType: schedule.reportDefinition.reportType,
          format: schedule.format,
          requestedByUserId: schedule.ownerUserId,
          filterSnapshot: schedule.reportDefinition.filters ?? {},
          columnSnapshot: schedule.reportDefinition.columns ?? undefined,
          sortSnapshot: schedule.reportDefinition.sort ?? undefined,
        },
      });

      await inngest.send({ name: REPORT_RUN_REQUESTED_EVENT, data: { runId: run.id } });

      const nextRunAt = computeNextRun({
        frequency: schedule.frequency,
        scheduleConfig: schedule.scheduleConfig,
        lastRunAt: now,
      });

      await db.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          lockedAt: null,
          isActive: nextRunAt === null ? false : schedule.isActive,
        },
      });
      dispatched += 1;
    } catch (err) {
      errors += 1;
      await db.reportSchedule.update({ where: { id: schedule.id }, data: { lockedAt: null } });
      console.error(`[report-schedules] Failed to dispatch schedule ${schedule.id}:`, err);
    }
  }

  return { dispatched, errors };
}

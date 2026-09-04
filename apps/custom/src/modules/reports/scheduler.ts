import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { REPORT_RUN_REQUESTED_EVENT } from "@/lib/inngest/functions/reportRun";

function addOccurrence(base: Date, frequency: string): Date {
  const next = new Date(base);
  if (frequency === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "MONTHLY") {
    // Pin to day 1 before advancing the month -- otherwise a high day-of-month (e.g. 31)
    // can cause setUTCMonth to overflow into a *later* month than intended when the target
    // month has fewer days (e.g. Jan 31 -> Feb would silently roll over into March).
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

/** Clamps a requested day-of-month to the last valid day of that month (documented deterministic policy). */
function clampDayOfMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

/**
 * Resolves "nth weekday of month" (e.g. second Tuesday) to a day-of-month number.
 * `nth` is 1-5 for the 1st..5th occurrence, or -1 for the last occurrence in the month.
 * If the requested nth occurrence doesn't exist (e.g. a rare 5th Friday), falls back to
 * the last occurrence of that weekday in the month (documented deterministic policy).
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (nth === -1) {
    for (let day = lastDay; day >= 1; day--) {
      if (new Date(Date.UTC(year, month, day)).getUTCDay() === weekday) return day;
    }
  }
  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    if (new Date(Date.UTC(year, month, day)).getUTCDay() === weekday) {
      count += 1;
      if (count === nth) return day;
    }
  }
  return nthWeekdayOfMonth(year, month, weekday, -1);
}

export interface ScheduleConfig {
  runAtHour?: number;
  runAtMinute?: number;
  dayOfMonth?: number;
  /** Alternative to dayOfMonth for "nth weekday of month" (e.g. second Tuesday). */
  nthWeekday?: { nth: 1 | 2 | 3 | 4 | 5 | -1; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 };
}

export function computeNextRun(schedule: {
  frequency: string;
  scheduleConfig: unknown;
  lastRunAt: Date | null;
}): Date | null {
  if (schedule.frequency === "ONCE") return schedule.lastRunAt ? null : new Date();

  const config = (schedule.scheduleConfig ?? {}) as ScheduleConfig;
  const hour = config.runAtHour ?? 0;
  const minute = config.runAtMinute ?? 0;
  const base = schedule.lastRunAt ?? new Date();
  const next = addOccurrence(base, schedule.frequency);

  if (schedule.frequency === "MONTHLY") {
    if (config.nthWeekday) {
      const day = nthWeekdayOfMonth(next.getUTCFullYear(), next.getUTCMonth(), config.nthWeekday.weekday, config.nthWeekday.nth);
      next.setUTCDate(day);
    } else {
      const day = clampDayOfMonth(next.getUTCFullYear(), next.getUTCMonth(), config.dayOfMonth ?? base.getUTCDate());
      next.setUTCDate(day);
    }
  }
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

/**
 * Computes the next `count` occurrences of a schedule by repeatedly feeding each computed
 * occurrence back in as `lastRunAt`. Used for the "next 3 occurrences" schedule-editor preview.
 */
export function computeNextOccurrences(
  schedule: { frequency: string; scheduleConfig: unknown; lastRunAt: Date | null },
  count: number
): Date[] {
  const occurrences: Date[] = [];
  let cursor = schedule.lastRunAt;
  for (let i = 0; i < count; i++) {
    const next = computeNextRun({ frequency: schedule.frequency, scheduleConfig: schedule.scheduleConfig, lastRunAt: cursor });
    if (!next) break;
    occurrences.push(next);
    cursor = next;
  }
  return occurrences;
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

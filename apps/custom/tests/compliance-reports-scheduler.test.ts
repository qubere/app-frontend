import { describe, expect, it } from "vitest";
import { computeNextOccurrences, computeNextRun } from "../src/modules/reports/scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("computeNextRun", () => {
  it("returns a single occurrence for ONCE and null once already run", () => {
    const first = computeNextRun({ frequency: "ONCE", scheduleConfig: {}, lastRunAt: null });
    expect(first).not.toBeNull();
    const second = computeNextRun({ frequency: "ONCE", scheduleConfig: {}, lastRunAt: first });
    expect(second).toBeNull();
  });

  it("advances WEEKLY by exactly 7 days", () => {
    const base = new Date("2026-03-04T06:00:00Z");
    const next = computeNextRun({ frequency: "WEEKLY", scheduleConfig: { runAtHour: 6 }, lastRunAt: base });
    expect(next!.getTime() - base.getTime()).toBe(7 * DAY_MS);
    expect(next!.getUTCHours()).toBe(6);
  });

  it("clamps MONTHLY dayOfMonth to the last valid day of a shorter month", () => {
    const base = new Date("2026-01-31T00:00:00Z");
    const next = computeNextRun({ frequency: "MONTHLY", scheduleConfig: { dayOfMonth: 31 }, lastRunAt: base });
    // 2026 is not a leap year -- Feb has 28 days.
    expect(next!.getUTCMonth()).toBe(1);
    expect(next!.getUTCDate()).toBe(28);
  });

  it("resolves MONTHLY nthWeekday (e.g. second Tuesday) to the correct calendar day", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const next = computeNextRun({
      frequency: "MONTHLY",
      scheduleConfig: { nthWeekday: { nth: 2, weekday: 2 } },
      lastRunAt: base,
    });
    expect(next!.getUTCMonth()).toBe(1); // February 2026
    expect(next!.getUTCDay()).toBe(2); // Tuesday

    let priorMatches = 0;
    for (let day = 1; day < next!.getUTCDate(); day++) {
      if (new Date(Date.UTC(next!.getUTCFullYear(), next!.getUTCMonth(), day)).getUTCDay() === 2) priorMatches += 1;
    }
    expect(priorMatches).toBe(1); // exactly one Tuesday before this one -> it's the 2nd
  });

  it("falls back to the last occurrence when the requested nth weekday doesn't exist", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const fifth = computeNextRun({
      frequency: "MONTHLY",
      scheduleConfig: { nthWeekday: { nth: 5, weekday: 2 } },
      lastRunAt: base,
    });
    const last = computeNextRun({
      frequency: "MONTHLY",
      scheduleConfig: { nthWeekday: { nth: -1, weekday: 2 } },
      lastRunAt: base,
    });
    // February 2026 has no 5th Tuesday -- the fallback must equal the last Tuesday.
    expect(fifth!.getUTCDate()).toBe(last!.getUTCDate());
  });
});

describe("computeNextOccurrences", () => {
  it("returns count sequential occurrences, each one interval apart", () => {
    const occurrences = computeNextOccurrences({ frequency: "WEEKLY", scheduleConfig: {}, lastRunAt: null }, 3);
    expect(occurrences).toHaveLength(3);
    expect(occurrences[1].getTime() - occurrences[0].getTime()).toBe(7 * DAY_MS);
    expect(occurrences[2].getTime() - occurrences[1].getTime()).toBe(7 * DAY_MS);
  });

  it("stops early for ONCE schedules", () => {
    const occurrences = computeNextOccurrences({ frequency: "ONCE", scheduleConfig: {}, lastRunAt: null }, 3);
    expect(occurrences).toHaveLength(1);
  });
});

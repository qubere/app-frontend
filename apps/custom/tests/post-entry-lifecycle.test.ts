import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    priorDisclosure: { findFirst: vi.fn(), update: vi.fn() },
    dutyPaymentInstruction: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { updatePriorDisclosureStatus } from "@/modules/postEntry/priorDisclosureCalculator";
import { updateDutyPaymentStatus } from "@/modules/payments/achDutyPaymentService";

beforeEach(() => {
  vi.clearAllMocks();
  db.priorDisclosure.update.mockImplementation(({ data }: any) => Promise.resolve({ id: "d1", ...data }));
  db.dutyPaymentInstruction.update.mockImplementation(({ data }: any) => Promise.resolve({ id: "p1", ...data }));
});

describe("prior disclosure status machine", () => {
  it("allows DRAFT -> TENDERED and stamps disclosedAt", async () => {
    db.priorDisclosure.findFirst.mockResolvedValueOnce({ id: "d1", status: "DRAFT" });
    const r = await updatePriorDisclosureStatus("acc", "d1", "TENDERED");
    expect(r.ok).toBe(true);
    expect(db.priorDisclosure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "TENDERED", disclosedAt: expect.any(Date) }) })
    );
  });

  it("rejects TENDERED -> DRAFT", async () => {
    db.priorDisclosure.findFirst.mockResolvedValueOnce({ id: "d1", status: "TENDERED" });
    const r = await updatePriorDisclosureStatus("acc", "d1", "ACKNOWLEDGED");
    expect(r.ok).toBe(true);
    db.priorDisclosure.findFirst.mockResolvedValueOnce({ id: "d1", status: "CLOSED" });
    const r2 = await updatePriorDisclosureStatus("acc", "d1", "TENDERED");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("INVALID_TRANSITION");
  });

  it("returns NOT_FOUND for another account's row", async () => {
    db.priorDisclosure.findFirst.mockResolvedValueOnce(null);
    const r = await updatePriorDisclosureStatus("acc", "nope", "CLOSED");
    expect(r).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("duty payment status machine", () => {
  it("walks PENDING -> SUBMITTED -> SETTLED", async () => {
    db.dutyPaymentInstruction.findFirst.mockResolvedValueOnce({ id: "p1", status: "PENDING" });
    const r1 = await updateDutyPaymentStatus("acc", "p1", "SUBMITTED");
    expect(r1.ok).toBe(true);
    db.dutyPaymentInstruction.findFirst.mockResolvedValueOnce({ id: "p1", status: "SUBMITTED" });
    const r2 = await updateDutyPaymentStatus("acc", "p1", "SETTLED");
    expect(r2.ok).toBe(true);
    expect(db.dutyPaymentInstruction.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SETTLED", settledAt: expect.any(Date) }) })
    );
  });

  it("rejects SETTLED -> anything and records a failure reason on FAILED", async () => {
    db.dutyPaymentInstruction.findFirst.mockResolvedValueOnce({ id: "p1", status: "SETTLED" });
    const bad = await updateDutyPaymentStatus("acc", "p1", "FAILED");
    expect(bad.ok).toBe(false);

    db.dutyPaymentInstruction.findFirst.mockResolvedValueOnce({ id: "p1", status: "SUBMITTED" });
    const ok = await updateDutyPaymentStatus("acc", "p1", "FAILED", { failureReason: "R01 account closed" });
    expect(ok.ok).toBe(true);
    expect(db.dutyPaymentInstruction.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failureReason: "R01 account closed" }) })
    );
  });
});

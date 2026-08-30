import { beforeAll, describe, expect, it, vi } from "vitest";
import { signState, verifyState } from "@/lib/integrations/quickbooks/state";

describe("QuickBooks OAuth state", () => {
  beforeAll(() => {
    process.env.INTEGRATION_STATE_SECRET = "test-state-secret";
  });

  it("round-trips account/user", () => {
    const token = signState({ accountId: "acc_1", userId: "usr_1" });
    const payload = verifyState(token);
    expect(payload.accountId).toBe("acc_1");
    expect(payload.userId).toBe("usr_1");
  });

  it("rejects a tampered body", () => {
    const token = signState({ accountId: "acc_1", userId: "usr_1" });
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ accountId: "acc_evil", userId: "x", iat: Date.now() })).toString(
      "base64url",
    );
    expect(() => verifyState(`${forgedBody}.${sig}`)).toThrow();
  });

  it("rejects a missing/blank state", () => {
    expect(() => verifyState(null)).toThrow();
    expect(() => verifyState("")).toThrow();
    expect(() => verifyState("no-dot")).toThrow();
  });

  it("rejects an expired state", () => {
    const token = signState({ accountId: "acc_1", userId: "usr_1" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    try {
      expect(() => verifyState(token)).toThrow(/expired/);
    } finally {
      vi.useRealTimers();
    }
  });
});

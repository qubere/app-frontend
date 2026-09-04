import { describe, it, expect, vi, beforeEach } from "vitest";

// executionHistory.ts -- persistence helper for the unified ComplianceExecution
// audit envelope. Covers: secret-shaped keys are always stripped from
// snapshots regardless of allow-list, size bounding, deterministic content
// hashing, and that recordComplianceExecution is best-effort (never throws)
// while still reporting the caller's real status honestly (a FAILED domain
// check must never be recorded/read back as COMPLETED).

const { dbMock, logAgentErrorMock } = vi.hoisted(() => ({
  dbMock: {
    complianceExecution: { create: vi.fn() },
    complianceScreeningFinding: { update: vi.fn() },
  },
  logAgentErrorMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/modules/agents/agentLogger", () => ({ logAgentError: logAgentErrorMock }));

const {
  sanitizeSnapshot,
  computeContentHash,
  recordComplianceExecution,
  linkScreeningFinding,
} = await import("@/modules/compliance/executionHistory");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sanitizeSnapshot", () => {
  it("returns undefined for a nullish payload", () => {
    expect(sanitizeSnapshot(undefined)).toBeUndefined();
    expect(sanitizeSnapshot(null)).toBeUndefined();
  });

  it("redacts secret-shaped keys case-insensitively at any depth", () => {
    const result = sanitizeSnapshot({
      Authorization: "Bearer abc123",
      nested: { Cookie: "session=xyz", ApiKey: "k_live_1", password: "hunter2", ok: "keep-me" },
      list: [{ token: "t1" }, { secret: "s1", fine: "value" }],
    }) as any;

    expect(result.Authorization).toBe("[REDACTED]");
    expect(result.nested.Cookie).toBe("[REDACTED]");
    expect(result.nested.ApiKey).toBe("[REDACTED]");
    expect(result.nested.password).toBe("[REDACTED]");
    expect(result.nested.ok).toBe("keep-me");
    expect(result.list[0].token).toBe("[REDACTED]");
    expect(result.list[1].secret).toBe("[REDACTED]");
    expect(result.list[1].fine).toBe("value");
  });

  it("redacts secret-shaped keys even when an allow-list is supplied", () => {
    const result = sanitizeSnapshot({ token: "t1", keepMe: "v" }, ["token", "keepMe"]) as any;
    expect(result.token).toBe("[REDACTED]");
    expect(result.keepMe).toBe("v");
  });

  it("drops keys not present in a supplied allow-list", () => {
    const result = sanitizeSnapshot({ keepMe: "v", dropMe: "v2" }, ["keepMe"]) as any;
    expect(result.keepMe).toBe("v");
    expect(result.dropMe).toBeUndefined();
  });

  it("truncates a payload larger than the size cap instead of persisting it whole", () => {
    const big = { blob: "x".repeat(64 * 1024) };
    const result = sanitizeSnapshot(big) as any;
    expect(result.__truncated).toBe(true);
    expect(typeof result.__originalSizeBytes).toBe("number");
    expect(result.blob).toBeUndefined();
  });
});

describe("computeContentHash", () => {
  it("returns null for an undefined payload", () => {
    expect(computeContentHash(undefined)).toBeNull();
  });

  it("is stable across differing key insertion order", () => {
    const a = computeContentHash({ x: 1, y: 2, z: { inner: true, outer: false } });
    const b = computeContentHash({ z: { outer: false, inner: true }, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it("differs when the payload content differs", () => {
    const a = computeContentHash({ status: "COMPLETED" });
    const b = computeContentHash({ status: "FAILED" });
    expect(a).not.toBe(b);
  });
});

describe("recordComplianceExecution", () => {
  it("persists the honest status the caller reports -- FAILED is never coerced to COMPLETED", async () => {
    dbMock.complianceExecution.create.mockResolvedValue({ id: "exec_1" });

    const id = await recordComplianceExecution({
      accountId: "acct_1",
      executionType: "EMBARGO_SCREENING",
      status: "FAILED",
      correlationId: "corr_1",
      source: "SHIPMENT_PIPELINE",
      finalStatus: "FAILED",
    });

    expect(id).toBe("exec_1");
    const call = dbMock.complianceExecution.create.mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
    expect(call.data.finalStatus).toBe("FAILED");
  });

  it("never throws when the underlying write fails -- returns null and logs instead", async () => {
    dbMock.complianceExecution.create.mockRejectedValue(new Error("connection reset"));

    const id = await recordComplianceExecution({
      accountId: "acct_1",
      executionType: "CLASSIFICATION",
      status: "COMPLETED",
      correlationId: "corr_2",
      source: "UI",
    });

    expect(id).toBeNull();
    expect(logAgentErrorMock).toHaveBeenCalled();
  });

  it("sanitizes request/response snapshots before persisting and computes matching hashes", async () => {
    dbMock.complianceExecution.create.mockResolvedValue({ id: "exec_3" });

    await recordComplianceExecution({
      accountId: "acct_1",
      executionType: "RESTRICTED_PARTY_SCREENING",
      status: "COMPLETED",
      correlationId: "corr_3",
      source: "API",
      requestSnapshot: { authorization: "Bearer secret", partyName: "Acme Corp" },
      responseSnapshot: { status: "CLEAR" },
    });

    const call = dbMock.complianceExecution.create.mock.calls[0][0];
    expect(call.data.requestSnapshot.authorization).toBe("[REDACTED]");
    expect(call.data.requestSnapshot.partyName).toBe("Acme Corp");
    expect(call.data.inputHash).toBe(computeContentHash({ authorization: "Bearer secret", partyName: "Acme Corp" }));
    expect(call.data.outputHash).toBe(computeContentHash({ status: "CLEAR" }));
  });
});

describe("linkScreeningFinding", () => {
  it("best-effort links a finding to its execution and never throws on failure", async () => {
    dbMock.complianceScreeningFinding.update.mockRejectedValue(new Error("not found"));
    await expect(linkScreeningFinding("finding_1", "exec_1")).resolves.toBeUndefined();
    expect(logAgentErrorMock).toHaveBeenCalled();
  });

  it("updates the finding's executionId on success", async () => {
    dbMock.complianceScreeningFinding.update.mockResolvedValue({ id: "finding_1" });
    await linkScreeningFinding("finding_1", "exec_1");
    expect(dbMock.complianceScreeningFinding.update).toHaveBeenCalledWith({
      where: { id: "finding_1" },
      data: { executionId: "exec_1" },
    });
  });
});

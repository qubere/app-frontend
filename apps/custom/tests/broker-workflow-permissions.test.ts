import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permissions: new Set<string>(), authenticated: true, saveDecision: vi.fn(), submitHold: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn(async () => mocks.authenticated ? { accountId: "tenant-a", userId: "broker-a", roleNames: ["BROKER"], permissions: [...mocks.permissions], dataMode: "PRODUCTION" } : null),
  hasPermission: vi.fn(async (permission: string) => mocks.permissions.has(permission)),
  hasProductEntitlement: vi.fn(async () => true),
}));
vi.mock("@/lib/logging/logger", () => ({ logApiRequest: vi.fn() }));
vi.mock("@/lib/valuation/assistDeclarationService", () => ({ saveAssistDecision: mocks.saveDecision }));
vi.mock("@/lib/pga/holdService", () => ({ recordManualSubmission: mocks.submitHold }));
vi.mock("@/lib/api/scopedIdempotency", async () => {
  const { NextResponse } = await import("next/server");
  return { withScopedIdempotency: async (_req: Request, _account: string, _requestId: string, operation: () => Promise<unknown>) => NextResponse.json(await operation()) };
});
import { POST as declareAssist } from "@/app/api/assists/[id]/declare/route";
import { POST as submitHold } from "@/app/api/pga/holds/[id]/submit/route";
const context = { params: Promise.resolve({ id: "record" }) };
const decision = { filingId: "filing", basisHash: "a".repeat(64), assistVersion: 0 };
const request = (body: unknown) => new Request("http://localhost/api/workflow", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "one" }, body: JSON.stringify(body) });
beforeEach(() => { mocks.permissions.clear(); mocks.authenticated = true; vi.clearAllMocks(); mocks.saveDecision.mockResolvedValue({ staged: true }); mocks.submitHold.mockResolvedValue({ id: "submission" }); });
it("denies anonymous requests before any business write", async () => {
  mocks.authenticated = false;
  expect((await declareAssist(request(decision), context)).status).toBe(401);
  expect((await submitHold(request({}), context)).status).toBe(401);
  expect(mocks.saveDecision).not.toHaveBeenCalled(); expect(mocks.submitHold).not.toHaveBeenCalled();
});
it("read permission alone cannot confirm or override an assist", async () => {
  mocks.permissions.add("valuation.read");
  expect((await declareAssist(request(decision), context)).status).toBe(403);
  expect(mocks.saveDecision).not.toHaveBeenCalled();
});
it("requires the extra override permission even for a user who can include assists", async () => {
  mocks.permissions.add("valuation.update");
  const response = await declareAssist(request({ ...decision, amount: "5", overrideReasonCode: "broker_judgment" }), context);
  expect(response.status).toBe(403); expect(mocks.saveDecision).not.toHaveBeenCalled();
  mocks.permissions.add("valuation.override");
  expect((await declareAssist(request({ ...decision, amount: "5", overrideReasonCode: "broker_judgment" }), context)).status).toBe(200);
  expect(mocks.saveDecision).toHaveBeenCalledWith("tenant-a", "broker-a", "record", expect.objectContaining({ amount: "5" }), false);
});
it("requires PGA approval rather than preparation permission to record a filing", async () => {
  mocks.permissions.add("pga.update");
  const input = { version: 0, formInput: {}, filedManually: true, externalReference: "ACE-reference", messageSetText: "Original message" };
  expect((await submitHold(request(input), context)).status).toBe(403); expect(mocks.submitHold).not.toHaveBeenCalled();
  mocks.permissions.add("pga.approve");
  expect((await submitHold(request(input), context)).status).toBe(200);
  expect(mocks.submitHold).toHaveBeenCalledWith("tenant-a", "broker-a", "record", "one", input);
});

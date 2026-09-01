import { beforeEach, expect, it, vi } from "vitest";
const records = vi.hoisted(() => new Map<string, any>());
vi.mock("@/lib/db", () => ({ db: { idempotencyRecord: {
  findUnique: vi.fn(async ({ where }) => records.get(where.accountId_idempotencyKey.accountId + ":" + where.accountId_idempotencyKey.idempotencyKey) ?? null),
  create: vi.fn(async ({ data }) => { const key = data.accountId + ":" + data.idempotencyKey; if (records.has(key)) throw { code: "P2002" }; records.set(key, { ...data, id: key }); }),
  update: vi.fn(async ({ where, data }) => { const key = where.accountId_idempotencyKey.accountId + ":" + where.accountId_idempotencyKey.idempotencyKey; records.set(key, { ...records.get(key), ...data }); }),
  delete: vi.fn(async ({ where }) => records.delete(where.id)),
} } }));
import { withScopedIdempotency } from "@/lib/api/scopedIdempotency";
const request = (path = "/api/pga/holds/h/submit", body = "{}") => new Request("http://localhost" + path, { method: "POST", headers: { "Idempotency-Key": "same-key" }, body });
beforeEach(() => records.clear());
it("replays the result without repeating the business write", async () => {
  const write = vi.fn(async () => ({ submissionId: "one" }));
  await withScopedIdempotency(request(), "account", "r1", write);
  const result = await withScopedIdempotency(request(), "account", "r2", write);
  expect(await result.json()).toEqual({ submissionId: "one" }); expect(write).toHaveBeenCalledOnce();
});
it("isolates request keys by tenant and endpoint", async () => {
  const write = vi.fn(async () => ({ ok: true }));
  await withScopedIdempotency(request(), "one", "r1", write);
  await withScopedIdempotency(request(), "two", "r2", write);
  await withScopedIdempotency(request("/api/pga/holds/other/submit"), "one", "r3", write);
  expect(write).toHaveBeenCalledTimes(3);
});
it("rejects a changed body and returns a valid conflict for a reserved request", async () => {
  const write = vi.fn(async () => ({ ok: true }));
  await withScopedIdempotency(request(), "one", "r1", write);
  expect((await withScopedIdempotency(request(undefined, '{"changed":true}'), "one", "r2", write)).status).toBe(409);
  for (const row of records.values()) row.statusCode = 102;
  const pending = await withScopedIdempotency(request(), "one", "r3", write);
  expect(pending.status).toBe(409);
  expect(await pending.json()).toMatchObject({ error: { code: "IDEMPOTENCY_IN_PROGRESS" } });
  expect(write).toHaveBeenCalledOnce();
});
it("reserves an expired key again before running the operation", async () => {
  await withScopedIdempotency(request(), "one", "r1", async () => ({}));
  for (const row of records.values()) row.expiresAt = new Date(0);
  await withScopedIdempotency(request(), "one", "r2", async () => {
    expect([...records.values()][0].statusCode).toBe(102); return { renewed: true };
  });
});

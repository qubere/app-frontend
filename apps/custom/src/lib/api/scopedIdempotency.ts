import { NextResponse } from "next/server";
import { checkIdempotency, persistIdempotency } from "./idempotency";
import { DomainError, handleApiError } from "./error";

export async function withScopedIdempotency(req: Request, accountId: string, requestId: string, operation: () => Promise<unknown>) {
  const key = req.headers.get("Idempotency-Key");
  if (!key || key.length > 120) throw new DomainError("An Idempotency-Key of 1–120 characters is required.", "IDEMPOTENCY_KEY_REQUIRED", 400);
  const headers = new Headers(req.headers);
  headers.set("Idempotency-Key", req.method + ":" + new URL(req.url).pathname + ":" + key);
  const guarded = new Request(req.clone(), { headers });
  const state = await checkIdempotency(guarded, accountId, requestId);
  if (state.errorResponse) return state.errorResponse;
  if (state.cachedResponse) return state.cachedResponse;
  let response: NextResponse;
  try { response = NextResponse.json(await operation()); }
  catch (error) { response = handleApiError(error, requestId); }
  await persistIdempotency(accountId, state.idempotencyKey!, state.requestHash!, response.status, await response.clone().json());
  return response;
}

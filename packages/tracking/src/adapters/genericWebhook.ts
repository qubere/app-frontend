import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ProviderRuntimeConfig,
  ProviderSignal,
  ProviderWebhookRequest,
  TrackingProviderAdapter,
} from "../types";

type SignatureMode = "HMAC_SHA256" | "BEARER" | "API_KEY";

function header(request: ProviderWebhookRequest, name: string): string | null {
  return request.headers[name] ?? request.headers[name.toLowerCase()] ?? null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function stringValue(record: Record<string, unknown>, key: string, required = false): string | undefined {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new Error(`Generic tracking webhook field "${key}" is required.`);
  return undefined;
}

function dateValue(record: Record<string, unknown>, key: string, required = false): Date | undefined {
  const value = stringValue(record, key, required);
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Generic tracking webhook field "${key}" is not a valid date.`);
  return parsed;
}

export class GenericWebhookTrackingAdapter implements TrackingProviderAdapter {
  readonly adapterKey = "GENERIC_WEBHOOK_V1";
  readonly capabilities = ["PUSH_EVENTS", "ETA"] as const;

  validateConfig(config: ProviderRuntimeConfig): string[] {
    const signatureMode = config.config.signatureMode;
    if (signatureMode && !["HMAC_SHA256", "BEARER", "API_KEY"].includes(String(signatureMode))) {
      return ["signatureMode must be HMAC_SHA256, BEARER, or API_KEY."];
    }
    return [];
  }

  verifyWebhook(
    request: ProviderWebhookRequest,
    config: ProviderRuntimeConfig,
    secret: string
  ): boolean {
    const signatureMode = (config.config.signatureMode ?? "HMAC_SHA256") as SignatureMode;
    if (!secret) return false;

    if (signatureMode === "BEARER") {
      const authorization = header(request, "authorization");
      return authorization ? safeEqual(authorization, `Bearer ${secret}`) : false;
    }

    if (signatureMode === "API_KEY") {
      const apiKey = header(request, "x-api-key");
      return apiKey ? safeEqual(apiKey, secret) : false;
    }

    const supplied = header(request, "x-webhook-signature")?.replace(/^sha256=/i, "");
    if (!supplied) return false;
    const expected = createHmac("sha256", secret).update(request.rawBody).digest("hex");
    return safeEqual(supplied.toLowerCase(), expected.toLowerCase());
  }

  parseWebhook(request: ProviderWebhookRequest, _config: ProviderRuntimeConfig): ProviderSignal[] {
    const parsed: unknown = JSON.parse(request.rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Generic tracking webhook body must be a JSON object.");
    }
    const body = parsed as Record<string, unknown>;
    const idempotencyKey = stringValue(body, "idempotencyKey", true)!;
    const eventTimestamp = dateValue(body, "eventTimestamp", true)!;
    const estimatedArrival = dateValue(body, "estimatedArrival");
    const providerEventId = stringValue(body, "providerEventId") ?? idempotencyKey;

    const signal: ProviderSignal = {
      providerEventId,
      idempotencyKey,
      shipmentId: stringValue(body, "shipmentId", true),
      movementId: stringValue(body, "movementId"),
      legId: stringValue(body, "legId"),
      equipmentId: stringValue(body, "equipmentId"),
      rawEventCode: stringValue(body, "eventCode", true)!,
      eventDescription: stringValue(body, "eventDescription"),
      occurredAt: eventTimestamp,
      sourceUpdatedAt: dateValue(body, "sourceUpdatedAt"),
      estimatedArrival,
      carrierReference: stringValue(body, "carrierReference"),
      location: {
        name: stringValue(body, "locationName"),
        unlocode: stringValue(body, "unlocode"),
        timezone: stringValue(body, "timezone"),
      },
      raw: body,
    };

    return [signal];
  }
}

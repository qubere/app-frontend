import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GenericWebhookTrackingAdapter,
  TrackingProviderRegistry,
  mapProviderEvent,
  type ProviderRuntimeConfig,
  type TrackingEventMappingRule,
} from "./index";

const config: ProviderRuntimeConfig = {
  providerKey: "GENERIC_WEBHOOK",
  connectionId: "connection_1",
  connectionKey: "route_1",
  environment: "PRODUCTION",
  config: { signatureMode: "HMAC_SHA256" },
};

describe("tracking provider registry", () => {
  it("resolves registered adapters and rejects unknown implementations", () => {
    const registry = new TrackingProviderRegistry().register(new GenericWebhookTrackingAdapter());
    expect(registry.get("GENERIC_WEBHOOK_V1").adapterKey).toBe("GENERIC_WEBHOOK_V1");
    expect(() => registry.get("MISSING")).toThrow(/not registered/);
  });
});

describe("generic webhook adapter", () => {
  it("verifies HMAC signatures and preserves the current payload contract", () => {
    const adapter = new GenericWebhookTrackingAdapter();
    const rawBody = JSON.stringify({
      idempotencyKey: "delivery_1",
      shipmentId: "shipment_1",
      eventCode: "vessel-arrived",
      eventTimestamp: "2026-08-31T12:00:00.000Z",
      estimatedArrival: "2026-09-01T12:00:00.000Z",
    });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const request = { rawBody, headers: { "x-webhook-signature": `sha256=${signature}` } };

    expect(adapter.verifyWebhook(request, config, secret)).toBe(true);
    expect(adapter.verifyWebhook(request, config, "wrong-secret")).toBe(false);
    const [signal] = adapter.parseWebhook(request, config);
    expect(signal.shipmentId).toBe("shipment_1");
    expect(signal.rawEventCode).toBe("vessel-arrived");
    expect(signal.estimatedArrival?.toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("database event mapping", () => {
  const rules: TrackingEventMappingRule[] = [
    {
      id: "provider-arrival",
      matchType: "CONTAINS",
      rawEventPattern: "ARRIV",
      canonicalEventType: "PORT_ARRIVED",
      classifier: "ACTUAL",
      sourceType: "CARRIER",
      priority: 50,
      active: true,
    },
    {
      id: "connection-arrival",
      integrationConfigId: "connection_1",
      matchType: "EXACT",
      rawEventPattern: "VESSEL_ARRIVED",
      canonicalEventType: "VESSEL_ARRIVED_DESTINATION",
      classifier: "ACTUAL",
      sourceType: "CARRIER",
      priority: 100,
      active: true,
    },
    {
      id: "fallback",
      matchType: "FALLBACK",
      rawEventPattern: "*",
      canonicalEventType: "TRACKING_UPDATE",
      classifier: "ACTUAL",
      sourceType: "PROVIDER",
      priority: 1000,
      active: true,
    },
  ];

  it("prefers connection overrides before provider defaults", () => {
    expect(mapProviderEvent("vessel-arrived", "connection_1", rules)?.canonicalEventType).toBe(
      "VESSEL_ARRIVED_DESTINATION"
    );
    expect(mapProviderEvent("vessel-arrived", "connection_2", rules)?.canonicalEventType).toBe("PORT_ARRIVED");
  });

  it("uses only an explicit database fallback for unknown codes", () => {
    expect(mapProviderEvent("unrecognized", "connection_1", rules)?.canonicalEventType).toBe("TRACKING_UPDATE");
    expect(mapProviderEvent("unrecognized", "connection_1", rules.slice(0, 2))).toBeNull();
  });
});

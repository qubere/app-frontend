import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ingestTrackingWebhook,
  TrackingWebhookError,
} from "../src/modules/tracking/services/trackingWebhookIngestion";

vi.mock("@qubere/db", () => ({ db: {} }));

const receivedAt = new Date("2026-08-31T12:00:00.000Z");
const body = JSON.stringify({
  idempotencyKey: "event-42",
  providerEventId: "provider-event-42",
  shipmentId: "shipment-1",
  eventCode: "VESSEL_ARRIVED",
  eventTimestamp: "2026-08-31T11:30:00.000Z",
  estimatedArrival: "2026-09-01T08:00:00.000Z",
  unlocode: "USLAX",
});
const secret = "test-secret";
const signature = createHmac("sha256", secret).update(body).digest("hex");

function connection() {
  return {
    id: "connection-1",
    accountId: "account-1",
    clientId: "client-1",
    category: "SHIPMENT_TRACKING",
    provider: "GENERIC_WEBHOOK",
    name: "Broker carrier feed",
    status: "ACTIVE",
    connectionKey: "callback-key",
    webhookSecretRef: "tracking-secret",
    environment: "PRODUCTION",
    baseUrl: null,
    configJson: { signatureMode: "HMAC_SHA256" },
    trackingProviderDefinition: {
      key: "GENERIC_WEBHOOK",
      adapterKey: "GENERIC_WEBHOOK_V1",
      status: "ACTIVE",
      eventMappings: [
        {
          id: "mapping-arrived",
          integrationConfigId: null,
          matchType: "EXACT",
          rawEventPattern: "VESSEL_ARRIVED",
          canonicalEventType: "PORT_ARRIVED",
          classifier: "ACTUAL",
          sourceType: "CARRIER",
          priority: 10,
          active: true,
        },
      ],
    },
  };
}

function createDbMock(shipment: object | null = { id: "shipment-1", accountId: "account-1", clientId: "client-1" }) {
  const client: any = {
    integrationConfig: { findUnique: vi.fn().mockResolvedValue(connection()), update: vi.fn() },
    integrationSyncLog: { create: vi.fn() },
    shipment: { findFirst: vi.fn().mockResolvedValue(shipment), updateMany: vi.fn() },
    shipmentLeg: { findFirst: vi.fn() },
    shipmentEquipment: { findFirst: vi.fn() },
    shipmentMovement: { findFirst: vi.fn() },
    trackingEvent: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "tracking-event-1", ...data })),
    },
    etaObservation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    trackingSubscription: { upsert: vi.fn() },
    transportationEvent: { create: vi.fn() },
  };
  client.$transaction = vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(client));
  return client;
}

describe("database-backed tracking webhook ingestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the connection, verifies HMAC, maps the event, and persists tenant-scoped history", async () => {
    const dbClient = createDbMock();
    const result = await ingestTrackingWebhook(
      {
        connectionKey: "callback-key",
        rawBody: body,
        headers: { "x-webhook-signature": signature },
      },
      {
        dbClient,
        now: () => receivedAt,
        secretResolver: { resolveSecret: vi.fn().mockResolvedValue(secret) },
        rawPayloadStore: { store: vi.fn().mockResolvedValue("gs://private/tracking/event.json") },
        onSignalPersisted: vi.fn().mockResolvedValue(null),
      }
    );

    expect(result).toEqual({
      status: "PROCESSED",
      processed: 1,
      duplicates: 0,
      trackingEventIds: ["tracking-event-1"],
    });
    expect(dbClient.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "shipment-1",
          accountId: "account-1",
          clientId: "client-1",
        }),
      })
    );
    expect(dbClient.trackingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          shipmentId: "shipment-1",
          eventType: "PORT_ARRIVED",
          providerEventId: "connection-1:provider-event-42",
          idempotencyKey: "connection-1:event-42",
          rawPayloadRef: "gs://private/tracking/event.json",
        }),
      })
    );
    expect(dbClient.etaObservation.create).toHaveBeenCalled();
    expect(dbClient.trackingSubscription.upsert).toHaveBeenCalled();
  });

  it("rejects a shipment outside the connection's tenant/client scope before persisting an event", async () => {
    const dbClient = createDbMock(null);

    await expect(
      ingestTrackingWebhook(
        {
          connectionKey: "callback-key",
          rawBody: body,
          headers: { "x-webhook-signature": signature },
        },
        {
          dbClient,
          secretResolver: { resolveSecret: vi.fn().mockResolvedValue(secret) },
          rawPayloadStore: { store: vi.fn().mockResolvedValue("gs://private/tracking/event.json") },
        }
      )
    ).rejects.toMatchObject<Partial<TrackingWebhookError>>({
      code: "SHIPMENT_NOT_FOUND",
      status: 404,
    });
    expect(dbClient.trackingEvent.create).not.toHaveBeenCalled();
  });

  it("acknowledges an idempotent retry without writing ETA or subscription history twice", async () => {
    const dbClient = createDbMock();
    dbClient.trackingEvent.create.mockRejectedValueOnce({ code: "P2002" });

    const result = await ingestTrackingWebhook(
      {
        connectionKey: "callback-key",
        rawBody: body,
        headers: { "x-webhook-signature": signature },
      },
      {
        dbClient,
        secretResolver: { resolveSecret: vi.fn().mockResolvedValue(secret) },
        rawPayloadStore: { store: vi.fn().mockResolvedValue("gs://private/tracking/event.json") },
      }
    );

    expect(result).toEqual({
      status: "DUPLICATE",
      processed: 0,
      duplicates: 1,
      trackingEventIds: [],
    });
    expect(dbClient.etaObservation.create).not.toHaveBeenCalled();
    expect(dbClient.trackingSubscription.upsert).not.toHaveBeenCalled();
  });
});

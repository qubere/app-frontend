import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  configureTrackingConnection,
  ingestTrackingWebhook,
} from "@qubere/tracking-platform";
import { buildTrackingProjection } from "@/modules/tracking/shipmentTracking";

vi.mock("@qubere/db", () => ({ db: {} }));

const providerDefinition = {
  id: "provider-definition-1",
  key: "GENERIC_WEBHOOK",
  displayName: "Broker visibility feed",
  adapterKey: "GENERIC_WEBHOOK_V1",
  status: "ACTIVE",
  capabilities: ["PUSH_EVENTS", "ETA"],
  eventMappings: [
    {
      id: "mapping-arrival",
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
};

function customerJourneyDb() {
  const state: any = {
    connection: null,
    events: [],
    etaObservations: [],
    subscription: null,
    transportationEvents: [],
    syncLogs: [],
  };
  const seenIdempotencyKeys = new Set<string>();
  const client: any = {
    trackingProviderDefinition: {
      findFirst: vi.fn().mockResolvedValue(providerDefinition),
    },
    client: {
      findFirst: vi.fn().mockResolvedValue({ id: "client-1" }),
    },
    integrationConfig: {
      findFirst: vi.fn().mockImplementation(async () => state.connection),
      findUnique: vi.fn().mockImplementation(async () => state.connection),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        state.connection = {
          id: "connection-1",
          connectionKey: "callback-key",
          lastSyncAt: null,
          lastEventAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          ...data,
          trackingProviderDefinition: providerDefinition,
          client: { id: "client-1", name: "Acme Imports" },
        };
        return state.connection;
      }),
      update: vi.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(state.connection, data);
        return state.connection;
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    shipment: {
      findFirst: vi.fn().mockResolvedValue({ id: "shipment-1", accountId: "account-1", clientId: "client-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    shipmentLeg: { findFirst: vi.fn() },
    shipmentEquipment: { findFirst: vi.fn() },
    shipmentMovement: { findFirst: vi.fn() },
    trackingEvent: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        if (seenIdempotencyKeys.has(data.idempotencyKey)) throw { code: "P2002" };
        seenIdempotencyKeys.add(data.idempotencyKey);
        const event = { id: `event-${state.events.length + 1}`, confidence: null, isInferred: false, isCorrection: false, ...data };
        state.events.push(event);
        return event;
      }),
    },
    etaObservation: {
      findFirst: vi.fn().mockImplementation(async () => state.etaObservations.at(-1) ?? null),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        state.etaObservations.push({ confidence: null, ...data });
      }),
    },
    trackingSubscription: {
      upsert: vi.fn().mockImplementation(async ({ create, update }: any) => {
        state.subscription = state.subscription ? { ...state.subscription, ...update } : { ...create };
        return state.subscription;
      }),
    },
    transportationEvent: {
      create: vi.fn().mockImplementation(async ({ data }: any) => state.transportationEvents.push(data)),
    },
    integrationSyncLog: {
      create: vi.fn().mockImplementation(async ({ data }: any) => state.syncLogs.push(data)),
    },
  };
  client.$transaction = vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(client));
  return { client, state };
}

describe("Customs tracking customer journey", () => {
  it("connects the broker feed, receives a signed arrival, and updates movement without inventing customs release", async () => {
    const { client, state } = customerJourneyDb();
    const secret = "broker-webhook-secret";
    const onSignalPersisted = vi.fn().mockResolvedValue(null);

    const connection = await configureTrackingConnection(
      {
        accountId: "account-1",
        clientId: "client-1",
        providerDefinitionId: providerDefinition.id,
        name: "Acme broker visibility",
        webhookSecretRef: "projects/demo/secrets/acme-tracking/versions/latest",
        config: { signatureMode: "HMAC_SHA256" },
        isDefault: true,
      },
      { dbClient: client }
    );

    expect(connection.connectionKey).toBe("callback-key");
    expect(connection.apiKey).toBeNull();
    expect(connection.apiSecret).toBeNull();
    expect(connection.lastSyncAt).toBeNull();

    const rawBody = JSON.stringify({
      idempotencyKey: "arrival-42",
      providerEventId: "provider-arrival-42",
      shipmentId: "shipment-1",
      eventCode: "VESSEL_ARRIVED",
      eventTimestamp: "2026-08-31T10:00:00.000Z",
      estimatedArrival: "2026-08-31T10:00:00.000Z",
      carrierReference: "MAEU123456",
      locationName: "Los Angeles",
      unlocode: "USLAX",
    });
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const first = await ingestTrackingWebhook(
      { connectionKey: "callback-key", rawBody, headers: { "x-webhook-signature": signature } },
      {
        dbClient: client,
        now: () => new Date("2026-08-31T10:01:00.000Z"),
        secretResolver: { resolveSecret: vi.fn().mockResolvedValue(secret) },
        rawPayloadStore: { store: vi.fn().mockResolvedValue("gs://private/tracking/arrival-42.json") },
        onSignalPersisted,
      }
    );

    expect(first).toMatchObject({ status: "PROCESSED", processed: 1, duplicates: 0 });
    expect(onSignalPersisted).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalEventType: "PORT_ARRIVED", shipmentId: "shipment-1" })
    );

    const projection = buildTrackingProjection({
      shipment: {
        id: "shipment-1",
        shipmentNumber: "SHP-2026-1001",
        transportMode: "Ocean",
        estimatedArrival: null,
        readinessScore: 84,
      },
      identifiers: [{ type: "MBL", value: "MAEU123456", issuer: "MAEU", isPrimary: true }],
      legs: [],
      events: state.events,
      etaObservations: state.etaObservations,
      subscriptions: [
        {
          integrationConfigId: "connection-1",
          provider: state.subscription.provider,
          status: state.subscription.status,
          lastEventAt: state.subscription.lastEventAt,
          lastSyncAt: state.subscription.lastSyncAt,
          lastErrorAt: null,
          lastErrorCode: null,
        },
      ],
      connections: [
        {
          id: "connection-1",
          name: state.connection.name,
          provider: state.connection.provider,
          status: state.connection.status,
          clientId: state.connection.clientId,
          priority: state.connection.priority,
          isDefault: state.connection.isDefault,
          lastSyncAt: state.connection.lastSyncAt,
          lastEventAt: state.connection.lastEventAt,
          lastErrorAt: null,
          lastErrorMessage: null,
          providerDefinition: {
            displayName: providerDefinition.displayName,
            capabilities: providerDefinition.capabilities,
          },
        },
      ],
      deadlines: [],
      openExceptions: [],
      latestFiling: { id: "filing-1", filingStatus: "Transmitted" },
      now: new Date("2026-08-31T10:02:00.000Z"),
    });

    expect(projection.source.state).toBe("CONNECTED");
    expect(projection.movement.status).toBe("AT_DESTINATION_PORT");
    expect(projection.movement.currentLocation).toBe("Los Angeles");
    expect(projection.customs.status).toBe("FILED");
    expect(projection.customs.status).not.toBe("RELEASED");

    const duplicate = await ingestTrackingWebhook(
      { connectionKey: "callback-key", rawBody, headers: { "x-webhook-signature": signature } },
      {
        dbClient: client,
        secretResolver: { resolveSecret: vi.fn().mockResolvedValue(secret) },
        rawPayloadStore: { store: vi.fn().mockResolvedValue("gs://private/tracking/arrival-42.json") },
      }
    );

    expect(duplicate).toMatchObject({ status: "DUPLICATE", processed: 0, duplicates: 1 });
    expect(state.events).toHaveLength(1);
    expect(state.etaObservations).toHaveLength(1);
  });
});

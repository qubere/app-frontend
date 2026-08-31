import { createHash } from "node:crypto";
import { db } from "@qubere/db";
import { GcpSecretResolver, type SecretResolver } from "@qubere/cloud-runtime";
import { storeGeneratedFile } from "@qubere/storage";
import {
  createDefaultTrackingProviderRegistry,
  mapProviderEvent,
  type ProviderRuntimeConfig,
  type ProviderSignal,
  type TrackingEventMappingRule,
  type TrackingProviderRegistry,
} from "@qubere/tracking";
import { evaluateTrackingExceptions } from "../exceptionDetector";

export type TrackingWebhookErrorCode =
  | "CONNECTION_NOT_FOUND"
  | "CONNECTION_INACTIVE"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_CONFIGURATION"
  | "SIGNATURE_INVALID"
  | "PAYLOAD_INVALID"
  | "SHIPMENT_NOT_FOUND"
  | "REFERENCE_OUT_OF_SCOPE"
  | "EVENT_MAPPING_MISSING";

export class TrackingWebhookError extends Error {
  constructor(
    readonly code: TrackingWebhookErrorCode,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TrackingWebhookError";
  }
}

export interface RawPayloadStore {
  store(input: {
    accountId: string;
    connectionId: string;
    body: string;
    sha256: string;
  }): Promise<string>;
}

const defaultRawPayloadStore: RawPayloadStore = {
  async store(input) {
    const stored = await storeGeneratedFile({
      objectPath: `tracking/raw/${input.accountId}/${input.connectionId}/${input.sha256}.json`,
      filename: `${input.sha256}.json`,
      contentType: "application/json",
      body: Buffer.from(input.body, "utf8"),
    });
    return stored.url;
  },
};

type DbClient = typeof db;

export interface TrackingWebhookIngestionDependencies {
  dbClient?: DbClient;
  registry?: TrackingProviderRegistry;
  secretResolver?: SecretResolver;
  rawPayloadStore?: RawPayloadStore;
  now?: () => Date;
  evaluateExceptions?: typeof evaluateTrackingExceptions;
}

export interface TrackingWebhookIngestionInput {
  connectionKey: string;
  rawBody: string;
  headers: Readonly<Record<string, string | null | undefined>>;
}

export interface TrackingWebhookIngestionResult {
  status: "PROCESSED" | "DUPLICATE";
  processed: number;
  duplicates: number;
  trackingEventIds: string[];
}

/** Record operational health without retaining the payload or credential. */
export async function recordTrackingWebhookFailure(connectionKey: string, error: unknown) {
  const connection = await (db as any).integrationConfig.findFirst({
    where: { connectionKey, category: "SHIPMENT_TRACKING" },
    select: { id: true, accountId: true, provider: true },
  });
  if (!connection) return;
  const code = error instanceof TrackingWebhookError ? error.code : "TRACKING_INGESTION_FAILED";
  const message = error instanceof Error ? error.message.slice(0, 500) : "Tracking webhook could not be processed.";
  const failedAt = new Date();
  await Promise.all([
    (db as any).integrationConfig.updateMany({
      where: { id: connection.id, accountId: connection.accountId },
      data: { lastErrorAt: failedAt, lastErrorMessage: `${code}: ${message}` },
    }),
    (db as any).integrationSyncLog.create({
      data: {
        accountId: connection.accountId,
        integrationConfigId: connection.id,
        provider: connection.provider,
        direction: "INBOUND",
        entityType: "TRACKING_EVENT",
        status: "ERROR",
        message: `${code}: ${message}`,
      },
    }),
  ]);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function trackingSourceToTransportationSource(source: string): string {
  if (["CARRIER", "TERMINAL", "CBP", "USER", "SYSTEM", "DOCUMENT"].includes(source)) {
    return source;
  }
  return "API";
}

function runtimeConfig(connection: any): ProviderRuntimeConfig {
  return {
    providerKey: connection.trackingProviderDefinition.key,
    connectionId: connection.id,
    connectionKey: connection.connectionKey,
    environment: connection.environment,
    baseUrl: connection.baseUrl,
    config:
      connection.configJson && typeof connection.configJson === "object" && !Array.isArray(connection.configJson)
        ? (connection.configJson as Record<string, unknown>)
        : {},
  };
}

async function assertSignalScope(client: any, connection: any, signal: ProviderSignal) {
  if (!signal.shipmentId) {
    throw new TrackingWebhookError("PAYLOAD_INVALID", 400, "The provider event did not identify a shipment.");
  }

  const shipment = await client.shipment.findFirst({
    where: {
      id: signal.shipmentId,
      accountId: connection.accountId,
      deletedAt: null,
      ...(connection.clientId ? { clientId: connection.clientId } : {}),
    },
    select: { id: true, accountId: true, clientId: true },
  });
  if (!shipment) {
    throw new TrackingWebhookError(
      "SHIPMENT_NOT_FOUND",
      404,
      "No shipment in this connection's account and client scope matches the provider reference."
    );
  }

  const checks: Promise<unknown>[] = [];
  if (signal.legId) {
    checks.push(
      client.shipmentLeg.findFirst({
        where: { id: signal.legId, shipmentId: shipment.id, accountId: shipment.accountId },
        select: { id: true },
      })
    );
  }
  if (signal.equipmentId) {
    checks.push(
      client.shipmentEquipment.findFirst({
        where: { id: signal.equipmentId, shipmentId: shipment.id, accountId: shipment.accountId },
        select: { id: true },
      })
    );
  }
  if (signal.movementId) {
    checks.push(
      client.shipmentMovement.findFirst({
        where: { shipmentId: shipment.id, movementId: signal.movementId, accountId: shipment.accountId },
        select: { id: true },
      })
    );
  }
  if (checks.length && (await Promise.all(checks)).some((result) => !result)) {
    throw new TrackingWebhookError(
      "REFERENCE_OUT_OF_SCOPE",
      422,
      "A leg, equipment, or movement reference is not owned by the resolved shipment."
    );
  }
  return shipment;
}

async function persistSignal(
  client: any,
  connection: any,
  signal: ProviderSignal,
  rules: TrackingEventMappingRule[],
  rawPayloadHash: string,
  rawPayloadRef: string,
  receivedAt: Date
) {
  const shipment = await assertSignalScope(client, connection, signal);
  const mapped = mapProviderEvent(signal.rawEventCode, connection.id, rules);
  if (!mapped) {
    throw new TrackingWebhookError(
      "EVENT_MAPPING_MISSING",
      422,
      `No active event mapping exists for provider code "${signal.rawEventCode}".`
    );
  }

  const providerKey = connection.trackingProviderDefinition.key;
  const providerEventId = `${connection.id}:${signal.providerEventId}`;
  const idempotencyKey = `${connection.id}:${signal.idempotencyKey}`;
  const coordinates = signal.location?.coordinates;

  try {
    return await client.$transaction(async (transaction: any) => {
      const trackingEvent = await transaction.trackingEvent.create({
        data: {
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          legId: signal.legId ?? null,
          equipmentId: signal.equipmentId ?? null,
          eventType: mapped.canonicalEventType,
          classifier: mapped.classifier,
          occurredAt: signal.occurredAt,
          receivedAt,
          sourceUpdatedAt: signal.sourceUpdatedAt ?? null,
          locationName: signal.location?.name ?? signal.location?.city ?? null,
          unlocode: signal.location?.unlocode ?? null,
          latitude: coordinates?.[1] ?? null,
          longitude: coordinates?.[0] ?? null,
          timezone: signal.location?.timezone ?? null,
          provider: providerKey,
          providerEventId,
          sourceType: mapped.sourceType,
          idempotencyKey,
          rawPayloadHash,
          rawPayloadRef,
          normalizedData: {
            mappingId: mapped.mappingId,
            connectionId: connection.id,
            rawEventCode: signal.rawEventCode,
            eventDescription: signal.eventDescription ?? null,
            carrierReference: signal.carrierReference ?? null,
            estimatedArrival: signal.estimatedArrival?.toISOString() ?? null,
          },
        },
      });

      let etaDeltaMinutes: number | null = null;
      if (signal.estimatedArrival) {
        const previous = await transaction.etaObservation.findFirst({
          where: { accountId: shipment.accountId, shipmentId: shipment.id },
          orderBy: { createdAt: "desc" },
          select: { eta: true },
        });
        etaDeltaMinutes = previous?.eta
          ? Math.round((signal.estimatedArrival.getTime() - new Date(previous.eta).getTime()) / 60_000)
          : 0;
        await transaction.etaObservation.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            estimatedAt: signal.sourceUpdatedAt ?? receivedAt,
            eta: signal.estimatedArrival,
            previousEta: previous?.eta ?? null,
            deltaMinutes: etaDeltaMinutes,
            provider: providerKey,
            reasonCode: "PROVIDER_UPDATE",
          },
        });
      }

      const shipmentUpdate: Record<string, Date> = {};
      if (signal.estimatedArrival) shipmentUpdate.estimatedArrival = signal.estimatedArrival;
      if (["PORT_ARRIVED", "CONTAINER_DISCHARGED"].includes(mapped.canonicalEventType)) {
        shipmentUpdate.arrivalDate = signal.occurredAt;
      }
      if (Object.keys(shipmentUpdate).length) {
        await transaction.shipment.updateMany({
          where: { id: shipment.id, accountId: shipment.accountId },
          data: shipmentUpdate,
        });
      }

      await transaction.trackingSubscription.upsert({
        where: {
          accountId_shipmentId_provider: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            provider: providerKey,
          },
        },
        create: {
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          integrationConfigId: connection.id,
          provider: providerKey,
          providerTrackingId: signal.carrierReference ?? null,
          status: "ACTIVE",
          startedAt: receivedAt,
          lastEventAt: signal.occurredAt,
          lastSyncAt: receivedAt,
        },
        update: {
          integrationConfigId: connection.id,
          providerTrackingId: signal.carrierReference ?? undefined,
          status: "ACTIVE",
          lastEventAt: signal.occurredAt,
          lastSyncAt: receivedAt,
          lastErrorAt: null,
          lastErrorCode: null,
          retryCount: 0,
        },
      });

      await transaction.transportationEvent.create({
        data: {
          accountId: shipment.accountId,
          entityType: signal.movementId ? "MOVEMENT" : "SHIPMENT",
          entityId: signal.movementId ?? shipment.id,
          shipmentId: shipment.id,
          movementId: signal.movementId ?? null,
          eventType: mapped.canonicalEventType,
          source: trackingSourceToTransportationSource(mapped.sourceType),
          sourceReference: `${providerKey}:${signal.carrierReference ?? signal.rawEventCode}`,
          occurredAt: signal.occurredAt,
          receivedAt,
          location: signal.location ?? undefined,
          payload: {
            trackingEventId: trackingEvent.id,
            connectionId: connection.id,
            mappingId: mapped.mappingId,
          },
        },
      });

      await transaction.integrationConfig.update({
        where: { id: connection.id },
        data: {
          lastEventAt: signal.occurredAt,
          lastSyncAt: receivedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      return { trackingEvent, etaDeltaMinutes };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return null;
    throw error;
  }
}

export async function ingestTrackingWebhook(
  input: TrackingWebhookIngestionInput,
  dependencies: TrackingWebhookIngestionDependencies = {}
): Promise<TrackingWebhookIngestionResult> {
  const client = dependencies.dbClient ?? db;
  const registry = dependencies.registry ?? createDefaultTrackingProviderRegistry();
  const secretResolver = dependencies.secretResolver ?? new GcpSecretResolver();
  const rawPayloadStore = dependencies.rawPayloadStore ?? defaultRawPayloadStore;
  const evaluateExceptions = dependencies.evaluateExceptions ?? evaluateTrackingExceptions;
  const receivedAt = (dependencies.now ?? (() => new Date()))();

  const connection = await (client as any).integrationConfig.findUnique({
    where: { connectionKey: input.connectionKey },
    include: {
      trackingProviderDefinition: {
        include: {
          eventMappings: {
            where: { active: true },
          },
        },
      },
    },
  });
  if (!connection || connection.category !== "SHIPMENT_TRACKING") {
    throw new TrackingWebhookError("CONNECTION_NOT_FOUND", 404, "Tracking connection not found.");
  }
  if (connection.status !== "ACTIVE") {
    throw new TrackingWebhookError("CONNECTION_INACTIVE", 409, "Tracking connection is not active.");
  }
  const definition = connection.trackingProviderDefinition;
  if (!definition || !["ACTIVE", "PREVIEW"].includes(definition.status)) {
    throw new TrackingWebhookError("PROVIDER_UNAVAILABLE", 409, "Tracking provider is not available.");
  }
  if (!connection.webhookSecretRef) {
    throw new TrackingWebhookError(
      "INVALID_CONFIGURATION",
      500,
      "Tracking connection has no webhook Secret Manager reference."
    );
  }

  const adapter = registry.get(definition.adapterKey);
  const config = runtimeConfig(connection);
  const configErrors = adapter.validateConfig(config);
  if (configErrors.length) {
    throw new TrackingWebhookError("INVALID_CONFIGURATION", 500, configErrors.join(" "));
  }
  const secret = await secretResolver.resolveSecret(connection.webhookSecretRef);
  const request = { rawBody: input.rawBody, headers: input.headers };
  if (!(await adapter.verifyWebhook(request, config, secret))) {
    throw new TrackingWebhookError("SIGNATURE_INVALID", 401, "Webhook signature is invalid.");
  }

  let signals: ProviderSignal[];
  try {
    signals = await adapter.parseWebhook(request, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking provider payload is invalid.";
    throw new TrackingWebhookError("PAYLOAD_INVALID", 400, message);
  }
  if (!signals.length) {
    throw new TrackingWebhookError("PAYLOAD_INVALID", 400, "Tracking provider payload contains no events.");
  }

  const rawPayloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const rawPayloadRef = await rawPayloadStore.store({
    accountId: connection.accountId,
    connectionId: connection.id,
    body: input.rawBody,
    sha256: rawPayloadHash,
  });
  const rules = definition.eventMappings as TrackingEventMappingRule[];
  const trackingEventIds: string[] = [];
  let duplicates = 0;

  for (const signal of signals) {
    const persisted = await persistSignal(
      client,
      connection,
      signal,
      rules,
      rawPayloadHash,
      rawPayloadRef,
      receivedAt
    );
    if (!persisted) {
      duplicates += 1;
      continue;
    }
    trackingEventIds.push(persisted.trackingEvent.id);
    if (typeof persisted.etaDeltaMinutes === "number" && persisted.etaDeltaMinutes !== 0) {
      await evaluateExceptions({
        accountId: connection.accountId,
        shipmentId: signal.shipmentId!,
        etaDeltaMinutes: persisted.etaDeltaMinutes,
      }).catch(() => null);
    }
  }

  await (client as any).integrationSyncLog.create({
    data: {
      accountId: connection.accountId,
      integrationConfigId: connection.id,
      provider: definition.key,
      direction: "INBOUND",
      entityType: "TRACKING_EVENT",
      status: "SUCCESS",
      message: `${trackingEventIds.length} processed, ${duplicates} duplicate`,
      responseJson: { processed: trackingEventIds.length, duplicates, rawPayloadHash },
    },
  });

  return {
    status: trackingEventIds.length ? "PROCESSED" : "DUPLICATE",
    processed: trackingEventIds.length,
    duplicates,
    trackingEventIds,
  };
}

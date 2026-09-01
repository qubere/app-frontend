import { db } from "@qubere/db";
import { createDefaultTrackingProviderRegistry, type TrackingProviderRegistry } from "@qubere/tracking";

type DbClient = typeof db;

export type TrackingConnectionStatus = "ACTIVE" | "INACTIVE" | "ERROR";

export interface ConfigureTrackingConnectionInput {
  accountId: string;
  clientId?: string | null;
  providerDefinitionId: string;
  name: string;
  status?: TrackingConnectionStatus;
  environment?: "PRODUCTION" | "SANDBOX";
  baseUrl?: string | null;
  config?: Record<string, unknown>;
  credentialRef?: string | null;
  webhookSecretRef: string;
  priority?: number;
  isDefault?: boolean;
}

export interface TrackingConnectionDependencies {
  dbClient?: DbClient;
  registry?: TrackingProviderRegistry;
}

export type TrackingConnectionErrorCode =
  | "PROVIDER_NOT_AVAILABLE"
  | "ADAPTER_NOT_DEPLOYED"
  | "CLIENT_NOT_FOUND"
  | "INVALID_PROVIDER_CONFIG";

export class TrackingConnectionError extends Error {
  constructor(
    readonly code: TrackingConnectionErrorCode,
    readonly status: number,
    message: string,
    readonly issues?: string[]
  ) {
    super(message);
    this.name = "TrackingConnectionError";
  }
}

export async function listTrackingProviderDefinitions(
  dependencies: Pick<TrackingConnectionDependencies, "dbClient"> = {}
) {
  const client = dependencies.dbClient ?? db;
  return (client as any).trackingProviderDefinition.findMany({
    where: { status: { in: ["ACTIVE", "PREVIEW"] } },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      key: true,
      displayName: true,
      adapterKey: true,
      status: true,
      authType: true,
      supportedModes: true,
      capabilities: true,
      documentationUrl: true,
      operationalNotes: true,
      configSchema: true,
    },
  });
}

export async function configureTrackingConnection(
  input: ConfigureTrackingConnectionInput,
  dependencies: TrackingConnectionDependencies = {}
) {
  const client = dependencies.dbClient ?? db;
  const registry = dependencies.registry ?? createDefaultTrackingProviderRegistry();
  const provider = await (client as any).trackingProviderDefinition.findFirst({
    where: { id: input.providerDefinitionId, status: { in: ["ACTIVE", "PREVIEW"] } },
  });
  if (!provider) {
    throw new TrackingConnectionError("PROVIDER_NOT_AVAILABLE", 404, "Tracking provider is not available.");
  }
  if (!registry.has(provider.adapterKey)) {
    throw new TrackingConnectionError(
      "ADAPTER_NOT_DEPLOYED",
      409,
      "The selected provider adapter is not deployed in this release."
    );
  }
  if (input.clientId) {
    const scopedClient = await (client as any).client.findFirst({
      where: { id: input.clientId, accountId: input.accountId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!scopedClient) {
      throw new TrackingConnectionError("CLIENT_NOT_FOUND", 404, "Client is not active in this account.");
    }
  }

  const adapter = registry.get(provider.adapterKey);
  const config = input.config ?? {};
  const configErrors = adapter.validateConfig({
    providerKey: provider.key,
    connectionId: "pending",
    connectionKey: "pending",
    environment: input.environment ?? "PRODUCTION",
    baseUrl: input.baseUrl ?? null,
    config,
  });
  if (configErrors.length) {
    throw new TrackingConnectionError(
      "INVALID_PROVIDER_CONFIG",
      400,
      "Tracking provider configuration is invalid.",
      configErrors
    );
  }

  const existing = await (client as any).integrationConfig.findFirst({
    where: {
      accountId: input.accountId,
      category: "SHIPMENT_TRACKING",
      provider: provider.key,
      clientId: input.clientId ?? null,
    },
    select: { id: true },
  });
  const data = {
    accountId: input.accountId,
    clientId: input.clientId ?? null,
    category: "SHIPMENT_TRACKING",
    provider: provider.key,
    name: input.name,
    status: input.status ?? "ACTIVE",
    trackingProviderDefinitionId: provider.id,
    credentialRef: input.credentialRef ?? null,
    webhookSecretRef: input.webhookSecretRef,
    baseUrl: input.baseUrl ?? null,
    environment: input.environment ?? "PRODUCTION",
    configJson: config,
    priority: input.priority ?? 100,
    isDefault: input.isDefault ?? false,
    apiKey: null,
    apiSecret: null,
  };
  const include = {
    client: { select: { id: true, name: true } },
    trackingProviderDefinition: {
      select: { id: true, key: true, displayName: true, adapterKey: true, status: true, capabilities: true },
    },
  };

  if (existing) {
    await (client as any).integrationConfig.updateMany({
      where: { id: existing.id, accountId: input.accountId, category: "SHIPMENT_TRACKING" },
      data,
    });
    return (client as any).integrationConfig.findUnique({ where: { id: existing.id }, include });
  }
  return (client as any).integrationConfig.create({ data, include });
}

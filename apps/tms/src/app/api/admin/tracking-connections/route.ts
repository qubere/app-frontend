import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { createDefaultTrackingProviderRegistry } from "@qubere/tracking";

const createConnectionSchema = z.object({
  providerDefinitionId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  clientId: z.string().trim().min(1).nullable().optional(),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).default("PRODUCTION"),
  baseUrl: z.url().nullable().optional(),
  webhookSecretRef: z.string().trim().min(1).max(500),
  credentialRef: z.string().trim().max(500).nullable().optional(),
  configJson: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
});

function presentConnection(connection: any) {
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    status: connection.status,
    clientId: connection.clientId,
    clientName: connection.client?.name ?? null,
    environment: connection.environment,
    isDefault: connection.isDefault,
    hasCredentialRef: Boolean(connection.credentialRef),
    hasWebhookSecretRef: Boolean(connection.webhookSecretRef),
    callbackPath: connection.connectionKey
      ? `/api/webhooks/tracking/${connection.connectionKey}`
      : null,
    lastSyncAt: connection.lastSyncAt,
    lastEventAt: connection.lastEventAt,
    lastHealthCheckAt: connection.lastHealthCheckAt,
    lastErrorAt: connection.lastErrorAt,
    lastErrorMessage: connection.lastErrorMessage,
    providerDefinition: connection.trackingProviderDefinition,
  };
}

export const GET = withAuthenticatedRoute(
  async ({ ctx }: any) => {
    const [providers, connections, clients] = await Promise.all([
      (db as any).trackingProviderDefinition.findMany({
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
      }),
      (db as any).integrationConfig.findMany({
        where: { accountId: ctx.accountId, category: "SHIPMENT_TRACKING" },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
        include: {
          client: { select: { id: true, name: true } },
          trackingProviderDefinition: {
            select: { id: true, key: true, displayName: true, status: true, capabilities: true },
          },
        },
      }),
      db.client.findMany({
        where: { accountId: ctx.accountId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      accountName: ctx.accountName,
      providers,
      connections: connections.map(presentConnection),
      clients,
    });
  },
  { permission: "integration.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    const parsed = createConnectionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_CONNECTION", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const provider = await (db as any).trackingProviderDefinition.findFirst({
      where: { id: input.providerDefinitionId, status: { in: ["ACTIVE", "PREVIEW"] } },
    });
    if (!provider) {
      return NextResponse.json({ error: "PROVIDER_NOT_AVAILABLE" }, { status: 404 });
    }
    if (input.clientId) {
      const client = await db.client.findFirst({
        where: { id: input.clientId, accountId: ctx.accountId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!client) return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
    }

    const registry = createDefaultTrackingProviderRegistry();
    if (!registry.has(provider.adapterKey)) {
      return NextResponse.json(
        { error: "ADAPTER_NOT_DEPLOYED", message: "The provider adapter is not deployed in this release." },
        { status: 409 }
      );
    }
    const adapter = registry.get(provider.adapterKey);
    const configErrors = adapter.validateConfig({
      providerKey: provider.key,
      connectionId: "pending",
      connectionKey: "pending",
      environment: input.environment,
      baseUrl: input.baseUrl,
      config: input.configJson,
    });
    if (configErrors.length) {
      return NextResponse.json({ error: "INVALID_PROVIDER_CONFIG", issues: configErrors }, { status: 400 });
    }

    const connection = await (db as any).integrationConfig.create({
      data: {
        accountId: ctx.accountId,
        clientId: input.clientId ?? null,
        category: "SHIPMENT_TRACKING",
        provider: provider.key,
        name: input.name,
        status: "ACTIVE",
        trackingProviderDefinitionId: provider.id,
        credentialRef: input.credentialRef ?? null,
        webhookSecretRef: input.webhookSecretRef,
        baseUrl: input.baseUrl ?? null,
        environment: input.environment,
        configJson: input.configJson,
        isDefault: input.isDefault,
      },
      include: {
        client: { select: { id: true, name: true } },
        trackingProviderDefinition: {
          select: { id: true, key: true, displayName: true, status: true, capabilities: true },
        },
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TRACKING_CONNECTION_CREATED",
      entity: "IntegrationConfig",
      entityId: connection.id,
      source: "UI",
      metadata: {
        provider: provider.key,
        clientId: input.clientId ?? null,
        environment: input.environment,
        adapterKey: provider.adapterKey,
      },
    });

    return NextResponse.json({ connection: presentConnection(connection) }, { status: 201 });
  },
  { permission: "integration.configure", write: true }
);

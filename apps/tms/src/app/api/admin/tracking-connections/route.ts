import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import {
  configureTrackingConnection,
  listTrackingProviderDefinitions,
  TrackingConnectionError,
} from "@qubere/tracking-platform";

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
      listTrackingProviderDefinitions({ dbClient: db }),
      db.integrationConfig.findMany({
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
    let connection: any;
    try {
      connection = await configureTrackingConnection(
        {
          accountId: ctx.accountId,
          clientId: input.clientId,
          providerDefinitionId: input.providerDefinitionId,
          name: input.name,
          environment: input.environment,
          baseUrl: input.baseUrl,
          webhookSecretRef: input.webhookSecretRef,
          credentialRef: input.credentialRef,
          config: input.configJson,
          isDefault: input.isDefault,
        },
        { dbClient: db }
      );
    } catch (error) {
      if (error instanceof TrackingConnectionError) {
        return NextResponse.json(
          { error: error.code, message: error.message, issues: error.issues },
          { status: error.status }
        );
      }
      throw error;
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TRACKING_CONNECTION_CREATED",
      entity: "IntegrationConfig",
      entityId: connection.id,
      source: "UI",
      metadata: {
        provider: connection.provider,
        clientId: input.clientId ?? null,
        environment: input.environment,
        adapterKey: connection.trackingProviderDefinition?.adapterKey,
      },
    });

    return NextResponse.json({ connection: presentConnection(connection) }, { status: 201 });
  },
  { permission: "integration.configure", write: true }
);

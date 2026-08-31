import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

function maskSecret(secret?: string | null): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `••••••••${secret.slice(-4)}`;
}

const saveIntegrationSchema = z.object({
  category: z.enum(["ERP", "ACCOUNTING", "SHIPMENT_TRACKING"]),
  provider: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  clientId: z.string().optional().nullable(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  baseUrl: z.string().optional(),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).default("PRODUCTION"),
  configJson: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).default("ACTIVE"),
  providerDefinitionId: z.string().optional().nullable(),
  credentialRef: z.string().optional().nullable(),
  webhookSecretRef: z.string().optional().nullable(),
});

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const [configs, clients, trackingProviders] = await Promise.all([
    (db as any).integrationConfig.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        trackingProviderDefinition: {
          select: { id: true, key: true, displayName: true, status: true, capabilities: true },
        },
        _count: { select: { payloads: true } },
      },
    }),
    db.client.findMany({
      where: { accountId: ctx.accountId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    (db as any).trackingProviderDefinition.findMany({
      where: { status: { in: ["ACTIVE", "PREVIEW"] } },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        key: true,
        displayName: true,
        adapterKey: true,
        status: true,
        authType: true,
        supportedModes: true,
        capabilities: true,
        operationalNotes: true,
      },
    }),
  ]);

  const formattedConfigs = configs.map((c: any) => ({
    id: c.id,
    category: c.category,
    provider: c.provider,
    name: c.name,
    status: c.status,
    clientId: c.clientId,
    clientName: c.client?.name ?? null,
    baseUrl: c.baseUrl ?? "",
    environment: c.environment,
    apiKeyMasked: maskSecret(c.apiKey),
    hasApiKey: Boolean(c.apiKey),
    hasApiSecret: Boolean(c.apiSecret),
    configJson: (c.configJson as Record<string, unknown>) ?? {},
    lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
    lastErrorAt: c.lastErrorAt ? c.lastErrorAt.toISOString() : null,
    lastErrorMessage: c.lastErrorMessage,
    payloadCount: c._count.payloads,
    providerDefinitionId: c.trackingProviderDefinitionId ?? null,
    providerDefinition: c.trackingProviderDefinition ?? null,
    hasCredentialRef: Boolean(c.credentialRef),
    hasWebhookSecretRef: Boolean(c.webhookSecretRef),
    callbackPath: c.connectionKey ? `/api/webhooks/tracking/${c.connectionKey}` : null,
    createdAt: c.createdAt.toISOString(),
  }));

  const formattedClients = clients.map((cl) => ({
    id: cl.id,
    name: cl.name,
  }));

  return NextResponse.json({
    accountName: ctx.accountName,
    integrations: formattedConfigs,
    trackingProviders,
    clients: formattedClients,
    requestId,
  });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
  }

  const parsed = saveIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues, requestId },
      { status: 400 }
    );
  }

  const { category, providerDefinitionId, credentialRef, webhookSecretRef, name, clientId, apiKey, apiSecret, baseUrl, environment, configJson, status } = parsed.data;

  const targetClientId = clientId && clientId.trim().length > 0 ? clientId.trim() : null;

  if (targetClientId) {
    const validClient = await db.client.findFirst({
      where: { id: targetClientId, accountId: ctx.accountId },
    });
    if (!validClient) {
      return NextResponse.json({ error: "Specified client does not exist or belong to your account", requestId }, { status: 400 });
    }
  }

  let provider = parsed.data.provider;
  let trackingProvider: any = null;
  if (category === "SHIPMENT_TRACKING") {
    if (!providerDefinitionId || !webhookSecretRef) {
      return NextResponse.json(
        { error: "Tracking connections require a provider definition and webhook Secret Manager reference", requestId },
        { status: 400 }
      );
    }
    trackingProvider = await (db as any).trackingProviderDefinition.findFirst({
      where: { id: providerDefinitionId, status: { in: ["ACTIVE", "PREVIEW"] } },
    });
    if (!trackingProvider) {
      return NextResponse.json({ error: "Tracking provider is not available", requestId }, { status: 404 });
    }
    provider = trackingProvider.key;
  }

  const existing = await db.integrationConfig.findFirst({
    where: { accountId: ctx.accountId, provider, clientId: targetClientId },
  });

  const finalApiKey = category === "SHIPMENT_TRACKING" ? null : apiKey && !apiKey.startsWith("••••") ? apiKey : existing?.apiKey ?? null;
  const finalApiSecret = category === "SHIPMENT_TRACKING" ? null : apiSecret && !apiSecret.startsWith("••••") ? apiSecret : existing?.apiSecret ?? null;
  const jsonInput = (configJson ?? {}) as Prisma.InputJsonValue;

  const config = existing
    ? await (db as any).integrationConfig.update({
        where: { id: existing.id },
        data: {
          category,
          name,
          status,
          clientId: targetClientId,
          apiKey: finalApiKey,
          apiSecret: finalApiSecret,
          baseUrl: baseUrl ?? null,
          environment,
          configJson: jsonInput,
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
          trackingProviderDefinitionId: trackingProvider?.id ?? null,
          credentialRef: category === "SHIPMENT_TRACKING" ? credentialRef ?? null : null,
          webhookSecretRef: category === "SHIPMENT_TRACKING" ? webhookSecretRef ?? null : null,
        },
      })
    : await (db as any).integrationConfig.create({
        data: {
          accountId: ctx.accountId,
          clientId: targetClientId,
          category,
          provider,
          name,
          status,
          apiKey: finalApiKey,
          apiSecret: finalApiSecret,
          baseUrl: baseUrl ?? null,
          environment,
          configJson: jsonInput,
          lastSyncAt: new Date(),
          trackingProviderDefinitionId: trackingProvider?.id ?? null,
          credentialRef: category === "SHIPMENT_TRACKING" ? credentialRef ?? null : null,
          webhookSecretRef: category === "SHIPMENT_TRACKING" ? webhookSecretRef ?? null : null,
        },
      });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "INTEGRATION_CONFIGURED",
    entity: "IntegrationConfig",
    entityId: config.id,
    source: "UI",
    metadata: {
      provider,
      category,
      name,
      clientId: targetClientId,
      environment,
      providerDefinitionId: trackingProvider?.id ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    integration: {
      id: config.id,
      category: config.category,
      provider: config.provider,
      name: config.name,
      status: config.status,
      clientId: config.clientId,
      baseUrl: config.baseUrl ?? "",
      environment: config.environment,
      apiKeyMasked: category === "SHIPMENT_TRACKING" ? "" : maskSecret(config.apiKey),
      configJson: (config.configJson as Record<string, unknown>) ?? {},
      lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
    },
  });
});

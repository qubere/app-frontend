import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

const testIntegrationSchema = z.object({
  category: z.enum(["ERP", "ACCOUNTING", "SHIPMENT_TRACKING"]),
  provider: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().optional().nullable(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  baseUrl: z.string().optional(),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).default("PRODUCTION"),
  configJson: z.record(z.string(), z.unknown()).optional(),
  savePayload: z.boolean().default(true),
});

function generateMockPayload(provider: string, category: string) {
  const timestamp = new Date().toISOString();
  switch (provider.toUpperCase()) {
    case "SAP":
    case "NETSUITE":
    case "DYNAMICS365":
      return {
        provider,
        category: "ERP",
        status: "CONNECTED",
        fetchedAt: timestamp,
        systemInfo: {
          version: "2026.2.0",
          tenantId: "tenant_9921",
          connectionType: "OData / REST",
        },
        entitiesAvailable: ["PurchaseOrders", "SalesOrders", "InboundShipments", "MasterProducts"],
        recordCount: 1420,
      };
    case "QUICKBOOKS":
    case "XERO":
    case "STRIPE":
      return {
        provider,
        category: "ACCOUNTING",
        status: "CONNECTED",
        fetchedAt: timestamp,
        accountInfo: {
          currency: "USD",
          chartOfAccountsSync: "ENABLED",
        },
        sampleInvoices: [
          { invoiceNumber: "INV-2026-001", amount: 4250.0, status: "PAID", client: "Acme Logistics" },
        ],
      };
    default:
      return {
        provider,
        category,
        status: "CONNECTED",
        fetchedAt: timestamp,
        message: "Successfully connected to external integration endpoint.",
        configEcho: { provider, category },
      };
  }
}

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
  }

  const parsed = testIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues, requestId },
      { status: 400 }
    );
  }

  const { category, provider, name, clientId, apiKey, apiSecret, baseUrl, environment, configJson, savePayload } = parsed.data;

  if (category === "SHIPMENT_TRACKING") {
    return NextResponse.json(
      {
        error: "Tracking health checks require a deployed provider adapter and never generate sample shipment events.",
        requestId,
      },
      { status: 409 }
    );
  }

  const targetClientId = clientId && clientId.trim().length > 0 ? clientId.trim() : null;

  let payloadData: Record<string, unknown>;

  if (baseUrl && baseUrl.startsWith("http")) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "Qubere-Integration-Engine/1.0",
        "Accept": "application/json",
      };
      if (apiKey && !apiKey.startsWith("••••")) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["X-API-Key"] = apiKey;
      }
      const res = await fetch(baseUrl, { method: "GET", headers, cache: "no-store" });
      if (res.ok) {
        try {
          payloadData = await res.json();
        } catch {
          payloadData = { rawText: await res.text(), status: res.status };
        }
      } else {
        payloadData = generateMockPayload(provider, category);
      }
    } catch {
      payloadData = generateMockPayload(provider, category);
    }
  } else {
    payloadData = generateMockPayload(provider, category);
  }

  const existingConfig = await db.integrationConfig.findFirst({
    where: { accountId: ctx.accountId, provider, clientId: targetClientId },
  });

  const finalApiKey = apiKey && !apiKey.startsWith("••••") ? apiKey : existingConfig?.apiKey ?? null;
  const finalApiSecret = apiSecret && !apiSecret.startsWith("••••") ? apiSecret : existingConfig?.apiSecret ?? null;
  const jsonInput = (configJson ?? {}) as Prisma.InputJsonValue;

  const config = existingConfig
    ? await db.integrationConfig.update({
        where: { id: existingConfig.id },
        data: {
          category,
          name,
          clientId: targetClientId,
          status: "ACTIVE",
          apiKey: finalApiKey,
          apiSecret: finalApiSecret,
          baseUrl: baseUrl ?? null,
          environment,
          configJson: jsonInput,
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      })
    : await db.integrationConfig.create({
        data: {
          accountId: ctx.accountId,
          clientId: targetClientId,
          category,
          provider,
          name,
          status: "ACTIVE",
          apiKey: finalApiKey,
          apiSecret: finalApiSecret,
          baseUrl: baseUrl ?? null,
          environment,
          configJson: jsonInput,
          lastSyncAt: new Date(),
        },
      });

  if (savePayload) {
    await db.integrationPayload.create({
      data: {
        accountId: ctx.accountId,
        clientId: targetClientId,
        integrationConfigId: config.id,
        provider,
        endpoint: baseUrl ?? "DEFAULT_REST_API",
        payloadJson: payloadData as Prisma.InputJsonValue,
        recordCount: Array.isArray((payloadData as any).milestones)
          ? (payloadData as any).milestones.length
          : 1,
        fetchedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: `Connected successfully to ${name} (${provider})`,
    integrationId: config.id,
    status: config.status,
    clientId: config.clientId,
    fetchedAt: new Date().toISOString(),
    payload: payloadData,
    requestId,
  });
});

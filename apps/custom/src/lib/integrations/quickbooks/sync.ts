import type { IntegrationConfig } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getQboConfig, QBO_PROVIDER } from "./config";
import { ensureFreshToken, qboApiFetch, qboQuery, type QboAuth } from "./client";
import { mapInvoiceToQbo, type QubereInvoiceInput } from "./mapInvoice";

const SERVICE_ITEM_NAME = "Customs Brokerage Services";

export interface QboInvoiceSource extends QubereInvoiceInput {
  id: string;
  client: { id: string; name: string; contactEmail?: string | null };
}

interface SyncLogInput {
  accountId: string;
  integrationConfigId: string;
  direction: "OUTBOUND" | "INBOUND";
  entityType: "INVOICE" | "CUSTOMER" | "PAYMENT";
  qubereId?: string;
  providerId?: string;
  status: "SUCCESS" | "ERROR";
  message?: string;
  requestJson?: unknown;
  responseJson?: unknown;
  durationMs?: number;
}

async function writeSyncLog(input: SyncLogInput): Promise<void> {
  await db.integrationSyncLog.create({
    data: {
      accountId: input.accountId,
      integrationConfigId: input.integrationConfigId,
      provider: QBO_PROVIDER,
      direction: input.direction,
      entityType: input.entityType,
      qubereId: input.qubereId ?? null,
      providerId: input.providerId ?? null,
      status: input.status,
      message: input.message?.slice(0, 2000) ?? null,
      requestJson: (input.requestJson ?? undefined) as Prisma.InputJsonValue | undefined,
      responseJson: (input.responseJson ?? undefined) as Prisma.InputJsonValue | undefined,
      durationMs: input.durationMs ?? null,
    },
  });
}

async function findEntityMap(
  cfg: IntegrationConfig,
  qubereType: "INVOICE" | "CUSTOMER",
  qubereId: string,
) {
  return db.integrationEntityMap.findUnique({
    where: {
      provider_realmId_qubereType_qubereId: {
        provider: QBO_PROVIDER,
        realmId: cfg.realmId!,
        qubereType,
        qubereId,
      },
    },
  });
}

async function upsertEntityMap(
  cfg: IntegrationConfig,
  params: {
    qubereType: "INVOICE" | "CUSTOMER";
    qubereId: string;
    providerType: string;
    providerId: string;
    syncToken?: string | null;
  },
) {
  const key = {
    provider_realmId_qubereType_qubereId: {
      provider: QBO_PROVIDER,
      realmId: cfg.realmId!,
      qubereType: params.qubereType,
      qubereId: params.qubereId,
    },
  };
  const base = {
    providerType: params.providerType,
    providerId: params.providerId,
    syncToken: params.syncToken ?? null,
    lastSyncedAt: new Date(),
  };
  await db.integrationEntityMap.upsert({
    where: key,
    create: {
      accountId: cfg.accountId,
      integrationConfigId: cfg.id,
      provider: QBO_PROVIDER,
      realmId: cfg.realmId!,
      qubereType: params.qubereType,
      qubereId: params.qubereId,
      ...base,
    },
    update: base,
  });
}

/** Find (or lazily create) the generic income account + service item used for
 * every synced brokerage line. */
async function ensureServiceItem(auth: QboAuth): Promise<string> {
  const existing = await qboQuery(
    auth,
    `SELECT Id FROM Item WHERE Name = '${SERVICE_ITEM_NAME.replace(/'/g, "\\'")}'`,
  );
  const found = (existing.QueryResponse?.Item as Array<{ Id: string }> | undefined)?.[0];
  if (found) return found.Id;

  const incomeAccounts = await qboQuery(
    auth,
    "SELECT Id, Name FROM Account WHERE AccountType = 'Income' ORDERBY Name",
  );
  const accounts = (incomeAccounts.QueryResponse?.Account as Array<{ Id: string; Name: string }> | undefined) ?? [];
  if (accounts.length === 0) {
    throw new Error("No Income account exists in this QuickBooks company; cannot create a service item.");
  }
  const incomeAccount =
    accounts.find((a) => /service/i.test(a.Name)) ?? accounts[0];

  const created = await qboApiFetch<{ Item: { Id: string } }>({
    auth,
    path: "/item",
    method: "POST",
    body: {
      Name: SERVICE_ITEM_NAME,
      Type: "Service",
      IncomeAccountRef: { value: incomeAccount.Id },
    },
  });
  return created.Item.Id;
}

async function ensureCustomer(
  cfg: IntegrationConfig,
  auth: QboAuth,
  client: { id: string; name: string; contactEmail?: string | null },
): Promise<string> {
  const mapped = await findEntityMap(cfg, "CUSTOMER", client.id);
  if (mapped) return mapped.providerId;

  const started = Date.now();
  const escapedName = client.name.replace(/'/g, "\\'");
  const query = await qboQuery(auth, `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${escapedName}'`);
  const existing = (query.QueryResponse?.Customer as Array<{ Id: string }> | undefined)?.[0];

  let providerId: string;
  if (existing) {
    providerId = existing.Id;
  } else {
    const created = await qboApiFetch<{ Customer: { Id: string } }>({
      auth,
      path: "/customer",
      method: "POST",
      body: {
        DisplayName: client.name,
        ...(client.contactEmail ? { PrimaryEmailAddr: { Address: client.contactEmail } } : {}),
      },
    });
    providerId = created.Customer.Id;
  }

  await upsertEntityMap(cfg, {
    qubereType: "CUSTOMER",
    qubereId: client.id,
    providerType: "Customer",
    providerId,
  });
  await writeSyncLog({
    accountId: cfg.accountId,
    integrationConfigId: cfg.id,
    direction: "OUTBOUND",
    entityType: "CUSTOMER",
    qubereId: client.id,
    providerId,
    status: "SUCCESS",
    message: existing ? "Matched existing QuickBooks customer" : "Created QuickBooks customer",
    durationMs: Date.now() - started,
  });
  return providerId;
}

export interface PushInvoiceResult {
  providerId: string;
  docNumber: string;
  deepLink: string;
  reused: boolean;
  totalsReconcile: boolean;
}

function invoiceDeepLink(txnId: string): string {
  const { environment } = getQboConfig();
  const host =
    environment === "production" ? "https://app.qbo.intuit.com" : "https://app.sandbox.qbo.intuit.com";
  return `${host}/app/invoice?txnId=${txnId}`;
}

/**
 * Pushes a Qubere invoice into QuickBooks Online. Idempotent: if the invoice
 * was already synced, returns the existing QBO record without creating a
 * duplicate. Must run inside the connection account's dataMode / accountId
 * context.
 */
export async function pushInvoiceToQbo(params: {
  cfg: IntegrationConfig;
  invoice: QboInvoiceSource;
}): Promise<PushInvoiceResult> {
  const { cfg, invoice } = params;
  const started = Date.now();

  const existingMap = await findEntityMap(cfg, "INVOICE", invoice.id);
  if (existingMap) {
    return {
      providerId: existingMap.providerId,
      docNumber: invoice.invoiceNumber.slice(0, 21),
      deepLink: invoiceDeepLink(existingMap.providerId),
      reused: true,
      totalsReconcile: true,
    };
  }

  let payloadForLog: unknown;
  try {
    const auth = await ensureFreshToken(cfg);
    const [customerId, itemId] = [
      await ensureCustomer(cfg, auth, invoice.client),
      await ensureServiceItem(auth),
    ];

    const mapped = mapInvoiceToQbo(invoice, { customerId, itemId });
    payloadForLog = mapped.payload;

    const created = await qboApiFetch<{ Invoice: { Id: string; SyncToken: string; DocNumber?: string } }>({
      auth,
      path: "/invoice",
      method: "POST",
      body: mapped.payload,
    });

    const providerId = created.Invoice.Id;
    await upsertEntityMap(cfg, {
      qubereType: "INVOICE",
      qubereId: invoice.id,
      providerType: "Invoice",
      providerId,
      syncToken: created.Invoice.SyncToken,
    });

    await db.integrationConfig.update({
      where: { id: cfg.id },
      data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
    });

    await writeSyncLog({
      accountId: cfg.accountId,
      integrationConfigId: cfg.id,
      direction: "OUTBOUND",
      entityType: "INVOICE",
      qubereId: invoice.id,
      providerId,
      status: "SUCCESS",
      message: mapped.totalsReconcile
        ? "Invoice created in QuickBooks"
        : "Invoice created in QuickBooks (WARNING: line totals did not reconcile to the Qubere total)",
      requestJson: mapped.payload,
      responseJson: created.Invoice,
      durationMs: Date.now() - started,
    });

    return {
      providerId,
      docNumber: created.Invoice.DocNumber ?? invoice.invoiceNumber.slice(0, 21),
      deepLink: invoiceDeepLink(providerId),
      reused: false,
      totalsReconcile: mapped.totalsReconcile,
    };
  } catch (err) {
    const message = (err as Error).message ?? "Unknown error";
    await db.integrationConfig.update({
      where: { id: cfg.id },
      data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 500) },
    });
    await writeSyncLog({
      accountId: cfg.accountId,
      integrationConfigId: cfg.id,
      direction: "OUTBOUND",
      entityType: "INVOICE",
      qubereId: invoice.id,
      status: "ERROR",
      message,
      requestJson: payloadForLog,
      durationMs: Date.now() - started,
    });
    throw err;
  }
}

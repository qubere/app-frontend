import { describe, expect, it, vi } from "vitest";
import { configureTrackingConnection, TrackingConnectionError } from "./connections";

vi.mock("@qubere/db", () => ({ db: {} }));

function provider() {
  return {
    id: "provider-definition-1",
    key: "GENERIC_WEBHOOK",
    adapterKey: "GENERIC_WEBHOOK_V1",
    status: "ACTIVE",
  };
}

function dbMock(existingId: string | null = null) {
  const created = {
    id: existingId ?? "connection-1",
    accountId: "account-1",
    clientId: "client-1",
    category: "SHIPMENT_TRACKING",
    provider: "GENERIC_WEBHOOK",
    connectionKey: "callback-key",
  };
  return {
    trackingProviderDefinition: { findFirst: vi.fn().mockResolvedValue(provider()) },
    client: { findFirst: vi.fn().mockResolvedValue({ id: "client-1" }) },
    integrationConfig: {
      findFirst: vi.fn().mockResolvedValue(existingId ? { id: existingId } : null),
      findUnique: vi.fn().mockResolvedValue(created),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ ...created, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
}

const input = {
  accountId: "account-1",
  clientId: "client-1",
  providerDefinitionId: "provider-definition-1",
  name: "Broker carrier feed",
  webhookSecretRef: "projects/demo/secrets/tracking-hook/versions/latest",
  credentialRef: "projects/demo/secrets/tracking-api/versions/latest",
  environment: "PRODUCTION" as const,
  config: { signatureMode: "HMAC_SHA256" },
};

describe("tracking connection commands", () => {
  it("creates a tenant/client-scoped connection with references rather than plaintext credentials", async () => {
    const dbClient = dbMock();
    const result = await configureTrackingConnection(input, { dbClient });

    expect(result.connectionKey).toBe("callback-key");
    expect(dbClient.client.findFirst).toHaveBeenCalledWith({
      where: { id: "client-1", accountId: "account-1", status: "ACTIVE" },
      select: { id: true },
    });
    expect(dbClient.integrationConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          clientId: "client-1",
          category: "SHIPMENT_TRACKING",
          provider: "GENERIC_WEBHOOK",
          apiKey: null,
          apiSecret: null,
          webhookSecretRef: input.webhookSecretRef,
          credentialRef: input.credentialRef,
        }),
      })
    );
    expect(dbClient.integrationConfig.create.mock.calls[0][0].data).not.toHaveProperty("lastSyncAt");
  });

  it("updates the existing scoped provider connection without rotating its callback key", async () => {
    const dbClient = dbMock("connection-existing");
    await configureTrackingConnection({ ...input, name: "Updated feed" }, { dbClient });

    expect(dbClient.integrationConfig.create).not.toHaveBeenCalled();
    expect(dbClient.integrationConfig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "connection-existing",
          accountId: "account-1",
          category: "SHIPMENT_TRACKING",
        },
      })
    );
  });

  it("rejects a client that is not active inside the connection account", async () => {
    const dbClient = dbMock();
    dbClient.client.findFirst.mockResolvedValue(null);

    await expect(configureTrackingConnection(input, { dbClient })).rejects.toMatchObject({
      code: "CLIENT_NOT_FOUND",
      status: 404,
    } satisfies Partial<TrackingConnectionError>);
    expect(dbClient.integrationConfig.create).not.toHaveBeenCalled();
  });
});

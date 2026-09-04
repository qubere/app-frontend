import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function source(relative: string): Promise<string> {
  return readFile(new URL(`../${relative}`, import.meta.url), "utf8");
}

describe("merged document repository", () => {
  it("keeps one Documents navigation item and redirects the legacy repository URL", async () => {
    const navigation = await source("src/lib/navigation.ts");
    const legacyPage = await source("src/app/app/trade-repository/page.tsx");

    expect(navigation).toContain('href: "/app/documents"');
    expect(navigation).not.toContain('href: "/app/trade-repository"');
    expect(legacyPage).toContain('redirect("/app/documents")');
  });

  it("shows an explicit parsed-content search action and linked-record filter", async () => {
    const client = await source("src/app/app/documents/DocumentsClient.tsx");

    expect(client).toContain("Search documents");
    expect(client).toContain("Search every parsed field, file, client, or shipment");
    expect(client).toContain("linkedEntityType");
    expect(client).toContain("/api/documents?");
  });

  it("reads uploader and direct-client attribution into the Documents UI", async () => {
    const page = await source("src/app/app/documents/page.tsx");
    const api = await source("src/app/api/documents/route.ts");
    const client = await source("src/app/app/documents/DocumentsClient.tsx");

    expect(page).toContain("uploadedByName: true");
    expect(page).toContain("uploadedByEmail: true");
    expect(page).toContain("client: { select: { id: true, name: true } }");
    expect(api).toContain("uploadedByName: doc.uploadedByName");
    expect(api).toContain("clientId: doc.clientId ?? doc.shipment?.clientId ?? null");
    expect(client).toContain("sourceLabel: resolveSourceLabel(d)");
  });
});

describe("document capture attribution", () => {
  it("stamps manual uploader identity and the deterministic client on upload", async () => {
    const upload = await source("src/app/api/documents/upload/route.ts");

    expect(upload).toContain("uploadedByUserId: userId");
    expect(upload).toContain("clientId: targetClientId");
    expect(upload).toContain("const isClientScopedUser = !ctx.isAllClients");
    expect(upload).toContain("OR: [{ clientId: targetClientId }, { clientId: null }]");
    expect(upload).toContain("shipmentClientId");
    expect(upload).toContain("ctx.authorizedClientIds.length === 1");
  });

  it("stamps email sender identity and the client-specific inbound destination", async () => {
    const inboundWorker = await source("src/modules/documents/processing/inboundEmailWorker.ts");
    const inboundWebhook = await source("src/app/api/webhooks/resend/inbound/route.ts");

    expect(inboundWorker).toContain("uploadedByType: \"EMAIL_SENDER\"");
    expect(inboundWorker).toContain("uploadedByEmail: senderAddress");
    expect(inboundWorker).toContain("clientId: email.clientId ?? null");
    expect(inboundWebhook).toContain("clientId: destination?.clientId ?? null");
  });
});

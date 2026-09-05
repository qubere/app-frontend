import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn().mockResolvedValue({
    isPlatformAdmin: true,
    accountId: "acc_admin_test",
    userId: "usr_admin_test",
    role: "PLATFORM_ADMIN",
  }),
}));

describe("Third-Party Provider & Service Dependencies Health Check", () => {
  it("audits all 15 third-party provider dependencies and returns structured health items", async () => {
    const { getThirdPartyProviderHealth } = await import("@/lib/health/thirdPartyHealthService");
    const providers = await getThirdPartyProviderHealth();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThanOrEqual(15);

    const providerIds = providers.map((p) => p.id);
    expect(providerIds).toContain("postgres-db");
    expect(providerIds).toContain("gcs-storage");
    expect(providerIds).toContain("gemini-ai");
    expect(providerIds).toContain("anthropic-claude");
    expect(providerIds).toContain("openai-api");
    expect(providerIds).toContain("ibm-docling");
    expect(providerIds).toContain("clamav-scanner");
    expect(providerIds).toContain("virustotal-api");
    expect(providerIds).toContain("clerk-auth");
    expect(providerIds).toContain("cbp-ace-abi");
    expect(providerIds).toContain("regulatory-screening-feeds");
    expect(providerIds).toContain("transactional-email");
    expect(providerIds).toContain("logistics-tracking");
    expect(providerIds).toContain("fx-rate-engine");
    expect(providerIds).toContain("esign-service");

    providers.forEach((item) => {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("statusLabel");
      expect(item).toHaveProperty("providerType");
      expect(item).toHaveProperty("details");
      expect(item).toHaveProperty("isMock");
      expect(item).toHaveProperty("requiredInProd");
      expect(["healthy", "degraded", "configured_mock", "not_configured", "error"]).toContain(
        item.status
      );
    });
  });

  it("includes thirdPartyProviders in the GET /api/health response", async () => {
    const route = await import("@/app/api/health/route");
    const res = await route.GET(new Request("http://localhost/api/health"));

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("thirdPartyProviders");
    expect(Array.isArray(body.thirdPartyProviders)).toBe(true);
    expect(body.thirdPartyProviders.length).toBeGreaterThanOrEqual(15);
  });

  it("includes thirdPartyProviders and healthResults in GET /api/platform-admin/deployments response", async () => {
    const deploymentsRoute = await import("@/app/api/platform-admin/deployments/route");
    const res = await deploymentsRoute.GET();

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("deployments");
    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("healthResults");
    expect(body).toHaveProperty("thirdPartyProviders");
    expect(Array.isArray(body.thirdPartyProviders)).toBe(true);
    expect(body.thirdPartyProviders.length).toBeGreaterThanOrEqual(15);

    // Verify GCP service health pings return healthy status instead of 5xx
    const serviceIds = Object.keys(body.healthResults);
    expect(serviceIds.length).toBeGreaterThan(0);
    serviceIds.forEach((id) => {
      expect(["healthy", "degraded"]).toContain(body.healthResults[id].status);
    });
  });
});

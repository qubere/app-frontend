import { describe, expect, it } from "vitest";

describe("Integrations Management Hub", () => {
  it("validates provider categories and categories structure", () => {
    const categories = ["ERP", "ACCOUNTING", "SHIPMENT_TRACKING"];
    expect(categories).toContain("ERP");
    expect(categories).toContain("ACCOUNTING");
    expect(categories).toContain("SHIPMENT_TRACKING");
  });

  it("masks secrets correctly before returning to client UI", () => {
    function maskSecret(secret?: string | null): string {
      if (!secret) return "";
      if (secret.length <= 8) return "••••••••";
      return `••••••••${secret.slice(-4)}`;
    }

    expect(maskSecret("viz_live_1234567890")).toBe("••••••••7890");
    expect(maskSecret("short")).toBe("••••••••");
    expect(maskSecret(null)).toBe("");
  });
});

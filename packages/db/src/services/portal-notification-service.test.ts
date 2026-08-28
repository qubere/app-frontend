import { describe, it, expect } from "vitest";
import { sendPortalNotification } from "./portal-notification-service";

describe("Portal Notification Service", () => {
  it("should successfully dispatch portal invitation notifications", async () => {
    const result = await sendPortalNotification({
      type: "PORTAL_INVITATION",
      recipientEmail: "importer@company.com",
      portalUrl: "https://demo-portal.qubere.ai/invite/tok_123",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toContain("notif_");
    expect(result.deliveredAt).toBeInstanceOf(Date);
  });
});

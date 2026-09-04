import { describe, it, expect } from "vitest";
import { shouldSendRpsNotification } from "@/modules/compliance/notifications/eligibility";
import { resolveRecipients, normalizeRecipientList } from "@/modules/compliance/notifications/recipients";
import type { AccountScreeningConfig } from "@prisma/client";

function baseConfig(overrides: Partial<AccountScreeningConfig> = {}): AccountScreeningConfig {
  return {
    id: "cfg_1",
    accountId: "acct_1",
    rpsEmailAlertsEnabled: true,
    rpsGeneralRecipients: ["general@example.com"],
    rpsHitRecipients: ["hit@example.com"],
    rpsPalRescreenRecipients: ["pal@example.com"],
    rpsEmailFormat: "HTML",
    rpsSecureEmailEnabled: false,
    rpsSuppressEmailAlerts: false,
    ...overrides,
  } as AccountScreeningConfig;
}

describe("shouldSendRpsNotification", () => {
  it.each(["CLEAR", "PARTIAL", "ERROR", "SKIPPED"] as const)(
    "is ineligible for non-notifiable status %s regardless of config",
    (status) => {
      const result = shouldSendRpsNotification(baseConfig(), status, "RPS_HIT");
      expect(result).toEqual({ eligible: false, reason: "STATUS_NOT_NOTIFIABLE" });
    }
  );

  it.each(["HIT", "REVIEW_REQUIRED"] as const)(
    "is eligible for notifiable status %s when alerts are enabled with recipients",
    (status) => {
      const result = shouldSendRpsNotification(baseConfig(), status, "RPS_HIT");
      expect(result).toEqual({ eligible: true, recipients: ["hit@example.com"] });
    }
  );

  it("is ineligible when config is null (never configured)", () => {
    const result = shouldSendRpsNotification(null, "HIT", "RPS_HIT");
    expect(result).toEqual({ eligible: false, reason: "ALERTS_DISABLED" });
  });

  it("is ineligible when rpsEmailAlertsEnabled is false", () => {
    const result = shouldSendRpsNotification(baseConfig({ rpsEmailAlertsEnabled: false }), "HIT", "RPS_HIT");
    expect(result).toEqual({ eligible: false, reason: "ALERTS_DISABLED" });
  });

  it("is ineligible when rpsEmailAlertsEnabled is null (never explicitly enabled)", () => {
    const result = shouldSendRpsNotification(baseConfig({ rpsEmailAlertsEnabled: null }), "HIT", "RPS_HIT");
    expect(result).toEqual({ eligible: false, reason: "ALERTS_DISABLED" });
  });

  it("suppression takes priority over recipient checks", () => {
    const result = shouldSendRpsNotification(
      baseConfig({ rpsSuppressEmailAlerts: true, rpsHitRecipients: [] }),
      "HIT",
      "RPS_HIT"
    );
    expect(result).toEqual({ eligible: false, reason: "SUPPRESSED" });
  });

  it("is ineligible when the resolved recipient list is empty", () => {
    const result = shouldSendRpsNotification(baseConfig({ rpsHitRecipients: [] }), "HIT", "RPS_HIT");
    expect(result).toEqual({ eligible: false, reason: "NO_RECIPIENTS" });
  });

  it("selects rpsPalRescreenRecipients for PAL_RESCREEN_HIT", () => {
    const result = shouldSendRpsNotification(baseConfig(), "HIT", "PAL_RESCREEN_HIT");
    expect(result).toEqual({ eligible: true, recipients: ["pal@example.com"] });
  });

  it("falls back to rpsGeneralRecipients for PARTY_RESCREEN_HIT", () => {
    const result = shouldSendRpsNotification(baseConfig(), "HIT", "PARTY_RESCREEN_HIT");
    expect(result).toEqual({ eligible: true, recipients: ["general@example.com"] });
  });

  it("REVIEW_REQUIRED with an empty PAL recipient list yields NO_RECIPIENTS, not a false positive", () => {
    const result = shouldSendRpsNotification(
      baseConfig({ rpsPalRescreenRecipients: [] }),
      "REVIEW_REQUIRED",
      "PAL_RESCREEN_HIT"
    );
    expect(result).toEqual({ eligible: false, reason: "NO_RECIPIENTS" });
  });
});

describe("normalizeRecipientList", () => {
  it("splits comma/semicolon-separated strings, trims, lowercases, and dedupes", () => {
    const result = normalizeRecipientList("Alice@Example.com, bob@example.com; alice@example.com ,  ");
    expect(result.sort()).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("tolerates an already-normalized array", () => {
    expect(normalizeRecipientList(["a@example.com", "b@example.com"])).toEqual(["a@example.com", "b@example.com"]);
  });

  it("returns an empty array for null/undefined/empty input", () => {
    expect(normalizeRecipientList(null)).toEqual([]);
    expect(normalizeRecipientList(undefined)).toEqual([]);
    expect(normalizeRecipientList("")).toEqual([]);
  });
});

describe("resolveRecipients", () => {
  it("maps RPS_HIT and RPS_REVIEW_REQUIRED to rpsHitRecipients", () => {
    const config = baseConfig();
    expect(resolveRecipients(config, "RPS_HIT")).toEqual(["hit@example.com"]);
    expect(resolveRecipients(config, "RPS_REVIEW_REQUIRED")).toEqual(["hit@example.com"]);
  });
});

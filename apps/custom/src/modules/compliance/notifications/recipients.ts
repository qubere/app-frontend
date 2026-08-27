// Recipient list parsing/selection for RPS email notifications.
import type { AccountScreeningConfig } from "@prisma/client";
import type { ComplianceNotificationType } from "@prisma/client";

/** Splits a comma/semicolon-separated address string, trims, dedupes, drops blanks. Also tolerates an already-normalized string[] (from AccountScreeningConfig columns). */
export function normalizeRecipientList(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : raw.split(/[,;]/);
  const seen = new Set<string>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed.toLowerCase());
  }
  return [...seen];
}

/** Which AccountScreeningConfig recipient list backs a given notification type. RPS_HIT/RPS_REVIEW_REQUIRED use the hit list; PAL_RESCREEN_HIT uses its own dedicated list; PARTY_RESCREEN_HIT falls back to the general list. */
export function resolveRecipients(
  config: Pick<AccountScreeningConfig, "rpsHitRecipients" | "rpsPalRescreenRecipients" | "rpsGeneralRecipients">,
  notificationType: ComplianceNotificationType
): string[] {
  switch (notificationType) {
    case "RPS_HIT":
    case "RPS_REVIEW_REQUIRED":
      return normalizeRecipientList(config.rpsHitRecipients);
    case "PAL_RESCREEN_HIT":
      return normalizeRecipientList(config.rpsPalRescreenRecipients);
    case "PARTY_RESCREEN_HIT":
      return normalizeRecipientList(config.rpsGeneralRecipients);
  }
}

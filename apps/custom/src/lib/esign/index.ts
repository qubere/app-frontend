// E-sign provider resolver — picks the configured provider for an account.
// Priority: env-configured provider → INTERNAL fallback.

export type { EsignProvider, EsignProviderName, EsignEnvelopeInput, EsignEnvelopeState, EsignWebhookEvent, EsignCreateResult } from "./types";
export { InternalProvider } from "./providers/internalProvider";
export { ManualUploadProvider } from "./providers/manualUploadProvider";
export { DropboxSignProvider } from "./providers/dropboxSignProvider";

import type { EsignProvider, EsignProviderName } from "./types";
import { InternalProvider } from "./providers/internalProvider";
import { ManualUploadProvider } from "./providers/manualUploadProvider";
import { DropboxSignProvider } from "./providers/dropboxSignProvider";

export function getEsignProvider(name?: EsignProviderName | null): EsignProvider {
  const resolved = name ?? ((process.env.ESIGN_PROVIDER ?? "") as EsignProviderName) || "INTERNAL";
  switch (resolved) {
    case "DROPBOX_SIGN": return new DropboxSignProvider();
    case "MANUAL_UPLOAD": return new ManualUploadProvider();
    case "INTERNAL":
    default:
      return new InternalProvider();
  }
}

// Signer role validation per entity type (§7 S7 — signer authority rules).
export const VALID_SIGNER_ROLES: Record<string, string[]> = {
  US_CORPORATION:       ["OFFICER", "AUTHORIZED_EMPLOYEE"],
  LLC:                  ["MANAGING_MEMBER", "AUTHORIZED_EMPLOYEE"],
  PARTNERSHIP:          ["GENERAL_PARTNER"],
  SOLE_PROPRIETORSHIP:  ["INDIVIDUAL"],
  FOREIGN:              ["OFFICER", "AUTHORIZED_EMPLOYEE", "INDIVIDUAL"],
};

export function validateSignerRole(entityType: string, signerRole: string): boolean {
  const allowed = VALID_SIGNER_ROLES[entityType] ?? ["OFFICER", "AUTHORIZED_EMPLOYEE", "INDIVIDUAL"];
  return allowed.includes(signerRole);
}

export const SIGNER_ROLE_LABELS: Record<string, string> = {
  OFFICER:              "Officer (President, CEO, VP, etc.)",
  AUTHORIZED_EMPLOYEE:  "Authorized employee (by corporate resolution)",
  GENERAL_PARTNER:      "General partner",
  MANAGING_MEMBER:      "Managing member / Manager",
  INDIVIDUAL:           "Individual (sole proprietor or self)",
};

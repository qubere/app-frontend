// E-sign provider resolver — picks the configured provider for an account.
// Priority: env-configured provider → INTERNAL fallback.

export type { EsignProvider, EsignProviderName, EsignEnvelopeInput, EsignEnvelopeState, EsignWebhookEvent, EsignCreateResult } from "./types";
// Re-exported for existing server-side callers. Client components must import
// these from "@/lib/esign/signerRoles" directly so they don't pull the
// provider barrel (and its Node-only crypto) into the browser bundle.
export { VALID_SIGNER_ROLES, validateSignerRole, SIGNER_ROLE_LABELS } from "./signerRoles";
export { InternalProvider } from "./providers/internalProvider";
export { ManualUploadProvider } from "./providers/manualUploadProvider";
export { DropboxSignProvider } from "./providers/dropboxSignProvider";
export { OpenSignProvider } from "./providers/openSignProvider";

import type { EsignProvider, EsignProviderName } from "./types";
import { InternalProvider } from "./providers/internalProvider";
import { ManualUploadProvider } from "./providers/manualUploadProvider";
import { DropboxSignProvider } from "./providers/dropboxSignProvider";
import { OpenSignProvider } from "./providers/openSignProvider";

export function getEsignProvider(name?: EsignProviderName | null): EsignProvider {
  const resolved = (name ?? (process.env.ESIGN_PROVIDER as EsignProviderName | undefined) ?? "INTERNAL") as EsignProviderName;
  switch (resolved) {
    case "OPEN_SIGN": return new OpenSignProvider();
    case "DROPBOX_SIGN": return new DropboxSignProvider();
    case "MANUAL_UPLOAD": return new ManualUploadProvider();
    case "INTERNAL":
    default:
      return new InternalProvider();
  }
}

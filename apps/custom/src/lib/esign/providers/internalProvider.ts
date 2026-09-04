// Internal e-sign provider — minimal in-app click-to-sign.
// Creates a unique signing token; the signer visits /sign/[token], reads the
// consent text, types their name, and clicks sign. The completion endpoint
// records IP, timestamp, and name consent, then marks the POA executed.
// Suitable for low-risk internal agreements where a third-party audit trail is
// not required. Per §13 open question 2, get legal confirmation before using
// for CBP-filed POAs — ManualUploadProvider is the safer fallback.

import { randomBytes } from "crypto";
import type {
  EsignProvider,
  EsignEnvelopeInput,
  EsignCreateResult,
  EsignEnvelopeState,
  EsignWebhookEvent,
} from "../types";

export class InternalProvider implements EsignProvider {
  readonly name = "INTERNAL" as const;

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignCreateResult> {
    // Token is stored as providerEnvelopeId in PoaEnvelope; the /sign/[token] route uses it.
    const token = randomBytes(32).toString("hex");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qubere.ai";
    return {
      providerEnvelopeId: token,
      status: "sent",
      signingUrl: `${baseUrl}/sign/${token}`,
    };
  }

  async getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState> {
    // State is read from PoaEnvelope in the DB by the caller — we don't have
    // an external API to query. Return a stub that the caller ignores in favour
    // of the DB record.
    return {
      providerEnvelopeId,
      status: "sent",
      signerName: "",
      signerEmail: "",
    };
  }

  async downloadExecutedDocument(_providerEnvelopeId: string): Promise<Buffer> {
    // The executed document is generated server-side at signing time and stored
    // directly. Nothing to download from an external provider.
    throw new Error("INTERNAL provider: use the stored executedDocumentUrl instead");
  }

  async downloadCertificate(_providerEnvelopeId: string): Promise<null> {
    return null;
  }

  parseWebhook(_headers: Record<string, string>, _rawBody: Buffer, _url: string): EsignWebhookEvent {
    throw new Error("INTERNAL provider: no webhook — completion is handled by the /api/sign/[token] route");
  }
}

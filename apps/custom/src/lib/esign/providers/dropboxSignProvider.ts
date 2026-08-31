// Dropbox Sign (formerly HelloSign) e-sign provider.
// Requires DROPBOX_SIGN_API_KEY in the environment (or resolved via
// SecretStoreResolver). Stub — returns a NOT_CONFIGURED error until the key is
// supplied. Full implementation wires the Hellosign Node SDK.

import type {
  EsignProvider,
  EsignEnvelopeInput,
  EsignCreateResult,
  EsignEnvelopeState,
  EsignWebhookEvent,
} from "../types";
import { createHmac, timingSafeEqual } from "crypto";

function apiKey(): string {
  const key = (process.env.DROPBOX_SIGN_API_KEY ?? "").trim();
  if (!key) throw new Error("DROPBOX_SIGN_API_KEY is not configured — use InternalProvider or ManualUploadProvider instead");
  return key;
}

export class DropboxSignProvider implements EsignProvider {
  readonly name = "DROPBOX_SIGN" as const;

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignCreateResult> {
    const key = apiKey();
    void key; // used in real implementation for Authorization header

    // TODO: call Dropbox Sign API when key is configured.
    // POST https://api.hellosign.com/v3/signature_request/send_with_template
    // or  POST https://api.hellosign.com/v3/signature_request/send
    throw new Error("Dropbox Sign integration: API call not yet implemented — set DROPBOX_SIGN_API_KEY and wire the SDK");
  }

  async getEnvelope(_providerEnvelopeId: string): Promise<EsignEnvelopeState> {
    apiKey();
    throw new Error("Dropbox Sign integration: not yet implemented");
  }

  async downloadExecutedDocument(_providerEnvelopeId: string): Promise<Buffer> {
    apiKey();
    throw new Error("Dropbox Sign integration: not yet implemented");
  }

  async downloadCertificate(_providerEnvelopeId: string): Promise<null> {
    return null;
  }

  parseWebhook(headers: Record<string, string>, rawBody: Buffer): EsignWebhookEvent {
    // Dropbox Sign signs webhooks with HMAC-SHA256 using the API key.
    const sig = headers["x-hellosign-signature"] ?? "";
    const key = (process.env.DROPBOX_SIGN_API_KEY ?? "").trim();
    if (!key) throw new Error("DROPBOX_SIGN_API_KEY not configured");
    const expected = createHmac("sha256", key).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(sig, "utf8");
    if (expectedBuf.length !== sigBuf.length || !timingSafeEqual(expectedBuf, sigBuf)) {
      throw new Error("Dropbox Sign webhook signature verification failed");
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload.event ?? {};
    const envelopeId = payload.signature_request?.signature_request_id ?? "";
    const eventType: EsignWebhookEvent["eventType"] =
      event.event_type === "signature_request_all_signed" ? "completed" :
      event.event_type === "signature_request_declined" ? "declined" :
      event.event_type === "signature_request_signed" ? "signed" :
      "sent";

    return {
      providerEnvelopeId: envelopeId,
      eventType,
      rawPayload: payload,
      completedAt: eventType === "completed" ? new Date(event.event_time * 1000) : undefined,
    };
  }
}

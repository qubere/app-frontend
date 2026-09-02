// Manual-upload provider — no external e-sign service.
// createEnvelope is a no-op (returns a placeholder ID); completion is driven
// by the operator uploading the wet-ink PDF and attesting signer authority via
// POST /api/onboarding/poa/[id]/upload.

import type {
  EsignProvider,
  EsignEnvelopeInput,
  EsignCreateResult,
  EsignEnvelopeState,
  EsignWebhookEvent,
} from "../types";

export class ManualUploadProvider implements EsignProvider {
  readonly name = "MANUAL_UPLOAD" as const;

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignCreateResult> {
    return {
      providerEnvelopeId: `manual-${input.poaId}`,
      status: "created",
    };
  }

  async getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState> {
    return {
      providerEnvelopeId,
      status: "created",
      signerName: "",
      signerEmail: "",
    };
  }

  async downloadExecutedDocument(_providerEnvelopeId: string): Promise<Buffer> {
    throw new Error("MANUAL_UPLOAD: executed document is provided by the operator upload — use executedDocumentUrl");
  }

  async downloadCertificate(_providerEnvelopeId: string): Promise<null> {
    return null;
  }

  parseWebhook(_headers: Record<string, string>, _rawBody: Buffer, _url: string): EsignWebhookEvent {
    throw new Error("MANUAL_UPLOAD: no webhook");
  }
}

// E-signature provider abstraction — mirrors the transmission-provider pattern
// used in src/lib/abi/. Credentials are resolved via SecretStoreResolver; never
// store API keys in IntegrationConfig plaintext columns.

export type EsignProviderName = "DOCUSIGN" | "DROPBOX_SIGN" | "INTERNAL" | "MANUAL_UPLOAD";

export interface EsignSignerInput {
  name: string;
  email: string;
  title?: string;
  role: string; // OFFICER | AUTHORIZED_EMPLOYEE | GENERAL_PARTNER | MANAGING_MEMBER | INDIVIDUAL
}

export interface EsignEnvelopeInput {
  accountId: string;
  poaId: string;
  signer: EsignSignerInput;
  templateId?: string;
  /** Pre-rendered document bytes (PDF); some providers accept a document, others use their own template. */
  documentBuffer?: Buffer;
  documentName?: string;
  /** Merge fields for provider-side templates (e.g. DocuSign template roles). */
  mergeFields?: Record<string, string>;
}

export interface EsignEnvelopeState {
  providerEnvelopeId: string;
  status: "created" | "sent" | "delivered" | "signed" | "completed" | "declined" | "voided" | "error";
  signerName: string;
  signerEmail: string;
  completedAt?: Date;
  executedDocumentUrl?: string;
  auditTrailUrl?: string;
}

export interface EsignWebhookEvent {
  providerEnvelopeId: string;
  eventType: "sent" | "delivered" | "completed" | "declined" | "voided" | "error";
  rawPayload: unknown;
  completedAt?: Date;
}

export interface EsignCreateResult {
  providerEnvelopeId: string;
  status: string;
  /** Only set for INTERNAL provider — the direct signing URL. */
  signingUrl?: string;
}

export interface EsignProvider {
  readonly name: EsignProviderName;
  createEnvelope(input: EsignEnvelopeInput): Promise<EsignCreateResult>;
  getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState>;
  downloadExecutedDocument(providerEnvelopeId: string): Promise<Buffer>;
  downloadCertificate(providerEnvelopeId: string): Promise<Buffer | null>;
  /** Verify provider webhook signature and parse event. Throws if signature invalid. */
  parseWebhook(headers: Record<string, string>, rawBody: Buffer): EsignWebhookEvent;
}

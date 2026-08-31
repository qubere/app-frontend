// OpenSign e-sign provider (sandbox: sandbox.opensignlabs.com).
// Auth: x-api-token header. Transport: multipart/form-data for createEnvelope,
// JSON for status reads. Webhook events arrive as Parse afterSave callbacks.

import type {
  EsignProvider,
  EsignEnvelopeInput,
  EsignCreateResult,
  EsignEnvelopeState,
  EsignWebhookEvent,
} from "../types";

const BASE_URL = (process.env.OPEN_SIGN_BASE_URL ?? "https://sandbox.opensignlabs.com").replace(/\/$/, "");
const API_TOKEN = process.env.OPEN_SIGN_API_TOKEN ?? "";

function token(): string {
  const t = API_TOKEN.trim();
  if (!t) throw new Error("OPEN_SIGN_API_TOKEN is not configured");
  return t;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { "x-api-token": token(), ...extra };
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === "object" && body !== null && "error" in body
      ? String((body as Record<string, unknown>).error)
      : text;
    throw new Error(`OpenSign API ${path}: ${res.status} — ${msg}`);
  }
  return body;
}

export class OpenSignProvider implements EsignProvider {
  readonly name = "OPEN_SIGN" as const;

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignCreateResult> {
    if (!input.documentBuffer) {
      throw new Error("OpenSign provider requires a documentBuffer (PDF bytes)");
    }

    const signers = JSON.stringify([
      {
        name: input.signer.name,
        email: input.signer.email,
        phone: "",
        auto_sign: false,
      },
    ]);

    const form = new FormData();
    form.append("name", input.documentName ?? `POA – ${input.signer.name}`);
    form.append("signers", signers);
    form.append(
      "file",
      new Blob([new Uint8Array(input.documentBuffer)], { type: "application/pdf" }),
      `${input.poaId}.pdf`
    );
    form.append("send_email", "true");

    const result = await apiFetch("/createdocument", {
      method: "POST",
      body: form,
    }) as Record<string, unknown>;

    const envelopeId = String(result.objectId ?? result.id ?? "");
    if (!envelopeId) throw new Error("OpenSign did not return a document id");

    return { providerEnvelopeId: envelopeId, status: "sent" };
  }

  async getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState> {
    const doc = await apiFetch(`/document/${providerEnvelopeId}`) as Record<string, unknown>;

    const isCompleted = Boolean(doc.IsCompleted ?? doc.is_completed);
    const signers = (doc.Signers ?? doc.signers ?? []) as Array<Record<string, unknown>>;
    const firstSigner = signers[0] ?? {};

    return {
      providerEnvelopeId,
      status: isCompleted ? "completed" : "sent",
      signerName: String(firstSigner.name ?? firstSigner.Name ?? ""),
      signerEmail: String(firstSigner.email ?? firstSigner.Email ?? ""),
      completedAt: isCompleted && doc.updatedAt ? new Date(String(doc.updatedAt)) : undefined,
      executedDocumentUrl: typeof doc.SignedUrl === "string" ? doc.SignedUrl : undefined,
    };
  }

  async downloadExecutedDocument(providerEnvelopeId: string): Promise<Buffer> {
    const doc = await apiFetch(`/document/${providerEnvelopeId}`) as Record<string, unknown>;
    const url = doc.SignedUrl ?? doc.signed_url ?? doc.URL ?? doc.url;
    if (typeof url !== "string" || !url) {
      throw new Error(`OpenSign document ${providerEnvelopeId} has no download URL`);
    }
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`Failed to download executed document: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async downloadCertificate(_providerEnvelopeId: string): Promise<null> {
    // OpenSign generates a completion certificate via its generatecertificate cloud function;
    // the REST endpoint is not stable across versions — skip for now and return null.
    return null;
  }

  parseWebhook(_headers: Record<string, string>, rawBody: Buffer): EsignWebhookEvent {
    // OpenSign delivers webhooks as Parse afterSave payloads — the body is the
    // serialized contracts_Document object.
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;

    const envelopeId = String(payload.objectId ?? payload.id ?? "");
    const isCompleted = Boolean(payload.IsCompleted ?? payload.is_completed);
    const isDeclined = Boolean(payload.IsDeclined ?? payload.is_declined);

    const eventType: EsignWebhookEvent["eventType"] = isCompleted
      ? "completed"
      : isDeclined
      ? "declined"
      : "sent";

    return {
      providerEnvelopeId: envelopeId,
      eventType,
      rawPayload: payload,
      completedAt: isCompleted && payload.updatedAt
        ? new Date(String(payload.updatedAt))
        : undefined,
    };
  }
}

// OpenSign e-sign provider (sandbox.opensignlabs.com).
// API v1.2 — JSON transport, x-api-token auth.
// Docs: https://docs.opensignlabs.com/docs/API-docs/v1.2/createdocument

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

function jsonHeaders(): Record<string, string> {
  return {
    "x-api-token": token(),
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = `${BASE_URL}/api/v1.2${path}`;
  console.log("[opensign:request]", init?.method ?? "GET", url, "tokenPresent:", !!API_TOKEN.trim());
  const res = await fetch(url, {
    ...init,
    headers: { ...jsonHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log("[opensign:response]", res.status, typeof body === "object" ? JSON.stringify(body).slice(0, 500) : String(body).slice(0, 500));
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

    const base64File = Buffer.from(input.documentBuffer).toString("base64");

    const body = {
      file: base64File,
      title: input.documentName ?? `POA – ${input.signer.name}`,
      signers: [
        {
          name: input.signer.name,
          email: input.signer.email,
          role: input.signer.role ?? "Signer",
          phone: "",
          signer_role: "signer",
          widgets: [
            // Signature widget at a typical POA signature block position (page 1)
            { type: "signature", page: 1, x: 244, y: 628, w: 114, h: 42 },
          ],
        },
      ],
      send_email: true,
      sendInOrder: false,
    };

    const result = await apiFetch("/createdocument", {
      method: "POST",
      body: JSON.stringify(body),
    }) as Record<string, unknown>;

    const envelopeId = String(result.objectId ?? "");
    if (!envelopeId) throw new Error("OpenSign did not return a document objectId");

    // signurl is an array of { signer_email, sign_url } objects
    const signurls = result.signurl as Array<Record<string, string>> | undefined;
    const signingUrl = signurls?.[0]?.sign_url ?? undefined;

    return { providerEnvelopeId: envelopeId, status: "sent", signingUrl };
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download executed document: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async downloadCertificate(_providerEnvelopeId: string): Promise<null> {
    // OpenSign generates a completion certificate — not available via stable REST endpoint yet.
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

import { timingSafeEqual } from "node:crypto";
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

// OpenSign's v1.2 REST API reports lifecycle via a `status` string
// ("sent" | "partial" | "completed" | "declined" | "expired"), while its Parse
// afterSave webhook payload uses boolean class fields (IsCompleted/IsDeclined).
// Accept both shapes so polling and webhooks agree.
function docStatus(doc: Record<string, unknown>): string {
  return String(doc.status ?? doc.Status ?? "").toLowerCase();
}
function isCompletedDoc(doc: Record<string, unknown>): boolean {
  return Boolean(doc.IsCompleted ?? doc.is_completed) || docStatus(doc) === "completed";
}
function isDeclinedDoc(doc: Record<string, unknown>): boolean {
  return Boolean(doc.IsDeclined ?? doc.is_declined) || docStatus(doc) === "declined";
}
function executedUrlFromDoc(doc: Record<string, unknown>): string | undefined {
  const url = doc.SignedUrl ?? doc.signed_url ?? doc.signedUrl ?? doc.file ?? doc.URL ?? doc.url;
  return typeof url === "string" && url ? url : undefined;
}
function completedAtFromDoc(doc: Record<string, unknown>): Date | undefined {
  const trail = (doc.audit_trail ?? doc.AuditTrail ?? []) as Array<Record<string, unknown>>;
  const signed = trail.map((t) => t.signed).filter((v): v is string => typeof v === "string").sort().pop();
  const raw = signed ?? doc.updatedAt ?? doc.UpdatedAt;
  return typeof raw === "string" ? new Date(raw) : undefined;
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

    // signurl is an array of { email, url } objects (sandbox returns "url", not "sign_url")
    const signurls = result.signurl as Array<Record<string, string>> | undefined;
    const signingUrl = signurls?.[0]?.sign_url ?? signurls?.[0]?.url ?? undefined;

    return { providerEnvelopeId: envelopeId, status: "sent", signingUrl };
  }

  async getEnvelope(providerEnvelopeId: string): Promise<EsignEnvelopeState> {
    const doc = await apiFetch(`/document/${providerEnvelopeId}`) as Record<string, unknown>;
    const isCompleted = isCompletedDoc(doc);
    const isDeclined = isDeclinedDoc(doc);
    const signers = (doc.Signers ?? doc.signers ?? []) as Array<Record<string, unknown>>;
    const firstSigner = signers[0] ?? {};
    const signedUrl = executedUrlFromDoc(doc);

    return {
      providerEnvelopeId,
      status: isCompleted ? "completed" : isDeclined ? "declined" : "sent",
      signerName: String(firstSigner.name ?? firstSigner.Name ?? ""),
      signerEmail: String(firstSigner.email ?? firstSigner.Email ?? ""),
      completedAt: isCompleted ? completedAtFromDoc(doc) : undefined,
      executedDocumentUrl: signedUrl,
    };
  }

  async downloadExecutedDocument(providerEnvelopeId: string): Promise<Buffer> {
    const doc = await apiFetch(`/document/${providerEnvelopeId}`) as Record<string, unknown>;
    const url = executedUrlFromDoc(doc);
    if (!url) {
      throw new Error(`OpenSign document ${providerEnvelopeId} has no signed-document URL`);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download executed document: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async downloadCertificate(providerEnvelopeId: string): Promise<Buffer | null> {
    const doc = await apiFetch(`/document/${providerEnvelopeId}`) as Record<string, unknown>;
    const url = doc.certificate ?? doc.Certificate ?? doc.CertificateUrl;
    if (typeof url !== "string" || !url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  parseWebhook(headers: Record<string, string>, rawBody: Buffer, url = ''): EsignWebhookEvent {
    // Prefer main's OpenSign dashboard configuration. Older installations may
    // still use OPENSIGN_WEBHOOK_SECRET with a trusted header delivery adapter.
    // When both are set, only the canonical URL-secret configuration is accepted.
    const configuredSecret = (process.env.OPEN_SIGN_WEBHOOK_SECRET ?? '').trim();
    const secret = configuredSecret || process.env.OPENSIGN_WEBHOOK_SECRET || '';
    const supplied = configuredSecret
      ? (url ? new URL(url).searchParams.get('secret') ?? '' : '')
      : headers['x-qubere-webhook-secret'] ?? '';
    if (!secret || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
      throw new Error('Invalid OpenSign webhook authentication');
    }

    // OpenSign delivers webhooks as Parse afterSave payloads — the body is the
    // serialized contracts_Document object.
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;

    const envelopeId = String(payload.objectId ?? payload.id ?? "");
    const isCompleted = isCompletedDoc(payload);
    const isDeclined = isDeclinedDoc(payload);

    const eventType: EsignWebhookEvent["eventType"] = isCompleted
      ? "completed"
      : isDeclined
      ? "declined"
      : "sent";

    return {
      providerEnvelopeId: envelopeId,
      eventType,
      rawPayload: payload,
      completedAt: isCompleted ? completedAtFromDoc(payload) : undefined,
    };
  }
}

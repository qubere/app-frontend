/**
 * Thin wrapper around the `resend` SDK for inbound email ingestion.
 *
 * Webhook payloads from Resend carry attachment metadata only -- never bytes,
 * never the body. Retrieving the actual content always requires a follow-up
 * authenticated call back to Resend, done here and nowhere else.
 */

import { Resend } from "resend";
import type { WebhookEventPayload } from "resend";

export class ResendConfigError extends Error {}
export class ResendWebhookVerificationError extends Error {}

let client: Resend | null = null;

function getClient(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ResendConfigError("RESEND_API_KEY is not configured.");
  }
  client = new Resend(apiKey);
  return client;
}

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Verifies a Resend/Svix webhook signature against the raw request body.
 * Callers must pass the exact raw text of the request -- re-serialized JSON
 * will not match the signature.
 */
export function verifyResendWebhook(rawBody: string, headers: WebhookHeaders): WebhookEventPayload {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new ResendConfigError("RESEND_WEBHOOK_SECRET is not configured.");
  }
  try {
    return getClient().webhooks.verify({ payload: rawBody, headers, webhookSecret: secret });
  } catch (error) {
    throw new ResendWebhookVerificationError(
      error instanceof Error ? error.message : "Webhook signature verification failed."
    );
  }
}

export interface ReceivedEmailAttachmentMeta {
  id: string;
  filename: string | null;
  size: number;
  contentType: string;
  contentId: string | null;
  contentDisposition: string | null;
}

export interface ReceivedEmailContent {
  id: string;
  from: string;
  to: string[];
  subject: string;
  receivedFor: string[];
  headers: Record<string, string> | null;
  /** Plain-text body, when the sender included one. */
  text: string | null;
  /** HTML body, when the sender included one. */
  html: string | null;
  attachments: ReceivedEmailAttachmentMeta[];
}

/** Longest body excerpt persisted / handed to the matcher. */
export const INBOUND_BODY_EXCERPT_MAX = 16_000;

/**
 * Reduces a received email's body to a bounded plain-text excerpt for shipment
 * matching and reviewer display. Prefers the text part; falls back to a rough
 * de-tagging of the HTML part. Never returns more than `INBOUND_BODY_EXCERPT_MAX`
 * characters.
 */
export function bodyExcerpt(text: string | null | undefined, html: string | null | undefined): string | null {
  const fromText = (text ?? "").trim();
  const raw =
    fromText !== ""
      ? fromText
      : (html ?? "")
          .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">");
  const collapsed = raw
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (collapsed === "") return null;
  return collapsed.length > INBOUND_BODY_EXCERPT_MAX
    ? collapsed.slice(0, INBOUND_BODY_EXCERPT_MAX)
    : collapsed;
}

/** Fetches full email metadata/headers/attachment-list for a received email. */
export async function getReceivedEmail(emailId: string): Promise<ReceivedEmailContent> {
  const { data, error } = await getClient().emails.receiving.get(emailId);
  if (error || !data) {
    throw new Error(`Failed to fetch received email ${emailId}: ${error?.message ?? "unknown error"}`);
  }
  return {
    id: data.id,
    from: data.from,
    to: data.to,
    subject: data.subject,
    receivedFor: data.received_for,
    headers: data.headers,
    text: data.text ?? null,
    html: data.html ?? null,
    attachments: data.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      contentType: a.content_type,
      contentId: a.content_id,
      contentDisposition: a.content_disposition,
    })),
  };
}

export interface AttachmentDownloadInfo {
  filename: string | null;
  size: number;
  contentType: string;
  contentDisposition: "inline" | "attachment";
  downloadUrl: string;
}

/** Resolves a short-lived (1 hour) signed download URL for one attachment. */
export async function getAttachmentDownloadInfo(
  emailId: string,
  attachmentId: string
): Promise<AttachmentDownloadInfo> {
  const { data, error } = await getClient().emails.receiving.attachments.get({
    emailId,
    id: attachmentId,
  });
  if (error || !data) {
    throw new Error(
      `Failed to fetch attachment ${attachmentId} for email ${emailId}: ${error?.message ?? "unknown error"}`
    );
  }
  return {
    filename: data.filename ?? null,
    size: data.size,
    contentType: data.content_type,
    contentDisposition: data.content_disposition,
    downloadUrl: data.download_url,
  };
}

/** Downloads attachment bytes from a signed URL obtained via `getAttachmentDownloadInfo`. */
export async function downloadAttachmentBytes(downloadUrl: string): Promise<Buffer> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Attachment download failed with status ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Generic one-shot receipt; no document contents or shipment identifiers leave the system. */
export async function sendInboundReceipt(emailId: string, to: string, text: string) {
  const { error } = await getClient().emails.send({ from: process.env.RESEND_FROM_ADDRESS || 'notifications@inbound.qubere.ai', to: [to], subject: 'Qubere document receipt', text, headers: { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' } }, { idempotencyKey: `inbound-receipt/${emailId}` });
  if (error) throw new Error(error.message);
}

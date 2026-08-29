// Email rendering for License Management / License Determination
// notifications -- siblings of the RPS templates, sharing escapeHtml and the
// RenderedEmail contract. No secure/non-secure split: unlike RPS these
// notifications carry no Party PII by default (license number, product,
// shipment/transaction ids only).
import { escapeHtml } from "./escapeHtml";
import type { RenderedEmail } from "./types";

export interface LicenseAlertPayload {
  alerts: Array<{ type: string; licenseNumber: string; lineNumber?: number | null; message: string }>;
}

export function renderLicenseAlertEmail(payload: LicenseAlertPayload): RenderedEmail {
  const subject = `[Qubere Compliance] License Management Alerts (${payload.alerts.length})`;
  const text = [
    "The following license alerts require attention:",
    ...payload.alerts.map((a) => `  [${a.type}] ${a.message}`),
  ].join("\n");
  const items = payload.alerts.map((a) => `<li>[${escapeHtml(a.type)}] ${escapeHtml(a.message)}</li>`).join("");
  const html = `<p>The following license alerts require attention:</p><ul>${items}</ul>`;
  return { subject, html, text };
}

export interface LicenseDeterminationReviewPayload {
  status: string;
  reason: string;
  operationType: string;
  shipmentId?: string | null;
  productId?: string | null;
  transactionId?: string | null;
}

export function renderLicenseDeterminationReviewEmail(
  resultId: string,
  payload: LicenseDeterminationReviewPayload,
  appBaseUrl: string
): RenderedEmail {
  const reviewUrl = `${appBaseUrl}/app/license-management?determinationId=${encodeURIComponent(resultId)}`;
  const context = [
    payload.shipmentId ? `Shipment: ${payload.shipmentId}` : null,
    payload.productId ? `Product: ${payload.productId}` : null,
    payload.transactionId ? `Transaction: ${payload.transactionId}` : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" -- ");

  const subject = "[Qubere Compliance] License Determination Review Required";
  const text = [
    `A ${payload.operationType} license determination requires review.`,
    `Status: ${payload.status}`,
    `Reason: ${payload.reason}`,
    ...(context ? [context] : []),
    "",
    `Review: ${reviewUrl}`,
  ].join("\n");
  const html = `
    <p>A <strong>${escapeHtml(payload.operationType)}</strong> license determination requires review.</p>
    <p>Status: <strong>${escapeHtml(payload.status)}</strong></p>
    <p>Reason: ${escapeHtml(payload.reason)}</p>
    ${context ? `<p>${escapeHtml(context)}</p>` : ""}
    <p><a href="${escapeHtml(reviewUrl)}">Review in Qubere</a>.</p>
  `.trim();
  return { subject, html, text };
}

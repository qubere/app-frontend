// Secure (PII-free) template -- must never surface party name, address,
// identifiers, or match evidence. Only enough context for a reviewer who is
// already authenticated to know *that* something needs attention and follow
// the link into the app to see it.
import { escapeHtml } from "./escapeHtml";
import { buildSecureReviewUrl } from "./buildSecureReviewUrl";
import { NOTIFICATION_TYPE_LABELS } from "./notificationLabels";
import type { RenderedEmail, RpsEmailRenderInput } from "./types";

export function renderSecureRpsEmail(input: RpsEmailRenderInput): RenderedEmail {
  const label = NOTIFICATION_TYPE_LABELS[input.notificationType];
  const reviewUrl = buildSecureReviewUrl(input.appBaseUrl, {
    partyId: input.result.partyId,
    shipmentId: input.result.shipmentId,
    resultId: input.result.id,
  });

  const subject = `[Qubere Compliance] ${label} -- review required`;

  const text = [
    `A ${label.toLowerCase()} was identified during Restricted Party Screening.`,
    `Sign in to Qubere to review the details: ${reviewUrl}`,
    "",
    "This notification does not include restricted party details for security reasons.",
  ].join("\n");

  const html = `
    <p>A <strong>${escapeHtml(label)}</strong> was identified during Restricted Party Screening.</p>
    <p><a href="${escapeHtml(reviewUrl)}">Sign in to Qubere to review the details</a>.</p>
    <p style="color:#666;font-size:12px;">This notification does not include restricted party details for security reasons.</p>
  `.trim();

  return { subject, html, text };
}

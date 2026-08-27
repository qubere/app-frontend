// Non-secure template -- includes screened-party identity and top match
// evidence for recipients who don't have (or don't need) an in-app login.
// Every dynamic value still goes through escapeHtml before insertion.
import { escapeHtml } from "./escapeHtml";
import { buildSecureReviewUrl } from "./buildSecureReviewUrl";
import { NOTIFICATION_TYPE_LABELS } from "./notificationLabels";
import type { RenderedEmail, RpsEmailRenderInput } from "./types";

export function renderNonSecureRpsEmail(input: RpsEmailRenderInput): RenderedEmail {
  const { result } = input;
  const label = NOTIFICATION_TYPE_LABELS[input.notificationType];
  const reviewUrl = buildSecureReviewUrl(input.appBaseUrl, {
    partyId: result.partyId,
    shipmentId: result.shipmentId,
    resultId: result.id,
  });

  const location = [result.screenedCity, result.screenedCountry].filter(Boolean).join(", ");
  const topMatches = result.matches.slice(0, 5);

  const subject = `[Qubere Compliance] ${label}: ${result.screenedName}`;

  const textLines = [
    `${label} for "${result.screenedName}"${location ? ` (${location})` : ""}.`,
    `Status: ${result.status} -- ${result.hitCount} match(es), ${result.redFlagCount} red-flag hit(s).`,
    "",
  ];
  if (topMatches.length > 0) {
    textLines.push("Top matches:");
    for (const m of topMatches) {
      textLines.push(`  - ${m.matchedName} (${m.sourceList}, ${m.nameScore}% via ${m.matchMethod})`);
    }
    textLines.push("");
  }
  textLines.push(`Review this result: ${reviewUrl}`);
  const text = textLines.join("\n");

  const matchRows = topMatches
    .map(
      (m) =>
        `<li>${escapeHtml(m.matchedName)} (${escapeHtml(m.sourceList)}, ${m.nameScore}% via ${escapeHtml(m.matchMethod)})</li>`
    )
    .join("");

  const html = `
    <p><strong>${escapeHtml(label)}</strong> for "${escapeHtml(result.screenedName)}"${location ? ` (${escapeHtml(location)})` : ""}.</p>
    <p>Status: <strong>${escapeHtml(result.status)}</strong> -- ${result.hitCount} match(es), ${result.redFlagCount} red-flag hit(s).</p>
    ${matchRows ? `<p>Top matches:</p><ul>${matchRows}</ul>` : ""}
    <p><a href="${escapeHtml(reviewUrl)}">Review this result in Qubere</a>.</p>
  `.trim();

  return { subject, html, text };
}

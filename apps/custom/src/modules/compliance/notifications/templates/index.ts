import { renderSecureRpsEmail } from "./secureTemplate";
import { renderNonSecureRpsEmail } from "./nonSecureTemplate";
import type { RenderedEmail, RpsEmailRenderInput } from "./types";

export type { RpsEmailRenderInput, RpsEmailResultView, RpsEmailMatchSummary, RenderedEmail } from "./types";
export { buildSecureReviewUrl } from "./buildSecureReviewUrl";
export { escapeHtml } from "./escapeHtml";
export {
  renderLicenseAlertEmail,
  renderLicenseDeterminationReviewEmail,
  type LicenseAlertPayload,
  type LicenseDeterminationReviewPayload,
} from "./licenseTemplates";

export function renderRpsEmail(input: RpsEmailRenderInput): RenderedEmail {
  return input.secure ? renderSecureRpsEmail(input) : renderNonSecureRpsEmail(input);
}

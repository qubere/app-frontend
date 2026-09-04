import { EmailConfigError, getEmailConfig, type EmailConfig } from "./emailConfig";
import { SmtpEmailProvider } from "./smtpEmailProvider";
import type { EmailProvider } from "./emailProvider";

let cached: EmailProvider | null = null;
let cachedProviderName: string | null = null;

/**
 * Resolves the configured EmailProvider. ZOHO/GOOGLE_WORKSPACE/MICROSOFT_365
 * all use EMAIL_TRANSPORT=SMTP today and resolve to the same SmtpEmailProvider
 * -- provider only affects the From name/branding, not the code path. Any
 * other transport value throws EmailConfigError; there is nothing else to
 * fall back to.
 */
export function createEmailProvider(config: EmailConfig): EmailProvider {
  if (config.transport === "SMTP") {
    return new SmtpEmailProvider(config);
  }
  throw new EmailConfigError(`No EmailProvider implementation for transport "${config.transport}".`);
}

/** Lazily builds and caches the provider from process.env -- call site convenience over createEmailProvider(getEmailConfig()). */
export function getEmailProvider(): EmailProvider {
  const config = getEmailConfig();
  if (cached && cachedProviderName === config.provider) return cached;
  cached = createEmailProvider(config);
  cachedProviderName = config.provider;
  return cached;
}

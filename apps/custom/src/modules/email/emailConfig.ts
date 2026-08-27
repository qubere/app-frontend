// Lazy, per-call email configuration -- mirrors resendClient.ts's convention
// of reading process.env at call time (not frozen at module load) so tests
// can set env vars per-case and a missing/invalid value always throws with a
// clear message and never leaks a secret into the error text.

export type EmailProviderName = "ZOHO" | "GOOGLE_WORKSPACE" | "MICROSOFT_365";
export type EmailTransportName = "SMTP";

export class EmailConfigError extends Error {}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface EmailConfig {
  provider: EmailProviderName;
  transport: EmailTransportName;
  fromAddress: string;
  fromName: string;
  smtp: SmtpConfig;
  maxRetryAttempts: number;
  retryBaseSeconds: number;
  appBaseUrl: string;
}

const VALID_PROVIDERS: ReadonlySet<string> = new Set(["ZOHO", "GOOGLE_WORKSPACE", "MICROSOFT_365"]);
const VALID_TRANSPORTS: ReadonlySet<string> = new Set(["SMTP"]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new EmailConfigError(`${name} is not configured.`);
  return value;
}

function requireIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new EmailConfigError(`${name} must be a positive integer.`);
  }
  return parsed;
}

/** Reads and validates the full email configuration from process.env. Throws EmailConfigError on any missing/invalid value -- never returns a partial config. */
export function getEmailConfig(): EmailConfig {
  const provider = requireEnv("EMAIL_PROVIDER");
  if (!VALID_PROVIDERS.has(provider)) {
    throw new EmailConfigError(`EMAIL_PROVIDER "${provider}" is not supported. Expected one of: ${[...VALID_PROVIDERS].join(", ")}.`);
  }

  const transport = requireEnv("EMAIL_TRANSPORT");
  if (!VALID_TRANSPORTS.has(transport)) {
    throw new EmailConfigError(`EMAIL_TRANSPORT "${transport}" is not supported for provider "${provider}". Expected one of: ${[...VALID_TRANSPORTS].join(", ")}.`);
  }

  const smtpPortRaw = requireEnv("EMAIL_SMTP_PORT");
  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    throw new EmailConfigError("EMAIL_SMTP_PORT must be a positive integer.");
  }

  return {
    provider: provider as EmailProviderName,
    transport: transport as EmailTransportName,
    fromAddress: requireEnv("EMAIL_FROM_ADDRESS"),
    fromName: process.env.EMAIL_FROM_NAME || "Qubere Compliance",
    smtp: {
      host: requireEnv("EMAIL_SMTP_HOST"),
      port: smtpPort,
      secure: process.env.EMAIL_SMTP_SECURE === "true",
      user: requireEnv("EMAIL_SMTP_USER"),
      pass: requireEnv("EMAIL_SMTP_PASS"),
    },
    maxRetryAttempts: requireIntEnv("EMAIL_MAX_RETRY_ATTEMPTS", 5),
    retryBaseSeconds: requireIntEnv("EMAIL_RETRY_BASE_SECONDS", 30),
    appBaseUrl: (process.env.NEXT_PUBLIC_APP_URL || "https://app.qubere.ai").replace(/\/$/, ""),
  };
}

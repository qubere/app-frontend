import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "msg_mock" }),
    })),
  },
}));

// EmailProvider abstraction: getEmailConfig() env validation and
// createEmailProvider()'s transport dispatch. ZOHO/GOOGLE_WORKSPACE/
// MICROSOFT_365 all resolve to the same SmtpEmailProvider today (they all
// use EMAIL_TRANSPORT=SMTP); only the branding (from-name) differs.

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_TRANSPORT",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_FROM_NAME",
  "EMAIL_SMTP_HOST",
  "EMAIL_SMTP_PORT",
  "EMAIL_SMTP_SECURE",
  "EMAIL_SMTP_USER",
  "EMAIL_SMTP_PASS",
  "EMAIL_MAX_RETRY_ATTEMPTS",
  "EMAIL_RETRY_BASE_SECONDS",
  "NEXT_PUBLIC_APP_URL",
] as const;

let savedEnv: Record<string, string | undefined>;

function setValidEnv(overrides: Record<string, string | undefined> = {}) {
  const base: Record<string, string> = {
    EMAIL_PROVIDER: "ZOHO",
    EMAIL_TRANSPORT: "SMTP",
    EMAIL_FROM_ADDRESS: "compliance-alerts@qubere.ai",
    EMAIL_FROM_NAME: "Qubere Compliance",
    EMAIL_SMTP_HOST: "smtp.zoho.com",
    EMAIL_SMTP_PORT: "587",
    EMAIL_SMTP_SECURE: "false",
    EMAIL_SMTP_USER: "alerts@qubere.ai",
    EMAIL_SMTP_PASS: "super-secret-password-xyz",
  };
  for (const key of ENV_KEYS) {
    const value = key in overrides ? overrides[key] : base[key as keyof typeof base];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("getEmailConfig", () => {
  it("reads a fully-specified ZOHO/SMTP configuration", async () => {
    setValidEnv();
    const { getEmailConfig } = await import("@/modules/email/emailConfig");
    const config = getEmailConfig();

    expect(config.provider).toBe("ZOHO");
    expect(config.transport).toBe("SMTP");
    expect(config.smtp).toMatchObject({ host: "smtp.zoho.com", port: 587, secure: false });
    expect(config.maxRetryAttempts).toBe(5);
    expect(config.retryBaseSeconds).toBe(30);
  });

  it.each(["GOOGLE_WORKSPACE", "MICROSOFT_365"] as const)(
    "accepts %s as a valid provider (also SMTP transport)",
    async (provider) => {
      setValidEnv({ EMAIL_PROVIDER: provider });
      const { getEmailConfig } = await import("@/modules/email/emailConfig");
      expect(getEmailConfig().provider).toBe(provider);
    }
  );

  it("throws EmailConfigError for an unsupported provider", async () => {
    setValidEnv({ EMAIL_PROVIDER: "SENDGRID" });
    const { getEmailConfig, EmailConfigError } = await import("@/modules/email/emailConfig");
    expect(() => getEmailConfig()).toThrow(EmailConfigError);
  });

  it("throws EmailConfigError for an unsupported transport", async () => {
    setValidEnv({ EMAIL_TRANSPORT: "GOOGLE_API" });
    const { getEmailConfig, EmailConfigError } = await import("@/modules/email/emailConfig");
    expect(() => getEmailConfig()).toThrow(EmailConfigError);
  });

  it("throws EmailConfigError when a required var is missing, without leaking any configured secret", async () => {
    setValidEnv({ EMAIL_SMTP_PASS: undefined });
    const { getEmailConfig, EmailConfigError } = await import("@/modules/email/emailConfig");

    let caught: unknown;
    try {
      getEmailConfig();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EmailConfigError);
    expect((caught as Error).message).not.toContain("super-secret-password-xyz");
    expect((caught as Error).message).toContain("EMAIL_SMTP_PASS");
  });

  it("throws EmailConfigError when EMAIL_SMTP_PORT is not a positive integer", async () => {
    setValidEnv({ EMAIL_SMTP_PORT: "not-a-number" });
    const { getEmailConfig, EmailConfigError } = await import("@/modules/email/emailConfig");
    expect(() => getEmailConfig()).toThrow(EmailConfigError);
  });

  it("falls back to https://app.qubere.ai when NEXT_PUBLIC_APP_URL is unset", async () => {
    setValidEnv({ NEXT_PUBLIC_APP_URL: undefined });
    const { getEmailConfig } = await import("@/modules/email/emailConfig");
    expect(getEmailConfig().appBaseUrl).toBe("https://app.qubere.ai");
  });
});

describe("createEmailProvider", () => {
  it("resolves SMTP transport to SmtpEmailProvider", async () => {
    setValidEnv();
    const { getEmailConfig } = await import("@/modules/email/emailConfig");
    const { createEmailProvider } = await import("@/modules/email/emailProviderFactory");
    const { SmtpEmailProvider } = await import("@/modules/email/smtpEmailProvider");

    const provider = createEmailProvider(getEmailConfig());
    expect(provider).toBeInstanceOf(SmtpEmailProvider);
  });

  it("throws EmailConfigError for a transport with no implementation", async () => {
    setValidEnv();
    const { getEmailConfig, EmailConfigError } = await import("@/modules/email/emailConfig");
    const { createEmailProvider } = await import("@/modules/email/emailProviderFactory");

    const config = { ...getEmailConfig(), transport: "GOOGLE_API" as never };
    expect(() => createEmailProvider(config)).toThrow(EmailConfigError);
  });
});

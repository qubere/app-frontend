// nodemailer-based EmailProvider -- the sole transport implementation today;
// EMAIL_PROVIDER only changes branding (from name), never the code path here.
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailConfig } from "./emailConfig";
import type { EmailDeliveryResult, EmailMessage, EmailProvider } from "./emailProvider";

/**
 * SMTP reply/error codes that mean "try again later" rather than "this will
 * never work" -- connection/timeout/4xx-class transient conditions. Anything
 * else (5xx, invalid recipient, auth failure) is treated as permanent so a
 * bad address doesn't retry forever.
 */
const RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNRESET",
  "ESOCKET",
  "EDNS",
  "EAUTH", // transient in practice for shared mailbox rate limiting/relay hiccups
]);

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code && RETRYABLE_ERROR_CODES.has(code)) return true;

  const responseCode = (error as { responseCode?: number } | null)?.responseCode;
  if (typeof responseCode === "number") return responseCode >= 400 && responseCode < 500;

  return false;
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    this.fromAddress = config.fromAddress;
    this.fromName = config.fromName;
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return { outcome: "SUCCESS", providerMessageId: info.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown SMTP send failure.";
      const errorCode = (error as { code?: string } | null)?.code ?? "SMTP_SEND_FAILED";
      return isRetryable(error)
        ? { outcome: "RETRYABLE_FAILURE", errorCode, errorMessage }
        : { outcome: "PERMANENT_FAILURE", errorCode, errorMessage };
    }
  }
}

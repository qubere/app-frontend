// Provider-agnostic outbound email abstraction.
//
// Every mailbox provider (Zoho, Google Workspace, Microsoft 365) is reached
// over standard SMTP today, so EmailProviderFactory resolves all of them to
// SmtpEmailProvider -- but callers depend on this interface, not on
// nodemailer or any provider SDK, so a future non-SMTP transport (e.g. the
// Gmail API) only needs a new EmailProvider implementation, no caller change.

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type EmailDeliveryResult =
  | { outcome: "SUCCESS"; providerMessageId: string }
  | { outcome: "RETRYABLE_FAILURE"; errorCode: string; errorMessage: string }
  | { outcome: "PERMANENT_FAILURE"; errorCode: string; errorMessage: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

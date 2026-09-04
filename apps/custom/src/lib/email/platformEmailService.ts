/**
 * Qubere Platform Unified Email Capability Service
 * Provides standardized email sending capabilities powered by Resend API across all apps & modules.
 */

export interface PlatformEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
}

export interface TaskAssignmentNotificationOptions {
  toEmail: string;
  toName?: string | null;
  taskTitle: string;
  actionId: string;
  shipmentNumber?: string | null;
  assignedByName?: string | null;
  targetUrl?: string | null;
}

export interface DocumentRequestNotificationOptions {
  toEmail: string;
  documentType: string;
  shipmentRef: string;
  portalUrl: string;
}

export class PlatformEmailService {
  private static getResendApiKey(): string {
    return process.env.RESEND_API_KEY || "";
  }

  private static getFromAddress(): string {
    return process.env.RESEND_FROM_ADDRESS || "notifications@inbound.qubere.ai";
  }

  /**
   * Core Platform Email Dispatcher
   */
  static async sendEmail(options: PlatformEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiKey = this.getResendApiKey();
    if (!apiKey) {
      console.error("[PlatformEmailService Error]: RESEND_API_KEY is missing.");
      return { success: false, error: "RESEND_API_KEY is not configured" };
    }

    try {
      const recipientList = Array.isArray(options.to) ? options.to : [options.to];

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${options.fromName || "Qubere Trade Compliance"} <${this.getFromAddress()}>`,
          to: recipientList,
          subject: options.subject,
          html: options.html,
          ...(options.text ? { text: options.text } : {}),
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[PlatformEmailService Success] -> ${recipientList.join(", ")} | MessageID: ${data.id}`);
        return { success: true, messageId: data.id };
      }

      console.error("[PlatformEmailService Error Response]:", data);
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[PlatformEmailService Exception]:", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Platform Capability: Task Assignment Email Notification
   */
  static async sendTaskAssignmentNotification(options: TaskAssignmentNotificationOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { toEmail, toName, taskTitle, actionId, shipmentNumber, assignedByName, targetUrl } = options;

    const recipientDisplayName = toName || toEmail.split("@")[0];
    const shipmentRefText = shipmentNumber ? ` (Shipment: ${shipmentNumber})` : "";
    const portalUrl = targetUrl || process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3002";
    const subject = `Action Item Assigned: [${actionId}] ${taskTitle}${shipmentRefText}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f7; margin: 0; padding: 24px; color: #1d1d1f; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e5e5ea; padding: 32px 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
            .header-badge { display: inline-block; background: #0071e3; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
            .title { font-size: 22px; font-weight: 800; color: #1d1d1f; margin: 0 0 12px 0; line-height: 1.3; }
            .subtitle { font-size: 14px; color: #86868b; margin: 0 0 24px 0; line-height: 1.5; }
            .card { background: #fbfbfd; border: 1px solid #e5e5ea; border-radius: 14px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #0071e3; }
            .btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; margin-top: 8px; }
            .footer { font-size: 12px; color: #86868b; margin-top: 32px; border-top: 1px solid #e5e5ea; padding-top: 16px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-badge">Task Assignment Notification</div>
            <h1 class="title">You have been assigned a new Action Item</h1>
            <p class="subtitle">Hello ${recipientDisplayName}, you have been assigned an action item requiring your attention on the Qubere Trade Compliance platform.</p>
            
            <div class="card">
              <div style="margin-bottom: 10px;">
                <span style="background: #eef6ff; color: #0071e3; font-family: monospace; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid #cce3ff;">
                  ${actionId}
                </span>
              </div>
              <div style="font-size: 16px; font-weight: 800; color: #1d1d1f; margin-bottom: 12px;">
                ${taskTitle}
              </div>
              ${shipmentNumber ? `<div style="font-size: 13px; color: #6e6e73; margin-bottom: 6px;"><strong>Shipment Ref:</strong> ${shipmentNumber}</div>` : ""}
              ${assignedByName ? `<div style="font-size: 13px; color: #6e6e73;"><strong>Assigned By:</strong> ${assignedByName}</div>` : ""}
            </div>

            <p style="font-size: 14px; color: #1d1d1f; line-height: 1.5; margin-bottom: 20px;">
              Log into the Qubere Customer Portal to review action details, communicate with your broker, or upload requested customs documentation.
            </p>

            <a href="${portalUrl}" class="btn">Open Action Item in Customer Portal &rarr;</a>

            <div class="footer">
              Qubere Trade Compliance Platform &bull; Automated Task Notification
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: toEmail,
      subject,
      html: htmlBody,
      fromName: "Qubere Trade Compliance",
    });
  }

  /**
   * Platform Capability: Counterparty Document Request Notification
   */
  static async sendDocumentRequestNotification(options: DocumentRequestNotificationOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { toEmail, documentType, shipmentRef, portalUrl } = options;

    const subject = `Action Required: Upload ${documentType} — Shipment ${shipmentRef}`;

    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
        <h2 style="margin:0 0 16px;font-size:20px;font-weight:700">Qubere Customer Portal — Document Upload Request</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
          You have been assigned access to fulfill a document request for customs entry processing:
        </p>
        <div style="background:#f4f4f8;border-radius:10px;padding:16px 20px;margin:0 0 20px;border-left:4px solid #0071e3">
          <strong style="font-size:15px">${documentType}</strong><br/>
          <span style="color:#666;font-size:13px">Shipment reference: ${shipmentRef}</span>
        </div>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444">
          Log into the Qubere Customer Portal to review your action items and upload the document.
        </p>
        <a href="${portalUrl}"
           style="display:inline-block;background:#0071e3;color:white;font-weight:600;font-size:15px;
                  padding:12px 28px;border-radius:8px;text-decoration:none">
          Open Action Item in Customer Portal &rarr;
        </a>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
        <p style="margin:0;font-size:12px;color:#999">
          Sent by Qubere · Trade Compliance Platform
        </p>
      </div>
    `;

    return this.sendEmail({
      to: toEmail,
      subject,
      html: htmlBody,
      fromName: "Qubere Customs Desk",
    });
  }
}

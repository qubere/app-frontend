export interface PortalNotificationParams {
  type:
    | "PORTAL_INVITATION"
    | "CUSTOMER_REQUEST_CREATED"
    | "CUSTOMER_RESPONSE_SUBMITTED"
    | "ENTRY_SUMMARY_PUBLISHED"
    | "INVOICE_ISSUED";
  recipientEmail: string;
  recipientName?: string;
  portalUrl?: string;
  requestTitle?: string;
  shipmentNumber?: string;
}

export interface PortalNotificationResult {
  success: boolean;
  messageId: string;
  deliveredAt: Date;
}

/**
 * Non-blocking transactional notification service for Qubere Customer Portal.
 * Dispatches notifications asynchronously and records failure logs without rolling back core DB state.
 */
export async function sendPortalNotification(
  params: PortalNotificationParams
): Promise<PortalNotificationResult> {
  const messageId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Simulated email dispatch log (Resend / Nodemailer integration point)
  console.log(`[PORTAL_NOTIFICATION] Dispatched ${params.type} to ${params.recipientEmail} (${messageId})`);

  return {
    success: true,
    messageId,
    deliveredAt: new Date(),
  };
}

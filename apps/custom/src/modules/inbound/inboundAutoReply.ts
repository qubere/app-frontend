import { db } from '@/lib/db';
import { getReceivedEmail, sendInboundReceipt } from '@/lib/inbound/resendClient';
export function shouldReplyToInbound(sender: string, headers: Record<string, string>, domain = process.env.INBOUND_EMAIL_DOMAIN || 'inbound.qubere.ai') {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]));
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender) && !sender.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
    && !/^(mailer-daemon|postmaster|no-?reply)@/i.test(sender)
    && (!h['auto-submitted'] || h['auto-submitted'] === 'no') && !/bulk|list|junk/.test(h.precedence || '') && !h['list-id'];
}
/** Durable at-most-once attempts; never run until the rollout's global gate is enabled. */
export async function runInboundAutoReplies() {
  if (process.env.INBOUND_AUTO_REPLY_ENABLED !== 'true') return;
  const emails = await db.inboundEmail.findMany({ where: { inboundAddress: { autoReplyEnabled: true }, routingStatus: { in: ['ACCEPTED', 'NEEDS_REVIEW', 'REJECTED'] }, autoReplyAttemptedAt: null }, orderBy: { createdAt: 'asc' }, take: 20, include: { inboundAddress: true, attachments: { select: { processingStatus: true } } } });
  for (const email of emails) {
    const claim = await db.inboundEmail.updateMany({ where: { id: email.id, autoReplyAttemptedAt: null }, data: { autoReplyAttemptedAt: new Date() } });
    if (!claim.count) continue;
    try {
      const headers = (email.authHeaders as Record<string, string> | null) ?? (await getReceivedEmail(email.providerEmailId)).headers ?? {};
      if (!shouldReplyToInbound(email.normalizedFromAddress, headers)) continue;
      const stored = email.attachments.filter(a => a.processingStatus === 'STORED').length;
      const text = email.routingStatus === 'REJECTED' ? 'Your email could not be accepted. Please contact your broker for the current document address or upload the documents in your portal.' : stored ? `We received ${stored} document${stored === 1 ? '' : 's'}. You can check their status in your portal. Your broker will review any uncertain shipment matches.` : 'Your email is with your broker for sender approval. Documents will be scanned after approval.';
      await sendInboundReceipt(email.id, email.normalizedFromAddress, text);
      await db.inboundEmail.update({ where: { id: email.id }, data: { autoReplySentAt: new Date() } });
    } catch (error) { console.error('[InboundAutoReply] Receipt attempt failed', { inboundEmailId: email.id, error: error instanceof Error ? error.message : 'unknown' }); }
  }
}

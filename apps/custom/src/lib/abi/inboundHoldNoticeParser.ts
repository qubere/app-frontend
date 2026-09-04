import { holdNoticeSchema } from "@/lib/pga/holdContracts";
import { DomainError } from "@/lib/api/error";

/**
 * Normalized, authenticated ingestion boundary. This is deliberately not a
 * guessed CBP fixed-width decoder. An ACE adapter must verify its source format
 * before calling this function. A bare "1A" does not identify a PGA or reason.
 */
export function parseInboundHoldNotice(value: unknown) {
  const parsed = holdNoticeSchema.safeParse(value);
  if (!parsed.success) throw new DomainError("Provide the agency, original notice, source reference, affected shipment and issue time.", "INVALID_HOLD_NOTICE", 422);
  if (new Date(parsed.data.issuedAt).getTime() > Date.now() + 300000) throw new DomainError("The hold issue time cannot be in the future.", "INVALID_HOLD_NOTICE", 422);
  return parsed.data;
}

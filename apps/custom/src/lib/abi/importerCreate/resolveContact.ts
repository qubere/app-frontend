// Resolve the importer contact phone/email for a CBP Form 5106 transmission
// from real onboarding data only.
//
// The 5106 transaction requires a phone (TD) and an email (TF). Historically
// the transmit route synthesised both (a "0000000000" phone and an
// "ops@<accountname>.com" email) when the onboarding record left them blank.
// That put fabricated contact data into a transaction addressed to CBP, which
// contradicts the codebase's stop-fabricating-CBP-data stance (cf. f0854773).
//
// This helper pulls the contact strictly from fields a human entered during
// onboarding. If neither a usable phone nor a usable email can be found the
// caller must block the transmission rather than invent values.

interface ContactPair {
  phone?: string | null;
  email?: string | null;
}

export interface OnboardingContactSources {
  /** FiveOhSixRecord.payload — its `contact` block is the most specific source. */
  fiveOhSixPayload?: unknown;
  /** OnboardingEntity.residentAgent JSON blob ({ name, address, phone }). */
  residentAgent?: unknown;
  /** OnboardingEntity.officers — each may carry its own phone/email. */
  officers?: ContactPair[] | null;
  /** ImporterOfRecord.address JSON blob — may carry phone/email. */
  iorAddress?: unknown;
  /** The Client (forwarder's customer) on the onboarding case. */
  client?:
    | {
        contactPhone?: string | null;
        contactEmail?: string | null;
        billingContactEmail?: string | null;
      }
    | null;
}

export type ResolvedOnboardingContact =
  | {
      ok: true;
      phone: string;
      email: string;
      /** Which source each value came from, for audit/event detail. */
      sources: { phone: string; email: string };
    }
  | { ok: false; missing: Array<"phone" | "email"> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A phone CBP will accept: 7-15 digits once separators are stripped. */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  // Reject repdigit placeholders like 0000000000 / 9999999999.
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Resolve a real phone and email for the 5106, walking the onboarding data in
 * order of specificity. Returns `{ ok: false, missing }` when either cannot be
 * sourced from human-entered data.
 */
export function resolveOnboardingContact(
  sources: OnboardingContactSources
): ResolvedOnboardingContact {
  const payloadContact = asRecord(asRecord(sources.fiveOhSixPayload).contact);
  const residentAgent = asRecord(sources.residentAgent);
  const iorAddress = asRecord(sources.iorAddress);
  const officers = Array.isArray(sources.officers) ? sources.officers : [];
  const client = sources.client ?? null;

  const phoneCandidates: Array<[string, unknown]> = [
    ["5106_contact", payloadContact.phone],
    ["resident_agent", residentAgent.phone],
    ...officers.map((o, i): [string, unknown] => [`officer_${i + 1}`, o?.phone]),
    ["importer_address", iorAddress.phone],
    ["client_contact", client?.contactPhone],
  ];
  const emailCandidates: Array<[string, unknown]> = [
    ["5106_contact", payloadContact.email],
    ...officers.map((o, i): [string, unknown] => [`officer_${i + 1}`, o?.email]),
    ["importer_address", iorAddress.email],
    ["client_contact", client?.contactEmail],
    ["client_billing_contact", client?.billingContactEmail],
  ];

  let phone: { value: string; source: string } | null = null;
  for (const [source, raw] of phoneCandidates) {
    const normalized = normalizePhone(raw);
    if (normalized) {
      phone = { value: normalized, source };
      break;
    }
  }

  let email: { value: string; source: string } | null = null;
  for (const [source, raw] of emailCandidates) {
    const normalized = normalizeEmail(raw);
    if (normalized) {
      email = { value: normalized, source };
      break;
    }
  }

  if (!phone || !email) {
    const missing: Array<"phone" | "email"> = [];
    if (!phone) missing.push("phone");
    if (!email) missing.push("email");
    return { ok: false, missing };
  }

  return {
    ok: true,
    phone: phone.value,
    email: email.value,
    sources: { phone: phone.source, email: email.source },
  };
}

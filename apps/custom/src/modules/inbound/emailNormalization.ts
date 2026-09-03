/**
 * Normalizes a sender email address for inbound-route matching.
 *
 * Trims surrounding whitespace and lowercases the whole address. Deliberately
 * does NOT collapse Gmail dots, strip plus-tags, or otherwise treat distinct
 * addresses as equivalent -- two different addresses must never silently
 * match the same route.
 */
export function normalizeSenderEmail(raw: string): string {
  return (raw.match(/<([^<>]+)>/)?.[1] ?? raw).trim().toLowerCase();
}

export interface ParsedSender {
  displayName: string | null;
  email: string | null;
  nameOrEmail: string | null;
}

/**
 * Parses a raw sender string (e.g. `"Jane Lohani" <janeilohani@gmail.com>` or `janeilohani@gmail.com`)
 * into display name and email components.
 * Returns `displayName` if present, falling back to `email` in `nameOrEmail`.
 */
export function parseSenderNameAndEmail(raw: string | null | undefined): ParsedSender {
  if (!raw) return { displayName: null, email: null, nameOrEmail: null };

  const trimmed = raw.trim();
  const angleMatch = trimmed.match(/^(.*?)\s*<([^<>]+)>$/);

  let displayName: string | null = null;
  let email: string | null = null;

  if (angleMatch) {
    let namePart = angleMatch[1]?.trim() ?? "";
    // Remove wrapping quotes
    namePart = namePart.replace(/^["']|["']$/g, "").trim();
    displayName = namePart || null;
    email = angleMatch[2]?.trim().toLowerCase() || null;
  } else if (trimmed.includes("@")) {
    email = trimmed.toLowerCase();
  } else {
    displayName = trimmed.replace(/^["']|["']$/g, "").trim() || null;
  }

  // If displayName is identical to email or is an email address itself, clear displayName
  if (displayName && (displayName.toLowerCase() === email || displayName.includes("@"))) {
    displayName = null;
  }

  const nameOrEmail = displayName || email || trimmed || null;
  return { displayName, email, nameOrEmail };
}

/**
 * True if `candidate` (a raw "To"/"received_for" address from the provider)
 * matches `expected` (an already-normalized configured recipient) after the
 * same normalization.
 */
export function recipientMatches(candidate: string, expected: string): boolean {
  return normalizeSenderEmail(candidate) === expected;
}


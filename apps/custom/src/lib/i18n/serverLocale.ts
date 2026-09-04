import { cookies } from "next/headers";

/**
 * Supported locale codes, mirrored from LanguageContext.tsx's `Locale` type.
 * Kept as a plain string union here (not imported from that "use client"
 * module) so server-only API routes don't pull client-side i18n code in.
 */
const SUPPORTED_LOCALES = ["en", "es", "zh", "de", "ja", "fr", "pt"] as const;
export type ServerLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Reads the user's current UI locale from the NEXT_LOCALE cookie set by
 * LanguageContext.tsx on the client (see setLocale/setCountryByCode there).
 * Used by server-side dropdown-options endpoints (procedure codes, actions,
 * message names) to localize the descriptions they return, so a Filing
 * Configuration dropdown always matches whatever language the signed-in
 * user last selected -- with no query param or header wiring needed on the
 * client, since the cookie already travels with every same-origin fetch.
 */
export async function getRequestLocale(): Promise<ServerLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "";
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? (raw as ServerLocale) : "en";
}

/**
 * Resolves the localized label for one row's `descriptions` JSON map
 * (locale -> description), falling back to the "en" entry, then the raw
 * code, when the requested locale (or English) has no override configured.
 */
export function localizeDescription(descriptions: unknown, locale: ServerLocale, fallbackCode: string): string {
  if (descriptions && typeof descriptions === "object") {
    const map = descriptions as Record<string, unknown>;
    const localized = map[locale];
    if (typeof localized === "string" && localized.trim()) return localized;
    const english = map.en;
    if (typeof english === "string" && english.trim()) return english;
  }
  return fallbackCode;
}

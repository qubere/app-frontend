/**
 * Normalizer Registry — Versioned deterministic value normalizers
 *
 * Provides named normalizers for dates, ISO country codes, currency codes,
 * incoterms, HTS/HS codes, port codes, and legal entity names.
 */

export type NormalizerFn = (value: unknown) => unknown;

export const NORMALIZER_REGISTRY: Record<string, NormalizerFn> = {
  partyNameNormalizer: (value: unknown): string => {
    if (!value) return "";
    return String(value)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\.(?=\s|$)/g, ""); // e.g. "Apex Electronics Ltd." -> "Apex Electronics Ltd"
  },

  uppercaseCodeNormalizer: (value: unknown): string => {
    if (!value) return "";
    return String(value).trim().toUpperCase();
  },

  isoCountryNormalizer: (value: unknown): string => {
    if (!value) return "";
    const str = String(value).trim().toUpperCase();
    // Common country aliases -> ISO-2
    const countryMap: Record<string, string> = {
      MEXICO: "MX",
      "UNITED STATES": "US",
      USA: "US",
      GERMANY: "DE",
      DEUTSCHLAND: "DE",
      CHINA: "CN",
      JAPAN: "JP",
      VIETNAM: "VN",
      CANADA: "CA",
    };
    return countryMap[str] || (str.length === 2 ? str : str.slice(0, 2));
  },

  isoDateNormalizer: (value: unknown): string | null => {
    if (!value) return null;
    const str = String(value).trim();
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // Match MM/DD/YYYY or DD/MM/YYYY
    const parts = str.split(/[/.-]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);

      if (p2 > 1900) {
        // MM/DD/YYYY format
        const mm = String(p0).padStart(2, "0");
        const dd = String(p1).padStart(2, "0");
        return `${p2}-${mm}-${dd}`;
      }
    }

    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }

    return str;
  },

  decimalMoneyNormalizer: (value: unknown): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return Number(value.toFixed(2));
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Number(parsed.toFixed(2));
  },

  decimalNumberNormalizer: (value: unknown): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  },

  integerNormalizer: (value: unknown): number | null => {
    if (value === undefined || value === null) return null;
    const parsed = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
    return isNaN(parsed) ? null : parsed;
  },

  htsCodeNormalizer: (value: unknown): string => {
    if (!value) return "";
    return String(value).replace(/[^0-9]/g, "");
  },

  cleanIdentifierNormalizer: (value: unknown): string => {
    if (!value) return "";
    return String(value).trim().replace(/\s+/g, "").toUpperCase();
  },

  scheduleDPortNormalizer: (value: unknown): string => {
    if (!value) return "";
    const digits = String(value).replace(/[^0-9]/g, "");
    return digits.padStart(4, "0").slice(0, 4);
  },

  cleanStringNormalizer: (value: unknown): string => {
    if (!value) return "";
    return String(value).trim();
  },
};

export function normalizeValue(normalizerName: string, value: unknown): unknown {
  const normalizer = NORMALIZER_REGISTRY[normalizerName];
  if (!normalizer) return value;
  return normalizer(value);
}

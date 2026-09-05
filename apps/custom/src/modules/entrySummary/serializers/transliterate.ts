/**
 * ASCII transliteration for CATAIR-style flat-file output (U9). CBP's own
 * fixed-width classes (A/AN/X) only accept a narrow ASCII range — this maps
 * common Latin diacritics down to plain ASCII and throws on anything it does
 * not have an explicit mapping for (emoji, CJK, ...), rather than silently
 * emitting "?" and corrupting the filing.
 */

import { UnsupportedCharacterError } from "./catairErrors";

const DIACRITIC_MAP: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a",
  Á: "A", À: "A", Â: "A", Ä: "A", Ã: "A", Å: "A",
  é: "e", è: "e", ê: "e", ë: "e",
  É: "E", È: "E", Ê: "E", Ë: "E",
  í: "i", ì: "i", î: "i", ï: "i",
  Í: "I", Ì: "I", Î: "I", Ï: "I",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  Ó: "O", Ò: "O", Ô: "O", Ö: "O", Õ: "O",
  ú: "u", ù: "u", û: "u", ü: "u",
  Ú: "U", Ù: "U", Û: "U", Ü: "U",
  ñ: "n", Ñ: "N",
  ç: "c", Ç: "C",
  ý: "y", ÿ: "y", Ý: "Y",
  ß: "ss",
};

/** Transliterates non-ASCII characters to ASCII. Throws UnsupportedCharacterError for anything unmapped. */
export function transliterateToAscii(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x7e) {
      out += ch;
      continue;
    }
    const mapped = DIACRITIC_MAP[ch];
    if (mapped === undefined) {
      throw new UnsupportedCharacterError(ch, value);
    }
    out += mapped;
  }
  return out;
}

/** Transliterate + uppercase, for class A/AN CATAIR fields. */
export function toCatairAlpha(value: string): string {
  return transliterateToAscii(value).toUpperCase();
}

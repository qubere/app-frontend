/** Shared error types for the CATAIR-style flat-file serializer (U9). */

export class FieldOverflowError extends Error {
  constructor(readonly blockId: string, readonly value: string, readonly maxLength: number) {
    super(`Field "${blockId}" value "${value}" exceeds its maximum length of ${maxLength} characters. Refusing to truncate.`);
    this.name = "FieldOverflowError";
  }
}

export class UnsupportedCharacterError extends Error {
  constructor(readonly character: string, readonly value: string) {
    super(`Value "${value}" contains character "${character}" (U+${character.codePointAt(0)?.toString(16).toUpperCase()}), which has no ASCII transliteration.`);
    this.name = "UnsupportedCharacterError";
  }
}

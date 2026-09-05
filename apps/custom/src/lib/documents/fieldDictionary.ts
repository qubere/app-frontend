/**
 * Field dictionary — the single lookup surface over `FIELD_INVENTORY`.
 *
 * The document flow historically carried five field-name vocabularies that
 * never translated (tradeMetadata camelCase, extractionSchemas snake_case,
 * reconciliationRules' own dialect, the canonical registry's dotted keys, and
 * Gemini's freeform entity labels). Every caller that needs to move between
 * them should go through the helpers here rather than hand-rolling a map.
 *
 * Backed by `src/modules/hydration/inventory/fieldInventory.ts`, folded together
 * with the `aliases` arrays already declared on `CANONICAL_FIELD_REGISTRY_V1`.
 */

import type { FieldInventoryItem } from "@/modules/hydration/types/canonicalRegistry";
import { FIELD_INVENTORY } from "@/modules/hydration/inventory/fieldInventory";
import { CANONICAL_FIELD_REGISTRY_V1 } from "@/modules/hydration/registry/canonicalRegistryV1";

export interface DictionaryField {
  /** Canonical id — a registry key, or an `annotation.*` id for document-scoped fields. */
  canonicalKey: string;
  /** camelCase key on `extractedJson.tradeMetadata`. */
  tradeMetadataKey?: string;
  /** Human label for review UIs. */
  label: string;
  /** snake_case names from `extractionSchemas.ts`. */
  extractionSchemaKeys: string[];
  /** `fieldKey` compared in `reconciliationRules.ts`, when this field is reconciled. */
  reconciliationKey?: string;
  /** Where an approved value lands. */
  scope: "shipment" | "lineItem" | "document";
  /** Doc types this field is expected on (display names, substring-matched). `["*"]` = any. */
  docTypes: string[];
  inventory: FieldInventoryItem;
}

function toDictionaryField(item: FieldInventoryItem): DictionaryField {
  return {
    canonicalKey: item.canonicalKey,
    tradeMetadataKey: item.tradeMetadataKey,
    label: item.fieldReviewLabel || item.legacyKey,
    extractionSchemaKeys: item.extractionSchemaKeys ?? [],
    reconciliationKey: item.reconciliationKey,
    scope: item.scope ?? "shipment",
    docTypes: item.docTypes ?? ["*"],
    inventory: item,
  };
}

export const DICTIONARY_FIELDS: DictionaryField[] = FIELD_INVENTORY.map(toDictionaryField);

// ── Alias index ───────────────────────────────────────────────────────────────

function norm(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** All the spellings that should resolve to a given dictionary field. */
function aliasesFor(field: DictionaryField): string[] {
  const item = field.inventory;
  const registryAliases =
    CANONICAL_FIELD_REGISTRY_V1[field.canonicalKey]?.aliases ?? [];
  return [
    field.canonicalKey,
    item.legacyKey,
    item.tradeMetadataKey,
    item.factFieldName,
    item.directShipmentColumn,
    item.fieldReviewLabel,
    ...(item.extractionSchemaKeys ?? []),
    item.reconciliationKey,
    ...registryAliases,
  ].filter((k): k is string => Boolean(k));
}

const ALIAS_TO_FIELD = new Map<string, DictionaryField>();
for (const field of DICTIONARY_FIELDS) {
  for (const alias of aliasesFor(field)) {
    const n = norm(alias);
    // First writer wins — inventory order is authoritative, registry aliases
    // only fill gaps.
    if (!ALIAS_TO_FIELD.has(n)) ALIAS_TO_FIELD.set(n, field);
  }
}

/**
 * Resolves any field spelling (snake, camel, dotted canonical, human label,
 * reconciliation key, registry alias) to its dictionary field. Returns null for
 * an unrecognised key.
 */
export function resolveField(key: string | null | undefined): DictionaryField | null {
  if (!key) return null;
  return ALIAS_TO_FIELD.get(norm(key)) ?? null;
}

/** Resolves any field spelling to its canonical id, or null. */
export function canonicalizeFieldKey(key: string | null | undefined): string | null {
  return resolveField(key)?.canonicalKey ?? null;
}

/** The `tradeMetadata` key for a field, given any spelling. */
export function tradeMetadataKeyFor(key: string): string | undefined {
  return resolveField(key)?.tradeMetadataKey;
}

/** The reconciliation `fieldKey` for a field, given any spelling. */
export function reconciliationKeyFor(key: string): string | undefined {
  return resolveField(key)?.reconciliationKey;
}

// ── Doc-type applicability ────────────────────────────────────────────────────

/** Case-insensitive, separator-insensitive substring match (handles enum + display names). */
export function docTypeMatches(docType: string | null | undefined, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!docType) return false;
  const a = docType.toLowerCase().replace(/[_-]+/g, " ");
  const b = pattern.toLowerCase().replace(/[_-]+/g, " ");
  return a.includes(b) || b.includes(a);
}

/**
 * The fields Qubere expects to find on a document of this type — drives the
 * per-document Field Review checklist (so a Packing List is not asked for an
 * Incoterm). Excludes line-item fields, which are reviewed in the line-item
 * table, not per document.
 */
export function expectedFieldsForDocType(docType: string | null | undefined): DictionaryField[] {
  return DICTIONARY_FIELDS.filter(
    (f) =>
      f.scope !== "lineItem" &&
      f.docTypes.length > 0 &&
      f.docTypes.some((p) => docTypeMatches(docType, p))
  );
}

// ── Value extraction ─────────────────────────────────────────────────────────

type ExtractedLine = { quantity?: number | string | null; totalAmount?: number | string | null };

/**
 * Reads a field's value out of a parsed `extractedJson`. `totalQuantity` /
 * `totalValue` fall back to the sum of extracted line items when the document
 * carries no header scalar — this is exactly what the invoice↔packing
 * reconciliation compares.
 */
export function extractedValueFor(
  key: string,
  tradeMetadata: Record<string, unknown> | null | undefined,
  lineItems: ExtractedLine[] | null | undefined
): string | null {
  const field = resolveField(key);
  if (!field) return null;
  const tm = tradeMetadata ?? {};
  const tmKey = field.tradeMetadataKey;

  const direct = tmKey ? tm[tmKey] : undefined;
  if (direct !== null && direct !== undefined && String(direct).trim() !== "") {
    return String(direct).trim();
  }

  const lines = Array.isArray(lineItems) ? lineItems : [];
  if (field.reconciliationKey === "totalQuantity" && lines.length > 0) {
    const sum = lines.reduce((s, li) => s + (Number(li.quantity) || 0), 0);
    return sum > 0 ? String(sum) : null;
  }
  if (field.reconciliationKey === "totalValue" && lines.length > 0) {
    const sum = lines.reduce((s, li) => s + (Number(li.totalAmount) || 0), 0);
    return sum > 0 ? String(sum) : null;
  }
  if (field.canonicalKey === "lineItem[].htsCode" && lines.length > 0) {
    return null; // reviewed per line item, not here
  }
  return null;
}

/**
 * All (reconciliationKey → value) pairs that can be derived from a parsed
 * `extractedJson`, for writing canonically-named `ExtractionField` rows the
 * reconciliation engine can compare on.
 */
export function reconciliationFieldValues(
  tradeMetadata: Record<string, unknown> | null | undefined,
  lineItems: ExtractedLine[] | null | undefined
): Array<{ fieldName: string; value: string }> {
  const out: Array<{ fieldName: string; value: string }> = [];
  const seen = new Set<string>();
  for (const field of DICTIONARY_FIELDS) {
    if (!field.reconciliationKey || seen.has(field.reconciliationKey)) continue;
    const value = extractedValueFor(field.canonicalKey, tradeMetadata, lineItems);
    if (value !== null) {
      out.push({ fieldName: field.reconciliationKey, value });
      seen.add(field.reconciliationKey);
    }
  }
  return out;
}

/**
 * All (extractionSchemas.ts fieldName → value) pairs derivable from a parsed
 * `extractedJson`, for backfilling `ExtractionField` rows the Field Review
 * panel can see. Gemini's `tradeMetadata` is schema-validated per field, but
 * its separate freeform `entities` array (the panel's only other row source)
 * is not required to mention every tradeMetadata field it populated -- so a
 * value can be genuinely present on the document and still have no row here.
 * This covers the same value space as `reconciliationFieldValues` but keyed
 * by every field's `extractionSchemaKeys[0]` (the vocabulary
 * `buildReviewFields`/`getRequiredFields` actually check against), not just
 * the small reconciliation-key subset.
 */
export function schemaFieldValues(
  tradeMetadata: Record<string, unknown> | null | undefined,
  lineItems: ExtractedLine[] | null | undefined
): Array<{ fieldName: string; value: string }> {
  const out: Array<{ fieldName: string; value: string }> = [];
  const seen = new Set<string>();
  for (const field of DICTIONARY_FIELDS) {
    const fieldName = field.extractionSchemaKeys[0];
    if (!fieldName || seen.has(fieldName)) continue;
    const value = extractedValueFor(field.canonicalKey, tradeMetadata, lineItems);
    if (value !== null) {
      out.push({ fieldName, value });
      seen.add(fieldName);
    }
  }
  return out;
}

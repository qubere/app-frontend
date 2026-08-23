/**
 * Schema-to-Widget Mapper
 *
 * Maps a JSON Schema node to the most appropriate UI widget type.
 * Used by the UI Configuration Editor to propose sensible defaults
 * that the user can override per field.
 *
 * Spec reference: §4.4 Schema-to-widget mapping rules
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WidgetType =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "time"
  | "email"
  | "url"
  | "phone"
  | "number"
  | "currency"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "autocomplete"
  | "multiselect"
  | "file"
  | "lookup";

/**
 * Result of the mapping — includes the recommended widget, a human-readable
 * reason explaining the choice, and how confident the mapper is.
 *
 * confidence:
 *   "definite"  — strong schema signal (enum present, explicit format, type is boolean, …)
 *   "suggested" — best-effort inference from field name or generic type
 */
export interface WidgetMapping {
  widget: WidgetType;
  reason: string;
  confidence: "definite" | "suggested";
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Word patterns that strongly suggest a specific widget regardless of schema type. */
const NAME_HINTS: Array<{ pattern: RegExp; widget: WidgetType; reason: string }> = [
  { pattern: /phone|mobile|tel(ephone)?/i, widget: "phone", reason: "Field name suggests phone number" },
  { pattern: /email|e-?mail/i, widget: "email", reason: "Field name suggests email address" },
  { pattern: /url|link|href|website|uri/i, widget: "url", reason: "Field name suggests URL" },
  { pattern: /currency|ccy|currencyCode/i, widget: "currency", reason: "Field name suggests currency" },
  { pattern: /attach|upload|document|file|blob/i, widget: "file", reason: "Field name suggests file attachment" },
  { pattern: /date$/i, widget: "date", reason: "Field name ends with 'date'" },
];

function inferFromName(fieldName: string): { widget: WidgetType; reason: string } | null {
  for (const hint of NAME_HINTS) {
    if (hint.pattern.test(fieldName)) {
      return { widget: hint.widget, reason: hint.reason };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main mapping function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the recommended widget for a JSON Schema node.
 *
 * @param schema   The JSON Schema property object (may include type, format, enum, items, …)
 * @param fieldName Optional field name used for name-based heuristics
 */
export function schemaToDefaultWidget(schema: any, fieldName?: string): WidgetMapping {
  if (!schema) {
    return { widget: "text", reason: "No schema — defaulting to text input", confidence: "suggested" };
  }

  const type: string = schema.type ?? "";
  const format: string = schema.format ?? "";
  const enumValues: unknown[] | undefined = schema.enum;
  const maxLength: number | undefined = schema.maxLength;

  // ── boolean ──────────────────────────────────────────────────────────────
  if (type === "boolean") {
    return { widget: "checkbox", reason: "Boolean type maps to toggle/checkbox", confidence: "definite" };
  }

  // ── number / integer ─────────────────────────────────────────────────────
  if (type === "number" || type === "integer") {
    // Check name for currency hints
    if (fieldName && /amount|value|price|rate|cost|fee/i.test(fieldName)) {
      return { widget: "currency", reason: "Numeric field name suggests currency/amount", confidence: "suggested" };
    }
    return {
      widget: "number",
      reason: `${type} type maps to numeric input`,
      confidence: "definite",
    };
  }

  // ── array ─────────────────────────────────────────────────────────────────
  if (type === "array") {
    const items = schema.items;
    if (items) {
      const itemType = items.type ?? "";
      if (itemType === "object" || items.properties) {
        // Complex array — widget is not a simple input; caller should use layout config
        return {
          widget: "lookup",
          reason: "Array of objects — use Layout Configuration to choose table/party-card rendering",
          confidence: "suggested",
        };
      }
      if (items.enum) {
        return { widget: "multiselect", reason: "Array of enum values maps to multi-select", confidence: "definite" };
      }
    }
    return { widget: "multiselect", reason: "Array of primitives maps to multi-select/tag input", confidence: "definite" };
  }

  // ── object ────────────────────────────────────────────────────────────────
  if (type === "object" || schema.properties) {
    return {
      widget: "lookup",
      reason: "Object type — use Layout Configuration (panel/card) instead of a field widget",
      confidence: "suggested",
    };
  }

  // ── string: explicit format ───────────────────────────────────────────────
  if (type === "string" || type === "") {
    if (format === "date") {
      return { widget: "date", reason: 'format: "date" maps to date picker', confidence: "definite" };
    }
    if (format === "date-time" || format === "datetime") {
      return { widget: "datetime", reason: 'format: "date-time" maps to date-time picker', confidence: "definite" };
    }
    if (format === "time") {
      return { widget: "time", reason: 'format: "time" maps to time picker', confidence: "definite" };
    }
    if (format === "email") {
      return { widget: "email", reason: 'format: "email" maps to email input', confidence: "definite" };
    }
    if (format === "uri" || format === "url") {
      return { widget: "url", reason: 'format: "uri"/"url" maps to URL input', confidence: "definite" };
    }
    if (format === "phone" || format === "tel") {
      return { widget: "phone", reason: 'format: "phone"/"tel" maps to phone input', confidence: "definite" };
    }
    if (format === "textarea") {
      return { widget: "textarea", reason: 'format: "textarea" hint maps to textarea', confidence: "definite" };
    }
    if (format === "binary" || format === "byte" || format === "base64") {
      return { widget: "file", reason: "Binary format maps to file upload", confidence: "definite" };
    }

    // ── enum ───────────────────────────────────────────────────────────────
    if (enumValues && enumValues.length > 0) {
      if (enumValues.length <= 6) {
        return {
          widget: "radio",
          reason: `Small enum (${enumValues.length} options ≤ 6) maps to radio group`,
          confidence: "definite",
        };
      }
      return {
        widget: "dropdown",
        reason: `Large enum (${enumValues.length} options > 6) maps to dropdown/select`,
        confidence: "definite",
      };
    }

    // ── long text ──────────────────────────────────────────────────────────
    if (maxLength !== undefined && maxLength > 250) {
      return {
        widget: "textarea",
        reason: `maxLength ${maxLength} > 250 maps to textarea`,
        confidence: "definite",
      };
    }

    // ── name-based heuristics (string fallback) ───────────────────────────
    if (fieldName) {
      const hint = inferFromName(fieldName);
      if (hint) {
        return { ...hint, confidence: "suggested" };
      }
    }

    return { widget: "text", reason: "Generic string maps to single-line text input", confidence: "suggested" };
  }

  // ── fallback ──────────────────────────────────────────────────────────────
  return { widget: "text", reason: "Unknown type — defaulting to text input", confidence: "suggested" };
}

/**
 * Returns true when the user-chosen widget differs from the schema default.
 * Used to show the "customized" badge in the editor.
 */
export function isWidgetCustomized(
  chosenWidget: string,
  schema: any,
  fieldName?: string
): boolean {
  const { widget: defaultWidget } = schemaToDefaultWidget(schema, fieldName);
  return chosenWidget !== defaultWidget;
}

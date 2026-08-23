/**
 * Sample Data Generator
 *
 * Generates representative sample form data from a JSON Schema.
 * Used in the Live Preview panel to populate the form so conditional logic,
 * data sources, and layout choices can be evaluated realistically.
 *
 * Rules:
 *  - Arrays of objects: generates 2 sample items
 *  - Strings: derive a readable value from the field name
 *  - Enums: first value
 *  - Dates: today in ISO format
 *  - Booleans: false
 *  - Numbers: schema.minimum ?? 1
 */

export interface SampleDataOptions {
  /** Max depth to recurse into nested objects. Default: 5 */
  maxDepth?: number;
  /** Number of items to generate for array fields. Default: 2 */
  arrayItemCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toReadableLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function todayDateTime(): string {
  return new Date().toISOString().slice(0, 16);
}

function sampleStringFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/date/.test(lower)) return todayISO();
  if (/time/.test(lower)) return "09:00";
  if (/email/.test(lower)) return "example@domain.com";
  if (/phone|mobile|tel/.test(lower)) return "+1-555-0100";
  if (/country/.test(lower)) return "NL";
  if (/currency|ccy/.test(lower)) return "EUR";
  if (/code/.test(lower)) return "H1";
  if (/port/.test(lower)) return "NLRTM";
  if (/name/.test(lower)) return toReadableLabel(name) + " Sample";
  if (/description|remarks|notes/.test(lower)) return "Sample " + toReadableLabel(name);
  if (/id$/.test(lower)) return "SMP-001";
  if (/number$|no$/.test(lower)) return "001";
  return "Sample " + toReadableLabel(name);
}

function resolveRef(ref: string, rootDefs: Record<string, any>): any {
  if (ref.startsWith("#/$defs/") || ref.startsWith("#/definitions/")) {
    const key = ref.replace("#/$defs/", "").replace("#/definitions/", "");
    return rootDefs[key] ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core generator
// ─────────────────────────────────────────────────────────────────────────────

function generateValue(
  schema: any,
  fieldName: string,
  rootDefs: Record<string, any>,
  depth: number,
  maxDepth: number,
  arrayItemCount: number
): any {
  if (!schema) return undefined;

  // Resolve $ref
  let s = schema;
  if (s.$ref) {
    const resolved = resolveRef(s.$ref, rootDefs);
    if (resolved) s = resolved;
  }

  const type: string = s.type ?? "";

  // boolean
  if (type === "boolean") return false;

  // number / integer
  if (type === "number" || type === "integer") {
    return s.minimum ?? s.minimum === 0 ? s.minimum : 1;
  }

  // array
  if (type === "array") {
    if (depth >= maxDepth) return [];
    const items = s.items;
    if (!items) return [];
    const itemsSchema = items.$ref ? (resolveRef(items.$ref, rootDefs) ?? items) : items;
    return Array.from({ length: arrayItemCount }, (_, i) =>
      generateValue(itemsSchema, `${fieldName}[${i}]`, rootDefs, depth + 1, maxDepth, arrayItemCount)
    );
  }

  // object
  if (type === "object" || s.properties) {
    if (depth >= maxDepth) return {};
    const result: Record<string, any> = {};
    const props = s.properties ?? {};
    for (const [propName, propSchema] of Object.entries(props)) {
      result[propName] = generateValue(propSchema as any, propName, rootDefs, depth + 1, maxDepth, arrayItemCount);
    }
    return result;
  }

  // string
  if (type === "string" || type === "") {
    // enum → first value
    if (s.enum && s.enum.length > 0) return s.enum[0];

    // format hints
    const fmt = s.format ?? "";
    if (fmt === "date") return todayISO();
    if (fmt === "date-time" || fmt === "datetime") return todayDateTime();
    if (fmt === "time") return "09:00";
    if (fmt === "email") return "example@domain.com";
    if (fmt === "uri" || fmt === "url") return "https://example.com";
    if (fmt === "phone" || fmt === "tel") return "+1-555-0100";
    if (fmt === "binary" || fmt === "byte") return "";

    return sampleStringFromName(fieldName);
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a flat Record<string, any> of sample values for every visible field
 * in the provided FilingUIConfigData fields list, using the JSON Schema to
 * produce type-appropriate values.
 *
 * The result is keyed by fieldPath (dot-notation) so it can be passed directly
 * to the LayoutRenderer / DefaultSchemaRenderer as formData.
 */
export function generateSampleDataFromConfig(
  configFields: Array<{ fieldPath: string; fieldType?: string }>,
  schema: any,
  options: SampleDataOptions = {}
): Record<string, any> {
  const { maxDepth = 5, arrayItemCount = 2 } = options;
  const rootDefs = schema?.$defs ?? schema?.definitions ?? {};
  const data: Record<string, any> = {};

  for (const field of configFields) {
    if (!field.fieldPath) continue;

    // Navigate schema to the field's node
    const parts = field.fieldPath.replace(/\[\]$/, "").split(".");
    let node: any = schema;
    for (const part of parts) {
      if (!node) break;
      if (node.$ref) node = resolveRef(node.$ref, rootDefs) ?? node;
      if (node.properties) {
        node = node.properties[part];
      } else if (node.items) {
        const items = node.items.$ref ? (resolveRef(node.items.$ref, rootDefs) ?? node.items) : node.items;
        node = items?.properties?.[part] ?? items;
      } else {
        node = undefined;
      }
    }

    const value = generateValue(
      node ?? { type: "string" },
      parts[parts.length - 1] ?? field.fieldPath,
      rootDefs,
      0,
      maxDepth,
      arrayItemCount
    );

    // Set dot-path value
    setNestedValue(data, field.fieldPath, value);
  }

  return data;
}

/**
 * Generate sample data by walking the full JSON Schema (not limited to
 * configured fields). Useful when the config has no fields yet.
 */
export function generateSampleDataFromSchema(
  schema: any,
  options: SampleDataOptions = {}
): Record<string, any> {
  const { maxDepth = 3, arrayItemCount = 2 } = options;
  const rootDefs = schema?.$defs ?? schema?.definitions ?? {};

  // Unwrap root declaration wrapper
  let rootSchema = schema;
  if (rootSchema?.properties) {
    const keys = Object.keys(rootSchema.properties);
    if (keys.length === 1 && (keys[0] === "ImportDeclaration" || keys[0] === "ExportDeclaration")) {
      rootSchema = rootSchema.properties[keys[0]];
    }
  }

  return generateValue(rootSchema, "root", rootDefs, 0, maxDepth, arrayItemCount) ?? {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: set a deep dot-path on an object (mutates)
// ─────────────────────────────────────────────────────────────────────────────
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }
  const last = parts[parts.length - 1];
  if (last) current[last] = value;
}

/**
 * Schema Layout Advisor
 *
 * Analyses a JSON Schema node and recommends the best layout type for the
 * UI Configuration Editor. This is the UX brain that looks at the schema's
 * shape (type, cardinality, depth, property names) and says:
 *   "This looks like a Repeater" or "This should be a TabSheet."
 *
 * Used by ComplexObjectConfigPanel to:
 *  1. Auto-highlight the recommended option
 *  2. Show the reasoning to the user
 *  3. Surface a "⚡ Customized" badge when the user overrides the suggestion
 */

export type LayoutType =
  | "panel"
  | "tabsheet"
  | "tab"
  | "card"
  | "repeater"
  | "party-cards";

export interface LayoutAdvice {
  recommended: LayoutType;
  reason: string;
  /** Short label for the badge shown inside the layout picker */
  badge: string;
  confidence: "definite" | "suggested";
}

// ─────────────────────────────────────────────────────────────────────────────
// Party name patterns — arrays whose items represent named trading parties
// get the Party Cards treatment, not a generic table
// ─────────────────────────────────────────────────────────────────────────────
const PARTY_FIELD_PATTERNS = /consign|consignee|consignor|seller|buyer|shipper|receiver|trader|importer|exporter|party|parties|supplier|customer|declarant|representative|broker|agent/i;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveRef(ref: string, rootDefs: Record<string, any>): any {
  const key = ref.replace("#/$defs/", "").replace("#/definitions/", "");
  return rootDefs[key] ?? null;
}

function getProperties(schema: any, rootDefs: Record<string, any>): Record<string, any> {
  if (!schema) return {};
  let s = schema;
  if (s.$ref) s = resolveRef(s.$ref, rootDefs) ?? s;
  return s.properties ?? {};
}

function countComplexChildren(schema: any, rootDefs: Record<string, any>): number {
  const props = getProperties(schema, rootDefs);
  return Object.values(props).filter((p: any) => {
    let resolved = p;
    if (p.$ref) resolved = resolveRef(p.$ref, rootDefs) ?? p;
    return resolved.type === "object" || resolved.type === "array" || resolved.properties;
  }).length;
}

function countAllChildren(schema: any, rootDefs: Record<string, any>): number {
  return Object.keys(getProperties(schema, rootDefs)).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main advisor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recommend the best layout type for a schema node.
 *
 * @param schema    The JSON Schema property node (type, properties, items, etc.)
 * @param fieldName The property name in the parent schema (used for heuristics)
 * @param rootDefs  Root $defs / definitions for $ref resolution
 */
export function adviseLayout(
  schema: any,
  fieldName: string,
  rootDefs: Record<string, any> = {}
): LayoutAdvice {
  if (!schema) {
    return { recommended: "panel", reason: "No schema available", badge: "Suggested", confidence: "suggested" };
  }

  let s = schema;
  if (s.$ref) s = resolveRef(s.$ref, rootDefs) ?? s;

  const isArray = s.type === "array" || !!s.items;
  const isObject = s.type === "object" || !!s.properties;

  // ── Array ─────────────────────────────────────────────────────────────────
  if (isArray) {
    let itemSchema = s.items;
    if (itemSchema?.$ref) itemSchema = resolveRef(itemSchema.$ref, rootDefs) ?? itemSchema;

    const isArrayOfObjects = itemSchema?.type === "object" || !!itemSchema?.properties;

    if (isArrayOfObjects) {
      // Party heuristic: field name matches party-like pattern
      if (PARTY_FIELD_PATTERNS.test(fieldName)) {
        return {
          recommended: "party-cards",
          reason: `"${fieldName}" looks like a named trading party — each item gets its own card with an Edit button.`,
          badge: "Party Cards",
          confidence: "suggested",
        };
      }

      // Large/unbounded arrays → Table Repeater
      return {
        recommended: "repeater",
        reason: `"${fieldName}" is an array of objects — a table with "Add row" lets users manage multiple items inline.`,
        badge: "Repeater",
        confidence: "definite",
      };
    }

    // Array of primitives → should be handled as a field widget (multiselect), not a layout
    return {
      recommended: "panel",
      reason: `"${fieldName}" is an array of primitives — configure it as a field (multi-select / tag input) rather than a layout.`,
      badge: "Field widget",
      confidence: "suggested",
    };
  }

  // ── Object ────────────────────────────────────────────────────────────────
  if (isObject) {
    const totalChildren = countAllChildren(s, rootDefs);
    const complexChildren = countComplexChildren(s, rootDefs);

    // Object with many complex children → TabSheet (one tab per child)
    if (complexChildren >= 3) {
      return {
        recommended: "tabsheet",
        reason: `"${fieldName}" has ${complexChildren} complex children — a TabSheet keeps each sub-group on its own tab.`,
        badge: "TabSheet",
        confidence: "definite",
      };
    }

    // Object with moderate complex children (2) → TabSheet is good
    if (complexChildren === 2) {
      return {
        recommended: "tabsheet",
        reason: `"${fieldName}" has 2 complex sub-objects — TabSheet separates them cleanly.`,
        badge: "TabSheet",
        confidence: "suggested",
      };
    }

    // Visually distinct entity (name suggests a standalone entity) → Card
    if (/^(declaration|permit|clearance|certificate|licence|license|document|manifest)$/i.test(fieldName)) {
      return {
        recommended: "card",
        reason: `"${fieldName}" is a standalone document or permit — a Card gives it visual emphasis.`,
        badge: "Card",
        confidence: "suggested",
      };
    }

    // Dense, flat object with many leaf fields → Panel
    if (totalChildren > 0 && complexChildren === 0) {
      const label = totalChildren > 8 ? `${totalChildren} leaf fields` : `${totalChildren} fields`;
      return {
        recommended: "panel",
        reason: `"${fieldName}" has ${label} and no nested objects — a collapsible Panel keeps it tidy.`,
        badge: "Panel",
        confidence: "definite",
      };
    }

    // Default for mixed objects
    return {
      recommended: "panel",
      reason: `"${fieldName}" is a single object — a Panel is the default; switch to TabSheet if it has complex children.`,
      badge: "Panel",
      confidence: "suggested",
    };
  }

  return {
    recommended: "panel",
    reason: "Unknown schema shape — defaulting to Panel.",
    badge: "Suggested",
    confidence: "suggested",
  };
}

/** Visual metadata for each layout type used in the picker UI */
export const LAYOUT_META: Record<
  LayoutType,
  {
    label: string;
    icon: string;
    description: string;
    bestFor: string;
    /** CSS class for the colored accent used in the thumbnail */
    accentClass: string;
    /** For which schema shapes this layout is appropriate */
    suitableFor: ("object" | "array")[];
  }
> = {
  panel: {
    label: "Panel",
    icon: "📋",
    description: "Collapsible section within the form — fields in a grid inside a bordered box",
    bestFor: "Single objects with a moderate number of leaf fields",
    accentClass: "bg-blue-500",
    suitableFor: ["object"],
  },
  tabsheet: {
    label: "TabSheet",
    icon: "📑",
    description: "Creates a row of tabs — one tab per direct complex child property",
    bestFor: "Objects whose children are distinct sub-forms (e.g. Traders → Consignor / Consignee)",
    accentClass: "bg-purple-500",
    suitableFor: ["object"],
  },
  tab: {
    label: "Tab",
    icon: "📄",
    description: "This object becomes a single tab inside a parent TabSheet",
    bestFor: "An object that is a direct child of a TabSheet node",
    accentClass: "bg-green-500",
    suitableFor: ["object"],
  },
  card: {
    label: "Card",
    icon: "🎴",
    description: "Visually elevated card with a border and shadow — stands out from surrounding fields",
    bestFor: "Documents, permits, or certificates that need visual emphasis",
    accentClass: "bg-amber-500",
    suitableFor: ["object"],
  },
  repeater: {
    label: "Repeater (Table)",
    icon: "🗂️",
    description: 'Table with "Add row" — each row opens a full edit drawer for that item',
    bestFor: "Unbounded arrays: GoodsShipment, GoodsItem, Documents, line items",
    accentClass: "bg-teal-500",
    suitableFor: ["array"],
  },
  "party-cards": {
    label: "Party Cards",
    icon: "👥",
    description: "Horizontal cards — one card per party, each showing key fields with an Edit button",
    bestFor: "Fixed sets of named trading parties: Consignor, Consignee, Seller, Buyer",
    accentClass: "bg-pink-500",
    suitableFor: ["array"],
  },
};

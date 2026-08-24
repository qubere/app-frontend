"use client";

import React from "react";
import TabbedFormLayout from "./TabbedFormLayout";
import type { FieldConfig, FilingUIConfigData } from "@/types/ui-config.types";
import ArrayGridView from "@/app/app/filing/[id]/ArrayGridView";

interface LayoutRendererProps {
  config: FilingUIConfigData;
  formData: Record<string, any>;
  onChange: (path: string, value: any) => void;
  errors?: Record<string, string>;
  /** Optional JSON Schema for the combination â€” enables Repeater rendering for array layoutHints */
  schema?: any;
}

const gridColumns: Record<number, string> = {
  3: "col-span-3",
  4: "col-span-4",
  6: "col-span-6",
  8: "col-span-8",
  12: "col-span-12",
};

function getNestedValue(data: Record<string, any>, fieldPath: string): any {
  let value: any = data;
  for (const part of fieldPath.split(".")) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

function BasicField({
  field,
  formData,
  onChange,
  errors = {},
}: {
  field: FieldConfig;
  formData: Record<string, any>;
  onChange: (path: string, value: any) => void;
  errors?: Record<string, string>;
}) {
  const value = getNestedValue(formData, field.fieldPath);
  const error = errors[field.fieldPath];
  const disabled = Boolean(field.isReadOnly);
  const required = Boolean(field.isRequired);
  const gridColClass = gridColumns[field.gridColumn || 4] ?? "col-span-4";

  return (
    <div className={gridColClass}>
      <label className="block text-sm font-medium text-ink mb-1">
        {field.fieldLabel}{required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        type={field.fieldType === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(field.fieldPath, e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={field.placeholder}
        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${error ? "border-red-500" : "border-border"} ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
      />
      {field.helpText && <p className="text-xs text-ink-muted mt-1">{field.helpText}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function LayoutRenderer({ config, formData, onChange, errors = {}, schema }: LayoutRendererProps) {
  if (config.layoutHints && Object.keys(config.layoutHints).length > 0) {
    return <LayoutHintsRenderer config={config} formData={formData} onChange={onChange} errors={errors} schema={schema} />;
  }

  switch (config.layout?.mode || "single-page") {
    case "tabs":
      return <TabbedFormLayout config={config} formData={formData} onChange={onChange} errors={errors} />;
    case "accordion":
      return <ComingSoonLayout name="Accordion" />;
    case "panels":
      return <ComingSoonLayout name="Panel" />;
    default:
      return <SinglePageLayout config={config} formData={formData} onChange={onChange} errors={errors} />;
  }
}

function ComingSoonLayout({ name }: { name: string }) {
  return (
    <div className="p-8 text-center">
      <p className="text-ink-muted">{name} layout coming soon</p>
      <p className="text-xs text-ink-muted mt-2">For now, use tabs or single-page mode</p>
    </div>
  );
}

function SinglePageLayout({ config, formData, onChange, errors = {} }: LayoutRendererProps) {
  const visibleSections = [...config.sections]
    .filter((section) => section.isVisible !== false)
    .sort((a, b) => (a.sectionOrder ?? a.displayOrder ?? 0) - (b.sectionOrder ?? b.displayOrder ?? 0));

  return (
    <div className="p-6">
      {visibleSections.map((section) => {
        const fields = config.fields
          .filter((field) => (field.sectionId ?? field.section) === section.sectionId && field.isVisible !== false)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        if (fields.length === 0) return null;
        return (
          <div key={section.sectionId} className="mb-8">
            <div className="mb-4">
              <h3 className="text-base font-bold text-ink">{section.title}</h3>
              {section.description && <p className="text-sm text-ink-muted mt-1">{section.description}</p>}
            </div>
            <div className="grid grid-cols-12 gap-4">
              {fields.map((field) => <BasicField key={field.fieldPath} field={field} formData={formData} onChange={onChange} errors={errors} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * LayoutHintsRenderer
 *
 * Renders a form driven by the layoutHints map from FilingUIConfigData.
 *
 * Mental model / routing rules:
 *
 * Given layoutHints like:
 *   GoodsDeclaration             â†’ "tabsheet"
 *   GoodsDeclaration.Business    â†’ "tab"
 *   GoodsDeclaration.InternalDataâ†’ "panel"
 *   GoodsShipment                â†’ "repeater"
 *
 * A visible field GoodsDeclaration.DeclarationNumber:
 *   â†’ owner = GoodsDeclaration (tabsheet)           â†’ HEADER of that tabsheet section
 * A visible field GoodsDeclaration.Business.Name:
 *   â†’ owner = GoodsDeclaration.Business (tab)       â†’ content of Business tab
 * A visible field GoodsDeclaration.InternalData.Code:
 *   â†’ owner = GoodsDeclaration.InternalData (panel) â†’ inside InternalData panel
 *     â†’ InternalData panel is inside GoodsDeclaration tabsheet? no direct tab, so header area
 * A visible field DeclarationNumber (top-level, no owner):
 *   â†’ directFields                                  â†’ Declaration section (flat grid)
 * GoodsShipment is a repeater â†’ rendered as ArrayGridView table, fields inside it IGNORED
 *
 * Layout sections rendered (top-to-bottom):
 *  1. Declaration (top-level fields with no owner)
 *  2. Top-level panels/cards
 *  3. TabSheets â€” each rendered as its own bordered section with:
 *       a. Header fields (direct children of tabsheet not inside any tab)
 *       b. Tab strip (children with hint="tab")
 *       c. Active tab content (fields + nested panels inside that tab)
 *  4. Repeaters (ArrayGridView tables)
 */
function LayoutHintsRenderer({ config, formData, onChange, errors = {}, schema }: LayoutRendererProps) {
  const visibleFields = React.useMemo(
    () => config.fields.filter((f) => f.isVisible !== false),
    [config.fields]
  );
  const layoutHints = React.useMemo(() => config.layoutHints || {}, [config.layoutHints]);

  // â”€â”€ Schema helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rootDefs = React.useMemo(() => schema?.$defs ?? schema?.definitions ?? {}, [schema]);

  const resolveRef = React.useCallback((ref: string): any => {
    const key = ref.replace("#/$defs/", "").replace("#/definitions/", "");
    return rootDefs[key] ?? null;
  }, [rootDefs]);

  const getSchemaAtPath = React.useCallback((dotPath: string): any => {
    if (!schema) return null;
    let node: any = schema;
    if (node?.properties) {
      const keys = Object.keys(node.properties);
      if (keys.length === 1 && (keys[0] === "ImportDeclaration" || keys[0] === "ExportDeclaration")) {
        node = node.properties[keys[0]];
      }
    }
    for (const part of dotPath.split(".")) {
      if (!node) return null;
      if (node.$ref) node = resolveRef(node.$ref) ?? node;
      node = node.properties?.[part]
        ?? (node.items?.$ref ? resolveRef(node.items.$ref) : node.items)?.properties?.[part]
        ?? null;
    }
    // Resolve any $ref on the final node so callers always get a concrete schema
    if (node?.$ref) node = resolveRef(node.$ref) ?? node;
    return node;
  }, [schema, resolveRef]);

  // â”€â”€ Classify every hinted path by type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabsheetPaths = React.useMemo(
    () => Object.entries(layoutHints).filter(([, t]) => t === "tabsheet").map(([p]) => p).sort(),
    [layoutHints]
  );
  const tabPaths = React.useMemo(
    () => Object.entries(layoutHints).filter(([, t]) => t === "tab").map(([p]) => p).sort(),
    [layoutHints]
  );
  const panelPaths = React.useMemo(
    () => Object.entries(layoutHints).filter(([, t]) => t === "panel" || t === "card").map(([p]) => p).sort(),
    [layoutHints]
  );
  const repeaterPaths = React.useMemo(
    () => Object.entries(layoutHints).filter(([, t]) => t === "repeater" || t === "party-cards").map(([p]) => p).sort(),
    [layoutHints]
  );

  // â”€â”€ Active tab state per tabsheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const initialTabs = React.useMemo(() => {
    const m: Record<string, string> = {};
    tabsheetPaths.forEach((tsp) => {
      const first = tabPaths.find((tp) => tp.startsWith(`${tsp}.`));
      if (first) m[tsp] = first;
    });
    return m;
  }, [tabsheetPaths, tabPaths]);

  const [activeTabs, setActiveTabs] = React.useState<Record<string, string>>(initialTabs);

  React.useEffect(() => {
    setActiveTabs((prev) => {
      const next = { ...prev };
      tabsheetPaths.forEach((tsp) => {
        if (!next[tsp]) {
          const first = tabPaths.find((tp) => tp.startsWith(`${tsp}.`));
          if (first) next[tsp] = first;
        }
      });
      return next;
    });
  }, [tabsheetPaths, tabPaths]);

  // â”€â”€ Field ownership â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Find the MOST SPECIFIC hinted path that owns this field.
   * "Owns" = field path starts with `${hintPath}.` or `${hintPath}[].`
   * Returns { path, type } or null.
   */
  const getOwner = React.useCallback(
    (fieldPath: string): { path: string; type: string } | null => {
      const candidates = Object.entries(layoutHints).filter(
        ([hp]) => fieldPath.startsWith(`${hp}.`) || fieldPath.startsWith(`${hp}[].`)
      );
      if (!candidates.length) return null;
      const [path, type] = candidates.sort(([a], [b]) => b.length - a.length)[0];
      return { path, type };
    },
    [layoutHints]
  );

  // â”€â”€ Route all visible fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // directFields: truly top-level, no hint owner â†’ Declaration flat grid
  // tabsheetHeaderFields[tabsheetPath]: direct children of tabsheet NOT inside any tab
  // tabFields[tabPath]: fields inside a specific tab
  // panelFields[panelPath]: fields inside a panel (that isn't inside a tabsheet)

  const directFields: FieldConfig[] = [];
  const tabsheetHeaderFields: Record<string, FieldConfig[]> = {};
  const tabFields: Record<string, FieldConfig[]> = {};
  const standalonePanelFields: Record<string, FieldConfig[]> = {};

  for (const field of visibleFields) {
    const owner = getOwner(field.fieldPath);

    // â”€â”€ 1. No owner â†’ top-level Declaration field
    if (!owner) {
      directFields.push(field);
      continue;
    }

    // â”€â”€ 2. Owner is a repeater â†’ handled by ArrayGridView, never add to any list
    if (owner.type === "repeater" || owner.type === "party-cards") {
      continue;
    }

    // â”€â”€ 3. Owner is a tab â†’ assign to that tab's list
    if (owner.type === "tab") {
      // Orphaned tab: only route to tabFields if a parent tabsheet exists.
      // Without a tabsheet, fall back to directFields so fields remain visible.
      const hasParentTabsheet = tabsheetPaths.some((tsp) => owner.path.startsWith(`${tsp}.`));
      if (hasParentTabsheet) {
        (tabFields[owner.path] ??= []).push(field);
      } else {
        directFields.push(field);
      }
      continue;
    }

    // â”€â”€ 4. Owner is a tabsheet â†’ this field is a "header field" of that tabsheet
    if (owner.type === "tabsheet") {
      (tabsheetHeaderFields[owner.path] ??= []).push(field);
      continue;
    }

    // â”€â”€ 5. Owner is a panel/card
    if (owner.type === "panel" || owner.type === "card") {
      // Is this panel inside a tab?
      const parentTab = tabPaths.find(
        (tp) => owner.path.startsWith(`${tp}.`)
      );
      if (parentTab) {
        // Assign to the tab; renderTabContent will group into panels
        (tabFields[parentTab] ??= []).push(field);
      } else {
        // Standalone panel (not inside any tab)
        (standalonePanelFields[owner.path] ??= []).push(field);
      }
      continue;
    }

    // Fallback: treat as top-level
    directFields.push(field);
  }

  // â”€â”€ Renderers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Normalize gridColumn so the default "6 (50%)" value renders as 4 (33% = 3 cols per row).
  // Explicit narrow choices (3, 4) and explicit wide choices (8, 12) are preserved.
  // gridColumn:6 was the FieldConfigPanel default — treat it as "auto" → use 4.
  const renderField = (field: FieldConfig) => {
    const col = !field.gridColumn || field.gridColumn === 6 ? 4 : field.gridColumn;
    return (
      <BasicField
        key={field.fieldPath}
        field={{ ...field, gridColumn: col }}
        formData={formData}
        onChange={onChange}
        errors={errors}
      />
    );
  };

  const renderFieldGrid = (fields: FieldConfig[]) => (
    <div className="grid grid-cols-12 gap-4">
      {fields.sort((a, b) => a.displayOrder - b.displayOrder).map(renderField)}
    </div>
  );

  const renderRepeater = (arrayPath: string) => {
    const arraySchema = getSchemaAtPath(arrayPath);
    const arrayName = arrayPath.split(".").pop() ?? arrayPath;
    const selectedChildKeys = Array.from(new Set(
      visibleFields
        .filter((field) => field.fieldPath.startsWith(`${arrayPath}.`))
        .map((field) => field.fieldPath.slice(arrayPath.length + 1).split(".")[0])
        .filter(Boolean)
    ));
    const arrayData: any[] = Array.isArray(getNestedValue(formData, arrayPath))
      ? getNestedValue(formData, arrayPath)
      : [];
    if (!arraySchema) {
      return (
        <div key={arrayPath} className="border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-ink">{arrayName}</p>
          <p className="text-[10px] text-ink-muted mt-1">Schema not available.</p>
        </div>
      );
    }
    return (
      <div key={arrayPath} className="border border-border rounded-lg overflow-hidden">
        <ArrayGridView
          fieldName={arrayName}
          fieldSchema={arraySchema}
          fieldPath={arrayPath}
          data={arrayData}
          onChange={(_k, newArr) => onChange(arrayPath, newArr)}
          parentOnChange={onChange}
          resolveRef={resolveRef}
          readOnly={false}
          visibleFieldKeys={selectedChildKeys.length > 0 ? selectedChildKeys : undefined}
        />
      </div>
    );
  };

  /** Render the content of one tab: may contain sub-panels */
  const renderTabContent = (fields: FieldConfig[], tabPath: string) => {
    const subPanels = panelPaths
      .filter((pp) => pp.startsWith(`${tabPath}.`))
      .sort((a, b) => b.length - a.length);

    // Repeaters nested directly inside this tab (set explicitly as repeater/party-cards)
    const tabRepeaters = repeaterPaths.filter(
      (rp) => rp.startsWith(`${tabPath}.`) || rp === tabPath
    );

    const allRepeaters = tabRepeaters;
    const hasContent = fields.length > 0 || subPanels.length > 0 || allRepeaters.length > 0;

    if (!hasContent) {
      return (
        <p className="text-xs text-ink-muted italic p-4">
          No fields configured for this tab yet.
        </p>
      );
    }

    const grouped: Record<string, FieldConfig[]> = {};
    const ungrouped: FieldConfig[] = [];
    for (const f of fields) {
      const panel = subPanels.find((pp) => f.fieldPath.startsWith(`${pp}.`));
      if (panel) (grouped[panel] ??= []).push(f);
      else ungrouped.push(f);
    }

    const hint = (pp: string) => layoutHints[pp];
    return (
      <div className="space-y-4 pt-4">
        {/* Regular fields (ungrouped or no sub-panels) */}
        {ungrouped.length > 0 && renderFieldGrid(ungrouped)}

        {/* Sub-panels inside this tab */}
        {subPanels.map((pp) => {
          const pFields = grouped[pp] ?? [];
          if (pFields.length === 0) return null;
          return (
            <details key={pp} open className="border border-border rounded-lg">
              <summary className={`px-4 py-2.5 cursor-pointer text-sm font-semibold text-ink hover:bg-surface ${hint(pp) === "card" ? "bg-amber-50" : "bg-surface-muted"}`}>
                {pp.split(".").pop()}
              </summary>
              <div className="p-4">{renderFieldGrid(pFields)}</div>
            </details>
          );
        })}

        {/* Nested repeaters (explicit hints + auto-detected schema arrays) */}
        {allRepeaters.map(renderRepeater)}
      </div>
    );
  };

  /** Render one complete tabsheet section */
  const renderTabsheet = (tabsheetPath: string) => {
    const label = tabsheetPath.split(".").pop() ?? tabsheetPath;
    const headerFields = tabsheetHeaderFields[tabsheetPath] ?? [];
    const myTabPaths = tabPaths
      .filter((tp) => tp.startsWith(`${tabsheetPath}.`))
      .sort();
    const activeTab = activeTabs[tabsheetPath] ?? myTabPaths[0] ?? "";

    // Panels inside this tabsheet but NOT inside any tab or repeater
    const nestedPanelPaths = panelPaths.filter(
      (pp) =>
        pp.startsWith(`${tabsheetPath}.`) &&
        !myTabPaths.some((tp) => pp.startsWith(`${tp}.`)) &&
        !repeaterPaths.some((rp) => pp.startsWith(`${rp}.`) || pp.startsWith(`${rp}[].`))
    );

    // Repeaters inside this tabsheet but NOT inside any tab
    const nestedRepeaters = repeaterPaths.filter(
      (rp) =>
        rp.startsWith(`${tabsheetPath}.`) &&
        !myTabPaths.some((tp) => rp.startsWith(`${tp}.`) || rp === tp)
    );

    // Repeaters inside this tabsheet render only when explicitly configured.
    const allNestedRepeaters = nestedRepeaters;
    const renderNestedPanel = (pp: string) => {
      const pFields = standalonePanelFields[pp] ?? [];
      if (pFields.length === 0) return null;
      const hint = layoutHints[pp];
      return (
        <details key={pp} open className="border-b border-border last:border-b-0">
          <summary
            className={`px-5 py-3 cursor-pointer font-semibold text-sm text-ink hover:bg-surface ${
              hint === "card" ? "bg-amber-50" : "bg-surface-muted"
            }`}
          >
            ▾ {pp.split(".").pop()}
          </summary>
          <div className="px-5 py-4">{renderFieldGrid(pFields)}</div>
        </details>
      );
    };

    const isEmpty =
      myTabPaths.length === 0 &&
      headerFields.length === 0 &&
      nestedPanelPaths.length === 0 &&
      allNestedRepeaters.length === 0;

    return (
      <div key={tabsheetPath} className="border border-border rounded-xl overflow-hidden bg-white">
        {/* TabSheet header label */}
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">{label}</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 border border-purple-200 rounded font-medium">tabsheet</span>
        </div>

        {/* Header fields (direct leaf children of the tabsheet, not inside any tab/panel) */}
        {headerFields.length > 0 && (
          <div className="px-5 py-4 border-b border-border bg-gray-50/50">
            {renderFieldGrid(headerFields)}
          </div>
        )}

        {/* Panels that belong to this tabsheet level (outside any tab) */}
        {nestedPanelPaths.map(renderNestedPanel)}

        {/* Tab strip + active tab content */}
        {myTabPaths.length > 0 && (
          <>
            <div className="flex gap-0 border-b border-border bg-white px-2 pt-2">
              {myTabPaths.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setActiveTabs((prev) => ({ ...prev, [tabsheetPath]: tp }))}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg mr-1 border-t border-l border-r transition-colors ${
                    activeTab === tp
                      ? "border-border bg-white text-brand border-b-white -mb-px z-10 relative"
                      : "border-transparent text-ink-muted hover:text-ink hover:bg-surface-muted"
                  }`}
                >
                  {tp.split(".").pop()}
                </button>
              ))}
            </div>
            <div className="px-5 pb-5">
              {renderTabContent(tabFields[activeTab] ?? [], activeTab)}
            </div>
          </>
        )}


        {allNestedRepeaters.length > 0 && (
          <div className='px-5 pb-5 space-y-3'>
            {allNestedRepeaters.map(renderRepeater)}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-ink-muted">
              No fields or tabs configured yet. Select child nodes in the tree and set them as <strong>Tab</strong> or configure their fields as visible.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Top-level standalone panels (not inside any tabsheet) ─────────────────
  const topLevelPanelPaths = panelPaths.filter(
    (pp) =>
      !tabsheetPaths.some((tsp) => pp.startsWith(`${tsp}.`)) &&
      !tabPaths.some((tp) => pp.startsWith(`${tp}.`)) &&
      !repeaterPaths.some((rp) => pp.startsWith(`${rp}.`) || pp.startsWith(`${rp}[].`))
  );

  // â”€â”€ Top-level repeaters (not inside any tabsheet) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const topLevelRepeaters = repeaterPaths.filter(
    (rp) => !tabsheetPaths.some((tsp) => rp.startsWith(`${tsp}.`))
  );

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-6 space-y-5">
      {/* 1. Top-level direct fields â†’ Declaration */}
      {directFields.length > 0 && (
        <details open className="border border-border rounded-xl bg-white">
          <summary className="px-5 py-3 bg-surface-muted cursor-pointer font-semibold text-sm text-ink rounded-t-xl hover:bg-surface">
            â–¾ Declaration
          </summary>
          <div className="px-5 py-4">
            {renderFieldGrid(directFields)}
          </div>
        </details>
      )}

      {/* 2. Top-level standalone panels/cards */}
      {topLevelPanelPaths.map((pp) => {
        const pFields = standalonePanelFields[pp] ?? [];
        if (pFields.length === 0) return null;
        const hint = layoutHints[pp];
        return (
          <details key={pp} open className="border border-border rounded-xl bg-white">
            <summary className={`px-5 py-3 cursor-pointer font-semibold text-sm text-ink rounded-t-xl hover:bg-surface ${hint === "card" ? "bg-amber-50" : "bg-surface-muted"}`}>
              â–¾ {pp.split(".").pop()}
            </summary>
            <div className="px-5 py-4">{renderFieldGrid(pFields)}</div>
          </details>
        );
      })}

      {/* 3. TabSheets â€” each renders as a complete bordered section */}
      {tabsheetPaths.map(renderTabsheet)}

      {/* 4. Top-level repeaters */}
      {topLevelRepeaters.map(renderRepeater)}
    </div>
  );
}

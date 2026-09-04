/**
 * JSON Schema Tree Viewer Component
 *
 * Displays canonical JSON schema as an interactive tree structure.
 * Features:
 *  - Search/filter box (by name, type, required-only, configured-only)
 *  - Per-node configuration status indicator (none / partial / full)
 *  - Expand All / Collapse All
 *  - Auto-expands matching nodes when searching
 */

"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, List, Search, X } from "lucide-react";
import type { FilingUIConfigData } from "@/types/ui-config.types";
import { schemaToDefaultWidget, isWidgetCustomized } from "@/lib/ui-config/schema-widget-mapper";

// Layout hint badge colors — matches the advisor's accent classes
const LAYOUT_BADGE: Record<string, { label: string; cls: string }> = {
  panel:         { label: "panel",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  tabsheet:      { label: "tabsheet",    cls: "bg-purple-100 text-purple-700 border-purple-200" },
  tab:           { label: "tab",         cls: "bg-green-100 text-green-700 border-green-200" },
  card:          { label: "card",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
  repeater:      { label: "repeater",    cls: "bg-teal-100 text-teal-700 border-teal-200" },
  "party-cards": { label: "party-cards", cls: "bg-pink-100 text-pink-700 border-pink-200" },
};

interface SchemaProperty {
  type: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  description?: string;
  $ref?: string;
}

interface SchemaTreeNode {
  path: string;
  name: string;
  type: string;
  isRequired: boolean;
  isArray: boolean;
  description?: string;
  children?: SchemaTreeNode[];
  schema: SchemaProperty;
}

type FilterMode = "all" | "required" | "configured" | "unconfigured";
type ConfigStatus = "none" | "partial" | "full";

interface SchemaTreeViewerProps {
  schema: any;
  selectedPath: string | null;
  onSelectPath: (path: string, schema: SchemaProperty) => void;
  /** Pass the current FilingUIConfigData to show per-node configuration status. */
  configData?: FilingUIConfigData | null;
}

// ---------------------------------------------------------------------------
// Pure tree builder — extracted outside component so it is not re-created
// on every render. Only depends on the schema object.
// ---------------------------------------------------------------------------
function buildTree(
  schemaObj: any,
  rootDefs: Record<string, any>,
  path: string = "",
): SchemaTreeNode[] {
  const nodes: SchemaTreeNode[] = [];

  // Detect and unwrap root transaction type wrappers (ImportDeclaration/ExportDeclaration)
  if (path === "" && schemaObj.properties) {
    const rootKeys = Object.keys(schemaObj.properties);
    if (
      rootKeys.length === 1 &&
      (rootKeys[0] === "ImportDeclaration" || rootKeys[0] === "ExportDeclaration")
    ) {
      const wrapper = schemaObj.properties[rootKeys[0]];
      if (wrapper.properties) {
        return buildTree(wrapper, rootDefs, "");
      }
    }
  }

  const resolveRef = (ref: string): SchemaProperty | null => {
    if (ref.startsWith("#/$defs/") || ref.startsWith("#/definitions/")) {
      const defName = ref.replace("#/$defs/", "").replace("#/definitions/", "");
      return rootDefs[defName] || null;
    }
    return null;
  };

  if (schemaObj.properties) {
    const required = schemaObj.required || [];

    Object.entries(schemaObj.properties).forEach(([propName, propSchema]: [string, any]) => {
      const fieldPath = path ? `${path}.${propName}` : propName;
      let resolvedSchema = propSchema;

      if (propSchema.$ref) {
        const refSchema = resolveRef(propSchema.$ref);
        if (refSchema) resolvedSchema = refSchema;
      }

      const node: SchemaTreeNode = {
        path: fieldPath,
        name: propName,
        // JSON Schema allows type to be an array e.g. ["string","null"] — normalize to first value
        type: Array.isArray(resolvedSchema.type)
          ? (resolvedSchema.type[0] ?? "object")
          : (resolvedSchema.type || "object"),
        isRequired: required.includes(propName),
        isArray: resolvedSchema.type === "array",
        description: resolvedSchema.description,
        schema: resolvedSchema,
      };

      if (resolvedSchema.type === "object" && resolvedSchema.properties) {
        node.children = buildTree(resolvedSchema, rootDefs, fieldPath);
      }

      if (resolvedSchema.type === "array" && resolvedSchema.items) {
        let resolvedItems = resolvedSchema.items;
        if (resolvedItems.$ref) {
          const refSchema = resolveRef(resolvedItems.$ref);
          if (refSchema) resolvedItems = refSchema;
        }
        if (resolvedItems.type === "object" && resolvedItems.properties) {
          node.children = buildTree(resolvedItems, rootDefs, `${fieldPath}[]`);
        }
      }

      nodes.push(node);
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Config status helpers
// ---------------------------------------------------------------------------
function computeConfigStatusMap(configData: FilingUIConfigData | null | undefined): Map<string, ConfigStatus> {
  const map = new Map<string, ConfigStatus>();
  if (!configData) return map;

  // Leaf fields: full if label + type present, partial if only path present
  configData.fields?.forEach((field) => {
    map.set(field.fieldPath, field.fieldLabel && field.fieldType ? "full" : "partial");
  });

  // Complex objects: full if layoutHints entry exists
  if (configData.layoutHints) {
    Object.keys(configData.layoutHints).forEach((p) => {
      if (!map.has(p)) map.set(p, "full");
    });
  }

  return map;
}

function computeComplexStatus(node: SchemaTreeNode, map: Map<string, ConfigStatus>): ConfigStatus {
  if (!node.children?.length) return map.get(node.path) ?? "none";
  const own = map.get(node.path);
  const childStatuses = node.children.map((c) => computeComplexStatus(c, map));
  const configuredCount = childStatuses.filter((s) => s !== "none").length;
  if (configuredCount === 0 && !own) return "none";
  if (own === "full" && configuredCount === childStatuses.length) return "full";
  return "partial";
}

// ---------------------------------------------------------------------------
// Status dot component
// ---------------------------------------------------------------------------
function ConfigDot({ status }: { status: ConfigStatus }) {
  if (status === "none") return null;
  return (
    <span
      title={status === "full" ? "Fully configured" : "Partially configured"}
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
        status === "full" ? "bg-green-500" : "bg-amber-400"
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SchemaTreeViewer({
  schema,
  selectedPath,
  onSelectPath,
  configData,
}: SchemaTreeViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const rootDefs = useMemo(
    () => schema.$defs || schema.definitions || {},
    [schema]
  );

  const tree = useMemo(() => buildTree(schema, rootDefs), [schema, rootDefs]);

  const configStatusMap = useMemo(() => computeConfigStatusMap(configData), [configData]);

  // Collect every node path that satisfies the active search + filter
  const matchingPaths = useMemo((): Set<string> | null => {
    const hasSearch = searchTerm.trim().length > 0;
    const hasFilter = filterMode !== "all";
    if (!hasSearch && !hasFilter) return null; // null = show everything

    const matches = new Set<string>();
    const term = searchTerm.toLowerCase();

    const collect = (nodes: SchemaTreeNode[]) => {
      nodes.forEach((node) => {
        let pass = true;

        if (hasSearch) {
          pass =
            node.name.toLowerCase().includes(term) ||
            node.path.toLowerCase().includes(term) ||
            String(node.type ?? "").toLowerCase().includes(term);
        }

        if (pass && filterMode === "required") pass = node.isRequired;
        if (pass && filterMode === "configured") pass = configStatusMap.has(node.path);
        if (pass && filterMode === "unconfigured") pass = !configStatusMap.has(node.path);

        if (pass) matches.add(node.path);
        if (node.children) collect(node.children);
      });
    };
    collect(tree);
    return matches;
  }, [tree, searchTerm, filterMode, configStatusMap]);

  // When filtering, also expand all ancestors of matching nodes so results are visible
  const effectiveExpanded = useMemo((): Set<string> => {
    if (!matchingPaths) return expandedPaths;

    const extra = new Set(expandedPaths);
    const expandAncestors = (nodes: SchemaTreeNode[], ancestors: string[]) => {
      nodes.forEach((node) => {
        const isMatch = matchingPaths.has(node.path);
        const childHasMatch = node.children?.some((c) =>
          matchingPaths.has(c.path)
        );
        if (isMatch || childHasMatch) {
          ancestors.forEach((a) => extra.add(a));
        }
        if (node.children) {
          expandAncestors(node.children, [...ancestors, node.path]);
        }
      });
    };
    expandAncestors(tree, []);
    return extra;
  }, [matchingPaths, tree, expandedPaths]);

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Node renderer
  // -------------------------------------------------------------------------
  const renderNode = (node: SchemaTreeNode, level: number = 0): React.ReactNode => {
    // Hide when filter is active and this node doesn't match
    if (matchingPaths && !matchingPaths.has(node.path)) {
      // Still render children that might match
      if (!node.children?.some((c) => matchingPaths.has(c.path))) return null;
    }

    const isExpanded = effectiveExpanded.has(node.path);
    const hasChildren = !!node.children?.length;
    const isSelected = selectedPath === node.path;
    const status = hasChildren
      ? computeComplexStatus(node, configStatusMap)
      : (configStatusMap.get(node.path) ?? "none");

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-3 py-2 transition-colors cursor-pointer hover:bg-surface-hover ${
            isSelected ? "bg-blue-50 border-l-4 border-brand" : ""
          }`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => {
            if (hasChildren) toggleExpanded(node.path);
            onSelectPath(node.path, node.schema);
          }}
        >
          {/* Expand/Collapse icon */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpanded(node.path); }}
              className="w-4 h-4 flex items-center justify-center text-ink-muted hover:text-ink"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Type icon */}
          {node.isArray ? (
            <List className="w-4 h-4 text-purple-600 flex-shrink-0" />
          ) : hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            )
          ) : (
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}

          {/* Field name */}
          <span
            className={`text-xs font-mono truncate ${
              isSelected ? "font-bold text-brand" : "text-ink"
            }`}
          >
            {node.name}
          </span>

          {/* Config status dot */}
          <ConfigDot status={status} />

          {/* Customized-widget badge: leaf fields whose chosen widget ≠ schema default */}
          {!hasChildren && (() => {
            const configuredField = configData?.fields?.find((f) => f.fieldPath === node.path);
            if (!configuredField?.fieldType) return null;
            const fieldName = node.name;
            if (!isWidgetCustomized(configuredField.fieldType, node.schema, fieldName)) return null;
            const { widget: def } = schemaToDefaultWidget(node.schema, fieldName);
            return (
              <span
                title={`Widget customized from schema default "${def}"`}
                className="text-[9px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded font-semibold flex-shrink-0"
              >
                ⚡
              </span>
            );
          })()}

          {/* Badges */}
          {hasChildren && (
            (() => {
              const appliedLayout = configData?.layoutHints?.[node.path];
              const badge = appliedLayout ? LAYOUT_BADGE[appliedLayout] : null;
              return badge ? (
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium flex-shrink-0">
                  COMPLEX
                </span>
              );
            })()
          )}
          {node.isRequired && (
            <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold flex-shrink-0">
              REQ
            </span>
          )}
          <span className="text-[9px] px-1.5 py-0.5 bg-surface-muted text-ink-muted rounded font-mono flex-shrink-0 ml-auto">
            {node.type}
          </span>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Totals for the legend line
  const totalNodes = useMemo(() => {
    let n = 0;
    const count = (nodes: SchemaTreeNode[]) => nodes.forEach((node) => { n++; if (node.children) count(node.children); });
    count(tree);
    return n;
  }, [tree]);

  const matchCount = matchingPaths?.size ?? totalNodes;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const FILTER_CHIPS: { id: FilterMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "required", label: "Required" },
    { id: "configured", label: "Configured" },
    { id: "unconfigured", label: "Unconfigured" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden border-r border-border bg-white">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 bg-surface-muted border-b border-border px-4 py-3 z-10 space-y-2">
        {/* Title row */}
        <div>
          <div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Schema Structure</h3>
            <p className="text-[10px] text-ink-muted mt-0.5">
              📁 Complex → layout &nbsp;|&nbsp; 📄 Field → configure
            </p>
          </div>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, type, or path…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterMode(chip.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                filterMode === chip.id
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink-muted border-border hover:border-brand hover:text-brand"
              }`}
            >
              {chip.label}
            </button>
          ))}
          {/* Result count */}
          {matchingPaths && (
            <span className="text-[10px] text-ink-muted ml-auto self-center">
              {matchCount} / {totalNodes} shown
            </span>
          )}
        </div>

        {/* Status legend */}
        <div className="flex items-center gap-3 text-[10px] text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Configured
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Partial
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-200 border border-gray-300" /> None
          </span>
          <span className="flex items-center gap-1 ml-1">
            ⚡ Widget customized from schema default
          </span>
        </div>
      </div>

      {/* ── Tree ── */}
      <div className="flex-1 overflow-y-auto py-2">
        {matchingPaths?.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-ink-muted">No fields match your search.</p>
            <button
              onClick={() => { setSearchTerm(""); setFilterMode("all"); }}
              className="mt-2 text-[10px] text-brand underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}

interface SchemaProperty {
  type: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  description?: string;
  $ref?: string;
}
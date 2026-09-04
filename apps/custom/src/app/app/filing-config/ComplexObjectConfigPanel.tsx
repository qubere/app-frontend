/**
 * Complex Object Configuration Panel
 *
 * Shows layout type options for complex objects / arrays.
 * Uses the SchemaLayoutAdvisor to auto-recommend the best layout.
 * Each option has a visual thumbnail so users can see how their form will look.
 */

"use client";

import React from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { adviseLayout, LAYOUT_META, type LayoutType } from "@/lib/ui-config/schema-layout-advisor";

interface ComplexObjectConfigPanelProps {
  fieldPath: string;
  fieldSchema: any;
  /** Pass null to clear/remove the layout hint */
  onSave: (layoutType: LayoutType | null) => void;
  onCancel: () => void;
  layoutHints?: Record<string, string>;
  /** Root schema $defs for $ref resolution */
  rootDefs?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini visual thumbnails — pure CSS, no images
// ─────────────────────────────────────────────────────────────────────────────

function PanelThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 border border-gray-200 rounded overflow-hidden">
      <div className="bg-blue-100 border-b border-blue-200 px-2 py-1 flex items-center gap-1">
        <span className="text-[8px] text-blue-700 font-semibold">▼ Section Title</span>
      </div>
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded h-3" />
        ))}
      </div>
    </div>
  );
}

function TabSheetThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 border border-gray-200 rounded overflow-hidden">
      <div className="flex border-b border-gray-200">
        {["Tab A","Tab B","Tab C"].map((t, i) => (
          <div key={t} className={`px-2 py-1 text-[7px] font-semibold border-r border-gray-200 ${i === 0 ? "bg-white text-blue-600 border-b-2 border-b-blue-500" : "bg-gray-100 text-gray-400"}`}>{t}</div>
        ))}
      </div>
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded h-3" />
        ))}
      </div>
    </div>
  );
}

function TabThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 border border-gray-200 rounded overflow-hidden">
      <div className="flex border-b border-gray-200">
        <div className="px-2 py-1 text-[7px] text-gray-400 bg-gray-100 border-r border-gray-200">Other</div>
        <div className="px-2 py-1 text-[7px] font-semibold text-green-700 bg-white border-b-2 border-b-green-500">This Node</div>
        <div className="px-2 py-1 text-[7px] text-gray-400 bg-gray-100 border-l border-gray-200">Other</div>
      </div>
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {[1,2].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded h-3" />
        ))}
      </div>
    </div>
  );
}

function CardThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-2 w-4/5">
        <div className="text-[7px] font-bold text-gray-600 mb-1.5">Entity Name</div>
        <div className="grid grid-cols-2 gap-1">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-gray-100 rounded h-2" />
          ))}
        </div>
      </div>
    </div>
  );
}

function RepeaterThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 border border-gray-200 rounded overflow-hidden">
      <div className="bg-teal-50 border-b border-teal-200 px-2 py-1 flex items-center justify-between">
        <span className="text-[7px] font-bold text-teal-700">GoodsShipment</span>
        <span className="text-[7px] text-white bg-teal-500 rounded px-1">+ Add</span>
      </div>
      <table className="w-full">
        <thead><tr className="bg-gray-100">
          {["#","Ref","Status"].map(h => <th key={h} className="text-[6px] px-1 py-0.5 text-left text-gray-400">{h}</th>)}
        </tr></thead>
        <tbody>
          {[["1","SHP-001","Active"],["2","SHP-002","Pending"]].map(([n,r,s]) => (
            <tr key={n} className="border-t border-gray-100">
              <td className="text-[6px] px-1 text-gray-400">{n}</td>
              <td className="text-[6px] px-1 text-gray-600">{r}</td>
              <td className="text-[6px] px-1 text-gray-600">{s}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartyCardsThumbnail() {
  return (
    <div className="w-full h-16 bg-gray-50 rounded overflow-hidden flex items-center gap-1 px-1">
      {["Consignor","Consignee","Seller"].map((party) => (
        <div key={party} className="flex-1 bg-white border border-pink-200 rounded p-1 h-12">
          <div className="text-[6px] font-bold text-pink-700 mb-1">{party}</div>
          <div className="bg-gray-100 rounded h-1.5 mb-1 w-3/4" />
          <div className="bg-gray-100 rounded h-1.5 w-1/2" />
          <div className="text-[5px] text-blue-500 mt-1">Edit →</div>
        </div>
      ))}
    </div>
  );
}

const THUMBNAILS: Record<LayoutType, React.FC> = {
  panel: PanelThumbnail,
  tabsheet: TabSheetThumbnail,
  tab: TabThumbnail,
  card: CardThumbnail,
  repeater: RepeaterThumbnail,
  "party-cards": PartyCardsThumbnail,
};

const LAYOUT_COLORS: Record<LayoutType, string> = {
  panel:         "bg-blue-100 text-blue-700 border-blue-300",
  tabsheet:      "bg-purple-100 text-purple-700 border-purple-300",
  tab:           "bg-green-100 text-green-700 border-green-300",
  card:          "bg-amber-100 text-amber-700 border-amber-300",
  repeater:      "bg-teal-100 text-teal-700 border-teal-300",
  "party-cards": "bg-pink-100 text-pink-700 border-pink-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout option card
// ─────────────────────────────────────────────────────────────────────────────

function LayoutOption({
  type,
  isSelected,
  isRecommended,
  onSelect,
}: {
  type: LayoutType;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const meta = LAYOUT_META[type];
  const Thumbnail = THUMBNAILS[type];

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 overflow-hidden transition-all ${
        isSelected
          ? "border-brand shadow-md"
          : isRecommended
          ? "border-brand/40 bg-brand/5 hover:border-brand"
          : "border-border bg-white hover:border-brand/50"
      }`}
    >
      {/* Header strip */}
      <div className={`flex items-center justify-between px-3 py-2 ${isSelected ? "bg-brand text-white" : isRecommended ? "bg-brand/10" : "bg-surface-muted"}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-ink"}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isRecommended && (
            <span className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${isSelected ? "bg-white/20 text-white border-white/30" : "bg-brand/10 text-brand border-brand/30"}`}>
              <Sparkles className="w-2.5 h-2.5" /> Recommended
            </span>
          )}
          {isSelected && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold">✓ Selected · click to remove</span>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="px-3 pt-2 pb-1">
        <Thumbnail />
      </div>

      {/* Description */}
      <div className="px-3 pb-3">
        <p className="text-[10px] text-ink-muted mt-1">{meta.description}</p>
        <p className="text-[10px] text-green-700 mt-1 font-medium">💡 Best for: {meta.bestFor}</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ComplexObjectConfigPanel({
  fieldPath,
  fieldSchema,
  onSave,
  onCancel,
  layoutHints = {},
  rootDefs = {},
}: ComplexObjectConfigPanelProps) {
  const [selectedLayout, setSelectedLayout] = React.useState<LayoutType | null>(
    (layoutHints[fieldPath] as LayoutType) ?? null
  );

  const fieldName = fieldPath.split(".").pop() ?? fieldPath;
  const isArray = fieldSchema?.type === "array" || !!fieldSchema?.items;

  const advice = React.useMemo(
    () => adviseLayout(fieldSchema, fieldName, rootDefs),
    [fieldSchema, fieldName, rootDefs]
  );

  const handleSelect = (type: LayoutType) => {
    if (selectedLayout === type) {
      // Toggle off — clicking the active layout clears it
      setSelectedLayout(null);
      onSave(null);
    } else {
      setSelectedLayout(type);
      onSave(type);
    }
  };

  const handleClear = () => {
    setSelectedLayout(null);
    onSave(null);
  };

  // Build breadcrumb from path ancestors
  const segments = fieldPath.split(".");
  const breadcrumb = segments.map((_, i) => {
    const path = segments.slice(0, i + 1).join(".");
    return { label: segments[i], path, layout: layoutHints[path] as LayoutType | undefined };
  });

  // Layout groups: primary (schema-appropriate) then secondary
  const primaryTypes: LayoutType[] = isArray
    ? ["repeater", "party-cards"]
    : ["panel", "tabsheet", "tab", "card"];
  const secondaryTypes: LayoutType[] = isArray
    ? ["panel", "tabsheet", "tab", "card"]
    : ["repeater", "party-cards"];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-border bg-surface-muted px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">Layout Configuration</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {isArray ? "Array field — choose how users add / edit items" : "Complex object — choose how this section renders"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedLayout && (
              <button
                onClick={handleClear}
                title="Remove layout — resets this node to no configured layout"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
              >
                <X className="w-3 h-3" /> Remove layout
              </button>
            )}
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-hover">
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Hierarchy breadcrumb */}
        {breadcrumb.length > 1 && (
          <div className="bg-gray-50 border border-border rounded-lg px-3 py-2">
            <p className="text-[9px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Layout Hierarchy</p>
            <div className="flex items-center flex-wrap gap-1">
              {breadcrumb.map((crumb, i) => (
                <React.Fragment key={crumb.path}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-ink-muted flex-shrink-0" />}
                  <span className="flex items-center gap-1">
                    <span className={`text-xs font-mono ${i === breadcrumb.length - 1 ? "font-bold text-ink" : "text-ink-muted"}`}>
                      {crumb.label}
                    </span>
                    {crumb.layout && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${LAYOUT_COLORS[crumb.layout] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {crumb.layout}
                      </span>
                    )}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Smart recommendation banner */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${isArray ? "bg-teal-50 border-teal-200" : "bg-blue-50 border-blue-200"}`}>
          <span className="text-xl mt-0.5">{isArray ? "🗂️" : "📁"}</span>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-ink">{fieldName}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                isArray ? "bg-teal-100 text-teal-700 border-teal-300" : "bg-blue-100 text-blue-700 border-blue-300"
              }`}>
                {isArray ? "array" : "object"} · {fieldSchema?.type ?? "complex"}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-brand flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-ink-muted">{advice.reason}</p>
            </div>
          </div>
        </div>

        {/* Primary layout options */}
        <div>
          <p className="text-[10px] font-semibold text-ink uppercase tracking-wider mb-3">
            {isArray ? "Array Layout Options" : "Layout Options"}
          </p>
          <div className="grid grid-cols-1 gap-3">
            {primaryTypes.map((type) => (
              <LayoutOption
                key={type}
                type={type}
                isSelected={selectedLayout === type}
                isRecommended={advice.recommended === type}
                onSelect={() => handleSelect(type)}
              />
            ))}
          </div>
        </div>

        {/* Secondary options (for arrays: object layouts; for objects: array layouts) */}
        <details className="group">
          <summary className="text-[10px] text-ink-muted cursor-pointer hover:text-ink select-none list-none flex items-center gap-1">
            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
            {isArray ? "Alternative: object-style layouts (for small fixed arrays)" : "Alternative: array layouts (for repeatable objects)"}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 pl-4">
            {secondaryTypes.map((type) => (
              <LayoutOption
                key={type}
                type={type}
                isSelected={selectedLayout === type}
                isRecommended={false}
                onSelect={() => handleSelect(type)}
              />
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
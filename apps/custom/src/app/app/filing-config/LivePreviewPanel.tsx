/**
 * Live Preview Panel
 *
 * Renders the current draft UI configuration using the same LayoutRenderer
 * that drives production filing forms. What you see here is exactly what
 * the CustomsFiling Declaration tab will show — zero drift guaranteed.
 *
 * Hard constraint respected: LayoutRenderer is imported read-only.
 * This component NEVER modifies the renderer; it only passes props to it.
 *
 * Features:
 *  - Reflects changes in real time as the user configures fields
 *  - "Load sample data" generates representative values from the JSON Schema
 *  - "Clear data" resets the preview form to empty
 *  - Falls back to DefaultSchemaRenderer when no fields are configured yet
 */

"use client";

import React, { useState, useCallback } from "react";
import { Eye, RefreshCw, Trash2, Database, AlertCircle, Info } from "lucide-react";
import LayoutRenderer from "@/components/form/layouts/LayoutRenderer";
import DefaultSchemaRenderer from "@/app/app/filing/[id]/DefaultSchemaRenderer";
import type { FilingUIConfigData } from "@/types/ui-config.types";
import {
  generateSampleDataFromConfig,
  generateSampleDataFromSchema,
} from "@/lib/ui-config/sample-data-generator";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface LivePreviewPanelProps {
  /** Current draft configuration — updated live as the user edits */
  config: FilingUIConfigData | null;
  /** JSON Schema for the combination being configured */
  schema: any;
  /** Combination identifier shown in the preview header */
  target: {
    country: string;
    procedureCode: string;
    messageName: string;
    messageType: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LivePreviewPanel({ config, schema, target }: LivePreviewPanelProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [sampleLoaded, setSampleLoaded] = useState(false);

  const hasConfiguredFields = Boolean(config?.fields && config.fields.length > 0);

  // Handler for field changes inside the preview (read-only to the config,
  // but the preview form is interactive so the user can test conditional logic)
  const handleChange = useCallback((fieldPath: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev };
      const parts = fieldPath.split(".");
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
        cur = cur[key];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }, []);

  const loadSampleData = useCallback(() => {
    if (!schema) return;
    let data: Record<string, any>;
    if (hasConfiguredFields && config) {
      data = generateSampleDataFromConfig(config.fields, schema);
    } else {
      data = generateSampleDataFromSchema(schema, { maxDepth: 3, arrayItemCount: 2 });
    }
    setFormData(data);
    setSampleLoaded(true);
  }, [config, schema, hasConfiguredFields]);

  const clearData = useCallback(() => {
    setFormData({});
    setSampleLoaded(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-white border-l border-border">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-muted border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand" />
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Live Preview</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadSampleData}
              disabled={!schema}
              title="Load representative sample data"
              className="flex items-center gap-1 text-[10px] px-2 py-1 bg-white border border-border rounded hover:bg-surface-hover transition-colors disabled:opacity-40"
            >
              <Database className="w-3 h-3" />
              {sampleLoaded ? "Reload sample" : "Load sample data"}
            </button>
            {sampleLoaded && (
              <button
                onClick={clearData}
                title="Clear preview data"
                className="flex items-center gap-1 text-[10px] px-2 py-1 bg-white border border-border rounded hover:bg-surface-hover transition-colors text-red-600 hover:border-red-300"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Combination info */}
        <div className="flex items-center gap-2 text-[10px] text-ink-muted flex-wrap">
          <span className="font-mono font-semibold">{target.country}</span>
          <span>·</span>
          <span className="font-mono">{target.procedureCode}</span>
          <span>·</span>
          <span className="font-mono">{target.messageName}</span>
          <span>·</span>
          <span className="font-mono">{target.messageType}</span>
        </div>

        {/* Production-fidelity notice */}
        <div className="mt-2 flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
          <Info className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-700">
            Rendered by the <strong>production LayoutRenderer</strong> — identical to what CustomsFiling will show.
          </p>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto">
        {!config ? (
          <EmptyState reason="No configuration loaded yet." />
        ) : !hasConfiguredFields && !config.layoutHints ? (
          // No fields configured — show DefaultSchemaRenderer as the fallback
          schema ? (
            <div>
              <div className="px-4 pt-3 pb-1">
                <FallbackBanner />
              </div>
              <DefaultSchemaRenderer
                schema={schema}
                data={formData}
                onChange={handleChange}
                readOnly={false}
              />
            </div>
          ) : (
            <EmptyState reason="Schema not loaded. Cannot render default form." />
          )
        ) : (
          // Config has fields or layoutHints — use LayoutRenderer (production path)
          <LayoutRenderer
            config={config}
            formData={formData}
            onChange={handleChange}
            schema={schema}
          />
        )}
      </div>

      {/* Footer — sample data status */}
      {sampleLoaded && (
        <div className="px-4 py-2 border-t border-border bg-green-50 text-[10px] text-green-700 flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" />
          Sample data loaded — edit fields above to test conditional logic
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper components
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <Eye className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-xs font-semibold text-ink-muted">Nothing to preview yet</p>
      <p className="text-[10px] text-ink-muted mt-1">{reason}</p>
      <p className="text-[10px] text-ink-muted mt-3">
        Configure fields in the left panels, then check the preview here.
      </p>
    </div>
  );
}

function FallbackBanner() {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-[10px] text-amber-800">
        <strong>Default renderer</strong> — no fields configured yet. This is what CustomsFiling shows when no custom configuration is active.
      </p>
    </div>
  );
}

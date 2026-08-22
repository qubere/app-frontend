/**
 * Dynamic Form Renderer Component
 *
 * Renders the declaration form for a filing. Three rendering paths:
 *
 *  1. NEW UI CONFIG FORMAT (FilingUIConfigData with layout/fields/layoutHints)
 *     → Uses LayoutRenderer (same production path as CustomsFiling module)
 *
 *  2. LEGACY UI CONFIG FORMAT (sections dict with UIFieldConfig arrays)
 *     → Uses the legacy field-by-field rendering (backwards compat)
 *
 *  3. DEFAULT (no active UI config found, or 404)
 *     → Uses EnhancedSchemaRenderer (auto-generated from JSON Schema)
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import LineItemsManager from "./LineItemsManager";
import EnhancedSchemaRenderer from "./EnhancedSchemaRenderer";
import LayoutRenderer from "@/components/form/layouts/LayoutRenderer";
import type { FilingUIConfigData } from "@/types/ui-config.types";

interface UIFieldConfig {
  id: string;
  fieldPath: string;
  fieldLabel: string;
  fieldType: string;
  displayOrder: number;
  gridColumn: number;
  isVisible?: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  masterDataSource?: string | null;
  isMultiSelect: boolean;
  isArrayField: boolean;
  validationRules?: unknown;
}

interface UIConfigSection {
  [sectionName: string]: UIFieldConfig[];
}

interface DynamicFormRendererProps {
  country: string;
  procedureCode: string;
  messageName: string;
  messageType: "request" | "response";
  /** Release version from FilingCountryCustomsVersion (e.g. "1.0"). Used to select the correct UI config and schema. */
  release?: string;
  data: Record<string, any>;
  onChange: (fieldPath: string, value: any) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

interface MasterDataOption {
  value: string;
  label: string;
}

export default function DynamicFormRenderer({
  country,
  procedureCode,
  messageName,
  messageType,
  release,
  data,
  onChange,
  onSave,
  readOnly = false,
}: DynamicFormRendererProps) {
  // Legacy format (old UIConfigSection dict)
  const [uiConfig, setUiConfig] = useState<UIConfigSection | null>(null);
  // New format (FilingUIConfigData — rendered by LayoutRenderer)
  const [configData, setConfigData] = useState<FilingUIConfigData | null>(null);
  // Schema for the default EnhancedSchemaRenderer fallback
  const [schema, setSchema] = useState<any>(null);

  const [masterDataCache, setMasterDataCache] = useState<Record<string, MasterDataOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useDefaultRenderer, setUseDefaultRenderer] = useState(false);

  // Use release as the schema version — normalize "1.0" → "1.0.0" if needed
  const schemaVersion = release
    ? (release.split(".").length === 2 ? `${release}.0` : release)
    : "1.0.0";

  const loadSchema = useCallback(async () => {
    try {
      const transactionType = procedureCode.toUpperCase().startsWith("H") ? "import" : "export";
      const schemaFileName = transactionType === "import"
        ? "ImportDeclaration.schema.json"
        : "ExportDeclaration.schema.json";
      const response = await fetch(
        `/schemas/customs-filing/filing-schemas/${transactionType}/${schemaVersion}/${schemaFileName}`
      );
      if (response.ok) {
        setSchema(await response.json());
      } else {
        // Fallback to 1.0.0 if release-specific schema not found
        const fallback = await fetch(
          `/schemas/customs-filing/filing-schemas/${transactionType}/1.0.0/${schemaFileName}`
        );
        if (fallback.ok) setSchema(await fallback.json());
        else console.error("Failed to load schema for default renderer");
      }
    } catch (err) {
      console.error("Error loading schema:", err);
    }
  }, [procedureCode, schemaVersion]);

  useEffect(() => {
    async function fetchUIConfig() {
      try {
        setLoading(true);
        setError(null);
        // Build the UI config URL — include release so admin-configured per-release configs are returned
        const params = new URLSearchParams({
          country,
          procedureCode,
          messageName,
          messageType,
        });
        if (release) params.set("release", release);

        const response = await fetch(`/api/filing/ui-config?${params}`);

        if (response.ok) {
          const result = await response.json();

          // ── NEW FORMAT: FilingUIConfigData (layout, fields array, layoutHints) ──
          // Detected by presence of `configVersion` and `fields` as an array
          if (result.configVersion && Array.isArray(result.fields)) {
            // Reconstruct the full FilingUIConfigData from the API response
            const fullConfig: FilingUIConfigData = {
              version: result.configVersion,
              metadata: result.metadata ?? {},
              layout: result.layout ?? { mode: "single-page" },
              layoutHints: result.metadata?.layoutHints ?? result.layoutHints,
              tabs: result.tabs ?? [],
              sections: result.sections ?? [],
              panels: result.panels ?? [],
              fields: result.fields ?? [],
              validation: result.validation,
              conditionalLogic: result.conditionalLogic,
              translations: result.translations,
              theme: result.theme,
              permissions: result.permissions,
            };

            // Carry layoutHints stored inside configData.layoutHints
            // The API strips it — try to restore from configData.metadata or inline
            // The LayoutRenderer needs layoutHints to work correctly
            setConfigData(fullConfig);
            setUiConfig(null);
            setUseDefaultRenderer(false);
            // Also load schema so LayoutRenderer can auto-detect arrays/refs
            await loadSchema();

          // ── LEGACY FORMAT: sections as dict → UIFieldConfig arrays ────────────
          } else {
            const hasConfigs = result.sections && typeof result.sections === "object" && !Array.isArray(result.sections) && Object.keys(result.sections).length > 0;
            if (hasConfigs) {
              const filteredSections: UIConfigSection = {};
              Object.entries(result.sections).forEach(([section, fields]) => {
                const fieldList = Array.isArray(fields) ? (fields as UIFieldConfig[]) : [];
                const visibleFields = fieldList.filter((field) => field.isVisible !== false);
                if (visibleFields.length > 0) filteredSections[section] = visibleFields;
              });
              setUiConfig(filteredSections);
              setConfigData(null);
              setUseDefaultRenderer(false);
            } else {
              setUseDefaultRenderer(true);
              await loadSchema();
            }
          }
        } else if (response.status === 404) {
          setUseDefaultRenderer(true);
          await loadSchema();
        } else {
          throw new Error("Failed to fetch UI configuration");
        }
      } catch (err) {
        console.error("Error fetching UI config:", err);
        setUseDefaultRenderer(true);
        await loadSchema();
      } finally {
        setLoading(false);
      }
    }

    void fetchUIConfig();
  }, [country, procedureCode, messageName, messageType, release, loadSchema]);

  const fetchMasterData = useCallback(async (sourceName: string): Promise<MasterDataOption[]> => {
    if (masterDataCache[sourceName]) return masterDataCache[sourceName];
    try {
      const response = await fetch(`/api/filing/master-data?source=${sourceName}`);
      if (!response.ok) return [];
      const result = await response.json();
      const options = result.options || [];
      setMasterDataCache((prev) => ({ ...prev, [sourceName]: options }));
      return options;
    } catch (err) {
      console.error(`Error fetching master data for ${sourceName}:`, err);
      return [];
    }
  }, [masterDataCache]);

  const getNestedValue = (obj: any, path: string): any => {
    if (path.includes("[]")) {
      const [arrayPath, ...rest] = path.split("[].");
      const arrayData = obj[arrayPath] || [];
      if (rest.length === 0) return arrayData;
      return "";
    }
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  const renderField = (field: UIFieldConfig) => {
    const value = getNestedValue(data, field.fieldPath);
    const isDisabled = readOnly || field.isReadOnly;
    if (field.isArrayField) return null;

    const setValue = (newValue: any) => onChange(field.fieldPath, newValue);
    switch (field.fieldType) {
      case "number":
        return <Input type="number" value={value || 0} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} placeholder={field.placeholder || ""} disabled={isDisabled} className="text-xs" step="0.01" />;
      case "date":
        return <Input type="date" value={value || ""} onChange={(e) => setValue(e.target.value)} disabled={isDisabled} className="text-xs" />;
      case "datetime":
        return <Input type="datetime-local" value={value || ""} onChange={(e) => setValue(e.target.value)} disabled={isDisabled} className="text-xs" />;
      case "checkbox":
        return <input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} disabled={isDisabled} className="w-4 h-4 rounded border-border text-brand focus:ring-brand" />;
      case "textarea":
        return <textarea value={value || ""} onChange={(e) => setValue(e.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand" rows={3} />;
      case "dropdown":
      case "lookup":
        return <DropdownField field={field} value={value} onChange={setValue} disabled={isDisabled} fetchMasterData={fetchMasterData} />;
      default:
        return <Input value={value || ""} onChange={(e) => setValue(e.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} className="text-xs" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="text-sm text-ink-muted">Loading form configuration...</div></div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-800">Error loading form: {error}</p></div>;

  // ── PATH 1: NEW FORMAT — use LayoutRenderer (production path) ───────────────
  if (configData) {
    return (
      <LayoutRenderer
        config={configData}
        formData={data}
        onChange={onChange}
        schema={schema}
      />
    );
  }

  // ── PATH 2: DEFAULT — EnhancedSchemaRenderer (auto-generated from schema) ──
  if (useDefaultRenderer && schema) return <EnhancedSchemaRenderer schema={schema} data={data} onChange={onChange} onSave={onSave} readOnly={readOnly} maxDepth={10} />;

  // ── PATH 3: LEGACY FORMAT — field-by-field rendering ────────────────────────
  if (!uiConfig) return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><p className="text-sm text-yellow-800">No form configuration or schema available for {country} / {procedureCode} / {messageName} ({messageType})</p><p className="text-xs text-yellow-700 mt-2">Please configure fields in the Filing Configuration section.</p></div>;

  const sectionTitles: Record<string, string> = {
    header: "Declaration Header",
    parties: "Parties",
    transport: "Transport Information",
    commercial: "Commercial Details",
    lineItems: "Line Items",
    valuation: "Valuation",
    totals: "Totals & Summary",
    compliance: "Compliance",
    evidence: "Evidence & Documentation",
    assessment: "Assessment Results",
    release: "Release Information",
    errors: "Errors & Warnings",
    notes: "Notes & Remarks",
  };

  return (
    <div className="space-y-6">
      {Object.entries(uiConfig).map(([sectionName, fields]) => (
        <div key={sectionName} className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">{sectionTitles[sectionName] || sectionName}</h4>
          {sectionName === "lineItems" || sectionName === "errors" ? (
            <LineItemsManager
              arrayFields={fields}
              items={data[sectionName.replace("[]", "")] || []}
              onChange={(items) => onChange(sectionName.replace("[]", ""), items)}
              readOnly={readOnly}
              masterDataCache={masterDataCache}
              fetchMasterData={fetchMasterData}
            />
          ) : (
            <div className="grid grid-cols-12 gap-4">
              {fields.map((field) => (
                <div key={field.id} style={{ gridColumn: `span ${field.gridColumn} / span ${field.gridColumn}` }}>
                  <label className="text-xs text-ink-muted">{field.fieldLabel}{field.isRequired && <span className="text-red-600 ml-1">*</span>}</label>
                  {renderField(field)}
                  {field.helpText && <p className="text-[10px] text-ink-muted mt-1">{field.helpText}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {onSave && !readOnly && <div className="flex justify-end pt-4 border-t border-border"><Button onClick={onSave} size="sm">Save Draft</Button></div>}
    </div>
  );
}

function DropdownField({
  field,
  value,
  onChange,
  disabled,
  fetchMasterData,
}: {
  field: UIFieldConfig;
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  fetchMasterData: (sourceName: string) => Promise<MasterDataOption[]>;
}) {
  const [options, setOptions] = useState<MasterDataOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!field.masterDataSource) return;
    let cancelled = false;
    setLoading(true);
    void fetchMasterData(field.masterDataSource)
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [field.masterDataSource, fetchMasterData]);

  if (loading) return <Input value="Loading..." disabled className="text-xs" />;
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand bg-white">
      <option value="">{field.placeholder || "Select..."}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
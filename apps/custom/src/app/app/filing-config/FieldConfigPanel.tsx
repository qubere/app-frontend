/**
 * Field Configuration Panel
 *
 * Comprehensive field property editor with structured builders (no raw JSON textareas).
 * Each complex tab has an "Edit as JSON" toggle for power users.
 *
 * Tabs: Basic Â· Validation Â· Conditional Â· Data Source Â· Translations Â· Hooks Â· Permissions
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { X, Plus, Trash2, Code } from "lucide-react";
import type { FieldConfig } from "@/types/ui-config.types";
import { schemaToDefaultWidget, isWidgetCustomized } from "@/lib/ui-config/schema-widget-mapper";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FieldConfigPanelProps {
  fieldPath: string;
  fieldSchema: any;
  currentConfig?: FieldConfig;
  onConfigChange: (config: Partial<FieldConfig>) => void;
  onCancel: () => void;
}

type TabId = "basic" | "validation" | "conditional" | "datasource" | "translations" | "hooks" | "permissions";

interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ConditionalGroup {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

type ConditionalAction = "showWhen" | "hideWhen" | "enableWhen" | "disableWhen" | "requiredWhen";

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "â‰  not equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "greaterThan", label: "> greater than" },
  { value: "lessThan", label: "< less than" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

const CONDITIONAL_ACTIONS: { id: ConditionalAction; label: string; hint: string }[] = [
  { id: "showWhen", label: "Show When", hint: "Field appears when true" },
  { id: "hideWhen", label: "Hide When", hint: "Field hides when true" },
  { id: "enableWhen", label: "Enable When", hint: "Field becomes editable when true" },
  { id: "disableWhen", label: "Disable When", hint: "Field becomes read-only when true" },
  { id: "requiredWhen", label: "Required When", hint: "Field becomes required when true" },
];

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "nl", name: "Dutch" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" },
];

const DEFAULT_ROLES = ["admin", "operator", "viewer", "auditor"];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "time", label: "Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "lookup", label: "Lookup" },
  { value: "autocomplete", label: "Autocomplete" },
  { value: "file", label: "File Upload" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function parseConditionalGroup(value: any): ConditionalGroup | null {
  if (!value) return null;
  try {
    const v = typeof value === "string" ? JSON.parse(value) : value;
    if (v && Array.isArray(v.rules)) return v as ConditionalGroup;
    // Legacy single-rule format: { field, equals/operator, value }
    if (v && v.field) {
      return {
        logic: "AND",
        rules: [{ id: uid(), field: v.field, operator: v.equals !== undefined ? "equals" : (v.operator ?? "equals"), value: String(v.equals ?? v.value ?? "") }],
      };
    }
  } catch {}
  return null;
}

function serializeConditionalGroup(group: ConditionalGroup): any {
  if (group.rules.length === 0) return undefined;
  return group;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sub-components
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// JSON mode toggle button
function JsonToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={active ? "Switch to guided builder" : "Edit as raw JSON"}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
        active
          ? "border-amber-400 bg-amber-50 text-amber-700"
          : "border-border bg-white text-ink-muted hover:text-ink hover:border-brand"
      }`}
    >
      <Code className="w-3 h-3" />
      {active ? "Builder" : "Edit JSON"}
    </button>
  );
}

// Condition rule row
function ConditionRuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  onChange: (updated: ConditionRule) => void;
  onRemove: () => void;
}) {
  const hasValue = !["isEmpty", "isNotEmpty"].includes(rule.operator);
  return (
    <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-2 py-1.5">
      <input
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
        placeholder="field.path"
        className="w-28 px-2 py-1 text-xs font-mono border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value })}
        className="text-xs border border-border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
      >
        {CONDITION_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      {hasValue && (
        <input
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="value"
          className="flex-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand"
        />
      )}
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Single conditional action builder (showWhen / hideWhen / etc.)
function ConditionalBuilder({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(() => (value ? JSON.stringify(value, null, 2) : ""));
  const [group, setGroup] = useState<ConditionalGroup>(
    () => parseConditionalGroup(value) ?? { logic: "AND", rules: [] }
  );

  // Keep jsonText in sync when switching to JSON mode
  useEffect(() => {
    if (jsonMode) setJsonText(value ? JSON.stringify(value, null, 2) : "");
  }, [jsonMode, value]);

  const applyGroup = useCallback((g: ConditionalGroup) => {
    setGroup(g);
    onChange(serializeConditionalGroup(g));
  }, [onChange]);

  const addRule = () =>
    applyGroup({ ...group, rules: [...group.rules, { id: uid(), field: "", operator: "equals", value: "" }] });

  const updateRule = (idx: number, r: ConditionRule) =>
    applyGroup({ ...group, rules: group.rules.map((x, i) => (i === idx ? r : x)) });

  const removeRule = (idx: number) =>
    applyGroup({ ...group, rules: group.rules.filter((_, i) => i !== idx) });

  const applyJsonText = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onChange(parsed);
      setGroup(parseConditionalGroup(parsed) ?? { logic: "AND", rules: [] });
      setJsonMode(false);
    } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-ink">{label}</span>
          <span className="text-[10px] text-ink-muted ml-2">{hint}</span>
        </div>
        <JsonToggle active={jsonMode} onToggle={() => setJsonMode((v) => !v)} />
      </div>

      {jsonMode ? (
        <div className="space-y-1">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            onClick={applyJsonText}
            className="text-[10px] px-2 py-1 bg-brand text-white rounded hover:bg-brand/90"
          >
            Apply JSON
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 bg-gray-50 rounded-lg p-2">
          {/* Logic toggle */}
          {group.rules.length > 1 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-ink-muted">Match</span>
              {(["AND", "OR"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => applyGroup({ ...group, logic: l })}
                  className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                    group.logic === l
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-ink-muted border-border"
                  }`}
                >
                  {l}
                </button>
              ))}
              <span className="text-[10px] text-ink-muted">conditions</span>
            </div>
          )}

          {group.rules.length === 0 && (
            <p className="text-[10px] text-ink-muted italic px-1">No conditions â€” add one below</p>
          )}

          {group.rules.map((rule, i) => (
            <ConditionRuleRow
              key={rule.id}
              rule={rule}
              onChange={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}

          <button
            onClick={addRule}
            className="flex items-center gap-1 text-[10px] text-brand hover:underline"
          >
            <Plus className="w-3 h-3" /> Add condition
          </button>
        </div>
      )}
    </div>
  );
}

// Translations table
function TranslationsTable({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(value || {}, null, 2));

  useEffect(() => {
    if (jsonMode) setJsonText(JSON.stringify(value || {}, null, 2));
  }, [jsonMode, value]);

  const get = (lang: string, col: "label" | "placeholder" | "helpText") =>
    (value?.[col]?.[lang]) ?? "";

  const set = (lang: string, col: "label" | "placeholder" | "helpText", text: string) => {
    const updated = {
      label: { ...(value?.label || {}) },
      placeholder: { ...(value?.placeholder || {}) },
      helpText: { ...(value?.helpText || {}) },
    };
    if (text) updated[col][lang] = text;
    else delete updated[col][lang];
    onChange(updated);
  };

  const applyJsonText = () => {
    try { onChange(JSON.parse(jsonText)); setJsonMode(false); } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Translations</span>
        <JsonToggle active={jsonMode} onToggle={() => setJsonMode((v) => !v)} />
      </div>

      {jsonMode ? (
        <div className="space-y-1">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button onClick={applyJsonText} className="text-[10px] px-2 py-1 bg-brand text-white rounded">Apply JSON</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-ink-muted w-24">Language</th>
                <th className="px-3 py-2 text-left font-semibold text-ink-muted">Label</th>
                <th className="px-3 py-2 text-left font-semibold text-ink-muted">Placeholder</th>
                <th className="px-3 py-2 text-left font-semibold text-ink-muted">Help Text</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_LANGUAGES.map((lang, i) => (
                <tr key={lang.code} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-1.5 font-mono text-ink-muted font-semibold">
                    {lang.code}
                    <span className="block text-[9px] font-normal">{lang.name}</span>
                  </td>
                  {(["label", "placeholder", "helpText"] as const).map((col) => (
                    <td key={col} className="px-2 py-1">
                      <input
                        value={get(lang.code, col)}
                        onChange={(e) => set(lang.code, col, e.target.value)}
                        placeholder="â€”"
                        className="w-full px-2 py-1 text-xs border border-transparent rounded hover:border-border focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand bg-transparent focus:bg-white transition-colors"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Permissions matrix
function PermissionsMatrix({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(value || {}, null, 2));
  const [roles, setRoles] = useState<string[]>(() => {
    const existing = Object.keys(value || {});
    return Array.from(new Set([...DEFAULT_ROLES, ...existing]));
  });
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    if (jsonMode) setJsonText(JSON.stringify(value || {}, null, 2));
  }, [jsonMode, value]);

  const get = (role: string, perm: "read" | "write" | "mask"): boolean =>
    value?.[role]?.[perm] ?? false;

  const set = (role: string, perm: "read" | "write" | "mask", checked: boolean) => {
    const updated = { ...(value || {}) };
    updated[role] = { ...(updated[role] || { read: false, write: false, mask: false }), [perm]: checked };
    onChange(updated);
  };

  const addRole = () => {
    const r = newRole.trim().toLowerCase();
    if (r && !roles.includes(r)) { setRoles([...roles, r]); setNewRole(""); }
  };

  const applyJsonText = () => {
    try { onChange(JSON.parse(jsonText)); setJsonMode(false); } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Role Permissions</span>
        <JsonToggle active={jsonMode} onToggle={() => setJsonMode((v) => !v)} />
      </div>

      {jsonMode ? (
        <div className="space-y-1">
          <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={8}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand" />
          <button onClick={applyJsonText} className="text-[10px] px-2 py-1 bg-brand text-white rounded">Apply JSON</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold text-ink-muted">Role</th>
                  {(["read", "write", "mask"] as const).map((p) => (
                    <th key={p} className="px-3 py-2 text-center font-semibold text-ink-muted capitalize">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role, i) => (
                  <tr key={role} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 font-mono text-ink font-medium">{role}</td>
                    {(["read", "write", "mask"] as const).map((perm) => (
                      <td key={perm} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={get(role, perm)}
                          onChange={(e) => set(role, perm, e.target.checked)}
                          className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Add role */}
          <div className="flex gap-1.5">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Add roleâ€¦"
              className="flex-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button onClick={addRole} className="text-[10px] px-2 py-1 bg-brand text-white rounded flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom validation function runner
function ValidationFunctionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [testValue, setTestValue] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runTest = () => {
    if (!value.trim()) return;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("value", `return (${value})(value)`);
      const result = fn(testValue);
      if (result === true) {
        setTestResult({ ok: true, message: "âœ“ Passes validation" });
      } else if (typeof result === "string") {
        setTestResult({ ok: false, message: result });
      } else {
        setTestResult({ ok: false, message: "Validation returned false" });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: `Error: ${e.message}` });
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-ink block">Custom Validation Function</label>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="(value) => value.length > 5 || 'Must be longer than 5 characters'"
          rows={4}
          className="w-full px-3 py-2 text-xs font-mono border border-border rounded-md bg-gray-950 text-green-400 focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-gray-600"
          spellCheck={false}
        />
      </div>
      <p className="text-[10px] text-ink-muted">
        Arrow function receiving <code className="font-mono bg-gray-100 px-1 rounded">value</code>. Return <code className="font-mono bg-gray-100 px-1 rounded">true</code> to pass or a string error message.
      </p>
      {/* Test runner */}
      <div className="flex gap-2 items-center">
        <input
          value={testValue}
          onChange={(e) => setTestValue(e.target.value)}
          placeholder="Test valueâ€¦"
          className="flex-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={runTest}
          disabled={!value.trim()}
          className="text-[10px] px-3 py-1 bg-brand text-white rounded disabled:opacity-40 hover:bg-brand/90 transition-colors"
        >
          Test â–¶
        </button>
      </div>
      {testResult && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${testResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {testResult.message}
        </div>
      )}
    </div>
  );
}

// Hooks builder â€” method + endpoint per event + "Edit as JSON" toggle
const HOOK_EVENTS = [
  { id: "onLoad", label: "On Load", hint: "Called when field initialises" },
  { id: "onChange", label: "On Change", hint: "Called when value changes" },
  { id: "onBlur", label: "On Blur", hint: "Called when field loses focus" },
  { id: "onFocus", label: "On Focus", hint: "Called when field gains focus" },
];

function HooksBuilder({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(value || {}, null, 2));

  useEffect(() => {
    if (jsonMode) setJsonText(JSON.stringify(value || {}, null, 2));
  }, [jsonMode, value]);

  const getHook = (event: string) => {
    const h = value?.[event];
    if (!h) return { method: "POST", endpoint: "" };
    if (typeof h === "string") return { method: "POST", endpoint: h };
    return { method: h.method ?? "POST", endpoint: h.endpoint ?? "" };
  };

  const setHook = (event: string, method: string, endpoint: string) => {
    const updated = { ...(value || {}) };
    if (!endpoint) { delete updated[event]; }
    else { updated[event] = { method, endpoint }; }
    onChange(Object.keys(updated).length ? updated : undefined);
  };

  const applyJsonText = () => {
    try { onChange(JSON.parse(jsonText)); setJsonMode(false); } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Hooks</span>
        <JsonToggle active={jsonMode} onToggle={() => setJsonMode((v) => !v)} />
      </div>

      {jsonMode ? (
        <div className="space-y-1">
          <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={8}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand" />
          <button onClick={applyJsonText} className="text-[10px] px-2 py-1 bg-brand text-white rounded">Apply JSON</button>
        </div>
      ) : (
        <div className="space-y-3">
          {HOOK_EVENTS.map(({ id, label, hint }) => {
            const hook = getHook(id);
            return (
              <div key={id} className="bg-gray-50 border border-border rounded-lg p-3 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-ink">{label}</span>
                  <span className="text-[10px] text-ink-muted ml-2">{hint}</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={hook.method}
                    onChange={(e) => setHook(id, e.target.value, hook.endpoint)}
                    className="w-20 text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                  <input
                    value={hook.endpoint}
                    onChange={(e) => setHook(id, hook.method, e.target.value)}
                    placeholder="/api/field-hook/â€¦"
                    className="flex-1 px-2 py-1 text-xs font-mono border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function FieldConfigPanel({
  fieldPath,
  fieldSchema,
  currentConfig,
  onConfigChange,
  onCancel,
}: FieldConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Derive the schema-implied default widget once per schema node
  const fieldName = fieldPath.split(".").pop() ?? "";
  const defaultWidget = schemaToDefaultWidget(fieldSchema, fieldName);

  const [config, setConfig] = useState<Partial<FieldConfig>>(() => ({
    fieldPath,
    fieldLabel: currentConfig?.fieldLabel || fieldName || "",
    // Auto-propose the schema-implied widget type when the field has no existing config
    fieldType: currentConfig?.fieldType || defaultWidget.widget,
    section: currentConfig?.section || "default-section",
    displayOrder: currentConfig?.displayOrder || 0,
    isVisible: currentConfig?.isVisible ?? false,
    isRequired: currentConfig?.isRequired ?? false,
    isReadOnly: currentConfig?.isReadOnly ?? false,
    ...currentConfig,
  }));

  // Reset state when fieldPath or currentConfig changes
  useEffect(() => {
    const name = fieldPath.split(".").pop() ?? "";
    const dw = schemaToDefaultWidget(fieldSchema, name);
    setConfig({
      fieldPath,
      fieldLabel: currentConfig?.fieldLabel || name || "",
      fieldType: currentConfig?.fieldType || dw.widget,
      section: currentConfig?.section || "default-section",
      displayOrder: currentConfig?.displayOrder || 0,
      isVisible: currentConfig?.isVisible ?? false,
      isRequired: currentConfig?.isRequired ?? false,
      isReadOnly: currentConfig?.isReadOnly ?? false,
      ...currentConfig,
    });
    setActiveTab("basic");
  }, [fieldPath, currentConfig, fieldSchema]);

  const updateConfig = useCallback((updates: Partial<FieldConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  }, [config, onConfigChange]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "validation", label: "Validation" },
    { id: "conditional", label: "Conditional" },
    { id: "datasource", label: "Data Source" },
    { id: "translations", label: "Translations" },
    { id: "hooks", label: "Hooks" },
    { id: "permissions", label: "Permissions" },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-ink">Field Configuration</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-ink-muted font-mono truncate">{fieldPath}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-gray-50 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-white"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* â”€â”€ Basic â”€â”€ */}
        {activeTab === "basic" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                Field Label <span className="text-red-600">*</span>
              </label>
              <Input
                value={config.fieldLabel || ""}
                onChange={(e) => updateConfig({ fieldLabel: e.target.value })}
                placeholder="Display label for the field"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                Field Type <span className="text-red-600">*</span>
              </label>
              <select
                value={config.fieldType || "text"}
                onChange={(e) => updateConfig({ fieldType: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* Schema default hint + customized badge */}
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[10px] text-ink-muted">
                  Schema default:{" "}
                  <span className="font-mono font-semibold text-ink">{defaultWidget.widget}</span>
                  <span className="ml-1 text-ink-muted/70">
                    ({defaultWidget.confidence === "definite" ? "strong signal" : "suggested"})
                  </span>
                </p>
                {config.fieldType && isWidgetCustomized(config.fieldType, fieldSchema, fieldName) && (
                  <span
                    title={`Schema suggests "${defaultWidget.widget}": ${defaultWidget.reason}`}
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded font-semibold"
                  >
                    ⚡ Customized
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Display Order</label>
                <Input
                  type="number"
                  value={config.displayOrder || 0}
                  onChange={(e) => updateConfig({ displayOrder: parseInt(e.target.value) || 0 })}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Grid Column</label>
                <select
                  value={config.gridColumn || 4}
                  onChange={(e) => updateConfig({ gridColumn: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-border rounded-md"
                >
                  <option value="3">3 (25%)</option>
                  <option value="4">4 (33%) — 3 columns</option>
                  <option value="6">6 (50%) — 2 columns</option>
                  <option value="8">8 (66%)</option>
                  <option value="12">12 (100%)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Placeholder</label>
              <Input
                value={config.placeholder || ""}
                onChange={(e) => updateConfig({ placeholder: e.target.value })}
                placeholder="Placeholder textâ€¦"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Help Text</label>
              <textarea
                value={config.helpText || ""}
                onChange={(e) => updateConfig({ helpText: e.target.value })}
                placeholder="Help text to guide usersâ€¦"
                className="w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Default Value</label>
              <Input
                value={config.defaultValue || ""}
                onChange={(e) => updateConfig({ defaultValue: e.target.value })}
                placeholder="Default value for the field"
                className="text-xs"
              />
            </div>

            {/* Visibility â€” explicit toggle, not bare checkbox */}
            <div className="pt-3 border-t border-border space-y-3">
              {/* Visibility toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-ink">Visibility</span>
                  <p className="text-[10px] text-ink-muted">Controls whether this field is shown in the form</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ isVisible: !config.isVisible })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                    config.isVisible ? "bg-green-500" : "bg-gray-300"
                  }`}
                  aria-pressed={config.isVisible}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.isVisible ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className={`text-xs font-semibold ml-2 ${config.isVisible ? "text-green-600" : "text-gray-400"}`}>
                  {config.isVisible ? "Shown" : "Hidden"}
                </span>
              </div>

              {/* Required */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isRequired ?? false}
                  onChange={(e) => updateConfig({ isRequired: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded cursor-pointer"
                />
                <span className="text-xs font-medium text-ink">Required</span>
              </label>

              {/* Read Only */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isReadOnly ?? false}
                  onChange={(e) => updateConfig({ isReadOnly: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded cursor-pointer"
                />
                <span className="text-xs font-medium text-ink">Read Only</span>
              </label>
            </div>
          </div>
        )}

        {/* â”€â”€ Validation â”€â”€ */}
        {activeTab === "validation" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Min Length</label>
                <Input
                  type="number"
                  value={config.validation?.minLength || ""}
                  onChange={(e) => updateConfig({ validation: { ...config.validation, minLength: parseInt(e.target.value) || undefined } })}
                  placeholder="Minimum length"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Max Length</label>
                <Input
                  type="number"
                  value={config.validation?.maxLength || ""}
                  onChange={(e) => updateConfig({ validation: { ...config.validation, maxLength: parseInt(e.target.value) || undefined } })}
                  placeholder="Maximum length"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Min Value</label>
                <Input
                  type="number"
                  value={config.validation?.min || ""}
                  onChange={(e) => updateConfig({ validation: { ...config.validation, min: parseFloat(e.target.value) || undefined } })}
                  placeholder="Minimum value"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Max Value</label>
                <Input
                  type="number"
                  value={config.validation?.max || ""}
                  onChange={(e) => updateConfig({ validation: { ...config.validation, max: parseFloat(e.target.value) || undefined } })}
                  placeholder="Maximum value"
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Pattern (Regex)</label>
              <Input
                value={config.validation?.pattern || ""}
                onChange={(e) => updateConfig({ validation: { ...config.validation, pattern: e.target.value } })}
                placeholder="^[A-Z]{2}\d{4}$"
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-ink-muted mt-1">Regular expression for validation</p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Custom Error Message</label>
              <Input
                value={config.validation?.message || ""}
                onChange={(e) => updateConfig({ validation: { ...config.validation, message: e.target.value } })}
                placeholder="Error message to display"
                className="text-xs"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              {(["email", "url", "phone"] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.validation?.[fmt] ?? false}
                    onChange={(e) => updateConfig({ validation: { ...config.validation, [fmt]: e.target.checked || undefined } })}
                    className="w-4 h-4 text-primary border-border rounded cursor-pointer"
                  />
                  <span className="text-xs font-medium text-ink capitalize">{fmt} format</span>
                </label>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <ValidationFunctionEditor
                value={config.validation?.custom || ""}
                onChange={(v) => updateConfig({ validation: { ...config.validation, custom: v || undefined } })}
              />
            </div>
          </div>
        )}

        {/* â”€â”€ Conditional â”€â”€ */}
        {activeTab === "conditional" && (
          <div className="space-y-5">
            <p className="text-xs text-ink-muted">
              Control field visibility and behavior based on other field values.
              Each action evaluates its conditions independently.
            </p>
            {CONDITIONAL_ACTIONS.map(({ id, label, hint }) => (
              <ConditionalBuilder
                key={id}
                label={label}
                hint={hint}
                value={(config as any)[id]}
                onChange={(v) => updateConfig({ [id]: v })}
              />
            ))}
          </div>
        )}

        {/* â”€â”€ Data Source â”€â”€ */}
        {activeTab === "datasource" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-muted">
              Configure data source for dropdowns, lookups, and autocomplete fields.
            </p>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Master Data Source</label>
              <Input
                value={config.masterDataSource || ""}
                onChange={(e) => updateConfig({ masterDataSource: e.target.value })}
                placeholder="e.g., countries, currencies, ports"
                className="text-xs"
              />
              <p className="text-[10px] text-ink-muted mt-1">Reference to master data table</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.isMultiSelect ?? false}
                onChange={(e) => updateConfig({ isMultiSelect: e.target.checked })}
                className="w-4 h-4 text-primary border-border rounded cursor-pointer"
              />
              <span className="text-xs font-medium text-ink">Allow Multiple Selection</span>
            </label>

            <div>
              <label className="text-xs font-medium text-ink block mb-2">API Data Source</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={config.dataSource?.method || "GET"}
                    onChange={(e) => updateConfig({ dataSource: { ...config.dataSource, method: e.target.value as any } })}
                    className="w-20 text-xs border border-border rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <Input
                    value={config.dataSource?.apiEndpoint || ""}
                    onChange={(e) => updateConfig({ dataSource: { ...config.dataSource, apiEndpoint: e.target.value } })}
                    placeholder="/api/master-data/countries"
                    className="text-xs flex-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-ink-muted">Value field</label>
                    <Input
                      value={config.dataSource?.valueField || ""}
                      onChange={(e) => updateConfig({ dataSource: { ...config.dataSource, valueField: e.target.value } })}
                      placeholder="code"
                      className="text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-muted">Label field</label>
                    <Input
                      value={config.dataSource?.labelField || ""}
                      onChange={(e) => updateConfig({ dataSource: { ...config.dataSource, labelField: e.target.value } })}
                      placeholder="name"
                      className="text-xs mt-0.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-ink-muted">Depends on (comma-separated field paths)</label>
                  <Input
                    value={Array.isArray(config.dataSource?.dependsOn) ? config.dataSource!.dependsOn.join(", ") : (config.dataSource?.dependsOn as string) || ""}
                    onChange={(e) => updateConfig({ dataSource: { ...config.dataSource, dependsOn: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
                    placeholder="country, procedureCode"
                    className="text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Translations â”€â”€ */}
        {activeTab === "translations" && (
          <TranslationsTable
            value={config.translations}
            onChange={(v) => updateConfig({ translations: v })}
          />
        )}

        {/* â”€â”€ Hooks â”€â”€ */}
        {activeTab === "hooks" && (
          <HooksBuilder
            value={config.hooks}
            onChange={(v) => updateConfig({ hooks: v })}
          />
        )}

        {/* â”€â”€ Permissions â”€â”€ */}
        {activeTab === "permissions" && (
          <PermissionsMatrix
            value={config.permissions}
            onChange={(v) => updateConfig({ permissions: v })}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-gray-50 text-xs text-ink-muted">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold truncate max-w-[60%]">{fieldPath}</span>
          <div className="flex items-center gap-2">
            {config.isRequired && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">Required</span>}
            {config.isReadOnly && <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">Read-only</span>}
            {config.isVisible
              ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Shown</span>
              : <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">Hidden</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * UI Configuration Editor Page (Refactored)
 * 
 * Enhanced split-screen interface for configuring comprehensive UI behavior.
 * Left: Schema tree viewer
 * Right: Field configuration panel with full property support
 * 
 * Features:
 * - Full FilingUIConfigData structure support
 * - Real-time validation with error display
 * - Type-safe config builders
 * - Tabs, sections, panels management (foundation ready)
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";
import { ArrowLeft, Plus, Save, Eye, AlertCircle, AlertTriangle, CheckCircle, Layout, Layers, Send, FileCheck } from "lucide-react";
import SchemaTreeViewer from "./SchemaTreeViewer";
import FieldConfigPanel from "./FieldConfigPanel";
import ComplexObjectConfigPanel from "./ComplexObjectConfigPanel";
import TabManager from "./TabManager";
import LayoutRenderer from "@/components/form/layouts/LayoutRenderer";
import LivePreviewPanel from "./LivePreviewPanel";

// Import UI Config types and utilities
import type { FilingUIConfigData, FieldConfig, LayoutMode } from "@/types/ui-config.types";
import {
  createEmptyConfig,
  addSection,
  addField,
  updateField,
  getField
} from "@/lib/ui-config/config-builder";
import {
  validateConfig,
  getValidationSummary,
  type ValidationError
} from "@/lib/ui-config/config-validator";

// Add animation styles
const styles = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;

interface ProcedureConfig {
  id: string;
  country: string;
  procedureCode: string;
  messageName: string;
  transactionType: string | null;
}

interface ReleaseRecord {
  id: string;
  country: string;
  procedureCode: string;
  release: string;
  description: string | null;
}

interface ConfigSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (country: string, procedureCode: string, messageName: string, messageType: string, schemaVersion: string) => void;
}

function ConfigSelectorModal({ isOpen, onClose, onSelect }: ConfigSelectorModalProps) {
  const [allConfigs, setAllConfigs] = useState<ProcedureConfig[]>([]);
  const [allReleases, setAllReleases] = useState<ReleaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [country, setCountry] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [messageName, setMessageName] = useState("");
  const [messageType, setMessageType] = useState("request");
  const [release, setRelease] = useState("");
  const [schemaChecking, setSchemaChecking] = useState(false);

  // Load all procedure configs and releases once
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      fetch("/api/filing-config/procedure-configs").then((r) => r.json()),
      fetch("/api/filing-config/releases").then((r) => r.json()),
    ])
      .then(([configData, releaseData]) => {
        setAllConfigs(configData.configs ?? []);
        setAllReleases(releaseData.releases ?? []);
        // Auto-select first available country
        const firstCountry = configData.configs?.[0]?.country ?? "";
        if (firstCountry) setCountry(firstCountry);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Cascade: reset downstream when parent changes
  useEffect(() => { setProcedureCode(""); setMessageName(""); }, [country]);
  useEffect(() => { setMessageName(""); setRelease(""); }, [procedureCode]);
  useEffect(() => { setRelease(""); }, [country]);

  // Derived option lists
  const countries = Array.from(new Set(allConfigs.map((c) => c.country))).sort();

  const procedureCodes = Array.from(
    new Set(allConfigs.filter((c) => c.country === country).map((c) => c.procedureCode))
  ).sort();

  const messageNames = Array.from(
    new Set(
      allConfigs
        .filter((c) => c.country === country && c.procedureCode === procedureCode)
        .map((c) => c.messageName)
    )
  ).sort();

  const releases = allReleases
    .filter((r) => r.country === country && r.procedureCode === procedureCode)
    .sort((a, b) => a.release.localeCompare(b.release));

  // Auto-select first option when list resolves
  useEffect(() => {
    if (procedureCodes.length === 1 && !procedureCode) setProcedureCode(procedureCodes[0]);
  }, [procedureCodes, procedureCode]);
  useEffect(() => {
    if (messageNames.length === 1 && !messageName) setMessageName(messageNames[0]);
  }, [messageNames, messageName]);
  useEffect(() => {
    if (releases.length === 1 && !release) setRelease(releases[0].release);
  }, [releases, release]);

  // Description shown below the fields
  const description = country && procedureCode && release
    ? `${country} · ${procedureCode} · Release ${release}`
    : country && procedureCode
    ? `${country} · ${procedureCode}`
    : "";

  const canSubmit = country && procedureCode && messageName && messageType && release;

  const handleSubmit = async () => {
    if (!canSubmit || schemaChecking) return;

    setSchemaChecking(true);
    try {
      const response = await fetch(
        `/api/schemas/${encodeURIComponent(country)}/${encodeURIComponent(procedureCode)}/${encodeURIComponent(messageName)}/${encodeURIComponent(messageType)}?version=${encodeURIComponent(release)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(
          errorData.message ||
          `Schema not found for ${procedureCode.toLowerCase()} release ${release}. Please add the canonical schema before configuring fields.`
        );
        return;
      }

      onSelect(country, procedureCode, messageName, messageType, release);
    } catch (error: any) {
      alert(error?.message || `Unable to check schema for ${procedureCode.toLowerCase()} release ${release}.`);
    } finally {
      setSchemaChecking(false);
    }
  };

  const selectClass = "w-full px-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary mt-1 bg-white disabled:bg-gray-50 disabled:text-ink-muted";

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="config-selector">
      <ModalHeader titleId="config-selector">
        <h2 className="text-lg font-bold text-ink">Select Configuration Target</h2>
        <p className="text-xs text-ink-muted mt-1">
          Choose the country, procedure, message, and release to configure
        </p>
      </ModalHeader>

      <ModalBody>
        {loading ? (
          <div className="py-8 text-center text-sm text-ink-muted">Loading options…</div>
        ) : (
          <div className="space-y-4">
            {/* Country */}
            <div>
              <label className="text-xs font-medium text-ink">Country <span className="text-red-600">*</span></label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={selectClass}
              >
                <option value="">— Select country —</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Procedure Code — cascades from Country */}
            <div>
              <label className="text-xs font-medium text-ink">Procedure Code <span className="text-red-600">*</span></label>
              <select
                value={procedureCode}
                onChange={(e) => setProcedureCode(e.target.value)}
                disabled={!country}
                className={selectClass}
              >
                <option value="">— Select procedure code —</option>
                {procedureCodes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Message Name — cascades from Country + Procedure Code */}
            <div>
              <label className="text-xs font-medium text-ink">Message Name <span className="text-red-600">*</span></label>
              <select
                value={messageName}
                onChange={(e) => setMessageName(e.target.value)}
                disabled={!procedureCode}
                className={selectClass}
              >
                <option value="">— Select message name —</option>
                {messageNames.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Message Type */}
            <div>
              <label className="text-xs font-medium text-ink">Message Type <span className="text-red-600">*</span></label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                className={selectClass}
              >
                <option value="request">Request</option>
                <option value="response">Response</option>
              </select>
            </div>

            {/* Release — from FilingCountryCustomsVersion, filtered by Country */}
            <div>
              <label className="text-xs font-medium text-ink">Release <span className="text-red-600">*</span></label>
              <select
                value={release}
                onChange={(e) => setRelease(e.target.value)}
                disabled={!country}
                className={selectClass}
              >
                <option value="">— Select release —</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.release}>
                    {r.release}{r.description ? ` — ${r.description}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            {description && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Configuration</p>
                <p className="text-sm font-bold text-blue-900 font-mono">{description}</p>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || schemaChecking}
        >
          {schemaChecking ? "Checking schema..." : "Continue"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface UIConfigEditorProps {
  configId?: string;
  onBack: () => void;
}

type LifecycleStatus = 'draft' | 'validated' | 'published';
type SavingAction = 'draft' | 'validate' | null;

export default function UIConfigEditor({ configId, onBack }: UIConfigEditorProps) {
  // Configuration target state
  const [country, setCountry] = useState<string>("");
  const [procedureCode, setProcedureCode] = useState<string>("");
  const [messageName, setMessageName] = useState<string>("");
  const [messageType, setMessageType] = useState<string>("");
  const [schemaVersion, setSchemaVersion] = useState<string>("");
  const [showSelectorModal, setShowSelectorModal] = useState(!configId);
  
  // UI Config data state (NEW: FilingUIConfigData structure)
  const [config, setConfig] = useState<FilingUIConfigData | null>(null);
  const [originalConfig, setOriginalConfig] = useState<FilingUIConfigData | null>(null);
  const [_isActive, setIsActive] = useState(true);

  // Lifecycle: Draft → Validated → Published
  const [lifecycleStatus, setLifecycleStatus] = useState<LifecycleStatus>('draft');
  const [savedConfigId, setSavedConfigId] = useState<string | null>(configId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Validation state (NEW)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
  const [showWarningsPanel, setShowWarningsPanel] = useState(false);
  
  // Schema state
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaErrorDetails, setSchemaErrorDetails] = useState<{
    availableVersions?: string[];
    transactionType?: string;
    requestedVersion?: string;
  } | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<any>(null);
  
  // UI state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showStructureManager, setShowStructureManager] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  // Load existing config or create new
  useEffect(() => {
    if (configId) {
      loadExistingConfig();
    } else if (country && procedureCode && messageName && messageType) {
      initializeNewConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, country, procedureCode, messageName, messageType]);

  // Load schema when target is selected
  useEffect(() => {
    if (country && procedureCode && messageName && messageType && schemaVersion) {
      loadSchema();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, procedureCode, messageName, messageType, schemaVersion]);

  // Track unsaved changes
  useEffect(() => {
    if (config && originalConfig) {
      const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);
      setHasUnsavedChanges(hasChanges);
    }
  }, [config, originalConfig]);

  // Run validation when config changes
  useEffect(() => {
    if (config) {
      runValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const loadExistingConfig = async () => {
    try {
      const response = await fetch(`/api/filing-config/ui-configuration/${configId}`);
      if (!response.ok) throw new Error("Failed to load configuration");
      
      const data = await response.json();
      
      // Set target info
      setCountry(data.country);
      setProcedureCode(data.procedureCode);
      setMessageName(data.messageName);
      setMessageType(data.messageType);
      // Use saved release if available; otherwise fall back to version number
      if (data.release) {
        setSchemaVersion(data.release);
      } else {
        const versionStr = data.version?.toString() || "1";
        const normalizedVersion = versionStr.includes('.') ? versionStr : `${versionStr}.0.0`;
        setSchemaVersion(normalizedVersion);
      }
      setIsActive(data.isActive ?? true);
      
      // Set lifecycle status from DB flags
      if (data.isActive) {
        setLifecycleStatus('published');
      } else if (!data.isDraft) {
        setLifecycleStatus('validated');
      } else {
        setLifecycleStatus('draft');
      }
      setSavedConfigId(data.id);
      
      // Set config data (handle both new and legacy formats)
      let configData: FilingUIConfigData;
      
      if (data.configData?.version) {
        // New format - already FilingUIConfigData
        configData = data.configData;
      } else {
        // Legacy format or empty - convert
        configData = createEmptyConfig({
          country: data.country,
          procedure: data.procedureCode,
          message: data.messageName,
          layoutMode: 'single-page'
        });
        
        // Migrate legacy fields if they exist
        if (data.configData?.fields && Array.isArray(data.configData.fields)) {
          // Create a default section for legacy fields
          // addSection mutates in place (returns void)
          addSection(configData, {
            sectionId: 'default-section',
            title: 'Form Fields',
            description: 'Migrated from legacy configuration',
            layout: 'grid', // Changed from layoutMode
            sectionOrder: 0, // Changed from displayOrder
            isCollapsible: false,
            defaultExpanded: true
          });
          
          // Add each legacy field
          data.configData.fields.forEach((legacyField: any, index: number) => {
            // addField mutates in place (returns void)
            addField(configData, {
              fieldPath: legacyField.fieldPath,
              fieldLabel: legacyField.fieldLabel || legacyField.fieldPath,
              fieldType: legacyField.fieldType || 'text',
              section: 'default-section', // Changed from sectionId
              displayOrder: index,
              isVisible: legacyField.isVisible ?? false,
              isRequired: legacyField.isRequired ?? false,
              isReadOnly: legacyField.isReadOnly ?? false,
              placeholder: legacyField.placeholder,
              helpText: legacyField.helpText
            });
          });
        }
      }
      
      setConfig(configData);
      setOriginalConfig(JSON.parse(JSON.stringify(configData))); // Deep clone
    } catch (error) {
      console.error("Error loading config:", error);
      setSaveStatus({
        show: true,
        type: "error",
        message: "Failed to load configuration"
      });
    }
  };

  const initializeNewConfig = () => {
    const newConfig = createEmptyConfig({
      country,
      procedure: procedureCode,
      message: messageName,
      layoutMode: 'single-page', // Default layout
      tags: [messageType]
    });
    
    setConfig(newConfig);
    setOriginalConfig(JSON.parse(JSON.stringify(newConfig)));
  };

  const loadSchema = async () => {
    // Validate all required params before attempting to load
    if (!country || !procedureCode || !messageName || !messageType || !schemaVersion) {
      console.warn('⚠️ Schema load skipped - missing params:', { 
        country, procedureCode, messageName, messageType, schemaVersion 
      });
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);
    setSchemaErrorDetails(null);
    
    try {
      const url = `/api/schemas/${country}/${procedureCode}/${messageName}/${messageType}?version=${schemaVersion}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const apiMessage = errorData.message || errorData.error || `Failed to load schema (${response.status})`;
        // Store structured details if the API returned them (SCHEMA_VERSION_NOT_FOUND)
        if (errorData.details) {
          setSchemaErrorDetails({
            availableVersions: errorData.details.availableVersions,
            transactionType: errorData.details.transactionType,
            requestedVersion: errorData.details.requested,
          });
        }
        throw new Error(apiMessage);
      }
      
      const data = await response.json();
      setSchema(data.schema);
      setSchemaError(null);
      setSchemaErrorDetails(null);
    } catch (error: any) {
      console.error("❌ Error loading schema:", error);
      const errorMessage = error.message || "Failed to load schema. Please check your configuration.";
      setSchemaError(errorMessage);
    } finally {
      setSchemaLoading(false);
    }
  };

  const runValidation = () => {
    if (!config) return;
    
    const result = validateConfig(config);
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
  };

  const handleSelectTarget = (
    newCountry: string,
    newProcedureCode: string,
    newMessageName: string,
    newMessageType: string,
    newSchemaVersion: string
  ) => {
    setCountry(newCountry);
    setProcedureCode(newProcedureCode);
    setMessageName(newMessageName);
    setMessageType(newMessageType);
    setSchemaVersion(newSchemaVersion);
    setShowSelectorModal(false);
  };

  const handleSelectField = useCallback((path: string, fieldSchema: any) => {
    console.log('🔍 handleSelectField called:', { path, fieldSchema });
    setSelectedPath(path);
    setSelectedSchema(fieldSchema);
  }, []);

  const handleFieldConfigChange = (fieldPath: string, fieldConfig: Partial<FieldConfig>) => {
    if (!config) return;
    
    const existingField = getField(config, fieldPath);
    
    if (existingField) {
      // Update existing field - updateField mutates in place
      const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
      updateField(updatedConfig, fieldPath, fieldConfig);
      setConfig(updatedConfig);
    } else {
      // Add new field to default section
      const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
      
      // Ensure default section exists
      if (!updatedConfig.sections || updatedConfig.sections.length === 0) {
        // Initialize sections array if undefined
        if (!updatedConfig.sections) {
          updatedConfig.sections = [];
        }
        
        // addSection mutates in place (returns void)
        addSection(updatedConfig, {
          sectionId: 'default-section',
          title: 'Form Fields',
          layout: 'grid', // Changed from layoutMode
          sectionOrder: 0, // Changed from displayOrder
          isCollapsible: false,
          defaultExpanded: true
        });
      }
      
      const defaultSectionId = updatedConfig.sections[0].sectionId;
      
      // addField mutates in place (returns void)
      addField(updatedConfig, {
        fieldPath,
        fieldLabel: fieldConfig.fieldLabel || fieldPath,
        fieldType: fieldConfig.fieldType || 'text',
        section: defaultSectionId, // Changed from sectionId
        displayOrder: updatedConfig.fields.length,
        isVisible: fieldConfig.isVisible ?? false,
        isRequired: fieldConfig.isRequired ?? false,
        isReadOnly: fieldConfig.isReadOnly ?? false,
        placeholder: fieldConfig.placeholder,
        helpText: fieldConfig.helpText
      });
      
      setConfig(updatedConfig);
    }
  };

  const handleGenerateLayout = (fieldPath: string, fieldSchema: any, layoutType: string | null) => {
    if (!config) return;

    const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
    if (!updatedConfig.layoutHints) updatedConfig.layoutHints = {};

    if (layoutType === null || layoutType === undefined) {
      // Clear / remove the layout hint for this path
      delete updatedConfig.layoutHints[fieldPath];
    } else {
      updatedConfig.layoutHints[fieldPath] = layoutType;
    }

    setConfig(updatedConfig);
    setHasUnsavedChanges(true);
  };

  const persistDraft = async (
    nextLifecycleStatus: LifecycleStatus = 'draft',
    successMessage = "Draft saved"
  ) => {
    if (!config) return null;

    const configToSave = {
      ...config,
      metadata: {
        ...config.metadata,
        lastModifiedBy: "current-user",
        lastModifiedAt: new Date().toISOString(),
      },
    };

    const payload = {
      country, procedureCode, messageName, messageType,
      // schemaVersion holds the release value selected in the ConfigSelectorModal
      release: schemaVersion || undefined,
      configData: configToSave,
      description: config.metadata?.description,
    };

    const response = await fetch(
      savedConfigId
        ? `/api/filing-config/ui-configuration/${savedConfigId}`
        : "/api/filing-config/ui-configuration",
      {
        method: savedConfigId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to save draft");
    }

    const saved = await response.json();
    setSavedConfigId(saved.id);
    setConfig(configToSave);
    setOriginalConfig(JSON.parse(JSON.stringify(configToSave)));
    setHasUnsavedChanges(false);
    setLifecycleStatus(nextLifecycleStatus);

    setSaveStatus({ show: true, type: "success", message: successMessage });
    setTimeout(() => setSaveStatus(null), 4000);
    return saved;
  };

  // ── Save Draft ──────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!config || isSaving || lifecycleStatus === "published") return;
    setIsSaving(true);
    setSavingAction('draft');

    try {
      await persistDraft('draft', "Draft saved");
    } catch (error: any) {
      setSaveStatus({ show: true, type: "error", message: error.message || "Failed to save draft" });
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setSavingAction(null);
      setIsSaving(false);
    }
  };

  // ── Validate ────────────────────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!config || isSaving) return;
    const result = validateConfig(config);
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
    setShowWarningsPanel(true);

    if (result.valid) {
      setIsSaving(true);
      setSavingAction('validate');
      try {
        await persistDraft('validated', "Validation passed — ready to publish");
      } catch (error: any) {
        setSaveStatus({ show: true, type: "error", message: error.message || "Validation passed, but saving the draft failed" });
        setTimeout(() => setSaveStatus(null), 5000);
      } finally {
        setSavingAction(null);
        setIsSaving(false);
      }
    } else {
      setSaveStatus({
        show: true, type: "error",
        message: `Validation failed: ${result.errors.length} error(s)`,
      });
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // ── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!savedConfigId || isPublishing) return;

    if (hasUnsavedChanges) {
      setSaveStatus({ show: true, type: "error", message: "Save your draft before publishing" });
      setTimeout(() => setSaveStatus(null), 4000);
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch(
        `/api/filing-config/ui-configuration/${savedConfigId}/publish`,
        { method: "POST" }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to publish");
      }

      setLifecycleStatus('published');
      setIsActive(true);
      setSaveStatus({ show: true, type: "success", message: "Configuration published and now live" });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (error: any) {
      setSaveStatus({ show: true, type: "error", message: error.message || "Failed to publish" });
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancel = () => {
    setSelectedPath(null);
    setSelectedSchema(null);
  };

  // Get current field config for selected path
  const getCurrentFieldConfig = (): FieldConfig | undefined => {
    if (!config || !selectedPath) return undefined;
    return getField(config, selectedPath);
  };

  // Compute stats for header
  const configStats = config ? {
    fieldCount: config.fields.length,
    sectionCount: config.sections.length,
    tabCount: config.tabs?.length || 0,
    layoutMode: config.layout.mode,
    hasErrors: validationErrors.length > 0,
    hasWarnings: validationWarnings.length > 0
  } : null;

  if (!country || !procedureCode || !messageName || !messageType || !schemaVersion) {
    return (
      <ConfigSelectorModal
        isOpen={showSelectorModal}
        onClose={onBack}
        onSelect={handleSelectTarget}
      />
    );
  }

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-sm text-ink-muted mb-2">Loading schema...</div>
          <div className="text-xs text-ink-muted">
            {country}/{procedureCode}/{messageName}/{messageType}
          </div>
        </div>
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-lg p-8">
          <div className="text-red-600 mb-5">
            <AlertCircle className="w-14 h-14 mx-auto mb-3" />
            <h3 className="text-lg font-bold">Schema Version Not Found</h3>
          </div>

          <p className="text-sm text-ink-muted mb-5">{schemaError}</p>

          {schemaErrorDetails?.availableVersions && schemaErrorDetails.availableVersions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-5 text-left">
              <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wider">
                Available Schema Versions ({schemaErrorDetails.transactionType})
              </p>
              <div className="flex flex-wrap gap-2">
                {schemaErrorDetails.availableVersions.map((v) => (
                  <span key={v} className="text-sm font-mono font-bold px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg">
                    {v}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-blue-600 mt-3">
                Please select a Release that matches one of the available schema versions above.
              </p>
            </div>
          )}

          {schemaErrorDetails?.availableVersions?.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 mb-5 text-left">
              <p className="text-xs text-yellow-800">
                No schema files found. Add schema files to{" "}
                <code className="font-mono text-[11px] bg-yellow-100 px-1 rounded">
                  public/schemas/customs-filing/filing-schemas/{schemaErrorDetails.transactionType?.toLowerCase()}/
                </code>
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={() => loadSchema()} variant="primary" size="sm">
              Retry
            </Button>
            <Button onClick={onBack} variant="ghost" size="sm">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-ink-muted">Loading schema...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <style>{styles}</style>
      
      {/* Success/Error Notification */}
      {saveStatus?.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border animate-slide-in ${
            saveStatus.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${saveStatus.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-semibold">{saveStatus.message}</span>
            <button
              onClick={() => setSaveStatus(null)}
              className="ml-4 text-lg font-bold opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Warnings / Errors Panel ── */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className={`border-b ${validationErrors.length > 0 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
          {/* Summary row — click to toggle panel */}
          <button
            className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-black/5 transition-colors"
            onClick={() => setShowWarningsPanel((v) => !v)}
          >
            <div className="flex items-center gap-3">
              {validationErrors.length > 0 ? (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              )}
              <div className="text-left">
                <span className="text-sm font-semibold text-ink">
                  {validationErrors.length > 0
                    ? `${validationErrors.length} error${validationErrors.length !== 1 ? "s" : ""}`
                    : ""}
                  {validationErrors.length > 0 && validationWarnings.length > 0 ? ", " : ""}
                  {validationWarnings.length > 0
                    ? `${validationWarnings.length} warning${validationWarnings.length !== 1 ? "s" : ""}`
                    : ""}
                </span>
                <span className="text-xs text-ink-muted ml-2">
                  {getValidationSummary(validationErrors, validationWarnings)}
                </span>
              </div>
            </div>
            <span className="text-xs text-ink-muted">
              {showWarningsPanel ? "▲ Collapse" : "▼ Show details"}
            </span>
          </button>

          {/* Clickable issue list */}
          {showWarningsPanel && (
            <div className="px-6 pb-3 space-y-1 max-h-56 overflow-y-auto">
              {[...validationErrors, ...validationWarnings].map((issue, idx) => {
                const fieldPath = issue.path ?? issue.details?.fieldPath;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (fieldPath) {
                        // Navigate to field in tree
                        const schemaNode = config?.fields.find((f) => f.fieldPath === fieldPath);
                        if (schemaNode) handleSelectField(fieldPath, selectedSchema ?? {});
                      }
                    }}
                    className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border transition-colors ${
                      fieldPath
                        ? "cursor-pointer hover:border-brand hover:bg-white"
                        : "cursor-default"
                    } ${
                      issue.type === "error"
                        ? "bg-white border-red-200"
                        : "bg-white border-yellow-200"
                    }`}
                  >
                    <span className={`flex-shrink-0 font-bold text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${
                      issue.type === "error" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {issue.category.toUpperCase()}
                    </span>
                    <span className="flex-1 text-ink">{issue.message}</span>
                    {fieldPath && (
                      <span className="flex-shrink-0 text-[10px] font-mono text-brand underline">
                        → {fieldPath}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-bold text-ink">UI Configuration Editor</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                {configId ? "Editing existing configuration" : "Creating new configuration"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-600 font-semibold">
                • Unsaved changes
              </span>
            )}
            
            {/* ── Live Counters ── */}
            {configStats && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-semibold">
                  {configStats.fieldCount} field{configStats.fieldCount !== 1 ? "s" : ""}
                </span>
                <span className="px-2 py-1 bg-gray-50 border border-border text-ink-muted rounded-full font-semibold">
                  {configStats.sectionCount} section{configStats.sectionCount !== 1 ? "s" : ""}
                </span>
                {configStats.tabCount > 0 && (
                  <span className="px-2 py-1 bg-gray-50 border border-border text-ink-muted rounded-full font-semibold">
                    {configStats.tabCount} tab{configStats.tabCount !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="px-2 py-1 bg-surface-muted border border-border text-ink-muted rounded-full font-mono text-[10px]">
                  {configStats.layoutMode}
                </span>
                {/* Warnings indicator — clickable */}
                {(configStats.hasErrors || configStats.hasWarnings) && (
                  <button
                    onClick={() => setShowWarningsPanel((v) => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full border font-semibold transition-colors ${
                      configStats.hasErrors
                        ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                        : "bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                    }`}
                  >
                    {configStats.hasErrors ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {validationErrors.length + validationWarnings.length} issue{(validationErrors.length + validationWarnings.length) !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}

            {/* ── Lifecycle Badges + Actions ── */}
            <div className="flex items-center gap-2">
              {/* Lifecycle status badge */}
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                lifecycleStatus === "published"
                  ? "bg-green-100 text-green-700 border-green-300"
                  : lifecycleStatus === "validated"
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-orange-100 text-orange-700 border-orange-300"
              }`}>
                {lifecycleStatus === "published" ? "● Active" : lifecycleStatus === "validated" ? "✓ Validated" : "✎ Draft"}
              </span>

              {/* Save Draft */}
              <Button
                onClick={handleSaveDraft}
                variant="secondary"
                size="sm"
                disabled={!hasUnsavedChanges || isSaving || lifecycleStatus === "published"}
                title={
                  lifecycleStatus === "published"
                    ? "Published configurations cannot be saved as drafts. Validate and publish to update this record."
                    : "Save this configuration as a draft"
                }
              >
                <Save className="w-4 h-4 mr-1.5" />
                {savingAction === "draft" ? "Saving…" : "Save Draft"}
              </Button>

              {/* Validate */}
              <Button
                onClick={handleValidate}
                variant="secondary"
                size="sm"
                disabled={!config || isSaving}
              >
                <FileCheck className="w-4 h-4 mr-1.5" />
                {savingAction === "validate" ? "Validating..." : "Validate"}
              </Button>

              {/* Publish — enabled only for a saved, validated draft */}
              <Button
                onClick={handlePublish}
                variant="primary"
                size="sm"
                disabled={!savedConfigId || hasUnsavedChanges || isSaving || isPublishing || lifecycleStatus !== "validated"}
                title={
                  lifecycleStatus === "published"
                    ? "Already published"
                    : lifecycleStatus !== "validated"
                    ? "Validate successfully before publishing"
                    : hasUnsavedChanges
                    ? "Save your draft first"
                    : !savedConfigId
                    ? "Save draft first to enable publish"
                    : "Publish to make this configuration live"
                }
              >
                <Send className="w-4 h-4 mr-1.5" />
                {isPublishing ? "Publishing…" : "Publish"}
              </Button>
            </div>

            {/* ── Preview controls ── */}
            <Button
              onClick={() => setShowLivePreview((v) => !v)}
              variant={showLivePreview ? "primary" : "secondary"}
              size="sm"
              disabled={!config || !schema}
              title="Toggle inline live preview panel"
            >
              <Eye className="w-4 h-4 mr-1.5" />
              {showLivePreview ? "Hide Preview" : "Live Preview"}
            </Button>
            <Button
              onClick={() => setShowPreview(true)}
              variant="secondary"
              size="sm"
              disabled={!config}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Preview
            </Button>
          </div>
        </div>

        {/* Target Info */}
        <div className="flex items-center gap-6 text-xs text-ink-muted">
          <span><strong>Country:</strong> {country}</span>
          <span><strong>Procedure:</strong> {procedureCode}</span>
          <span><strong>Message:</strong> {messageName}</span>
          <span><strong>Type:</strong> {messageType}</span>
          {schemaVersion && (
            <span className="flex items-center gap-1">
              <strong>Release:</strong>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-[10px] font-semibold">
                {schemaVersion}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Schema Tree */}
        <div className={`${showLivePreview ? "w-[35%]" : "w-1/2"} border-r border-border overflow-auto bg-gray-50 transition-all duration-200`}>
          <SchemaTreeViewer
            schema={schema}
            onSelectPath={handleSelectField}
            selectedPath={selectedPath}
            configData={config}
          />
        </div>

        {/* Centre Panel - Field / Complex Object Config */}
        <div className={`${showLivePreview ? "w-[35%]" : "w-1/2"} overflow-auto bg-white border-r border-border transition-all duration-200`}>
          {(() => {
            console.log('🎯 Right Panel State:', { selectedPath, selectedSchema: !!selectedSchema });
            return selectedPath && selectedSchema;
          })() ? (
            (() => {
              // Check if this is a complex object or leaf field
              const hasProperties = selectedSchema.properties && Object.keys(selectedSchema.properties).length > 0;
              const hasItems = selectedSchema.items !== undefined;
              const isObjectType = selectedSchema.type === 'object';
              const isArrayType = selectedSchema.type === 'array';
              
              const isComplexObject = hasProperties || hasItems || isObjectType || isArrayType;
              
              // Debug logging
              console.log('Selected:', {
                path: selectedPath,
                schema: selectedSchema,
                hasProperties,
                hasItems,
                isObjectType,
                isArrayType,
                isComplexObject
              });
              
              if (isComplexObject) {
                // Show Complex Object Config Panel
                return (
                  <ComplexObjectConfigPanel
                    fieldPath={selectedPath!}
                    fieldSchema={selectedSchema}
                    onSave={(layoutType) => handleGenerateLayout(selectedPath!, selectedSchema, layoutType)}
                    onCancel={handleCancel}
                    layoutHints={config?.layoutHints}
                    rootDefs={schema?.$defs ?? schema?.definitions ?? {}}
                  />
                );
              } else {
                // Show Field Config Panel
                return (
                  <FieldConfigPanel
                    fieldPath={selectedPath!}
                    fieldSchema={selectedSchema}
                    currentConfig={getCurrentFieldConfig()}
                    onConfigChange={(newConfig) => handleFieldConfigChange(selectedPath!, newConfig)}
                    onCancel={handleCancel}
                  />
                );
              }
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-ink mb-2">Nothing Selected</h3>
              <p className="text-xs text-ink-muted max-w-sm">
                Select from the schema tree:
              </p>
              <div className="mt-4 space-y-2 text-xs text-ink-muted">
                <p>📁 <strong>Complex Object</strong> → Configure layout (Panel, TabSheet, Tab, Card)</p>
                <p>📄 <strong>Leaf Field</strong> → Configure field properties</p>
              </div>
              {config && config.fields.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    {config.fields.length} field{config.fields.length !== 1 ? 's' : ''} configured
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Live Preview (visible when toggled) */}
        {showLivePreview && config && schema && (
          <div className="w-[30%] overflow-hidden transition-all duration-200">
            <LivePreviewPanel
              config={config}
              schema={schema}
              target={{ country, procedureCode, messageName, messageType }}
            />
          </div>
        )}
      </div>

      {/* Structure Manager Modal */}
      {showStructureManager && config && (
        <Modal isOpen={showStructureManager} onClose={() => setShowStructureManager(false)} size="xl">
          <ModalHeader onClose={() => setShowStructureManager(false)}>
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-brand" />
              <div>
                <h2 className="text-lg font-bold text-ink">Manage Tabs & Sections</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Organize your form with tabs and sections
                </p>
              </div>
            </div>
          </ModalHeader>
          
          <ModalBody>
            <div className="space-y-6">
              {/* Layout Mode Switcher */}
              <div className="bg-surface-muted rounded-lg p-4 border border-border">
                <label className="block text-sm font-semibold text-ink mb-3">
                  <Layout className="w-4 h-4 inline mr-2" />
                  Layout Mode
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const updatedConfig = { ...config, layout: { ...config.layout, mode: 'single-page' as LayoutMode } };
                      setConfig(updatedConfig);
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      config.layout.mode === 'single-page'
                        ? 'border-brand bg-blue-50 text-brand font-semibold'
                        : 'border-border bg-white text-ink-muted hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">Single Page</div>
                    <div className="text-[10px] mt-1">All fields on one page</div>
                  </button>
                  <button
                    onClick={() => {
                      const updatedConfig = { 
                        ...config, 
                        layout: { ...config.layout, mode: 'tabs' as LayoutMode },
                        tabs: config.tabs || []
                      };
                      setConfig(updatedConfig);
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      config.layout.mode === 'tabs'
                        ? 'border-brand bg-blue-50 text-brand font-semibold'
                        : 'border-border bg-white text-ink-muted hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">Tabs</div>
                    <div className="text-[10px] mt-1">Organize with tabs</div>
                  </button>
                </div>
              </div>

              {/* Tab Manager (shown only if tabs mode) */}
              {config.layout.mode === 'tabs' && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <TabManager
                    config={config}
                    onChange={(updatedConfig) => setConfig(updatedConfig)}
                    onSelectTab={(tabId) => setSelectedTabId(tabId)}
                    selectedTabId={selectedTabId}
                  />
                </div>
              )}

              {/* Single Page Info */}
              {config.layout.mode === 'single-page' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600 text-xl">ℹ️</div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900">Single Page Layout</h4>
                      <p className="text-xs text-blue-700 mt-1">
                        All fields will be displayed on a single scrollable page.
                        Fields are organized by sections. Add fields by selecting them from the schema tree.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={() => setShowStructureManager(false)} variant="primary">
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Preview Modal */}
      {showPreview && config && (
        <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} size="xl" titleId="preview-modal">
          <ModalHeader 
            titleId="preview-modal" 
            title="Form Preview" 
            subtitle="This is how the Declaration tab will look with your configuration"
            icon={<Eye className="w-5 h-5" />}
            onClose={() => setShowPreview(false)}
          />
          
          <ModalBody>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <LayoutRenderer
                  config={config}
                  formData={{}}
                  schema={schema}
                  onChange={(path: string, value: any) => {
                    console.log('Preview field change:', path, value);
                  }}
                  errors={{}}
                />
              </div>
            </div>
            
            {/* Empty State */}
            {(!config.fields || config.fields.filter((f: any) => f.isVisible !== false).length === 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mt-4">
                <p className="text-sm text-gray-600">No visible fields configured yet</p>
                <p className="text-xs text-gray-500 mt-2">Select fields and check "Visible" to include them in the form</p>
              </div>
            )}

            {/* Full JSON */}
            <details className="mt-4">
              <summary className="text-sm font-semibold text-ink cursor-pointer hover:text-brand">
                View Full Configuration JSON
              </summary>
              <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(config, null, 2)}
              </pre>
            </details>
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={() => setShowPreview(false)} variant="primary">
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

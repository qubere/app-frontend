/**
 * Array Item Editor Modal
 * 
 * Modal dialog for editing a single array item with all its fields.
 * Supports nested arrays which are also displayed as grids with drill-down capability.
 */

"use client";

import React, { useState, useRef } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";

interface ArrayItemEditorProps {
  isOpen: boolean;
  onClose: (saved?: boolean) => void;  // Pass saved=true when saving, false/undefined when canceling
  itemSchema: any;
  itemData: any;
  itemIndex: number;
  parentPath: string;
  title: string;
  onChange: (path: string, value: any) => void; // This is the parent's onChange
  onSave: () => void;
  readOnly?: boolean;
  resolveRef: (ref: string) => any;
  ArrayGridView: any; // Pass the grid component to avoid circular deps
  visibleFieldKeys?: string[];
}

export default function ArrayItemEditor({
  isOpen,
  onClose,
  itemSchema,
  itemData,
  itemIndex,
  parentPath,
  title,
  onChange,
  onSave,
  readOnly = false,
  resolveRef,
  ArrayGridView,
  visibleFieldKeys,
}: ArrayItemEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["root"]));
  const [localData, setLocalData] = useState(itemData);
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const localDataRef = useRef(localData);

  // Keep ref in sync with state
  React.useEffect(() => {
    localDataRef.current = localData;
  }, [localData]);

  // Sync local data when itemData changes (important for nested array updates)
  React.useEffect(() => {
    setLocalData(itemData);
  }, [itemData]);

  // Defer parent updates to avoid setState-in-render errors
  React.useEffect(() => {
    if (pendingUpdate) {
      const fullPath = `${parentPath}[${itemIndex}]`;
      onChange(fullPath, localData);
      setPendingUpdate(false);
    }
  }, [pendingUpdate, localData, parentPath, itemIndex, onChange]);

  const getResolvedSchema = (schema: any): any => {
    if (schema.$ref) {
      return resolveRef(schema.$ref);
    }
    return schema;
  };

  // Toggle section expansion
  const toggleSection = (path: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedSections(newExpanded);
  };

  // Generate label from field name
  const generateLabel = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Handle local value change (updates both local state and parent)
  const handleValueChange = (fieldKey: string, value: any) => {
    console.log('🔵 handleValueChange called:', { fieldKey, value });
    // Handle nested paths like "Address.Name" or "Address.Street"
    const keys = fieldKey.split('.');
    
    setLocalData((prev: any) => {
      // Ensure we have a valid object to work with
      if (!prev || typeof prev !== 'object') {
        prev = {};
      }
      
      const updated = { ...prev };
      let current = updated;
      
      // Navigate to the nested location
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        } else {
          current[key] = { ...current[key] };
        }
        current = current[key];
      }
      
      // Set the final value
      current[keys[keys.length - 1]] = value;
      return updated;
    });
    
    // Build full path for parent onChange
    const fullPath = `${parentPath}[${itemIndex}].${fieldKey}`;
    onChange(fullPath, value);
  };

  // Handle nested array change
  const handleNestedArrayChange = (fieldKey: string, newArray: any[]) => {
    setLocalData((prev: any) => {
      const updated = { ...prev, [fieldKey]: newArray };
      return updated;
    });
    // Trigger deferred parent update
    setPendingUpdate(true);
  };

  // Infer field type
  const inferFieldType = (fieldSchema: any): string => {
    const resolved = getResolvedSchema(fieldSchema);
    if (resolved.enum) return "dropdown";
    if (resolved.type === "boolean") return "checkbox";
    if (resolved.type === "number" || resolved.type === "integer") return "number";
    if (resolved.format === "date") return "date";
    if (resolved.format === "date-time") return "datetime";
    if (resolved.type === "string" && resolved.maxLength && resolved.maxLength > 100) return "textarea";
    return "text";
  };

  // Render a single primitive field
  const renderField = (fieldKey: string, fieldSchema: any, isRequired: boolean = false, depth: number = 0) => {
    const resolved = getResolvedSchema(fieldSchema);
    
    // Calculate nesting depth from fieldKey (count dots)
    const nestingLevel = fieldKey.split('.').length - 1;
    const actualDepth = depth + nestingLevel;
    
    // CHECK FOR NESTED OBJECTS FIRST (before primitive rendering)
    if (resolved.properties && Object.keys(resolved.properties).length > 0) {
      const sectionPath = `section-${fieldKey}`;
      const isExpanded = expandedSections.has(sectionPath);
      const propertyCount = Object.keys(resolved.properties).length;
      const fieldLabel = generateLabel(fieldKey.split('.').pop() || fieldKey);
      
      // All objects should be collapsible (no auto-expansion)
      // Separate primitives and complex fields
      const primitives: Array<[string, any]> = [];
      const complexes: Array<[string, any]> = [];

      Object.entries(resolved.properties).forEach(([nestedKey, nestedSchema]: [string, any]) => {
        const resolvedNested = getResolvedSchema(nestedSchema);
        const isObj = resolvedNested.properties && Object.keys(resolvedNested.properties).length > 0;
        const isArr = resolvedNested.type === "array";
        
        if (isObj || isArr) {
          complexes.push([nestedKey, nestedSchema]);
        } else {
          primitives.push([nestedKey, nestedSchema]);
        }
      });

      return (
        <div key={fieldKey} className="col-span-full border border-border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => toggleSection(sectionPath)}
            className="flex items-center gap-3 w-full text-left hover:bg-surface-muted/50 rounded-lg p-2 -m-2 transition-colors"
          >
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isExpanded ? 'bg-primary text-white' : 'bg-surface-muted text-ink-muted'}`}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
            <h4 className="text-base font-semibold text-ink flex-1">
              {fieldLabel}
            </h4>
            <span className="text-xs font-medium text-ink-muted bg-surface-muted px-3 py-1 rounded-full">
              {propertyCount} fields
            </span>
          </button>
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-border space-y-6">
              {/* Primitives in 2-column grid */}
              {primitives.length > 0 && (
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                  {primitives.map(([nestedKey, nestedSchema]) => {
                    const nestedPath = `${fieldKey}.${nestedKey}`;
                    return (
                      <React.Fragment key={nestedPath}>
                        {renderField(nestedPath, nestedSchema, false, actualDepth + 1)}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
              
              {/* Complex fields stacked vertically */}
              {complexes.length > 0 && (
                <div className="space-y-5">
                  {complexes.map(([nestedKey, nestedSchema]) => {
                    const nestedPath = `${fieldKey}.${nestedKey}`;
                    return (
                      <React.Fragment key={nestedPath}>
                        {renderField(nestedPath, nestedSchema, false, actualDepth + 1)}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    
    console.log('⚠️ NOT nested object - will render as primitive:', { fieldKey });

    // CHECK FOR ARRAYS
    if (resolved.type === "array") {
      const itemSchema = resolved.items?.$ref
        ? resolveRef(resolved.items.$ref)
        : resolved.items;
      
      const isComplexArray = itemSchema?.properties && Object.keys(itemSchema.properties).length > 0;
      const fieldPath = `${parentPath}[${itemIndex}].${fieldKey}`;

      if (isComplexArray) {
        return (
          <div key={fieldKey} className="border border-border rounded-lg p-4 col-span-full">
            <ArrayGridView
              fieldName={fieldKey}
              fieldSchema={resolved}
              fieldPath={fieldPath}
              data={localData?.[fieldKey] || []}
              onChange={handleNestedArrayChange}
              parentOnChange={onChange}
              readOnly={readOnly}
              resolveRef={resolveRef}
            />
          </div>
        );
      }
    }

    // NOW HANDLE PRIMITIVES
    // Handle nested paths like "Address.Name"
    const keys = fieldKey.split('.');
    let value = localData;
    for (const key of keys) {
      value = value?.[key];
    }
    
    const fieldType = inferFieldType(resolved);
    const label = generateLabel(keys[keys.length - 1]); // Use only the last part for label
    const isDisabled = readOnly;

    const fieldClasses = "w-full text-sm border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent";

    switch (fieldType) {
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleValueChange(fieldKey, e.target.checked)}
              disabled={isDisabled}
              className="rounded border-border"
            />
            <span className="text-sm text-ink-muted">{label}</span>
            {isRequired && <span className="text-red-600">*</span>}
          </div>
        );

      case "dropdown":
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <select
              value={value || ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value)}
              disabled={isDisabled}
              className={fieldClasses}
            >
              <option value="">Select...</option>
              {resolved.enum?.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      case "number":
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="number"
              value={value ?? ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value === "" ? null : parseFloat(e.target.value))}
              disabled={isDisabled}
              className="text-sm"
              min={resolved.minimum}
              max={resolved.maximum}
            />
          </div>
        );

      case "date":
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value)}
              disabled={isDisabled}
              className="text-sm"
            />
          </div>
        );

      case "datetime":
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="datetime-local"
              value={value || ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value)}
              disabled={isDisabled}
              className="text-sm"
            />
          </div>
        );

      case "textarea":
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <textarea
              value={value || ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value)}
              disabled={isDisabled}
              className={fieldClasses}
              rows={4}
              maxLength={resolved.maxLength}
            />
          </div>
        );

      default:
        return (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="text"
              value={value || ""}
              onChange={(e) => handleValueChange(fieldKey, e.target.value)}
              disabled={isDisabled}
              className="text-sm"
              maxLength={resolved.maxLength}
            />
            {resolved.description && (
              <p className="text-xs text-ink-muted mt-1">{resolved.description}</p>
            )}
          </div>
        );
    }
  };

  // Render modal content
  const renderContent = () => {
    const resolved = getResolvedSchema(itemSchema);
    if (!resolved.properties) {
      return <p className="text-sm text-ink-muted">No fields to display</p>;
    }

    const required = resolved.required || [];

    // Separate fields into primitives and complex types (objects/arrays)
    const primitiveFields: Array<[string, any]> = [];
    const complexFields: Array<[string, any]> = [];

    Object.entries(resolved.properties).forEach(([fieldKey, fieldSchema]: [string, any]) => {
      if (visibleFieldKeys?.length && !visibleFieldKeys.includes(fieldKey)) return;

      const resolvedFieldSchema = getResolvedSchema(fieldSchema);
      const isObject = resolvedFieldSchema.properties && Object.keys(resolvedFieldSchema.properties).length > 0;
      const isArray = resolvedFieldSchema.type === "array";

      if (isObject || isArray) {
        complexFields.push([fieldKey, fieldSchema]);
      } else {
        primitiveFields.push([fieldKey, fieldSchema]);
      }
    });

    return (
      <div className="space-y-6">
        {/* Primitives in 2-column grid */}
        {primitiveFields.length > 0 && (
          <div className="grid grid-cols-3 gap-x-6 gap-y-5">
            {primitiveFields.map(([fieldKey, fieldSchema]) => {
              const isRequired = required.includes(fieldKey);
              const resolvedFieldSchema = getResolvedSchema(fieldSchema);
              return (
                <div key={fieldKey}>
                  {renderField(fieldKey, resolvedFieldSchema, isRequired)}
                </div>
              );
            })}
          </div>
        )}

        {/* Complex fields (objects/arrays) stacked vertically */}
        {complexFields.length > 0 && (
          <div className="space-y-5">
            {complexFields.map(([fieldKey, fieldSchema]) => {
              const isRequired = required.includes(fieldKey);
              const resolvedFieldSchema = getResolvedSchema(fieldSchema);

              // Handle arrays
              if (resolvedFieldSchema.type === "array") {
                const itemSchema = resolvedFieldSchema.items?.$ref
                  ? resolveRef(resolvedFieldSchema.items.$ref)
                  : resolvedFieldSchema.items;
                
                const isComplexArray = itemSchema?.properties && Object.keys(itemSchema.properties).length > 0;
                const fieldPath = `${parentPath}[${itemIndex}].${fieldKey}`;

                if (isComplexArray) {
                  return (
                    <div key={fieldKey} className="border border-border rounded-lg p-4">
                      <ArrayGridView
                        fieldName={fieldKey}
                        fieldSchema={resolvedFieldSchema}
                        fieldPath={fieldPath}
                        data={localData?.[fieldKey] || []}
                        onChange={handleNestedArrayChange}
                        parentOnChange={onChange}
                        readOnly={readOnly}
                        resolveRef={resolveRef}
                      />
                    </div>
                  );
                }
              }

              // Handle objects
              return (
                <div key={fieldKey}>
                  {renderField(fieldKey, resolvedFieldSchema, isRequired)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" className="!max-w-[90vw]">
      <ModalHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            <p className="text-xs text-ink-muted mt-1">
              Complete all required fields • Click to expand sections
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-1 hover:bg-surface-muted rounded"
          >
            <X className="w-5 h-5 text-ink-muted" />
          </button>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="max-h-[85vh] overflow-y-auto px-4">
          {renderContent()}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={() => { 
            // Push complete localData back to parent before saving (use ref to get latest value)
            const fullPath = `${parentPath}[${itemIndex}]`;
            console.log('🟢 ArrayItemEditor Save clicked:', { 
              fullPath, 
              localDataRef: localDataRef.current,
              localData: localData 
            });
            onChange(fullPath, localDataRef.current);
            onSave(); 
            onClose(true); 
          }}>
            Save Changes
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

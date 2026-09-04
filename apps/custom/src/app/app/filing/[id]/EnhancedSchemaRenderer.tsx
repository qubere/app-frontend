/**
 * Enhanced Schema Renderer Component
 * 
 * Fully implements JSON schema rendering including:
 * - Primitive types (string, number, boolean, date)
 * - Complex types (nested objects with expandable sections)
 * - Repeated complex types (arrays of objects with add/remove)
 * - Deeply nested arrays (recursive structures)
 */

"use client";

import React, { useState, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import ArrayGridView from "./ArrayGridView";

interface SchemaField {
  type: string;
  description?: string;
  enum?: string[];
  format?: string;
  items?: any;
  properties?: Record<string, any>;
  required?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  $ref?: string;
  minItems?: number;
  maxItems?: number;
}

interface EnhancedSchemaRendererProps {
  schema: any;
  data: Record<string, any>;
  onChange: (fieldPath: string, value: any) => void;
  onSave?: () => void;
  readOnly?: boolean;
  maxDepth?: number;
}

export default function EnhancedSchemaRenderer({
  schema,
  data,
  onChange,
  onSave,
  readOnly = false,
  maxDepth = 10,
}: EnhancedSchemaRendererProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["root"]));
  const [fullSchema, _setFullSchema] = useState<any>(schema);

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

  // Get nested value from data object (supports array bracket notation)
  const getNestedValue = (obj: any, path: string): any => {
    if (!path) return obj;
    
    // Split path and handle array indices like "Amendment[0].SequenceNumber"
    const pathParts: Array<string | number> = [];
    path.split('.').forEach(part => {
      const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/);
      if (arrayMatch) {
        pathParts.push(arrayMatch[1]); // array name
        pathParts.push(parseInt(arrayMatch[2])); // array index
      } else {
        pathParts.push(part);
      }
    });
    
    // Navigate through the path
    let current = obj;
    for (const key of pathParts) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  };

  // Set nested value in data object
  const setNestedValue = useCallback((path: string, value: any) => {
    onChange(path, value);
  }, [onChange]);

  // Resolve $ref references
  const resolveRef = (ref: string): any => {
    if (!ref || !ref.startsWith("#/")) return null;
    const parts = ref.replace("#/", "").split("/");
    let current = fullSchema;
    for (const part of parts) {
      current = current?.[part];
      if (!current) return null;
    }
    return current;
  };

  // Get resolved schema (handles $ref)
  const getResolvedSchema = (fieldSchema: SchemaField): SchemaField => {
    if (fieldSchema.$ref) {
      const resolved = resolveRef(fieldSchema.$ref);
      return resolved || fieldSchema;
    }
    return fieldSchema;
  };

  // Infer field type from schema
  const inferFieldType = (fieldSchema: SchemaField): string => {
    const resolved = getResolvedSchema(fieldSchema);
    if (resolved.enum) return "dropdown";
    if (resolved.type === "boolean") return "checkbox";
    if (resolved.type === "number" || resolved.type === "integer") return "number";
    if (resolved.format === "date") return "date";
    if (resolved.format === "date-time") return "datetime";
    if (resolved.type === "string" && resolved.maxLength && resolved.maxLength > 100) return "textarea";
    return "text";
  };

  // Generate label from field name
  const generateLabel = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Create default value for a schema type
  const createDefaultValue = (fieldSchema: SchemaField): any => {
    const resolved = getResolvedSchema(fieldSchema);
    
    if (resolved.properties && Object.keys(resolved.properties).length > 0) {
      const obj: any = {};
      Object.keys(resolved.properties).forEach(key => {
        obj[key] = createDefaultValue(resolved.properties![key]);
      });
      return obj;
    }
    
    if (resolved.type === "array") {
      return [];
    }
    
    if (resolved.type === "boolean") return false;
    if (resolved.type === "number" || resolved.type === "integer") return 0;
    if (resolved.type === "string") return "";
    
    return null;
  };

  // Render a single primitive field
  const renderField = (
    fieldName: string,
    fieldSchema: SchemaField,
    fieldPath: string,
    isRequired: boolean,
    _depth: number
  ) => {
    const resolved = getResolvedSchema(fieldSchema);
    const value = getNestedValue(data, fieldPath);
    const fieldType = inferFieldType(resolved);
    const isDisabled = readOnly;
    const label = generateLabel(fieldName);

    const fieldClasses = "w-full text-xs border border-border rounded px-2 py-1.5 focus:ring-2 focus:ring-primary focus:border-transparent";

    switch (fieldType) {
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => setNestedValue(fieldPath, e.target.checked)}
              disabled={isDisabled}
              className="rounded border-border"
            />
            <span className="text-xs text-ink-muted">{label}</span>
            {isRequired && <span className="text-red-600">*</span>}
          </div>
        );

      case "dropdown":
        return (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <select
              value={value || ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value)}
              disabled={isDisabled}
              className={fieldClasses}
            >
              <option value="">Select...</option>
              {resolved.enum?.map((option) => (
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
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="number"
              value={value ?? ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value === "" ? null : parseFloat(e.target.value))}
              disabled={isDisabled}
              className="text-xs"
              min={resolved.minimum}
              max={resolved.maximum}
            />
          </div>
        );

      case "date":
        return (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value)}
              disabled={isDisabled}
              className="text-xs"
            />
          </div>
        );

      case "datetime":
        return (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="datetime-local"
              value={value || ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value)}
              disabled={isDisabled}
              className="text-xs"
            />
          </div>
        );

      case "textarea":
        return (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <textarea
              value={value || ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value)}
              disabled={isDisabled}
              className={fieldClasses}
              rows={3}
              maxLength={resolved.maxLength}
            />
          </div>
        );

      default:
        return (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              {label}
              {isRequired && <span className="text-red-600 ml-1">*</span>}
            </label>
            <Input
              type="text"
              value={value || ""}
              onChange={(e) => setNestedValue(fieldPath, e.target.value)}
              disabled={isDisabled}
              className="text-xs"
              maxLength={resolved.maxLength}
            />
            {resolved.description && (
              <p className="text-[10px] text-ink-muted mt-1">{resolved.description}</p>
            )}
          </div>
        );
    }
  };

  // Render array of primitives (strings, numbers, etc.)
  const renderPrimitiveArray = (
    fieldName: string,
    fieldSchema: SchemaField,
    fieldPath: string,
    depth: number
  ) => {
    const resolved = getResolvedSchema(fieldSchema);
    const itemSchema = resolved.items;
    const values: any[] = getNestedValue(data, fieldPath) || [];
    const label = generateLabel(fieldName);

    const addItem = () => {
      const newValue = createDefaultValue(itemSchema);
      const newArray = [...values, newValue];
      setNestedValue(fieldPath, newArray);
    };

    const removeItem = (index: number) => {
      const newArray = values.filter((_, i) => i !== index);
      setNestedValue(fieldPath, newArray);
    };

    return (
      <div className="border border-border rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-medium text-ink">{label}</h5>
          {!readOnly && (
            <Button
              onClick={addItem}
              size="sm"
              variant="outline"
              className="text-xs h-7"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Item
            </Button>
          )}
        </div>

        {values.length === 0 ? (
          <p className="text-xs text-ink-muted italic">No items added yet</p>
        ) : (
          <div className="space-y-2">
            {values.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  {renderField(
                    `Item ${index + 1}`,
                    itemSchema,
                    `${fieldPath}[${index}]`,
                    false,
                    depth
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeItem(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render array of complex objects (using grid view with modal editing)
  const renderComplexArray = (
    fieldName: string,
    fieldSchema: SchemaField,
    fieldPath: string,
    _depth: number
  ) => {
    const resolved = getResolvedSchema(fieldSchema);
    const values: any[] = getNestedValue(data, fieldPath) || [];

    // Handle array change (when items are added/removed/edited from grid)
    const handleArrayChange = (fieldKey: string, newArray: any[]) => {
      setNestedValue(fieldPath, newArray);
    };

    return (
      <div className="mb-3">
        <ArrayGridView
          fieldName={fieldName}
          fieldSchema={resolved}
          fieldPath={fieldPath}
          data={values}
          onChange={handleArrayChange}
          parentOnChange={onChange} // Pass parent's onChange for nested field edits
          readOnly={readOnly}
          resolveRef={resolveRef}
        />
      </div>
    );
  };

  // Render nested object
  const renderObject = (
    objSchema: any,
    path: string,
    name: string,
    depth: number = 0,
    showHeader: boolean = true
  ): React.ReactNode => {
    console.log('🟦 renderObject called:', { path, name, depth, showHeader, propertiesCount: objSchema.properties ? Object.keys(objSchema.properties).length : 0 });
    
    if (depth > maxDepth) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Maximum nesting depth reached. Please configure this section via UI Config Editor.
        </div>
      );
    }

    const resolved = getResolvedSchema(objSchema);
    if (!resolved.properties) {
      console.warn('⚠️ renderObject: No properties found!', { path, name, resolved });
      return null;
    }

    const required = resolved.required || [];
    const isExpanded = expandedSections.has(path);

    const content = (
      <>
        {/* Section header with expand/collapse */}
        {showHeader && (
          <button
            onClick={() => toggleSection(path)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-ink-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ink-muted" />
            )}
            <h4 className="text-sm font-semibold text-ink">
              {name ? generateLabel(name) : "Fields"}
            </h4>
          </button>
        )}

        {/* Section content */}
        {(isExpanded || !showHeader) && (() => {
          // Separate fields into primitives and complex types
          const primitiveFields: Array<[string, any]> = [];
          const complexFields: Array<[string, any]> = [];

          Object.entries(resolved.properties).forEach(([fieldName, fieldSchema]: [string, any]) => {
            const resolvedFieldSchema = getResolvedSchema(fieldSchema);
            const isObject = resolvedFieldSchema.properties && Object.keys(resolvedFieldSchema.properties).length > 0;
            const isArray = resolvedFieldSchema.type === "array";

            if (isObject || isArray) {
              complexFields.push([fieldName, fieldSchema]);
            } else {
              primitiveFields.push([fieldName, fieldSchema]);
            }
          });

          return (
            <div className={`space-y-6 ${showHeader ? 'pl-6' : ''}`}>
              {/* Primitives in 2-column grid */}
              {primitiveFields.length > 0 && (
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                  {primitiveFields.map(([fieldName, fieldSchema]) => {
                    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
                    const isRequired = required.includes(fieldName);
                    const resolvedFieldSchema = getResolvedSchema(fieldSchema);

                    return (
                      <div key={fieldPath}>
                        {renderField(fieldName, resolvedFieldSchema, fieldPath, isRequired, depth)}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Complex fields (objects/arrays) stacked vertically */}
              {complexFields.length > 0 && (
                <div className="space-y-5">
                  {complexFields.map(([fieldName, fieldSchema]) => {
                    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
                    const resolvedFieldSchema = getResolvedSchema(fieldSchema);

                    // DEBUG: Log every field being processed
                    if (fieldName === 'Acquirer' || fieldName === 'Owner') {
                      console.warn('⚠️ PROCESSING PARTY FIELD:', fieldName);
                      console.warn('   Original schema:', fieldSchema);
                      console.warn('   Resolved schema:', resolvedFieldSchema);
                      console.warn('   Has $ref?', !!fieldSchema.$ref);
                      console.warn('   Has properties?', !!resolvedFieldSchema.properties);
                      if (resolvedFieldSchema.properties) {
                        console.warn('   Property keys:', Object.keys(resolvedFieldSchema.properties));
                      }
                    }

                    // Handle nested objects
                    if (resolvedFieldSchema.properties && Object.keys(resolvedFieldSchema.properties).length > 0) {
                      const currentValue = getNestedValue(data, fieldPath);
                      
                      console.log('🔍 Nested object detected:', { 
                        fieldName, 
                        fieldPath, 
                        hasProperties: !!resolvedFieldSchema.properties,
                        propertyCount: Object.keys(resolvedFieldSchema.properties).length,
                        currentValue: currentValue ? 'exists' : 'null'
                      });
                      
                      const propertyValues = Object.values(resolvedFieldSchema.properties);
                      const isContainer = propertyValues.length > 5 && 
                                         propertyValues.every((prop: any) => prop.$ref || (prop.type === "object" && prop.properties));
                      
                      console.log('🔍 Container check:', { fieldName, isContainer, propertyCount: propertyValues.length });
                      
                      if (isContainer || (currentValue !== null && currentValue !== undefined)) {
                        return (
                          <div key={fieldPath}>
                            <div className="border border-border rounded-lg p-3">
                              {!isContainer && (
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-ink">{generateLabel(fieldName)}</span>
                                  {!readOnly && (
                                    <button
                                      onClick={() => {
                                        setNestedValue(fieldPath, null);
                                      }}
                                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" />
                                      Remove
                                    </button>
                                  )}
                                </div>
                              )}
                              {renderObject(resolvedFieldSchema, fieldPath, fieldName, depth + 1, !isContainer)}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={fieldPath}>
                          <div className="border border-border border-dashed rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-ink-muted">{generateLabel(fieldName)}</span>
                              {!readOnly && (
                                <button
                                  onClick={() => {
                                    const defaultVal = createDefaultValue(resolvedFieldSchema);
                                    setNestedValue(fieldPath, defaultVal);
                                  }}
                                  className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add {generateLabel(fieldName)}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Handle arrays
                    if (resolvedFieldSchema.type === "array") {
                      const itemSchema = resolvedFieldSchema.items?.$ref
                        ? resolveRef(resolvedFieldSchema.items.$ref)
                        : resolvedFieldSchema.items;

                      const isPrimitiveArray = itemSchema && (
                        itemSchema.type === "string" ||
                        itemSchema.type === "number" ||
                        itemSchema.type === "integer" ||
                        itemSchema.type === "boolean"
                      );

                      return (
                        <div key={fieldPath}>
                          {isPrimitiveArray
                            ? renderPrimitiveArray(fieldName, resolvedFieldSchema, fieldPath, depth)
                            : renderComplexArray(fieldName, resolvedFieldSchema, fieldPath, depth)}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </>
    );

    return showHeader ? (
      <div key={path} className="mb-3">
        {content}
      </div>
    ) : content;
  };

  // Unwrap root transaction wrapper if exists
  const getEffectiveSchema = () => {
    if (schema.properties) {
      const rootKeys = Object.keys(schema.properties);
      
      // Check for ImportDeclaration or ExportDeclaration wrapper
      if (rootKeys.length === 1 && 
          (rootKeys[0] === "ImportDeclaration" || rootKeys[0] === "ExportDeclaration")) {
        return schema.properties[rootKeys[0]];
      }
    }
    
    return schema;
  };

  const effectiveSchema = getEffectiveSchema();

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Enhanced Schema View:</strong> Auto-generated form from canonical schema. 
          All field types are supported including nested arrays and complex objects.
        </p>
      </div>

      {/* Render schema fields */}
      {effectiveSchema.properties && (
        <div>
          {Object.entries(effectiveSchema.properties).map(([sectionName, sectionSchema]: [string, any]) => {
            const resolved = getResolvedSchema(sectionSchema);
            
            // Handle object sections
            if (resolved.properties && Object.keys(resolved.properties).length > 0) {
              return (
                <div key={sectionName} className="border border-border rounded-lg p-4 mb-4 bg-white">
                  {renderObject(resolved, sectionName, sectionName, 0)}
                </div>
              );
            }
            
            // Handle array sections
            if (resolved.type === "array") {
              return (
                <div key={sectionName} className="border border-border rounded-lg p-4 mb-4 bg-white">
                  {renderComplexArray(sectionName, resolved, sectionName, 0)}
                </div>
              );
            }
            
            return null;
          })}
        </div>
      )}

      {/* Save button */}
      {onSave && !readOnly && (
        <div className="flex justify-end pt-4 border-t border-border sticky bottom-0 bg-white">
          <Button onClick={onSave} size="sm">
            Save Declaration
          </Button>
        </div>
      )}
    </div>
  );
}

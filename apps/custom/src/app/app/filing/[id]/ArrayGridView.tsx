/**
 * Array Grid View Component
 * 
 * Displays array of complex objects as a grid/table.
 * Clicking a row opens a modal to edit that item.
 * Supports nested arrays which recursively use the same grid pattern.
 */

"use client";

import React, { useState } from "react";
import { Plus, Trash2, Edit2, Eye, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ArrayItemEditor from "./ArrayItemEditor";

interface ArrayGridViewProps {
  fieldName: string;
  fieldSchema: any;
  fieldPath: string;
  data: any[];
  onChange: (fieldKey: string, newArray: any[]) => void; // Callback when array changes
  readOnly?: boolean;
  resolveRef: (ref: string) => any;
  parentOnChange?: (path: string, value: any) => void; // Parent's direct onChange for nested edits
  visibleFieldKeys?: string[]; // Optional allow-list for configured fields inside this array item
}

export default function ArrayGridView({
  fieldName,
  fieldSchema,
  fieldPath,
  data,
  onChange,
  readOnly = false,
  resolveRef,
  parentOnChange,
  visibleFieldKeys,
}: ArrayGridViewProps) {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempItemIndex, setTempItemIndex] = useState<number | null>(null); // Index of temporary item (removed on cancel)
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  // Get resolved schema
  const getResolvedSchema = (schema: any): any => {
    if (!schema) return null; // Handle undefined/null
    if (schema.$ref) {
      return resolveRef(schema.$ref) || schema;
    }
    return schema;
  };

  const resolved = getResolvedSchema(fieldSchema);
  const itemSchema = resolved?.items?.$ref
    ? resolveRef(resolved.items.$ref)
    : resolved?.items;
  const resolvedItemSchema = getResolvedSchema(itemSchema);

  // Generate label from field name
  const generateLabel = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Get display columns (first few fields for table view)
  const getDisplayColumns = (): string[] => {
    if (!resolvedItemSchema?.properties) return [];
    const allFields = Object.keys(resolvedItemSchema.properties);
    const allowed = visibleFieldKeys?.filter((key) => allFields.includes(key));
    if (allowed?.length) return allowed.slice(0, Math.min(5, allowed.length));
    // Show first 4-5 fields in grid, or all if fewer
    return allFields.slice(0, Math.min(5, allFields.length));
  };

  // Get display value for a field
  const getDisplayValue = (item: any, fieldKey: string): string => {
    const value = item?.[fieldKey];
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return "[Object]";
    if (Array.isArray(value)) return `[${value.length} items]`;
    return String(value);
  };

  // Create default value for new item
  const createDefaultValue = (schema: any): any => {
    const resolved = getResolvedSchema(schema);
    
    if (resolved.properties && Object.keys(resolved.properties).length > 0) {
      const obj: any = {};
      const propertyKeys = Object.keys(resolved.properties);
      const keysToCreate = visibleFieldKeys?.filter((key) => propertyKeys.includes(key)) ?? propertyKeys;
      keysToCreate.forEach(key => {
        obj[key] = createDefaultValue(resolved.properties[key]);
      });
      return obj;
    }
    
    if (resolved.type === "array") return [];
    if (resolved.type === "boolean") return false;
    if (resolved.type === "number" || resolved.type === "integer") return 0;
    if (resolved.type === "string") return "";
    
    return null;
  };

  // Add new item - add to array immediately but mark as temporary
  const handleAddItem = () => {
    const newItem = createDefaultValue(itemSchema);
    const newArray = [...data, newItem];
    onChange(fieldName, newArray);
    const newIndex = newArray.length - 1;
    setSelectedItemIndex(newIndex);
    setTempItemIndex(newIndex); // Mark as temporary
    setIsModalOpen(true);
  };

  // Remove item
  const handleRemoveItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    const newArray = data.filter((_, i) => i !== index);
    onChange(fieldName, newArray);
  };

  // Open item for editing
  const handleRowClick = (index: number) => {
    setSelectedItemIndex(index);
    setTempItemIndex(null); // Editing existing item, not temporary
    setIsModalOpen(true);
  };

  // Handle item change from modal
  const handleItemChange = (path: string, value: any) => {
    // The modal passes us full paths like "Amendment[0].Documents[1].Name"
    // We need to call parent's onChange if available
    if (parentOnChange) {
      parentOnChange(path, value);
    }
  };

  // Handle save from modal
  const handleModalSave = () => {
    // Clear the temporary flag - item is now permanent
    setTempItemIndex(null);
  };

  const displayColumns = getDisplayColumns();
  const label = generateLabel(fieldName);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <div 
        className="flex items-center justify-between bg-surface-muted px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-ink-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ink-muted" />
          )}
          <h5 className="text-sm font-semibold text-ink">{label}</h5>
          <span className="text-xs text-ink-muted">
            ({data.length} {data.length === 1 ? 'item' : 'items'})
          </span>
        </div>
        {!readOnly && (
          <Button
            onClick={(e) => {
              e.stopPropagation(); // Prevent collapse/expand when clicking Add Item
              handleAddItem();
            }}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Item
          </Button>
        )}
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Grid/Table */}
          {data.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-ink-muted">No items yet</p>
              {!readOnly && (
                <p className="text-xs text-ink-muted mt-1">Click "Add Item" to create one</p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-ink uppercase tracking-wider w-12">
                  #
                </th>
                {displayColumns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left text-xs font-semibold text-ink uppercase tracking-wider"
                  >
                    {generateLabel(col)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-ink uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {data.map((item, index) => (
                <tr
                  key={index}
                  onDoubleClick={() => handleRowClick(index)}
                  className="hover:bg-surface-muted/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3 text-xs text-ink-muted">
                    {index + 1}
                  </td>
                  {displayColumns.map((col) => (
                    <td key={col} className="px-3 py-3 text-sm text-ink">
                      {getDisplayValue(item, col)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(index);
                        }}
                        className="p-1.5 hover:bg-primary/10 rounded text-primary"
                        title="Edit item"
                      >
                        {readOnly ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <Edit2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {!readOnly && (
                        <button
                          onClick={(e) => handleRemoveItem(index, e)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-600"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </div>
      )}

      {/* Item Editor Modal */}
      {selectedItemIndex !== null && (
        <ArrayItemEditor
          isOpen={isModalOpen}
          onClose={(saved = false) => {
            const isTempItem = tempItemIndex === selectedItemIndex;
            console.log('🟠 ArrayGridView onClose:', { 
              saved,
              isTempItem, 
              selectedItemIndex, 
              tempItemIndex,
              dataLength: data.length,
              fieldName,
              fieldPath
            });
            
            // Remove item if it was temporary AND user didn't save
            if (isTempItem && !saved) {
              const newArray = data.filter((_, i) => i !== selectedItemIndex);
              console.log('🔴 Removing temporary item. New array length:', newArray.length);
              onChange(fieldName, newArray);
            }
            
            setIsModalOpen(false);
            setSelectedItemIndex(null);
            setTempItemIndex(null);
          }}
          itemSchema={itemSchema}
          itemData={data[selectedItemIndex]}
          itemIndex={selectedItemIndex}
          parentPath={fieldPath}
          title={`${label} - ${tempItemIndex === selectedItemIndex ? 'New Item' : `Item ${selectedItemIndex + 1}`}`}
          onChange={handleItemChange}
          onSave={handleModalSave}
          readOnly={readOnly}
          resolveRef={resolveRef}
          ArrayGridView={ArrayGridView} // Pass self for recursive rendering
          visibleFieldKeys={visibleFieldKeys}
        />
      )}
    </div>
  );
}

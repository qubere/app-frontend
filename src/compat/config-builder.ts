import type { FilingUIConfigData, FieldConfig, UITab, UISection } from './ui-config.types';
import * as canonical from '../lib/ui-config/config-builder';

export interface CreateConfigOptions {
  country: string;
  procedure: string;
  message: string;
  title?: string;
  description?: string;
  layoutMode?: any;
  tags?: string[];
}

export function createEmptyConfig(options: CreateConfigOptions): FilingUIConfigData {
  const config = canonical.createEmptyConfig(options as any) as unknown as FilingUIConfigData;
  if (options.tags?.length) {
    config.metadata = { ...config.metadata, tags: options.tags };
  }
  return config;
}

export function addTab(config: FilingUIConfigData, options: Partial<UITab>): FilingUIConfigData {
  const tabId = options.tabId ?? options.id ?? `tab-${Date.now()}`;
  canonical.addTab(config as any, {
    tabId,
    label: options.label ?? options.title ?? tabId,
    icon: options.icon,
    tabOrder: options.tabOrder ?? options.displayOrder,
    description: options.description,
  });
  const created = config.tabs?.find((tab) => tab.tabId === tabId);
  if (created) {
    created.id = tabId;
    created.title = created.label;
    created.displayOrder = created.tabOrder;
    if (options.isVisible !== undefined) created.isVisible = options.isVisible;
  }
  return { ...config, tabs: config.tabs ? [...config.tabs] : [] };
}

export function removeTab(config: FilingUIConfigData, tabId: string): FilingUIConfigData {
  canonical.removeTab(config as any, tabId);
  return { ...config, tabs: config.tabs ? [...config.tabs] : [] };
}

export function updateTab(config: FilingUIConfigData, tabId: string, updates: Partial<UITab>): FilingUIConfigData {
  const canonicalUpdates: any = { ...updates };
  if (updates.title !== undefined && updates.label === undefined) canonicalUpdates.label = updates.title;
  if (updates.displayOrder !== undefined && updates.tabOrder === undefined) canonicalUpdates.tabOrder = updates.displayOrder;
  if (updates.id !== undefined && updates.tabId === undefined) canonicalUpdates.tabId = updates.id;
  const updated = canonical.updateTab(config as any, tabId, canonicalUpdates) as unknown as FilingUIConfigData;
  const tab = updated.tabs?.find((item) => item.tabId === tabId || item.id === tabId);
  if (tab) {
    tab.id = tab.tabId ?? tab.id;
    tab.title = tab.label ?? tab.title;
    tab.displayOrder = tab.tabOrder ?? tab.displayOrder;
  }
  return updated;
}

export function addSection(config: FilingUIConfigData, options: any): FilingUIConfigData {
  canonical.addSection(config as any, {
    sectionId: options.sectionId ?? options.id ?? `section-${Date.now()}`,
    title: options.title ?? options.label ?? 'Section',
    layout: options.layout,
    columns: options.columns,
    sectionOrder: options.sectionOrder ?? options.displayOrder,
    isCollapsible: options.isCollapsible,
    defaultExpanded: options.defaultExpanded,
    description: options.description,
    tabId: options.tabId,
  });
  return { ...config, sections: [...config.sections] };
}

export function addField(config: FilingUIConfigData, field: any): FilingUIConfigData {
  canonical.addField(config as any, field as any);
  return { ...config, fields: [...config.fields] };
}

export function updateField(config: FilingUIConfigData, fieldPath: string, updates: Partial<FieldConfig>): FilingUIConfigData {
  return canonical.updateField(config as any, fieldPath, updates as any) as unknown as FilingUIConfigData;
}

export function getField(config: FilingUIConfigData, fieldPath: string): FieldConfig | undefined {
  return canonical.getField(config as any, fieldPath) as unknown as FieldConfig | undefined;
}

export function getFieldsBySection(config: FilingUIConfigData, sectionId: string): FieldConfig[] {
  return canonical.getFieldsBySection(config as any, sectionId) as unknown as FieldConfig[];
}

export type AddTabOptions = Partial<UITab>;
export type AddSectionOptions = Partial<UISection>;

/**
 * Registry-Driven Field State & Exception Generator — LLM Universal Field Hydration
 *
 * Generates document missing/conflict exception items dynamically from registry
 * applicability rules and required rules, replacing hard-coded exception lists.
 */

import type { CanonicalFieldDefinition } from "../types/canonicalRegistry";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../registry/canonicalRegistryV1";

export interface FieldExceptionDescriptor {
  fieldKey: string;
  label: string;
  exceptionType: "MISSING_REQUIRED_FIELD" | "FIELD_CONFLICT" | "UNREADABLE_FIELD";
  severity: "Info" | "Warning" | "Critical";
  reason: string;
}

export class FieldStateGenerator {
  /**
   * Evaluates missing required field exceptions for a document context.
   */
  public static generateDocumentExceptions(
    documentType: string,
    extractedCanonicalKeys: Set<string>
  ): FieldExceptionDescriptor[] {
    const exceptions: FieldExceptionDescriptor[] = [];

    for (const [key, definition] of Object.entries(CANONICAL_FIELD_REGISTRY_V1)) {
      if (!definition.sourceDocumentTypes.includes(documentType)) {
        continue;
      }

      const isRequired = Boolean(definition.requiredRule);
      const isExtracted = extractedCanonicalKeys.has(key);

      if (isRequired && !isExtracted) {
        exceptions.push({
          fieldKey: key,
          label: definition.label,
          exceptionType: "MISSING_REQUIRED_FIELD",
          severity: definition.riskClass === "CONSEQUENTIAL" ? "Critical" : "Warning",
          reason: `Required field '${definition.label}' is missing from document '${documentType}'.`,
        });
      }
    }

    return exceptions;
  }
}

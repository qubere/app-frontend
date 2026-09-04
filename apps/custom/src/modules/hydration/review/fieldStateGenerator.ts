/**
 * Registry-Driven Field State & Exception Generator — LLM Universal Field Hydration
 *
 * Generates document missing/conflict exception items dynamically from registry
 * applicability rules and required rules, replacing hard-coded exception lists.
 */

import { CANONICAL_FIELD_REGISTRY_V1 } from "../registry/canonicalRegistryV1";

export interface FieldExceptionDescriptor {
  fieldKey: string;
  label: string;
  exceptionType: "MISSING_REQUIRED_FIELD" | "FIELD_CONFLICT" | "UNREADABLE_FIELD";
  severity: "Info" | "Warning" | "Critical";
  reason: string;
}

export interface CandidateFieldInfo {
  hasConflict?: boolean;
  isUnreadable?: boolean;
}

export class FieldStateGenerator {
  /**
   * Evaluates missing, conflicting, and unreadable field exceptions for a document context.
   */
  public static generateDocumentExceptions(
    documentType: string,
    extractedCanonicalKeys: Set<string>,
    candidatesMap?: Map<string, CandidateFieldInfo>
  ): FieldExceptionDescriptor[] {
    const exceptions: FieldExceptionDescriptor[] = [];

    for (const [key, definition] of Object.entries(CANONICAL_FIELD_REGISTRY_V1)) {
      const isApplicable =
        definition.sourceDocumentTypes.includes(documentType) ||
        definition.sourceDocumentTypes.includes("*");
      if (!isApplicable) {
        continue;
      }

      const isRequired = Boolean(definition.requiredRule);
      const isExtracted = extractedCanonicalKeys.has(key);
      const candidateInfo = candidatesMap?.get(key);

      // B3 check: Emit FIELD_CONFLICT and UNREADABLE_FIELD exceptions
      if (candidateInfo?.hasConflict) {
        exceptions.push({
          fieldKey: key,
          label: definition.label,
          exceptionType: "FIELD_CONFLICT",
          severity: "Critical",
          reason: `Contradictory values detected across documents for field '${definition.label}'.`,
        });
      } else if (candidateInfo?.isUnreadable) {
        exceptions.push({
          fieldKey: key,
          label: definition.label,
          exceptionType: "UNREADABLE_FIELD",
          severity: "Warning",
          reason: `Extracted value for field '${definition.label}' is unreadable.`,
        });
      } else if (isRequired && !isExtracted) {
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

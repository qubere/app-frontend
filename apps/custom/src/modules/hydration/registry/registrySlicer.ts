/**
 * Registry Slicer API — Contextual slice query service for Canonical Field Registry
 *
 * Selects applicable field definitions for a given document type, product entitlement,
 * jurisdiction, and requested field set. Enforces immutable versions and fails closed
 * on unknown field keys.
 */

import type { CanonicalFieldDefinition, ProductEntitlement } from "../types/canonicalRegistry";
import { CANONICAL_FIELD_REGISTRY_V1, REGISTRY_VERSION_V1 } from "./canonicalRegistryV1";
import { CanonicalFieldDefinitionSchema } from "../schemas/registrySchemas";
import { DomainError } from "../../../lib/api/error";

export interface RegistrySliceFilter {
  documentType?: string;
  product?: ProductEntitlement;
  jurisdiction?: string;
  fieldKeys?: string[];
  registryVersion?: string;
}

export class RegistrySlicer {
  private static registryVersion = REGISTRY_VERSION_V1;

  /**
   * Retrieves a filtered slice of canonical field definitions.
   * Throws an Error (fails closed) if an explicit fieldKey is not registered.
   */
  public static getSlice(filter: RegistrySliceFilter = {}): Record<string, CanonicalFieldDefinition> {
    const activeVersion = filter.registryVersion || this.registryVersion;
    if (activeVersion !== REGISTRY_VERSION_V1) {
      throw new DomainError(
        `Unsupported registry version: ${activeVersion}. Active version is ${REGISTRY_VERSION_V1}.`,
        "UNSUPPORTED_VERSION",
        400
      );
    }

    const result: Record<string, CanonicalFieldDefinition> = {};

    // Handle explicit requested field keys
    if (filter.fieldKeys && filter.fieldKeys.length > 0) {
      for (const key of filter.fieldKeys) {
        const definition = CANONICAL_FIELD_REGISTRY_V1[key];
        if (!definition) {
          throw new DomainError(
            `FAIL_CLOSED: Unknown or unregistered canonical field key '${key}'.`,
            "FAIL_CLOSED",
            400
          );
        }
        // Validate definition with runtime Zod schema
        CanonicalFieldDefinitionSchema.parse(definition);
        result[key] = definition;
      }
      return result;
    }

    // Filter by context
    for (const [key, definition] of Object.entries(CANONICAL_FIELD_REGISTRY_V1)) {
      CanonicalFieldDefinitionSchema.parse(definition);

      if (filter.documentType && !definition.sourceDocumentTypes.includes(filter.documentType)) {
        continue;
      }

      if (filter.product && !definition.products.includes(filter.product)) {
        continue;
      }

      if (
        filter.jurisdiction &&
        !definition.jurisdictions.includes("*") &&
        !definition.jurisdictions.includes(filter.jurisdiction)
      ) {
        continue;
      }

      result[key] = definition;
    }

    return result;
  }

  /**
   * Checks if a field key is registered in the V1 registry.
   */
  public static isRegisteredKey(fieldKey: string): boolean {
    return Boolean(CANONICAL_FIELD_REGISTRY_V1[fieldKey]);
  }

  /**
   * Returns the current active immutable registry version.
   */
  public static getActiveVersion(): string {
    return this.registryVersion;
  }
}

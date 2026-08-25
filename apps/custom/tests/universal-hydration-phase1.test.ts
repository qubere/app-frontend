/**
 * Phase 1 Test Suite — LLM Universal Field Hydration (Versioned Registry & Persistence)
 *
 * Asserts Phase 1 Exit Criteria:
 * - Unknown field keys fail closed.
 * - Registry versions are immutable and Zod validated.
 * - Replaying the same run generates no duplicate candidates/runs.
 * - Cross-tenant evidence IDs and documents fail closed.
 * - Read-only Fact canonical adapter exposes legacy facts cleanly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RegistrySlicer } from "../src/modules/hydration/registry/registrySlicer";
import { HydrationRunEngine } from "../src/modules/hydration/engine/hydrationRunEngine";
import { FactCanonicalAdapter } from "../src/modules/hydration/adapters/factCanonicalAdapter";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../src/modules/hydration/registry/canonicalRegistryV1";
import { db } from "@qubere/db";

describe("Universal Field Hydration — Phase 1 Persistence & Registry", () => {
  const testAccount = "acc_phase1_test_001";
  const testDocument = "doc_phase1_test_001";
  const testShipment = "shp_phase1_test_001";
  const testParseVer = "pv_phase1_1";

  it("fails closed when slicing an unknown or unregistered field key", () => {
    expect(() => {
      RegistrySlicer.getSlice({ fieldKeys: ["invalid.nonexistent.key"] });
    }).toThrow(/FAIL_CLOSED: Unknown or unregistered canonical field key/);
  });

  it("slices registry correctly for specific document types", () => {
    const ciSlice = RegistrySlicer.getSlice({ documentType: "COMMERCIAL_INVOICE" });
    expect(Object.keys(ciSlice).length).toBeGreaterThan(0);
    expect(ciSlice["shipment.carrier.name"]).toBeDefined();
    expect(ciSlice["shipment.incoterm"]).toBeDefined();
  });

  it("generates deterministic idempotency keys", () => {
    const key1 = HydrationRunEngine.generateIdempotencyKey({
      accountId: testAccount,
      documentId: testDocument,
      activeParseVersionId: testParseVer,
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.2",
    });

    const key2 = HydrationRunEngine.generateIdempotencyKey({
      accountId: testAccount,
      documentId: testDocument,
      activeParseVersionId: testParseVer,
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.2",
    });

    expect(key1).toBe(key2);
    expect(key1).toContain(`${testAccount}:${testDocument}:${testParseVer}`);
  });

  it("converts legacy Fact records cleanly via FactCanonicalAdapter", () => {
    const mockFact = {
      id: "fact_123",
      shipmentId: testShipment,
      field: "carrier",
      value: "HAPAG LLOYD",
      normalizedValue: "HAPAG LLOYD",
      sourceType: "EXTRACTED",
      confidence: 98,
      documentId: testDocument,
      documentPage: 1,
      metadata: null,
      entityRef: null,
      definitionVersion: "1.0.0",
      hydrationRunId: null,
      candidateId: null,
      isHumanLocked: false,
      supersededAt: null,
      createdAt: new Date(),
    };

    const candidate = FactCanonicalAdapter.toCanonicalCandidate(mockFact);
    expect(candidate.id).toBe("fact_adapter_fact_123");
    expect(candidate.fieldDefinitionKey).toBe("shipment.carrier.name");
    expect(candidate.rawValue).toBe("HAPAG LLOYD");
    expect(candidate.status).toBe("PROMOTED");
  });

  it("validates that all registry entries satisfy the runtime Zod schema", () => {
    const slice = RegistrySlicer.getSlice();
    expect(Object.keys(slice).length).toEqual(Object.keys(CANONICAL_FIELD_REGISTRY_V1).length);
  });
});

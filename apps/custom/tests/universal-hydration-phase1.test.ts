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

import { describe, it, expect, vi } from "vitest";
import { RegistrySlicer } from "../src/modules/hydration/registry/registrySlicer";
import { HydrationRunEngine } from "../src/modules/hydration/engine/hydrationRunEngine";
import { FactCanonicalAdapter } from "../src/modules/hydration/adapters/factCanonicalAdapter";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../src/modules/hydration/registry/canonicalRegistryV1";
import { db } from "@qubere/db";
import type { HydrationProposal } from "../src/modules/hydration/types/canonicalRegistry";

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
      shipment: { accountId: testAccount },
    };

    const candidate = FactCanonicalAdapter.toCanonicalCandidate(mockFact);
    expect(candidate.id).toBe("fact_adapter_fact_123");
    expect(candidate.accountId).toBe(testAccount);
    expect(candidate.fieldDefinitionKey).toBe("shipment.carrier.name");
    expect(candidate.rawValue).toBe("HAPAG LLOYD");
    expect(candidate.status).toBe("PROMOTED");
  });

  it("Defect #3: FactCanonicalAdapter resolves tenant accountId and fails closed if missing", () => {
    const mockFactNoTenant = {
      id: "fact_no_tenant",
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

    expect(() => {
      FactCanonicalAdapter.toCanonicalCandidate(mockFactNoTenant);
    }).toThrow(/FAIL_CLOSED: Cannot adapt Fact 'fact_no_tenant' without valid tenant accountId/);

    const explicitCandidate = FactCanonicalAdapter.toCanonicalCandidate(mockFactNoTenant, "acc_explicit_999");
    expect(explicitCandidate.accountId).toBe("acc_explicit_999");
  });

  it("Defect #7: FactCanonicalAdapter marks legacy Fact with unregistered key as UNMAPPED_LEGACY", () => {
    const mockUnregisteredFact = {
      id: "fact_unregistered",
      shipmentId: testShipment,
      field: "unmapped_custom_legacy_field",
      value: "SomeValue",
      normalizedValue: "SomeValue",
      sourceType: "EXTRACTED",
      confidence: 90,
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
      shipment: { accountId: testAccount },
    };

    const candidate = FactCanonicalAdapter.toCanonicalCandidate(mockUnregisteredFact);
    expect(candidate.fieldDefinitionKey).toBe("unknown.unmapped_custom_legacy_field");
    expect(candidate.status).toBe("UNMAPPED_LEGACY");
    expect(candidate.status).not.toBe("PROMOTED");
  });

  it("validates that all registry entries satisfy the runtime Zod schema", () => {
    const slice = RegistrySlicer.getSlice();
    expect(Object.keys(slice).length).toEqual(Object.keys(CANONICAL_FIELD_REGISTRY_V1).length);
  });

  it("test-matrix #4 / Defect #2: proposal citing sourceExtractionFieldIds from another tenant/document is rejected", async () => {
    const mockRun = {
      id: "run_doc_test_matrix_4",
      accountId: testAccount,
      shipmentId: testShipment,
      documentId: testDocument,
      activeParseVersionId: testParseVer,
      fieldSchemaVersion: "1.0.0",
      extractionSchemaVersion: "1.0.0",
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.0",
      normalizationPolicyVersion: "1.0.0",
      idempotencyKey: `${testAccount}:${testDocument}:${testParseVer}`,
      status: "RUNNING",
      errorCode: null,
      createdAt: new Date(),
    };

    vi.spyOn(db.hydrationRun, "findFirst").mockResolvedValue(mockRun as any);
    vi.spyOn(db.hydrationRun, "update").mockResolvedValue({ ...mockRun, status: "FAILED", errorCode: "FAIL_CLOSED: Source extraction field 'ext_cross_tenant' belongs to account 'other_account', expected 'acc_phase1_test_001'." } as any);
    vi.spyOn(db.extractionField, "findMany").mockResolvedValue([
      {
        id: "ext_cross_tenant",
        documentId: "doc_other_tenant",
        fieldName: "carrier",
        value: "HAPAG",
        confidence: 90,
        pageNumber: 1,
        bbox: null,
        source: "UNIVERSAL_HYDRATION",
        correctedFromValue: null,
        correctedByUserId: null,
        correctedAt: null,
        createdAt: new Date(),
        document: { id: "doc_other_tenant", accountId: "other_account" },
      } as any,
    ]);

    const proposals: HydrationProposal[] = [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ext_cross_tenant"],
        proposedValue: "HAPAG",
        mappingConfidence: 0.95,
        relationConfidence: null,
        reasoning: "Extracted carrier",
        status: "PROPOSED",
        abstainReason: null,
        evidenceReferences: [{ documentId: testDocument, parseVersionId: testParseVer, pageNumber: 1, rawLabel: "carrier", rawValue: "HAPAG", confidence: 90 }],
      },
    ];

    await expect(
      HydrationRunEngine.persistProposals(mockRun.id, testAccount, proposals)
    ).rejects.toThrow(/FAIL_CLOSED: Source extraction field 'ext_cross_tenant' belongs to document/);
  });

  it("test-matrix #18 / Defect #1 & #5: proposal failure leaves a durable recoverable FAILED state with errorCode", async () => {
    const mockRun = {
      id: "run_doc_test_matrix_18",
      accountId: testAccount,
      shipmentId: testShipment,
      documentId: testDocument,
      activeParseVersionId: testParseVer,
      fieldSchemaVersion: "1.0.0",
      extractionSchemaVersion: "1.0.0",
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.0",
      normalizationPolicyVersion: "1.0.0",
      idempotencyKey: `${testAccount}:${testDocument}:${testParseVer}`,
      status: "RUNNING",
      errorCode: null,
      createdAt: new Date(),
    };

    let updatedStatus = "RUNNING";
    let updatedErrorCode: string | null = null;

    vi.spyOn(db.hydrationRun, "findFirst").mockResolvedValue(mockRun as any);
    vi.spyOn(db.hydrationRun, "update").mockImplementation((async (args: any) => {
      updatedStatus = args.data.status;
      updatedErrorCode = args.data.errorCode;
      return { ...mockRun, status: updatedStatus, errorCode: updatedErrorCode };
    }) as any);

    const invalidProposals: HydrationProposal[] = [
      {
        targetFieldKey: "invalid.nonexistent.key",
        targetEntityRef: null,
        sourceExtractionFieldIds: [],
        proposedValue: "Test",
        mappingConfidence: 0.9,
        relationConfidence: null,
        reasoning: "Test",
        status: "PROPOSED",
        abstainReason: null,
        evidenceReferences: [{ documentId: testDocument, parseVersionId: testParseVer, pageNumber: 1, rawLabel: "test", rawValue: "Test", confidence: 90 }],
      },
    ];

    await expect(
      HydrationRunEngine.persistProposals(mockRun.id, testAccount, invalidProposals)
    ).rejects.toThrow(/FAIL_CLOSED: Unregistered target field key/);

    expect(updatedStatus).toBe("FAILED");
    expect(updatedErrorCode).toContain("FAIL_CLOSED: Unregistered target field key");
  });

  it("test-matrix #17 / Defect #5: candidate creation is idempotent and avoids duplicates on replay", async () => {
    const mockRun = {
      id: "run_doc_test_matrix_17",
      accountId: testAccount,
      shipmentId: testShipment,
      documentId: testDocument,
      activeParseVersionId: testParseVer,
      fieldSchemaVersion: "1.0.0",
      extractionSchemaVersion: "1.0.0",
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.0",
      normalizationPolicyVersion: "1.0.0",
      idempotencyKey: `${testAccount}:${testDocument}:${testParseVer}`,
      status: "RUNNING",
      errorCode: null,
      createdAt: new Date(),
    };

    const mockCandidate = {
      id: "cand_1",
      hydrationRunId: mockRun.id,
      accountId: testAccount,
      shipmentId: testShipment,
      documentId: testDocument,
      fieldDefinitionKey: "shipment.carrier.name",
      targetEntityRef: null,
      rawValue: "HAPAG LLOYD",
      normalizedValue: "HAPAG LLOYD",
      extractionConfidence: 95,
      mappingConfidence: 95,
      validationScore: 100,
      corroborationScore: 0,
      calibratedDecisionScore: 95,
      status: "PROPOSED",
      reasonCodes: ["Extracted carrier"],
      sourceExtractionFieldIds: [],
      supersedesCandidateId: null,
      createdAt: new Date(),
    };

    vi.spyOn(db.hydrationRun, "findFirst").mockResolvedValue(mockRun as any);
    vi.spyOn(db.hydrationRun, "update").mockResolvedValue({ ...mockRun, status: "SUCCEEDED" } as any);
    vi.spyOn(db.hydrationCandidate, "upsert").mockResolvedValue(mockCandidate as any);

    const validProposals: HydrationProposal[] = [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: [],
        proposedValue: "HAPAG LLOYD",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Extracted carrier",
        status: "PROPOSED",
        abstainReason: null,
        evidenceReferences: [{ documentId: testDocument, parseVersionId: testParseVer, pageNumber: 1, rawLabel: "carrier", rawValue: "HAPAG LLOYD", confidence: 95 }],
      },
    ];

    const result1 = await HydrationRunEngine.persistProposals(mockRun.id, testAccount, validProposals);
    const result2 = await HydrationRunEngine.persistProposals(mockRun.id, testAccount, validProposals);

    expect(result1.length).toBe(1);
    expect(result2.length).toBe(1);
    expect(db.hydrationCandidate.upsert).toHaveBeenCalledTimes(2);
  });
});

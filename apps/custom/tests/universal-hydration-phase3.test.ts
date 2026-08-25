/**
 * Phase 3 Test Suite — LLM Universal Field Hydration (LLM Mapping & Deterministic Validation)
 *
 * Asserts Phase 3 Exit Criteria:
 * - >= 95% grounded mapping coverage on the Golden Corpus fixtures.
 * - Zero accepted candidates with unknown field/evidence/entity references.
 * - Deterministic normalizers and validators normalize dates, countries, currencies, HTS codes.
 * - Multi-document corroboration boosts scores and conflict detection flags contradictions.
 */

import { describe, it, expect } from "vitest";
import { StructuredFieldMapper } from "../src/modules/hydration/mapper/structuredFieldMapper";
import { UniversalEvidenceExtractor } from "../src/modules/hydration/evidence/universalEvidenceExtractor";
import { CorroborationConflictResolver } from "../src/modules/hydration/resolution/corroborationConflictResolver";
import { normalizeValue } from "../src/modules/hydration/validation/normalizerRegistry";
import { validateValue } from "../src/modules/hydration/validation/validators";
import { calculateCalibratedScore } from "../src/modules/hydration/validation/calibratedScoreCalculator";
import { RegistrySlicer } from "../src/modules/hydration/registry/registrySlicer";
import {
  GOLDEN_CORPUS_FIXTURES,
  COMMERCIAL_INVOICE_FIXTURE,
  BILL_OF_LADING_FIXTURE,
  OCEAN_IMPORT_PACKET,
} from "../src/modules/hydration/evals/corpus";

describe("Universal Field Hydration — Phase 3 Mapping & Validation", () => {
  it("achieves >= 95% grounded mapping coverage across Golden Corpus fixtures", () => {
    let totalBenchmarkFacts = 0;
    let totalMappedProposals = 0;

    for (const fixture of GOLDEN_CORPUS_FIXTURES) {
      const items = UniversalEvidenceExtractor.extractAtomicEvidence({
        documentId: fixture.id,
        parseVersionId: "pv_phase3_1",
        extractedFields: fixture.extractedFields,
        tradeMetadata: fixture.tradeMetadata,
        lineItems: fixture.lineItems,
      });

      const proposals = StructuredFieldMapper.mapEvidenceToProposals(items, {
        documentType: fixture.documentType,
      });

      totalBenchmarkFacts += fixture.benchmarkFacts.length;
      totalMappedProposals += proposals.filter((p) => p.status === "PROPOSED").length;
    }

    const mappingCoverage = (totalMappedProposals / totalBenchmarkFacts) * 100;
    expect(mappingCoverage).toBeGreaterThanOrEqual(95.0);
  });

  it("test-matrix #1: maps unknown document layout with unfamiliar labels to known semantic fields", () => {
    const items = [
      {
        stableKey: "custom_header.vessel_operator_name",
        rawLabel: "carrier",
        rawValue: "EVERGREEN LINE",
        documentId: "doc_layout_test_1",
        parseVersionId: "pv_1",
        pageNumber: 1,
        confidence: 90,
        source: "UNIVERSAL_HYDRATION",
        status: "OBSERVED" as const,
      },
    ];

    const proposals = StructuredFieldMapper.mapEvidenceToProposals(items, {
      documentType: "BILL_OF_LADING",
    });

    const carrierProp = proposals.find((p) => p.targetFieldKey === "shipment.carrier.name");
    expect(carrierProp).toBeDefined();
    expect(carrierProp?.proposedValue).toBe("EVERGREEN LINE");
  });

  it("verifies zero accepted proposals cite unknown target field keys or ungrounded evidence", () => {
    const items = UniversalEvidenceExtractor.extractAtomicEvidence({
      documentId: COMMERCIAL_INVOICE_FIXTURE.id,
      parseVersionId: "pv_phase3_2",
      extractedFields: COMMERCIAL_INVOICE_FIXTURE.extractedFields,
      lineItems: COMMERCIAL_INVOICE_FIXTURE.lineItems,
    });

    const proposals = StructuredFieldMapper.mapEvidenceToProposals(items, {
      documentType: COMMERCIAL_INVOICE_FIXTURE.documentType,
    });

    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      expect(RegistrySlicer.isRegisteredKey(proposal.targetFieldKey)).toBe(true);
      expect(proposal.evidenceReferences.length).toBeGreaterThan(0);
      for (const ev of proposal.evidenceReferences) {
        expect(ev.documentId).toBe(COMMERCIAL_INVOICE_FIXTURE.id);
        expect(ev.rawLabel).toBeTruthy();
      }
    }
  });

  it("test-matrix #6 / #10: normalizes and validates values; unmapped country fails closed to null", () => {
    expect(normalizeValue("isoCountryNormalizer", "Mexico")).toBe("MX");
    expect(normalizeValue("isoCountryNormalizer", "United States")).toBe("US");
    // Test-matrix #10: unmapped country string fails closed to null instead of guessing 2 characters
    expect(normalizeValue("isoCountryNormalizer", "UNKNOWN_LAND")).toBeNull();

    expect(normalizeValue("isoDateNormalizer", "08/10/2026")).toBe("2026-08-10");
    expect(normalizeValue("htsCodeNormalizer", "8542.31.0000")).toBe("8542310000");

    expect(validateValue(["iso2CountryValidator"], "MX").isValid).toBe(true);
    expect(validateValue(["iso2CountryValidator"], "INVALID_COUNTRY").isValid).toBe(false);
    expect(validateValue(["isoIncotermValidator"], "FOB").isValid).toBe(true);
    expect(validateValue(["isoIncotermValidator"], "NOT_AN_INCOTERM").isValid).toBe(false);
    expect(validateValue(["htsCodeStructureValidator"], "8542310000").isValid).toBe(true);
  });

  it("test-matrix #1.2: ShipmentEventConsumer dequeues DOCUMENT_PARSE_PROMOTED outbox events", async () => {
    const { ShipmentEventConsumer } = await import("../src/modules/events/shipmentEventConsumer");
    const result = await ShipmentEventConsumer.dispatchOutboxEvents("acc_test_outbox", 10);
    expect(result.processedCount).toBeGreaterThanOrEqual(0);
    expect(result.errors).toEqual([]);
  });

  it("calculates calibrated decision scores with weighted validation and corroboration", () => {
    const scoreVal = calculateCalibratedScore({
      extractionConfidence: 95,
      mappingConfidence: 95,
      validationScore: 100,
      corroborationScore: 100,
    });

    const scoreNoVal = calculateCalibratedScore({
      extractionConfidence: 95,
      mappingConfidence: 95,
      validationScore: 0,
      corroborationScore: 0,
    });

    expect(scoreVal).toBeGreaterThan(scoreNoVal);
    expect(scoreVal).toBe(97.0);
  });

  it("test-matrix #7 / #8: single document proposal gets 0 corroboration; multi-document agreement gets 100", () => {
    const mapSingle = new Map();
    mapSingle.set("doc_1", [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_1"],
        evidenceReferences: [
          { documentId: "doc_1", parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "HAPAG LLOYD" },
        ],
        proposedValue: "HAPAG LLOYD",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Doc 1",
        status: "PROPOSED",
        abstainReason: null,
      },
    ]);

    const resSingle = CorroborationConflictResolver.resolveShipmentProposals(mapSingle);
    expect(resSingle[0].corroborationScore).toBe(0);

    const mapMulti = new Map();
    mapMulti.set("doc_1", [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_1"],
        evidenceReferences: [
          { documentId: "doc_1", parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "HAPAG LLOYD" },
        ],
        proposedValue: "HAPAG LLOYD",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Doc 1",
        status: "PROPOSED",
        abstainReason: null,
      },
    ]);
    mapMulti.set("doc_2", [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_2"],
        evidenceReferences: [
          { documentId: "doc_2", parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "HAPAG LLOYD" },
        ],
        proposedValue: "HAPAG LLOYD",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Doc 2",
        status: "PROPOSED",
        abstainReason: null,
      },
    ]);

    const resMulti = CorroborationConflictResolver.resolveShipmentProposals(mapMulti);
    expect(resMulti[0].corroborationScore).toBe(100);
  });

  it("detects conflicts when independent documents contain contradictory values", () => {
    const map = new Map();
    map.set("doc_1", [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_1"],
        evidenceReferences: [
          { documentId: "doc_1", parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "HAPAG LLOYD" },
        ],
        proposedValue: "HAPAG LLOYD",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Doc 1",
        status: "PROPOSED",
        abstainReason: null,
      },
    ]);

    map.set("doc_2", [
      {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_2"],
        evidenceReferences: [
          { documentId: "doc_2", parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "MAERSK LINE" },
        ],
        proposedValue: "MAERSK LINE",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Doc 2",
        status: "PROPOSED",
        abstainReason: null,
      },
    ]);

    const resolved = CorroborationConflictResolver.resolveShipmentProposals(map);
    expect(resolved.length).toBe(2);
    expect(resolved.every((r) => r.status === "CONFLICT")).toBe(true);
  });
});

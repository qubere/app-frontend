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

  it("normalizes and validates dates, countries, currencies, HTS codes, and incoterms", () => {
    expect(normalizeValue("isoCountryNormalizer", "Mexico")).toBe("MX");
    expect(normalizeValue("isoCountryNormalizer", "United States")).toBe("US");
    expect(normalizeValue("isoDateNormalizer", "08/10/2026")).toBe("2026-08-10");
    expect(normalizeValue("htsCodeNormalizer", "8542.31.0000")).toBe("8542310000");

    expect(validateValue(["iso2CountryValidator"], "MX").isValid).toBe(true);
    expect(validateValue(["iso2CountryValidator"], "INVALID_COUNTRY").isValid).toBe(false);
    expect(validateValue(["isoIncotermValidator"], "FOB").isValid).toBe(true);
    expect(validateValue(["isoIncotermValidator"], "NOT_AN_INCOTERM").isValid).toBe(false);
    expect(validateValue(["htsCodeStructureValidator"], "8542310000").isValid).toBe(true);
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

  it("corroborates matching candidates across multi-document shipment packets", () => {
    const map = new Map();

    for (const fixture of OCEAN_IMPORT_PACKET.documents) {
      const items = UniversalEvidenceExtractor.extractAtomicEvidence({
        documentId: fixture.id,
        parseVersionId: "pv_phase3_packet",
        extractedFields: fixture.extractedFields,
        tradeMetadata: fixture.tradeMetadata,
        lineItems: fixture.lineItems,
      });

      const proposals = StructuredFieldMapper.mapEvidenceToProposals(items, {
        documentType: fixture.documentType,
      });

      map.set(fixture.id, proposals);
    }

    const resolved = CorroborationConflictResolver.resolveShipmentProposals(map);
    expect(resolved.length).toBeGreaterThan(0);

    const carrierResolved = resolved.find((r) => r.proposal.targetFieldKey === "shipment.carrier.name");
    expect(carrierResolved).toBeDefined();
    if (carrierResolved) {
      expect(carrierResolved.corroboratingDocumentIds.length).toBeGreaterThanOrEqual(2);
      expect(carrierResolved.status).toBe("PROMOTED");
    }
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

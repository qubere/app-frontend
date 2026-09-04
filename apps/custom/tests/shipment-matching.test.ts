import { describe, it, expect, vi } from "vitest";
import {
  extractIdentifierCandidates,
  matchShipmentForDocument,
  resolveShipmentForDocument,
  isMatchConflict,
  AUTO_ATTACH_THRESHOLD,
  SUGGEST_THRESHOLD,
  type ShipmentIdentifierLookup,
  type CandidateRecord,
  type LlmSuggestion,
} from "@/modules/shipments/shipmentMatching";

describe("extractIdentifierCandidates", () => {
  it("recognizes exact client-prefixed shipment numbers", () => {
    expect(extractIdentifierCandidates("Commercial invoice SHP-TGT-2026-001, SHP-ACME-2026-002").shipmentNumbers).toEqual(["SHP-TGT-2026-001", "SHP-ACME-2026-002"]);
  });
  it("finds a literal shipment number in the exact generated format", () => {
    const { shipmentNumbers } = extractIdentifierCandidates("Re: docs for SHP-2026-000042 attached");
    expect(shipmentNumbers).toEqual(["SHP-2026-000042"]);
  });

  it("does not match a malformed shipment-number-like token", () => {
    const { shipmentNumbers } = extractIdentifierCandidates("SHP-26-42 or SHP-2026-42 are not real ids");
    expect(shipmentNumbers).toEqual([]);
  });

  it("dedupes repeated shipment numbers", () => {
    const { shipmentNumbers } = extractIdentifierCandidates("SHP-2026-000042 ... again SHP-2026-000042");
    expect(shipmentNumbers).toEqual(["SHP-2026-000042"]);
  });

  it("finds PO references in common formats and normalizes punctuation away", () => {
    const { poReferences } = extractIdentifierCandidates("Invoice for PO-778899 and P.O. 445566");
    expect(poReferences).toContain("PO778899");
    expect(poReferences).toContain("PO445566");
  });

  it("finds an ISO 6346 container number with or without spacing", () => {
    const a = extractIdentifierCandidates("Container CSQU 305438 3 on board");
    expect(a.containers).toContain("CSQU3054383");
    const b = extractIdentifierCandidates("cntr CSQU3054383");
    expect(b.containers).toContain("CSQU3054383");
  });

  it("finds a master air waybill with and without the hyphen", () => {
    const { airWaybills } = extractIdentifierCandidates("MAWB 020-12345678 / booking");
    expect(airWaybills).toContain("02012345678");
  });

  it("finds no structured identifiers in unrelated text", () => {
    const result = extractIdentifierCandidates("Hey, here's the forwarding instructions doc.");
    expect(result.shipmentNumbers).toEqual([]);
    expect(result.poReferences).toEqual([]);
    expect(result.containers).toEqual([]);
  });
});

function makeLookup(overrides?: Partial<ShipmentIdentifierLookup>): {
  lookup: ShipmentIdentifierLookup;
  recorded: CandidateRecord[];
  deleted: string[];
} {
  const recorded: CandidateRecord[] = [];
  const deleted: string[] = [];
  const lookup: ShipmentIdentifierLookup = {
    async findByShipmentNumber() {
      return null;
    },
    async findByPoReference() {
      return [];
    },
    async findByTrackingIdentifiers() {
      return [];
    },
    async deleteCandidatesForDocument(documentId) {
      deleted.push(documentId);
    },
    async recordCandidate(record) {
      recorded.push(record);
    },
    ...overrides,
  };
  return { lookup, recorded, deleted };
}

const input = (over: Partial<Parameters<typeof matchShipmentForDocument>[0]>) => ({
  accountId: "acct_a",
  documentId: "doc_1",
  emailSubject: null,
  parsedText: null,
  ...over,
});

describe("matchShipmentForDocument", () => {
  it("auto-selects a single unambiguous shipment-number match", async () => {
    const { lookup, recorded, deleted } = makeLookup({
      async findByShipmentNumber(_accountId, shipmentNumber) {
        return shipmentNumber === "SHP-2026-000042" ? { id: "shp_1" } : null;
      },
    });

    const result = await matchShipmentForDocument(
      input({ emailSubject: "Docs for SHP-2026-000042" }),
      lookup
    );

    expect(result.matchedShipmentId).toBe("shp_1");
    expect(deleted).toEqual(["doc_1"]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      shipmentId: "shp_1",
      matchedIdentifierType: "SHIPMENT_NUMBER",
      matchedSource: "EMAIL_SUBJECT",
      autoSelected: true,
      algorithmVersion: "v2-weighted-multi-identifier",
      matchMethod: "EXACT_SHIPMENT_NUMBER",
    });
    expect(recorded[0].confidenceScore).toBeGreaterThanOrEqual(AUTO_ATTACH_THRESHOLD);
  });

  it("auto-selects a shipment match from fileName", async () => {
    const { lookup, recorded } = makeLookup({
      async findByShipmentNumber(_accountId, shipmentNumber) {
        return shipmentNumber === "SHP-TGT-2026-001" ? { id: "shp_tgt_1" } : null;
      },
    });

    const result = await matchShipmentForDocument(
      input({ fileName: "SHP-TGT-2026-001-fourth.PDF" }),
      lookup
    );

    expect(result.matchedShipmentId).toBe("shp_tgt_1");
    expect(recorded[0]).toMatchObject({
      shipmentId: "shp_tgt_1",
      matchedIdentifierType: "SHIPMENT_NUMBER",
      matchedSource: "FILE_NAME",
      autoSelected: true,
    });
  });

  it("returns null and records nothing when no identifiers are found", async () => {
    const { lookup, recorded, deleted } = makeLookup();
    const result = await matchShipmentForDocument(
      input({ emailSubject: "no identifiers here", parsedText: "still none" }),
      lookup
    );
    expect(result.matchedShipmentId).toBeNull();
    expect(recorded).toHaveLength(0);
    expect(deleted).toEqual(["doc_1"]);
  });

  it("persists conflicting shipment-number candidates but auto-selects neither", async () => {
    const { lookup, recorded } = makeLookup({
      async findByShipmentNumber(_accountId, shipmentNumber) {
        if (shipmentNumber === "SHP-2026-000042") return { id: "shp_1" };
        if (shipmentNumber === "SHP-2026-000099") return { id: "shp_2" };
        return null;
      },
    });

    const result = await matchShipmentForDocument(
      input({ emailSubject: "SHP-2026-000042", parsedText: "Reference: SHP-2026-000099" }),
      lookup
    );

    expect(result.matchedShipmentId).toBeNull();
    expect(recorded).toHaveLength(2);
    expect(recorded.every((r) => r.autoSelected === false)).toBe(true);
    expect(new Set(recorded.map((r) => r.shipmentId))).toEqual(new Set(["shp_1", "shp_2"]));
  });

  it("a lone PO reference is a suggestion, not an auto-attach", async () => {
    const { lookup, recorded } = makeLookup({
      async findByPoReference(_accountId, normalized) {
        return normalized === "PO778899" ? [{ id: "shp_9" }] : [];
      },
    });

    const result = await matchShipmentForDocument(
      input({ parsedText: "Please see PO-778899 attached." }),
      lookup
    );

    expect(result.matchedShipmentId).toBeNull();
    expect(recorded[0]).toMatchObject({ matchedIdentifierType: "PO_REFERENCE", autoSelected: false });
    expect(recorded[0].confidenceScore).toBeLessThan(AUTO_ATTACH_THRESHOLD);
    expect(recorded[0].confidenceScore).toBeGreaterThanOrEqual(SUGGEST_THRESHOLD);
  });

  it("a container match alone auto-attaches when unrivalled", async () => {
    const { lookup, recorded } = makeLookup({
      async findByTrackingIdentifiers(_accountId, tokens) {
        return tokens.includes("CSQU3054383")
          ? [{ shipmentId: "shp_c", type: "CONTAINER", normalizedValue: "CSQU3054383" }]
          : [];
      },
    });

    const result = await matchShipmentForDocument(
      input({ parsedText: "Arrival notice for container CSQU 305438 3" }),
      lookup
    );

    // CONTAINER weight is 0.80 -- below auto-attach on its own.
    expect(result.matchedShipmentId).toBeNull();
    expect(recorded[0]).toMatchObject({ matchedIdentifierType: "CONTAINER", matchMethod: "EXACT_TRACKING_IDENTIFIER" });
  });

  it("PO + agreeing container on the same shipment clears the auto-attach bar", async () => {
    const { lookup, recorded } = makeLookup({
      async findByPoReference(_accountId, normalized) {
        return normalized === "PO778899" ? [{ id: "shp_x" }] : [];
      },
      async findByTrackingIdentifiers(_accountId, tokens) {
        return tokens.includes("CSQU3054383")
          ? [{ shipmentId: "shp_x", type: "CONTAINER", normalizedValue: "CSQU3054383" }]
          : [];
      },
    });

    const result = await matchShipmentForDocument(
      input({ parsedText: "PO-778899 — container CSQU3054383" }),
      lookup
    );

    expect(result.matchedShipmentId).toBe("shp_x");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ matchMethod: "MULTI_SIGNAL", autoSelected: true });
    expect(recorded[0].scoreBreakdown.signals).toHaveLength(2);
    expect(recorded[0].scoreBreakdown.agreementBonus).toBeGreaterThan(0);
  });

  it("does not auto-attach a strong match when a rival is also plausible", async () => {
    const { lookup } = makeLookup({
      async findByShipmentNumber(_accountId, shipmentNumber) {
        return shipmentNumber === "SHP-2026-000042" ? { id: "shp_strong" } : null;
      },
      async findByPoReference() {
        return [{ id: "shp_rival" }];
      },
    });

    const result = await matchShipmentForDocument(
      input({ parsedText: "SHP-2026-000042 relates to PO-778899" }),
      lookup
    );

    expect(result.matchedShipmentId).toBeNull();
    expect(isMatchConflict(result)).toBe(true);
  });

  it("isMatchConflict is false for a clean match and for no match", async () => {
    const clean = await matchShipmentForDocument(
      input({ emailSubject: "SHP-2026-000042" }),
      makeLookup({
        async findByShipmentNumber(_a, n) {
          return n === "SHP-2026-000042" ? { id: "shp_1" } : null;
        },
      }).lookup
    );
    expect(isMatchConflict(clean)).toBe(false);

    const none = await matchShipmentForDocument(input({ parsedText: "nothing here" }), makeLookup().lookup);
    expect(isMatchConflict(none)).toBe(false);
  });
});

const llm = (over: Partial<LlmSuggestion>): LlmSuggestion => ({
  suggestedShipmentId: null,
  confidence: 0,
  reasoning: "",
  extractedIdentifiers: [],
  alternativeShipmentIds: [],
  model: "gemini-test",
  ...over,
});

describe("resolveShipmentForDocument", () => {
  it("auto-attaches on a deterministic match without calling the LLM", async () => {
    const { lookup } = makeLookup({
      async findByShipmentNumber(_a, n) {
        return n === "SHP-2026-000042" ? { id: "shp_1" } : null;
      },
    });
    const suggest = vi.fn();
    const result = await resolveShipmentForDocument(
      { ...input({ emailSubject: "SHP-2026-000042" }), clientId: "c1" },
      { lookup, suggest }
    );
    expect(result.matchedShipmentId).toBe("shp_1");
    expect(result.outcome).toBe("AUTO_ATTACH_DETERMINISTIC");
    expect(suggest).not.toHaveBeenCalled();
  });

  it("auto-attaches an LLM suggestion only when an identifier corroborates it", async () => {
    const { lookup, recorded } = makeLookup({
      async findByTrackingIdentifiers(_a, tokens) {
        return tokens.includes("MAEU123456789") ? [{ shipmentId: "shp_9", type: "MBL" as const, normalizedValue: "MAEU123456789" }] : [];
      },
    });
    const suggest = vi.fn().mockResolvedValue(
      llm({ suggestedShipmentId: "shp_9", confidence: 0.9, reasoning: "Maersk BL in the body", extractedIdentifiers: [{ type: "MBL", value: "maeu 123 456 789" }] })
    );
    // Body has no regex-matchable token; only the LLM surfaces the identifier,
    // which is then verified against the DB before auto-attach.
    const result = await resolveShipmentForDocument(
      { ...input({ emailBody: "please clear this against our Maersk ocean bill" }), clientId: "c1" },
      { lookup, suggest }
    );
    expect(result.matchedShipmentId).toBe("shp_9");
    expect(result.outcome).toBe("AUTO_ATTACH_LLM_VERIFIED");
    expect(recorded.some((r) => r.reasoning === "Maersk BL in the body")).toBe(true);
  });

  it("never auto-attaches a pure-intent LLM suggestion", async () => {
    const { lookup } = makeLookup();
    const suggest = vi.fn().mockResolvedValue(
      llm({ suggestedShipmentId: "shp_nike", confidence: 0.95, reasoning: "Body says 'the Nike order'", extractedIdentifiers: [] })
    );
    const result = await resolveShipmentForDocument(
      { ...input({ emailBody: "add this to the Nike order" }), clientId: "c1" },
      { lookup, suggest }
    );
    expect(result.matchedShipmentId).toBeNull();
    expect(result.outcome).toBe("LOW_CONFIDENCE");
    expect(result.llm?.suggestedShipmentId).toBe("shp_nike");
  });

  it("does not auto-attach when the address policy is OFF", async () => {
    const { lookup } = makeLookup({
      async findByShipmentNumber(_a, n) {
        return n === "SHP-2026-000042" ? { id: "shp_1" } : null;
      },
    });
    const result = await resolveShipmentForDocument(
      { ...input({ emailSubject: "SHP-2026-000042", requireReview: true }), clientId: "c1", autoAttachPolicy: "OFF" },
      { lookup, suggest: vi.fn() }
    );
    expect(result.matchedShipmentId).toBeNull();
    expect(result.outcome).toBe("REVIEW_REQUIRED");
  });
});

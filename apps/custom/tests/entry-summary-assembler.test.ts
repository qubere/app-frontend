import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  assembleEntrySummaryDraft,
  resolveField,
  type AssemblerFactLike,
  type AssemblerInput,
} from "@/modules/entrySummary/assembler";

const CLOCK = () => new Date("2026-01-01T00:00:00.000Z");

function baseInput(overrides: Partial<AssemblerInput> = {}): AssemblerInput {
  return {
    shipment: {
      id: "shp_1",
      entryType: null,
      portOfEntry: null,
      transportMode: null,
      countryOfExport: null,
      destinationCountry: null,
      countryOfOrigin: null,
    },
    lineItems: [{ id: "li_1", lineNumber: 1 }],
    importerOfRecord: null,
    bond: null,
    parties: [],
    facts: [],
    documents: [],
    approvedDecisions: [],
    fieldApprovals: [],
    filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null },
    clock: CLOCK,
    ...overrides,
  };
}

describe("resolveField precedence ladder", () => {
  const clock = CLOCK;

  it("1: FieldApproval wins over everything else", () => {
    const field = resolveField(
      "B06_PORT_CODE",
      {
        fieldApproval: { value: "L1", fieldApprovalId: "fa_1" },
        userFact: { value: "L2", fact: { id: "f2", field: "x", value: "L2", sourceType: "USER_ENTERED", createdAt: clock() } },
        agentDecision: { value: "L3", agentDecisionId: "ad_1" },
        masterData: { value: "L4", record: { model: "Bond", id: "b_1" } },
        extractedFacts: [{ value: "L5", fact: { id: "f5", field: "x", value: "L5", sourceType: "EXTRACTED", confidence: 99, createdAt: clock() } }],
        filerProfileDefault: { value: "L6", filerProfileId: "fp_1" },
      },
      clock
    );
    expect(field.value).toBe("L1");
    expect(field.provenance.source).toBe("USER");
    expect(field.provenance.fieldApprovalId).toBe("fa_1");
  });

  it("2: Fact.USER_ENTERED wins over agent/master/extracted/filerProfile", () => {
    const field = resolveField(
      "B06_PORT_CODE",
      {
        userFact: { value: "L2", fact: { id: "f2", field: "x", value: "L2", sourceType: "USER_ENTERED", createdAt: clock() } },
        agentDecision: { value: "L3", agentDecisionId: "ad_1" },
        masterData: { value: "L4", record: { model: "Bond", id: "b_1" } },
        extractedFacts: [{ value: "L5", fact: { id: "f5", field: "x", value: "L5", sourceType: "EXTRACTED", createdAt: clock() } }],
        filerProfileDefault: { value: "L6", filerProfileId: "fp_1" },
      },
      clock
    );
    expect(field.value).toBe("L2");
    expect(field.provenance.source).toBe("USER");
    expect(field.provenance.factId).toBe("f2");
  });

  it("3: approved AgentDecision wins over master/extracted/filerProfile", () => {
    const field = resolveField(
      "B06_PORT_CODE",
      {
        agentDecision: { value: "L3", agentDecisionId: "ad_1" },
        masterData: { value: "L4", record: { model: "Bond", id: "b_1" } },
        extractedFacts: [{ value: "L5", fact: { id: "f5", field: "x", value: "L5", sourceType: "EXTRACTED", createdAt: clock() } }],
        filerProfileDefault: { value: "L6", filerProfileId: "fp_1" },
      },
      clock
    );
    expect(field.value).toBe("L3");
    expect(field.provenance.source).toBe("AGENT");
    expect(field.provenance.agentDecisionId).toBe("ad_1");
  });

  it("4: master data wins over extracted/filerProfile", () => {
    const field = resolveField(
      "B06_PORT_CODE",
      {
        masterData: { value: "L4", record: { model: "Bond", id: "b_1" } },
        extractedFacts: [{ value: "L5", fact: { id: "f5", field: "x", value: "L5", sourceType: "EXTRACTED", createdAt: clock() } }],
        filerProfileDefault: { value: "L6", filerProfileId: "fp_1" },
      },
      clock
    );
    expect(field.value).toBe("L4");
    expect(field.provenance.source).toBe("MASTER_DATA");
    expect(field.provenance.masterRecord).toEqual({ model: "Bond", id: "b_1" });
  });

  it("5: highest-confidence extracted Fact wins over filerProfile default", () => {
    const field = resolveField(
      "B06_PORT_CODE",
      {
        extractedFacts: [{ value: "L5", fact: { id: "f5", field: "x", value: "L5", sourceType: "EXTRACTED", confidence: 91, createdAt: clock() } }],
        filerProfileDefault: { value: "L6", filerProfileId: "fp_1" },
      },
      clock
    );
    expect(field.value).toBe("L5");
    expect(field.provenance.source).toBe("DOCUMENT");
  });

  it("6: FilerProfile default wins only when nothing else is present", () => {
    const field = resolveField("B06_PORT_CODE", { filerProfileDefault: { value: "L6", filerProfileId: "fp_1" } }, clock);
    expect(field.value).toBe("L6");
    expect(field.provenance.source).toBe("FILER_PROFILE");
  });

  it("7: MISSING when no candidate at any level", () => {
    const field = resolveField("B06_PORT_CODE", {}, clock);
    expect(field.value).toBeNull();
    expect(field.provenance.source).toBe("MISSING");
  });
});

describe("extracted Fact tie-breaking", () => {
  const fact = (id: string, confidence: number | undefined, createdAt: string): { value: string; fact: AssemblerFactLike } => ({
    value: id,
    fact: { id, field: "x", value: id, sourceType: "EXTRACTED", confidence, createdAt: new Date(createdAt) },
  });

  it("highest confidence wins, carrying its documentId/documentPage", () => {
    const field = resolveField(
      "B29A_HTSUS_NUMBER",
      {
        extractedFacts: [
          { value: "low", fact: { id: "f_low", field: "htsCode", value: "low", sourceType: "EXTRACTED", confidence: 92, documentId: "doc_low", documentPage: 1, createdAt: CLOCK() } },
          { value: "high", fact: { id: "f_high", field: "htsCode", value: "high", sourceType: "EXTRACTED", confidence: 97, documentId: "doc_high", documentPage: 2, createdAt: CLOCK() } },
        ],
      },
      CLOCK
    );
    expect(field.value).toBe("high");
    expect(field.provenance.documentId).toBe("doc_high");
    expect(field.provenance.documentPage).toBe(2);
  });

  it("equal confidence: most recent createdAt wins; equal createdAt: lower id wins (deterministic across 50 runs)", () => {
    for (let i = 0; i < 50; i++) {
      const recentWins = resolveField(
        "B29A_HTSUS_NUMBER",
        { extractedFacts: [fact("f_old", 90, "2026-01-01T00:00:00Z"), fact("f_new", 90, "2026-01-02T00:00:00Z")] },
        CLOCK
      );
      expect(recentWins.value).toBe("f_new");

      const idTieBreak = resolveField(
        "B29A_HTSUS_NUMBER",
        { extractedFacts: [fact("f_b", 90, "2026-01-01T00:00:00Z"), fact("f_a", 90, "2026-01-01T00:00:00Z")] },
        CLOCK
      );
      expect(idTieBreak.value).toBe("f_a");
    }
  });
});

describe("assembleEntrySummaryDraft", () => {
  it("no importer of record -> B23/B26 MISSING, and no fabricated importer number appears", () => {
    const draft = assembleEntrySummaryDraft(baseInput({ importerOfRecord: null }));
    expect(draft.header.fields.B23_IMPORTER_NUMBER.value).toBeNull();
    expect(draft.header.fields.B23_IMPORTER_NUMBER.provenance.source).toBe("MISSING");
    expect(draft.header.fields.B26_IMPORTER_OF_RECORD_NAME.value).toBeNull();
    const serialized = JSON.stringify(draft);
    expect(serialized).not.toContain("CBP-998877");
  });

  it("no port on shipment and no filer default -> B06 MISSING, no fabricated port", () => {
    const draft = assembleEntrySummaryDraft(baseInput({ filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null } }));
    expect(draft.header.fields.B06_PORT_CODE.value).toBeNull();
    expect(draft.header.fields.B06_PORT_CODE.provenance.source).toBe("MISSING");
    const serialized = JSON.stringify(draft);
    expect(serialized).not.toContain("2704");
    expect(serialized).not.toContain("Port of Los Angeles");
  });

  it("renumbers gapped source line numbers to a contiguous draft sequence, preserving sourceLineNumber", () => {
    const draft = assembleEntrySummaryDraft(
      baseInput({ lineItems: [{ id: "li_3", lineNumber: 3 }, { id: "li_7", lineNumber: 7 }, { id: "li_11", lineNumber: 11 }] })
    );
    expect(draft.lines.map((l) => l.lineNumber)).toEqual([1, 2, 3]);
    expect(draft.lines.map((l) => l.sourceLineNumber)).toEqual([3, 7, 11]);
  });

  it("places a Chapter 99 (301) child line directly after its parent, linked by parentLineNumber", () => {
    const draft = assembleEntrySummaryDraft(
      baseInput({
        lineItems: [
          { id: "li_1", lineNumber: 1 },
          { id: "li_2", lineNumber: 2, chapter99Lines: [{ program: "301", htsCode: "9903.88.03" }] },
          { id: "li_3", lineNumber: 3 },
        ],
      })
    );
    expect(draft.lines).toHaveLength(4);
    expect(draft.lines.map((l) => l.lineNumber)).toEqual([1, 2, 3, 4]);
    const child = draft.lines[2];
    expect(child.parentLineNumber).toBe(2);
    expect(child.fields.B29A_HTSUS_NUMBER.value).toBe("9903.88.03");
    // The parent line's own B33 fields are untouched by assembly (left MISSING pending U4).
    const parent = draft.lines[1];
    expect(parent.fields.B33A_HTSUS_RATE.value).toBeNull();
  });

  it("is deterministic: same input + fixed clock produces identical JSON across 10 runs", () => {
    const input = baseInput({
      lineItems: [{ id: "li_1", lineNumber: 1 }, { id: "li_2", lineNumber: 2 }],
      importerOfRecord: { id: "ior_1", name: "Acme Importer", irsEin: "12-3456789", cbpImporterNumber: null, address: "1 Main St" },
    });
    const runs = Array.from({ length: 10 }, () => JSON.stringify(assembleEntrySummaryDraft(input)));
    expect(new Set(runs).size).toBe(1);
  });

  it("populates every header block (populated or MISSING) — none silently omitted", async () => {
    const { HEADER_BLOCK_IDS } = await import("@/modules/entrySummary/model");
    const draft = assembleEntrySummaryDraft(baseInput());
    for (const blockId of HEADER_BLOCK_IDS) {
      expect(draft.header.fields).toHaveProperty(blockId);
      expect((draft.header.fields as Record<string, unknown>)[blockId]).toBeDefined();
    }
  });

  it("populates every line block on every line", async () => {
    const { LINE_BLOCK_IDS } = await import("@/modules/entrySummary/model");
    const draft = assembleEntrySummaryDraft(baseInput());
    for (const blockId of LINE_BLOCK_IDS) {
      expect(draft.lines[0].fields).toHaveProperty(blockId);
    }
  });
});

describe("purity", () => {
  it("assembler.ts imports no @/lib/db", () => {
    const source = readFileSync(new URL("../src/modules/entrySummary/assembler.ts", import.meta.url), "utf-8");
    expect(source).not.toMatch(/@\/lib\/db/);
  });
});

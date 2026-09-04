import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * §84 -- when the model does not report a field, the persisted extraction
 * must carry null for it, never a value guessed or copied from a sibling
 * field. The prompt already tells Gemini this (documentIntelligenceAgent.ts:
 * "Do NOT mutate or invent missing values... Never copy one into another --
 * leave a field null if the document does not state it"), and a prior bug
 * fixed under this same rule (finding #4: destinationCountry was read off
 * countryOfExport, so every document reported its origin country as its
 * destination) shows the code layer, not just the prompt, must guard this.
 * These tests pin the code-level guarantee: the response-mapping code itself
 * has no fallback that derives one field's value from another.
 */

const dbMock = {
  shipmentDocument: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  documentParseVersion: { create: vi.fn() },
  agentDecision: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  extractionField: { deleteMany: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  fieldApproval: { findMany: vi.fn() },
};

let generateContentResult: { text: string } = { text: "{}" };
const generateContent = vi.fn(async () => generateContentResult);

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: { AGENT_EXECUTION_COMPLETED: "agent.execution_completed" } }));
vi.mock("@/lib/ai/aiMeter", () => ({ meterGeminiCall: vi.fn() }));
vi.mock("@/modules/entity/entityResolutionService", () => ({
  EntityResolutionService: { findOrCreateEntity: vi.fn(async () => ({ id: "ent_1" })) },
}));
vi.mock("@/modules/shipment/shipmentPartyService", () => ({
  ShipmentPartyService: { assignParty: vi.fn() },
}));
vi.mock("@/modules/exceptions/exception.service", () => ({
  ExceptionService: { syncExtractionFieldExceptions: vi.fn() },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", INTEGER: "INTEGER", ARRAY: "ARRAY", BOOLEAN: "BOOLEAN" },
}));

const { DocumentIntelligenceAgent } = await import("@/modules/agents/documentIntelligenceAgent");

const ACCOUNT = "acct_1";
const SHIPMENT = "shp_1";

function baseInput() {
  return {
    accountId: ACCOUNT,
    userId: "u_1",
    shipmentId: SHIPMENT,
    packetId: "pkt_1",
    fileName: "BOL-1.pdf",
    fileBuffer: Buffer.from("fake-pdf-bytes"),
    mimeType: "application/pdf",
  };
}

async function persistedTradeMetadata(): Promise<Record<string, unknown>> {
  const writtenJson = dbMock.shipmentDocument.updateMany.mock.calls[0][0].data.extractedJson;
  return JSON.parse(writtenJson).tradeMetadata;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key";
  dbMock.shipmentDocument.findFirst.mockResolvedValue({
    id: "doc_1",
    fileName: "BOL-1.pdf",
    documentType: "BILL_OF_LADING",
    parseVersions: [],
  });
  dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
  dbMock.documentParseVersion.create.mockResolvedValue({ id: "pv_1" });
  dbMock.agentDecision.findUnique.mockResolvedValue(null);
  dbMock.agentDecision.create.mockResolvedValue({ id: "dec_1" });
  dbMock.fieldApproval.findMany.mockResolvedValue([]);
});

describe("no-hallucination extraction mapping", () => {
  it("§84 -- leaves destinationCountry null instead of copying countryOfExport, when the document states origin but not destination", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [],
        hasCommercialInvoice: false,
        confidence: 90,
        reasoningChain: "test",
        lineItems: [
          { lineNumber: 1, description: "Steel fasteners", quantity: 10, unitPrice: 1, totalAmount: 10 },
        ],
        tradeMetadata: {
          countryOfOrigin: "China",
          countryOfExport: "China",
          // countryOfDestination intentionally omitted -- the document never states it.
        },
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput());

    const tradeMetadata = await persistedTradeMetadata();
    expect(tradeMetadata.originCountry).toBe("China");
    expect(tradeMetadata.destinationCountry).toBeNull();
  });

  it("§84 -- leaves portOfDischarge null instead of copying portOfLoading, when the document states only one of the two ports", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [],
        hasCommercialInvoice: false,
        confidence: 90,
        reasoningChain: "test",
        lineItems: [
          { lineNumber: 1, description: "Steel fasteners", quantity: 10, unitPrice: 1, totalAmount: 10 },
        ],
        tradeMetadata: {
          portOfLoading: "Shanghai",
          // portOfDischarge intentionally omitted.
        },
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput());

    const tradeMetadata = await persistedTradeMetadata();
    expect(tradeMetadata.portOfLoading).toBe("Shanghai");
    expect(tradeMetadata.portOfDischarge).toBeNull();
  });

  it("§84 -- does not set dangerousGoodsIndicator on a line item merely because the model returned a 'Dangerous Goods' section heading elsewhere", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [{ key: "Section", value: "Dangerous Goods Declaration" }],
        hasCommercialInvoice: false,
        confidence: 90,
        reasoningChain: "test",
        lineItems: [
          {
            lineNumber: 1,
            description: "Steel fasteners",
            quantity: 10,
            unitPrice: 1,
            totalAmount: 10,
            // dangerousGoodsIndicator intentionally omitted by the model.
          },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput());

    const writtenJson = dbMock.shipmentDocument.updateMany.mock.calls[0][0].data.extractedJson;
    const persisted = JSON.parse(writtenJson);
    expect(persisted.lineItems[0].dangerousGoodsIndicator).toBeUndefined();
  });
});

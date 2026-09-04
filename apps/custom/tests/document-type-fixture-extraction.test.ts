import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * §70-74 -- no existing test drove DocumentIntelligenceAgent end-to-end
 * (mocked Gemini response -> mapping -> persisted extractedJson) for each of
 * the five document types the spec calls out: Commercial Invoice, Packing
 * List, Ocean Bill of Lading, Forwarding Instruction, and Booking Request.
 * The golden-corpus fixtures in modules/hydration/evals/corpus/index.ts are
 * shaped as already-mapped ground truth (legacy tradeMetadata keys) and are
 * only read back statically by evalRunner.ts -- neither exercises this
 * agent's own response-mapping code.
 *
 * Each case below mocks Gemini's raw structured-response shape (the field
 * names the prompt actually asks for -- shipper/consignee/countryOfOrigin,
 * not the mapped legacy keys) using only fields that exist on this agent's
 * own TradeMetadata / LineItemExtraction / ContainerExtraction /
 * PackageExtraction types, and asserts the persisted extractedJson carries
 * them through. Fields the spec mentions that have no first-class slot in
 * these types today (e.g. a distinct "booking number" or "freight terms"
 * column) are exactly the deferred first-class-schema work (§69P) already
 * declined for this pass -- they are not asserted here.
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

function baseInput(fileName: string) {
  return {
    accountId: "acct_1",
    userId: "u_1",
    shipmentId: "shp_1",
    packetId: "pkt_1",
    fileName,
    fileBuffer: Buffer.from("fake-pdf-bytes"),
    mimeType: "application/pdf",
  };
}

async function persistedBlob(): Promise<Record<string, any>> {
  const writtenJson = dbMock.shipmentDocument.updateMany.mock.calls[0][0].data.extractedJson;
  return JSON.parse(writtenJson);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key";
  dbMock.shipmentDocument.findFirst.mockResolvedValue({
    id: "doc_1",
    fileName: "doc.pdf",
    documentType: "COMMERCIAL_INVOICE",
    parseVersions: [],
  });
  dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
  dbMock.documentParseVersion.create.mockResolvedValue({ id: "pv_1" });
  dbMock.agentDecision.findUnique.mockResolvedValue(null);
  dbMock.agentDecision.create.mockResolvedValue({ id: "dec_1" });
  dbMock.fieldApproval.findMany.mockResolvedValue([]);
});

describe("document-type fixture extraction", () => {
  it("§70 -- Commercial Invoice: header fields, Incoterm, currency, subtotal, and 2 line items with HTS/COO reach persisted extractedJson", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [],
        hasCommercialInvoice: true,
        confidence: 95,
        reasoningChain: "test",
        tradeMetadata: {
          shipper: "Apex Electronics Ltd",
          consignee: "Global Trade Logistics Inc",
          countryOfOrigin: "MX",
          countryOfDestination: "US",
          invoiceNumber: "INV-2026-8841",
          documentDate: "2026-08-10",
          incoterms: "FOB",
          currency: "USD",
          totalValue: 145000.0,
          poNumber: "PO-5521",
        },
        lineItems: [
          { lineNumber: 1, description: "Automotive Sensor Assembly Module Type-A", quantity: 5000, unitPrice: 18.5, totalAmount: 92500, htsCode: "8542.31.0000", countryOfOrigin: "MX" },
          { lineNumber: 2, description: "Microcontroller Sub-Assembly Unit B", quantity: 2500, unitPrice: 21.0, totalAmount: 52500, htsCode: "8542.39.0000", countryOfOrigin: "MX" },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput("Commercial_Invoice_INV-8841.pdf"));

    const blob = await persistedBlob();
    expect(blob.tradeMetadata.exporterName).toBe("Apex Electronics Ltd");
    expect(blob.tradeMetadata.importerName).toBe("Global Trade Logistics Inc");
    expect(blob.tradeMetadata.originCountry).toBe("MX");
    expect(blob.tradeMetadata.destinationCountry).toBe("US");
    expect(blob.tradeMetadata.invoiceNumber).toBe("INV-2026-8841");
    expect(blob.tradeMetadata.incoterm).toBe("FOB");
    expect(blob.tradeMetadata.currency).toBe("USD");
    expect(blob.tradeMetadata.poNumber).toBe("PO-5521");
    expect(blob.lineItems).toHaveLength(2);
    expect(blob.lineItems[0].htsCode).toBe("8542.31.0000");
    expect(blob.lineItems[1].htsCode).toBe("8542.39.0000");
  });

  it("§71 -- Packing List: carton/weight/quantity totals and 3 line items reach persisted extractedJson without table flattening", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [],
        hasCommercialInvoice: false,
        confidence: 92,
        reasoningChain: "test",
        tradeMetadata: {
          shipper: "Apex Electronics Ltd",
          consignee: "Global Trade Logistics Inc",
          invoiceNumber: "INV-2026-8841",
          containerNumber: "MSCU1234567",
          totalWeight: "2450.50",
          netWeight: "2200.00",
          totalQuantity: "7500",
          cartonCount: "312",
        },
        lineItems: [
          { lineNumber: 1, description: "Automotive Sensor Assembly Module Type-A", quantity: 5000, unitPrice: null, totalAmount: null },
          { lineNumber: 2, description: "Microcontroller Sub-Assembly Unit B", quantity: 2500, unitPrice: null, totalAmount: null },
          { lineNumber: 3, description: "Wiring Harness Kit C", quantity: 0, unitPrice: null, totalAmount: null },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput("Packing_List_INV-8841.pdf"));

    const blob = await persistedBlob();
    expect(blob.tradeMetadata.containerNumber).toBe("MSCU1234567");
    expect(blob.tradeMetadata.totalWeight).toBe("2450.50");
    expect(blob.tradeMetadata.netWeight).toBe("2200.00");
    expect(blob.tradeMetadata.totalQuantity).toBe("7500");
    expect(blob.tradeMetadata.cartonCount).toBe("312");
    // Each of the 3 packing-list rows survives as its own line item, not
    // collapsed/merged into one flattened table row.
    expect(blob.lineItems).toHaveLength(3);
    expect(blob.lineItems.map((li: any) => li.description)).toEqual([
      "Automotive Sensor Assembly Module Type-A",
      "Microcontroller Sub-Assembly Unit B",
      "Wiring Harness Kit C",
    ]);
  });

  it("§72 -- Ocean Bill of Lading: vessel/voyage, ports, container with seals/weights reach persisted extractedJson", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [],
        hasCommercialInvoice: false,
        confidence: 93,
        reasoningChain: "test",
        tradeMetadata: {
          shipper: "Apex Electronics Ltd",
          consignee: "Global Trade Logistics Inc",
          notifyParty: "Global Trade Logistics Inc (Notify)",
          carrier: "HAPAG LLOYD MEXICO SA DE CV",
          vesselName: "MV Pacific Voyager",
          voyageNumber: "V.114E",
          portOfLoading: "Manzanillo, MX",
          portOfDischarge: "Long Beach, US",
          transportDocumentNumber: "HLCUMZO2026881100",
          onBoardDate: "2026-08-12",
        },
        lineItems: [],
        containers: [
          {
            containerNumber: "MSCU1234567",
            sealNumbers: ["SEAL998877"],
            containerType: "Dry",
            containerSize: "40HC",
            packageCount: 312,
            descriptionOfGoods: "Automotive electronic components",
            grossWeight: 2450.5,
            netWeight: 2200.0,
            weightUom: "KG",
          },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput("Ocean_BOL_HLCUMZO2026881100.pdf"));

    const blob = await persistedBlob();
    expect(blob.tradeMetadata.vesselName).toBe("MV Pacific Voyager");
    expect(blob.tradeMetadata.voyageNumber).toBe("V.114E");
    expect(blob.tradeMetadata.portOfLoading).toBe("Manzanillo, MX");
    expect(blob.tradeMetadata.portOfDischarge).toBe("Long Beach, US");
    expect(blob.tradeMetadata.transportDocumentNumber).toBe("HLCUMZO2026881100");
    expect(blob.containers).toHaveLength(1);
    expect(blob.containers[0].containerNumber).toBe("MSCU1234567");
    expect(blob.containers[0].sealNumbers).toEqual(["SEAL998877"]);
    expect(blob.containers[0].grossWeight).toBe(2450.5);
  });

  it("§73 -- Forwarding Instruction: routing/vessel fields and multiple containers with seal numbers and net/gross weights reach persisted extractedJson", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [
          { key: "Final Destination", value: "Chicago, IL" },
          { key: "Shipping Line", value: "HAPAG LLOYD" },
        ],
        hasCommercialInvoice: false,
        confidence: 90,
        reasoningChain: "test",
        tradeMetadata: {
          shipper: "Apex Electronics Ltd",
          consignee: "Global Trade Logistics Inc",
          notifyParty: "Global Trade Logistics Inc (Notify)",
          vesselName: "MV Pacific Voyager",
          voyageNumber: "V.114E",
          portOfLoading: "Manzanillo, MX",
          portOfDischarge: "Long Beach, US",
          carrier: "HAPAG LLOYD MEXICO SA DE CV",
        },
        // A manifest HS code stated on the goods description line, not an empty
        // array -- an empty lineItems array is treated as "extraction produced
        // nothing" and triggers a separate grounded-fallback path this test does
        // not exercise.
        lineItems: [
          { lineNumber: 1, description: "Automotive electronic components", quantity: 312, unitPrice: null, totalAmount: null, htsCode: "8542.31.0000" },
        ],
        containers: [
          {
            containerNumber: "MSCU1234567",
            sealNumbers: ["SEAL998877"],
            grossWeight: 2450.5,
            netWeight: 2200.0,
            weightUom: "KG",
          },
          {
            containerNumber: "MSCU7654321",
            sealNumbers: ["SEAL112233"],
            grossWeight: 1800.0,
            netWeight: 1600.0,
            weightUom: "KG",
          },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput("Forwarding_Instruction_FI-4471.pdf"));

    const blob = await persistedBlob();
    expect(blob.tradeMetadata.vesselName).toBe("MV Pacific Voyager");
    expect(blob.tradeMetadata.portOfLoading).toBe("Manzanillo, MX");
    expect(blob.tradeMetadata.portOfDischarge).toBe("Long Beach, US");
    expect(blob.containers).toHaveLength(2);
    expect(blob.containers.map((c: any) => c.containerNumber)).toEqual(["MSCU1234567", "MSCU7654321"]);
    expect(blob.containers[0].sealNumbers).toEqual(["SEAL998877"]);
    expect(blob.containers[1].sealNumbers).toEqual(["SEAL112233"]);
    // Freeform routing details the structured schema has no first-class slot
    // for (e.g. final destination, named shipping line) still survive as
    // discovered key-value pairs rather than being dropped.
    expect(blob.keyValuePairs["Final Destination"]).toBe("Chicago, IL");
    expect(blob.keyValuePairs["Shipping Line"]).toBe("HAPAG LLOYD");
  });

  it("§74 -- Booking Request: carrier/vessel/port/Incoterm fields reach persisted extractedJson, and fields the document never states stay null", async () => {
    generateContentResult = {
      text: JSON.stringify({
        discoveredKeyValues: [
          { key: "Booking Number", value: "BKG-887744" },
          { key: "Mode", value: "Ocean" },
        ],
        hasCommercialInvoice: false,
        confidence: 88,
        reasoningChain: "test",
        tradeMetadata: {
          shipper: "Apex Electronics Ltd",
          consignee: "Global Trade Logistics Inc",
          carrier: "HAPAG LLOYD MEXICO SA DE CV",
          vesselName: "MV Pacific Voyager",
          voyageNumber: "V.114E",
          portOfLoading: "Manzanillo, MX",
          portOfDischarge: "Long Beach, US",
          incoterms: "FOB",
          containerNumber: "MSCU1234567",
          // onBoardDate intentionally omitted -- a booking request precedes
          // vessel loading, so the document has no on-board date to state.
        },
        // Non-empty for the same reason as the Forwarding Instruction case above.
        lineItems: [
          {
            lineNumber: 1,
            description: "Frozen seafood product",
            quantity: 20,
            unitPrice: null,
            totalAmount: null,
            minimumTransportTemperature: -18,
            maximumTransportTemperature: -15,
            temperatureUom: "C",
            productProperties: ["Perishable", "Requires reefer container"],
          },
        ],
      }),
    };

    await DocumentIntelligenceAgent.execute(baseInput("Booking_Request_BKG-887744.pdf"));

    const blob = await persistedBlob();
    expect(blob.tradeMetadata.carrier).toBe("HAPAG LLOYD MEXICO SA DE CV");
    expect(blob.tradeMetadata.vesselName).toBe("MV Pacific Voyager");
    expect(blob.tradeMetadata.voyageNumber).toBe("V.114E");
    expect(blob.tradeMetadata.portOfLoading).toBe("Manzanillo, MX");
    expect(blob.tradeMetadata.portOfDischarge).toBe("Long Beach, US");
    expect(blob.tradeMetadata.incoterm).toBe("FOB");
    expect(blob.tradeMetadata.containerNumber).toBe("MSCU1234567");
    expect(blob.tradeMetadata.onBoardDate).toBeNull();
    expect(blob.keyValuePairs["Booking Number"]).toBe("BKG-887744");
    expect(blob.lineItems[0].minimumTransportTemperature).toBe(-18);
    expect(blob.lineItems[0].maximumTransportTemperature).toBe(-15);
    expect(blob.lineItems[0].productProperties).toEqual(["Perishable", "Requires reefer container"]);
  });
});

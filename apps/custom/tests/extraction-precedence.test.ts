import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * One upload can produce two extractions of the same document: a vision pass over
 * the raw image (upload pipeline) and a pass over a parsed document context
 * (document worker, once a parse is accepted). Both write `extractedJson`.
 *
 * These tests pin the rule that decides which one survives, in BOTH arrival
 * orders -- the bug being guarded against is "whichever finished last wins",
 * which made the value a broker sees non-deterministic.
 */

const dbMock = {
  shipmentDocument: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  documentParseVersion: { create: vi.fn() },
  agentDecision: { findFirst: vi.fn(), create: vi.fn() },
  extractionField: { deleteMany: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  fieldApproval: { findMany: vi.fn() },
};

const assignParty = vi.fn();
const syncExceptions = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: { AGENT_EXECUTION_COMPLETED: "agent.execution_completed" } }));
vi.mock("@/modules/entity/entityResolutionService", () => ({
  EntityResolutionService: { findOrCreateEntity: vi.fn(async () => ({ id: "ent_1" })) },
}));
vi.mock("@/modules/shipment/shipmentPartyService", () => ({
  ShipmentPartyService: { assignParty: (p: unknown) => assignParty(p) },
}));
vi.mock("@/modules/exceptions/exception.service", () => ({
  ExceptionService: { syncExtractionFieldExceptions: (p: unknown) => syncExceptions(p) },
}));

const { DocumentIntelligenceAgent } = await import("@/modules/agents/documentIntelligenceAgent");

const ACCOUNT = "acct_1";
const SHIPMENT = "shp_1";
const DOCUMENT = "doc_1";

function baseInput() {
  return {
    accountId: ACCOUNT,
    userId: "u_1",
    shipmentId: SHIPMENT,
    packetId: "pkt_1",
    fileName: "INV-1.pdf",
  };
}

/** The context a worker run supplies after a parse has been accepted. */
const PARSED_CONTEXT = {
  text: "--- SECTION chk_1 [Invoice] (page 1) ---\nInvoice No: INV-1",
  processingRunId: "run_1",
  parserProvider: "IBM_DOCLING",
  parserProfile: "STANDARD",
  contextSchemaVersion: "QubereDocumentContextV1",
  truncated: false,
};

/** The full WHERE clause the UPDATE carried. */
function writeWhere(): Record<string, unknown> | undefined {
  return dbMock.shipmentDocument.updateMany.mock.calls[0]?.[0]?.where;
}

/** The precedence-rank guard, or undefined when the write was unconditional. */
function writeGuard(): unknown {
  return writeWhere()?.OR;
}

/** The rank persisted alongside extractedJson on this write. */
function writtenRank(): unknown {
  return dbMock.shipmentDocument.updateMany.mock.calls[0]?.[0]?.data?.extractedJsonPrecedenceRank;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GEMINI_API_KEY; // no model call; the persistence path is under test
  dbMock.shipmentDocument.findFirst.mockResolvedValue({
    id: DOCUMENT,
    fileName: "INV-1.pdf",
    documentType: "COMMERCIAL_INVOICE",
    parseVersions: [],
  });
  dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
  dbMock.documentParseVersion.create.mockResolvedValue({ id: "pv_1" });
  dbMock.agentDecision.create.mockResolvedValue({ id: "dec_1" });
  dbMock.fieldApproval.findMany.mockResolvedValue([]);
});

describe("extraction write precedence", () => {
  it("guards a background vision write with its own precedence rank", async () => {
    await DocumentIntelligenceAgent.execute(baseInput());

    // The guard is part of the UPDATE, not a prior read: two concurrent runs
    // must not both observe "nothing stored yet" and then both write. It is a
    // real sequence-number comparison (rank = tier offset + this run's own
    // DocumentParseVersion.version), not an existence check, so a second
    // same-tier run racing in is ordered correctly instead of always winning
    // or always losing.
    expect(writeGuard()).toEqual([
      { extractedJsonPrecedenceRank: null },
      { extractedJsonPrecedenceRank: { lt: 1 } },
    ]);
    expect(writtenRank()).toBe(1);
    expect(dbMock.shipmentDocument.updateMany).toHaveBeenCalledTimes(1);
  });

  it("guards a context-backed write with a rank that outranks any vision run", async () => {
    await DocumentIntelligenceAgent.execute({ ...baseInput(), documentContext: PARSED_CONTEXT });

    // Still a real condition -- not unconditional -- but its tier offset
    // means no vision-only rank (bounded by run count) could ever reach it.
    expect(writeGuard()).toEqual([
      { extractedJsonPrecedenceRank: null },
      { extractedJsonPrecedenceRank: { lt: 1_000_001 } },
    ]);
    expect(writtenRank()).toBe(1_000_001);
  });

  it("orders two context-backed runs by version instead of arrival order", async () => {
    // A second reprocess starting while an earlier one is still in flight is
    // the race the old existence-check couldn't order: both are context-backed,
    // so the old rule let whichever finished last win outright.
    dbMock.shipmentDocument.findFirst.mockResolvedValue({
      id: DOCUMENT,
      fileName: "INV-1.pdf",
      documentType: "COMMERCIAL_INVOICE",
      parseVersions: [{ id: "pv_0" }, { id: "pv_1" }],
    });

    await DocumentIntelligenceAgent.execute({ ...baseInput(), documentContext: PARSED_CONTEXT });

    // version 3 (two existing runs already recorded) ranks above version 1,
    // so a stale, slower run finishing later cannot displace this one.
    expect(writeGuard()).toEqual([
      { extractedJsonPrecedenceRank: null },
      { extractedJsonPrecedenceRank: { lt: 1_000_003 } },
    ]);
  });

  it("lets an explicitly requested re-extraction overwrite a parse-derived one", async () => {
    await DocumentIntelligenceAgent.execute({ ...baseInput(), forceOverwrite: true });
    expect(writeGuard()).toBeUndefined();
  });

  it("does not apply parties or exceptions when its write lost", async () => {
    // count 0 == the guard matched nothing: a parse-derived extraction already
    // exists, so this vision reading was discarded.
    dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 0 });

    await DocumentIntelligenceAgent.execute(baseInput());

    // The losing reading must not reach the shipment by another route, or the
    // document would show one set of values and the exceptions another.
    expect(assignParty).not.toHaveBeenCalled();
    expect(syncExceptions).not.toHaveBeenCalled();
  });

  it("applies parties and exceptions when its write won", async () => {
    dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
    await DocumentIntelligenceAgent.execute({ ...baseInput(), documentContext: PARSED_CONTEXT });
    expect(syncExceptions).toHaveBeenCalled();
  });

  it("still records the run that happened, even when its write lost", async () => {
    dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 0 });
    await DocumentIntelligenceAgent.execute(baseInput());

    // The discarded run is still history worth keeping, attributed to the engine
    // that produced it.
    expect(dbMock.documentParseVersion.create).toHaveBeenCalled();
    expect(dbMock.documentParseVersion.create.mock.calls[0][0].data.parserProvider).toBe(
      "GEMINI_VISION"
    );
  });

  it("distinguishes a run over parsed context from a run over the image", async () => {
    // This agent runs twice per upload, once each way. Labelling both
    // GEMINI_VISION left two rows nothing could tell apart -- including their
    // stored confidence, which describes a different act of reading in each case.
    dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
    await DocumentIntelligenceAgent.execute({ ...baseInput(), documentContext: PARSED_CONTEXT });

    const data = dbMock.documentParseVersion.create.mock.calls[0][0].data;
    expect(data.parserProvider).toBe("GEMINI_PARSED_CONTEXT");
    // And which parser produced that context, so the lineage is traceable.
    expect(data.parserName).toBe("IBM_DOCLING");
  });

  it("records no upstream parser for a run that read the image", async () => {
    dbMock.shipmentDocument.updateMany.mockResolvedValue({ count: 1 });
    await DocumentIntelligenceAgent.execute(baseInput());

    const data = dbMock.documentParseVersion.create.mock.calls[0][0].data;
    expect(data.parserProvider).toBe("GEMINI_VISION");
    // No parser stood between the model and the page, and naming one would be
    // a lineage claim that never happened.
    expect(data.parserName).toBeNull();
  });

  it("§81 -- re-applies a human field-review correction on top of a fresh reparse, so a late parse cannot overwrite it", async () => {
    // A human already corrected containerNumber via field review (FieldApproval),
    // then this document gets reparsed/re-extracted (e.g. a retry, or the worker
    // run after the vision run). The reparse's own tradeMetadata.containerNumber
    // is rebuilt from scratch (null here, since no model call happens without a
    // key) and must not silently discard the human's correction.
    dbMock.fieldApproval.findMany.mockResolvedValue([
      { fieldKey: "containerNumber", value: "MSCU1234567" },
    ]);

    await DocumentIntelligenceAgent.execute(baseInput());

    const writtenJson = dbMock.shipmentDocument.updateMany.mock.calls[0][0].data.extractedJson;
    const persistedTradeMetadata = JSON.parse(writtenJson).tradeMetadata;
    expect(persistedTradeMetadata.containerNumber).toBe("MSCU1234567");
  });

  it("never writes the document row with an unconditional update", async () => {
    // `update` cannot express the guard, so its presence would reintroduce the
    // race even if the guard exists elsewhere.
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../src/modules/agents/documentIntelligenceAgent.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/db\.shipmentDocument\.update\(/);
    expect(source).toMatch(/db\.shipmentDocument\.updateMany\(/);
  });
});

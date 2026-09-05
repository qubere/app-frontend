import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    shipmentDocument: { findMany: vi.fn(), update: vi.fn() },
    documentParseVersion: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
  loadNormalizedResult: vi.fn(),
  parseArtifactIndex: vi.fn(),
  buildParsedDocumentSearchText: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/documents/parser/artifactStore", () => ({
  loadNormalizedResult: mocks.loadNormalizedResult,
  parseArtifactIndex: mocks.parseArtifactIndex,
}));
vi.mock("@/modules/documents/parser/searchText", () => ({
  buildParsedDocumentSearchText: mocks.buildParsedDocumentSearchText,
}));

const { backfillParsedSearchText } = await import(
  "../src/modules/documents/processing/backfillParsedSearchText"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("backfillParsedSearchText", () => {
  it("populates parsedSearchText using active parse version artifacts when available", async () => {
    mocks.db.shipmentDocument.findMany
      .mockResolvedValueOnce([
        {
          id: "doc-1",
          accountId: "acct-1",
          activeParseVersionId: "ver-1",
          rawContent: null,
          extractedJson: null,
        },
      ])
      .mockResolvedValueOnce([]);

    mocks.db.documentParseVersion.findUnique.mockResolvedValue({
      artifactsJson: { canonical: "foo" },
    });
    mocks.parseArtifactIndex.mockReturnValue({ canonical: "foo" });
    mocks.loadNormalizedResult.mockResolvedValue({ markdown: "Sample text" });
    mocks.buildParsedDocumentSearchText.mockReturnValue("Sample text derived");
    mocks.db.shipmentDocument.update.mockResolvedValue({});

    const res = await backfillParsedSearchText({ accountId: "acct-1" });

    expect(res.scanned).toBe(1);
    expect(res.updated).toBe(1);
    expect(mocks.db.shipmentDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { parsedSearchText: "Sample text derived" },
    });
  });

  it("falls back to rawContent when no parse artifacts exist", async () => {
    mocks.db.shipmentDocument.findMany
      .mockResolvedValueOnce([
        {
          id: "doc-2",
          accountId: "acct-1",
          activeParseVersionId: null,
          rawContent: "Raw invoice text content",
          extractedJson: null,
        },
      ])
      .mockResolvedValueOnce([]);

    mocks.db.documentParseVersion.findFirst.mockResolvedValue(null);
    mocks.db.shipmentDocument.update.mockResolvedValue({});

    const res = await backfillParsedSearchText();

    expect(res.scanned).toBe(1);
    expect(res.updated).toBe(1);
    expect(mocks.db.shipmentDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-2" },
      data: { parsedSearchText: "Raw invoice text content" },
    });
  });
});

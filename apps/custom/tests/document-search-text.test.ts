import { describe, expect, it } from "vitest";
import { buildParsedDocumentSearchText } from "@/modules/documents/parser/searchText";
import {
  QUBERE_PARSER_CONTRACT_VERSION,
  type NormalizedParserResult,
} from "@/modules/documents/parser/contracts";

function parsedResult(): NormalizedParserResult {
  return {
    contractVersion: QUBERE_PARSER_CONTRACT_VERSION,
    profile: "STANDARD",
    metadata: {
      provider: "IBM_DOCLING",
      parserName: "docling",
      parserVersion: null,
      ocrEngine: null,
      ocrEngineVersion: null,
      pageCount: 1,
      ocrUsed: null,
      fullPageOcrUsed: null,
      processingDurationMs: null,
      parserConfidence: null,
      ocrConfidence: null,
    },
    markdown: "Invoice 9981",
    sections: [
      {
        id: "section-1",
        headingPath: ["Seller", "Address"],
        content: "Northwind Trade Group",
        provenance: [],
      },
    ],
    tables: [
      {
        id: "table-1",
        index: 0,
        caption: "Line items",
        page: 1,
        bbox: null,
        rowCount: 1,
        columnCount: 2,
        cells: [
          { row: 0, column: 0, rowSpan: 1, columnSpan: 1, isHeader: true, text: "Part number", provenance: null },
          { row: 0, column: 1, rowSpan: 1, columnSpan: 1, isHeader: false, text: "VALVE-442", provenance: null },
        ],
        html: null,
      },
    ],
    warnings: [],
    pageTextLengths: [64],
  };
}

describe("parsed document search projection", () => {
  it("includes full markdown, section paths/content, table captions, and every cell", () => {
    const text = buildParsedDocumentSearchText(parsedResult());
    expect(text).toContain("Invoice 9981");
    expect(text).toContain("Seller > Address");
    expect(text).toContain("Northwind Trade Group");
    expect(text).toContain("Line items");
    expect(text).toContain("Part number");
    expect(text).toContain("VALVE-442");
  });

  it("does not duplicate exact entries", () => {
    const result = parsedResult();
    result.sections[0]!.content = "Invoice 9981";
    expect(buildParsedDocumentSearchText(result).match(/Invoice 9981/g)).toHaveLength(1);
  });
});

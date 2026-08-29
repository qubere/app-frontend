// Bulk Compliance Screening -- XML parser for TRANSACTION_COMPLIANCE batches.
// Uses saxes -- a pure-JS streaming SAX parser with no DTD/external-entity
// resolution capability, hence XXE-safe by construction -- the same engine
// already trusted for real regulatory feed ingestion (see
// screening/ofacSdnIngestionService.ts). A DOM-based XML library was
// deliberately avoided here since most default-enable external entity
// resolution.
//
// Expected shape: a root element containing repeated depth-2 record
// elements (e.g. <Records><Record>...</Record></Records>), each a flat bag
// of depth-3 <FieldName>value</FieldName> children -- field names are
// resolved through the same column-alias table as CSV/JSON
// (mapTransactionColumns), so any accepted header spelling works as a tag
// name too. A structurally invalid document fails the whole batch; only a
// per-record shape problem is rejected on its own (prompt section 22).
import { SaxesParser, type SaxesTagPlain } from "saxes";
import { mapTransactionColumns, rowToCanonicalRequest, type ColumnMappingTemplateFields } from "./columns";
import type { ComplianceBatchServiceFlags, ParsedBatchInput } from "./types";

export class ComplianceBatchXmlStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceBatchXmlStructureError";
  }
}

export function parseTransactionComplianceXml(
  text: string,
  serviceFlags: ComplianceBatchServiceFlags,
  templateFields?: ColumnMappingTemplateFields
): ParsedBatchInput {
  const parser = new SaxesParser();
  const stack: string[] = [];
  let textBuf = "";
  let currentRecord: Record<string, string> | null = null;
  const rawRecords: Record<string, string>[] = [];
  let sawRoot = false;
  let parseError: Error | null = null;

  parser.on("error", (e) => {
    parseError = e;
  });

  parser.on("text", (t) => {
    textBuf += t;
  });

  parser.on("opentag", (node: SaxesTagPlain) => {
    stack.push(node.name);
    textBuf = "";
    if (stack.length === 1) sawRoot = true;
    if (stack.length === 2) currentRecord = {};
  });

  parser.on("closetag", (node: SaxesTagPlain) => {
    const depth = stack.length;
    const value = textBuf.trim();
    if (depth === 3 && currentRecord) {
      currentRecord[node.name] = value;
    } else if (depth === 2 && currentRecord) {
      rawRecords.push(currentRecord);
      currentRecord = null;
    }
    stack.pop();
    textBuf = "";
  });

  try {
    parser.write(text);
    parser.close();
  } catch (err) {
    parseError = parseError ?? (err instanceof Error ? err : new Error(String(err)));
  }

  if (parseError) {
    throw new ComplianceBatchXmlStructureError(`The file is not valid XML: ${(parseError as Error).message}`);
  }
  if (!sawRoot || rawRecords.length === 0) {
    throw new ComplianceBatchXmlStructureError(
      "The XML file must have a root element containing one or more record elements."
    );
  }

  const records: ParsedBatchInput["records"] = [];
  const sourceRowNumbers: number[] = [];
  const invalidRows: ParsedBatchInput["invalidRows"] = [];

  rawRecords.forEach((raw, i) => {
    const rowNumber = i + 1;
    const headers = Object.keys(raw);
    const row = Object.values(raw);
    const mapping = mapTransactionColumns(headers, templateFields);

    const { request, errors } = rowToCanonicalRequest(mapping, row, rowNumber, serviceFlags);
    if (request) {
      records.push(request);
      sourceRowNumbers.push(rowNumber);
    } else {
      invalidRows.push({ rowNumber, errors });
    }
  });

  return { records, sourceRowNumbers, invalidRows };
}

import type { NormalizedParserResult } from "./contracts";

/**
 * Lossless, database-searchable text for a normalized parser result.
 *
 * Agent context is deliberately bounded, and the provider's canonical JSON is
 * stored in object storage. Repository search has different requirements: it
 * must cover every parsed entry without fetching every artifact at query time.
 * This projection therefore includes the full Markdown derivative (when one
 * exists), every section heading/body, and every table caption/cell.
 */
export function buildParsedDocumentSearchText(result: NormalizedParserResult): string {
  const parts: string[] = [];

  if (result.markdown?.trim()) parts.push(result.markdown.trim());

  for (const section of result.sections) {
    if (section.headingPath.length > 0) parts.push(section.headingPath.join(" > "));
    if (section.content.trim()) parts.push(section.content.trim());
  }

  for (const table of result.tables) {
    if (table.caption?.trim()) parts.push(table.caption.trim());
    for (const cell of table.cells) {
      if (cell.text.trim()) parts.push(cell.text.trim());
    }
  }

  // Repeated text is common when Markdown and structured sections describe the
  // same content. De-duplicating exact entries keeps the search column smaller
  // without dropping any distinct parsed value.
  return [...new Set(parts)].join("\n");
}

/**
 * Shared server-side PDF generator.
 * Produces valid %PDF-1.4 binary streams containing structured document headers,
 * key-value metadata tables, two-column section key-values, and full multi-column data tables.
 */

export interface PdfTableColumn {
  key: string;
  label: string;
  width?: number; // width in points (total printable area width is 532)
  align?: "left" | "right" | "center";
}

export interface PdfTableSection {
  heading: string;
  columns: PdfTableColumn[];
  rows: Record<string, any>[];
}

export function generateSimplePdfBuffer(options: {
  title: string;
  subtitle?: string;
  metadata?: Record<string, string>;
  sections?: Array<{
    heading: string;
    items: Array<{ label: string; value: string }>;
  }>;
  tables?: PdfTableSection[];
}): Buffer {
  const sanitize = (text?: string | number | null) => {
    if (text === null || text === undefined) return "-";
    return String(text)
      .replace(/[()\\]/g, "")
      .replace(/[^\x20-\x7E]/g, " ");
  };

  const title = sanitize(options.title);
  const subtitle = sanitize(options.subtitle || "Compliance Record");

  const streamCommands: string[] = [];

  // Header Banner
  streamCommands.push("q");
  streamCommands.push("0.08 0.18 0.36 rg 40 725 532 45 re f");
  streamCommands.push(`BT /F1 13 Tf 1 1 1 rg 1 0 0 1 52 752 Tm (${title}) Tj ET`);
  streamCommands.push(`BT /F2 8.5 Tf 0.85 0.9 0.95 rg 1 0 0 1 52 735 Tm (${subtitle}) Tj ET`);
  streamCommands.push("0 0 0 rg");

  let y = 705;

  // Metadata Card Block
  if (options.metadata) {
    const entries = Object.entries(options.metadata);
    const boxHeight = entries.length * 16 + 10;
    y -= boxHeight;

    streamCommands.push(`0.96 0.97 0.99 rg 40 ${y} 532 ${boxHeight} re f`);
    streamCommands.push(`0.82 0.86 0.92 rg 0.75 w 40 ${y} 532 ${boxHeight} re s`);

    let itemY = y + boxHeight - 16;
    for (const [key, val] of entries) {
      if (itemY < 60) break;
      const k = sanitize(key);
      const v = sanitize(val);
      streamCommands.push(`BT /F1 8.5 Tf 0.2 0.25 0.35 rg 1 0 0 1 52 ${itemY} Tm (${k}:) Tj ET`);
      streamCommands.push(`BT /F2 8.5 Tf 0.1 0.1 0.1 rg 1 0 0 1 200 ${itemY} Tm (${v}) Tj ET`);
      itemY -= 16;
    }

    y -= 14;
  }

  // Key-Value Sections
  if (options.sections) {
    for (const sec of options.sections) {
      if (y < 80) break;

      streamCommands.push(`0.92 0.94 0.97 rg 40 ${y - 4} 532 18 re f`);
      streamCommands.push(`0.8 0.85 0.9 rg 0.5 w 40 ${y - 4} 532 18 re s`);
      streamCommands.push(`BT /F1 9.5 Tf 0.08 0.18 0.36 rg 1 0 0 1 48 ${y} Tm (${sanitize(sec.heading)}) Tj ET`);
      y -= 22;

      for (const item of sec.items) {
        if (y < 60) break;
        const labelText = sanitize(item.label);
        const valText = sanitize(item.value);

        streamCommands.push(`BT /F1 8 Tf 0.25 0.3 0.4 rg 1 0 0 1 52 ${y} Tm (${labelText}) Tj ET`);

        if (valText.length > 70) {
          const part1 = valText.substring(0, 70);
          const part2 = valText.substring(70, 140);
          streamCommands.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg 1 0 0 1 210 ${y} Tm (${part1}) Tj ET`);
          y -= 12;
          streamCommands.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg 1 0 0 1 210 ${y} Tm (${part2}) Tj ET`);
        } else {
          streamCommands.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg 1 0 0 1 210 ${y} Tm (${valText}) Tj ET`);
        }

        y -= 14;
      }
      y -= 10;
    }
  }

  // Multi-column Data Tables (Keys as columns, each object as a new line)
  if (options.tables) {
    for (const tableSec of options.tables) {
      if (y < 80) break;

      // Table Heading Bar
      streamCommands.push(`0.08 0.18 0.36 rg 40 ${y - 4} 532 18 re f`);
      streamCommands.push(`BT /F1 9.5 Tf 1 1 1 rg 1 0 0 1 48 ${y} Tm (${sanitize(tableSec.heading)}) Tj ET`);
      y -= 22;

      // Table Header Column Labels
      const cols = tableSec.columns;
      const totalWidth = 532;
      const defaultColWidth = Math.floor(totalWidth / Math.max(1, cols.length));

      streamCommands.push(`0.92 0.94 0.97 rg 40 ${y - 2} 532 16 re f`);
      streamCommands.push(`0.75 0.8 0.88 rg 0.4 w 40 ${y - 2} 532 16 re s`);

      let colX = 45;
      for (const col of cols) {
        const cWidth = col.width || defaultColWidth;
        streamCommands.push(`BT /F1 8 Tf 0.1 0.15 0.3 rg 1 0 0 1 ${colX} ${y} Tm (${sanitize(col.label)}) Tj ET`);
        colX += cWidth;
      }
      y -= 18;

      // Data Rows (each object is a line in the table)
      let rowIdx = 0;
      for (const rowObj of tableSec.rows) {
        if (y < 50) break;

        if (rowIdx % 2 === 1) {
          streamCommands.push(`0.97 0.98 0.99 rg 40 ${y - 2} 532 15 re f 0 0 0 rg`);
        }
        streamCommands.push(`0.9 0.9 0.92 rg 0.2 w 40 ${y - 2} 532 0.2 re s 0 0 0 rg`);

        let cellX = 45;
        for (const col of cols) {
          const cWidth = col.width || defaultColWidth;
          const rawVal = rowObj[col.key];
          const valStr = sanitize(rawVal);

          const maxChars = Math.max(5, Math.floor(cWidth / 5.5));
          const truncated = valStr.length > maxChars ? valStr.substring(0, maxChars - 2) + ".." : valStr;

          streamCommands.push(`BT /F2 7.5 Tf 0.1 0.1 0.1 rg 1 0 0 1 ${cellX} ${y} Tm (${truncated}) Tj ET`);
          cellX += cWidth;
        }

        y -= 16;
        rowIdx++;
      }

      y -= 10;
    }
  }

  // Footer line
  streamCommands.push("0.8 0.8 0.8 rg 40 40 532 0.5 re f");
  streamCommands.push("BT /F2 7.5 Tf 0.5 0.5 0.5 rg 1 0 0 1 40 28 Tm (CONFIDENTIAL - Reasonable Care Compliance Record - Generated by Qubere AI Engine) Tj ET");
  streamCommands.push("Q");

  const streamContent = streamCommands.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf-8");

  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 5 0 R >>\nendobj\n";
  const obj4 = "4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj\n";
  const obj5 = `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  const headerStr = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const headerBuf = Buffer.from(headerStr, "latin1");
  const objects = [
    Buffer.from(obj1, "utf-8"),
    Buffer.from(obj2, "utf-8"),
    Buffer.from(obj3, "utf-8"),
    Buffer.from(obj4, "utf-8"),
    Buffer.from(obj5, "utf-8"),
  ];

  const offsets: number[] = [0];
  let currOffset = headerBuf.length;

  for (const objBuf of objects) {
    offsets.push(currOffset);
    currOffset += objBuf.length;
  }

  const startXrefOffset = currOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xrefStr += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXrefOffset}\n%%EOF\n`;

  const xrefBuf = Buffer.from(xrefStr, "utf-8");

  return Buffer.concat([headerBuf, ...objects, xrefBuf]);
}

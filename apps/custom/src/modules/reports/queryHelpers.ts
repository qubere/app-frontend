export interface ReportRowsResult {
  rows: Record<string, unknown>[];
  totalCount: number;
}

/** Parses a filter snapshot's date bounds into a Prisma-friendly UTC range (inclusive start, exclusive end). */
export function parseDateRange(filters: Record<string, unknown>): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  const from = filters.dateFrom;
  const to = filters.dateTo;
  if (typeof from === "string" && from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (typeof to === "string" && to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // Exclusive end boundary, one day past the requested date.
      d.setUTCDate(d.getUTCDate() + 1);
      range.lt = d;
    }
  }
  return range;
}

export function stringFilter(filters: Record<string, unknown>, key: string): string | undefined {
  const value = filters[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Bounded row limit for preview mode -- never generate a full export as a preview. */
export const PREVIEW_ROW_LIMIT = 50;

/** Hard cap so a single report run cannot load unbounded rows into memory. */
export const MAX_EXPORT_ROWS = 50_000;

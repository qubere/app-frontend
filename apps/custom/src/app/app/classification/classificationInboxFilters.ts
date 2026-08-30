/**
 * Pure filtering + bucket-counting for the Classification Inbox, split out so
 * the status groupings are unit-testable without rendering the component.
 */

export type FilterKey = "review" | "in-progress" | "decided" | "failed" | "all";

export interface FilterDef {
  key: FilterKey;
  label: string;
  /** Case statuses this filter includes; null = every status. */
  statuses: string[] | null;
}

// Maps the 13 ClassificationCase.status values onto the four states a broker
// actually triages by. A status in none of these only shows under "All".
export const FILTERS: FilterDef[] = [
  { key: "review", label: "Needs review", statuses: ["PROPOSED", "HUMAN_REVIEW_REQUIRED", "NEEDS_INFORMATION"] },
  { key: "in-progress", label: "In progress", statuses: ["DRAFT", "AWAITING_DOCUMENTS", "QUEUED", "PROCESSING"] },
  { key: "decided", label: "Decided", statuses: ["APPROVED", "REJECTED", "SUPERSEDED"] },
  { key: "failed", label: "Failed", statuses: ["FAILED", "CANCELLED"] },
  { key: "all", label: "All", statuses: null },
];

interface CaseLike {
  id: string;
  status: string;
  description: string;
}

export function bucketCounts<T extends CaseLike>(cases: T[]): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = {
    review: 0,
    "in-progress": 0,
    decided: 0,
    failed: 0,
    all: cases.length,
  };
  for (const c of cases) {
    for (const f of FILTERS) {
      if (f.statuses && f.statuses.includes(c.status)) counts[f.key] += 1;
    }
  }
  return counts;
}

export function filterCases<T extends CaseLike>(cases: T[], key: FilterKey, query: string): T[] {
  const def = FILTERS.find((f) => f.key === key);
  const q = query.trim().toLowerCase();
  return cases.filter((c) => {
    if (def?.statuses && !def.statuses.includes(c.status)) return false;
    if (q && !c.description.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

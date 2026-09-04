export const SAVED_VIEW_LIMIT = 20;
export const SAVED_VIEW_NAME_MAX = 60;

export interface SavedView {
  name: string;
  query: string;
}

export function savedViewStorageKey(tableId: string): string {
  return `qubere.savedViews.${tableId}`;
}

function truncateToCodePoints(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

function isSavedView(value: unknown): value is SavedView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.name === "string" && typeof candidate.query === "string";
}

export function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isSavedView)
    .map((view) => ({
      name: truncateToCodePoints(view.name.trim(), SAVED_VIEW_NAME_MAX),
      query: new URLSearchParams(view.query).toString(),
    }))
    .filter((view) => view.name.length > 0)
    .slice(0, SAVED_VIEW_LIMIT);
}

export function upsertSavedView(
  views: readonly SavedView[],
  name: string,
  query: string
): SavedView[] {
  const trimmedName = truncateToCodePoints(name.trim(), SAVED_VIEW_NAME_MAX);
  if (!trimmedName) return [...views];

  const next: SavedView = { name: trimmedName, query: new URLSearchParams(query).toString() };
  const without = views.filter((view) => view.name !== trimmedName);

  return [next, ...without].slice(0, SAVED_VIEW_LIMIT);
}

export function removeSavedView(views: readonly SavedView[], name: string): SavedView[] {
  return views.filter((view) => view.name !== name);
}

export function savedViewHref(basePath: string, view: SavedView): string {
  return view.query ? `${basePath}?${view.query}` : basePath;
}

export function isActiveView(view: SavedView, current: string): boolean {
  const a = new URLSearchParams(view.query);
  const b = new URLSearchParams(current);
  a.sort();
  b.sort();
  return a.toString() === b.toString();
}

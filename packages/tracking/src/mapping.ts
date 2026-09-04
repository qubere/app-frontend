import type {
  MappedTrackingEvent,
  TrackingEventMappingRule,
  TrackingMatchType,
} from "./types";

export function normalizeProviderEventCode(rawCode: string): string {
  return rawCode.trim().toUpperCase().replace(/[\s\-]+/g, "_");
}

function matches(matchType: TrackingMatchType, value: string, pattern: string): boolean {
  switch (matchType) {
    case "EXACT":
      return value === pattern;
    case "PREFIX":
      return value.startsWith(pattern);
    case "CONTAINS":
      return value.includes(pattern);
    case "FALLBACK":
      return true;
  }
}

/**
 * Resolve a provider code using database rules. Connection-specific rules win
 * over provider defaults; priority then provides deterministic ordering.
 */
export function mapProviderEvent(
  rawCode: string,
  connectionId: string,
  rules: readonly TrackingEventMappingRule[]
): MappedTrackingEvent | null {
  const value = normalizeProviderEventCode(rawCode);
  const ordered = rules
    .filter((rule) => rule.active)
    .sort((left, right) => {
      const leftSpecific = left.integrationConfigId === connectionId ? 0 : 1;
      const rightSpecific = right.integrationConfigId === connectionId ? 0 : 1;
      return leftSpecific - rightSpecific || left.priority - right.priority || left.id.localeCompare(right.id);
    });

  const rule = ordered.find((candidate) => {
    if (candidate.integrationConfigId && candidate.integrationConfigId !== connectionId) return false;
    const pattern = normalizeProviderEventCode(candidate.rawEventPattern);
    return matches(candidate.matchType, value, pattern);
  });

  return rule
    ? {
        mappingId: rule.id,
        canonicalEventType: rule.canonicalEventType,
        classifier: rule.classifier,
        sourceType: rule.sourceType,
      }
    : null;
}

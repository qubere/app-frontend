// Builds the in-app review link used by both templates. Links into pages
// that already enforce their own auth/tenant/RBAC -- no new page needed, and
// no screening evidence is ever encoded in the URL itself.
export interface ReviewUrlTarget {
  partyId?: string | null;
  shipmentId?: string | null;
  resultId: string;
}

export function buildSecureReviewUrl(appBaseUrl: string, target: ReviewUrlTarget): string {
  if (target.partyId) {
    return `${appBaseUrl}/app/parties/${encodeURIComponent(target.partyId)}?screeningResultId=${encodeURIComponent(target.resultId)}`;
  }
  const params = new URLSearchParams({ screeningResultId: target.resultId });
  if (target.shipmentId) params.set("shipmentId", target.shipmentId);
  return `${appBaseUrl}/app/compliance?${params.toString()}`;
}

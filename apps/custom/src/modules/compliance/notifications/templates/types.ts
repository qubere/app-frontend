import type { ComplianceNotificationType } from "@prisma/client";
import type { RestrictedPartyScreeningStatus } from "@/modules/agents/compliance/restrictedParty/types";

export interface RpsEmailMatchSummary {
  sourceList: string;
  matchedName: string;
  nameScore: number;
  matchMethod: string;
}

/** Minimal, template-owned view of a screening result -- decoupled from PersistedRestrictedPartyResult so the templates module never depends on persistResult.ts. */
export interface RpsEmailResultView {
  id: string;
  status: RestrictedPartyScreeningStatus;
  screenedName: string;
  screenedAddress: string | null;
  screenedCity: string | null;
  screenedCountry: string | null;
  hitCount: number;
  redFlagCount: number;
  partyId: string | null;
  shipmentId: string | null;
  matches: RpsEmailMatchSummary[];
}

export interface RpsEmailRenderInput {
  notificationType: ComplianceNotificationType;
  result: RpsEmailResultView;
  appBaseUrl: string;
  secure: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

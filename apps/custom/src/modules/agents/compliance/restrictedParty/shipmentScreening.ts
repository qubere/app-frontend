// Restricted / Denied-Party Screening -- shipment-level aggregation.
//
// ComplianceAuditAgent needs one summary result per shipment, not the raw
// per-party/per-pass output runRestrictedPartyScreening returns. This walks
// every ShipmentParty via getShipmentPartiesForScreening (richer than
// EmbargoParty -- has address/contact), screens and persists each one, and
// aggregates to the same status/hits/skipped/errors shape every sibling
// screening module's result type uses. No shipment parties available must
// resolve to SKIPPED, never CLEAR.
import { getShipmentPartiesForScreening } from "./restrictedPartyRepository";
import { runRestrictedPartyScreening } from "./restrictedPartyScreening";
import { persistScreeningRun } from "./persistResult";
import { checkPreApprovalGate } from "./preApproval";
import { recordComplianceExecution } from "@/modules/compliance/executionHistory";
import type { RestrictedPartyPassType, RestrictedPartyScreeningStatus } from "./types";

const STATUS_SEVERITY: Record<RestrictedPartyScreeningStatus, number> = {
  HIT: 5,
  REVIEW_REQUIRED: 4,
  PARTIAL: 3,
  ERROR: 2,
  SKIPPED: 1,
  CLEAR: 0,
};

function worseStatus(a: RestrictedPartyScreeningStatus, b: RestrictedPartyScreeningStatus): RestrictedPartyScreeningStatus {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

export interface RestrictedPartyShipmentHit {
  role: string;
  partyName: string;
  matchedName: string;
  sourceList: string;
  nameScore: number;
  matchMethod: string;
  tier: "HIT" | "REVIEW_REQUIRED";
  passType: RestrictedPartyPassType;
  reason: string;
}

export interface RestrictedPartyShipmentRedFlagHit {
  role: string;
  partyName: string;
  matchedWord: string;
  passType: RestrictedPartyPassType;
  reason: string;
}

export interface RestrictedPartyShipmentSkip {
  role: string;
  reason: string;
}

export interface RestrictedPartyShipmentError {
  role: string;
  code: string;
  message: string;
}

/** A shipment party whose Restricted Party Screening obligation was satisfied via a valid pre-approval instead of running the local matcher. The matcher was skipped, NOT run-and-clear -- see executionMode. */
export interface RestrictedPartyShipmentPreApprovedReuse {
  role: string;
  partyName: string;
  partyId: string;
  approvalId: string;
  screeningDisposition: "PRE_APPROVED";
  executionMode: "PRE_APPROVED_REUSE";
  localMatcherExecuted: false;
}

export interface RestrictedPartyShipmentScreeningResult {
  status: RestrictedPartyScreeningStatus;
  hits: RestrictedPartyShipmentHit[];
  redFlagHits: RestrictedPartyShipmentRedFlagHit[];
  skipped: RestrictedPartyShipmentSkip[];
  errors: RestrictedPartyShipmentError[];
  preApprovedReuses: RestrictedPartyShipmentPreApprovedReuse[];
  partiesScreened: number;
}

export async function runRestrictedPartyScreeningForShipment(
  accountId: string,
  shipmentId: string,
  options?: { forceRescreen?: boolean; userId?: string | null; requestId?: string }
): Promise<RestrictedPartyShipmentScreeningResult> {
  const parties = await getShipmentPartiesForScreening(shipmentId);

  if (parties.length === 0) {
    return {
      status: "SKIPPED",
      hits: [],
      redFlagHits: [],
      skipped: [{ role: "ALL", reason: "No shipment parties are available to screen." }],
      errors: [],
      preApprovedReuses: [],
      partiesScreened: 0,
    };
  }

  let overall: RestrictedPartyScreeningStatus = "CLEAR";
  const hits: RestrictedPartyShipmentHit[] = [];
  const redFlagHits: RestrictedPartyShipmentRedFlagHit[] = [];
  const skipped: RestrictedPartyShipmentSkip[] = [];
  const errors: RestrictedPartyShipmentError[] = [];
  const preApprovedReuses: RestrictedPartyShipmentPreApprovedReuse[] = [];

  for (const party of parties) {
    const gate = await checkPreApprovalGate({
      accountId,
      partyId: party.partyId,
      source: "SHIPMENT",
      forceRescreen: options?.forceRescreen,
      userId: options?.userId,
      requestId: options?.requestId,
    });

    if (gate.applied && party.partyId && gate.approvalId) {
      preApprovedReuses.push({
        role: party.role,
        partyName: party.name,
        partyId: party.partyId,
        approvalId: gate.approvalId,
        screeningDisposition: "PRE_APPROVED",
        executionMode: "PRE_APPROVED_REUSE",
        localMatcherExecuted: false,
      });
      continue;
    }

    const input = {
      accountId,
      source: "SHIPMENT" as const,
      shipmentId,
      partyId: party.partyId,
      externalReference: party.shipmentPartyId,
      identity: {
        name: party.name,
        address: party.address,
        city: party.city,
        country: party.country,
        contactName: party.contactName,
      },
    };

    const runResult = await runRestrictedPartyScreening(input);
    await persistScreeningRun(input, runResult);

    // ComplianceExecution envelope -- additive, alongside the authoritative
    // RestrictedPartyScreeningResult rows persisted above. Shares the same
    // correlationId so the two can be cross-referenced without a schema
    // change to RestrictedPartyScreeningResult. Never affects `overall`.
    const passStatuses = runResult.passes.map((p) => p.status);
    const executionStatus = passStatuses.includes("ERROR")
      ? passStatuses.some((s) => s !== "ERROR")
        ? "PARTIAL"
        : "FAILED"
      : "COMPLETED";
    await recordComplianceExecution({
      accountId,
      executionType: "RESTRICTED_PARTY_SCREENING",
      status: executionStatus,
      correlationId: runResult.correlationId,
      shipmentId,
      partyId: party.partyId ?? undefined,
      source: "SHIPMENT_PIPELINE",
      initiatedByUserId: options?.userId ?? undefined,
      requestId: options?.requestId ?? undefined,
      responseSnapshot: {
        passes: runResult.passes.map((p) => ({ passType: p.passType, status: p.status, matchCount: p.matches.length })),
      },
      finalStatus: passStatuses.join(","),
      durationMs: runResult.passes.reduce((sum, p) => sum + (p.screeningDurationMs ?? 0), 0),
    });

    for (const pass of runResult.passes) {
      overall = worseStatus(overall, pass.status);

      if (pass.status === "SKIPPED") {
        skipped.push({ role: party.role, reason: "No restricted-party reference data is loaded." });
      }
      if (pass.status === "ERROR" || pass.status === "PARTIAL") {
        if (pass.errorCode || pass.errorMessage) {
          errors.push({ role: party.role, code: pass.errorCode ?? "ERROR", message: pass.errorMessage ?? "Unknown error" });
        }
      }

      for (const m of pass.matches) {
        if (m.suppressedByApprovedParty) continue;
        if (m.tier === "HIT" || m.tier === "REVIEW_REQUIRED") {
          hits.push({
            role: party.role,
            partyName: party.name,
            matchedName: m.matchedName,
            sourceList: m.sourceList,
            nameScore: m.nameScore,
            matchMethod: m.matchMethod,
            tier: m.tier,
            passType: pass.passType,
            reason: `${party.role} "${party.name}" (${pass.passType === "CONTACT_NAME" ? "contact" : "party"} name) matches ${m.sourceList} entry "${m.matchedName}" at ${m.nameScore}% (${m.matchMethod}).`,
          });
        }
      }

      for (const rf of pass.redFlagHits) {
        redFlagHits.push({
          role: party.role,
          partyName: party.name,
          matchedWord: rf.matchedWord,
          passType: pass.passType,
          reason: `${party.role} "${party.name}" (${pass.passType === "CONTACT_NAME" ? "contact" : "party"} name) contains red-flag phrase "${rf.matchedWord}".`,
        });
      }
    }
  }

  return { status: overall, hits, redFlagHits, skipped, errors, preApprovedReuses, partiesScreened: parties.length };
}

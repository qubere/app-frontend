import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";
import { buildLaneKey } from "../../memory/memory.domain-events";

export interface CarrierScoringInput {
  mode: string;
  origin?: { city?: string; country?: string; unlocode?: string };
  destination?: { city?: string; country?: string; unlocode?: string };
  equipment?: string;
  requireInsurance?: boolean;
  requireSafetyCheck?: boolean;
  excludeCarrierIds?: string[];
  shipmentId?: string;
}

export interface ScoredCarrier {
  carrierId: string;
  carrierProfileId?: string;
  carrierName: string;
  scac?: string | null;
  mc?: string | null;
  dot?: string | null;
  score: number;
  isEligible: boolean;
  isPreferred: boolean;
  hasInsurance: boolean;
  safetyStatus?: string;
  onTimeDeliveryRate: number | null;
  tenderAcceptanceRate: number | null;
  recentRejectionCount: number;
  scoreBreakdown: {
    base: number;
    insurance: number;
    safety: number;
    preferred: number;
    onTime: number;
    tenderAcceptance: number;
    recentHistory: number;
    accountMemory: number;
  };
}

export async function evaluateCarriersForShipment(
  ctx: AccountContext,
  input: CarrierScoringInput
): Promise<ScoredCarrier[]> {
  const mode = input.mode.toUpperCase();
  const requireInsurance = input.requireInsurance ?? true;
  const requireSafetyCheck = input.requireSafetyCheck ?? true;
  const laneKey = buildLaneKey({
    mode,
    equipment: input.equipment,
    origin: input.origin,
    destination: input.destination,
  });
  const memoryContext = await TmsAccountContextBuilder.build({
    accountId: ctx.accountId,
    task: "CARRIER_SELECTION",
    query: [mode, input.equipment, input.origin?.unlocode, input.destination?.unlocode]
      .filter(Boolean)
      .join(" "),
    scope: {
      shipmentId: input.shipmentId,
      laneKey,
      mode,
      equipment: input.equipment,
      origin: input.origin?.unlocode ?? input.origin?.city,
      destination: input.destination?.unlocode ?? input.destination?.city,
    },
  });
  const profileModel = (db as any).carrierProfile ?? (db as any).carrier;

  if (!profileModel) return [];

  let profiles: any[] = [];
  try {
    profiles = await profileModel.findMany({
      where: {
        accountId: ctx.accountId,
        ...(profileModel === (db as any).carrierProfile ? { approvedStatus: "APPROVED" } : { status: "ACTIVE" }),
      },
      include: {
        party: { include: { names: true } },
      },
    });
  } catch {
    profiles = [];
  }

  const executionCarriers = await db.carrier.findMany({
    where: { accountId: ctx.accountId, status: "ACTIVE" },
  });
  const executionCarrierForProfile = (profile: any) => {
    const profileName = profile.party?.names?.[0]?.rawName ?? profile.legalName;
    return executionCarriers.find((carrier) =>
      (profile.scac && carrier.scac === profile.scac) ||
      (profile.dot && carrier.dotNumber === profile.dot) ||
      (profile.mc && carrier.mcNumber === profile.mc) ||
      (profileName &&
        typeof carrier.legalName === "string" &&
        carrier.legalName.trim().toLowerCase() === profileName.trim().toLowerCase())
    );
  };

  // Load recent tender history (last 90 days) for all carriers — one query
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000);
  let recentTenders: any[] = [];
  try {
    recentTenders = await (db as any).tender.findMany({
      where: {
        accountId: ctx.accountId,
        createdAt: { gte: ninetyDaysAgo },
        carrierId: {
          in: profiles
            .map((profile: any) => executionCarrierForProfile(profile)?.id)
            .filter((id: unknown): id is string => typeof id === "string"),
        },
      },
      select: {
        carrierId: true,
        status: true,
        shipmentId: true,
      },
    });
  } catch {
    recentTenders = [];
  }

  // Build per-carrier tender maps
  const tendersByCarrier = new Map<
    string,
    { total: number; accepted: number; rejected: number; activeOnShipment: boolean }
  >();

  for (const tender of (recentTenders || [])) {
    if (!tender.carrierId) continue;
    const existing = tendersByCarrier.get(tender.carrierId) ?? {
      total: 0,
      accepted: 0,
      rejected: 0,
      activeOnShipment: false,
    };
    existing.total++;
    if (tender.status === "ACCEPTED") existing.accepted++;
    if (tender.status === "REJECTED" || tender.status === "EXPIRED") existing.rejected++;
    if (
      input.shipmentId &&
      tender.shipmentId === input.shipmentId &&
      (tender.status === "SENT" || tender.status === "DRAFT")
    ) {
      existing.activeOnShipment = true;
    }
    tendersByCarrier.set(tender.carrierId, existing);
  }

  // Score each carrier
  const scored: ScoredCarrier[] = (profiles as any[])
    .filter((profile) => {
      const cId = executionCarrierForProfile(profile)?.id;
      if (!cId) return false;
      if (input.excludeCarrierIds?.includes(cId)) return false;
      return true;
    })
    .map((profile): ScoredCarrier | null => {
      const carrierName = profile.party?.names?.[0]?.rawName ?? profile.legalName ?? "Carrier";
      const modes = Array.isArray(profile.modes)
        ? profile.modes.filter((value: unknown): value is string => typeof value === "string")
        : [];
      const equipmentCaps = Array.isArray(profile.equipmentCapabilities)
        ? profile.equipmentCapabilities.filter(
            (value: unknown): value is string => typeof value === "string"
          )
        : [];
      const metrics = (profile.performanceMetrics as Record<string, number>) ?? {};

      const supportsMode = modes.includes(mode);
      const supportsEquipment = input.equipment
        ? equipmentCaps.includes(input.equipment)
        : true;
      const hasInsurance = profile.insuranceStatus === "ACTIVE" || profile.insuranceOnFile === true;
      const isSafetySatisfactory = profile.safetyStatus === "SATISFACTORY";
      const isPreferred = profile.preferredStatus === true;

      const executionCarrier = executionCarrierForProfile(profile);
      if (!executionCarrier) return null;
      const cId = executionCarrier.id;
      const tenderHistory = tendersByCarrier.get(cId);

      if (tenderHistory?.activeOnShipment) {
        return null;
      }

      const base = 40;
      const insuranceScore = hasInsurance ? 15 : requireInsurance ? -30 : 0;
      const safetyScore = isSafetySatisfactory ? 10 : requireSafetyCheck ? -10 : 0;
      const preferredScore = isPreferred ? 10 : 0;

      const onTimeRate = Number.isFinite(metrics.onTimeDeliveryRate)
        ? metrics.onTimeDeliveryRate
        : null;
      const onTimeScore = onTimeRate == null
        ? 0
        : Math.round(Math.max(0, Math.min(15, ((onTimeRate - 80) / 20) * 15)));

      const profileAcceptance = metrics.tenderAcceptanceRate ?? null;
      const computedAcceptance =
        tenderHistory && tenderHistory.total > 0
          ? (tenderHistory.accepted / tenderHistory.total) * 100
          : null;
      const tenderAcceptanceRate = computedAcceptance ?? profileAcceptance ?? null;
      const tenderAcceptanceScore = tenderAcceptanceRate == null
        ? 0
        : Math.round(
            Math.max(0, Math.min(10, ((tenderAcceptanceRate - 70) / 30) * 10))
          );

      const recentRejectionCount = tenderHistory?.rejected ?? 0;
      const recentHistoryScore = Math.max(-15, -recentRejectionCount * 5);
      const accountMemoryScore = TmsAccountContextBuilder.carrierPreferenceAdjustment(
        memoryContext,
        {
          carrierId: cId,
          carrierName,
          scac: profile.scac,
        }
      );

      const rawScore =
        base +
        insuranceScore +
        safetyScore +
        preferredScore +
        onTimeScore +
        tenderAcceptanceScore +
        recentHistoryScore +
        accountMemoryScore;

      const score = Math.max(0, Math.min(100, rawScore));

      const isEligible =
        supportsMode &&
        supportsEquipment &&
        (requireInsurance ? hasInsurance : true) &&
        (requireSafetyCheck ? isSafetySatisfactory : true);

      return {
        carrierId: cId,
        carrierProfileId: profile.id,
        carrierName,
        scac: profile.scac ?? undefined,
        mc: profile.mc ?? profile.mcNumber ?? undefined,
        dot: profile.dot ?? profile.dotNumber ?? undefined,
        score,
        isEligible,
        isPreferred,
        hasInsurance,
        safetyStatus: profile.safetyStatus ?? undefined,
        onTimeDeliveryRate: onTimeRate,
        tenderAcceptanceRate,
        recentRejectionCount,
        scoreBreakdown: {
          base,
          insurance: insuranceScore,
          safety: safetyScore,
          preferred: preferredScore,
          onTime: onTimeScore,
          tenderAcceptance: tenderAcceptanceScore,
          recentHistory: recentHistoryScore,
          accountMemory: accountMemoryScore,
        },
      } satisfies ScoredCarrier;
    })
    .filter((c): c is ScoredCarrier => c !== null);

  // Sort: eligible carriers first, then by score descending
  scored.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    const nameDelta = a.carrierName.localeCompare(b.carrierName);
    return nameDelta !== 0 ? nameDelta : a.carrierId.localeCompare(b.carrierId);
  });

  return scored;
}

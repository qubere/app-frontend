import type { Prisma, PrismaClient } from "@prisma/client";
import { LegDocumentRequirement } from "@prisma/client";
import { inferShipmentLegs, type InferenceResult, type InferredLeg, type ShipmentInput, type DocumentInput, type IdentifierInput } from "./inferLegs";
import { generateDiffProposal, type ExistingLegSnapshot, type JourneyDiffProposal } from "./diffProposal";
import { inferLegDocuments, type LegDocumentContext } from "./inferLegDocuments";

type Db = PrismaClient | Prisma.TransactionClient;

export interface RunInferenceArgs {
  shipment: ShipmentInput & { accountId: string };
  documents: DocumentInput[];
  identifiers: IdentifierInput[];
  existingLegs: ExistingLegSnapshot[];
  nowIso: string;
}

export interface RunInferenceOutput {
  inference: InferenceResult;
  proposal: JourneyDiffProposal;
}

export function runInference(args: RunInferenceArgs): RunInferenceOutput {
  const inference = inferShipmentLegs(args.shipment, args.documents, args.identifiers);
  const proposal = generateDiffProposal(args.shipment.id, args.nowIso, args.existingLegs, inference);
  return { inference, proposal };
}

function legDocContext(shipment: ShipmentInput): LegDocumentContext {
  return {
    isUsImport: (shipment.destinationCountry ?? "US").toUpperCase() === "US",
    hasPreferenceClaim: !!shipment.incoterm && /usmca|cusma|nafta|gsp|preference/i.test(shipment.incoterm),
  };
}

/**
 * Transactionally materialise an inference result: creates the inference-run
 * record, the shared stops, the legs, and each leg's document checklist. Only
 * ever call this when the shipment has zero legs, or from the accept-proposal
 * flow. Returns the created run id.
 */
export async function applyInferredJourney(
  tx: Db,
  args: {
    accountId: string;
    shipment: ShipmentInput;
    inference: InferenceResult;
    proposal: JourneyDiffProposal;
    model?: string;
    appliedByUserId?: string | null;
  }
): Promise<string> {
  const { accountId, shipment, inference, proposal } = args;

  const run = await tx.legInferenceRun.upsert({
    where: { shipmentId_inputsHash: { shipmentId: shipment.id, inputsHash: inference.inputsHash } },
    update: {
      status: "APPLIED",
      appliedAt: new Date(),
      appliedByUserId: args.appliedByUserId ?? null,
      overallConfidence: inference.overallConfidence,
      legCount: inference.legs.length,
      proposal: proposal as unknown as Prisma.InputJsonValue,
    },
    create: {
      accountId,
      shipmentId: shipment.id,
      inputsHash: inference.inputsHash,
      model: args.model ?? "rules-v1",
      overallConfidence: inference.overallConfidence,
      legCount: inference.legs.length,
      proposal: proposal as unknown as Prisma.InputJsonValue,
      status: "APPLIED",
      appliedAt: new Date(),
      appliedByUserId: args.appliedByUserId ?? null,
    },
  });

  // Allocate stop sequences after any existing stops on the shipment.
  const maxStop = await tx.shipmentStop.aggregate({
    where: { shipmentId: shipment.id },
    _max: { sequence: true },
  });
  let stopSeq = (maxStop._max.sequence ?? 0) + 1;

  const legDocCtx = legDocContext(shipment);
  let prevStopId: string | null = null;

  for (let i = 0; i < inference.legs.length; i++) {
    const leg: InferredLeg = inference.legs[i];
    const isFinal = i === inference.legs.length - 1;

    const originStopId =
      prevStopId ??
      (
        await tx.shipmentStop.create({
          data: {
            accountId,
            shipmentId: shipment.id,
            sequence: stopSeq++,
            type: leg.originRole,
            role: leg.originRole,
            name: leg.originName,
            unlocode: leg.originUnlocode,
          },
        })
      ).id;

    const destStop = await tx.shipmentStop.create({
      data: {
        accountId,
        shipmentId: shipment.id,
        sequence: stopSeq++,
        type: leg.destinationRole,
        role: leg.destinationRole,
        name: leg.destinationName,
        unlocode: leg.destinationUnlocode,
      },
    });
    prevStopId = destStop.id;

    const createdLeg = await tx.shipmentLeg.create({
      data: {
        accountId,
        shipmentId: shipment.id,
        sequence: leg.sequence,
        legType: leg.legType,
        mode: leg.mode,
        originStopId,
        destinationStopId: destStop.id,
        carrierName: leg.carrierName,
        carrierScac: leg.carrierScac,
        vesselName: leg.vesselName,
        voyageNumber: leg.voyageNumber,
        billOfLadingNumber: leg.billOfLadingNumber,
        billOfLadingType: leg.billOfLadingType,
        bookingNumber: leg.bookingNumber,
        confidence: leg.confidence,
        source: "INFERRED",
        inferredFromRunId: run.id,
        confirmedAt: null,
      },
    });

    await createChecklist(tx, accountId, createdLeg.id, run.id, leg.legType, leg.mode, { ...legDocCtx, isFinalLeg: isFinal });
  }

  return run.id;
}

async function createChecklist(
  tx: Db,
  accountId: string,
  legId: string,
  runId: string,
  legType: InferredLeg["legType"],
  mode: InferredLeg["mode"],
  ctx: LegDocumentContext
) {
  const { slots } = inferLegDocuments(legType, mode, ctx);
  if (slots.length === 0) return;
  await tx.shipmentLegDocument.createMany({
    data: slots.map((s) => ({
      accountId,
      legId,
      slotKey: s.slotKey,
      slotLabel: s.slotLabel,
      expectedDocType: s.expectedDocType,
      requirement: s.requirement as LegDocumentRequirement,
      requirementReason: s.requirementReason,
      source: "INFERRED",
      inferredFromRunId: runId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Append the inferred legs that sit beyond the shipment's current leg count
 * (used by the accept-proposal flow when a shipment already has confirmed
 * legs and a new document reveals a downstream move). Returns the run id.
 */
export async function appendInferredLegs(
  tx: Db,
  args: {
    accountId: string;
    shipment: ShipmentInput;
    inference: InferenceResult;
    proposal: JourneyDiffProposal;
    existingLegCount: number;
    lastDestinationStopId: string | null;
    model?: string;
    appliedByUserId?: string | null;
  }
): Promise<string> {
  const { accountId, shipment, inference, proposal, existingLegCount } = args;

  const run = await tx.legInferenceRun.upsert({
    where: { shipmentId_inputsHash: { shipmentId: shipment.id, inputsHash: inference.inputsHash } },
    update: { status: "APPLIED", appliedAt: new Date(), appliedByUserId: args.appliedByUserId ?? null },
    create: {
      accountId,
      shipmentId: shipment.id,
      inputsHash: inference.inputsHash,
      model: args.model ?? "rules-v1",
      overallConfidence: inference.overallConfidence,
      legCount: inference.legs.length,
      proposal: proposal as unknown as Prisma.InputJsonValue,
      status: "APPLIED",
      appliedAt: new Date(),
      appliedByUserId: args.appliedByUserId ?? null,
    },
  });

  const tail = inference.legs.slice(existingLegCount);
  if (tail.length === 0) return run.id;

  const maxStop = await tx.shipmentStop.aggregate({
    where: { shipmentId: shipment.id },
    _max: { sequence: true },
  });
  let stopSeq = (maxStop._max.sequence ?? 0) + 1;
  const legDocCtx = legDocContext(shipment);
  let prevStopId = args.lastDestinationStopId;

  for (let i = 0; i < tail.length; i++) {
    const leg = tail[i];
    const isFinal = i === tail.length - 1;
    const originStopId =
      prevStopId ??
      (
        await tx.shipmentStop.create({
          data: {
            accountId, shipmentId: shipment.id, sequence: stopSeq++,
            type: leg.originRole, role: leg.originRole, name: leg.originName, unlocode: leg.originUnlocode,
          },
        })
      ).id;
    const destStop = await tx.shipmentStop.create({
      data: {
        accountId, shipmentId: shipment.id, sequence: stopSeq++,
        type: leg.destinationRole, role: leg.destinationRole, name: leg.destinationName, unlocode: leg.destinationUnlocode,
      },
    });
    prevStopId = destStop.id;

    const createdLeg = await tx.shipmentLeg.create({
      data: {
        accountId,
        shipmentId: shipment.id,
        sequence: existingLegCount + i + 1,
        legType: leg.legType,
        mode: leg.mode,
        originStopId,
        destinationStopId: destStop.id,
        carrierName: leg.carrierName,
        carrierScac: leg.carrierScac,
        vesselName: leg.vesselName,
        voyageNumber: leg.voyageNumber,
        billOfLadingNumber: leg.billOfLadingNumber,
        billOfLadingType: leg.billOfLadingType,
        bookingNumber: leg.bookingNumber,
        confidence: leg.confidence,
        source: "INFERRED",
        inferredFromRunId: run.id,
        confirmedAt: null,
      },
    });
    await createChecklist(tx, accountId, createdLeg.id, run.id, leg.legType, leg.mode, { ...legDocCtx, isFinalLeg: isFinal });
  }

  return run.id;
}

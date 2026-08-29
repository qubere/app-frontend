import { db } from "@/lib/db";
import type { ExistingLegSnapshot } from "@qubere/shipment-legs";

/** Load the documents / identifiers / existing legs that inference reads. */
export async function loadInferenceInputs(shipmentId: string) {
  const [documents, identifiers, existingLegs] = await Promise.all([
    db.shipmentDocument.findMany({
      where: { shipmentId },
      select: { id: true, docType: true, documentType: true, fileName: true, extractedJson: true },
    }),
    db.shipmentTrackingIdentifier.findMany({
      where: { shipmentId },
      select: { type: true, value: true },
    }),
    db.shipmentLeg.findMany({
      where: { shipmentId },
      orderBy: { sequence: "asc" },
      include: { originStop: { select: { name: true } }, destinationStop: { select: { name: true, id: true } } },
    }),
  ]);

  return {
    documents: documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      documentType: d.documentType,
      fileName: d.fileName,
      extractedJson: d.extractedJson,
    })),
    identifiers: identifiers.map((i) => ({ type: i.type, value: i.value })),
    existingLegs,
  };
}

export function legSnapshots(
  legs: Awaited<ReturnType<typeof loadInferenceInputs>>["existingLegs"]
): ExistingLegSnapshot[] {
  return legs.map((l) => ({
    id: l.id,
    sequence: l.sequence,
    legType: l.legType,
    mode: l.mode,
    originName: l.originStop?.name ?? "",
    destinationName: l.destinationStop?.name ?? "",
    confirmedAt: l.confirmedAt,
    actualDeparture: l.actualDeparture,
    actualArrival: l.actualArrival,
  }));
}

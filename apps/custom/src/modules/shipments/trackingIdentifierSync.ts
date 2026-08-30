/**
 * Materialises transport identifiers found in a document's structured
 * extraction into `ShipmentTrackingIdentifier` rows on the shipment the
 * document is attached to.
 *
 * Why: the identifier side-table is what `shipmentMatching.ts` resolves
 * container / BOL / booking / AWB tokens against when auto-attaching the *next*
 * inbound document. Historically nothing wrote these from extraction (the
 * fieldInventory note calls the TrackingMaterializer "a stub"), so the matcher
 * had nothing to match on beyond shipment number + PO. This closes that loop.
 *
 * Deterministic and idempotent: exact values only, upserted on the model's
 * natural key. No inference, no fuzzy parsing.
 */

import { db } from "@/lib/db";
import type { TrackingIdentifierType } from "@prisma/client";
import { isValidContainerNumber, normalizeIdentifier } from "@/modules/shipments/identifierExtraction";

interface SyncInput {
  accountId: string;
  shipmentId: string;
  /** `extractedJson.tradeMetadata` (camelCase keys). */
  tradeMetadata: Record<string, unknown> | null | undefined;
  /** Document display type name, e.g. "House Bill of Lading" — used to pick MBL vs HBL. */
  docTypeName: string | null | undefined;
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

/** Split a "MSKU1234567, TCLU7654321" style value into individual tokens. */
function splitList(raw: string): string[] {
  return raw
    .split(/[,;/\n]+|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

export interface PlannedIdentifier {
  type: TrackingIdentifierType;
  value: string;
}

/** Pure: derive the identifier rows a document's extraction implies. Exported for tests. */
export function planTrackingIdentifiers(
  tradeMetadata: Record<string, unknown> | null | undefined,
  docTypeName: string | null | undefined
): PlannedIdentifier[] {
  if (!tradeMetadata) return [];
  const isHouse = /house/i.test(docTypeName ?? "");
  const out: PlannedIdentifier[] = [];
  const seen = new Set<string>();

  const push = (type: TrackingIdentifierType, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;
    const key = `${type}:${normalizeIdentifier(value)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, value });
  };

  // Bill of lading — house doc → HBL, otherwise MBL (the common case for a BL).
  for (const k of ["transportDocumentNumber", "billOfLading", "blNumber", "masterBillNumber"]) {
    const v = asString(tradeMetadata[k]);
    if (v) push(isHouse ? "HBL" : "MBL", v);
  }
  const houseBl = asString(tradeMetadata["houseBillNumber"]);
  if (houseBl) push("HBL", houseBl);

  // Air waybill — same house/master split.
  for (const k of ["airWaybill", "awbNumber", "masterAirWaybill"]) {
    const v = asString(tradeMetadata[k]);
    if (v) push(isHouse ? "HAWB" : "MAWB", v);
  }
  const hawb = asString(tradeMetadata["houseAirWaybill"]);
  if (hawb) push("HAWB", hawb);

  // Booking.
  for (const k of ["bookingNumber", "carrierBookingNumber"]) {
    const v = asString(tradeMetadata[k]);
    if (v) push("BOOKING", v);
  }

  // Containers — often a delimited list. Keep only ISO 6346-valid numbers;
  // a malformed container string is not worth persisting as a match key.
  for (const k of ["containerNumber", "containerNumbers", "container_numbers"]) {
    const v = asString(tradeMetadata[k]);
    if (!v) continue;
    for (const tok of splitList(v)) {
      if (isValidContainerNumber(normalizeIdentifier(tok))) push("CONTAINER", normalizeIdentifier(tok));
    }
  }

  return out;
}

/**
 * Inserts the identifiers implied by a document's extraction onto its shipment.
 * Idempotent — existing rows (same shipment/type/value) are skipped. Returns
 * the number of rows actually created.
 */
export async function syncTrackingIdentifiersFromExtraction(input: SyncInput): Promise<number> {
  const planned = planTrackingIdentifiers(input.tradeMetadata, input.docTypeName);
  if (planned.length === 0) return 0;

  const result = await db.shipmentTrackingIdentifier.createMany({
    data: planned.map((p) => ({
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      type: p.type,
      value: p.value,
      issuer: "",
      isPrimary: false,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

import { db } from "@/lib/db";
import type { DocumentEntityType } from "@prisma/client";

export interface ResolvedEntity {
  entityType: DocumentEntityType;
  entityId: string;
  entityDisplayId: string | null;
}

/**
 * Centralized tenant-scoped lookup for association targets. Every supported
 * `DocumentEntityType` must be validated here so link/unlink can never be
 * called against another account's entity, regardless of which route or
 * caller triggers it. Returns null (not a thrown error) when the entity does
 * not exist in this account -- callers turn that into a 400/404 response.
 */
export async function resolveAssociationEntity(
  accountId: string,
  entityType: DocumentEntityType,
  entityId: string
): Promise<ResolvedEntity | null> {
  switch (entityType) {
    case "SHIPMENT": {
      const shipment = await db.shipment.findFirst({
        where: { id: entityId, accountId },
        select: { id: true, shipmentNumber: true },
      });
      return shipment
        ? { entityType, entityId: shipment.id, entityDisplayId: shipment.shipmentNumber }
        : null;
    }
    case "PARTY": {
      const party = await db.party.findFirst({
        where: { id: entityId, accountId },
        select: { id: true, internalPartyCode: true },
      });
      return party
        ? { entityType, entityId: party.id, entityDisplayId: party.internalPartyCode ?? party.id }
        : null;
    }
    case "PRODUCT": {
      const product = await db.product.findFirst({
        where: { id: entityId, accountId },
        select: { id: true, productName: true },
      });
      return product
        ? { entityType, entityId: product.id, entityDisplayId: product.productName }
        : null;
    }
    case "LICENSE": {
      const license = await db.license.findFirst({
        where: { id: entityId, accountId },
        select: { id: true, licenseNumber: true },
      });
      return license
        ? { entityType, entityId: license.id, entityDisplayId: license.licenseNumber }
        : null;
    }
    case "FILING": {
      const filing = await db.customsFiling.findFirst({
        where: { id: entityId, accountId },
        select: { id: true, entryNumber: true },
      });
      return filing
        ? { entityType, entityId: filing.id, entityDisplayId: filing.entryNumber }
        : null;
    }
    default:
      return null;
  }
}

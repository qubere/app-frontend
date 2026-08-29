// Allocation/reservation against a managed License Line (prompt section 38).
// Reserving an allocation ALSO posts an ASSIGNMENT LicenseEvent so the
// line's committed totals stay in sync with the reservation -- allocation
// state and utilization ledger state are never allowed to drift apart.
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { Decimal } from "@/lib/tariff/decimal";
import { postLicenseEvent, LicenseEventConflictError } from "./utilizationService";

export interface ReserveAllocationInput {
  accountId: string;
  licenseLineId: string;
  determinationId?: string | null;
  shipmentId?: string | null;
  lineItemId?: string | null;
  quantity?: number | string | null;
  value?: number | string | null;
  transactionId?: string | null;
  transactionLineId?: string | null;
  userId?: string | null;
}

export class InsufficientLicenseCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientLicenseCapacityError";
  }
}

/** Reserves remaining license-line capacity. Throws InsufficientLicenseCapacityError if the request exceeds what remains. */
export async function reserveLicenseAllocation(input: ReserveAllocationInput) {
  const line = await db.licenseLine.findFirst({ where: { id: input.licenseLineId, accountId: input.accountId } });
  if (!line) throw new Error(`License line ${input.licenseLineId} not found for this account.`);

  const requestedQuantity = new Decimal(input.quantity ?? 0);
  if (line.licensedQuantity != null && requestedQuantity.greaterThan(0)) {
    const remaining = new Decimal(line.licensedQuantity)
      .minus(new Decimal(line.committedQuantity))
      .minus(new Decimal(line.shippedQuantity))
      .plus(new Decimal(line.adjustedQuantity));
    if (requestedQuantity.greaterThan(remaining)) {
      throw new InsufficientLicenseCapacityError(
        `Requested quantity ${requestedQuantity.toString()} exceeds remaining license-line capacity ${remaining.toString()}.`
      );
    }
  }

  // Sync the ledger first (this call is itself concurrency-safe/deduped); if
  // it fails, no allocation row is created.
  await postLicenseEvent({
    accountId: input.accountId,
    licenseLineId: input.licenseLineId,
    eventType: "ASSIGNMENT",
    quantityDelta: input.quantity ?? 0,
    valueDelta: input.value ?? 0,
    transactionId: input.transactionId ?? input.shipmentId ?? undefined,
    transactionLineId: input.transactionLineId ?? input.lineItemId ?? undefined,
    shipmentId: input.shipmentId ?? undefined,
    reason: "License allocation reservation",
    userId: input.userId ?? undefined,
  });

  const allocation = await db.licenseAllocation.create({
    data: {
      accountId: input.accountId,
      licenseLineId: input.licenseLineId,
      determinationId: input.determinationId ?? null,
      shipmentId: input.shipmentId ?? null,
      lineItemId: input.lineItemId ?? null,
      quantity: input.quantity != null ? new Decimal(input.quantity) : null,
      value: input.value != null ? new Decimal(input.value) : null,
      status: "RESERVED",
      reservedByUserId: input.userId ?? null,
    },
  });

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId ?? null,
    action: "LICENSE_ALLOCATION_RESERVED",
    entity: "LicenseAllocation",
    entityId: allocation.id,
    source: "API",
    metadata: { licenseLineId: input.licenseLineId, quantity: input.quantity ?? null, value: input.value ?? null },
  });

  return allocation;
}

/** Releases a RESERVED allocation, reversing the ledger commitment it made. */
export async function releaseLicenseAllocation(params: { accountId: string; allocationId: string; userId?: string | null; reason?: string }) {
  const allocation = await db.licenseAllocation.findFirst({ where: { id: params.allocationId, accountId: params.accountId } });
  if (!allocation) throw new Error(`License allocation ${params.allocationId} not found for this account.`);
  if (allocation.status !== "RESERVED") {
    throw new Error(`License allocation ${params.allocationId} is not RESERVED (current status: ${allocation.status}).`);
  }

  await postLicenseEvent({
    accountId: params.accountId,
    licenseLineId: allocation.licenseLineId,
    eventType: "RELEASE",
    quantityDelta: allocation.quantity ? new Decimal(allocation.quantity).toString() : 0,
    valueDelta: allocation.value ? new Decimal(allocation.value).toString() : 0,
    transactionId: allocation.id,
    reason: params.reason ?? "License allocation released",
    userId: params.userId ?? undefined,
  });

  const updated = await db.licenseAllocation.update({
    where: { id: allocation.id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  await createAuditLog({
    accountId: params.accountId,
    userId: params.userId ?? null,
    action: "LICENSE_ALLOCATION_RELEASED",
    entity: "LicenseAllocation",
    entityId: updated.id,
    source: "API",
    metadata: { licenseLineId: allocation.licenseLineId },
  });

  return updated;
}

export { LicenseEventConflictError };

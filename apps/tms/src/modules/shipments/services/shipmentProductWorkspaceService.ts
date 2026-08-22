import { db } from "@qubere/db";
import { assertProductEntitlement } from "@qubere/auth";

export type ProductWorkspaceType = "TMS" | "CUSTOMS";
export type WorkspaceStatus = "ACTIVE" | "INACTIVE" | "AVAILABLE_FROM_TMS";

export interface ActivateWorkspaceInput {
  accountId: string;
  shipmentId: string;
  product: ProductWorkspaceType;
  userId?: string;
  source?: string;
  status?: WorkspaceStatus;
}

export async function activateProductWorkspace(input: ActivateWorkspaceInput) {
  const { accountId, shipmentId, product, userId, source = "SYSTEM", status = "ACTIVE" } = input;

  if (status === "ACTIVE") {
    await assertProductEntitlement(accountId, product);
  }

  const existing = await db.shipmentProductWorkspace.findFirst({
    where: {
      shipmentId,
      product,
    },
  });

  if (existing) {
    if (existing.status === status) {
      return existing;
    }
    return db.shipmentProductWorkspace.update({
      where: { id: existing.id },
      data: {
        status,
        activatedAt: new Date(),
        activatedByUserId: userId ?? existing.activatedByUserId,
      },
    });
  }

  return db.shipmentProductWorkspace.create({
    data: {
      accountId,
      shipmentId,
      product,
      status,
      source,
      activatedByUserId: userId,
    },
  });
}

export async function getProductWorkspaceStatus(
  accountId: string,
  shipmentId: string,
  product: ProductWorkspaceType
) {
  return db.shipmentProductWorkspace.findFirst({
    where: {
      accountId,
      shipmentId,
      product,
    },
  });
}

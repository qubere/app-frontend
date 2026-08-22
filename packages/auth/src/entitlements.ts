import { db } from "@qubere/db";

export class AccountNotEntitledError extends Error {
  constructor(public accountId: string, public product: string) {
    super(`Account ${accountId} is not entitled to ${product} product.`);
    this.name = "AccountNotEntitledError";
  }
}

export async function hasProductEntitlement(accountId: string, product: string): Promise<boolean> {
  const entitlement = await db.accountProductEntitlement.findFirst({
    where: {
      accountId,
      product,
    },
  });
  return entitlement?.status === "ACTIVE";
}

export async function assertProductEntitlement(accountId: string, product: string): Promise<void> {
  const entitled = await hasProductEntitlement(accountId, product);
  if (!entitled) {
    throw new AccountNotEntitledError(accountId, product);
  }
}

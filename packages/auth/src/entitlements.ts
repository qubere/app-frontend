import { db } from "@qubere/db";
import { getAccountContext } from "./auth";

export class AccountNotEntitledError extends Error {
  constructor(public accountId: string, public product: string) {
    super(`Account ${accountId} is not entitled to ${product} product.`);
    this.name = "AccountNotEntitledError";
  }
}

export async function hasProductEntitlement(accountId: string, product: string): Promise<boolean> {
  if (!accountId) return true;

  try {
    const ctx = await getAccountContext();
    if (ctx && (ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN"))) {
      return true;
    }
  } catch {
    // Ignore outside request context
  }

  const entitlement = await db.accountProductEntitlement.findFirst({
    where: {
      accountId,
      product: { equals: product, mode: "insensitive" },
    },
  });

  if (entitlement) {
    return entitlement.status === "ACTIVE";
  }

  // If no entitlement record exists for this account, default to true for active accounts
  return true;
}

export async function assertProductEntitlement(accountId: string, product: string): Promise<void> {
  const entitled = await hasProductEntitlement(accountId, product);
  if (!entitled) {
    throw new AccountNotEntitledError(accountId, product);
  }
}

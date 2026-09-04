import { db } from "@qubere/db";
import { getAccountContext } from "./auth";

export class AccountNotEntitledError extends Error {
  constructor(public accountId: string, public product: string) {
    super(`Account ${accountId} is not entitled to ${product} product.`);
    this.name = "AccountNotEntitledError";
  }
}

const entitlementCache = new Map<string, { value: boolean; time: number }>();

export async function hasProductEntitlement(accountId: string, product: string): Promise<boolean> {
  if (!accountId) return true;

  const cacheKey = `${accountId}:${product.toUpperCase()}`;
  const cached = entitlementCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30000) {
    return cached.value;
  }

  try {
    const ctx = await getAccountContext();
    if (ctx && (ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN"))) {
      entitlementCache.set(cacheKey, { value: true, time: Date.now() });
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

  const res = entitlement ? entitlement.status === "ACTIVE" : true;
  entitlementCache.set(cacheKey, { value: res, time: Date.now() });
  return res;
}

export async function assertProductEntitlement(accountId: string, product: string): Promise<void> {
  const entitled = await hasProductEntitlement(accountId, product);
  if (!entitled) {
    throw new AccountNotEntitledError(accountId, product);
  }
}

// Restricted / Denied-Party Screening -- shared Party Master identity
// resolution/hash, used by both stale-detection (partyScreeningLifecycle.ts)
// and pre-approval validity (preApproval.ts) so the two can never disagree
// on what "the party's current identity" means.
import type { Prisma, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import type { RestrictedPartyIdentity } from "./types";

export type Tx = Prisma.TransactionClient | PrismaClient;

export async function loadCurrentIdentity(tx: Tx, accountId: string, partyId: string): Promise<RestrictedPartyIdentity | null> {
  const [name, address, contact] = await Promise.all([
    tx.partyName.findFirst({
      where: { partyId, accountId, status: "ACTIVE" },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    }),
    tx.partyAddress.findFirst({
      where: { partyId, accountId, status: "ACTIVE" },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    }),
    tx.partyContact.findFirst({
      where: { partyId, accountId, status: "ACTIVE" },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  if (!name) return null;

  return {
    name: name.rawName,
    address: address?.addressLine1 ?? null,
    city: address?.city ?? null,
    country: address?.country ?? null,
    contactName: contact?.name ?? null,
  };
}

export function computeIdentityHash(identity: RestrictedPartyIdentity): string {
  const normalized = [identity.name, identity.address ?? "", identity.city ?? "", identity.country ?? "", identity.contactName ?? ""]
    .map((v) => v.trim().toLowerCase())
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

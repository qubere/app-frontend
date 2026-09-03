// Restricted / Denied-Party Screening -- ingestion-time search-token sync.
//
// Every ingestion service that writes ScreeningEntity rows (OFAC/BIS/UFLPA,
// Dow Jones, FBI Wanted, SAM.gov Exclusions, FDA Debarment) calls this once
// per upsert batch so RPS's indexed candidate layer (candidateIndexService.ts)
// stays in sync with the reference data it's built from. Delete-then-insert
// per batch keeps this idempotent on retry -- a crashed/retried batch never
// accumulates duplicate tokens.
import { db } from "@/lib/db";
import { buildSearchTokenRows } from "@/modules/agents/compliance/restrictedParty/searchTokenGeneration";

/** Regenerates ScreeningSearchToken rows for exactly these entities. Safe to call with a small batch (one ingestion upsert batch) or a backfill page -- always scoped to the given ids, never a full-table operation. */
export async function syncSearchTokensForEntities(entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) return;

  const entities = await db.screeningEntity.findMany({
    where: { id: { in: entityIds } },
    select: { id: true, name: true, alternateNames: true, address: true, city: true, country: true },
  });
  const aliases = await db.screeningEntityAlias.findMany({
    where: { screeningEntityId: { in: entityIds } },
    select: { screeningEntityId: true, name: true },
  });
  const addresses = await db.screeningEntityAddress.findMany({
    where: { screeningEntityId: { in: entityIds } },
    select: { screeningEntityId: true, addressLine: true, city: true, stateOrProvince: true, countryName: true },
  });

  const aliasesByEntity = new Map<string, { name: string }[]>();
  for (const alias of aliases) {
    const list = aliasesByEntity.get(alias.screeningEntityId);
    if (list) list.push({ name: alias.name });
    else aliasesByEntity.set(alias.screeningEntityId, [{ name: alias.name }]);
  }

  const addressesByEntity = new Map<string, { addressLine: string | null; city: string | null; stateOrProvince: string | null; countryName: string | null }[]>();
  for (const addr of addresses) {
    const list = addressesByEntity.get(addr.screeningEntityId);
    const entry = { addressLine: addr.addressLine, city: addr.city, stateOrProvince: addr.stateOrProvince, countryName: addr.countryName };
    if (list) list.push(entry);
    else addressesByEntity.set(addr.screeningEntityId, [entry]);
  }

  const rows = entities.flatMap((entity) =>
    buildSearchTokenRows({
      id: entity.id,
      name: entity.name,
      alternateNames: entity.alternateNames,
      aliases: aliasesByEntity.get(entity.id) ?? [],
      address: entity.address,
      city: entity.city,
      country: entity.country,
      addresses: addressesByEntity.get(entity.id) ?? [],
    })
  );

  await db.$transaction([
    db.screeningSearchToken.deleteMany({ where: { screeningEntityId: { in: entityIds } } }),
    ...(rows.length > 0 ? [db.screeningSearchToken.createMany({ data: rows })] : []),
  ]);
}

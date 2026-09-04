/**
 * The importer detail page's "Also known as" summary (#320 spec §3.5): what
 * else this importer's Party does, besides being an importer. Pure and
 * DB-free -- the route fetches the shape below, this decides what to show.
 *
 * A null party (not yet bridged -- pre-backfill, or resolution never
 * succeeded) is a real, expected state, not an error: it just means there
 * is nothing to say yet.
 */

export interface AlsoKnownAsPartyInput {
  id: string;
  roles: readonly { roleType: string; status: string }[];
  /** Every LegalEntity bridged to this same Party, including the one this
   *  importer's own legal entity is (a Party can be bridged from more than
   *  one LegalEntity row -- see resolvePartyForCompany's EXACT_MATCH path). */
  legalEntities: readonly { id: string; _count: { productParties: number; shipmentParties: number } }[];
}

export interface AlsoKnownAsSummary {
  /** Active role types this party holds, other than IMPORTER. */
  otherRoles: string[];
  /** Other LegalEntity rows (besides this importer's own) bridged to the same party. */
  linkedLegalEntityCount: number;
  /** Products this party (across every bridged legal entity) appears on. */
  productPartyCount: number;
  /** Shipments this party (across every bridged legal entity) appears on. */
  shipmentPartyCount: number;
}

export function buildAlsoKnownAs(
  party: AlsoKnownAsPartyInput | null,
  currentLegalEntityId: string
): AlsoKnownAsSummary | null {
  if (party === null) return null;

  const otherRoles = party.roles
    .filter((role) => role.status === "ACTIVE" && role.roleType !== "IMPORTER")
    .map((role) => role.roleType);

  const linkedLegalEntityCount = party.legalEntities.filter((entity) => entity.id !== currentLegalEntityId).length;
  const productPartyCount = party.legalEntities.reduce((sum, entity) => sum + entity._count.productParties, 0);
  const shipmentPartyCount = party.legalEntities.reduce((sum, entity) => sum + entity._count.shipmentParties, 0);

  return { otherRoles, linkedLegalEntityCount, productPartyCount, shipmentPartyCount };
}

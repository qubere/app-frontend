/**
 * Resolves a company description — a name plus whatever identity evidence a
 * caller has (tax ID, registration number, address) — to a `Party`, using the
 * same deterministic matcher every other party-matching path in this module
 * uses (`matchParty` / `findPartyMatches`). This is the shared identity
 * resolution step issue #320 introduces: onboarding a new importer, an ERP
 * sync, and a parsed document all resolve "is this company already in the
 * master" through this one function instead of three separate ad hoc
 * comparisons.
 *
 * Deliberately role-agnostic: this only resolves or creates the `Party`
 * identity. It never creates a `PartyRole`, and it never merges two parties
 * on its own judgment — an ambiguous or merely-possible match is handed back
 * to the caller as candidates, exactly like `findPartyMatches` already
 * refuses to auto-decide (see `partyMatching.ts`'s module comment: a shared
 * name is evidence for a person, never a determination). Every caller
 * remains responsible for its own role and its own "yes, that's the same
 * company" confirmation step.
 */

import type { PartyIdentifierType, PartyKind, PartyMatchStatus, PartySourceType } from "@prisma/client";
import { createParty, getParty, findPartyMatches, PartyNotFoundError, type PartyActor, type PartyDetail } from "./partyService";
import type { PartyMatchCandidate } from "./partyMatching";

export interface ResolvePartyForCompanyAddress {
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface ResolvePartyForCompanyInput {
  legalName: string;
  /** Paired with `legalName` for the name+country fallback rule, and used as
   *  the tax identifier's issuing country when one is supplied. */
  country: string;
  taxId?: string | null;
  /** Defaults to TAX_ID — the common case (EIN, foreign tax number). */
  taxIdType?: PartyIdentifierType;
  registrationNumber?: string | null;
  registrationCountry?: string | null;
  address?: ResolvePartyForCompanyAddress | null;
  clientId?: string | null;
  partyKind?: PartyKind;
  sourceType?: PartySourceType;
}

export type ResolvePartyForCompanyResult =
  | { outcome: "EXACT"; partyId: string; party: PartyDetail }
  | { outcome: "CANDIDATES"; status: Extract<PartyMatchStatus, "POSSIBLE_MATCH" | "AMBIGUOUS">; candidates: readonly PartyMatchCandidate[] }
  | { outcome: "CREATED"; partyId: string; party: PartyDetail };

export async function resolvePartyForCompany(
  actor: PartyActor,
  input: ResolvePartyForCompanyInput
): Promise<ResolvePartyForCompanyResult> {
  const taxId = input.taxId?.trim() || null;
  const taxIdType = input.taxIdType ?? "TAX_ID";
  const sourceType = input.sourceType ?? "USER";

  const match = await findPartyMatches(actor, {
    legalName: input.legalName,
    country: input.country,
    identifiers: taxId ? [{ identifierType: taxIdType, value: taxId, issuingCountry: input.country }] : undefined,
    registrationNumber: input.registrationNumber ?? undefined,
    registrationCountry: input.registrationCountry ?? undefined,
    clientId: input.clientId ?? undefined,
  });

  if (match.status === "EXACT_MATCH") {
    const partyId = match.candidates[0]!.partyId;
    const party = await getParty(actor, partyId);
    if (party === null) throw new PartyNotFoundError(partyId);
    return { outcome: "EXACT", partyId, party };
  }

  if (match.status === "POSSIBLE_MATCH" || match.status === "AMBIGUOUS") {
    return { outcome: "CANDIDATES", status: match.status, candidates: match.candidates };
  }

  const created = await createParty(actor, {
    clientId: input.clientId ?? null,
    partyKind: input.partyKind ?? "ORGANIZATION",
    names: [{ nameType: "LEGAL", rawName: input.legalName, isPrimary: true, sourceType }],
    identifiers: taxId
      ? [{ identifierType: taxIdType, value: taxId, issuingCountry: input.country, isPrimary: true, sourceType }]
      : undefined,
    registrations:
      input.registrationNumber && input.registrationCountry
        ? [{ registrationNumber: input.registrationNumber, country: input.registrationCountry, sourceType }]
        : undefined,
    addresses: input.address
      ? [{ addressType: "REGISTERED", ...input.address, isPrimary: true, sourceType }]
      : undefined,
  });

  return { outcome: "CREATED", partyId: created.id, party: created };
}

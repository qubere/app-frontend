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
 * `resolvePartyForCompany` is deliberately role-agnostic: it only resolves or
 * creates the `Party` identity, never a `PartyRole`, and it never merges two
 * parties on its own judgment — an ambiguous or merely-possible match is
 * handed back to the caller as candidates, exactly like `findPartyMatches`
 * already refuses to auto-decide (see `partyMatching.ts`'s module comment: a
 * shared name is evidence for a person, never a determination). Every caller
 * remains responsible for its own role and its own "yes, that's the same
 * company" confirmation step -- `ensurePartyRole` below is that explicit,
 * separate step, for callers that make one.
 */

import type { PartyIdentifierType, PartyKind, PartyMatchStatus, PartySourceType } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { addRole, createParty, getParty, findPartyMatches, PartyNotFoundError, type PartyActor, type PartyDetail } from "./partyService";
import type { PartyMatchCandidate } from "./partyMatching";
import type { partyRoleTypeSchema } from "./partySchemas";
import { logger } from "@/lib/logging/logger";

/**
 * `addRole`'s own input is typed off `partyRoleTypeSchema`, which is
 * narrower than the Prisma `PartyRoleType` enum (missing WAREHOUSE,
 * TERMINAL, DRAYAGE_PROVIDER -- a pre-existing gap between the schema and
 * the zod enum, not something this change introduces or widens). Typed off
 * the same schema here so this stays exactly as permissive as `addRole`
 * actually is, rather than accepting a value `addRole` would reject.
 */
type EnsurableRoleType = z.infer<typeof partyRoleTypeSchema>;

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
  sourceDocumentId?: string | null;
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

    if (input.sourceDocumentId) {
      const existingEvidence = await db.partyEvidence.findFirst({
        where: { accountId: actor.accountId, partyId, sourceDocumentId: input.sourceDocumentId },
        select: { id: true },
      });
      if (!existingEvidence) {
        await db.partyEvidence.create({
          data: {
            accountId: actor.accountId,
            partyId,
            sourceType: input.sourceType ?? "DOCUMENT",
            sourceDocumentId: input.sourceDocumentId,
            description: "Exact match promoted during company identity resolution",
          },
        });
      }
    }

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

/**
 * Adds `roleType` to a party if it does not already actively hold it.
 *
 * Deliberately a separate, explicitly-opted-into step from
 * `resolvePartyForCompany` above -- resolving identity and declaring a role
 * are different decisions (see this module's own doc comment), and this
 * function exists for callers that make a *deliberate* role assignment (a
 * person registering a company as an importer), not for passive or
 * low-confidence sources like unverified document extraction.
 *
 * Idempotent (checked here -- `addRole` itself has no such guard, since it
 * is also used to record a genuinely repeated role after one was removed)
 * and fail-open: this is the same additive-bridge shape as
 * `resolvePartyForCompany`'s callers already use, so a failure here must
 * never block whatever the caller is actually doing (e.g. registering an
 * importer). Errors are logged, not thrown.
 */
export async function ensurePartyRole(actor: PartyActor, partyId: string, roleType: EnsurableRoleType): Promise<void> {
  try {
    const existing = await db.partyRole.findFirst({
      where: { accountId: actor.accountId, partyId, roleType, status: "ACTIVE" },
      select: { id: true },
    });
    if (existing !== null) return;
    await addRole(actor, partyId, { roleType, sourceType: "USER" });
  } catch (error) {
    logger.warn("ensurePartyRole: failed to add party role", {
      accountId: actor.accountId,
      partyId,
      roleType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

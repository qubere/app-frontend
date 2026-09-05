/**
 * Deterministic Party lookup, shared across apps.
 *
 * This is the matching half of apps/custom's party-resolution flow only —
 * `matchParty`'s db-backed candidate query. It deliberately does not create a
 * Party: creation in apps/custom also runs denied-party screening
 * synchronously (`partyService.createParty` -> `rescreenParty`), which pulls
 * in the whole restricted-party screening engine and isn't reachable from
 * here. A caller that gets EXACT_MATCH should reuse that partyId; on
 * anything else it is still responsible for its own create (and, if it
 * matters for that caller, its own screening).
 */

import type { Prisma } from "@prisma/client";
import { db } from "@qubere/db";
import { matchParty, type MatchCandidateInput, type PartyMatchResult } from "./partyMatching";
import { normalizeIdentifier, normalizeLegalName } from "./partyNormalization";

export async function findPartyMatches(
  actor: { accountId: string },
  input: MatchCandidateInput
): Promise<PartyMatchResult> {
  const normalizedValues = (input.identifiers ?? [])
    .map((identifier) => normalizeIdentifier(identifier.value))
    .filter((value) => value !== "");

  const orClauses: Prisma.PartyWhereInput[] = [];
  if (normalizedValues.length > 0) {
    orClauses.push({ identifiers: { some: { normalizedValue: { in: normalizedValues }, status: "ACTIVE" } } });
  }
  if (input.registrationNumber != null && input.registrationCountry != null) {
    orClauses.push({
      registrations: {
        some: {
          registrationNumber: { equals: input.registrationNumber, mode: "insensitive" },
          status: { notIn: ["SUPERSEDED", "REJECTED"] },
        },
      },
    });
  }
  if (input.legalName != null && input.country != null) {
    orClauses.push({
      names: { some: { normalizedName: normalizeLegalName(input.legalName), status: "ACTIVE" } },
    });
  }

  if (orClauses.length === 0) {
    return { status: "NO_MATCH", candidates: [], rule: null };
  }

  const andClauses: Prisma.PartyWhereInput[] = [];
  if (input.clientId !== undefined) {
    if (input.clientId === null || input.clientId === "unassigned") {
      andClauses.push({ clientId: null });
    } else if (input.clientScope === "EXACT") {
      andClauses.push({ clientId: input.clientId });
    } else {
      andClauses.push({ OR: [{ clientId: input.clientId }, { clientId: null }] });
    }
  }

  const parties = await db.party.findMany({
    where: {
      accountId: actor.accountId,
      deletedAt: null,
      status: { notIn: ["ARCHIVED"] },
      AND: andClauses.length > 0 ? andClauses : undefined,
      OR: orClauses,
    },
    select: {
      id: true,
      clientId: true,
      identifiers: {
        where: { status: "ACTIVE" },
        select: { identifierType: true, normalizedValue: true, issuingCountry: true },
      },
      registrations: {
        where: { status: { notIn: ["SUPERSEDED", "REJECTED"] } },
        select: { registrationNumber: true, country: true },
      },
      names: { where: { status: "ACTIVE" }, select: { normalizedName: true } },
      addresses: { where: { status: "ACTIVE" }, select: { country: true } },
    },
    take: 200,
  });

  return matchParty(
    input,
    parties.map((party) => ({
      id: party.id,
      clientId: party.clientId,
      identifiers: party.identifiers,
      registrations: party.registrations.map((registration) => ({
        normalizedRegistrationNumber: normalizeIdentifier(registration.registrationNumber),
        country: registration.country,
      })),
      normalizedNames: party.names.map((name) => name.normalizedName),
      countries: [...new Set([...party.registrations.map((r) => r.country), ...party.addresses.map((a) => a.country)])],
    }))
  );
}

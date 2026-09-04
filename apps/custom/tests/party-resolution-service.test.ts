import { describe, expect, it, vi, beforeEach } from "vitest";

// resolvePartyForCompany is pure orchestration over already-tested primitives
// (findPartyMatches, createParty, getParty), so this exercises the branching
// — which primitive gets called, with what shape, and what never happens on
// each matcher outcome — against a mocked partyService rather than a live
// database. The matcher's own rule set is covered by partyMatching.test.ts;
// this test is only responsible for what resolvePartyForCompany does with
// its answer.

const findPartyMatches = vi.fn();
const createParty = vi.fn();
const getParty = vi.fn();

vi.mock("@/modules/party/partyService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/party/partyService")>();
  return {
    ...actual,
    findPartyMatches: (...args: unknown[]) => findPartyMatches(...args),
    createParty: (...args: unknown[]) => createParty(...args),
    getParty: (...args: unknown[]) => getParty(...args),
  };
});

const { resolvePartyForCompany } = await import("@/modules/party/partyResolutionService");

const actor = { accountId: "acct_1", userId: "user_1" };

const baseInput = {
  legalName: "Acme Components Ltd",
  country: "US",
  taxId: "12-3456789",
};

beforeEach(() => {
  findPartyMatches.mockReset();
  createParty.mockReset();
  getParty.mockReset();
});

describe("resolvePartyForCompany", () => {
  it("on EXACT_MATCH, loads and returns the existing party without creating anything", async () => {
    findPartyMatches.mockResolvedValue({
      status: "EXACT_MATCH",
      rule: "COUNTRY_QUALIFIED_IDENTIFIER",
      candidates: [{ partyId: "party_1", rule: "COUNTRY_QUALIFIED_IDENTIFIER", identifierType: "TAX_ID", matchedValue: "123456789", explanation: "matched" }],
    });
    getParty.mockResolvedValue({ id: "party_1", roles: [] });

    const result = await resolvePartyForCompany(actor, baseInput);

    expect(result).toEqual({ outcome: "EXACT", partyId: "party_1", party: { id: "party_1", roles: [] } });
    expect(getParty).toHaveBeenCalledWith(actor, "party_1");
    expect(createParty).not.toHaveBeenCalled();
  });

  it("throws if the exact match's party has vanished by the time it's loaded", async () => {
    findPartyMatches.mockResolvedValue({
      status: "EXACT_MATCH",
      rule: "UNIQUE_IDENTIFIER",
      candidates: [{ partyId: "party_ghost", rule: "UNIQUE_IDENTIFIER", identifierType: "EORI", matchedValue: "X", explanation: "matched" }],
    });
    getParty.mockResolvedValue(null);

    await expect(resolvePartyForCompany(actor, baseInput)).rejects.toThrow();
    expect(createParty).not.toHaveBeenCalled();
  });

  it.each(["POSSIBLE_MATCH", "AMBIGUOUS"] as const)(
    "on %s, hands back candidates and creates nothing — never auto-decides",
    async (status) => {
      const candidates = [
        { partyId: "party_a", rule: "NAME_AND_COUNTRY", identifierType: null, matchedValue: "acme / US", explanation: "name+country" },
      ];
      findPartyMatches.mockResolvedValue({ status, rule: "NAME_AND_COUNTRY", candidates });

      const result = await resolvePartyForCompany(actor, baseInput);

      expect(result).toEqual({ outcome: "CANDIDATES", status, candidates });
      expect(createParty).not.toHaveBeenCalled();
      expect(getParty).not.toHaveBeenCalled();
    }
  );

  it("on NO_MATCH, creates a new party from the supplied identity facts", async () => {
    findPartyMatches.mockResolvedValue({ status: "NO_MATCH", rule: null, candidates: [] });
    createParty.mockResolvedValue({ id: "party_new", roles: [] });

    const result = await resolvePartyForCompany(actor, {
      ...baseInput,
      address: { addressLine1: "1 Main St", city: "Austin", country: "US" },
      clientId: "client_1",
    });

    expect(result).toEqual({ outcome: "CREATED", partyId: "party_new", party: { id: "party_new", roles: [] } });
    expect(createParty).toHaveBeenCalledTimes(1);
    const [, input] = createParty.mock.calls[0]!;
    expect(input.clientId).toBe("client_1");
    expect(input.names).toEqual([{ nameType: "LEGAL", rawName: "Acme Components Ltd", isPrimary: true, sourceType: "USER" }]);
    expect(input.identifiers).toEqual([
      { identifierType: "TAX_ID", value: "12-3456789", issuingCountry: "US", isPrimary: true, sourceType: "USER" },
    ]);
    expect(input.addresses).toEqual([
      { addressType: "REGISTERED", addressLine1: "1 Main St", city: "Austin", country: "US", isPrimary: true, sourceType: "USER" },
    ]);
  });

  it("on NO_MATCH with no tax ID, creates a party with no identifiers rather than inventing one", async () => {
    findPartyMatches.mockResolvedValue({ status: "NO_MATCH", rule: null, candidates: [] });
    createParty.mockResolvedValue({ id: "party_new2", roles: [] });

    await resolvePartyForCompany({ ...actor }, { legalName: "New Co", country: "DE" });

    const [, input] = createParty.mock.calls[0]!;
    expect(input.identifiers).toBeUndefined();
    expect(input.addresses).toBeUndefined();
    expect(input.registrations).toBeUndefined();
  });

  it("passes the tax ID as a country-qualified identifier to the matcher, not as a bare string", async () => {
    findPartyMatches.mockResolvedValue({ status: "NO_MATCH", rule: null, candidates: [] });
    createParty.mockResolvedValue({ id: "party_new3", roles: [] });

    await resolvePartyForCompany(actor, baseInput);

    const [, matchInput] = findPartyMatches.mock.calls[0]!;
    expect(matchInput.identifiers).toEqual([{ identifierType: "TAX_ID", value: "12-3456789", issuingCountry: "US" }]);
  });

  it("never sends an accountId in the resolution input — tenancy comes from the actor", async () => {
    findPartyMatches.mockResolvedValue({ status: "NO_MATCH", rule: null, candidates: [] });
    createParty.mockResolvedValue({ id: "party_new4", roles: [] });

    await resolvePartyForCompany(actor, baseInput);

    const [passedActor] = findPartyMatches.mock.calls[0]!;
    expect(passedActor).toBe(actor);
    const [createActor] = createParty.mock.calls[0]!;
    expect(createActor).toBe(actor);
  });
});

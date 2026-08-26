import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: restrictedPartyRepository.ts's
// getRestrictedPartyReferenceList. Covers: the fetch includes both
// addresses (pre-existing) and aliases (newly wired in) so
// candidateGeneration.ts's alias-aware candidateNames() has data to read --
// a regression here would silently degrade back to name/alternateNames-only
// candidate generation with no test failure elsewhere, since Prisma would
// just omit the relation rather than error.

const screeningEntityFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    screeningEntity: { findMany: screeningEntityFindMany },
  },
}));

const { getRestrictedPartyReferenceList } = await import(
  "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRestrictedPartyReferenceList", () => {
  it("includes both addresses and aliases in the fetch", async () => {
    screeningEntityFindMany.mockResolvedValue([]);
    await getRestrictedPartyReferenceList();
    expect(screeningEntityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { addresses: true, aliases: true },
      })
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/parties/[id]'s "Also known as" data (#320 spec §3.5, §4): the
// party detail read gains carrierProfile and legalEntities blocks, mirroring
// the existing role-specific-extension pattern -- verified here by checking
// getParty actually asks Prisma for them, not by re-testing Prisma itself.

const mocks = vi.hoisted(() => ({ db: { party: { findFirst: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { getParty } = await import("../src/modules/party/partyService");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.party.findFirst.mockResolvedValue({ id: "party-1" });
});

describe("getParty -- Also known as data", () => {
  it("includes carrierProfile and bridged legal entities (with their importerOfRecord) in the detail read", async () => {
    await getParty({ accountId: "acct-1", userId: "user-1" }, "party-1");

    const call = mocks.db.party.findFirst.mock.calls[0]![0];
    expect(call.include.carrierProfile).toBe(true);
    expect(call.include.legalEntities).toEqual(
      expect.objectContaining({
        select: expect.objectContaining({
          importerOfRecord: expect.objectContaining({
            select: expect.objectContaining({ registrationStatus: true, cbpImporterNumber: true }),
          }),
          _count: { select: { productParties: true, shipmentParties: true } },
        }),
      })
    );
  });

  it("still scopes the read to the caller's account and to live rows -- unaffected by the new blocks", async () => {
    await getParty({ accountId: "acct-1", userId: "user-1" }, "party-1");

    const call = mocks.db.party.findFirst.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "party-1", accountId: "acct-1", deletedAt: null });
  });
});

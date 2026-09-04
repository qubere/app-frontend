import { describe, it, expect } from "vitest";
import { resolveInboundRoute, type InboundRouteLookup, type ResolvedInboundRoute } from "@/modules/inbound/senderRouting";

const ACCOUNT_A = "acct_a";
const ACCOUNT_B = "acct_b";

// Legacy shared-inbox lookup returns only one unambiguous account.
const ROUTES: Record<string, ResolvedInboundRoute> = {
  "jane@acme.com": { id: "route_1", accountId: ACCOUNT_A, defaultAssignedToUserId: "user_jane" },
  "accounts@target.com": { id: "route_2", accountId: ACCOUNT_B, defaultAssignedToUserId: null },
};

function makeLookup(overrides?: Partial<InboundRouteLookup>): InboundRouteLookup {
  return {
    async findActiveByNormalizedEmail(normalizedEmail) {
      return ROUTES[normalizedEmail] ?? null;
    },
    ...overrides,
  };
}

describe("inbound sender routing", () => {
  it("resolves an authorized sender to its account", async () => {
    const route = await resolveInboundRoute("jane@acme.com", makeLookup());
    expect(route).toEqual(ROUTES["jane@acme.com"]);
  });

  it("resolves after normalizing (whitespace/case)", async () => {
    const route = await resolveInboundRoute("  Jane@ACME.com  ", makeLookup());
    expect(route?.accountId).toBe(ACCOUNT_A);
  });

  it("returns null for an unknown sender -- never guesses a tenant", async () => {
    const route = await resolveInboundRoute("stranger@nowhere.com", makeLookup());
    expect(route).toBeNull();
  });

  it("resolves a route with no default assignee to a route with a null assignee, not an error", async () => {
    const route = await resolveInboundRoute("accounts@target.com", makeLookup());
    expect(route).toEqual({ id: "route_2", accountId: ACCOUNT_B, defaultAssignedToUserId: null });
  });


});

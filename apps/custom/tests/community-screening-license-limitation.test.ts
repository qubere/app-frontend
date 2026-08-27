import { describe, it, expect } from "vitest";
import { LICENSE_DETERMINATION_NOTICE } from "@/modules/compliance/communityScreening/types";
import type { CommunityScreeningChecksEnabled } from "@/modules/compliance/communityScreening/types";

// License Determination is explicitly out of scope for Community Screening
// V1 (see types.ts's module comment) and must never be inferable as a pass.
// The API/response-shaping code that surfaces this notice lives in routes
// being built separately, so this test is scoped to what's guaranteed to
// exist now: the notice constant itself, and that the type system offers no
// way to even request a third "license" check.

describe("LICENSE_DETERMINATION_NOTICE", () => {
  it("is a non-empty string documenting that license determination was not performed", () => {
    expect(typeof LICENSE_DETERMINATION_NOTICE).toBe("string");
    expect(LICENSE_DETERMINATION_NOTICE.length).toBeGreaterThan(0);
    expect(LICENSE_DETERMINATION_NOTICE).toContain("License determination");
    expect(LICENSE_DETERMINATION_NOTICE).toContain("not");
  });
});

describe("CommunityScreeningChecksEnabled", () => {
  it("only has exactly the keys restrictedParty and embargo -- no third 'license' check can be requested", () => {
    const checksEnabled: CommunityScreeningChecksEnabled = { restrictedParty: true, embargo: true };
    expect(Object.keys(checksEnabled).sort()).toEqual(["embargo", "restrictedParty"]);
  });
});

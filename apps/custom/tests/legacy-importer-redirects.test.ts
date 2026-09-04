import { describe, expect, it, vi } from "vitest";

// These pages call permanentRedirect() during render, before Clerk's
// middleware guard is reachable in a full Playwright session -- see
// e2e/importers-workflow.spec.ts's header note. This is the level this
// codebase's harness can actually exercise the redirect targets at.
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { permanentRedirect } from "next/navigation";
import LegacyBondsPage from "@/app/app/bonds/page";
import LegacyPoaPage from "@/app/app/poa/page";
import LegacyImportersPage from "@/app/app/importers-of-record/page";

describe("legacy importer/bond/POA redirects", () => {
  it("redirects /app/bonds into the importers bonds view", () => {
    expect(() => LegacyBondsPage()).toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/app/importers?view=bonds");
  });

  it("redirects /app/poa into the importers POA view", () => {
    expect(() => LegacyPoaPage()).toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/app/importers?view=poa");
  });

  it("redirects /app/importers-of-record into the unified registry", () => {
    expect(() => LegacyImportersPage()).toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/app/importers");
  });
});

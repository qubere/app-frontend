import { describe, it, expect } from "vitest";
import { visibleNavigation, navItemByHref } from "@/lib/navigation";

describe("Bonds, Importers of Record, and POA Navigation Surface", () => {
  const access = {
    roleNames: ["OWNER"],
    permissions: [],
    isPlatformAdmin: false,
  };

  it("exposes /app/clients, /app/importers-of-record, /app/bonds, and /app/poa in navigation lookup", () => {
    expect(navItemByHref("/app/clients")).toBeDefined();
    expect(navItemByHref("/app/importers-of-record")).toBeDefined();
    expect(navItemByHref("/app/bonds")).toBeDefined();
    expect(navItemByHref("/app/poa")).toBeDefined();
  });

  it("shows all four in the Management workspace of the sidebar", () => {
    // The IA redesign (docs/plans/features/NAVIGATION-IA-REDESIGN.md) promoted
    // bonds / POA / importers of record out of UNLISTED_NAV_ITEMS: they are
    // broker-critical legal records and were previously reachable only by deep
    // link.
    const sections = visibleNavigation(access);
    const management = sections.find((s) => s.id === "management");
    expect(management).toBeDefined();
    const hrefs = management!.items.map((i) => i.href);
    expect(hrefs).toEqual([
      "/app/clients",
      "/app/importers-of-record",
      "/app/bonds",
      "/app/poa",
    ]);
  });
});

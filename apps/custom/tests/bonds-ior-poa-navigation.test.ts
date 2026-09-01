import { describe, it, expect } from "vitest";
import { activeNavHref, canAccessHref, visibleNavigation, navItemByHref } from "@/lib/navigation";
import { en } from "@/lib/i18n/dictionaries/en";

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

  it("shows Onboarding and Clients and Importers as the Management destinations", () => {
    const sections = visibleNavigation(access);
    const management = sections.find((s) => s.id === "management");
    expect(management).toBeDefined();
    const hrefs = management!.items.map((i) => i.href);
    expect(hrefs).toEqual([
      "/app/onboarding",
      "/app/clients",
    ]);
    expect(management!.items.map((item) => en.nav[item.labelKey as keyof typeof en.nav])).toEqual([
      "Onboarding",
      "Clients and Importers",
    ]);
  });

  it("keeps every client tab accessible and highlights the shared sidebar destination", () => {
    const viewer = { roleNames: ["VIEWER"], permissions: [], isPlatformAdmin: false };
    const hrefs = visibleNavigation(viewer).flatMap((section) => section.items.map((item) => item.href));
    for (const href of ["/app/clients", "/app/importers-of-record", "/app/bonds", "/app/poa"]) {
      expect(canAccessHref(viewer, href)).toBe(true);
      expect(activeNavHref(href, hrefs)).toBe("/app/clients");
      expect(activeNavHref(`${href}/record-123`, hrefs)).toBe("/app/clients");
      expect(activeNavHref(`${href}-archive`, hrefs)).toBeNull();
    }
    expect(activeNavHref("/app/bonds", ["/app/shipments"])).toBeNull();
    expect(activeNavHref("/app/bonds", ["/app/clients", "/app/bonds"])).toBe("/app/bonds");
  });
});

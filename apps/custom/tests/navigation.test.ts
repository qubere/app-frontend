import { describe, it, expect } from "vitest";
import {
  NAV_SECTIONS,
  activeNavHref,
  canAccessHref,
  canAccessNavItem,
  isPathWithin,
  navItemByHref,
  visibleNavigation,
  type NavAccess,
} from "@/lib/navigation";

const viewer: NavAccess = { roleNames: ["VIEWER"], permissions: [], isPlatformAdmin: false };
const member: NavAccess = { roleNames: ["MEMBER"], permissions: [], isPlatformAdmin: false };
const admin: NavAccess = { roleNames: ["ADMIN"], permissions: [], isPlatformAdmin: false };
const owner: NavAccess = { roleNames: ["OWNER"], permissions: [], isPlatformAdmin: false };
const platform: NavAccess = { roleNames: ["VIEWER"], permissions: [], isPlatformAdmin: true };

function hrefsFor(access: NavAccess): string[] {
  return visibleNavigation(access).flatMap((s) => s.items.map((i) => i.href));
}

describe("navigation visibility", () => {
  it("keeps account administration and platform tools out of the sidebar for every role", () => {
    // The header account menu renders these, so the sidebar must not repeat them.
    for (const access of [viewer, member, admin, owner, platform]) {
      const hrefs = hrefsFor(access);
      expect(hrefs).not.toContain("/app/admin");
      expect(hrefs).not.toContain("/app/admin/users");
      expect(hrefs).not.toContain("/app/admin/roles");
      expect(hrefs).not.toContain("/app/admin/settings");
      expect(hrefs).not.toContain("/platform-admin");
      expect(hrefs).not.toContain("/app/filing-config");
    }
  });

  it("hides account administration from viewers and members", () => {
    for (const access of [viewer, member]) {
      expect(canAccessHref(access, "/app/admin")).toBe(false);
      expect(canAccessHref(access, "/app/admin/users")).toBe(false);
      expect(canAccessHref(access, "/app/admin/settings")).toBe(false);
    }
  });

  it("shows account administration to ADMIN and OWNER", () => {
    for (const access of [admin, owner]) {
      expect(canAccessHref(access, "/app/admin/users")).toBe(true);
      expect(canAccessHref(access, "/app/admin/roles")).toBe(true);
    }
  });

  it("grants admin items by explicit permission when the role is not an admin role", () => {
    const scoped: NavAccess = { roleNames: ["MEMBER"], permissions: ["users.manage"], isPlatformAdmin: false };
    expect(canAccessHref(scoped, "/app/admin/users")).toBe(true);
    expect(canAccessHref(scoped, "/app/admin/settings")).toBe(false);
  });

  it("authorizes the platform console only for platform admins (rendered in the header menu)", () => {
    expect(canAccessHref(platform, "/platform-admin")).toBe(true);
    for (const access of [viewer, member, admin, owner]) {
      expect(canAccessHref(access, "/platform-admin")).toBe(false);
    }
  });

  it("authorizes Filing Configuration only for platform admins (rendered in the header menu)", () => {
    expect(canAccessHref(platform, "/app/filing-config")).toBe(true);
    for (const access of [viewer, member, admin, owner]) {
      expect(canAccessHref(access, "/app/filing-config")).toBe(false);
    }
  });

  it("gives every member the operational pages", () => {
    const hrefs = hrefsFor(viewer);
    expect(hrefs).toContain("/app/shipments");
    expect(hrefs).toContain("/app/filing");
  });

  it("no longer offers a standalone My Work page", () => {
    // /app/work was removed along with its route; the view it held is now the
    // Command Center's "My Work" tab. This asserts the nav does not link to a
    // page that no longer exists.
    expect(hrefsFor(viewer)).not.toContain("/app/work");
  });

  it("drops sections that end up empty", () => {
    // A VIEWER has no billing permissions, so the billing workspace disappears
    // entirely rather than showing an empty header.
    expect(visibleNavigation(viewer).map((s) => s.id)).toEqual([
      "primary",
      "operations",
      "compliance-licensing",
      "data-intelligence",
      "management",
    ]);
  });

  it("shows the billing workspace once a billing permission is granted", () => {
    const billingViewer: NavAccess = {
      roleNames: ["MEMBER"],
      permissions: ["billing.view"],
      isPlatformAdmin: false,
    };
    expect(visibleNavigation(billingViewer).map((s) => s.id)).toContain("billing");
    expect(hrefsFor(billingViewer)).toContain("/app/billing");
  });

  it("surfaces bonds, POA, and importers of record in the sidebar (broker-critical records)", () => {
    const hrefs = hrefsFor(owner);
    expect(hrefs).toContain("/app/bonds");
    expect(hrefs).toContain("/app/poa");
    expect(hrefs).toContain("/app/importers-of-record");
    expect(hrefs).toContain("/app/clients");
  });

  it("pins Today and Command Center above the workspaces", () => {
    const sections = visibleNavigation(owner);
    expect(sections[0].id).toBe("primary");
    expect(sections[0].hideLabel).toBe(true);
    expect(sections[0].items.map((i) => i.href)).toEqual(["/app/actions", "/app/dashboard"]);
  });

  it("marks every workspace section (but not the pinned row) collapsible", () => {
    for (const section of NAV_SECTIONS) {
      if (section.hiddenFromSidebar || section.id === "primary") {
        expect(section.collapsible ?? false).toBe(false);
      } else {
        expect(section.collapsible).toBe(true);
      }
    }
  });

  it("owner bypass does not extend to platform-admin-only items", () => {
    const console = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/platform-admin")!;
    expect(canAccessNavItem(owner, console)).toBe(false);
    expect(canAccessNavItem(platform, console)).toBe(true);
  });
});

describe("canAccessHref server guard", () => {
  it("still authorizes routes whose section is hidden from the sidebar", () => {
    expect(canAccessHref(viewer, "/app/admin/users")).toBe(false);
    expect(canAccessHref(admin, "/app/admin/users")).toBe(true);
  });

  it("fails closed for hrefs that are not in the navigation model", () => {
    expect(canAccessHref(owner, "/app/unknown")).toBe(false);
  });
});

describe("active route matching", () => {
  it("does not match a sibling route that merely shares a prefix", () => {
    expect(isPathWithin("/app/shipments-archive", "/app/shipments")).toBe(false);
    expect(activeNavHref("/app/shipments-archive", ["/app/shipments"])).toBeNull();
  });

  it("matches nested routes on segment boundaries", () => {
    expect(isPathWithin("/app/shipments/abc123", "/app/shipments")).toBe(true);
  });

  it("prefers the longest match so a nested item wins over its parent", () => {
    const hrefs = ["/app/admin", "/app/admin/users"];
    expect(activeNavHref("/app/admin/users", hrefs)).toBe("/app/admin/users");
    expect(activeNavHref("/app/admin", hrefs)).toBe("/app/admin");
  });

  it("keeps the parent highlighted for a nested admin page with no own entry", () => {
    expect(activeNavHref("/app/admin/settings/keys", ["/app/admin", "/app/admin/settings"])).toBe(
      "/app/admin/settings"
    );
  });

  it("returns null when nothing matches", () => {
    expect(activeNavHref("/app/regulatory", ["/app/shipments"])).toBeNull();
  });
});

describe("navigation coverage -- nothing broker-critical is orphaned", () => {
  const platformOwner: NavAccess = {
    roleNames: ["OWNER"],
    permissions: [],
    isPlatformAdmin: true,
  };

  // Every top-level screen under src/app/app. When you add a route, add it here
  // and give it a home (sidebar row, UNLISTED_NAV_ITEMS, or an intentional
  // redirect) -- an orphaned screen fails this test rather than shipping hidden.
  const ALL_APP_ROUTES = [
    "/app/actions",
    "/app/dashboard",
    "/app/shipments",
    "/app/documents",
    "/app/filing",
    "/app/classification",
    "/app/post-entry",
    "/app/compliance",
    "/app/license-management",
    "/app/regulatory",
    "/app/compliance-reports",
    "/app/trade-data",
    "/app/hts",
    "/app/tariffs",
    "/app/simulator",
    "/app/billing",
    "/app/billing/exceptions",
    "/app/clients",
    "/app/importers-of-record",
    "/app/bonds",
    "/app/poa",
    "/app/products",
    "/app/parties",
    "/app/reconciliation",
    "/app/vault",
    "/app/filing-config",
  ];

  // Superseded routes that now permanentRedirect elsewhere -- deliberately not
  // in the navigation model.
  const INTENTIONAL_REDIRECTS = ["/app/decisions", "/app/exceptions"];

  it("authorizes every known app route for a platform owner", () => {
    for (const href of ALL_APP_ROUTES) {
      expect(canAccessHref(platformOwner, href), `orphaned route: ${href}`).toBe(true);
    }
  });

  it("resolves every known app route to a nav item (sidebar or unlisted)", () => {
    for (const href of ALL_APP_ROUTES) {
      expect(navItemByHref(href), `no nav entry for: ${href}`).toBeDefined();
    }
  });

  it("does not model the superseded redirect routes", () => {
    for (const href of INTENTIONAL_REDIRECTS) {
      expect(navItemByHref(href)).toBeUndefined();
    }
  });

  it("keeps the Copilot's nav-gated tool hrefs resolvable", () => {
    // src/modules/assistant/shared/toolAccess.ts gates tools through
    // canAccessHref. Any href a real screen exists for must resolve so the tool
    // is not silently disabled by this refactor.
    for (const href of ["/app/actions", "/app/compliance", "/app/dashboard", "/app/documents", "/app/filing", "/app/parties", "/app/post-entry", "/app/products", "/app/regulatory", "/app/shipments", "/app/tariffs"]) {
      expect(navItemByHref(href), `Copilot tool href no longer resolves: ${href}`).toBeDefined();
    }
  });
});

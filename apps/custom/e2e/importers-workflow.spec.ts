import { expect, test } from "@playwright/test";

// Fixture dates below are compared against `toLocaleDateString`, which is
// timezone-sensitive at day boundaries -- pin the context to UTC so the
// assertions don't depend on the machine running the suite.
test.use({ timezoneId: "UTC" });

/**
 * Coverage for the #316 Clients/Importers/Onboarding redesign (spec §8.3),
 * mounted the same way as broker-workflow.spec.ts: real production
 * components, HTTP fixtures supplied by Playwright, no auth bypass. Full
 * authenticated page navigation (the importer stepper, `/app/importers`
 * itself) sits behind Clerk middleware and is out of reach for this harness
 * -- see access-control.spec.ts's note on the same constraint.
 */

test.describe("Combobox", () => {
  test("filters by query, supports keyboard selection, and clears", async ({ page }) => {
    await page.goto("/?view=combobox");
    const input = page.getByRole("combobox", { name: /Importer of record/ });

    await input.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(4);

    await input.fill("acm");
    await expect(page.getByRole("option")).toHaveCount(2);
    await expect(page.getByRole("option", { name: /Acme Trading Co/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Acme Distribution/ })).toBeVisible();

    // The first match is highlighted by default; ArrowDown moves to the second.
    await expect(input).toHaveAttribute("aria-activedescendant", /acme-trading/);
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", /acme-dist/);
    await input.press("Enter");
    await expect(input).toHaveValue("Acme Distribution LLC");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    const clear = page.getByRole("button", { name: /Clear/ });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(input).toHaveValue("");

    // Clicking the field re-opens the full, unfiltered list (the chevron
    // sits over the input with pointer-events disabled).
    await input.click();
    await expect(page.getByRole("option")).toHaveCount(4);
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("exposes combobox accessibility attributes", async ({ page }) => {
    await page.goto("/?view=combobox");
    const input = page.getByRole("combobox");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toHaveAttribute("aria-required", "true");
    await input.click();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(input).toHaveAttribute("aria-controls", /listbox/);
  });
});

function importerFixture() {
  return [
    {
      id: "imp-ready", name: "Northwind Retail Inc.", clientId: "client-northwind",
      client: { id: "client-northwind", name: "Northwind Trade Group" },
      irsEin: "81-9003161", cbpImporterNumber: "DEMO-NW01", registrationStatus: "registered",
      bond: { status: "verified", lastVerifiedAt: "2026-08-01T00:00:00.000Z" },
      powersOfAttorney: [{ status: "executed", signedDate: "2026-08-01T00:00:00.000Z", expirationDate: "2027-08-01T00:00:00.000Z", revokedAt: null }],
      readiness: { ready: true, label: "Ready to file", blockers: [] },
    },
    {
      id: "imp-unassigned", name: "Legacy Importer Co.", clientId: null, client: null,
      irsEin: "81-9003169", cbpImporterNumber: "DEMO-LEG1", registrationStatus: "pending_5106",
      bond: null, powersOfAttorney: [],
      readiness: { ready: false, label: "Unassigned client", blockers: [{ code: "CLIENT", label: "Attach to a client", href: "/app/importers?client=none" }] },
    },
  ];
}

test.describe("Shipment intake — importer of record", () => {
  test("blocks submission without an importer and shows verified evidence once selected", async ({ page }) => {
    await page.route("**/api/importers**", (route) => route.fulfill({ json: { importers: importerFixture() } }));
    await page.goto("/?view=shipment-new");

    // Destination country is a separate, browser-enforced required field
    // (its <select> isn't label-associated, so target it positionally);
    // fill it first so the click reaches the importer-of-record JS validation.
    await page.locator("select").first().selectOption("US");
    await page.getByRole("button", { name: "Initialize Shipment" }).click();
    await expect(page.getByText("Choose the importer of record before initializing the shipment.")).toBeVisible();

    const input = page.getByRole("combobox", { name: /Importer of record/ });
    await input.click();
    const importerListbox = page.getByRole("listbox");
    // The unassigned importer never establishes filing authority, so it is
    // excluded from the picker entirely -- not just visually deprioritized.
    await expect(importerListbox.getByRole("option")).toHaveCount(1);
    await expect(importerListbox.getByRole("option", { name: /Legacy Importer Co\./ })).toHaveCount(0);

    await importerListbox.getByRole("option", { name: /Northwind Retail Inc\./ }).click();
    await expect(page.getByText("Filing context verified")).toBeVisible();
    await expect(page.getByText(/POA executed Aug 1, 2026/)).toBeVisible();
    await expect(page.getByText(/Bond verified Aug 1, 2026/)).toBeVisible();
  });
});

test.describe("Importers registry", () => {
  test("filters to a single missing-artifact state via the query param", async ({ page }) => {
    await page.goto("/?view=importers-registry&missing=POA");
    await expect(page.getByRole("link", { name: "Northwind Foods LLC" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Northwind Retail Inc." })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Legacy Importer Co." })).toHaveCount(0);
  });

  test("attaches an unassigned importer to a client", async ({ page }) => {
    await page.route("**/api/onboarding/clients**", (route) =>
      route.fulfill({ json: { clients: [{ id: "client-atlas", name: "Atlas Components", contactEmail: null }] } }));
    await page.route("**/api/importers/imp-unassigned", async (route) => {
      expect(route.request().method()).toBe("PATCH");
      const body = route.request().postDataJSON();
      expect(body.clientId).toBe("client-atlas");
      await route.fulfill({ json: { importer: { id: "imp-unassigned", clientId: "client-atlas" } } });
    });

    await page.goto("/?view=importers-registry");
    await page.getByRole("button", { name: "Attach client" }).click();
    await expect(page.getByRole("heading", { name: "Attach importer to client" })).toBeVisible();

    const clientInput = page.getByRole("combobox", { name: "Client" });
    await clientInput.click();
    await page.getByRole("option", { name: "Atlas Components" }).click();
    await page.getByRole("button", { name: "Assign client" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Atlas Components" })).toBeVisible();
  });
});

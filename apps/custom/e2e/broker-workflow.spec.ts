import { expect, test } from "@playwright/test";

function holdDetail() {
  return { hold: { id: "hold", agencyCode: "FDA", holdCode: "source-code", status: "Open", issuedAt: "2026-01-01T00:00:00Z", rawNotice: "Original agency notice", version: 0, submissions: [] },
    fields: [{ id: "importer", label: "Importer of record", required: true }, { id: "description", label: "Commodity description", required: true }, { id: "productCode", label: "FDA product code" }],
    formInput: { importer: "ACME", description: "Valve", productCode: "" }, prefill: { importer: "ACME", description: "Valve" }, staleDraft: false,
    explanation: "Agency requested product information", permissions: { canUpdate: true, canApprove: true }, transport: { reason: "File through your existing ACE channel, then record the reference here." } };
}
test.afterEach(async ({ page }, info) => { await page.screenshot({ path: info.outputPath("broker-workflow.png"), fullPage: true }); });
test("saves on Escape, restores the draft, and keeps controls inside the viewport", async ({ page }) => {
  const detail = holdDetail();
  await page.route("**/api/pga/holds/hold**", async route => {
    if (route.request().method() === "PATCH") { const body = route.request().postDataJSON(); detail.formInput = body.formInput; detail.hold.version++; await route.fulfill({ json: { version: detail.hold.version } }); }
    else await route.fulfill({ json: detail });
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Resolve FDA hold" }); await trigger.click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel(/Importer of record/)).toHaveValue("ACME");
  await page.getByLabel("FDA product code").fill("BROKER-DRAFT");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("FDA product code")).toHaveValue("BROKER-DRAFT");
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const close = page.getByRole("button", { name: "Save and close drawer" });
  await close.focus(); await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
});
test("keeps unsaved fields after conflict and requires review before replacing another draft", async ({ page }) => {
  const detail = holdDetail(); let conflict = true;
  await page.route("**/api/pga/holds/hold**", async route => {
    if (route.request().method() === "PATCH") {
      if (conflict) { detail.hold.version = 1; detail.formInput.productCode = "OTHER-BROKER"; await route.fulfill({ status: 409, json: { error: { message: "This hold changed." } } }); }
      else { detail.formInput = route.request().postDataJSON().formInput; await route.fulfill({ json: { version: 2 } }); }
    } else await route.fulfill({ json: detail });
  });
  await page.goto("/"); await page.getByRole("button", { name: "Resolve FDA hold" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("FDA product code").fill("MY-DRAFT");
  await page.getByRole("button", { name: "Save & close", exact: true }).click();
  await expect(page.getByLabel("FDA product code")).toHaveValue("MY-DRAFT");
  await expect(page.getByRole("region", { name: "Review changed hold" })).toContainText("OTHER-BROKER");
  await page.getByRole("button", { name: "Keep my draft after review" }).click(); conflict = false;
  await page.getByRole("button", { name: "Save & close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(detail.formInput.productCode).toBe("MY-DRAFT");
});
test("an override requires a reason and confirmation leaves the ledger unchanged", async ({ page }) => {
  const data = { matches: [{ id: "assist", description: "Production mould", currency: "USD", remainingValue: "100.00", amount: "10.00", blockedReason: null, basisHash: "a".repeat(64), assistVersion: 0, lines: [{ id: "line", lineNumber: 1 }], decision: null as null | { kind: string; amount: string; current: boolean } }],
    staleDecisions: [], declarations: [], canUpdate: true, canOverride: true, filingStatus: "BrokerApproved" };
  await page.route("**/api/assists/**", async route => {
    if (route.request().method() === "POST") { const input = route.request().postDataJSON(); expect(input.overrideReasonCode).toBe("broker_judgment"); expect(input.amount).toBe("15.00"); data.matches[0].decision = { kind: "Override", amount: input.amount, current: true }; await route.fulfill({ json: { staged: true } }); }
    else await route.fulfill({ json: data });
  });
  await page.goto("/?view=assists"); await page.getByText("1 active assists apply to this entry").click();
  await page.getByRole("button", { name: "Override", exact: true }).click();
  await expect(page.getByRole("button", { name: "Include", exact: true })).toBeDisabled();
  await page.getByLabel(/Amount/).fill("15.00"); await page.getByLabel("Override reason", { exact: true }).selectOption("broker_judgment");
  await page.getByRole("button", { name: "Include", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("balance changes when the entry is submitted");
  await expect(page.getByText("Remaining USD 100.00", { exact: false })).toBeVisible();
});
test("read-only reviewers cannot change entry assists", async ({ page }) => {
  await page.route("**/api/assists/**", route => route.fulfill({ json: { matches: [{ id: "a", description: "Mould", currency: "USD", remainingValue: "100", amount: "10", lines: [{ id: "l", lineNumber: 1 }] }], staleDecisions: [], declarations: [], canUpdate: false, canOverride: false, filingStatus: "BrokerApproved" } }));
  await page.goto("/?view=assists"); await page.getByText("1 active assists apply to this entry").click();
  await expect(page.getByRole("button", { name: "Include", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Override", exact: true })).toHaveCount(0);
});

test("registers a draft before activation and previews allocation immediately", async ({ page }) => {
  const rows: any[] = [];
  await page.route("**/api/assists**", async route => {
    if (route.request().url().includes("/options")) return route.fulfill({ json: { importers: [], parties: [] } });
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      rows.push({ ...input, id: "draft", version: 0, status: "Draft", remainingValue: input.totalValue, importerOfRecord: null });
      return route.fulfill({ status: 201, json: { assist: rows[0] } });
    }
    return route.fulfill({ json: { assists: rows, total: rows.length } });
  });
  await page.goto("/?view=registry");
  await page.getByRole("button", { name: "+ Add assist", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Buyer tooling");
  await page.getByLabel("Total value", { exact: true }).fill("1200");
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("1,200");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("article")).toContainText("Draft");
  await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  expect(rows[0].remainingValue).toBe("1200");
});

test("keeps older submission evidence accessible after a hold is released", async ({ page }) => {
  const records = Array.from({ length: 21 }, (_, index) => ({
    id: "submission-" + index, externalReference: "REF-" + (index + 1), status: index === 0 ? "Accepted" : "Rejected",
    transmissionMode: "MANUAL", submittedAt: "2026-01-01T00:00:00Z", rejectionCode: null, rejectionReason: null,
    rejectedFields: [], messageSetText: "Original filed evidence",
  }));
  const base = holdDetail();
  const detail = { ...base, submissionTotal: records.length, hold: { ...base.hold, status: "Released", submissions: records.slice(0, 20) } };
  await page.route("**/api/pga/holds/hold**", route => route.fulfill({
    json: route.request().url().includes("/submissions?") ? { submissions: records.slice(20), total: 21, page: 1 } : detail,
  }));
  await page.goto("/"); await page.getByRole("button", { name: "Resolve FDA hold" }).click();
  await page.getByRole("button", { name: "Show older submissions", exact: true }).click();
  await expect(page.getByText(/REF-21/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show older submissions", exact: true })).toHaveCount(0);
});

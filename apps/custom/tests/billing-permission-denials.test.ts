import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getAccountContext: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/db", () => ({ db: {}, runWithAccountId: vi.fn(), withAccountIdContext: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/billing/invoicing", () => ({ createInvoiceFromCharges: vi.fn(), recordInvoicePayment: vi.fn() }));
vi.mock("@/lib/billing/telemetry", () => ({ seedBillingEventDefinitions: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  activateRateCardAction,
  addDraftRateRuleAction,
  createInvoiceAction,
  createNewRateCardVersionAction,
  createRateCardAction,
  deleteDraftRateRuleAction,
  duplicateRateCardAction,
  retireRateCardAction,
  saveRateRuleMappingsAction,
  updateDraftRateRuleAction,
} from "@/app/app/billing/actions";
import { adjustShipmentChargeAction } from "@/app/app/billing/charges/[id]/actions";
import {
  approveInvoiceAction,
  recordPaymentAction,
  sendInvoiceAction,
  submitInvoiceForApprovalAction,
  voidInvoiceAction,
} from "@/app/app/billing/invoices/[id]/actions";
import { saveCostProfileAction } from "@/app/app/billing/settings/actions";
import { resolveExceptionAction, waiveExceptionAction } from "@/app/app/billing/exceptions/actions";

describe("billing mutation permission denials", () => {
  beforeEach(() => {
    auth.getAccountContext.mockResolvedValue({ accountId: "account-a", userId: "user-a" });
    auth.hasPermission.mockResolvedValue(false);
  });

  const form = () => new FormData();
  const denied = [
    ["create rate card", () => createRateCardAction({ name: "x", lineItems: [] })],
    ["map rate rule", () => saveRateRuleMappingsAction("rule", [])],
    ["activate rate card", () => activateRateCardAction("card")],
    ["create rate version", () => createNewRateCardVersionAction("card")],
    ["update rule", () => updateDraftRateRuleAction("rule", {})],
    ["delete rule", () => deleteDraftRateRuleAction("rule")],
    ["add rule", () => addDraftRateRuleAction("version", { lineItemName: "x", serviceCode: "x", pricingModel: "PER_UNIT", unit: "unit", rate: 1 })],
    ["retire rate card", () => retireRateCardAction("card")],
    ["duplicate rate card", () => duplicateRateCardAction("card")],
    ["create invoice", () => createInvoiceAction(form())],
    ["adjust charge", () => adjustShipmentChargeAction("charge", form())],
    ["record payment", () => recordPaymentAction("invoice", form())],
    ["submit invoice", () => submitInvoiceForApprovalAction("invoice")],
    ["approve invoice", () => approveInvoiceAction("invoice")],
    ["send invoice", () => sendInvoiceAction("invoice")],
    ["void invoice", () => voidInvoiceAction("invoice", "reason")],
    ["save cost profile", () => saveCostProfileAction(form())],
    ["resolve billing exception", () => resolveExceptionAction("exception", form())],
    ["waive billing exception", () => waiveExceptionAction("exception", form())],
  ] as const;

  for (const [name, action] of denied) {
    it(`denies ${name} without its granular permission`, async () => {
      await expect(action()).rejects.toThrow(/Forbidden/);
    });
  }
});

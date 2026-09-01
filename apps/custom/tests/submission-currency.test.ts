import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/modules/fx/exchangeRateService", () => ({ ExchangeRateService: { resolveExchangeRate: vi.fn(async () => ({ toNumber: () => 1.25 })) } }));
import { resolveSubmissionCurrency } from "@/lib/canonicalMessaging/submissionCurrency";
import { ExchangeRateService } from "@/modules/fx/exchangeRateService";
beforeEach(() => vi.clearAllMocks());
it("uses the currency extracted from documents before the shipment default", async () => {
  const context = await resolveSubmissionCurrency("US", null, { invoiceCurrency: "USD", documents: [{ extractedJson: '{"currency":"EUR"}' }] });
  expect(context).toMatchObject({ commercialCurrency: "EUR", exchangeRate: 1.25, customsCurrency: "USD" });
});
it("keeps the broker's declared currency and documented rate", async () => {
  const context = await resolveSubmissionCurrency("US", { currencyContext: { commercialCurrency: "GBP", exchangeRate: 1.3, exchangeRateSource: "BROKER", exchangeRateEffectiveDate: "2026-01-01" } }, { documents: [{ extractedJson: '{"currency":"EUR"}' }] });
  expect(context).toMatchObject({ commercialCurrency: "GBP", exchangeRate: 1.3 });
  expect(ExchangeRateService.resolveExchangeRate).not.toHaveBeenCalled();
});
it("requires a broker decision when invoice currencies conflict", async () => {
  await expect(resolveSubmissionCurrency("US", null, { documents: [{ extractedJson: '{"currency":"EUR"}' }, { extractedJson: '{"currency":"GBP"}' }] })).rejects.toThrow("disagree");
});

import { extractedCurrencies } from "@/modules/documents/extractedCurrency";
import { ExchangeRateService } from "@/modules/fx/exchangeRateService";
import { getCustomsValuationCurrency, normalizeCurrencyCode, resolveFilingCurrencyContext } from "./currencyContext";

/** One source of truth for the entry preview and immutable filing snapshot. */
export async function resolveSubmissionCurrency(country: string, dutyBreakdown: unknown, shipment: {
  documents: ReadonlyArray<{ extractedJson?: string | null }>;
  invoiceCurrency?: string | null;
  ladingDate?: Date | null;
}) {
  const stored = dutyBreakdown && typeof dutyBreakdown === "object" && !Array.isArray(dutyBreakdown)
    ? dutyBreakdown as Record<string, unknown> : {};
  const raw = stored.currencyContext;
  const configured = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const detected = extractedCurrencies(shipment.documents);
  if (detected.length > 1 && !configured.commercialCurrency) {
    throw new Error("Commercial invoice documents disagree on currency (" + detected.join(", ") + "). Resolve the filing commercial currency before submission.");
  }
  const customsCurrency = normalizeCurrencyCode(configured.customsCurrency ?? getCustomsValuationCurrency(country));
  const commercialCurrency = normalizeCurrencyCode(configured.commercialCurrency ?? detected[0] ?? shipment.invoiceCurrency ?? customsCurrency);
  let context = { ...configured, customsCurrency, commercialCurrency };
  if (!configured.exchangeRate && commercialCurrency !== customsCurrency) {
    if (customsCurrency !== "USD") throw new Error("Set a documented exchange rate for this customs currency before submission.");
    const asOf = shipment.ladingDate ?? new Date();
    const rate = await ExchangeRateService.resolveExchangeRate(commercialCurrency, asOf);
    context = { ...context, exchangeRate: rate.toNumber(), exchangeRateSource: "CURRENCYFREAKS_AUTO", exchangeRateEffectiveDate: asOf.toISOString() };
  }
  return resolveFilingCurrencyContext(country, { currencyContext: context });
}

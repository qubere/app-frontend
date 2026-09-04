export interface RateQuoteInput {
  shipmentId: string;
  originPostalCode?: string | null;
  destinationPostalCode?: string | null;
  weight?: number | null;
  mode?: string | null;
}

export interface RateQuoteOutput {
  carrierId: string;
  carrierLegalName: string;
  scac?: string | null;
  amount: number;
  currency: string;
  transitDays?: number | null;
  validUntil?: Date | null;
  providerName: string;
  insuranceOnFile: boolean;
}

/**
 * Adapter interface for freight rate providers (manual entry or external rate shopping APIs).
 * Extensible for future EDI/carrier rating API integrations (IntegrationCategory.CARRIER_RATING).
 */
export interface RateProvider {
  name: string;
  getQuotes(input: RateQuoteInput): Promise<RateQuoteOutput[]>;
}

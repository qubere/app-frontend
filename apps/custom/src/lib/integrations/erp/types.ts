// ERP provider abstraction — mirrors the transmission-provider pattern.
// Credentials are resolved via SecretStoreResolver or IntegrationConfig.configJson
// per provider; never store API keys in plaintext columns.

export interface ErpAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ErpEntity {
  providerId: string;
  legalName: string;
  tradeName?: string;
  entityType?: string; // CORPORATION | LLC | PARTNERSHIP | SOLE_PROPRIETORSHIP | FOREIGN
  ein?: string;
  vatNumber?: string;
  countryOfFormation?: string;
  physicalAddress?: ErpAddress;
  mailingAddress?: ErpAddress;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency?: string;
  paymentTermsDays?: number;
  isActive?: boolean;
  // ERP-native metadata preserved for dedupe scoring
  providerCreatedAt?: string;
  providerUpdatedAt?: string;
  raw?: unknown;
}

export interface ErpProduct {
  providerId: string;
  sku?: string;
  name: string;
  description?: string;
  unitPrice?: number;
  currency?: string;
  htsCandidates?: string[]; // ERP may have HTS suggestions
  countryOfOrigin?: string;
  weight?: number;
  weightUnit?: string;
  isActive?: boolean;
  raw?: unknown;
}

export interface ErpPullResult {
  entities: ErpEntity[];
  products: ErpProduct[];
  fetchedAt: string; // ISO timestamp
  recordCount: number;
}

export interface ErpProvider {
  readonly name: string;
  listEntities(): Promise<ErpEntity[]>;
  listProducts(): Promise<ErpProduct[]>;
}

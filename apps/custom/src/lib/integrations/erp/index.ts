import type { ErpProvider } from "./types";

export * from "./types";

// Registry — extend with NetSuiteProvider, SapProvider, DynamicsProvider as built
export function getErpProvider(
  _integrationConfigId: string,
  providerName: string,
  _configJson: unknown
): ErpProvider {
  switch (providerName.toUpperCase()) {
    // Concrete adapters added here as they are built (P6+)
    default:
      throw new Error(`ERP provider "${providerName}" is not yet implemented`);
  }
}

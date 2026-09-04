export type DemoImporterState = "READY" | "POA_PENDING" | "BOND_SHORT" | "ONBOARDING";

export interface ImporterDemoClient {
  key: "northwind" | "pacific" | "meridian" | "atlas";
  name: string;
  paymentTermsDays: number;
  portalUsers: number;
  importerKeys: readonly string[];
  partyRoles: readonly ("MANUFACTURER" | "SELLER")[];
}

export interface ImporterDemoImporter {
  key: "northwind-retail" | "northwind-foods" | "pacific" | "meridian" | "legacy";
  clientKey: ImporterDemoClient["key"] | null;
  name: string;
  state: DemoImporterState;
  projectedAnnualDutyTaxFee: number | null;
  bondAmount: number | null;
  requiredBondAmount: number | null;
}

/**
 * Reviewable source of truth for the issue #316 demo. The database script
 * consumes this manifest and tests pin the broker-visible states to the spec.
 */
export const IMPORTER_DEMO_SCENARIO = {
  name: "Northwind Trade Group",
  synthetic: true,
  clients: [
    {
      key: "northwind",
      name: "Northwind Retail Inc.",
      paymentTermsDays: 30,
      portalUsers: 2,
      importerKeys: ["northwind-retail", "northwind-foods"],
      partyRoles: [],
    },
    {
      key: "pacific",
      name: "Pacific Import Partners",
      paymentTermsDays: 45,
      portalUsers: 0,
      importerKeys: ["pacific"],
      partyRoles: [],
    },
    {
      key: "meridian",
      name: "Meridian GmbH",
      paymentTermsDays: 30,
      portalUsers: 0,
      importerKeys: ["meridian"],
      partyRoles: [],
    },
    {
      key: "atlas",
      name: "Atlas Components",
      paymentTermsDays: 30,
      portalUsers: 0,
      importerKeys: [],
      partyRoles: ["MANUFACTURER", "SELLER"],
    },
  ] satisfies readonly ImporterDemoClient[],
  importers: [
    {
      key: "northwind-retail",
      clientKey: "northwind",
      name: "Northwind Retail Inc.",
      state: "READY",
      projectedAnnualDutyTaxFee: 1_800_000,
      bondAmount: 250_000,
      requiredBondAmount: 180_000,
    },
    {
      key: "northwind-foods",
      clientKey: "northwind",
      name: "Northwind Foods LLC",
      state: "POA_PENDING",
      projectedAnnualDutyTaxFee: 500_000,
      bondAmount: 250_000,
      requiredBondAmount: 50_000,
    },
    {
      key: "pacific",
      clientKey: "pacific",
      name: "Pacific Import Partners",
      state: "BOND_SHORT",
      projectedAnnualDutyTaxFee: 1_800_000,
      bondAmount: 50_000,
      requiredBondAmount: 180_000,
    },
    {
      key: "meridian",
      clientKey: "meridian",
      name: "Meridian GmbH",
      state: "ONBOARDING",
      projectedAnnualDutyTaxFee: null,
      bondAmount: null,
      requiredBondAmount: null,
    },
    {
      key: "legacy",
      clientKey: null,
      name: "Legacy Importer Co.",
      state: "ONBOARDING",
      projectedAnnualDutyTaxFee: null,
      bondAmount: null,
      requiredBondAmount: null,
    },
  ] satisfies readonly ImporterDemoImporter[],
  northwindShipmentCount: 4,
  pacificBlockedShipmentCount: 1,
} as const;

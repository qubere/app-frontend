import { describe, expect, it } from "vitest";
import { IMPORTER_DEMO_SCENARIO } from "@/modules/importers/importerDemoScenario";

describe("Northwind importer demo scenario", () => {
  it("keeps each broker workflow state explicit and internally linked", () => {
    const clientKeys = new Set<string>(IMPORTER_DEMO_SCENARIO.clients.map((client) => client.key));
    const importerKeys = new Set<string>(IMPORTER_DEMO_SCENARIO.importers.map((importer) => importer.key));

    expect(IMPORTER_DEMO_SCENARIO.synthetic).toBe(true);
    expect(clientKeys.size).toBe(4);
    expect(importerKeys.size).toBe(5);
    expect(
      IMPORTER_DEMO_SCENARIO.importers.every(
        (importer) => importer.clientKey === null || clientKeys.has(importer.clientKey),
      ),
    ).toBe(true);
    expect(
      IMPORTER_DEMO_SCENARIO.clients.every((client) =>
        client.importerKeys.every((importerKey) => importerKeys.has(importerKey)),
      ),
    ).toBe(true);
  });

  it("contains the accuracy and exception cases brokers need to demo", () => {
    const states = Object.fromEntries(
      IMPORTER_DEMO_SCENARIO.importers.map((importer) => [importer.key, importer]),
    );
    const atlas = IMPORTER_DEMO_SCENARIO.clients.find((client) => client.key === "atlas");

    expect(states["northwind-retail"].state).toBe("READY");
    expect(states["northwind-foods"].state).toBe("POA_PENDING");
    expect(states.pacific).toMatchObject({
      state: "BOND_SHORT",
      projectedAnnualDutyTaxFee: 1_800_000,
      bondAmount: 50_000,
      requiredBondAmount: 180_000,
    });
    expect(states.meridian.state).toBe("ONBOARDING");
    expect(states.legacy.clientKey).toBeNull();
    expect(atlas).toMatchObject({ importerKeys: [], partyRoles: ["MANUFACTURER", "SELLER"] });
    expect(IMPORTER_DEMO_SCENARIO.northwindShipmentCount).toBe(4);
    expect(IMPORTER_DEMO_SCENARIO.pacificBlockedShipmentCount).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { buildAlsoKnownAs } from "../src/modules/importers/alsoKnownAs";

describe("buildAlsoKnownAs", () => {
  it("returns null when the importer's legal entity has no party link yet", () => {
    expect(buildAlsoKnownAs(null, "legal-1")).toBeNull();
  });

  it("lists other active roles, excluding IMPORTER itself", () => {
    const party = {
      id: "party-1",
      roles: [
        { roleType: "IMPORTER", status: "ACTIVE" },
        { roleType: "SUPPLIER", status: "ACTIVE" },
      ],
      legalEntities: [{ id: "legal-1", _count: { productParties: 0, shipmentParties: 0 } }],
    };
    expect(buildAlsoKnownAs(party, "legal-1")!.otherRoles).toEqual(["SUPPLIER"]);
  });

  it("excludes a superseded role -- a role the party no longer actively holds isn't 'also known as'", () => {
    const party = {
      id: "party-1",
      roles: [{ roleType: "SUPPLIER", status: "SUPERSEDED" }],
      legalEntities: [{ id: "legal-1", _count: { productParties: 0, shipmentParties: 0 } }],
    };
    expect(buildAlsoKnownAs(party, "legal-1")!.otherRoles).toEqual([]);
  });

  it("counts other bridged legal entities, excluding the importer's own", () => {
    const party = {
      id: "party-1",
      roles: [],
      legalEntities: [
        { id: "legal-1", _count: { productParties: 0, shipmentParties: 0 } },
        { id: "legal-2", _count: { productParties: 0, shipmentParties: 0 } },
      ],
    };
    expect(buildAlsoKnownAs(party, "legal-1")!.linkedLegalEntityCount).toBe(1);
  });

  it("sums product and shipment party counts across every bridged legal entity, including this one", () => {
    const party = {
      id: "party-1",
      roles: [],
      legalEntities: [
        { id: "legal-1", _count: { productParties: 2, shipmentParties: 1 } },
        { id: "legal-2", _count: { productParties: 4, shipmentParties: 0 } },
      ],
    };
    const summary = buildAlsoKnownAs(party, "legal-1")!;
    expect(summary.productPartyCount).toBe(6);
    expect(summary.shipmentPartyCount).toBe(1);
  });

  it("reports nothing interesting for a freshly created, single-role, single-entity party", () => {
    const party = {
      id: "party-1",
      roles: [{ roleType: "IMPORTER", status: "ACTIVE" }],
      legalEntities: [{ id: "legal-1", _count: { productParties: 0, shipmentParties: 0 } }],
    };
    expect(buildAlsoKnownAs(party, "legal-1")).toEqual({
      otherRoles: [],
      linkedLegalEntityCount: 0,
      productPartyCount: 0,
      shipmentPartyCount: 0,
    });
  });
});

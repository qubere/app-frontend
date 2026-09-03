import { describe, it, expect } from "vitest";
import { parseCanadaXmlStream, mapCanadaRecord } from "@/modules/screening/canadaConsolidatedSanctionsListIngestionService";

// Real records trimmed directly from the live Consolidated Canadian
// Autonomous Sanctions List XML export (international.gc.ca, fetched
// 2026-09-03) -- not synthetic. The feed is a flat <data-set>/<record>
// schema: no attributes anywhere, no nesting, and every text field embeds
// "English / French" (ship type uses "English | French") in one string.
const REAL_TRIMMED_CANADA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data-set xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <record>
        <Country-Pays>Russia / Russie</Country-Pays>
        <LastName-NomDeFamille>AKIMOV</LastName-NomDeFamille>
        <GivenName-Prenom>Andrey Igorevich</GivenName-Prenom>
        <Aliases-Alias>Andrei </Aliases-Alias>
        <DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire>1953-09-22</DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire>
        <Schedule-Annexe>1, Part 1</Schedule-Annexe>
        <Item-NumeroDarticle>94</Item-NumeroDarticle>
        <DateOfListing-DateDinscription>2019-03-15</DateOfListing-DateDinscription>
    </record>
    <record>
        <Country-Pays>Russia / Russie</Country-Pays>
        <EntityOrShip-EntiteOuNavire>Aktsionerny Bank Russian Federation</EntityOrShip-EntiteOuNavire>
        <Aliases-Alias>Bank Rossiya</Aliases-Alias>
        <Schedule-Annexe>1, Part 2</Schedule-Annexe>
        <Item-NumeroDarticle>1</Item-NumeroDarticle>
        <DateOfListing-DateDinscription>2014-03-21</DateOfListing-DateDinscription>
    </record>
    <record>
        <Country-Pays>Russia / Russie</Country-Pays>
        <EntityOrShip-EntiteOuNavire>M/V Maria </EntityOrShip-EntiteOuNavire>
        <TitleOrShipType-TitreOuTypeDeNavire>General Cargo | Cargo classique</TitleOrShipType-TitreOuTypeDeNavire>
        <ShipIMONumber-NumeroOMIDuNavire>8517839</ShipIMONumber-NumeroOMIDuNavire>
        <DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire>1986</DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire>
        <Schedule-Annexe>1.1</Schedule-Annexe>
        <Item-NumeroDarticle>2</Item-NumeroDarticle>
        <DateOfListing-DateDinscription>2025-06-13</DateOfListing-DateDinscription>
    </record>
    <record>
        <Country-Pays>Justice for Victims of Corrupt Foreign Officials Regulations (JVCFOR) / Règlement relatif à la justice pour les victimes de dirigeants étrangers corrompus (RJVDEC)</Country-Pays>
        <LastName-NomDeFamille>MADURO MOROS</LastName-NomDeFamille>
        <GivenName-Prenom>Nicolás</GivenName-Prenom>
        <Item-NumeroDarticle>1</Item-NumeroDarticle>
        <DateOfListing-DateDinscription>2017-11-03</DateOfListing-DateDinscription>
    </record>
</data-set>`;

function streamFromString(xml: string): ReadableStream<Uint8Array> {
  return new Response(xml).body as ReadableStream<Uint8Array>;
}

describe("parseCanadaXmlStream — real trimmed Consolidated Canadian Autonomous Sanctions List fixture", () => {
  it("parses all four records", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    expect(records).toHaveLength(4);
  });

  it("extracts an individual with an alias and a date of birth", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const akimov = records.find((r) => r.lastName === "AKIMOV")!;
    expect(akimov.givenName).toBe("Andrey Igorevich");
    expect(akimov.alias?.trim()).toBe("Andrei");
    expect(akimov.dobOrBuildDate).toBe("1953-09-22");
    expect(akimov.schedule).toBe("1, Part 1");
    expect(akimov.item).toBe("94");
  });

  it("extracts an entity with no ship-specific fields", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const bank = records.find((r) => r.entityOrShip === "Aktsionerny Bank Russian Federation")!;
    expect(bank.shipType).toBeUndefined();
    expect(bank.shipImo).toBeUndefined();
    expect(bank.alias).toBe("Bank Rossiya");
  });

  it("extracts a ship with a type and IMO number", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const ship = records.find((r) => r.shipImo === "8517839")!;
    expect(ship.entityOrShip?.trim()).toBe("M/V Maria");
    expect(ship.shipType).toBe("General Cargo | Cargo classique");
    expect(ship.dobOrBuildDate).toBe("1986");
  });

  it("extracts a JVCFOR individual with a fully spelled-out regulation name and no alias/DOB", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const maduro = records.find((r) => r.lastName === "MADURO MOROS")!;
    expect(maduro.givenName).toBe("Nicolás");
    expect(maduro.alias).toBeUndefined();
    expect(maduro.countryRaw).toContain("Justice for Victims of Corrupt Foreign Officials Regulations (JVCFOR)");
  });
});

describe("mapCanadaRecord", () => {
  it("maps the individual to a ScreeningEntity-shaped record with a synthesized SEMA programme name", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const akimov = records.find((r) => r.lastName === "AKIMOV")!;
    const mapped = mapCanadaRecord(akimov);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("Andrey Igorevich AKIMOV");
    expect(mapped.alternateNames).toEqual(["Andrei"]);
    expect(mapped.programCodes).toEqual(["Special Economic Measures (Russia) Regulations"]);
    expect(mapped.citation).toBe("Russia — Schedule 1, Part 1 — Item 94");
    expect(mapped.remarks).toContain("DOB: 1953-09-22");
    expect(mapped.country).toBeNull();
  });

  it("maps the ship to entityType VESSEL with ship-specific remarks", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const ship = records.find((r) => r.shipImo === "8517839")!;
    const mapped = mapCanadaRecord(ship);
    expect(mapped.entityType).toBe("VESSEL");
    expect(mapped.name).toBe("M/V Maria");
    expect(mapped.remarks).toContain("Ship type: General Cargo");
    expect(mapped.remarks).toContain("IMO Number: 8517839");
    expect(mapped.remarks).toContain("Ship build date: 1986");
  });

  it("maps the JVCFOR individual, leaving the already-spelled-out regulation name unwrapped", async () => {
    const { records } = await parseCanadaXmlStream(streamFromString(REAL_TRIMMED_CANADA_XML));
    const maduro = records.find((r) => r.lastName === "MADURO MOROS")!;
    const mapped = mapCanadaRecord(maduro);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("Nicolás MADURO MOROS");
    expect(mapped.programCodes).toEqual(["Justice for Victims of Corrupt Foreign Officials Regulations (JVCFOR)"]);
    expect(mapped.alternateNames).toEqual([]);
  });
});

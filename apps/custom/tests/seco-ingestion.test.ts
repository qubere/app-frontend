import { describe, it, expect } from "vitest";
import { parseSecoXmlStream, mapSecoTarget } from "@/modules/screening/secoSanctionsListIngestionService";

// Real entries trimmed directly from the live SECO consolidated sanctions
// list XML (sesam.search.admin.ch downloadXmlGesamtliste export, fetched
// 2026-09-02) -- not synthetic. The Lukashenka target's historical
// <modification><added> block is trimmed to a single nested <identity>
// (rather than the full nested <target> copy the real feed embeds) purely
// to keep the fixture small; it still exercises the same tag-name
// collision the depth-counting skip mechanism has to survive.
const REAL_TRIMMED_SECO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<swiss-sanctions-list list-type="whole-list" date="2026-08-27">
  <sanctions-program ssid="20" version-date="2026-05-21" predecessor-version-date="2025-12-12">
    <program-key lang="eng">Belarus</program-key>
    <program-key lang="ger">Belarus</program-key>
    <program-name lang="eng">Ordinance of 15 June 2016 on measures against Belarus</program-name>
    <sanctions-set ssid="4387" lang="eng">article 12 -- Restrictions on named individuals and entities</sanctions-set>
    <sanctions-set ssid="46113" lang="eng">article 16 and 17 -- Restrictions on the money and capital market</sanctions-set>
    <origin>EU</origin>
  </sanctions-program>
  <sanctions-program ssid="900" version-date="2016-05-18">
    <program-key lang="eng">North Korea</program-key>
    <program-name lang="eng">Ordinance of 18 May 2016 on measures against North Korea</program-name>
    <sanctions-set ssid="34422" lang="eng">Vessel-related measures</sanctions-set>
    <origin>UN</origin>
  </sanctions-program>
  <target ssid="5142">
    <sanctions-set-id>4387</sanctions-set-id>
    <foreign-identifier>140</foreign-identifier>
    <individual>
      <identity ssid="5144" main="true">
        <name ssid="26811" name-type="primary-name" quality="good" lang="eng">
          <name-part order="1" name-part-type="family-name"><value>Lukashenka</value><spelling-variant lang="RUS" script="LATN" spelling-variant-type="not-defined">Lukashenko</spelling-variant></name-part>
          <name-part order="2" name-part-type="given-name"><value>Dzmitry</value></name-part>
          <name-part order="3" name-part-type="father-name"><value>Aliaksandravich</value></name-part>
        </name>
        <day-month-year ssid="23493" day="23" month="3" year="1980" calendar="Gregorian" quality="good"/>
        <address ssid="29513" place-id="29492" quality="good"><c-o>President's Sports Club</c-o><address-details>ul. Starovilenskaya, 4</address-details><zip-code>220029</zip-code></address>
      </identity>
      <justification ssid="29512">Businessman, with active participation in financial operations involving the Lukashenka family.</justification>
      <other-information ssid="33153">Travel ban according to article 3 paragraph 1 does not apply until 15 March 2016.</other-information>
    </individual>
    <modification modification-type="de-listed" enactment-date="2016-02-29" publication-date="2016-03-01" effective-date="2016-03-01"/>
    <modification modification-type="amended" enactment-date="2015-11-17" publication-date="2015-11-18" effective-date="2015-11-18">
      <added>
        <identity ssid="5144" main="true">
          <name ssid="26811" name-type="primary-name" quality="good" lang="eng">
            <name-part order="1" name-part-type="family-name"><value>Lukashenka</value></name-part>
          </name>
        </identity>
      </added>
    </modification>
  </target>
  <target ssid="46130">
    <sanctions-set-id>46113</sanctions-set-id>
    <entity>
      <identity ssid="46131" main="true">
        <name ssid="46132" name-type="primary-name" quality="good" lang="eng">
          <name-part order="1" name-part-type="whole-name"><value>Belagroprombank</value></name-part>
        </name>
      </identity>
      <justification ssid="46133">State-owned bank subject to restrictions on the money and capital market.</justification>
    </entity>
    <modification modification-type="listed" enactment-date="2021-08-11" publication-date="2021-08-11" effective-date="2021-08-11"/>
  </target>
  <target ssid="34461">
    <sanctions-set-id>34422</sanctions-set-id>
    <object object-type="vessel">
      <identity ssid="34462" main="true">
        <name ssid="34463" name-type="primary-name" quality="good" lang="eng"><name-part order="1" name-part-type="whole-name"><value>Hui Chon</value></name-part></name>
        <name ssid="34464" name-type="alias" quality="good" lang="eng"><name-part order="1" name-part-type="whole-name"><value>Hwang Gum San 2</value></name-part></name>
      </identity>
      <other-information ssid="34465">IMO Number: 8405270</other-information>
    </object>
    <modification modification-type="listed" enactment-date="2016-05-18" publication-date="2016-05-18" effective-date="2016-05-18"/>
  </target>
  <target ssid="1900">
    <sanctions-set-id>4387</sanctions-set-id>
    <individual>
      <identity ssid="1901" main="true">
        <name ssid="1902" name-type="primary-name" quality="good" lang="eng"><name-part order="1" name-part-type="whole-name"><value>Muhammad Example</value></name-part></name>
      </identity>
      <identity ssid="1921" main="false">
        <name ssid="1919" name-type="primary-name" quality="good" lang="eng"><name-part order="1" name-part-type="whole-name"><value>Ali Zafir 'Abdullah'</value></name-part></name>
        <nationality ssid="1920"><country iso-code="IQ">Iraq</country></nationality>
      </identity>
      <justification ssid="1903">Included for testing multiple identities, one carrying a nationality via a non-main alias identity.</justification>
    </individual>
    <modification modification-type="listed" enactment-date="2015-01-01" publication-date="2015-01-01" effective-date="2015-01-01"/>
  </target>
</swiss-sanctions-list>`;

function streamFromString(xml: string): ReadableStream<Uint8Array> {
  return new Response(xml).body as ReadableStream<Uint8Array>;
}

describe("parseSecoXmlStream — real trimmed SECO consolidated sanctions fixture", () => {
  it("parses the list date and all four targets", async () => {
    const result = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    expect(result.listDate).toBe("2026-08-27");
    expect(result.targets).toHaveLength(4);
  });

  it("builds the sanctions-set-id -> program-key lookup from the header, keyed by sanctions-set ssid not the parent program ssid", async () => {
    const { programKeyBySanctionsSetId } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    expect(programKeyBySanctionsSetId.get("4387")).toBe("Belarus");
    expect(programKeyBySanctionsSetId.get("46113")).toBe("Belarus");
    expect(programKeyBySanctionsSetId.get("34422")).toBe("North Korea");
    expect(programKeyBySanctionsSetId.get("20")).toBeUndefined();
  });

  it("determines a de-listed target's status from its first (most recent) modification, and skips the nested historical <added> content without corrupting its real identity", async () => {
    const { targets } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const lukashenka = targets.find((t) => t.ssid === "5142")!;
    expect(lukashenka.latestModificationType).toBe("de-listed");
    expect(lukashenka.kind).toBe("individual");
    expect(lukashenka.identities).toHaveLength(1);
    expect(lukashenka.identities[0].names[0].parts.map((p) => p.value)).toEqual(["Lukashenka", "Dzmitry", "Aliaksandravich"]);
    expect(lukashenka.foreignIdentifiers).toEqual(["140"]);
  });

  it("extracts an active entity target", async () => {
    const { targets } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const bank = targets.find((t) => t.ssid === "46130")!;
    expect(bank.kind).toBe("entity");
    expect(bank.latestModificationType).toBe("listed");
    expect(bank.sanctionsSetIds).toEqual(["46113"]);
  });

  it("extracts an active vessel/object target with an alias name in the same identity", async () => {
    const { targets } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const vessel = targets.find((t) => t.ssid === "34461")!;
    expect(vessel.kind).toBe("object");
    expect(vessel.objectType).toBe("vessel");
    expect(vessel.identities[0].names.map((n) => n.nameType)).toEqual(["primary-name", "alias"]);
    expect(vessel.otherInformation).toEqual(["IMO Number: 8405270"]);
  });

  it("extracts a target with a non-main alias identity carrying its own nationality", async () => {
    const { targets } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const target = targets.find((t) => t.ssid === "1900")!;
    expect(target.identities).toHaveLength(2);
    const alias = target.identities.find((i) => !i.main)!;
    expect(alias.countries).toEqual(["Iraq"]);
  });
});

describe("mapSecoTarget", () => {
  it("maps an active entity to a ScreeningEntity-shaped record with resolved program codes", async () => {
    const { targets, programKeyBySanctionsSetId } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const bank = targets.find((t) => t.ssid === "46130")!;
    const mapped = mapSecoTarget(bank, programKeyBySanctionsSetId)!;
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("Belagroprombank");
    expect(mapped.programCodes).toEqual(["Belarus"]);
    expect(mapped.remarks).toBe("State-owned bank subject to restrictions on the money and capital market.");
  });

  it("maps an active vessel to entityType VESSEL with its alias folded into alternateNames", async () => {
    const { targets, programKeyBySanctionsSetId } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const vessel = targets.find((t) => t.ssid === "34461")!;
    const mapped = mapSecoTarget(vessel, programKeyBySanctionsSetId)!;
    expect(mapped.entityType).toBe("VESSEL");
    expect(mapped.name).toBe("Hui Chon");
    expect(mapped.alternateNames).toEqual(["Hwang Gum San 2"]);
  });

  it("maps a de-listed individual's name and country correctly (mapping works regardless of status -- the service itself decides exclusion)", async () => {
    const { targets, programKeyBySanctionsSetId } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const lukashenka = targets.find((t) => t.ssid === "5142")!;
    const mapped = mapSecoTarget(lukashenka, programKeyBySanctionsSetId)!;
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("Lukashenka Dzmitry Aliaksandravich");
    expect(mapped.citation).toBe("140");
    expect(mapped.programCodes).toEqual(["Belarus"]);
  });

  it("folds a non-main alias identity's primary name into alternateNames and takes country from nationality", async () => {
    const { targets, programKeyBySanctionsSetId } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const target = targets.find((t) => t.ssid === "1900")!;
    const mapped = mapSecoTarget(target, programKeyBySanctionsSetId)!;
    expect(mapped.name).toBe("Muhammad Example");
    expect(mapped.alternateNames).toEqual(["Ali Zafir 'Abdullah'"]);
    expect(mapped.country).toBe("Iraq");
  });

  it("excludes de-listed targets from the active set a real ingest run would publish", async () => {
    const { targets } = await parseSecoXmlStream(streamFromString(REAL_TRIMMED_SECO_XML));
    const active = targets.filter((t) => t.kind !== null && t.latestModificationType !== "de-listed");
    expect(active.map((t) => t.ssid).sort()).toEqual(["1900", "34461", "46130"]);
  });
});

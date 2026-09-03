import { describe, it, expect } from "vitest";
import { parseUnscXmlStream, mapUnscRecord } from "@/modules/screening/unSecurityCouncilSanctionsIngestionService";

// Real entries trimmed directly from the live UN Security Council
// Consolidated List XML (scsanctions.un.org/resources/xml/en/consolidated.xml,
// fetched 2026-09-02) -- not synthetic.
const REAL_TRIMMED_UNSC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<CONSOLIDATED_LIST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://www.un.org/sc/resources/sc-sanctions.xsd" dateGenerated="2026-09-02T23:00:02.141Z">
  <INDIVIDUALS>
    <INDIVIDUAL>
      <DATAID>6907993</DATAID>
      <VERSIONNUM>1</VERSIONNUM>
      <FIRST_NAME>ERIC</FIRST_NAME>
      <SECOND_NAME>BADEGE</SECOND_NAME>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDi.001</REFERENCE_NUMBER>
      <LISTED_ON>2012-12-31</LISTED_ON>
      <GENDER>Male</GENDER>
      <COMMENTS1>He fled to Rwanda in March 2013 and is still living there as of early 2016.</COMMENTS1>
      <INDIVIDUAL_ALIAS>
        <QUALITY/>
        <ALIAS_NAME/>
      </INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ADDRESS>
        <COUNTRY>Rwanda</COUNTRY>
        <NOTE>as of early 2016</NOTE>
      </INDIVIDUAL_ADDRESS>
      <INDIVIDUAL_DATE_OF_BIRTH>
        <TYPE_OF_DATE>EXACT</TYPE_OF_DATE>
        <YEAR>1971</YEAR>
      </INDIVIDUAL_DATE_OF_BIRTH>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>6907994</DATAID>
      <VERSIONNUM>1</VERSIONNUM>
      <FIRST_NAME>FRANK KAKOLELE</FIRST_NAME>
      <SECOND_NAME>BWAMBALE</SECOND_NAME>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDi.002</REFERENCE_NUMBER>
      <LISTED_ON>2005-11-01</LISTED_ON>
      <GENDER>Male</GENDER>
      <COMMENTS1>Left the CNDP in January 2008.</COMMENTS1>
      <INDIVIDUAL_ALIAS>
        <QUALITY>Good</QUALITY>
        <ALIAS_NAME>FRANK KAKORERE</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ALIAS>
        <QUALITY>Good</QUALITY>
        <ALIAS_NAME>FRANK KAKORERE BWAMBALE</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
    </INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <DATAID>6908402</DATAID>
      <VERSIONNUM>1</VERSIONNUM>
      <FIRST_NAME>ADF</FIRST_NAME>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDe.001</REFERENCE_NUMBER>
      <LISTED_ON>2014-06-30</LISTED_ON>
      <COMMENTS1>ADF founder and leader, Jamil Mukulu (CDi.015), was arrested in Dar es Salaam, Tanzania in April 2015.</COMMENTS1>
      <ENTITY_ALIAS>
        <QUALITY>a.k.a.</QUALITY>
        <ALIAS_NAME>Allied Democratic Forces</ALIAS_NAME>
      </ENTITY_ALIAS>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>`;

function streamFromString(xml: string): ReadableStream<Uint8Array> {
  return new Response(xml).body as ReadableStream<Uint8Array>;
}

describe("parseUnscXmlStream — real trimmed UN Security Council Consolidated List fixture", () => {
  it("parses dateGenerated and all individuals + entities", async () => {
    const result = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    expect(result.dateGenerated?.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(result.records).toHaveLength(3);
    expect(result.records.filter((r) => !r.isEntity)).toHaveLength(2);
    expect(result.records.filter((r) => r.isEntity)).toHaveLength(1);
  });

  it("extracts an individual with a blank alias placeholder and a country-only address", async () => {
    const { records } = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    const eric = records.find((r) => r.referenceNumber === "CDi.001")!;
    expect(eric.firstName).toBe("ERIC");
    expect(eric.secondName).toBe("BADEGE");
    expect(eric.aliases).toEqual([{}]);
    expect(eric.addresses).toEqual([{ parts: [], country: "Rwanda" }]);
    expect(eric.birthYears).toEqual(["1971"]);
  });

  it("extracts an individual with two real aliases", async () => {
    const { records } = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    const frank = records.find((r) => r.referenceNumber === "CDi.002")!;
    expect(frank.aliases.map((a) => a.aliasName)).toEqual(["FRANK KAKORERE", "FRANK KAKORERE BWAMBALE"]);
  });

  it("extracts an entity record with one alias", async () => {
    const { records } = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    const adf = records.find((r) => r.referenceNumber === "CDe.001")!;
    expect(adf.isEntity).toBe(true);
    expect(adf.aliases).toEqual([{ aliasName: "Allied Democratic Forces" }]);
  });

  it("maps an individual to a ScreeningEntity-shaped record, dropping blank aliases", async () => {
    const { records } = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    const eric = records.find((r) => r.referenceNumber === "CDi.001")!;
    const mapped = mapUnscRecord(eric);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("ERIC BADEGE");
    expect(mapped.alternateNames).toEqual([]);
    expect(mapped.country).toBe("Rwanda");
    expect(mapped.citation).toBe("CDi.001");
  });

  it("maps an entity to a ScreeningEntity-shaped record", async () => {
    const { records } = await parseUnscXmlStream(streamFromString(REAL_TRIMMED_UNSC_XML));
    const adf = records.find((r) => r.referenceNumber === "CDe.001")!;
    const mapped = mapUnscRecord(adf);
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("ADF");
    expect(mapped.alternateNames).toEqual(["Allied Democratic Forces"]);
    expect(mapped.programCodes).toEqual(["DRC"]);
  });
});

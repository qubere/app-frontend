import { describe, it, expect } from "vitest";
import { parseUkslXmlStream, mapUkslDesignation } from "@/modules/screening/uksSanctionsListIngestionService";

// Real entries trimmed directly from the live UK Sanctions List XML
// (sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml, fetched 2026-09-02)
// -- not synthetic.
const REAL_TRIMMED_UKSL_XML = `<?xml version="1.0" encoding="utf-8"?>
<Designations xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <DateGenerated>02/09/2026</DateGenerated>
  <Designation>
    <LastUpdated>04/08/2026</LastUpdated>
    <DateDesignated>29/06/2012</DateDesignated>
    <UniqueID>AFG0001</UniqueID>
    <OFSIGroupID>12703</OFSIGroupID>
    <UNReferenceNumber>TAe.010</UNReferenceNumber>
    <Names>
      <Name>
        <Name6>HAJI KHAIRULLAH HAJI SATTAR MONEY EXCHANGE</Name6>
        <NameType>Primary Name</NameType>
      </Name>
      <Name>
        <Name6>Haji Alim Hawala</Name6>
        <NameType>Alias</NameType>
      </Name>
      <Name>
        <Name6>Haji Hakim Hawala</Name6>
        <NameType>Alias</NameType>
      </Name>
    </Names>
    <RegimeName>The Afghanistan (Sanctions) (EU Exit) Regulations 2020</RegimeName>
    <IndividualEntityShip>Entity</IndividualEntityShip>
    <DesignationSource>UN</DesignationSource>
    <SanctionsImposed>Asset freeze</SanctionsImposed>
    <OtherInformation>Afghan Money Service Provider License Number: 044.</OtherInformation>
    <UKStatementofReasons>
</UKStatementofReasons>
    <Addresses>
      <Address>
        <AddressLine1>Ansari Market, 2nd Floor</AddressLine1>
        <AddressLine6>Nimroz Province</AddressLine6>
        <AddressCountry>Afghanistan</AddressCountry>
      </Address>
      <Address>
        <AddressLine1>Branch Office 14</AddressLine1>
        <AddressLine6>Dubai</AddressLine6>
        <AddressCountry>United Arab Emirates</AddressCountry>
      </Address>
    </Addresses>
  </Designation>
  <Designation>
    <LastUpdated>14/04/2026</LastUpdated>
    <DateDesignated>25/01/2001</DateDesignated>
    <UniqueID>AFG0006</UniqueID>
    <OFSIGroupID>7172</OFSIGroupID>
    <UNReferenceNumber>TAi.002</UNReferenceNumber>
    <Names>
      <Name>
        <Name1>MOHAMMAD</Name1>
        <Name2>HASSAN</Name2>
        <Name6>AKHUND</Name6>
        <NameType>Primary Name</NameType>
      </Name>
    </Names>
    <RegimeName>The Afghanistan (Sanctions) (EU Exit) Regulations 2020</RegimeName>
    <IndividualEntityShip>Individual</IndividualEntityShip>
    <DesignationSource>UN</DesignationSource>
    <SanctionsImposed>Asset freeze|Travel Ban</SanctionsImposed>
    <OtherInformation>A close associate of Mullah Mohammed Omar (TAi.004).</OtherInformation>
    <UKStatementofReasons>
</UKStatementofReasons>
    <Addresses>
      <Address>
        <AddressLine6>Kabul</AddressLine6>
        <AddressCountry>Afghanistan</AddressCountry>
      </Address>
    </Addresses>
    <IndividualDetails>
      <Individual>
        <DOBs>
          <DOB>dd/mm/1945</DOB>
          <DOB>dd/mm/1946</DOB>
        </DOBs>
      </Individual>
    </IndividualDetails>
  </Designation>
</Designations>`;

function streamFromString(xml: string): ReadableStream<Uint8Array> {
  return new Response(xml).body as ReadableStream<Uint8Array>;
}

describe("parseUkslXmlStream — real trimmed UK Sanctions List fixture", () => {
  it("parses DateGenerated and both designations", async () => {
    const result = await parseUkslXmlStream(streamFromString(REAL_TRIMMED_UKSL_XML));
    expect(result.dateGenerated?.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(result.designations).toHaveLength(2);
  });

  it("extracts an Entity designation with primary name, aliases, and multiple addresses", async () => {
    const { designations } = await parseUkslXmlStream(streamFromString(REAL_TRIMMED_UKSL_XML));
    const entity = designations.find((d) => d.uniqueId === "AFG0001")!;
    expect(entity.individualEntityShip).toBe("Entity");
    expect(entity.names[0]).toEqual({ parts: ["HAJI KHAIRULLAH HAJI SATTAR MONEY EXCHANGE"], nameType: "Primary Name" });
    expect(entity.names).toHaveLength(3);
    expect(entity.addresses).toHaveLength(2);
    expect(entity.addresses[1].country).toBe("United Arab Emirates");
  });

  it("extracts an Individual designation with multi-part name and DOBs", async () => {
    const { designations } = await parseUkslXmlStream(streamFromString(REAL_TRIMMED_UKSL_XML));
    const individual = designations.find((d) => d.uniqueId === "AFG0006")!;
    expect(individual.individualEntityShip).toBe("Individual");
    expect(individual.names[0].parts).toEqual(["MOHAMMAD", "HASSAN", "AKHUND"]);
    expect(individual.dobs).toEqual(["dd/mm/1945", "dd/mm/1946"]);
  });

  it("maps a designation to a ScreeningEntity-shaped record with entityType and alternateNames", async () => {
    const { designations } = await parseUkslXmlStream(streamFromString(REAL_TRIMMED_UKSL_XML));
    const entity = designations.find((d) => d.uniqueId === "AFG0001")!;
    const mapped = mapUkslDesignation(entity);
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("HAJI KHAIRULLAH HAJI SATTAR MONEY EXCHANGE");
    expect(mapped.alternateNames).toEqual(["Haji Alim Hawala", "Haji Hakim Hawala"]);
    expect(mapped.country).toBe("Afghanistan");
    expect(mapped.citation).toBe("AFG0001");

    const individual = designations.find((d) => d.uniqueId === "AFG0006")!;
    const mappedIndividual = mapUkslDesignation(individual);
    expect(mappedIndividual.entityType).toBe("INDIVIDUAL");
    expect(mappedIndividual.name).toBe("MOHAMMAD HASSAN AKHUND");
  });
});

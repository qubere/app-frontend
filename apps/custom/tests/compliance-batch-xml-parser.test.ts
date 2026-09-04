import { describe, it, expect } from "vitest";
import { parseTransactionComplianceXml, ComplianceBatchXmlStructureError } from "@/modules/complianceBatch/xmlParser";

const FLAGS = {
  partyScreening: true,
  licenseScreening: false,
  embargoScreening: false,
  productClassification: false,
};

describe("parseTransactionComplianceXml", () => {
  it("parses records from a flat <Records><Record> document", () => {
    const xml = `<?xml version="1.0"?>
<Records>
  <Record>
    <TransactionId>TXN-1</TransactionId>
    <PartyName>Acme Corp</PartyName>
    <OriginCountry>US</OriginCountry>
    <DestinationCountry>DE</DestinationCountry>
    <OperationType>EXPORT</OperationType>
  </Record>
  <Record>
    <TransactionId>TXN-2</TransactionId>
    <PartyName>Globex Inc</PartyName>
    <OriginCountry>US</OriginCountry>
    <DestinationCountry>FR</DestinationCountry>
    <OperationType>EXPORT</OperationType>
  </Record>
</Records>`;

    const { records, invalidRows } = parseTransactionComplianceXml(xml, FLAGS);
    expect(invalidRows).toEqual([]);
    expect(records).toHaveLength(2);
    expect(records[0].party?.name).toBe("Acme Corp");
    expect(records[0].destinationCountry).toBe("DE");
    expect(records[1].party?.name).toBe("Globex Inc");
  });

  it("rejects an individual record missing a required field without failing the whole file", () => {
    const xml = `<Records>
  <Record>
    <TransactionId>TXN-1</TransactionId>
    <PartyName>Acme Corp</PartyName>
    <OriginCountry>US</OriginCountry>
    <DestinationCountry>DE</DestinationCountry>
    <OperationType>EXPORT</OperationType>
  </Record>
  <Record>
    <TransactionId>TXN-2</TransactionId>
    <OriginCountry>US</OriginCountry>
    <DestinationCountry>FR</DestinationCountry>
    <OperationType>EXPORT</OperationType>
  </Record>
</Records>`;

    const { records, invalidRows } = parseTransactionComplianceXml(xml, FLAGS);
    expect(records).toHaveLength(1);
    expect(invalidRows).toEqual([{ rowNumber: 2, errors: ["partyName is required when Party Screening is enabled."] }]);
  });

  it("throws a structure error for malformed XML", () => {
    expect(() => parseTransactionComplianceXml("<Records><Record><Foo></Records>", FLAGS)).toThrow(
      ComplianceBatchXmlStructureError
    );
  });

  it("throws a structure error when there are no record elements", () => {
    expect(() => parseTransactionComplianceXml("<Records></Records>", FLAGS)).toThrow(ComplianceBatchXmlStructureError);
  });

  it("never expands a DOCTYPE-declared internal entity (XXE/billion-laughs guard)", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE Records [<!ENTITY xxe "pwned">]>
<Records>
  <Record>
    <TransactionId>TXN-1</TransactionId>
    <PartyName>&xxe;</PartyName>
    <OriginCountry>US</OriginCountry>
    <DestinationCountry>DE</DestinationCountry>
    <OperationType>EXPORT</OperationType>
  </Record>
</Records>`;

    expect(() => parseTransactionComplianceXml(xml, FLAGS)).toThrow(ComplianceBatchXmlStructureError);
  });
});

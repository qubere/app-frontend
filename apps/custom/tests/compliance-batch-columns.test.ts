import { describe, it, expect } from "vitest";
import { mapTransactionColumns, rowToCanonicalRequest } from "@/modules/complianceBatch/columns";

// TRANSACTION_COMPLIANCE CSV mapping: a row that doesn't satisfy the
// service flags it's meant to feed is rejected on its own (CONTINUE_VALID_
// RECORDS) rather than silently guessing a classification/party identity.

const HEADERS = [
  "Transaction ID",
  "Party Name",
  "Party Address",
  "Party City",
  "Party Country",
  "Origin Country",
  "Destination Country",
  "ECCN",
  "Operation Type",
  "Product Description",
];

describe("mapTransactionColumns", () => {
  it("resolves fields via case/whitespace-insensitive aliases", () => {
    const mapping = mapTransactionColumns(HEADERS);
    expect(mapping.indexByField.transactionId).toBe(0);
    expect(mapping.indexByField.partyName).toBe(1);
    expect(mapping.indexByField.eccn).toBe(7);
  });

  it("leaves a field unmapped when no header alias matches", () => {
    const mapping = mapTransactionColumns(["Foo", "Bar"]);
    expect(mapping.indexByField.partyName).toBeUndefined();
  });

  it("resolves a field via a template header the built-in alias table doesn't know", () => {
    const mapping = mapTransactionColumns(["Consignee", "Foo"], { partyName: "Consignee" });
    expect(mapping.indexByField.partyName).toBe(0);
  });

  it("still falls back to the built-in alias when the template header isn't present in this file", () => {
    const mapping = mapTransactionColumns(HEADERS, { partyName: "Consignee" });
    expect(mapping.indexByField.partyName).toBe(1);
    expect(mapping.indexByField.eccn).toBe(7);
  });
});

describe("rowToCanonicalRequest", () => {
  const mapping = mapTransactionColumns(HEADERS);

  it("builds a request when partyScreening is enabled and a party name is present", () => {
    const row = ["TXN-1", "Acme Corp", "123 Main St", "Springfield", "US", "US", "DE", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 1, {
      partyScreening: true,
      licenseScreening: false,
      embargoScreening: false,
      productClassification: false,
    });
    expect(errors).toEqual([]);
    expect(request?.party?.name).toBe("Acme Corp");
    expect(request?.destinationCountry).toBe("DE");
  });

  it("rejects the row when partyScreening is enabled but no party name column resolves", () => {
    const row = ["TXN-1", "", "", "", "", "US", "DE", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 2, {
      partyScreening: true,
      licenseScreening: false,
      embargoScreening: false,
      productClassification: false,
    });
    expect(request).toBeNull();
    expect(errors).toContain("partyName is required when Party Screening is enabled.");
  });

  it("rejects the row when licenseScreening is enabled but no ECCN/HTS column resolves", () => {
    const row = ["TXN-1", "Acme Corp", "", "", "", "US", "DE", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 3, {
      partyScreening: false,
      licenseScreening: true,
      embargoScreening: false,
      productClassification: false,
    });
    expect(request).toBeNull();
    expect(errors.some((e) => e.includes("classification"))).toBe(true);
  });

  it("builds a classification from ECCN when licenseScreening is enabled", () => {
    const row = ["TXN-1", "Acme Corp", "", "", "", "US", "DE", "5A992", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 4, {
      partyScreening: false,
      licenseScreening: true,
      embargoScreening: false,
      productClassification: false,
    });
    expect(errors).toEqual([]);
    expect(request?.classification).toEqual({ type: "ECCN", value: "5A992" });
  });

  it("rejects an operationType outside EXPORT/IMPORT", () => {
    const row = ["TXN-1", "Acme Corp", "", "", "", "US", "DE", "5A992", "TRANSSHIP", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 5, {
      partyScreening: false,
      licenseScreening: true,
      embargoScreening: false,
      productClassification: false,
    });
    expect(request).toBeNull();
    expect(errors.some((e) => e.includes("operationType"))).toBe(true);
  });

  it("builds a request when embargoScreening is enabled and both countries are present", () => {
    const row = ["TXN-1", "Acme Corp", "", "", "", "US", "DE", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 6, {
      partyScreening: false,
      licenseScreening: false,
      embargoScreening: true,
      productClassification: false,
    });
    expect(errors).toEqual([]);
    expect(request?.complianceCountry).toBe("US");
    expect(request?.destinationCountry).toBe("DE");
  });

  it("rejects the row when embargoScreening is enabled but destinationCountry is missing", () => {
    const row = ["TXN-1", "Acme Corp", "", "", "", "US", "", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 7, {
      partyScreening: false,
      licenseScreening: false,
      embargoScreening: true,
      productClassification: false,
    });
    expect(request).toBeNull();
    expect(errors.some((e) => e.includes("Embargo Screening"))).toBe(true);
  });

  it("builds a request with product facts when productClassification is enabled and a description is present", () => {
    const row = ["TXN-1", "", "", "", "", "US", "DE", "", "EXPORT", "Stainless steel bracket"];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 8, {
      partyScreening: false,
      licenseScreening: false,
      embargoScreening: false,
      productClassification: true,
    });
    expect(errors).toEqual([]);
    expect(request?.product?.description).toBe("Stainless steel bracket");
  });

  it("rejects the row when productClassification is enabled but no productDescription resolves", () => {
    const row = ["TXN-1", "", "", "", "", "US", "DE", "", "EXPORT", ""];
    const { request, errors } = rowToCanonicalRequest(mapping, row, 9, {
      partyScreening: false,
      licenseScreening: false,
      embargoScreening: false,
      productClassification: true,
    });
    expect(request).toBeNull();
    expect(errors).toContain("productDescription is required when Product Classification is enabled.");
  });
});

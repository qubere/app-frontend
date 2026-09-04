import { describe, it, expect } from "vitest";
import {
  DOCUMENT_PAGE_SIZE_DEFAULT,
  DOCUMENT_PAGE_SIZE_MAX,
  buildDocumentWhere,
  documentSkip,
  parseDocumentQuery,
} from "@/modules/documents/documentQuery";

function q(qs: string) {
  return parseDocumentQuery(new URLSearchParams(qs));
}

describe("document query parsing", () => {
  it("applies defaults when nothing is supplied", () => {
    expect(q("")).toEqual({
      search: null,
      docType: null,
      status: null,
      clientId: null,
      shipmentId: null,
      linkedEntityType: null,
      linkedEntityId: null,
      assignedBrokerIds: [],
      archivedOnly: false,
      createdFrom: null,
      createdTo: null,
      sort: "createdAt",
      direction: "desc",
      page: 1,
      pageSize: DOCUMENT_PAGE_SIZE_DEFAULT,
    });
  });

  it("treats blank and whitespace-only filters as absent", () => {
    const parsed = q("search=%20%20&docType=&status=%09");
    expect(parsed.search).toBeNull();
    expect(parsed.docType).toBeNull();
    expect(parsed.status).toBeNull();
  });

  it("maps the unattached sentinel to a null shipmentId so detached documents stay reachable", () => {
    expect(buildDocumentWhere("acc_1", q("shipmentId=UNATTACHED")).shipmentId).toBeNull();
    expect(buildDocumentWhere("acc_1", q("shipmentId=shp_1")).shipmentId).toBe("shp_1");
    expect("shipmentId" in buildDocumentWhere("acc_1", q(""))).toBe(false);
  });

  it("scopes documents by assignee through the parent shipment without losing the client filter", () => {
    expect(q("assignedBrokerIds=u_1,%20u_2,,u_1").assignedBrokerIds).toEqual(["u_1", "u_2"]);

    const where = buildDocumentWhere("acc_1", q("assignedBrokerIds=u_1&clientId=cli_1"));
    expect(where.AND).toEqual([
      { OR: [{ clientId: "cli_1" }, { shipment: { clientId: "cli_1" } }] },
      {
        OR: [
          { assignedToUserId: { in: ["u_1"] } },
          { shipment: { assignedBrokerId: { in: ["u_1"] } } },
        ],
      },
    ]);

    expect(buildDocumentWhere("acc_1", q("")).shipment).toBeUndefined();
  });

  it("caps pageSize so a client cannot request the whole table", () => {
    expect(q("pageSize=100000").pageSize).toBe(DOCUMENT_PAGE_SIZE_MAX);
  });

  it("falls back to defaults for non-numeric, zero and negative paging", () => {
    for (const bad of ["page=0", "page=-3", "page=abc", "page=1.5"]) {
      expect(q(bad).page).toBe(1);
    }
    for (const bad of ["pageSize=0", "pageSize=-1", "pageSize=nope"]) {
      expect(q(bad).pageSize).toBe(DOCUMENT_PAGE_SIZE_DEFAULT);
    }
  });

  it("computes skip from page and pageSize", () => {
    expect(documentSkip(q("page=1&pageSize=25"))).toBe(0);
    expect(documentSkip(q("page=3&pageSize=25"))).toBe(50);
  });
});

describe("document where clause", () => {
  it("always pins the account, whatever the query says", () => {
    const where = buildDocumentWhere("acct_a", q("search=x&docType=Packing List&status=Missing"));
    expect(where.accountId).toBe("acct_a");
  });

  it("cannot be widened by an accountId query parameter", () => {
    const where = buildDocumentWhere("acct_a", q("accountId=acct_b&search=acct_b"));
    expect(where.accountId).toBe("acct_a");
  });

  it("omits filters that were not supplied", () => {
    const where = buildDocumentWhere("acct_a", q(""));
    expect(where).toEqual({ accountId: "acct_a" });
  });

  it("searches identity, client, shipment, parsed text, and every extracted field case-insensitively", () => {
    const where = buildDocumentWhere("acct_a", q("search=INV-45"));
    expect(where.AND).toEqual([{ OR: [
      { fileName: { contains: "INV-45", mode: "insensitive" } },
      { docType: { contains: "INV-45", mode: "insensitive" } },
      { uploadedByName: { contains: "INV-45", mode: "insensitive" } },
      { uploadedByEmail: { contains: "INV-45", mode: "insensitive" } },
      { parsedSearchText: { contains: "INV-45", mode: "insensitive" } },
      { extractedJson: { contains: "INV-45", mode: "insensitive" } },
      { rawContent: { contains: "INV-45", mode: "insensitive" } },
      { extractionFields: { some: { OR: [
        { fieldName: { contains: "INV-45", mode: "insensitive" } },
        { value: { contains: "INV-45", mode: "insensitive" } },
      ] } } },
      { client: { name: { contains: "INV-45", mode: "insensitive" } } },
      { shipment: { shipmentNumber: { contains: "INV-45", mode: "insensitive" } } },
      { shipment: { client: { name: { contains: "INV-45", mode: "insensitive" } } } },
    ] }]);
  });

  it("combines exact filters with search", () => {
    const where = buildDocumentWhere("acct_a", q("search=inv&docType=Commercial Invoice&status=Received"));
    expect(where.docType).toBe("Commercial Invoice");
    expect(where.status).toBe("Received");
    expect(where.AND).toHaveLength(1);
    expect((where.AND as Array<{ OR: unknown[] }>)[0]?.OR).toHaveLength(11);
  });

  it("filters by client on either the document or its legacy parent shipment", () => {
    expect(buildDocumentWhere("acct_a", q("clientId=cli_1")).AND).toEqual([
      { OR: [{ clientId: "cli_1" }, { shipment: { clientId: "cli_1" } }] },
    ]);
  });

  it("treats UNASSIGNED as neither a direct nor inherited client", () => {
    expect(buildDocumentWhere("acct_a", q("clientId=UNASSIGNED")).AND).toEqual([
      { clientId: null, OR: [{ shipmentId: null }, { shipment: { clientId: null } }] },
    ]);
  });

  it("filters by linked entity type without requiring a specific entity id", () => {
    expect(buildDocumentWhere("acct_a", q("linkedEntityType=PARTY")).associations).toEqual({
      some: { entityType: "PARTY", active: true },
    });
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AlsoKnownAsPanel } from "../src/app/app/importers/[id]/page";
import { AlsoKnownAsSection } from "../src/app/app/parties/[id]/PartyTabs";
import type { AlsoKnownAsSummary } from "../src/modules/importers/alsoKnownAs";

// The Clerk auth wall blocks a live browser check of these pages in this
// environment (confirmed: middleware redirects to sign-in before the page
// component ever runs, so there is no route to reach it without
// credentials, which this session must never enter). This is the available
// substitute: actually rendering the two new panel components to markup
// with representative data, rather than only type-checking their JSX.

describe("AlsoKnownAsPanel (importer detail page)", () => {
  it("renders nothing when there is no party link at all", () => {
    expect(renderToStaticMarkup(<AlsoKnownAsPanel summary={null} partyId={null} />)).toBe("");
  });

  it("renders nothing for a freshly bridged party with no other roles or links -- not an empty error state", () => {
    const summary: AlsoKnownAsSummary = { otherRoles: [], linkedLegalEntityCount: 0, productPartyCount: 0, shipmentPartyCount: 0 };
    expect(renderToStaticMarkup(<AlsoKnownAsPanel summary={summary} partyId="party-1" />)).toBe("");
  });

  it("renders the payoff scenario: a supplier becoming an importer, with a link to the full party record", () => {
    const summary: AlsoKnownAsSummary = { otherRoles: ["SUPPLIER"], linkedLegalEntityCount: 1, productPartyCount: 6, shipmentPartyCount: 0 };
    const html = renderToStaticMarkup(<AlsoKnownAsPanel summary={summary} partyId="party-1" />);

    expect(html).toContain("Also known as");
    expect(html).toContain("Also Supplier in your party master");
    expect(html).toContain("Party on 6 products");
    expect(html).toContain("1 other linked legal entity record");
    expect(html).toContain('href="/app/parties/party-1"');
    expect(html).toContain("View full party record");
  });

  it("uses singular phrasing for a single product/shipment/entity", () => {
    const summary: AlsoKnownAsSummary = { otherRoles: [], linkedLegalEntityCount: 1, productPartyCount: 1, shipmentPartyCount: 1 };
    const html = renderToStaticMarkup(<AlsoKnownAsPanel summary={summary} partyId={null} />);

    expect(html).toContain("Party on 1 product<");
    expect(html).toContain("Party on 1 shipment<");
    expect(html).toContain("1 other linked legal entity record<");
    expect(html).not.toContain('href="/app/parties');
  });
});

describe("AlsoKnownAsSection (party detail page)", () => {
  const baseParty = { legalEntities: [] as any[], carrierProfile: null as any };

  it("renders nothing when the party has no carrier profile and no bridged importer", () => {
    expect(renderToStaticMarkup(<AlsoKnownAsSection party={baseParty as any} />)).toBe("");
  });

  it("renders a carrier profile block", () => {
    const party = { ...baseParty, carrierProfile: { scac: "ACME", dot: "1234567" } };
    const html = renderToStaticMarkup(<AlsoKnownAsSection party={party as any} />);
    expect(html).toContain("Carrier");
    expect(html).toContain("SCAC ACME");
    expect(html).toContain("DOT 1234567");
  });

  it("links to the bridged importer of record with a humanized status", () => {
    const party = {
      ...baseParty,
      legalEntities: [
        { id: "legal-1", legalName: "Acme", importerOfRecord: { id: "importer-1", registrationStatus: "pending_5106", cbpImporterNumber: null } },
      ],
    };
    const html = renderToStaticMarkup(<AlsoKnownAsSection party={party as any} />);
    expect(html).toContain('href="/app/importers/importer-1"');
    expect(html).toContain("Importer of record");
    expect(html).toContain("Pending 5106");
  });

  it("skips legal entities that have no importer of record", () => {
    const party = { ...baseParty, legalEntities: [{ id: "legal-1", legalName: "Acme", importerOfRecord: null }] };
    expect(renderToStaticMarkup(<AlsoKnownAsSection party={party as any} />)).toBe("");
  });
});

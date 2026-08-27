import { describe, it, expect } from "vitest";
import { renderRpsEmail } from "@/modules/compliance/notifications/templates";
import { escapeHtml } from "@/modules/compliance/notifications/templates/escapeHtml";
import type { RpsEmailRenderInput, RpsEmailResultView } from "@/modules/compliance/notifications/templates/types";

const MALICIOUS_NAME = 'Evil <script>alert("x")</script> & "Co" \'Ltd\'';

function baseResult(overrides: Partial<RpsEmailResultView> = {}): RpsEmailResultView {
  return {
    id: "result_1",
    status: "HIT",
    screenedName: MALICIOUS_NAME,
    screenedAddress: "123 Danger St",
    screenedCity: "Somewhere",
    screenedCountry: "Nowhereland",
    hitCount: 2,
    redFlagCount: 1,
    partyId: "party_1",
    shipmentId: null,
    matches: [
      { sourceList: "OFAC SDN", matchedName: MALICIOUS_NAME, nameScore: 97, matchMethod: "FUZZY" },
      { sourceList: "BIS Entity List", matchedName: "Some Other Corp", nameScore: 88, matchMethod: "EXACT" },
    ],
    ...overrides,
  };
}

function baseInput(overrides: Partial<RpsEmailRenderInput> = {}): RpsEmailRenderInput {
  return {
    notificationType: "RPS_HIT",
    result: baseResult(),
    appBaseUrl: "https://app.qubere.ai",
    secure: false,
    ...overrides,
  };
}

const PII_FIELDS = ["screenedName", "screenedAddress", "screenedCity", "screenedCountry"] as const;

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    );
  });

  it("returns an empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("renderSecureRpsEmail (secure: true)", () => {
  it("never includes screened-party identity or match evidence in subject, html, or text", () => {
    const rendered = renderRpsEmail(baseInput({ secure: true }));
    const combined = `${rendered.subject}\n${rendered.html}\n${rendered.text}`;

    expect(combined).not.toContain(MALICIOUS_NAME);
    expect(combined).not.toContain("123 Danger St");
    expect(combined).not.toContain("Somewhere");
    expect(combined).not.toContain("Nowhereland");
    expect(combined).not.toContain("OFAC SDN");
    expect(combined).not.toContain("Some Other Corp");
  });

  it("still includes a review link and a generic label", () => {
    const rendered = renderRpsEmail(baseInput({ secure: true }));
    expect(rendered.html).toContain("https://app.qubere.ai/app/parties/party_1?screeningResultId=result_1");
    expect(rendered.text).toContain("https://app.qubere.ai/app/parties/party_1?screeningResultId=result_1");
    expect(rendered.subject).toContain("Restricted Party Match");
  });

  it("holds for every notification type / PII field combination (no leakage regardless of type)", () => {
    for (const notificationType of ["RPS_HIT", "RPS_REVIEW_REQUIRED", "PAL_RESCREEN_HIT", "PARTY_RESCREEN_HIT"] as const) {
      const rendered = renderRpsEmail(baseInput({ secure: true, notificationType }));
      const combined = `${rendered.subject}\n${rendered.html}\n${rendered.text}`;
      for (const field of PII_FIELDS) {
        const value = baseResult()[field];
        if (value) expect(combined).not.toContain(value);
      }
    }
  });
});

describe("renderNonSecureRpsEmail (secure: false)", () => {
  it("includes screened name, location, and top matches", () => {
    const rendered = renderRpsEmail(baseInput({ secure: false }));
    expect(rendered.subject).toContain("Restricted Party Match");
    expect(rendered.text).toContain("Somewhere, Nowhereland");
    expect(rendered.text).toContain("OFAC SDN");
    expect(rendered.text).toContain("Some Other Corp");
  });

  it("HTML-escapes a malicious party/match name instead of injecting raw markup", () => {
    const rendered = renderRpsEmail(baseInput({ secure: false }));
    expect(rendered.html).not.toContain("<script>alert(");
    expect(rendered.html).toContain(escapeHtml(MALICIOUS_NAME));
  });

  it("limits rendered matches to the top 5", () => {
    const manyMatches = Array.from({ length: 8 }, (_, i) => ({
      sourceList: "OFAC SDN",
      matchedName: `Match ${i}`,
      nameScore: 90 - i,
      matchMethod: "FUZZY",
    }));
    const rendered = renderRpsEmail(baseInput({ secure: false, result: baseResult({ matches: manyMatches }) }));
    for (let i = 0; i < 5; i++) expect(rendered.text).toContain(`Match ${i}`);
    for (let i = 5; i < 8; i++) expect(rendered.text).not.toContain(`Match ${i}`);
  });
});

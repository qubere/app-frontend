import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrySummaryValidationPanel } from "../src/app/app/filing/[id]/EntrySummaryValidationPanel";
import { EntrySummaryProvenancePopover, formatBlockId } from "../src/app/app/filing/[id]/EntrySummaryProvenancePopover";

// Same rationale as tests/also-known-as-panel.render.test.tsx: the Clerk auth
// wall blocks a live browser check of the filing detail page in this
// environment, so these are static-markup render checks of the U13 (issue
// #219 Phase C) presentational components instead.

describe("formatBlockId", () => {
  it("renders a plain header block with its number and humanized label", () => {
    expect(formatBlockId("B23_IMPORTER_NUMBER")).toBe("B23 · Importer Number");
  });

  it("keeps known acronyms upper-cased", () => {
    expect(formatBlockId("B29A_HTSUS_NUMBER")).toBe("B29A · HTSUS Number");
  });

  it("falls back to the raw id when it doesn't match the expected shape", () => {
    expect(formatBlockId("not-a-block")).toBe("not-a-block");
  });
});

describe("EntrySummaryValidationPanel", () => {
  it("renders a clean-draft state when there are no findings", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryValidationPanel findings={[]} blockingCount={0} warningCount={0} shipmentId="ship-1" />
    );
    expect(html).toContain("No validation findings");
  });

  it("renders BLOCKING findings with a remediation link into the shipment workspace", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryValidationPanel
        findings={[
          {
            code: "E7501.B26.IMPORTER_OF_RECORD_MISSING",
            severity: "BLOCKING",
            blocks: ["B26_IMPORTER_OF_RECORD_NAME"],
            message: "No importer of record is on file for this shipment.",
            remediation: { label: "Fix on the shipment workspace", anchor: "#overview" },
          },
        ]}
        blockingCount={1}
        warningCount={0}
        shipmentId="ship-1"
      />
    );
    expect(html).toContain("E7501.B26.IMPORTER_OF_RECORD_MISSING");
    expect(html).toContain("BLOCKING");
    expect(html).toContain("No importer of record is on file for this shipment.");
    expect(html).toContain('href="/app/shipments/ship-1#overview"');
    expect(html).toContain("B26 · Importer Of Record Name");
  });

  it("renders a warning count badge distinct from the blocking badge", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryValidationPanel
        findings={[
          {
            code: "E7501.WARN.SOMETHING",
            severity: "WARNING",
            blocks: [],
            message: "Something is worth a second look.",
            remediation: { label: "Review", anchor: "#overview" },
          },
        ]}
        blockingCount={0}
        warningCount={1}
        shipmentId="ship-1"
      />
    );
    expect(html).toContain("1 warning");
    expect(html).not.toContain("blocking<");
  });
});

describe("EntrySummaryProvenancePopover", () => {
  it("renders a MISSING field honestly -- no fabricated value, an explicit no-source message", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryProvenancePopover
        target={{
          blockId: "B04_SURETY_NUMBER",
          value: null,
          provenance: { source: "MISSING", asOf: "2026-09-01T00:00:00.000Z" },
        }}
        onClose={() => {}}
      />
    );
    expect(html).toContain("MISSING");
    expect(html).toContain("No source — nothing has been fabricated in its place");
    // The "current value" row must render the dash placeholder, not the
    // string "null" or an empty cell that could be mistaken for real data.
    expect(html).toMatch(/Current value[\s\S]*—/);
  });

  it("renders a DOCUMENT-sourced field with its document id, page, and confidence", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryProvenancePopover
        target={{
          blockId: "B28_DESCRIPTION",
          value: "Steel widgets",
          provenance: {
            source: "DOCUMENT",
            documentId: "doc_123",
            documentPage: 2,
            factId: "fact_456",
            confidence: 0.92,
            asOf: "2026-09-01T00:00:00.000Z",
          },
        }}
        onClose={() => {}}
      />
    );
    expect(html).toContain("Steel widgets");
    expect(html).toContain("doc_123");
    expect(html).toContain("page 2");
    expect(html).toContain("92%");
  });

  it("renders a human confirmation badge when a fieldApprovalId is present", () => {
    const html = renderToStaticMarkup(
      <EntrySummaryProvenancePopover
        target={{
          blockId: "B23_IMPORTER_NUMBER",
          value: "12-3456789",
          provenance: { source: "USER", fieldApprovalId: "approval_1", asOf: "2026-09-01T00:00:00.000Z" },
        }}
        onClose={() => {}}
      />
    );
    expect(html).toContain("Confirmed by human review");
    expect(html).toContain("approval_1");
  });
});

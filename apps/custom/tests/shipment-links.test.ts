import { describe, expect, it } from "vitest";
import { shipmentDocumentViewerUrl } from "../src/lib/shipmentLinks";

// Regression coverage for the #335 bug: the Evidence & lineage tab's source
// document link used `?tab=documents`, but the shipment detail page reads a
// `view` param (not `tab`) and has no "documents" tab value at all, so the
// link silently landed on the default workspace tab instead of opening the
// document. PartyTabs.tsx and ProductTabs.tsx both now build the href
// through this single helper instead of duplicating the URL shape inline.

describe("shipmentDocumentViewerUrl", () => {
  it("opens the workspace tab with the document id, not a nonexistent documents tab", () => {
    const url = shipmentDocumentViewerUrl("shipment-1", "doc-1");

    expect(url).toBe("/app/shipments/shipment-1?view=workspace&docId=doc-1");
    expect(url).not.toContain("tab=documents");
  });
});

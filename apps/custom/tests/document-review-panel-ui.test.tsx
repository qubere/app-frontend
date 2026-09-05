// @vitest-environment happy-dom
/**
 * Component-rendering coverage for DocumentReviewPanel against spec §85
 * ("UI Acceptance"): document type, action-required counts, conflicts,
 * accept/correct/reject/resolve actions, and the auto-verified collapse.
 *
 * This is the first component-rendering suite in this app -- see
 * vitest.config.mts (global environment stays "node" for the ~470 existing
 * unit tests; this file opts into "happy-dom" via the docblock above) and
 * package.json (@testing-library/react + @testing-library/jest-dom added
 * as devDependencies for this purpose).
 *
 * Scoped out: PdfCanvas (real PDF-page rendering onto <canvas> via
 * pdfjs-dist's worker/canvas pipeline -- not something jsdom/happy-dom can
 * do, and not this panel's own logic) and DocumentProcessingBadge (an
 * unrelated polling widget) are stubbed out below so the panel can mount;
 * everything under test is the panel's own markup and handlers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DocumentReviewPanel, type ReviewDecision } from "@/components/DocumentReviewPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/PdfCanvas", () => ({
  PdfCanvas: () => <div data-testid="pdf-canvas-stub" />,
}));

vi.mock("@/components/DocumentProcessingBadge", () => ({
  DocumentProcessingBadge: () => <span data-testid="processing-badge-stub" />,
}));

const DECISIONS: ReviewDecision[] = [
  {
    id: "d-blocked",
    agentName: "Compliance Agent",
    status: "Rejected",
    triageState: null,
    createdAt: "2026-09-01T00:00:00Z",
    decisionSummary: "Restricted party match found.",
  },
  {
    id: "d-review",
    agentName: "Origin Agent",
    status: "Needs Review",
    triageState: null,
    createdAt: "2026-09-01T00:00:00Z",
    decisionSummary: "Origin unconfirmed.",
  },
  {
    id: "d-verified",
    agentName: "Valuation Agent",
    status: "Approved",
    triageState: null,
    createdAt: "2026-09-01T00:00:00Z",
    decisionSummary: "Value confirmed.",
  },
];

const EXTRACTION_PAYLOAD = {
  shipmentId: "ship-1",
  reconciliationIssues: [
    {
      id: "conflict-1",
      field: "QTY_INV_PACK",
      severity: "HIGH",
      expectedValue: "100 EA",
      actualValue: "120 EA",
      sourceDocuments: ["Commercial Invoice", "Packing List"],
      status: "Open",
    },
  ],
  reviewFields: [
    {
      fieldName: "invoiceNumber",
      currentValue: "",
      originalValue: null,
      confidence: null,
      pageNumber: null,
      bbox: null,
      corrected: false,
      needsReview: true,
      verification: "MISSING_REQUIRED",
      reasonCode: "MISSING_ON_SOURCE_DOCUMENT",
      history: [],
    },
    {
      fieldName: "totalValue",
      currentValue: "1000.00",
      originalValue: "1000.00",
      confidence: 62,
      pageNumber: 1,
      bbox: null,
      corrected: false,
      needsReview: true,
      verification: "NEEDS_REVIEW",
      reasonCode: "LOW_CONFIDENCE",
      history: [],
    },
    {
      fieldName: "exporterName",
      currentValue: "Acme Corp",
      originalValue: "Acme Corp",
      confidence: 97,
      pageNumber: 1,
      bbox: null,
      corrected: false,
      needsReview: false,
      verification: "AUTO_VERIFIED",
      reasonCode: null,
      history: [],
    },
    {
      fieldName: "importerName",
      currentValue: "Foo Imports",
      originalValue: "Foo Imports",
      confidence: 95,
      pageNumber: 1,
      bbox: null,
      corrected: false,
      needsReview: false,
      verification: "AUTO_VERIFIED",
      reasonCode: null,
      history: [],
    },
  ],
  metadata: { docType: "Commercial Invoice", pageCount: 2 },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (typeof url === "string" && url.includes("/reconcile/issues/") && init?.method === "POST") {
    return jsonResponse({});
  }
  if (typeof url === "string" && url.includes("/extractions")) {
    return jsonResponse(EXTRACTION_PAYLOAD);
  }
  return jsonResponse({});
});

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof DocumentReviewPanel>> = {}) {
  const onReviewAction = vi.fn();
  const utils = render(
    <DocumentReviewPanel
      documentId="doc-1"
      fileName="invoice.pdf"
      docType="Commercial Invoice"
      proxyUrl="/api/documents/proxy?documentId=doc-1"
      decisions={DECISIONS}
      onReviewAction={onReviewAction}
      {...overrides}
    />
  );
  return { ...utils, onReviewAction };
}

describe("DocumentReviewPanel (§85 UI acceptance)", () => {
  it("shows the document type label in the header", () => {
    renderPanel();
    expect(screen.getByText("Commercial Invoice")).toBeInTheDocument();
  });

  it("renders the action-required counts: Field Review tab badge and Verified/Review/Blocked rollup", async () => {
    renderPanel();

    // One decision per category (blocked/review/verified) after latestPerAgent
    // dedupe -- the tab badge counts mechanical + reviewable decisions.
    await waitFor(() => expect(screen.getByText("Field Review (3)")).toBeInTheDocument());

    // The panel auto-switches to the Field Review tab once field-review data
    // is available, but that switch races the initial data fetch -- click
    // the tab explicitly so this assertion doesn't depend on that timing.
    fireEvent.click(screen.getByText("Field Review (3)"));

    expect(await screen.findByText("1 of 3 checks passed")).toBeInTheDocument();
    expect(
      screen.getByText("2 issues need attention before filing — 1 blocked on missing data, 1 flagged for review.")
    ).toBeInTheDocument();
  });

  it("renders a cross-document conflict with expected vs actual values, and Resolve posts action=resolve", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Field Review (3)")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Document Preview"));

    expect(await screen.findByText("Commercial Invoice vs Packing List")).toBeInTheDocument();
    expect(screen.getByText("100 EA")).toBeInTheDocument();
    expect(screen.getByText("120 EA")).toBeInTheDocument();

    fireEvent.click(screen.getByText("✓ Resolve"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shipments/ship-1/reconcile/issues/conflict-1",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "resolve" }),
        })
      )
    );
    // Resolving removes the issue from view -- the panel doesn't require a
    // second, repetitive confirmation for the same conflict.
    await waitFor(() => expect(screen.queryByText("100 EA")).not.toBeInTheDocument());
  });

  it("posts action=ignore when Ignore is clicked on a conflict", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Field Review (3)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Document Preview"));
    await screen.findByText("Commercial Invoice vs Packing List");

    fireEvent.click(screen.getByText("Ignore"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shipments/ship-1/reconcile/issues/conflict-1",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "ignore" }),
        })
      )
    );
  });

  it("fires onReviewAction with the correct literal action for Approve/Reject/Re-evaluate", async () => {
    const { onReviewAction, container } = renderPanel();
    await waitFor(() => expect(screen.getByText("Field Review (3)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Field Review (3)"));

    const reviewCard = await waitFor(() => {
      const el = container.querySelector("#decision-d-review") as HTMLElement | null;
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(reviewCard).toBeTruthy();
    const scoped = within(reviewCard);

    fireEvent.click(scoped.getByText("Re-evaluate"));
    expect(onReviewAction).toHaveBeenLastCalledWith("d-review", "RE_EVALUATE");

    fireEvent.click(scoped.getByText("Reject"));
    expect(onReviewAction).toHaveBeenLastCalledWith("d-review", "REJECT");

    fireEvent.click(scoped.getByText("Approve"));
    expect(onReviewAction).toHaveBeenLastCalledWith("d-review", "APPROVE");
  });

  it("collapses auto-verified fields by default and reveals them on toggle, without hiding fields needing attention", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Field Review (3)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Document Preview"));

    // Attention fields (missing / needs-review) always show, no click required.
    expect(await screen.findByText("invoiceNumber")).toBeInTheDocument();
    expect(screen.getByText("totalValue")).toBeInTheDocument();

    // Auto-verified fields start collapsed behind a toggle -- not shown, not
    // requiring repetitive confirmation.
    expect(screen.queryByText("exporterName")).not.toBeInTheDocument();
    expect(screen.queryByText("importerName")).not.toBeInTheDocument();
    const toggle = screen.getByText("Show 2 auto-verified fields");
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(await screen.findByText("exporterName")).toBeInTheDocument();
    expect(screen.getByText("importerName")).toBeInTheDocument();
    expect(screen.getByText("Hide 2 auto-verified fields")).toBeInTheDocument();
  });
});

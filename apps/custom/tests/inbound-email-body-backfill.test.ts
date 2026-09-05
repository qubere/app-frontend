import { describe, it, expect, vi } from "vitest";
import { backfillInboundEmailBodyText } from "../src/modules/documents/processing/inboundEmailWorker";
import { db } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  db: {
    inboundEmail: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  withDataModeContext: vi.fn((ctx, fn) => fn()),
}));

describe("backfillInboundEmailBodyText", () => {
  it("fetches email content and updates bodyText for null rows", async () => {
    vi.mocked(db.inboundEmail.findMany).mockResolvedValueOnce([
      { id: "email-1", providerEmailId: "resend-1" } as any,
    ]);
    vi.mocked(db.inboundEmail.update).mockResolvedValueOnce({} as any);

    const mockProvider = {
      getReceivedEmail: vi.fn().mockResolvedValue({ text: "Hello world email body", html: null }),
      getAttachmentDownloadInfo: vi.fn(),
      downloadAttachmentBytes: vi.fn(),
    };

    const result = await backfillInboundEmailBodyText({ limit: 10, provider: mockProvider as any });

    expect(result.processedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(mockProvider.getReceivedEmail).toHaveBeenCalledWith("resend-1");
    expect(db.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { bodyText: "Hello world email body" },
    });
  });
});

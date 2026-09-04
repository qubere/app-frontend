import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// CbpCrossFetchService talks to an undocumented, reverse-engineered CBP CROSS
// endpoint. This suite locks in the retry/backoff behavior added for transient
// failures (429/5xx/network errors) and the defensive response-shape parsing --
// neither of which had any coverage before.

const ingestRulingMock = vi.fn().mockResolvedValue({ id: "rul_1" });

vi.mock("@/modules/regulatory/crossIngestionService", () => ({
  CrossIngestionService: { ingestRuling: ingestRulingMock },
}));

const { CbpCrossFetchService } = await import("@/modules/regulatory/cbpCrossFetchService");

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERROR",
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CbpCrossFetchService.fetchAndIngest", () => {
  it("ingests rulings from a single page and stops when the page is short", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            rulingNumber: "N302145",
            issuedDate: "2019-02-11",
            title: "Classification of a steel flange",
            htsCodes: ["7307.91.5010"],
            rulingText: "x".repeat(600),
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = CbpCrossFetchService.fetchAndIngest("tariff");
    const result = await promise;

    expect(result.count).toBe(1);
    expect(ingestRulingMock).toHaveBeenCalledTimes(1);
    expect(ingestRulingMock.mock.calls[0][0].rulingNumber).toBe("N302145");
    // Text >= 500 chars: no full-body detail fetch should have been made.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips a result with no parseable issue date instead of fabricating one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          results: [{ rulingNumber: "N302146", title: "No date" }],
        })
      )
    );

    const result = await CbpCrossFetchService.fetchAndIngest("tariff");

    expect(result.count).toBe(0);
    expect(ingestRulingMock).not.toHaveBeenCalled();
  });

  it("retries a transient 503 and succeeds without aborting the term", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              rulingNumber: "N302147",
              issuedDate: "2020-01-01",
              title: "Retried ruling",
              rulingText: "x".repeat(600),
            },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = CbpCrossFetchService.fetchAndIngest("tariff");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(1);
  });

  it("gives up after exhausting retries on a persistent 500 and aborts the term", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);

    const promise = CbpCrossFetchService.fetchAndIngest("tariff");
    // Suppress unhandled-rejection noise while timers advance below.
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/HTTP 500/);
    // 1 initial attempt + 3 retries = 4 calls before fetchWithRetry gives up.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(ingestRulingMock).not.toHaveBeenCalled();
  });
});

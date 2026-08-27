import { describe, it, expect, vi, beforeEach } from "vitest";

// Covers the Actions read path: the keyset cursor helpers and
// ExceptionService.listExceptions after the pagination/projection rework.
// The endpoint used to order by createdAt DESC but page on `id < cursor`, so
// cursor order and sort order disagreed; it also returned full relation
// records and a COUNT on every page.

const dbMock = {
  exceptionItem: { findMany: vi.fn(), count: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: {},
}));

const {
  encodeCursor,
  decodeCursor,
  keysetWhere,
  sliceKeysetPage,
  InvalidCursorError,
} = await import("@/lib/api/keysetCursor");
const { ExceptionService, EXCEPTION_LIST_SELECT, normalizeExceptionSeverity } =
  await import("@/modules/exceptions/exception.service");

function row(overrides: Partial<{ id: string; createdAt: Date }> = {}) {
  return {
    id: overrides.id ?? "exc_1",
    createdAt: overrides.createdAt ?? new Date("2026-08-27T12:00:00.000Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.exceptionItem.findMany.mockResolvedValue([]);
  dbMock.exceptionItem.count.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// keyset cursor helpers
// ---------------------------------------------------------------------------

describe("keyset cursor", () => {
  it("round-trips a position through encode/decode", () => {
    const createdAt = new Date("2026-08-27T09:30:15.123Z");
    const token = encodeCursor({ createdAt, id: "exc_abc" });
    const back = decodeCursor(token);
    expect(back.id).toBe("exc_abc");
    expect(back.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("produces an opaque token, not the raw id", () => {
    const token = encodeCursor({ createdAt: new Date(), id: "exc_secret" });
    expect(token).not.toContain("exc_secret");
  });

  it.each([
    ["empty string", ""],
    ["not base64/json", "!!!!"],
    ["base64 of non-json", Buffer.from("hello", "utf8").toString("base64url")],
    ["json missing id", Buffer.from(JSON.stringify({ c: new Date().toISOString() }), "utf8").toString("base64url")],
    ["json with empty id", Buffer.from(JSON.stringify({ c: new Date().toISOString(), i: "" }), "utf8").toString("base64url")],
    ["json with bad date", Buffer.from(JSON.stringify({ c: "not-a-date", i: "x" }), "utf8").toString("base64url")],
    ["json array", Buffer.from(JSON.stringify([1, 2]), "utf8").toString("base64url")],
  ])("rejects a malformed cursor (%s)", (_label, token) => {
    expect(() => decodeCursor(token)).toThrow(InvalidCursorError);
  });

  it("keysetWhere is undefined for the first page", () => {
    expect(keysetWhere(undefined)).toBeUndefined();
  });

  it("keysetWhere selects rows strictly after the position under createdAt DESC, id DESC", () => {
    const createdAt = new Date("2026-08-27T12:00:00.000Z");
    const where = keysetWhere({ createdAt, id: "exc_5" });
    expect(where).toEqual({
      OR: [
        { createdAt: { lt: createdAt } },
        { AND: [{ createdAt }, { id: { lt: "exc_5" } }] },
      ],
    });
  });

  it("sliceKeysetPage returns no cursor when the page is not full", () => {
    const rows = [row({ id: "a" }), row({ id: "b" })];
    const { items, nextCursor, hasMore } = sliceKeysetPage(rows, 25);
    expect(items).toHaveLength(2);
    expect(nextCursor).toBeNull();
    expect(hasMore).toBe(false);
  });

  it("sliceKeysetPage drops the probe row and emits a cursor when there is more", () => {
    const rows = [
      row({ id: "a", createdAt: new Date("2026-08-27T12:00:03Z") }),
      row({ id: "b", createdAt: new Date("2026-08-27T12:00:02Z") }),
      row({ id: "c", createdAt: new Date("2026-08-27T12:00:01Z") }), // probe (limit=2)
    ];
    const { items, nextCursor, hasMore } = sliceKeysetPage(rows, 2);
    expect(items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(hasMore).toBe(true);
    expect(decodeCursor(nextCursor!).id).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// severity normalisation
// ---------------------------------------------------------------------------

describe("severity normalisation", () => {
  it("maps any casing onto the canonical stored form", () => {
    expect(normalizeExceptionSeverity("critical")).toBe("Critical");
    expect(normalizeExceptionSeverity("HIGH")).toBe("High");
    expect(normalizeExceptionSeverity("  medium ")).toBe("Medium");
  });

  it("returns null for values that are not a known severity", () => {
    expect(normalizeExceptionSeverity("urgent")).toBeNull();
    expect(normalizeExceptionSeverity("")).toBeNull();
    expect(normalizeExceptionSeverity(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ExceptionService.listExceptions
// ---------------------------------------------------------------------------

function lastFindManyArgs() {
  const calls = dbMock.exceptionItem.findMany.mock.calls;
  return calls[calls.length - 1][0];
}

describe("ExceptionService.listExceptions", () => {
  it("defaults to 25 rows and fetches one extra as the hasMore probe", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", {});
    expect(lastFindManyArgs().take).toBe(26);
  });

  it("caps the page at 100 even when a larger limit is asked for", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", {}, { limit: 5000 });
    expect(lastFindManyArgs().take).toBe(101);
  });

  it("floors the page at 1", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", {}, { limit: 0 });
    expect(lastFindManyArgs().take).toBe(2);
  });

  it("orders by createdAt DESC then id DESC for a stable total order", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", {});
    expect(lastFindManyArgs().orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("projects the narrow list shape, never a full include", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", {});
    const args = lastFindManyArgs();
    expect(args.include).toBeUndefined();
    expect(args.select).toBe(EXCEPTION_LIST_SELECT);
    // large / sensitive relations reduced to id + labels
    expect(EXCEPTION_LIST_SELECT.shipment).toEqual({ select: { id: true, shipmentNumber: true } });
    expect((EXCEPTION_LIST_SELECT as Record<string, unknown>).resolutionReasonCode).toBeUndefined();
  });

  it("always scopes to the caller's account", async () => {
    await ExceptionService.listExceptions("acc_7", "usr_1", {});
    expect(lastFindManyArgs().where.accountId).toBe("acc_7");
  });

  it("filters to the caller when assignedToMe is set", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_42", { assignedToMe: true });
    expect(lastFindManyArgs().where.assignedToUserId).toBe("usr_42");
  });

  it("uses an index-friendly equality for a known severity", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", { severity: "high" });
    expect(lastFindManyArgs().where.severity).toEqual({ equals: "High" });
  });

  it("returns nothing for an unknown severity instead of widening", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", { severity: "bogus" });
    expect(lastFindManyArgs().where.severity).toEqual({ in: [] });
  });

  it("ignores severity=all", async () => {
    await ExceptionService.listExceptions("acc_1", "usr_1", { severity: "all" });
    expect(lastFindManyArgs().where.severity).toBeUndefined();
  });

  it("translates a cursor into a keyset predicate", async () => {
    const cursor = encodeCursor({
      createdAt: new Date("2026-08-27T10:00:00.000Z"),
      id: "exc_9",
    });
    await ExceptionService.listExceptions("acc_1", "usr_1", {}, { cursor });
    const and = lastFindManyArgs().where.AND;
    expect(and).toHaveLength(1);
    expect(and[0].OR[0]).toEqual({ createdAt: { lt: new Date("2026-08-27T10:00:00.000Z") } });
  });

  it("rejects a malformed cursor with InvalidCursorError", async () => {
    await expect(
      ExceptionService.listExceptions("acc_1", "usr_1", {}, { cursor: "garbage" }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it("reports hasMore and a nextCursor when the probe row comes back", async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: `exc_${String(i).padStart(2, "0")}`,
      createdAt: new Date(Date.parse("2026-08-27T12:00:00.000Z") - i * 1000),
    }));
    dbMock.exceptionItem.findMany.mockResolvedValueOnce(rows);

    const res = await ExceptionService.listExceptions("acc_1", "usr_1", {});
    expect(res.exceptions).toHaveLength(25);
    expect(res.pagination.hasMore).toBe(true);
    expect(decodeCursor(res.pagination.nextCursor!).id).toBe("exc_24");
  });

  it("reports no more pages when fewer than a full page returns", async () => {
    dbMock.exceptionItem.findMany.mockResolvedValueOnce([row({ id: "a" }), row({ id: "b" })]);
    const res = await ExceptionService.listExceptions("acc_1", "usr_1", {});
    expect(res.pagination.hasMore).toBe(false);
    expect(res.pagination.nextCursor).toBeNull();
  });

  it("does not COUNT unless withCount is requested", async () => {
    const res = await ExceptionService.listExceptions("acc_1", "usr_1", {});
    expect(dbMock.exceptionItem.count).not.toHaveBeenCalled();
    expect(res.pagination.total).toBeNull();
  });

  it("returns a filtered total when withCount is requested", async () => {
    dbMock.exceptionItem.count.mockResolvedValueOnce(137);
    const res = await ExceptionService.listExceptions(
      "acc_1",
      "usr_1",
      { severity: "high" },
      { withCount: true },
    );
    expect(dbMock.exceptionItem.count).toHaveBeenCalledTimes(1);
    expect(dbMock.exceptionItem.count.mock.calls[0][0].where.severity).toEqual({ equals: "High" });
    expect(res.pagination.total).toBe(137);
  });

  it("keeps duplicate-timestamp rows from being skipped at a page boundary", async () => {
    // Two rows share a millisecond; the cursor from the first page must resume
    // *after* the last row by id, not re-list or drop its sibling.
    const ts = new Date("2026-08-27T12:00:00.000Z");
    const first = await (async () => {
      dbMock.exceptionItem.findMany.mockResolvedValueOnce([
        { id: "exc_b", createdAt: ts },
        { id: "exc_a", createdAt: ts }, // probe row, limit 1
      ]);
      return ExceptionService.listExceptions("acc_1", "usr_1", {}, { limit: 1 });
    })();
    expect(first.exceptions.map((r) => r.id)).toEqual(["exc_b"]);

    await ExceptionService.listExceptions("acc_1", "usr_1", {}, {
      limit: 1,
      cursor: first.pagination.nextCursor!,
    });
    const and = lastFindManyArgs().where.AND[0];
    // resumes at the same timestamp, id strictly less than exc_b -> exc_a is next
    expect(and.OR[1]).toEqual({ AND: [{ createdAt: ts }, { id: { lt: "exc_b" } }] });
  });
});

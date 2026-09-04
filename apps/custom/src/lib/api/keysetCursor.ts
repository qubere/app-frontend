/**
 * Keyset (a.k.a. "seek") pagination helpers for list endpoints ordered by
 * `createdAt DESC, id DESC`.
 *
 * Why not offset/`skip`: offset pagination re-scans and discards every row
 * before the requested page, so page N costs O(N * pageSize) and drifts when
 * rows are inserted/removed between requests. Keyset pagination carries the
 * sort key of the last row seen and asks the database for "everything strictly
 * after this point", which is a single index range scan regardless of depth.
 *
 * Why the compound `(createdAt, id)` key: `createdAt` alone is not unique, so
 * two rows sharing a millisecond would either be returned twice or skipped at
 * a page boundary. Tie-breaking on the primary key makes the order total and
 * the cursor stable.
 *
 * The cursor is an opaque base64url token. Callers must treat it as a blob;
 * the encoding here is an implementation detail and deliberately unsigned —
 * it carries no authorization, only a position within an already
 * tenant-scoped query.
 */

export interface KeysetPosition {
  createdAt: Date;
  id: string;
}

export class InvalidCursorError extends Error {
  constructor(message = "Malformed pagination cursor") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

/** Encode a row's sort key into an opaque cursor token. */
export function encodeCursor(position: KeysetPosition): string {
  const payload = JSON.stringify({
    c: position.createdAt.toISOString(),
    i: position.id,
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decode an opaque cursor token back into a sort key.
 * Throws {@link InvalidCursorError} for anything that is not a token this
 * module produced — callers should map that to a 400, never a 500.
 */
export function decodeCursor(token: string): KeysetPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidCursorError();
  }
  const { c, i } = parsed as Record<string, unknown>;
  if (typeof c !== "string" || typeof i !== "string" || i.length === 0) {
    throw new InvalidCursorError();
  }
  const createdAt = new Date(c);
  if (Number.isNaN(createdAt.getTime())) {
    throw new InvalidCursorError();
  }
  return { createdAt, id: i };
}

/**
 * A Prisma `where` fragment that selects rows strictly ordered *after* the
 * given position under `ORDER BY createdAt DESC, id DESC`. Returns `undefined`
 * for the first page so it can be spread unconditionally:
 *
 *   where: { accountId, ...keysetWhere(cursor) }
 */
export function keysetWhere(
  position: KeysetPosition | undefined
): { OR: Array<Record<string, unknown>> } | undefined {
  if (!position) return undefined;
  return {
    OR: [
      { createdAt: { lt: position.createdAt } },
      { AND: [{ createdAt: position.createdAt }, { id: { lt: position.id } }] },
    ],
  };
}

/** The canonical, total ordering every keyset list endpoint must use. */
export const KEYSET_ORDER_BY = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

/**
 * Given `limit + 1` rows fetched from the database, split them into the page
 * to return and the cursor for the next page. Fetching one extra row is how we
 * know whether a further page exists without a second `count` query.
 */
export function sliceKeysetPage<T extends KeysetPosition>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null, hasMore: false };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(last), hasMore: true };
}

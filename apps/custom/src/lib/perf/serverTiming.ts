/**
 * Minimal server-side span collector that renders to a `Server-Timing`
 * response header (visible in the browser DevTools "Timing" panel and
 * scrape-able by synthetic monitors) and, optionally, to a structured log
 * line for aggregation.
 *
 * It records only span *names* and *durations* — never SQL text, parameters,
 * row contents, or any account/user PII — so it is safe to emit in every
 * environment.
 *
 * Usage:
 *   const perf = new PerfTimer();
 *   const rows = await perf.span("db.exceptions", () => db.exceptionItem.findMany(...));
 *   ...
 *   return NextResponse.json(body, { headers: perf.headers() });
 */

export interface PerfSpan {
  name: string;
  durationMs: number;
}

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export class PerfTimer {
  private readonly spans: PerfSpan[] = [];
  private readonly startedAt = now();

  /** Time an async unit of work and record it as a span. */
  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = now();
    try {
      return await fn();
    } finally {
      this.record(name, now() - start);
    }
  }

  /** Record a span whose duration was measured elsewhere. */
  record(name: string, durationMs: number): void {
    // `Server-Timing` names must be tokens: no spaces, quotes, or commas.
    const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 60);
    this.spans.push({ name: safeName, durationMs: Math.max(0, Math.round(durationMs * 100) / 100) });
  }

  /** Total wall-clock time since the timer was constructed. */
  totalMs(): number {
    return Math.round((now() - this.startedAt) * 100) / 100;
  }

  list(): PerfSpan[] {
    return [...this.spans];
  }

  /** Render a `Server-Timing` header value. */
  toHeaderValue(): string {
    const parts = this.spans.map((s) => `${s.name};dur=${s.durationMs}`);
    parts.push(`total;dur=${this.totalMs()}`);
    return parts.join(", ");
  }

  /** Headers object ready to merge into a `NextResponse`. */
  headers(): Record<string, string> {
    return { "Server-Timing": this.toHeaderValue() };
  }

  /** A flat `{ [name]: ms }` map for structured logging. */
  toLogFields(prefix = "t_"): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of this.spans) out[`${prefix}${s.name}`] = s.durationMs;
    out[`${prefix}total`] = this.totalMs();
    return out;
  }
}

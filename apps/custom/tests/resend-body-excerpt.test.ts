import { describe, it, expect } from "vitest";
import { bodyExcerpt, INBOUND_BODY_EXCERPT_MAX } from "@/lib/inbound/resendClient";

describe("bodyExcerpt", () => {
  it("prefers the plain-text part and collapses whitespace", () => {
    expect(bodyExcerpt("  Please file   this\n\n\n\nagainst SHP-2026-000042  ", "<p>ignored</p>")).toBe(
      "Please file this\n\nagainst SHP-2026-000042"
    );
  });

  it("falls back to a de-tagged HTML part", () => {
    const html = "<html><body><p>Attach to</p><div>SHP-TGT-2026-001</div><script>bad()</script></body></html>";
    expect(bodyExcerpt(null, html)).toBe("Attach to\nSHP-TGT-2026-001");
  });

  it("returns null for empty input", () => {
    expect(bodyExcerpt(null, null)).toBeNull();
    expect(bodyExcerpt("   ", "   ")).toBeNull();
  });

  it("truncates to the cap", () => {
    const out = bodyExcerpt("x".repeat(INBOUND_BODY_EXCERPT_MAX + 5000), null);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(INBOUND_BODY_EXCERPT_MAX);
  });
});

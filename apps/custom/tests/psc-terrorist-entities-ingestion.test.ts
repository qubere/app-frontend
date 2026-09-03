import { describe, it, expect } from "vitest";
import { parsePscXml, mapPscEntry } from "@/modules/screening/publicSafetyCanadaTerroristEntitiesIngestionService";

// Real entries trimmed directly from the live "Currently listed entities"
// Atom feed (publicsafety.gc.ca/cnt/_xml/lstd-ntts-eng.xml, fetched
// 2026-09-03) -- not synthetic, content truncated for brevity but verbatim.
const REAL_TRIMMED_PSC_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>764</title>
    <id>2025-121</id>
    <summary>N/A</summary>
    <content>764 is a decentralized transnational network of online nihilistic violent extremists.</content>
    <published>2025-12-08</published>
    <updated>Not yet reviewed</updated>
  </entry>
  <entry>
    <title>Abdallah Azzam Brigades (AAB)</title>
    <id>1</id>
    <summary>The Abdullah Azzam Brigades; the Brigades of Abdullah Azzam; the Ziyad al-Jarrah Battalions.</summary>
    <content>The AAB is an Al Qaida affiliated militant group that follows Salafist ideology.</content>
    <published>2015-06-29</published>
    <updated>2024-06-07</updated>
  </entry>
  <entry>
    <title>Abu Nidal Organization (ANO)</title>
    <id>2</id>
    <summary>Fatah Revolutionary Council, Revolutionary Council, Black September, Egyptian Revolution.</summary>
    <content>From the mid-1970s to the early 1990s, the Abu Nidal Organization (ANO) was one of the most feared transnational terrorist organizations in the world.</content>
    <published>2003-02-12</published>
    <updated>2024-06-07</updated>
  </entry>
</feed>`;

describe("parsePscXml — real trimmed Public Safety Canada terrorist entities fixture", () => {
  it("parses all three entries", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    expect(entries).toHaveLength(3);
  });

  it("extracts an entry with no aliases (N/A summary)", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    const entry = entries.find((e) => e.refId === "2025-121")!;
    expect(entry.title).toBe("764");
    expect(entry.summary).toBe("N/A");
    expect(entry.updated).toBe("Not yet reviewed");
  });

  it("extracts an entry with a parenthetical acronym and aliases", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    const entry = entries.find((e) => e.refId === "1")!;
    expect(entry.title).toBe("Abdallah Azzam Brigades (AAB)");
    expect(entry.summary).toContain("the Ziyad al-Jarrah Battalions");
    expect(entry.published).toBe("2015-06-29");
  });
});

describe("mapPscEntry", () => {
  it("maps an entry with N/A aliases to an ENTITY with no alternate names beyond the acronym", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    const entry = entries.find((e) => e.refId === "2025-121")!;
    const mapped = mapPscEntry(entry);
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("764");
    expect(mapped.alternateNames).toEqual([]);
    expect(mapped.citation).toBe("Public Safety Canada Ref. 2025-121");
    expect(mapped.effectiveDate?.toISOString().slice(0, 10)).toBe("2025-12-08");
  });

  it("maps an entry with a parenthetical acronym and alias list", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    const entry = entries.find((e) => e.refId === "1")!;
    const mapped = mapPscEntry(entry);
    expect(mapped.name).toBe("Abdallah Azzam Brigades (AAB)");
    expect(mapped.alternateNames).toContain("AAB");
    expect(mapped.alternateNames).toContain("the Ziyad al-Jarrah Battalions.");
    expect(mapped.programCodes).toEqual(["Criminal Code of Canada, s.83.05 (Listed Terrorist Entities)"]);
  });

  it("computes distinct entity hashes for distinct names", () => {
    const entries = parsePscXml(REAL_TRIMMED_PSC_XML);
    const a = mapPscEntry(entries.find((e) => e.refId === "1")!);
    const b = mapPscEntry(entries.find((e) => e.refId === "2")!);
    expect(a.entityHash).not.toBe(b.entityHash);
  });
});

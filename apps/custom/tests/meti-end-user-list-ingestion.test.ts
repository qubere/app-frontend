import { describe, it, expect } from "vitest";
import {
  parseMetiEulText,
  mapMetiEntry,
  downloadAndParseMetiFeed,
} from "@/modules/screening/metiForeignEndUserListIngestionService";

// Representative rows reconstructed from METI's live Foreign End User List
// PDF (外国ユーザーリスト, meti.go.jp/files/900018298.pdf) table structure --
// No. / Country-or-Region (JP + EN) / Company-or-Organization / Also-Known-As
// bullets / WMD concern codes (B/C/M/N) / separate Conventional Weapons (CW)
// flag -- not a byte-for-byte OCR dump of the source PDF.
const SAMPLE_METI_TEXT = `
No.
国名、地域名
企業名､組織名
別名
懸念区分
通常兵器
1
アフガニスタン / Islamic Republic of Afghanistan
Example Trading Company
・Example Trading Co.
・ETC Ltd.
B,C
CW
2
イラン / Islamic Republic of Iran
Sample Industries Group
M,N
35
中国 / People's Republic of China
Beijing Sample Instruments Co., Ltd.
・BSI
N
`;

describe("parseMetiEulText — reconstructed METI Foreign End User List fixture", () => {
  it("parses all three entries, skipping header lines and row numbers", async () => {
    const { entries } = parseMetiEulText(SAMPLE_METI_TEXT);
    expect(entries).toHaveLength(3);
  });

  it("extracts an entry with country JP/EN split, multiple aliases, two WMD codes, and CW flag", async () => {
    const { entries } = parseMetiEulText(SAMPLE_METI_TEXT);
    const afghan = entries.find((e) => e.name === "Example Trading Company")!;
    expect(afghan.countryJapanese).toBe("アフガニスタン");
    expect(afghan.countryEnglish).toBe("Islamic Republic of Afghanistan");
    expect(afghan.aliases).toEqual(["Example Trading Co.", "ETC Ltd."]);
    expect(afghan.wmdCodes).toEqual(["B", "C"]);
    expect(afghan.conventionalWeapons).toBe(true);
  });

  it("extracts an entry with no aliases and no CW flag", async () => {
    const { entries } = parseMetiEulText(SAMPLE_METI_TEXT);
    const iran = entries.find((e) => e.name === "Sample Industries Group")!;
    expect(iran.countryEnglish).toBe("Islamic Republic of Iran");
    expect(iran.aliases).toEqual([]);
    expect(iran.wmdCodes).toEqual(["M", "N"]);
    expect(iran.conventionalWeapons).toBe(false);
  });

  it("maps an entry to a ScreeningEntity-shaped record with WMD + CW codes merged into programCodes", async () => {
    const { entries } = parseMetiEulText(SAMPLE_METI_TEXT);
    const afghan = entries.find((e) => e.name === "Example Trading Company")!;
    const mapped = mapMetiEntry(afghan);
    expect(mapped.entityType).toBe("ENTITY");
    expect(mapped.name).toBe("Example Trading Company");
    expect(mapped.alternateNames).toEqual(["Example Trading Co.", "ETC Ltd."]);
    expect(mapped.country).toBe("Islamic Republic of Afghanistan");
    expect(mapped.programCodes).toEqual(["B", "C", "CW"]);
    expect(mapped.remarks).toBe("Country (Japanese): アフガニスタン");
  });

  it("maps a China entry with a single alias and no CW flag", async () => {
    const { entries } = parseMetiEulText(SAMPLE_METI_TEXT);
    const china = entries.find((e) => e.countryEnglish === "People's Republic of China")!;
    const mapped = mapMetiEntry(china);
    expect(mapped.name).toBe("Beijing Sample Instruments Co., Ltd.");
    expect(mapped.alternateNames).toEqual(["BSI"]);
    expect(mapped.programCodes).toEqual(["N"]);
  });
});

// The METI website is unreachable from this environment's sandboxed network
// (and from many CI runners) -- a live fetch must never be part of the
// default test run. Opt in explicitly with RUN_LIVE_METI_TEST=1 from an
// environment that can actually reach meti.go.jp.
describe.skipIf(!process.env.RUN_LIVE_METI_TEST)("live METI PDF download + parse (opt-in only, no DB writes)", () => {
  it("downloads the current PDF and parses at least one entry", async () => {
    const { feed, checksum } = await downloadAndParseMetiFeed();
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(feed.entries.length).toBeGreaterThan(0);
  });
});

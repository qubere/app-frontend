import { describe, it, expect } from "vitest";
import {
  extractMasDesignationEntries,
  mapMasDesignationEntry,
} from "@/modules/screening/masDomesticDesignationsIngestionService";

// A trimmed fragment of the real TSFA2002 page (fetched 2026-09-03 from
// sso.agc.gov.sg/Act/TSFA2002?ProvIds=Sc1-,Sc2-), preserving the exact tag
// structure and entry-format variants confirmed live: plain entry, deleted
// entry, passport-only entry, nbsp-before-passport-number entry, and the
// alias-plus-two-conflicting-ID-DOBs entry. Followed by para 3 (definitions,
// must never be parsed as designees) and a Second Schedule fragment (offence
// categories, must never be parsed as designees either).
const FIXTURE_HTML = `
<div class="schedule"><table><tr><td class="sHdr" id="Sc1-">FIRST SCHEDULE</td></tr></table>
<table><tr><td class="tailSTxt">2.&#xA0;&#xA0;The following individuals:<table class="p1_1" width="100%">
<tr><td class="sProvP1No">(<em>a</em>)</td><td class="sProvP1">Haji Ibrahim B Haji Maidin (Singapore citizen) (Date of Birth: 1 October 1950);</td></tr>
<tr><td class="sProvP1No">(<em>e</em>)</td><td class="sProvP1">[<em>Deleted by S 744/2024 wef 30/09/2024</em>]</td></tr>
<tr><td class="sProvP1No">(<em>o</em>)</td><td class="sProvP1">Rahman Mizanur (Bangladesh citizen) (Passport No. BH0187173) (Date of Birth: 15 March 1985);</td></tr>
<tr><td class="sProvP1No">(<em>w</em>)</td><td class="sProvP1">Mohamad Shariff Zulfikar (Australia citizen) (Passport No.&#160;N4341564) (Date of Birth: 28 September 1971);</td></tr>
<tr><td class="sProvP1No">(<em>zn</em>)</td><td class="sProvP1">Anindia Afiyantari @ Anin Dia Afiyan Tari (Indonesian citizen) (Passport No.&#160;B6594543 stating Date of Birth: 10 April 1987) (Work Permit No.&#160;G6545158T stating Date of Birth: 10 April 1986);</td></tr>
<tr><td class="sProvP1No">(<em>zzb</em>)</td><td class="sProvP1">Tan Jun Jie (Singapore citizen) (Date of Birth: 19 March 2007).<div class="amendNote">[S 568/2026 wef 26/08/2026]</div></td></tr>
</table></td></tr></table>
<table><tr><td class="tailSTxt">3.&#xA0;&#xA0;In this Schedule, unless the context otherwise requires&#160;&#8212;
<table><tr><td class="def">"1988 Committee" means the committee established pursuant to Resolution 1988 (2011);</td></tr></table>
</td></tr></table></div>
<div class="schedule"><table><tr><td class="sHdr" id="Sc2-">SECOND SCHEDULE</td></tr></table>
<table><tr><td class="sGrpTail"><table><tr><td class="sGrpHdrCaps">Part 1</td></tr></table>
<table><tr><td class="tailSTxt"><span class="sProvDot"></span>&#160;&#160;Any act or omission constituting an offence under the Hijacking of Aircraft and Protection of Aircraft and International Airports Act&#160;1978.</td></tr></table>
</td></tr></table></div>
`;

describe("extractMasDesignationEntries — fixture mirroring the real TSFA2002 page", () => {
  it("parses a plain entry with a standalone Date of Birth", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "a")!;
    expect(entry.deleted).toBe(false);
    expect(entry.name).toBe("Haji Ibrahim B Haji Maidin");
    expect(entry.nationality).toBe("Singapore");
    expect(entry.dateOfBirth).toBe("1 October 1950");
  });

  it("marks a [Deleted by ...] entry as deleted, with no name extracted", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "e")!;
    expect(entry.deleted).toBe(true);
    expect(entry.name).toBeUndefined();
  });

  it("parses an entry with a Passport No. and its own Date of Birth", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "o")!;
    expect(entry.passportNumber).toBe("BH0187173");
    expect(entry.dateOfBirth).toBe("15 March 1985");
  });

  it("handles an nbsp between 'Passport No.' and the number", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "w")!;
    expect(entry.passportNumber).toBe("N4341564");
    expect(entry.nationality).toBe("Australia");
  });

  it("splits an '@' alias and records a conflicting secondary DOB from the second ID in remarks", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "zn")!;
    expect(entry.name).toBe("Anindia Afiyantari");
    expect(entry.alias).toBe("Anin Dia Afiyan Tari");
    expect(entry.passportNumber).toBe("B6594543");
    expect(entry.dateOfBirth).toBe("10 April 1987");
    expect(entry.workPermitNumber).toBe("G6545158T");
    expect(entry.remarks).toContain("Work Permit No. G6545158T states Date of Birth: 10 April 1986");
  });

  it("parses the last entry in the list, stripping the trailing period and amendment note", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "zzb")!;
    expect(entry.name).toBe("Tan Jun Jie");
    expect(entry.dateOfBirth).toBe("19 March 2007");
  });

  it("never parses para 3 (definitions) or the Second Schedule (offence categories) as designee entries", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    expect(entries.some((e) => e.name?.includes("1988 Committee"))).toBe(false);
    expect(entries.some((e) => e.name?.includes("Hijacking of Aircraft"))).toBe(false);
  });
});

describe("mapMasDesignationEntry", () => {
  it("maps a plain entry to a ScreeningEntity shape with a First Schedule citation", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "a")!;
    const mapped = mapMasDesignationEntry(entry);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("Haji Ibrahim B Haji Maidin");
    expect(mapped.country).toBe("Singapore");
    expect(mapped.citation).toBe("Terrorism (Suppression of Financing) Act 2002, First Schedule, para 2(a)");
    expect(mapped.remarks).toContain("Date of Birth: 1 October 1950");
  });

  it("includes the alias in alternateNames", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "zn")!;
    const mapped = mapMasDesignationEntry(entry);
    expect(mapped.alternateNames).toEqual(["Anin Dia Afiyan Tari"]);
    expect(mapped.remarks).toContain("Passport No. B6594543");
    expect(mapped.remarks).toContain("Work Permit No. G6545158T");
  });

  it("throws when given a deleted entry", () => {
    const entries = extractMasDesignationEntries(FIXTURE_HTML);
    const entry = entries.find((e) => e.letter === "e")!;
    expect(() => mapMasDesignationEntry(entry)).toThrow();
  });
});

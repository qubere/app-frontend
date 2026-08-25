/**
 * Loads the legacy COUNTRY_BY_COUNTRY_MAPS embargo/sanction reference data
 * (ece2 export) into the CountryByCountryMap table added by migration
 * 20260814030000_add_country_embargo_screening.
 *
 * Reads the source SQL file directly rather than transcribing rows, so the
 * ~920-row dataset only exists in one place. Idempotent via cycySeq (the
 * primary key, preserving the legacy CYCY_SEQ) -- safe to re-run.
 *
 * A handful of source rows carry a null EMBARGOED_COUNTRY (no actual country
 * pair) and are skipped, since the column is non-nullable on this model.
 *
 * Run with: npx tsx prisma/seeds/seed-country-by-country-maps.ts
 */
import fs from "fs";
import path from "path";
import { db } from "../../src/index";

const SOURCE_SQL_PATH = "C:\\C-Drive\\AI-Cust\\EMB-Check\\sql\\country_by_country_maps.sql";

interface ParsedRow {
  cycySeq: number;
  complianceCountry: string;
  complianceCountryName: string | null;
  embargoedCountry: string | null;
  embargoedCountryName: string | null;
  cycyIndEmbargoed: string | null;
  cycyIndNationalSanction: string | null;
  cycyIndEuSanction: string | null;
  cycyIndUnSanction: string | null;
}

function unquote(token: string): string | null {
  if (token.toLowerCase() === "null") return null;
  if (token.startsWith("'")) return token.slice(1, -1).replace(/''/g, "'");
  return token;
}

function parseInsertLine(line: string): ParsedRow {
  const match = line.match(/values\s*\((.*)\);\s*$/i);
  if (!match) throw new Error(`Line did not match expected "values (...)" shape: ${line}`);

  const tokens = match[1].match(/'(?:[^']|'')*'|null|-?\d+/gi);
  if (!tokens || tokens.length !== 9) {
    throw new Error(`Expected 9 values, got ${tokens?.length ?? 0}: ${line}`);
  }

  const [seq, complianceCountry, complianceCountryName, embargoedCountry, embargoedCountryName, indEmbargoed, indNationalSanction, indEuSanction, indUnSanction] = tokens;

  const seqStr = unquote(seq);
  const complianceCountryVal = unquote(complianceCountry);
  if (seqStr === null || complianceCountryVal === null) {
    throw new Error(`Missing CYCY_SEQ or COMPLIANCE_COUNTRY: ${line}`);
  }

  return {
    cycySeq: Number(seqStr),
    complianceCountry: complianceCountryVal,
    complianceCountryName: unquote(complianceCountryName),
    embargoedCountry: unquote(embargoedCountry),
    embargoedCountryName: unquote(embargoedCountryName),
    cycyIndEmbargoed: unquote(indEmbargoed),
    cycyIndNationalSanction: unquote(indNationalSanction),
    cycyIndEuSanction: unquote(indEuSanction),
    cycyIndUnSanction: unquote(indUnSanction),
  };
}

function parseSourceFile(): { rows: ParsedRow[]; skippedNullEmbargoed: number } {
  const resolvedPath = path.resolve(SOURCE_SQL_PATH);
  const content = fs.readFileSync(resolvedPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => /^Insert into COUNTRY_BY_COUNTRY_MAPS/i.test(line.trim()));

  const rows: ParsedRow[] = [];
  const failures: string[] = [];
  let skippedNullEmbargoed = 0;

  for (const line of lines) {
    try {
      const row = parseInsertLine(line.trim());
      if (row.embargoedCountry === null) {
        skippedNullEmbargoed++;
        continue;
      }
      rows.push(row);
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (failures.length) {
    throw new Error(`Failed to parse ${failures.length} line(s):\n${failures.join("\n")}`);
  }

  return { rows, skippedNullEmbargoed };
}

export async function seedCountryByCountryMaps() {
  const { rows, skippedNullEmbargoed } = parseSourceFile();
  console.log(`Parsed ${rows.length} usable rows from ${SOURCE_SQL_PATH} (${skippedNullEmbargoed} skipped: null EMBARGOED_COUNTRY)`);

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await db.countryByCountryMap.findUnique({ where: { cycySeq: row.cycySeq } });
    if (!existing) {
      await db.countryByCountryMap.create({ data: row });
      created++;
    } else {
      await db.countryByCountryMap.update({ where: { cycySeq: row.cycySeq }, data: row });
      updated++;
    }
  }

  console.log(`CountryByCountryMap: ${created} created, ${updated} updated (${rows.length} total rows processed)`);
}

if (require.main === module) {
  seedCountryByCountryMaps()
    .then(() => db.$disconnect())
    .catch(async (err) => {
      console.error("Seed run failed:", err);
      await db.$disconnect();
      process.exit(1);
    });
}

import { db } from "@/lib/db";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const MAS_DATASET_ID = "mas-domestic-designations";
const MAS_SOURCE_LIST = "MAS_DOMESTIC_DESIGNATIONS";
const MAS_AGENCY = "Singapore Ministry of Home Affairs (Terrorism (Suppression of Financing) Act 2002)";

// Singapore Statutes Online's ?ViewType=Print URL returns only an interactive
// print-selector shell with no real content -- the plain URL (no ViewType
// param) is the one that returns the actual First Schedule body.
const MAS_TSFA_URL = "https://sso.agc.gov.sg/Act/TSFA2002?ProvIds=Sc1-";

// Live First Schedule Para 2 (fetched 2026-09-03) runs (a) through (zzb) --
// 56 lettered slots, of which several are [Deleted by ...]. A floor well
// below that catches a truncated/blocked fetch or a changed page structure.
const MIN_EXPECTED_RECORDS = 20;

export interface MasDesignationEntry {
  letter: string;
  deleted: boolean;
  name?: string;
  alias?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  workPermitNumber?: string;
  remarks?: string;
}

export interface MasMappedEntity {
  entityHash: string;
  entityType: string;
  name: string;
  alternateNames: string[];
  country: string | null;
  citation: string | null;
  remarks: string | null;
  programCodes: string[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x?([0-9a-fA-F]+);/gi, (_, code) =>
      String.fromCharCode(code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "’")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the First Schedule's Para 2 lettered list -- the actual
 * individually-designated persons -- from the raw TSFA2002 page HTML. Para 1
 * (UN Taliban/ISIL-Al-Qaida incorporation-by-reference) is deliberately out
 * of range: it's already covered by the UN Security Council pipeline, and
 * Para 3 (definitions) never contains a designee. The Second Schedule
 * (confirmed live 2026-09-03) is a list of offence categories that also
 * constitute terrorist acts -- not a list of designated persons/entities at
 * all, despite sharing the "Terrorists and terrorist entities" TOC caption
 * with the First Schedule -- so it's never in scope for this parser.
 */
export function extractMasDesignationEntries(html: string): MasDesignationEntry[] {
  const para2Start = html.indexOf('tailSTxt">2.');
  const para3Start = html.indexOf('tailSTxt">3.', para2Start);
  if (para2Start === -1 || para3Start === -1) return [];
  const section = html.slice(para2Start, para3Start);

  const entries: MasDesignationEntry[] = [];
  const ENTRY_PATTERN =
    /<td class="sProvP1No">\(<em>([a-z]+)<\/em>\)<\/td><td class="sProvP1">([\s\S]*?)<\/td><\/tr>/g;

  let match: RegExpExecArray | null;
  while ((match = ENTRY_PATTERN.exec(section)) !== null) {
    const letter = match[1];
    const rawText = match[2].replace(/<div class="amendNote">[\s\S]*?<\/div>/g, "");
    const text = decodeEntities(rawText).replace(/[;.]\s*$/, "");

    if (/^\[.*Deleted by/i.test(text)) {
      entries.push({ letter, deleted: true });
      continue;
    }

    const nameMatch = text.match(/^(.*?)\s*\(/);
    let namePart = nameMatch ? nameMatch[1].trim() : text.trim();
    let alias: string | undefined;
    const aliasMatch = namePart.match(/^(.*?)\s+@\s+(.*)$/);
    if (aliasMatch) {
      namePart = aliasMatch[1].trim();
      alias = aliasMatch[2].trim();
    }

    const nationalityMatch = text.match(/\(([A-Za-z\s]+?)\s+citizen\)/);
    const passportMatch = text.match(/Passport No\.\s*([A-Za-z0-9]+)(?:\s+stating Date of Birth:\s*([^)]+))?/);
    const workPermitMatch = text.match(/Work Permit No\.\s*([A-Za-z0-9]+)(?:\s+stating Date of Birth:\s*([^)]+))?/);
    const standaloneDobMatch = text.match(/(?<!stating )Date of Birth:\s*([^)]+)\)/);

    const primaryDob = standaloneDobMatch?.[1]?.trim() ?? passportMatch?.[2]?.trim() ?? workPermitMatch?.[2]?.trim();

    const remarksParts: string[] = [];
    if (passportMatch?.[2] && workPermitMatch?.[2] && passportMatch[2].trim() !== workPermitMatch[2].trim()) {
      remarksParts.push(
        `Work Permit No. ${workPermitMatch[1]} states Date of Birth: ${workPermitMatch[2].trim()} ` +
          `(conflicts with the Date of Birth stated against the passport)`
      );
    }

    entries.push({
      letter,
      deleted: false,
      name: namePart,
      alias,
      nationality: nationalityMatch?.[1]?.trim(),
      dateOfBirth: primaryDob,
      passportNumber: passportMatch?.[1],
      workPermitNumber: workPermitMatch?.[1],
      remarks: remarksParts.length ? remarksParts.join(" | ") : undefined,
    });
  }

  return entries;
}

export function mapMasDesignationEntry(entry: MasDesignationEntry): MasMappedEntity {
  if (entry.deleted || !entry.name) {
    throw new Error(`Cannot map deleted entry (letter ${entry.letter})`);
  }

  const remarksParts: string[] = [];
  if (entry.dateOfBirth) remarksParts.push(`Date of Birth: ${entry.dateOfBirth}`);
  if (entry.passportNumber) remarksParts.push(`Passport No. ${entry.passportNumber}`);
  if (entry.workPermitNumber) remarksParts.push(`Work Permit No. ${entry.workPermitNumber}`);
  if (entry.remarks) remarksParts.push(entry.remarks);

  return {
    entityHash: computeEntityHash(MAS_SOURCE_LIST, entry.name, entry.nationality),
    entityType: "INDIVIDUAL",
    name: entry.name,
    alternateNames: entry.alias ? [entry.alias] : [],
    country: entry.nationality ?? null,
    citation: `Terrorism (Suppression of Financing) Act 2002, First Schedule, para 2(${entry.letter})`,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: ["TSFA2002_FIRST_SCHEDULE"],
  };
}

export interface MasIngestResult {
  parsedCount: number;
  supersededCount: number;
}

export class MasDomesticDesignationsIngestionService {
  private static async downloadHtml(): Promise<string> {
    const res = await fetch(MAS_TSFA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`MAS domestic designations source (SSO TSFA2002) returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return res.text();
  }

  static async fetchAndIngest(): Promise<MasIngestResult> {
    const html = await this.downloadHtml();
    const parsedEntries = extractMasDesignationEntries(html);
    const entities = parsedEntries.filter((e) => !e.deleted).map(mapMasDesignationEntry);

    if (entities.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `MAS domestic designations parse returned only ${entities.length} usable records (expected at least ` +
          `${MIN_EXPECTED_RECORDS}). Refusing to treat this as a complete run -- the page's structure most likely ` +
          "changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    const UPSERT_BATCH_SIZE = 8;
    for (let i = 0; i < entities.length; i += UPSERT_BATCH_SIZE) {
      const batch = entities.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entity) => {
          const data = {
            entityType: entity.entityType,
            name: entity.name,
            alternateNames: entity.alternateNames,
            country: entity.country,
            citation: entity.citation,
            remarks: entity.remarks,
            programCodes: entity.programCodes,
            agency: MAS_AGENCY,
          };
          return db.screeningEntity.upsert({
            where: { entityHash: entity.entityHash },
            update: {
              ...data,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
            },
            create: {
              entityHash: entity.entityHash,
              sourceList: MAS_SOURCE_LIST,
              ...data,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
            },
          });
        })
      );
      for (const row of results) {
        changeInputs.push({
          screeningEntityId: row.id,
          changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
        });
      }
    }

    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: MAS_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: MAS_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: MAS_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: MAS_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: MAS_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: MAS_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entities.length, supersededCount: supersedeResult.count };
  }
}

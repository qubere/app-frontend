import crypto from "crypto";
import { db } from "@/lib/db";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const METI_DATASET_ID = "meti-foreign-end-user-list";
const METI_SOURCE_LIST = "METI_EUL";
const METI_AGENCY = "METI (Ministry of Economy, Trade and Industry, Japan)";

// METI reissues this PDF under a new filename/path on every revision (no
// stable per-revision URL) -- e.g. the current file is
// https://www.meti.go.jp/files/900018298.pdf, referenced from a dated press
// release page. Configurable via env so the URL can be updated without a
// code change when METI republishes, rather than hardcoding a URL that will
// go stale.
const METI_PDF_URL = process.env.METI_EUL_PDF_URL || "https://www.meti.go.jp/files/900018298.pdf";

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRIES = 3;
const FETCH_RETRY_BASE_DELAY_MS = 2000;

// The live list has run to 800+ numbered entries across 15+ countries for
// years. A near-empty parse means the PDF's layout changed, the download
// was truncated/corrupted, or the fetch was blocked -- not that METI cleared
// almost every entry. Same floor-based circuit breaker as UKSL/EUC/UNSC:
// the check runs before any DB write, so a failed run never supersedes the
// currently-PUBLISHED rows (last-known-good retention).
const MIN_EXPECTED_ENTRIES = 500;

const UPSERT_BATCH_SIZE = 8;

export interface ParsedMetiEntry {
  countryJapanese: string | null;
  countryEnglish: string | null;
  name: string;
  aliases: string[];
  wmdCodes: string[];
  conventionalWeapons: boolean;
}

export interface ParsedMetiFeed {
  entries: ParsedMetiEntry[];
}

const HEADER_LINES = new Set([
  "no.",
  "国名、地域名",
  "country or region",
  "企業名､組織名",
  "企業名、組織名",
  "company or organization",
  "別名",
  "also known as",
  "懸念区分",
  "type of wmd",
  "通常兵器",
  "conventional weapons",
]);

const WMD_CODE_LINE = /^[BCMN](\s*,\s*[BCMN])*$/;
const HAS_JAPANESE = /[぀-ヿ㐀-鿿]/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses the METI Foreign End User List's linearized page text into entries.
 * Each entry's block starts at a standalone row-number line ("No.") and runs
 * until the next one; within a block, country/company/alias/WMD-code lines
 * are told apart by pattern rather than fixed column position, since the
 * PDF's per-revision layout is not guaranteed stable.
 *
 * Decoupled from the PDF library and from `fetch` so this can be unit-tested
 * against a plain-text fixture with no network call and no pdfjs dependency,
 * mirroring the other five sources' parseXStream()/parseXHtml() functions.
 */
export function parseMetiEulText(rawText: string): ParsedMetiFeed {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !HEADER_LINES.has(l.toLowerCase()));

  const entries: ParsedMetiEntry[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    entries.push(parseEntryBlock(block));
    block = [];
  };

  for (const line of lines) {
    if (/^\d{1,4}$/.test(line)) {
      flush();
      continue; // the row number itself carries no data (positional, not a stable id)
    }
    block.push(line);
  }
  flush();

  return { entries: entries.filter((e) => e.name.length > 0) };
}

function parseEntryBlock(lines: string[]): ParsedMetiEntry {
  let countryJapanese: string | null = null;
  let countryEnglish: string | null = null;
  const aliases: string[] = [];
  const wmdCodes: string[] = [];
  let conventionalWeapons = false;
  const nameLines: string[] = [];
  let countryConsumed = false;

  for (const line of lines) {
    if (line.startsWith("・")) {
      const alias = line.slice(1).trim();
      if (alias) aliases.push(alias);
      continue;
    }
    if (WMD_CODE_LINE.test(line)) {
      for (const code of line.split(",").map((c) => c.trim())) if (code) wmdCodes.push(code);
      continue;
    }
    if (line === "CW") {
      conventionalWeapons = true;
      continue;
    }
    if (!countryConsumed) {
      const slashSplit = line.match(/^(.+?)\s*\/\s*(.+)$/);
      if (slashSplit && HAS_JAPANESE.test(slashSplit[1])) {
        countryJapanese = slashSplit[1].trim();
        countryEnglish = slashSplit[2].trim();
        countryConsumed = true;
        continue;
      }
      if (HAS_JAPANESE.test(line) && !countryJapanese) {
        countryJapanese = line;
        continue;
      }
      if (countryJapanese && !countryEnglish && !HAS_JAPANESE.test(line)) {
        countryEnglish = line;
        countryConsumed = true;
        continue;
      }
    }
    nameLines.push(line);
  }

  return {
    countryJapanese,
    countryEnglish,
    name: nameLines.join(" ").trim(),
    aliases,
    wmdCodes,
    conventionalWeapons,
  };
}

export function mapMetiEntry(entry: ParsedMetiEntry) {
  const programCodes = [...entry.wmdCodes, ...(entry.conventionalWeapons ? ["CW"] : [])];
  return {
    entityHash: computeEntityHash(METI_SOURCE_LIST, entry.name, entry.countryEnglish ?? undefined),
    entityType: "ENTITY" as const,
    name: entry.name,
    alternateNames: entry.aliases,
    country: entry.countryEnglish,
    remarks: entry.countryJapanese ? `Country (Japanese): ${entry.countryJapanese}` : null,
    programCodes,
    agency: METI_AGENCY,
  };
}

/**
 * Downloads the current METI Foreign End User List PDF with a bounded
 * timeout and retry-with-backoff, and returns a SHA-256 checksum of the
 * downloaded bytes alongside them for integrity/health monitoring (detects a
 * truncated/corrupted download; surfaced in DatasetRefreshLog for
 * observability across revisions).
 */
export async function downloadMetiPdf(): Promise<{ bytes: Uint8Array; checksum: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(METI_PDF_URL, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`METI Foreign End User List source returned HTTP ${res.status}.`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error("Downloaded PDF was empty.");
      const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
      return { bytes, checksum };
    } catch (err) {
      lastError = err;
      if (attempt < FETCH_RETRIES) await sleep(FETCH_RETRY_BASE_DELAY_MS * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(
    `METI Foreign End User List download failed after ${FETCH_RETRIES} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }. Ingestion aborted -- no data was written.`
  );
}

/**
 * Extracts linearized page text from the downloaded PDF bytes via pdfjs-dist's
 * Node-compatible legacy build (no DOM/worker required).
 */
export async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = "";
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      currentLine += item.str;
      if (item.hasEOL) {
        lines.push(currentLine);
        currentLine = "";
      }
    }
    if (currentLine) lines.push(currentLine);
    pageTexts.push(lines.join("\n"));
    await page.cleanup();
  }
  return pageTexts.join("\n");
}

/** Downloads and parses the live feed with no DB writes -- used by the (disabled-by-default) live integration test and available for a manual health check. */
export async function downloadAndParseMetiFeed(): Promise<{ feed: ParsedMetiFeed; checksum: string }> {
  const { bytes, checksum } = await downloadMetiPdf();
  const text = await extractTextFromPdf(bytes);
  return { feed: parseMetiEulText(text), checksum };
}

export interface MetiIngestResult {
  parsedCount: number;
  supersededCount: number;
  checksum: string;
}

export class MetiForeignEndUserListIngestionService {
  static async fetchAndIngest(): Promise<MetiIngestResult> {
    const { feed, checksum } = await downloadAndParseMetiFeed();
    const { entries } = feed;

    if (entries.length < MIN_EXPECTED_ENTRIES) {
      throw new Error(
        `METI Foreign End User List parse returned only ${entries.length} entries (expected at least ${MIN_EXPECTED_ENTRIES}; downloaded checksum ${checksum}). ` +
          "Refusing to treat this as a complete, successful ingest -- the PDF's layout most likely changed, or the download was truncated/blocked. " +
          "No data was written; previously published rows remain live."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
      const batch = entries.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = mapMetiEntry(entry);
          return db.screeningEntity.upsert({
            where: { entityHash: data.entityHash },
            update: {
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: METI_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: METI_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: METI_AGENCY,
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
      where: { sourceList: METI_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: METI_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: METI_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: METI_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: METI_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: METI_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entries.length, supersededCount: supersedeResult.count, checksum };
  }
}

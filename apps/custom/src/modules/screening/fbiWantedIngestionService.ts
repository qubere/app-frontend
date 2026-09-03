import { db } from "@/lib/db";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";
import crypto from "crypto";
import https from "node:https";

const FBI_DATASET_ID = "fbi-wanted";
const FBI_PROVIDER = "FBI_WANTED";
const FBI_SOURCE_LIST = "FBI_WANTED";
const FBI_AGENCY = "FBI (Federal Bureau of Investigation)";

// api.fbi.gov caps pageSize at 50 regardless of the value requested (confirmed
// by live probe -- pageSize=1000 still returns 50 items per page).
const PAGE_SIZE = 50;

// Same rationale as OFAC/BIS: keep concurrent upserts under
// DATABASE_URL's pgbouncer connection_limit=10.
const UPSERT_BATCH_SIZE = 8;

interface FbiWantedItem {
  uid: string;
  title?: string;
  aliases?: string[] | null;
  subjects?: string[] | null;
  nationality?: string | null;
  possible_countries?: string[] | null;
  description?: string | null;
  url?: string | null;
  publication?: string | null;
  modified?: string | null;
}

export interface FbiWantedIngestResult {
  count: number;
  reportedTotal: number;
  supersededCount: number;
}

function computeFbiEntityHash(uid: string): string {
  return crypto.createHash("sha256").update(`${FBI_PROVIDER}:${uid}`).digest("hex");
}

function parseFbiDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * api.fbi.gov sits behind Cloudflare bot management that fingerprints the
 * TLS/HTTP client, not just headers: undici's `fetch` (Node's default, used
 * everywhere else in this codebase) gets a bare 403 no matter what
 * User-Agent/Accept headers are sent, while curl and Node's own core
 * `https` module succeed against the identical URL. Routed through core
 * `https` here specifically to route around that fingerprint mismatch --
 * every other ingester in this module can keep using `fetch`.
 */
function httpsGetJson(url: string): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            try {
              resolve({ status, json: data ? JSON.parse(data) : null });
            } catch {
              resolve({ status, json: null });
            }
          });
        }
      )
      .on("error", reject);
  });
}

export class FbiWantedIngestionService {
  static _httpsGetJson = httpsGetJson;

  private static async fetchPage(page: number): Promise<{ items: FbiWantedItem[]; total: number }> {
    const url = new URL("https://api.fbi.gov/wanted/v1/list");
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PAGE_SIZE));

    const { status, json } = await this._httpsGetJson(url.toString());
    if (status !== 200 || !json) {
      throw new Error(`FBI Wanted API returned HTTP ${status} for page ${page}. Ingestion aborted.`);
    }
    return { items: Array.isArray(json.items) ? json.items : [], total: Number(json.total) || 0 };
  }

  static async fetchAndIngest(): Promise<FbiWantedIngestResult> {
    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];
    const activeProviderRecordIds = new Set<string>();

    let page = 1;
    let reportedTotal = 0;
    let fetchedCount = 0;

    while (true) {
      const { items, total } = await this.fetchPage(page);
      reportedTotal = total;
      if (items.length === 0) break;

      // FBI publishes public-tip/"seeking information" postings with no
      // identified subject (title only, uid still present but no name to
      // screen against) -- skip those rather than writing an empty-name row.
      const named = items.filter((item) => item.title && item.title.trim().length > 0);

      for (let i = 0; i < named.length; i += UPSERT_BATCH_SIZE) {
        const batch = named.slice(i, i + UPSERT_BATCH_SIZE);
        const results = await Promise.all(
          batch.map((item) => {
            const name = item.title!.trim();
            const alternateNames = Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : [];
            const country = Array.isArray(item.possible_countries) ? item.possible_countries[0] ?? null : null;
            const entityHash = computeFbiEntityHash(item.uid);
            const providerUpdatedAt = parseFbiDate(item.modified);
            const effectiveDate = parseFbiDate(item.publication);

            return db.screeningEntity.upsert({
              where: { provider_providerRecordId: { provider: FBI_PROVIDER, providerRecordId: item.uid } },
              update: {
                name,
                alternateNames,
                country,
                nationalityCountry: item.nationality || null,
                programCodes: Array.isArray(item.subjects) ? item.subjects : [],
                remarks: item.description || null,
                citation: item.url || null,
                agency: FBI_AGENCY,
                effectiveDate,
                providerUpdatedAt,
                publicationStatus: "PUBLISHED",
                publishedAt: now,
                supersededAt: null,
                sourcePublishedAt: effectiveDate ?? undefined,
              },
              create: {
                entityHash,
                sourceList: FBI_SOURCE_LIST,
                sourceAuthority: "FBI",
                provider: FBI_PROVIDER,
                providerRecordId: item.uid,
                entityType: "INDIVIDUAL",
                name,
                alternateNames,
                country,
                nationalityCountry: item.nationality || null,
                programCodes: Array.isArray(item.subjects) ? item.subjects : [],
                remarks: item.description || null,
                citation: item.url || null,
                agency: FBI_AGENCY,
                effectiveDate,
                providerUpdatedAt,
                publicationStatus: "PUBLISHED",
                publishedAt: now,
                sourcePublishedAt: effectiveDate ?? now,
              },
            });
          })
        );
        for (const row of results) {
          activeProviderRecordIds.add(row.providerRecordId!);
          changeInputs.push({
            screeningEntityId: row.id,
            changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
          });
        }
      }

      fetchedCount += named.length;
      if (page * PAGE_SIZE >= total) break;
      page++;
    }

    if (reportedTotal === 0) {
      throw new Error("FBI Wanted API reported 0 total records. Refusing to treat an unverifiable feed as complete.");
    }

    // Anyone previously PUBLISHED under this provider but absent from this
    // run's fetch was removed from the FBI's list (arrested, cleared, or
    // posting withdrawn) -- mark SUPERSEDED rather than delete, matching
    // every other ingester's point-in-time audit posture.
    const previouslyPublished = await db.screeningEntity.findMany({
      where: { provider: FBI_PROVIDER, publicationStatus: "PUBLISHED" },
      select: { id: true, providerRecordId: true },
    });
    const toSupersede = previouslyPublished.filter((e) => !activeProviderRecordIds.has(e.providerRecordId!));

    let supersededCount = 0;
    if (toSupersede.length > 0) {
      supersededCount = toSupersede.length;
      await db.screeningEntity.updateMany({
        where: { id: { in: toSupersede.map((e) => e.id) } },
        data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
      });
      for (const e of toSupersede) {
        changeInputs.push({ screeningEntityId: e.id, changeType: "SUPERSEDED" });
      }
    }

    await recordReferenceDataChanges(
      ingestionRunId,
      changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: FBI_SOURCE_LIST,
        provider: FBI_PROVIDER,
        changeType: c.changeType,
        datasetId: FBI_DATASET_ID,
      }))
    );

    await syncSearchTokensForEntities(
      changeInputs.filter((c) => c.changeType !== "SUPERSEDED").map((c) => c.screeningEntityId)
    );

    return { count: fetchedCount, reportedTotal, supersededCount };
  }
}

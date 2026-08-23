import { CrossIngestionService } from "./crossIngestionService";
import { thirdPartyFetch } from "@/lib/api/thirdPartyLogger";

export interface FetchOptions {
  searchTerms?: string[];
  startDate?: Date;
  endDate?: Date;
  maxPages?: number;
  pageSize?: number;
}

const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CbpCrossFetchService {
  /**
   * Fetch wrapper with retry/backoff for transient failures (429, 5xx, network
   * errors). A single dropped request used to abort ingestion for the entire
   * search term; now it's retried before giving up.
   */
  private static async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
      try {
        const res = await thirdPartyFetch("CBP_CROSS", url, init);
        if (res.ok) return res;
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Real REST API fetcher for official CBP CROSS Rulings with pagination, date cursors, and revocation tracking.
   * Source: rulings.cbp.gov API
   */
  static async fetchAndIngest(
    optionsOrTerm: string | FetchOptions = "tariff"
  ): Promise<{ success: boolean; count: number; note: string }> {
    const terms = typeof optionsOrTerm === "string" ? [optionsOrTerm] : optionsOrTerm.searchTerms || ["tariff"];
    const maxPages = typeof optionsOrTerm === "object" ? optionsOrTerm.maxPages || 5 : 5;
    const pageSize = typeof optionsOrTerm === "object" ? optionsOrTerm.pageSize || 50 : 50;

    const baseUrl = "https://rulings.cbp.gov/api/search";
    let totalIngested = 0;
    const searchNotes: string[] = [];

    for (const term of terms) {
      let page = 1;
      let termIngested = 0;

      while (page <= maxPages) {
        if (page > 1) {
          await delay(REQUEST_DELAY_MS);
        }
        const url = new URL(baseUrl);
        url.searchParams.set("term", term);
        url.searchParams.set("page", String(page));
        url.searchParams.set("pageSize", String(pageSize));

        if (typeof optionsOrTerm === "object" && optionsOrTerm.startDate) {
          url.searchParams.set("fromDate", optionsOrTerm.startDate.toISOString().slice(0, 10));
        }
        if (typeof optionsOrTerm === "object" && optionsOrTerm.endDate) {
          url.searchParams.set("toDate", optionsOrTerm.endDate.toISOString().slice(0, 10));
        }

        const res = await this.fetchWithRetry(url.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent": "Qubere-Compliance-Ingestion-Engine/1.0",
          },
        });

        if (!res.ok) {
          throw new Error(`CBP CROSS Rulings API returned HTTP ${res.status}: ${res.statusText}. Ingestion aborted for term '${term}'.`);
        }

        const json = await res.json();
        const results: any[] = json.results || json.rulings || [];

        if (results.length === 0) break;

        for (const item of results) {
          const rulingNumber = item.rulingNumber || item.ruling_number || item.id;
          if (!rulingNumber) continue;

          // Issue date validation: must have an authoritative date
          const rawDate = item.issuedDate || item.issued_date || item.date;
          if (!rawDate) {
            console.warn(`[CbpCrossFetchService] Ruling ${rulingNumber} has no issue date, skipping automatic ingestion.`);
            continue;
          }
          const issuedAt = new Date(rawDate);
          if (isNaN(issuedAt.getTime())) {
            console.warn(`[CbpCrossFetchService] Ruling ${rulingNumber} has invalid issue date '${rawDate}', skipping.`);
            continue;
          }

          const rulingType = String(rulingNumber).toUpperCase().startsWith("HQ") ? "HQ" : "NY";
          const htsCodes = Array.isArray(item.htsCollection)
            ? item.htsCollection.map((h: any) => (typeof h === "string" ? h : h.htsNumber))
            : Array.isArray(item.htsCodes)
            ? item.htsCodes
            : [];

          let textBody = item.rulingText || item.text || item.summary || item.title || "";

          // Full-body acquisition if text snippet is brief and full endpoint URL is available
          if (textBody.length < 500) {
            try {
              await delay(REQUEST_DELAY_MS);
              const fullRes = await this.fetchWithRetry(`https://rulings.cbp.gov/api/ruling/${encodeURIComponent(rulingNumber)}`);
              if (fullRes.ok) {
                const fullJson = await fullRes.json();
                if (fullJson.rulingText || fullJson.text) {
                  textBody = fullJson.rulingText || fullJson.text;
                }
              }
            } catch {
              // Retain snippet if full fetch fails
            }
          }

          // Check revocation / modification markers in text or metadata
          const textUpper = textBody.toUpperCase();
          const modifiedOrRevokedStatus: "EFFECTIVE" | "REVOKED" | "MODIFIED" = "EFFECTIVE";
          let revokesRulingNumber: string | undefined;
          let modifiesRulingNumber: string | undefined;

          if (textUpper.includes("REVOKES") || textUpper.includes("REVOKING")) {
            const match = textBody.match(/REVOK(?:ES|ING)\s+(?:CBP\s+RULING\s+)?(HQ\s*\d+|NY\s*\d+)/i);
            if (match) revokesRulingNumber = match[1].replace(/\s+/g, "");
          } else if (textUpper.includes("MODIFIES") || textUpper.includes("MODIFYING")) {
            const match = textBody.match(/MODIFY(?:ES|ING)\s+(?:CBP\s+RULING\s+)?(HQ\s*\d+|NY\s*\d+)/i);
            if (match) modifiesRulingNumber = match[1].replace(/\s+/g, "");
          }

          await CrossIngestionService.ingestRuling({
            rulingNumber,
            issuedAt,
            title: item.title || `CBP Ruling ${rulingNumber}`,
            office: rulingType,
            rulingType,
            sourceUrl: `https://rulings.cbp.gov/ruling/${encodeURIComponent(rulingNumber)}`,
            htsCodes,
            modifiedOrRevokedStatus,
            revokesRulingNumber,
            modifiesRulingNumber,
            fragments: [
              {
                fragmentType: "TEXT",
                text: textBody,
              },
            ],
          });

          termIngested++;
        }

        if (results.length < pageSize) break;
        page++;
      }

      totalIngested += termIngested;
      searchNotes.push(`Term '${term}': ${termIngested} rulings ingested across ${page} page(s).`);
    }

    return {
      success: true,
      count: totalIngested,
      note: searchNotes.join("; "),
    };
  }
}


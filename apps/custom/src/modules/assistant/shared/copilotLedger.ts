/**
 * Grounding ledger for Qubere AI Copilot.
 *
 * Records every citation a tool actually returned during a conversation turn —
 * shipment numbers, CBP CROSS ruling numbers, HTS codes, Federal Register
 * citations, evidence IDs and record IDs — and, once the turn's text is
 * complete, annotates any citation in that text the ledger never saw.
 *
 * The annotation happens after the model's text has finished streaming, not
 * before: a streamed token cannot be un-sent. `runAssistantTurn` calls
 * `sanitizeGroundedText` at the end of the turn and, when it changes the text,
 * emits a `text_replace` event so the client swaps the final message. That is a
 * detect-and-correct guarantee, not a pre-display filter — the window between a
 * bad citation streaming and the replacement arriving is small but non-zero.
 */

export function normalizeRulingNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** SHP-YYYY-NNNNNN. */
const SHIPMENT_RE = /\bSHP-\d{4}-\d{6}\b/g;

/**
 * CBP CROSS ruling numbers: HQ H301234, NY N123456, bare H301234 / N123456, or
 * RUL-12345. The H/N prefix on the 6-digit forms is what keeps "NY 10001" (a
 * zip code) from matching.
 */
const RULING_RE = /\b(?:HQ\s*H\d{6}|NY\s*N\d{6}|H\d{6}|N\d{6}|RUL-\d{5,7})\b/gi;

/**
 * HTS codes. Two patterns on purpose:
 *
 *  - RECORD is permissive (6/8/10-digit dotted forms) — over-recording a token
 *    from a tool result costs nothing.
 *  - CITE, used to validate and annotate the model's text, requires the 8- or
 *    10-digit form ("8541.40.60", "8541.40.6025", "8541.40.60.25"). The bare
 *    6-digit "1234.56" shape is left out here because it collides with money
 *    and decimals in ordinary prose. A dotted date ("2024.08.15") can still
 *    match the 8-digit shape; annotation (not deletion) keeps that cosmetic.
 */
const HTS_RECORD_RE = /\b\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?|\.\d{4})?\b/g;
const HTS_CITE_RE = /\b\d{4}\.\d{2}\.\d{2}(?:\.\d{2}|\d{2})?\b/g;

/** Federal Register citations, e.g. "88 FR 12345". */
const FR_RE = /\b\d{2,3}\s+FR\s+\d{4,6}\b/gi;

/** Evidence IDs, e.g. "EVI-abc123". */
const EVIDENCE_RE = /\bEVI-[A-Za-z0-9_-]+\b/gi;

function normalizeFrCite(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, " ");
}

/** Compare HTS codes by digits only, so "8541.40.6025" and "8541.40.60.25" match. */
function normalizeHts(raw: string): string {
  return raw.replace(/\D/g, "");
}

export class CopilotGroundingLedger {
  public readonly shipmentNumbers = new Set<string>();
  public readonly rulingNumbers = new Set<string>();
  public readonly htsCodes = new Set<string>();
  public readonly frCites = new Set<string>();
  public readonly evidenceIds = new Set<string>();
  public readonly entityIds = new Set<string>();

  /**
   * Scans a tool execution output for citations and records them in the ledger.
   */
  public recordToolOutput(output: unknown): void {
    if (!output) return;
    const jsonString = typeof output === "string" ? output : JSON.stringify(output);

    for (const match of jsonString.matchAll(SHIPMENT_RE)) {
      this.shipmentNumbers.add(match[0]);
      this.entityIds.add(match[0]);
    }
    for (const match of jsonString.matchAll(RULING_RE)) {
      this.rulingNumbers.add(normalizeRulingNumber(match[0]));
    }
    for (const match of jsonString.matchAll(HTS_RECORD_RE)) {
      this.htsCodes.add(normalizeHts(match[0]));
    }
    for (const match of jsonString.matchAll(FR_RE)) {
      this.frCites.add(normalizeFrCite(match[0]));
    }
    for (const match of jsonString.matchAll(EVIDENCE_RE)) {
      this.evidenceIds.add(match[0]);
    }

    // Record IDs (uuid or prefixed IDs) reached only through the object form.
    if (typeof output === "object" && output !== null) {
      this.extractEntityIds(output as Record<string, unknown>);
    }
  }

  private extractEntityIds(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "id" || key.endsWith("Id")) {
        if (typeof value === "string" && value.length > 0) {
          this.entityIds.add(value);
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            this.extractEntityIds(item as Record<string, unknown>);
          }
        }
      } else if (value && typeof value === "object") {
        this.extractEntityIds(value as Record<string, unknown>);
      }
    }
  }

  /**
   * Counts grounded vs ungrounded citations in the finished text, for the audit
   * trail. `entitiesCited` covers shipment / ruling / HTS / FR references;
   * `evidenceCited` covers evidence IDs; `droppedCitations` is everything the
   * ledger never saw.
   */
  public validate(text: string): {
    entitiesCited: number;
    evidenceCited: number;
    droppedCitations: number;
  } {
    let entitiesCited = 0;
    let evidenceCited = 0;
    let droppedCitations = 0;

    const tally = (mentioned: Iterable<string>, ledger: Set<string>, bucket: "entity" | "evidence") => {
      for (const value of new Set(mentioned)) {
        if (ledger.has(value)) {
          if (bucket === "entity") entitiesCited++;
          else evidenceCited++;
        } else {
          droppedCitations++;
        }
      }
    };

    tally(Array.from(text.matchAll(SHIPMENT_RE), (m) => m[0]), this.shipmentNumbers, "entity");
    tally(Array.from(text.matchAll(RULING_RE), (m) => normalizeRulingNumber(m[0])), this.rulingNumbers, "entity");
    tally(Array.from(text.matchAll(HTS_CITE_RE), (m) => normalizeHts(m[0])), this.htsCodes, "entity");
    tally(Array.from(text.matchAll(FR_RE), (m) => normalizeFrCite(m[0])), this.frCites, "entity");
    tally(Array.from(text.matchAll(EVIDENCE_RE), (m) => m[0]), this.evidenceIds, "evidence");

    return { entitiesCited, evidenceCited, droppedCitations };
  }

  /**
   * Annotates every citation in `text` the ledger never recorded with an
   * explicit "[Unverified …]" marker, so a hallucinated shipment, ruling, HTS
   * code, Federal Register cite or evidence ID cannot reach the user reading as
   * fact. Grounded citations are returned untouched. This never deletes text.
   */
  public sanitizeGroundedText(text: string): string {
    let sanitized = text;

    sanitized = sanitized.replace(SHIPMENT_RE, (shp) =>
      this.shipmentNumbers.has(shp) ? shp : `${shp} [Unverified Shipment]`
    );
    sanitized = sanitized.replace(RULING_RE, (ruling) =>
      this.rulingNumbers.has(normalizeRulingNumber(ruling)) ? ruling : `${ruling} [Unverified Ruling Citation]`
    );
    sanitized = sanitized.replace(HTS_CITE_RE, (code) =>
      this.htsCodes.has(normalizeHts(code)) ? code : `${code} [Unverified HTS Code]`
    );
    sanitized = sanitized.replace(FR_RE, (cite) =>
      this.frCites.has(normalizeFrCite(cite)) ? cite : `${cite} [Unverified Citation]`
    );
    sanitized = sanitized.replace(EVIDENCE_RE, (evi) =>
      this.evidenceIds.has(evi) ? evi : `${evi} [Unverified Evidence]`
    );

    return sanitized;
  }
}

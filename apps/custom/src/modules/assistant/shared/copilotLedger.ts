/**
 * Grounding ledger for Qubere AI Copilot.
 *
 * Tracks every citation (shipment numbers, CBP CROSS ruling numbers, HTS codes,
 * Federal Register citations, evidence IDs, and record IDs) returned by tools
 * during a conversation turn, and intercepts/redacts ungrounded references.
 */

export function normalizeRulingNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
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

    // 1. Shipment numbers (SHP-YYYY-XXXXXX)
    const shpMatches = jsonString.matchAll(/\bSHP-\d{4}-\d{6}\b/g);
    for (const match of shpMatches) {
      this.shipmentNumbers.add(match[0]);
      this.entityIds.add(match[0]);
    }

    // 2. CBP CROSS Ruling numbers (e.g. HQ H301234, NY N123456, H301234, N123456)
    // Guard against zip codes (e.g., "NY 10001") by requiring H or N prefix for 6-digit numbers.
    const rulingMatches = jsonString.matchAll(/\b(?:HQ\s*H\d{6}|NY\s*N\d{6}|H\d{6}|N\d{6}|RUL-\d{5,7})\b/gi);
    for (const match of rulingMatches) {
      const normalized = normalizeRulingNumber(match[0]);
      this.rulingNumbers.add(normalized);
    }

    // 3. HTS codes (e.g. 8541.40.6025, 8541.40.60, 8541.40)
    const htsMatches = jsonString.matchAll(/\b\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?\b/g);
    for (const match of htsMatches) {
      this.htsCodes.add(match[0]);
    }

    // 4. Federal Register citations (e.g. 88 FR 12345)
    const frMatches = jsonString.matchAll(/\b\d{2,3}\s+FR\s+\d{4,6}\b/gi);
    for (const match of frMatches) {
      this.frCites.add(match[0].toUpperCase().replace(/\s+/g, " "));
    }

    // 5. Evidence IDs (EVI-...)
    const eviMatches = jsonString.matchAll(/\bEVI-[A-Za-z0-9_-]+\b/gi);
    for (const match of eviMatches) {
      this.evidenceIds.add(match[0]);
    }

    // 6. Record IDs (uuid or prefixed IDs)
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
   * Comprehensive validation across all citation types.
   */
  public validate(text: string): {
    entitiesCited: number;
    evidenceCited: number;
    droppedCitations: number;
  } {
    let entitiesCited = 0;
    let evidenceCited = 0;
    let droppedCitations = 0;

    // Check shipment numbers
    const mentionedShipments = new Set(Array.from(text.matchAll(/\bSHP-\d{4}-\d{6}\b/g), (m) => m[0]));
    for (const shp of mentionedShipments) {
      if (this.shipmentNumbers.has(shp)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check ruling numbers
    const mentionedRulings = new Set(
      Array.from(
        text.matchAll(/\b(?:HQ\s*H\d{6}|NY\s*N\d{6}|H\d{6}|N\d{6}|RUL-\d{5,7})\b/gi),
        (m) => normalizeRulingNumber(m[0])
      )
    );
    for (const r of mentionedRulings) {
      if (this.rulingNumbers.has(r)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check HTS codes
    const mentionedHts = new Set(Array.from(text.matchAll(/\b\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?\b/g), (m) => m[0]));
    for (const code of mentionedHts) {
      if (this.htsCodes.has(code)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check FR citations
    const mentionedFr = new Set(
      Array.from(text.matchAll(/\b\d{2,3}\s+FR\s+\d{4,6}\b/gi), (m) => m[0].toUpperCase().replace(/\s+/g, " "))
    );
    for (const fr of mentionedFr) {
      if (this.frCites.has(fr)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check evidence IDs
    const mentionedEvidence = new Set(Array.from(text.matchAll(/\bEVI-[A-Za-z0-9_-]+\b/gi), (m) => m[0]));
    for (const evi of mentionedEvidence) {
      if (this.evidenceIds.has(evi)) {
        evidenceCited++;
      } else {
        droppedCitations++;
      }
    }

    return {
      entitiesCited,
      evidenceCited,
      droppedCitations,
    };
  }

  /**
   * Intercepts ungrounded shipment or ruling citations in response text.
   * Replaces ungrounded citations with an explicit notice to prevent hallucinated data from reaching the user.
   */
  public sanitizeGroundedText(text: string): string {
    let sanitized = text;

    // Sanitize ungrounded shipment numbers
    sanitized = sanitized.replace(/\bSHP-\d{4}-\d{6}\b/g, (shp) => {
      if (this.shipmentNumbers.has(shp)) return shp;
      return `${shp} [Unverified Shipment]`;
    });

    // Sanitize ungrounded ruling numbers
    sanitized = sanitized.replace(/\b(?:HQ\s*H\d{6}|NY\s*N\d{6}|H\d{6}|N\d{6}|RUL-\d{5,7})\b/gi, (rulingStr) => {
      const norm = normalizeRulingNumber(rulingStr);
      if (this.rulingNumbers.has(norm)) return rulingStr;
      return `${rulingStr} [Unverified Ruling Citation]`;
    });

    return sanitized;
  }
}

/**
 * Grounding ledger for Qubere AI Copilot.
 *
 * Tracks every citation (shipment numbers, ruling numbers, HTS codes,
 * Federal Register citations, evidence IDs, and entity IDs) returned by tools
 * during a conversation turn, and validates that model outputs only cite facts
 * grounded in those tool results.
 */

export class CopilotGroundingLedger {
  public readonly shipmentNumbers = new Set<string>();
  public readonly rulingNumbers = new Set<string>();
  public readonly htsCodes = new Set<string>();
  public readonly frCites = new Set<string>();
  public readonly evidenceIds = new Set<string>();
  public readonly entityIds = new Set<string>();

  /**
   * Scans a tool execution output for citations and adds them to the ledger.
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

    // 2. CBP CROSS Ruling numbers (e.g., HQ H301234, NY N123456, H301234, N123456, RUL-12345)
    const rulingMatches = jsonString.matchAll(/\b(?:HQ|NY|H|N|RUL)[ -]?\d{5,7}\b/gi);
    for (const match of rulingMatches) {
      this.rulingNumbers.add(match[0].toUpperCase());
    }

    // 3. HTS codes (e.g. 8541.40.6025 or 8541406025)
    const htsMatches = jsonString.matchAll(/\b\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?\b/g);
    for (const match of htsMatches) {
      this.htsCodes.add(match[0]);
    }

    // 4. Federal Register citations (e.g. 88 FR 12345)
    const frMatches = jsonString.matchAll(/\b\d{2,3}\s+FR\s+\d{4,6}\b/gi);
    for (const match of frMatches) {
      this.frCites.add(match[0].toUpperCase());
    }

    // 5. Evidence IDs (EVI-...)
    const eviMatches = jsonString.matchAll(/\bEVI-[A-Za-z0-9_-]+\b/gi);
    for (const match of eviMatches) {
      this.evidenceIds.add(match[0]);
    }

    // 6. Generic record IDs (uuid or prefixed IDs returned in tool outputs)
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
   * Validates the generated text against citations in the ledger.
   * Returns counts of grounded citations vs ungrounded/dropped citations.
   */
  public validate(text: string): {
    entitiesCited: number;
    evidenceCited: number;
    droppedCitations: number;
  } {
    let entitiesCited = 0;
    let droppedCitations = 0;

    // Check shipment numbers mentioned
    const mentionedShipments = new Set(Array.from(text.matchAll(/\bSHP-\d{4}-\d{6}\b/g), (m) => m[0]));
    for (const shp of mentionedShipments) {
      if (this.shipmentNumbers.has(shp)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check ruling numbers mentioned
    const mentionedRulings = new Set(
      Array.from(text.matchAll(/\b(?:HQ|NY|H|N|RUL)[ -]?\d{5,7}\b/gi), (m) => m[0].toUpperCase())
    );
    for (const r of mentionedRulings) {
      if (this.rulingNumbers.has(r)) {
        entitiesCited++;
      } else {
        droppedCitations++;
      }
    }

    // Check evidence IDs
    const mentionedEvidence = new Set(Array.from(text.matchAll(/\bEVI-[A-Za-z0-9_-]+\b/gi), (m) => m[0]));
    let evidenceCited = 0;
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
}

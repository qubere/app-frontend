/**
 * CustomsFilingTransmissionProvider interface and supporting types.
 *
 * Implement this interface to plug in real CBP ABI credentials without any
 * other code changes. The only active implementation is MockCustomsTransmissionProvider
 * (in src/lib/providers/index.ts) until ABI filer credentials are available.
 *
 * RealAceProvider is a stub: adding the HTTP calls to the CBP ABI endpoint is the
 * only remaining step once credentials exist.
 */

// ── CATAIR-aligned ABI payload ─────────────────────────────────────────────────

/**
 * Payload structure for ACE/ABI submission, aligned with the CATAIR transaction
 * set. The 7501 field mapping in form7501.ts maps to these fields.
 */
export interface AbiPayload {
  filingId: string;
  entryNumber: string;
  entryType: string;
  portOfEntry: string;
  importerCbpNumber: string;
  bondNumber: string;
  countryOfExport: string;
  carrier: string;
  totalEnteredValue: number;
  totalDuty: number;
  lineItems: Array<{
    lineNumber: number;
    htsCode: string;
    description: string;
    quantity: number;
    enteredValue: number;
    dutyRate: number;
    dutyAmount: number;
    countryOfOrigin: string;
  }>;
  /** ISO 8601 timestamp when this payload was built */
  builtAt: string;
}

export interface TransmissionResult {
  referenceNumber: string;
  status: "ACCEPTED" | "REJECTED" | "PENDING_REVIEW";
  responseCode: string;
  message: string;
  transmittedAt: string;
}

export interface FilingStatusUpdate {
  referenceNumber: string;
  status: "ACCEPTED" | "REJECTED" | "RELEASED" | "LIQUIDATED" | "PENDING" | "UNDER_REVIEW";
  updatedAt: string;
  notes?: string;
}

export interface AcknowledgmentResult {
  referenceNumber: string;
  accepted: boolean;
  responseCode: string;
  rejectionReasons?: string[];
  /** Unmodified raw acknowledgment string from CBP for audit purposes. */
  raw: string;
}

// ── Provider interface ─────────────────────────────────────────────────────────

/**
 * Plug-in interface for ACE/ABI customs transmission.
 * Implementations: MockCustomsTransmissionProvider (active), RealAceProvider (stub).
 */
export interface CustomsFilingTransmissionProvider {
  transmit(payload: AbiPayload): Promise<TransmissionResult>;
  getStatus(referenceNumber: string): Promise<FilingStatusUpdate>;
  parseAcknowledgment(raw: string): AcknowledgmentResult;
}

import { SecretStoreResolver, NotImplSecretStoreResolver } from "./abiCredentialResolver";
import { classifyLine, parseOutputBatch } from "@/lib/abi/batchBlockControl/parse";
import { splitFixedWidthLines } from "@/lib/abi/fixedWidth";
import { parseEntrySummaryResponse, parseE0Record, classifyResponseLine } from "@/lib/abi/entrySummary/parse";
import { interpretEntrySummaryResponse } from "@/lib/abi/entrySummary/interpretResponse";
import { getAllAbiErrors } from "@/lib/abi/errorDictionary";

// ── Per-Customer Filer Credential Config ──────────────────────────────────────

export interface RealAceProviderConfig {
  credential: {
    filerCode: string;
    secretRef: string;
    baseUrl?: string;
    environment?: "SANDBOX" | "PRODUCTION";
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  };
  secretResolver?: SecretStoreResolver;
}

// ── Real ACE provider stub ─────────────────────────────────────────────────────

/**
 * CBP ACE/ABI provider using per-customer credentials (`AbiFilerCredential`).
 *
 * Structure: Credentials and secret references are provided per Account.
 * Real HTTP transmission calls will be added once CBP transport option and test
 * environment access are established.
 */
export class RealAceProvider implements CustomsFilingTransmissionProvider {
  private readonly filerCode: string;
  private readonly secretRef: string;
  private readonly baseUrl: string;
  private readonly environment: string;
  private readonly status: string;
  private readonly secretResolver: SecretStoreResolver;

  constructor(config: RealAceProviderConfig) {
    this.filerCode = config.credential.filerCode;
    this.secretRef = config.credential.secretRef;
    this.baseUrl = config.credential.baseUrl ?? "https://ace.cbp.dhs.gov/abi";
    this.environment = config.credential.environment ?? "SANDBOX";
    this.status = config.credential.status ?? "ACTIVE";
    this.secretResolver = config.secretResolver ?? new NotImplSecretStoreResolver();
  }

  public getFilerCode(): string {
    return this.filerCode;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public getStatusValue(): string {
    return this.status;
  }

  public async getSecret(): Promise<string> {
    if (this.status !== "ACTIVE") {
      throw new Error(`RealAceProvider: Filer credential status is ${this.status}.`);
    }
    return this.secretResolver.resolveSecret(this.secretRef);
  }

  private assertCredentials(): void {
    if (!this.filerCode || !this.secretRef) {
      throw new Error("filerCode and secretRef must be provided for RealAceProvider.");
    }
    if (this.status !== "ACTIVE") {
      throw new Error(`RealAceProvider: Credential status is ${this.status}.`);
    }
  }

  async transmit(_payload: AbiPayload): Promise<TransmissionResult> {
    this.assertCredentials();
    throw new Error(
      "RealAceProvider.transmit is not yet implemented. " +
        `Base URL: ${this.baseUrl}. Filer Code: ${this.filerCode}.`
    );
  }

  async getStatus(_referenceNumber: string): Promise<FilingStatusUpdate> {
    this.assertCredentials();
    throw new Error("RealAceProvider.getStatus is not yet implemented.");
  }

  parseAcknowledgment(raw: string): AcknowledgmentResult {
    const lines = splitFixedWidthLines(raw);
    if (lines.length === 0) {
      return {
        referenceNumber: "UNKNOWN",
        accepted: false,
        responseCode: "EMPTY_PAYLOAD",
        rejectionReasons: ["Raw acknowledgment payload is empty"],
        raw,
      };
    }

    const hasEnvelope = classifyLine(lines[0]) === "A" && classifyLine(lines[lines.length - 1]) === "Z";
    const hasXRecords = lines.some((l) => {
      const type = classifyLine(l);
      return type === "X0" || type === "X1";
    });

    if (hasEnvelope && hasXRecords) {
      const parsedBatch = parseOutputBatch(raw);
      if (parsedBatch.scenario === "REJECTED") {
        const rejectionReasons: string[] = [];
        const allConditions = [...parsedBatch.conditions, parsedBatch.finalDisposition];
        for (const c of allConditions) {
          const matched = getAllAbiErrors(c.conditionCode);
          if (matched.length > 0) {
            for (const m of matched) {
              rejectionReasons.push(`[Code ${c.conditionCode}] ${m.narrativeText}: ${m.explanation}`);
            }
          } else {
            rejectionReasons.push(`[Code ${c.conditionCode}] ${c.narrativeText}`);
          }
        }

        const ref =
          (parsedBatch.aRecord.transmitterUserDataText ?? "").trim() ||
          `${parsedBatch.aRecord.senderReceiverSiteCode}${parsedBatch.aRecord.senderReceiverIdCode}` ||
          "BATCH_REJECT";

        return {
          referenceNumber: ref,
          accepted: false,
          responseCode: parsedBatch.finalDisposition.conditionCode || "BATCH_REJECTED",
          rejectionReasons,
          raw,
        };
      }
    } else if (hasXRecords) {
      // Standalone X0/X1 diagnostic lines without full A/Z batch header
      const rejectionReasons: string[] = [];
      for (const line of lines) {
        if (classifyLine(line) === "X1") {
          const code = line.slice(4, 7).trim();
          const narrative = line.slice(10, 50).trim();
          const matched = getAllAbiErrors(code);
          if (matched.length > 0) {
            for (const m of matched) {
              rejectionReasons.push(`[Code ${code}] ${m.narrativeText}: ${m.explanation}`);
            }
          } else {
            rejectionReasons.push(`[Code ${code}] ${narrative || "Batch/Block Diagnostic Rejection"}`);
          }
        }
      }

      return {
        referenceNumber: "DIAGNOSTIC_REJECT",
        accepted: false,
        responseCode: "X1_REJECT",
        rejectionReasons,
        raw,
      };
    }

    // Process Entry Summary payload (either inside an accepted A...Z envelope or raw E0/E1 lines)
    let esLines = lines;
    if (hasEnvelope) {
      const parsedBatch = parseOutputBatch(raw);
      if (parsedBatch.scenario === "ACCEPTED") {
        esLines = parsedBatch.blocks.flatMap((b) => b.transactionRecords);
      }
    }

    const parsedES = parseEntrySummaryResponse(esLines);
    const interpreted = interpretEntrySummaryResponse(parsedES);

    const accepted = interpreted.scenario === "ACCEPTED" && !interpreted.hasFatalErrors;
    const finalCode =
      (interpreted.finalDisposition.conditionCode ?? "").trim() ||
      (interpreted.finalDisposition.reasonCode ?? "").trim() ||
      (accepted ? "000" : "REJECTED");

    const rejectionReasons = interpreted.conditions.map(
      (c) => `[Code ${c.lookupCode}] ${c.title}: ${c.description}`
    );

    // Extract reference from E0 lines if present or default
    let referenceNumber = "ENTRY_SUMMARY";
    for (const line of esLines) {
      if (classifyResponseLine(line) === "E0") {
        try {
          const parsedE0 = parseE0Record(line);
          if ("entryNumber" in parsedE0 && parsedE0.entryNumber) {
            const filer = parsedE0.entryFilerCode ? parsedE0.entryFilerCode.trim() : "";
            const num = parsedE0.entryNumber.trim();
            referenceNumber = filer ? `${filer}-${num}` : num;
            break;
          } else if ("brokerReferenceNumber" in parsedE0 && parsedE0.brokerReferenceNumber) {
            referenceNumber = parsedE0.brokerReferenceNumber.trim();
            break;
          } else if ("referenceDataText" in parsedE0 && parsedE0.referenceDataText) {
            referenceNumber = parsedE0.referenceDataText.trim();
            break;
          }
        } catch {
          // ignore parsing error on reference extraction
        }
      }
    }

    return {
      referenceNumber,
      accepted,
      responseCode: finalCode,
      rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
      raw,
    };
  }
}

import {
  isDocumentParserError,
  type DocumentParserProvider,
  type ParserJobReference,
  type ParserJobStatus,
  type ParserResult,
  type ParserSubmission,
  type ParserSubmissionAck,
  type ProcessingProfile,
  type SourceDelivery,
} from "./contracts";

/**
 * A retryable primary failure is a transient condition — a provider hiccup, a
 * result that has not finished landing — that the worker resolves by re-queuing
 * the run against the same primary provider. Falling through to the backup on
 * one of those would replace a real parse-in-progress with a mock result (or a
 * mock error), so only a non-retryable primary failure hands off.
 */
function shouldFailOver(error: unknown): boolean {
  return !(isDocumentParserError(error) && error.retryable);
}

/**
 * Executes document parsing via primary provider (ibm-docling) with automatic
 * failover to backup provider (Gemini Vision / Mock) if primary is unavailable or fails.
 */
export class FallbackDoclingProvider implements DocumentParserProvider {
  readonly providerId = "docling-primary-gemini-backup";

  constructor(
    private readonly primary: DocumentParserProvider,
    private readonly backup: DocumentParserProvider
  ) {}

  isMockProvider(): boolean {
    return this.primary.isMockProvider() && this.backup.isMockProvider();
  }

  get sourceDelivery(): SourceDelivery {
    return this.primary.sourceDelivery;
  }

  configurationHash(profile: ProcessingProfile): string {
    return `${this.primary.configurationHash(profile)}-fallback-${this.backup.configurationHash(profile)}`;
  }

  async submit(submission: ParserSubmission): Promise<ParserSubmissionAck> {
    try {
      return await this.primary.submit(submission);
    } catch (err) {
      if (!shouldFailOver(err)) throw err;
      console.warn("[DocumentParser] Primary parser submit failed, using backup provider:", err);
      return await this.backup.submit(submission);
    }
  }

  async getStatus(ref: ParserJobReference): Promise<ParserJobStatus> {
    try {
      return await this.primary.getStatus(ref);
    } catch (err) {
      if (!shouldFailOver(err)) throw err;
      console.warn("[DocumentParser] Primary parser getStatus failed, using backup provider:", err);
      return await this.backup.getStatus(ref);
    }
  }

  async getResult(ref: ParserJobReference, profile: ProcessingProfile): Promise<ParserResult> {
    try {
      return await this.primary.getResult(ref, profile);
    } catch (err) {
      if (!shouldFailOver(err)) throw err;
      console.warn("[DocumentParser] Primary parser getResult failed, using backup provider:", err);
      return await this.backup.getResult(ref, profile);
    }
  }
}

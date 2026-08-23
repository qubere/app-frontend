import type {
  DocumentParserProvider,
  ParserJobReference,
  ParserJobStatus,
  ParserResult,
  ParserSubmission,
  ParserSubmissionAck,
  ProcessingProfile,
  SourceDelivery,
} from "./contracts";

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
      console.warn("[DocumentParser] Primary parser submit failed, using backup provider:", err);
      return await this.backup.submit(submission);
    }
  }

  async getStatus(ref: ParserJobReference): Promise<ParserJobStatus> {
    try {
      return await this.primary.getStatus(ref);
    } catch (err) {
      console.warn("[DocumentParser] Primary parser getStatus failed, using backup provider:", err);
      return await this.backup.getStatus(ref);
    }
  }

  async getResult(ref: ParserJobReference, profile: ProcessingProfile): Promise<ParserResult> {
    try {
      return await this.primary.getResult(ref, profile);
    } catch (err) {
      console.warn("[DocumentParser] Primary parser getResult failed, using backup provider:", err);
      return await this.backup.getResult(ref, profile);
    }
  }
}

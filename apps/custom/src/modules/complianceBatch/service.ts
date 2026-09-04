// Bulk Compliance Screening -- orchestration service. Owns
// ComplianceBatch/BatchRecord/BatchArtifact persistence and the
// upload -> parse -> validate -> queue lifecycle. Never runs the canonical
// RPS/License matching itself -- see processing.ts.
import crypto from "crypto";
import { db } from "@/lib/db";
import { Prisma, type ComplianceBatch } from "@prisma/client";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { storeDocumentFile, StorageValidationError } from "@/lib/storage";
import { parseTransactionComplianceCsv } from "./csvParser";
import { parseTransactionComplianceXlsx } from "./xlsxParser";
import { parseTransactionComplianceJson, ComplianceBatchJsonStructureError } from "./jsonParser";
import { parseTransactionComplianceXml, ComplianceBatchXmlStructureError } from "./xmlParser";
import { parsePreApprovedPartyImportCsv } from "./palImportParser";
import { generateValidationErrorsArtifact } from "./artifacts";
import { ComplianceBatchTemplateService } from "./templates";
import type { ColumnMappingTemplateFields } from "./columns";
import type {
  ComplianceBatchServiceFlags,
  BatchRowValidationError,
  ParsedBatchInput,
  ParsedPreApprovedPartyImportInput,
} from "./types";

export class ComplianceBatchValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidRows: BatchRowValidationError[] = []
  ) {
    super(message);
    this.name = "ComplianceBatchValidationError";
  }
}

/** Thrown when an action (cancel/retry) doesn't apply to the batch's current processingStatus. */
export class ComplianceBatchStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceBatchStateError";
  }
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);

export interface CreateBatchResult {
  batch: ComplianceBatch;
  invalidRows: BatchRowValidationError[];
}

type SupportedFormat = "CSV" | "XLSX" | "JSON" | "XML";

const SUPPORTED_EXTENSIONS: Record<string, SupportedFormat> = {
  ".csv": "CSV",
  ".xlsx": "XLSX",
  ".json": "JSON",
  ".xml": "XML",
};

const DEFAULT_MIME_TYPE: Record<SupportedFormat, string> = {
  CSV: "text/csv",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  JSON: "application/json",
  XML: "application/xml",
};

function detectFormat(fileName: string): SupportedFormat {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const format = SUPPORTED_EXTENSIONS[ext];
  if (!format) {
    throw new ComplianceBatchValidationError(
      `Unsupported file format "${ext}". Supported formats: CSV, XLSX, JSON, XML.`
    );
  }
  return format;
}

async function parseByFormat(
  format: SupportedFormat,
  file: File,
  servicesEnabled: ComplianceBatchServiceFlags,
  templateFields?: ColumnMappingTemplateFields
): Promise<ParsedBatchInput> {
  if (format === "CSV") {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    return parseTransactionComplianceCsv(text, servicesEnabled, templateFields);
  }
  if (format === "XLSX") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parseTransactionComplianceXlsx(buffer, servicesEnabled, templateFields);
  }
  if (format === "XML") {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    try {
      return parseTransactionComplianceXml(text, servicesEnabled, templateFields);
    } catch (err) {
      if (err instanceof ComplianceBatchXmlStructureError) {
        throw new ComplianceBatchValidationError(err.message);
      }
      throw err;
    }
  }
  // JSON
  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  try {
    return parseTransactionComplianceJson(text, servicesEnabled, templateFields);
  } catch (err) {
    if (err instanceof ComplianceBatchJsonStructureError) {
      throw new ComplianceBatchValidationError(err.message);
    }
    throw err;
  }
}

export class ComplianceBatchService {
  static async createTransactionComplianceBatch(
    accountId: string,
    userId: string | null,
    file: File,
    servicesEnabled: ComplianceBatchServiceFlags,
    requestId?: string,
    columnMappingTemplateId?: string | null
  ): Promise<CreateBatchResult> {
    const format = detectFormat(file.name);

    let templateFields: ColumnMappingTemplateFields | undefined;
    if (columnMappingTemplateId) {
      const template = await ComplianceBatchTemplateService.get(accountId, columnMappingTemplateId);
      if (!template) {
        throw new ComplianceBatchValidationError(`Column mapping template "${columnMappingTemplateId}" was not found.`);
      }
      templateFields = template.fieldMappings as ColumnMappingTemplateFields;
    }

    let stored;
    try {
      stored = await storeDocumentFile(file, file.name, "compliance-batches");
    } catch (err) {
      if (err instanceof StorageValidationError) {
        throw new ComplianceBatchValidationError(err.message);
      }
      throw err;
    }

    let parsed: ParsedBatchInput;
    try {
      parsed = await parseByFormat(format, file, servicesEnabled, templateFields);
    } catch (err) {
      if (err instanceof ComplianceBatchValidationError) throw err;
      throw new ComplianceBatchValidationError(err instanceof Error ? err.message : String(err));
    }

    if (parsed.records.length === 0) {
      throw new ComplianceBatchValidationError(
        "No valid records were found in the file.",
        parsed.invalidRows
      );
    }

    const correlationId = crypto.randomUUID();

    const batch = await db.$transaction(async (tx) => {
      const createdBatch = await tx.complianceBatch.create({
        data: {
          accountId,
          createdByUserId: userId,
          batchType: "TRANSACTION_COMPLIANCE",
          format,
          processingStatus: "READY",
          originalFileName: file.name,
          fileSha256: stored.checksum,
          servicesEnabled: servicesEnabled as unknown as object,
          correlationId,
          totalRecords: parsed.records.length + parsed.invalidRows.length,
          validRecords: parsed.records.length,
          errorRecords: parsed.invalidRows.length,
        },
      });

      await tx.batchArtifact.create({
        data: {
          accountId,
          batchId: createdBatch.id,
          artifactType: "INPUT",
          storageKey: stored.url,
          originalFileName: file.name,
          mimeType: file.type || DEFAULT_MIME_TYPE[format],
          sizeBytes: file.size,
          sha256: stored.checksum,
        },
      });

      await tx.batchRecord.createMany({
        data: parsed.records.map((record, i) => ({
          accountId,
          batchId: createdBatch.id,
          recordNumber: i + 1,
          sourceRowNumber: parsed.sourceRowNumbers[i],
          transactionId: record.transactionId ?? null,
          correlationId: record.correlationId,
          normalizedInput: record as unknown as object,
          inputHash: crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex"),
        })),
      });

      return createdBatch;
    });

    await createAuditLog({
      accountId,
      userId: userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_CREATED,
      entity: "ComplianceBatch",
      entityId: batch.id,
      source: "UI",
      metadata: { fileName: file.name, batchType: "TRANSACTION_COMPLIANCE", totalRecords: batch.totalRecords },
      requestId,
    });

    await generateValidationErrorsArtifact(accountId, batch.id, parsed.invalidRows);

    return { batch, invalidRows: parsed.invalidRows };
  }

  /** Bulk pre-approval upload (CSV only): each valid row becomes a BatchRecord that the dispatcher later feeds through createPreApproval() one at a time -- see processing.ts's PRE_APPROVED_PARTY_IMPORT branch. Never screens/re-screens anything itself. */
  static async createPreApprovedPartyImportBatch(
    accountId: string,
    userId: string | null,
    file: File,
    requestId?: string
  ): Promise<CreateBatchResult> {
    const format = detectFormat(file.name);
    if (format !== "CSV") {
      throw new ComplianceBatchValidationError("Bulk pre-approval import only supports CSV files.");
    }

    let stored;
    try {
      stored = await storeDocumentFile(file, file.name, "compliance-batches");
    } catch (err) {
      if (err instanceof StorageValidationError) {
        throw new ComplianceBatchValidationError(err.message);
      }
      throw err;
    }

    const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    let parsed: ParsedPreApprovedPartyImportInput;
    try {
      parsed = parsePreApprovedPartyImportCsv(text);
    } catch (err) {
      throw new ComplianceBatchValidationError(err instanceof Error ? err.message : String(err));
    }

    if (parsed.records.length === 0) {
      throw new ComplianceBatchValidationError("No valid rows were found in the file.", parsed.invalidRows);
    }

    const correlationId = crypto.randomUUID();

    const batch = await db.$transaction(async (tx) => {
      const createdBatch = await tx.complianceBatch.create({
        data: {
          accountId,
          createdByUserId: userId,
          batchType: "PRE_APPROVED_PARTY_IMPORT",
          format,
          processingStatus: "READY",
          originalFileName: file.name,
          fileSha256: stored.checksum,
          servicesEnabled: {} as unknown as object,
          correlationId,
          totalRecords: parsed.records.length + parsed.invalidRows.length,
          validRecords: parsed.records.length,
          errorRecords: parsed.invalidRows.length,
        },
      });

      await tx.batchArtifact.create({
        data: {
          accountId,
          batchId: createdBatch.id,
          artifactType: "INPUT",
          storageKey: stored.url,
          originalFileName: file.name,
          mimeType: file.type || DEFAULT_MIME_TYPE[format],
          sizeBytes: file.size,
          sha256: stored.checksum,
        },
      });

      await tx.batchRecord.createMany({
        data: parsed.records.map((record, i) => ({
          accountId,
          batchId: createdBatch.id,
          recordNumber: i + 1,
          sourceRowNumber: parsed.sourceRowNumbers[i],
          partyId: record.partyId,
          correlationId: crypto.randomUUID(),
          normalizedInput: record as unknown as object,
          inputHash: crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex"),
        })),
      });

      return createdBatch;
    });

    await createAuditLog({
      accountId,
      userId: userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_CREATED,
      entity: "ComplianceBatch",
      entityId: batch.id,
      source: "UI",
      metadata: { fileName: file.name, batchType: "PRE_APPROVED_PARTY_IMPORT", totalRecords: batch.totalRecords },
      requestId,
    });

    await generateValidationErrorsArtifact(accountId, batch.id, parsed.invalidRows);

    return { batch, invalidRows: parsed.invalidRows };
  }

  static async getBatch(accountId: string, batchId: string) {
    return db.complianceBatch.findFirst({ where: { id: batchId, accountId } });
  }

  static async listBatches(
    accountId: string,
    params: { page?: number; pageSize?: number; status?: string; batchType?: string; search?: string } = {}
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);

    const where = {
      accountId,
      ...(params.status ? { processingStatus: params.status as never } : {}),
      ...(params.batchType ? { batchType: params.batchType as never } : {}),
      ...(params.search ? { originalFileName: { contains: params.search, mode: "insensitive" as const } } : {}),
    };

    const [total, batches] = await Promise.all([
      db.complianceBatch.count({ where }),
      db.complianceBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { batches, total, page, pageSize };
  }

  static async listRecords(
    accountId: string,
    batchId: string,
    params: { page?: number; pageSize?: number } = {}
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 200);

    const where = { accountId, batchId };
    const [total, records] = await Promise.all([
      db.batchRecord.count({ where }),
      db.batchRecord.findMany({
        where,
        orderBy: { recordNumber: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { records, total, page, pageSize };
  }

  static async listArtifacts(accountId: string, batchId: string) {
    return db.batchArtifact.findMany({ where: { accountId, batchId }, orderBy: { createdAt: "asc" } });
  }

  /** Marks a not-yet-terminal batch CANCELLED. The dispatcher only claims records whose parent batch is PROCESSING, so this alone stops further record processing -- already-claimed/in-flight records still finish. */
  static async cancelBatch(accountId: string, batchId: string, userId: string | null, requestId?: string) {
    const batch = await db.complianceBatch.findFirst({ where: { id: batchId, accountId } });
    if (!batch) return null;
    if (TERMINAL_STATUSES.has(batch.processingStatus)) {
      throw new ComplianceBatchStateError(`Batch is already ${batch.processingStatus} and cannot be cancelled.`);
    }

    const updated = await db.complianceBatch.update({
      where: { id: batchId },
      data: { processingStatus: "CANCELLED", completedAt: new Date() },
    });

    await createAuditLog({
      accountId,
      userId: userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_CANCELLED,
      entity: "ComplianceBatch",
      entityId: batchId,
      source: "UI",
      requestId,
    });

    return updated;
  }

  /** Requeues a batch's ERROR records back to PENDING and moves the batch back to PROCESSING so the dispatcher picks it up on its next tick. */
  static async retryBatch(accountId: string, batchId: string, userId: string | null, requestId?: string) {
    const batch = await db.complianceBatch.findFirst({ where: { id: batchId, accountId } });
    if (!batch) return null;
    if (batch.processingStatus !== "COMPLETED" && batch.processingStatus !== "FAILED") {
      throw new ComplianceBatchStateError(
        `Batch must be COMPLETED or FAILED to retry, current status is ${batch.processingStatus}.`
      );
    }

    const requeued = await db.batchRecord.updateMany({
      where: { accountId, batchId, processingStatus: "ERROR" },
      data: { processingStatus: "PENDING", errorCode: null, errorMessage: null, startedAt: null, completedAt: null },
    });

    if (requeued.count === 0) {
      throw new ComplianceBatchStateError("Batch has no ERROR records to retry.");
    }

    const updated = await db.complianceBatch.update({
      where: { id: batchId },
      data: { processingStatus: "PROCESSING", completedAt: null, errorRecords: { decrement: requeued.count } },
    });

    await createAuditLog({
      accountId,
      userId: userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_RETRIED,
      entity: "ComplianceBatch",
      entityId: batchId,
      source: "UI",
      metadata: { requeuedCount: requeued.count },
      requestId,
    });

    return updated;
  }

  /** Requeues every record (not just ERROR ones) back to PENDING for a full re-screen -- unlike retry(), this discards prior canonical result links so the dispatcher produces a fresh determination for each row. */
  static async rescreenBatch(accountId: string, batchId: string, userId: string | null, requestId?: string) {
    const batch = await db.complianceBatch.findFirst({ where: { id: batchId, accountId } });
    if (!batch) return null;
    if (batch.processingStatus !== "COMPLETED" && batch.processingStatus !== "FAILED") {
      throw new ComplianceBatchStateError(
        `Batch must be COMPLETED or FAILED to rescreen, current status is ${batch.processingStatus}.`
      );
    }

    const requeued = await db.batchRecord.updateMany({
      where: { accountId, batchId, parseStatus: "VALID" },
      data: {
        processingStatus: "PENDING",
        complianceStatus: "NOT_EVALUATED",
        rpsResultId: null,
        licenseDeterminationResultId: null,
        embargoStatus: null,
        embargoEvidence: Prisma.JsonNull,
        classificationStatus: null,
        classificationHtsCode: null,
        classificationAgentDecisionId: null,
        rpsComplianceExecutionId: null,
        licenseComplianceExecutionId: null,
        embargoComplianceExecutionId: null,
        classificationComplianceExecutionId: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
    });

    const updated = await db.complianceBatch.update({
      where: { id: batchId },
      data: {
        processingStatus: "PROCESSING",
        complianceStatus: "NOT_EVALUATED",
        completedAt: null,
        processedRecords: 0,
        passedRecords: 0,
        failedRecords: 0,
        reviewRecords: 0,
        incompleteRecords: 0,
        errorRecords: 0,
      },
    });

    await createAuditLog({
      accountId,
      userId: userId ?? undefined,
      action: AuditAction.COMPLIANCE_BATCH_RESCREENED,
      entity: "ComplianceBatch",
      entityId: batchId,
      source: "UI",
      metadata: { requeuedCount: requeued.count },
      requestId,
    });

    return updated;
  }
}

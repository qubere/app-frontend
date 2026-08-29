/**
 * Customs-app storage surface.
 *
 * The object-storage core (GCS / Vercel Blob / local-fs, origin allowlisting,
 * signed URLs, artifact store) lives in `@qubere/storage` and is shared with the
 * portal and the `@qubere/db` upload service. This module keeps only the
 * customs-app upload wrapper: the customer-facing MIME allowlist plus the
 * malware scan and third-party call logging that wrap it.
 */
import { createHash } from "crypto";
import { logThirdPartyCall } from "@/lib/api/thirdPartyLogger";
import { MalwareScanner } from "@/lib/security/malwareScanner";
import {
  MAX_UPLOAD_BYTES,
  StorageValidationError,
  storeDocumentBytes,
  type StorageUploadResult,
} from "@qubere/storage";

export {
  MAX_UPLOAD_BYTES,
  StorageValidationError,
  StorageObjectReadError,
  storeDocumentBytes,
  storeGeneratedFile,
  storeProcessingArtifact,
  readProcessingArtifact,
  readStoredObject,
  writeRemoteObject,
  deleteStoredObject,
  createSignedReadUrl,
  resolveStorageOrigin,
  resolveLocalFilePath,
  parseGcsObjectUrl,
  assertQubereStorageUrl,
  selectedRemoteProvider,
  isServerlessHost,
} from "@qubere/storage";
export type {
  StorageUploadResult,
  StoredObject,
  StorageProvider,
  RemoteStorageOrigin,
} from "@qubere/storage";

// QPR-004: Allowlisted MIME types for customs document uploads.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/tiff",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
]);

/**
 * Validates a customer-uploaded trade document (MIME allowlist, size cap,
 * malware signature scan), then persists the immutable original to durable
 * object storage via the shared core. Bytes never touch Postgres.
 */
export async function storeDocumentFile(
  file: File,
  filename: string,
  folder: string = "documents"
): Promise<StorageUploadResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new StorageValidationError(
      "MIME_TYPE_NOT_ALLOWED",
      `File type "${file.type}" is not allowed. Accepted types: ${[...ALLOWED_MIME_TYPES].join(", ")}`
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new StorageValidationError(
      "FILE_TOO_LARGE",
      `File size ${file.size} bytes exceeds the maximum allowed ${MAX_UPLOAD_BYTES} bytes (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const scanResult = MalwareScanner.scan(buffer, filename);
  if (!scanResult.safe) {
    throw new StorageValidationError(
      "MIME_TYPE_NOT_ALLOWED",
      `Malware security check failed for file "${filename}": ${scanResult.reason}`
    );
  }

  const startTime = Date.now();
  try {
    const stored = await storeDocumentBytes({
      buffer,
      fileName: filename,
      contentType: file.type || "application/octet-stream",
      folder,
    });
    if (stored.provider !== "local-fs") {
      void logThirdPartyCall({
        provider: stored.provider === "gcs" ? "GOOGLE_CLOUD_STORAGE" : "VERCEL_BLOB_STORAGE",
        url: stored.url,
        method: "PUT",
        status: 200,
        statusText: "OK",
        durationMs: Date.now() - startTime,
        metadata: `size=${file.size}B`,
      });
    }
    return { ...stored, filename };
  } catch (err: unknown) {
    void logThirdPartyCall({
      provider: "GOOGLE_CLOUD_STORAGE",
      url: `${folder}/${filename}`,
      method: "PUT",
      durationMs: Date.now() - startTime,
      error: err,
      metadata: `size=${file.size}B`,
    });
    throw err;
  }
}

/** Kept for callers that only need the content hash without storing. */
export function checksumOf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

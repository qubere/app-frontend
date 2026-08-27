import { Storage } from "@google-cloud/storage";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { logThirdPartyCall, thirdPartyFetch } from "@/lib/api/thirdPartyLogger";

// QPR-004: Allowlisted MIME types for customs document uploads.
// Only structured document formats acceptable for trade records.
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

// QPR-004: Configurable file size limit (default 50 MB).
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES ?? "", 10) || 50 * 1024 * 1024;

/**
 * Hostnames whose objects may be fetched server-side with storage credentials.
 * Matched on the parsed hostname, never on raw substrings of the URL.
 */
const ALLOWED_STORAGE_HOSTS = [
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
  "storage.qubere.ai",
];

export type RemoteStorageOrigin = "vercel-blob" | "gcs";
export type StorageProvider = RemoteStorageOrigin | "local-fs";

let gcsClient: Storage | null = null;

function selectedRemoteProvider(): RemoteStorageOrigin | null {
  const explicit = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "gcs") {
    if (!(process.env.GCS_BUCKET ?? "").trim()) {
      throw new Error("[Storage] GCS_BUCKET must be set when STORAGE_PROVIDER=gcs.");
    }
    return "gcs";
  }
  if (explicit === "vercel-blob") {
    if (!(process.env.BLOB_READ_WRITE_TOKEN ?? "").trim()) {
      throw new Error(
        "[Storage] BLOB_READ_WRITE_TOKEN must be set when STORAGE_PROVIDER=vercel-blob."
      );
    }
    return "vercel-blob";
  }
  if (explicit && explicit !== "local-fs") {
    throw new Error(`[Storage] Unsupported STORAGE_PROVIDER "${explicit}".`);
  }
  if (explicit === "local-fs") return null;

  // Backwards compatibility for the existing Vercel deployment: it can keep
  // using the token without adding STORAGE_PROVIDER. GCP must opt in explicitly
  // so merely knowing a bucket name can never switch the active write backend.
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return null;
}

function gcsBucketName(): string {
  const bucket = (process.env.GCS_BUCKET ?? "").trim();
  if (!bucket) throw new Error("[Storage] GCS_BUCKET is not configured.");
  return bucket;
}

function storageClient(): Storage {
  gcsClient ??= new Storage();
  return gcsClient;
}

function encodeObjectPath(objectPath: string): string {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function gcsObjectUrl(bucket: string, objectPath: string): string {
  return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
}

function parseGcsObjectUrl(fileUrl: string): { bucket: string; objectPath: string } {
  const parsed = new URL(fileUrl);
  if (parsed.hostname.toLowerCase() !== "storage.googleapis.com") {
    throw new StorageValidationError(
      "UNTRUSTED_STORAGE_ORIGIN",
      "Cloud Storage objects must use the storage.googleapis.com endpoint."
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [bucket, ...objectSegments] = segments;
  const expectedBucket = gcsBucketName();
  if (!bucket || bucket !== expectedBucket || objectSegments.length === 0) {
    throw new StorageValidationError(
      "UNTRUSTED_STORAGE_ORIGIN",
      "Cloud Storage URL does not point to the configured Qubere bucket."
    );
  }

  return { bucket, objectPath: objectSegments.join("/") };
}

/**
 * Resolves a local document reference (e.g. "/uploads/...", "file://...", or a filename)
 * to a verified absolute file path within allowed local storage directories.
 * Returns null if the file does not exist or attempts path traversal outside allowed roots.
 */
export function resolveLocalFilePath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const fileName = path.basename(fileUrl.startsWith("file://") ? fileUrl.slice(7) : fileUrl);
  if (!fileName || fileName === "." || fileName === "..") return null;

  const allowedDirs = [
    path.join(process.cwd(), ".qubere", "storage", "uploads"),
    path.join(process.cwd(), "public", "uploads"),
    path.join(os.tmpdir(), "uploads"),
  ];

  for (const dir of allowedDirs) {
    const candidate = path.resolve(dir, fileName);
    if (
      candidate.startsWith(dir + path.sep) &&
      fs.existsSync(/* turbopackIgnore: true */ candidate)
    ) {
      return candidate;
    }
  }

  if (fileUrl.startsWith("file://")) {
    const rawPath = path.resolve(fileUrl.slice(7));
    for (const dir of allowedDirs) {
      if (rawPath.startsWith(dir + path.sep) && fs.existsSync(rawPath)) {
        return rawPath;
      }
    }
  }

  return null;
}

/**
 * Resolves a stored file URL to a trusted remote storage origin.
 *
 * Returns `null` for values that are not remote allowlisted objects (for example
 * local `/uploads/...` paths or `file://...` paths), and throws for anything that
 * looks remote but is not allowlisted. Credentials must only ever be attached when
 * this returns a non-null origin.
 */
export function resolveStorageOrigin(fileUrl: string): RemoteStorageOrigin | null {
  if (fileUrl.startsWith("/")) return null;

  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    throw new StorageValidationError("UNTRUSTED_STORAGE_ORIGIN", `Malformed storage URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new StorageValidationError("UNTRUSTED_STORAGE_ORIGIN", `Storage URL must use https.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "storage.googleapis.com") {
    parseGcsObjectUrl(fileUrl);
    return "gcs";
  }
  const isAllowed = ALLOWED_STORAGE_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );

  if (!isAllowed) {
    throw new StorageValidationError(
      "UNTRUSTED_STORAGE_ORIGIN",
      `Storage host "${host}" is not an allowlisted storage origin.`
    );
  }

  return "vercel-blob";
}

export interface StorageUploadResult {
  url: string;
  filename: string;
  size: number;
  /** SHA-256 hex digest of the file content for integrity verification. */
  checksum: string;
  provider: StorageProvider;
}

export interface StoredObject {
  body: Buffer;
  contentType: string | null;
}

export class StorageObjectReadError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "StorageObjectReadError";
  }
}

async function writeGcsObject(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const bucket = gcsBucketName();
  const file = storageClient().bucket(bucket).file(objectPath);
  await file.save(body, {
    resumable: false,
    contentType,
    metadata: { cacheControl: "private, no-store" },
  });
  return gcsObjectUrl(bucket, objectPath);
}

async function readGcsObject(fileUrl: string): Promise<StoredObject> {
  const { bucket, objectPath } = parseGcsObjectUrl(fileUrl);
  const file = storageClient().bucket(bucket).file(objectPath);
  try {
    const [[body], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return {
      body,
      contentType: typeof metadata.contentType === "string" ? metadata.contentType : null,
    };
  } catch (error) {
    const status = typeof (error as { code?: unknown }).code === "number"
      ? (error as { code: number }).code
      : 500;
    throw new StorageObjectReadError(
      `[Storage] Failed to read Cloud Storage object (HTTP ${status}).`,
      status === 408 || status === 429 || status >= 500
    );
  }
}

async function writeRemoteObject(params: {
  objectPath: string;
  body: Buffer;
  contentType: string;
  allowOverwrite?: boolean;
}): Promise<{ url: string; provider: RemoteStorageOrigin }> {
  const provider = selectedRemoteProvider();
  if (provider === "gcs") {
    return {
      url: await writeGcsObject(params.objectPath, params.body, params.contentType),
      provider,
    };
  }
  if (provider === "vercel-blob") {
    const blob = await put(params.objectPath, params.body, {
      access: "private",
      contentType: params.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: params.allowOverwrite ?? false,
    });
    return { url: blob.url, provider };
  }
  throw new Error("[Storage] No durable remote storage provider is configured.");
}

/** Reads a trusted remote object with provider-appropriate credentials. */
export async function readStoredObject(fileUrl: string): Promise<StoredObject> {
  const origin = resolveStorageOrigin(fileUrl);
  if (origin === null) {
    const localPath = resolveLocalFilePath(fileUrl);
    if (!localPath) {
      throw new StorageObjectReadError("[Storage] Local object was not found.", false);
    }
    return {
      body: fs.readFileSync(/* turbopackIgnore: true */ localPath),
      contentType: null,
    };
  }
  if (origin === "gcs") return readGcsObject(fileUrl);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const response = await thirdPartyFetch("VERCEL_BLOB_STORAGE", fileUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!response.ok) {
    throw new StorageObjectReadError(
      `[Storage] Failed to read object (HTTP ${response.status}).`,
      response.status === 408 || response.status === 429 || response.status >= 500
    );
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

/** Creates a short-lived provider URL for parsers configured for URL delivery. */
export async function createSignedReadUrl(fileUrl: string, expiresAt: Date): Promise<string> {
  const origin = resolveStorageOrigin(fileUrl);
  if (origin === "gcs") {
    const { bucket, objectPath } = parseGcsObjectUrl(fileUrl);
    const [signedUrl] = await storageClient().bucket(bucket).file(objectPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });
    return signedUrl;
  }
  if (origin === "vercel-blob") return fileUrl;
  throw new StorageValidationError(
    "UNTRUSTED_STORAGE_ORIGIN",
    "Local files cannot be shared with a remote parser."
  );
}

/**
 * Asserts that a URL points at Qubere-controlled object storage.
 *
 * Call this before handing any URL to an external parser. Passing a
 * client-supplied URL to a provider that will fetch it makes the provider a
 * confused deputy, so the only URLs allowed out are ones Qubere minted against
 * its own allowlisted storage hosts.
 */
export function assertQubereStorageUrl(fileUrl: string): void {
  const origin = resolveStorageOrigin(fileUrl);
  if (origin === null) {
    throw new StorageValidationError(
      "UNTRUSTED_STORAGE_ORIGIN",
      "Only an absolute Qubere object-storage URL may be handed to an external parser."
    );
  }
}

export class StorageValidationError extends Error {
  constructor(
    public readonly code:
      | "MIME_TYPE_NOT_ALLOWED"
      | "FILE_TOO_LARGE"
      | "UNTRUSTED_STORAGE_ORIGIN",
    message: string
  ) {
    super(message);
    this.name = "StorageValidationError";
  }
}

/**
 * Writes a derived processing artifact (parser JSON, Markdown, table HTML, a
 * quality report) to object storage under a tenant/document/run path, so one
 * tenant's artifacts are never colocated with another's and a run's outputs can
 * be enumerated or lifecycled as a unit.
 *
 * Separate from `storeDocumentFile` on purpose: that function enforces the
 * upload MIME allowlist, which describes what a *customer* may upload and has
 * nothing to say about what Qubere itself generates.
 */
export async function storeProcessingArtifact(params: {
  accountId: string;
  documentId: string;
  processingRunId: string;
  /** Short artifact name, e.g. "docling.json". Sanitised before use. */
  name: string;
  contentType: string;
  body: Buffer;
}): Promise<StorageUploadResult> {
  const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  const objectPath = [
    "processing",
    safeSegment(params.accountId),
    safeSegment(params.documentId),
    safeSegment(params.processingRunId),
    safeSegment(params.name),
  ].join("/");

  const checksum = createHash("sha256").update(params.body).digest("hex");
  const provider = selectedRemoteProvider();

  if (provider) {
    const stored = await writeRemoteObject({
      objectPath,
      body: params.body,
      contentType: params.contentType,
      // Artifact paths are already unique per run.
      allowOverwrite: true,
    });
    return {
      url: stored.url,
      filename: params.name,
      size: params.body.byteLength,
      checksum,
      provider: stored.provider,
    };
  }

  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.cwd().startsWith("/var/task")
  );
  if (isServerless) {
    throw new Error(
      "[Storage] Durable object storage is required to persist processing artifacts in a serverless environment."
    );
  }

  // Local development: artifacts are kept outside `public/` because, unlike an
  // uploaded document, they are not served through the tenant-scoped proxy.
  const artifactRoot = path.join(process.cwd(), ".qubere", "artifacts");
  const target = path.join(artifactRoot, objectPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, params.body);

  return {
    url: `file://${target}`,
    filename: params.name,
    size: params.body.byteLength,
    checksum,
    provider: "local-fs",
  };
}

/** Reads back an artifact previously written by `storeProcessingArtifact`. */
export async function readProcessingArtifact(storageRef: string): Promise<Buffer> {
  if (storageRef.startsWith("file://")) {
    const localPath = storageRef.slice("file://".length);
    const artifactRoot = path.join(process.cwd(), ".qubere", "artifacts");
    const resolved = path.resolve(localPath);
    // Confine reads to the artifact root so a tampered storage reference cannot
    // turn this into an arbitrary file read.
    if (!resolved.startsWith(artifactRoot + path.sep)) {
      throw new StorageValidationError(
        "UNTRUSTED_STORAGE_ORIGIN",
        "Artifact reference points outside the artifact store."
      );
    }
    return fs.readFileSync(resolved);
  }

  return (await readStoredObject(storageRef)).body;
}

/** Stores an application-generated export using the configured provider. */
export async function storeGeneratedFile(params: {
  objectPath: string;
  filename: string;
  contentType: string;
  body: Buffer;
}): Promise<StorageUploadResult> {
  const checksum = createHash("sha256").update(params.body).digest("hex");
  const stored = await writeRemoteObject({
    objectPath: params.objectPath,
    body: params.body,
    contentType: params.contentType,
  });
  return {
    url: stored.url,
    filename: params.filename,
    size: params.body.byteLength,
    checksum,
    provider: stored.provider,
  };
}

import { MalwareScanner } from "@/lib/security/malwareScanner";

export async function storeDocumentFile(
  file: File,
  filename: string,
  folder: string = "documents"
): Promise<StorageUploadResult> {
  // QPR-004: Enforce MIME type allowlist before doing anything with the file.
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new StorageValidationError(
      "MIME_TYPE_NOT_ALLOWED",
      `File type "${file.type}" is not allowed. Accepted types: ${[...ALLOWED_MIME_TYPES].join(", ")}`
    );
  }

  // QPR-004: Enforce file size limit.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new StorageValidationError(
      "FILE_TOO_LARGE",
      `File size ${file.size} bytes exceeds the maximum allowed ${MAX_UPLOAD_BYTES} bytes (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Security: Malware signature and binary executable header scan
  const scanResult = MalwareScanner.scan(buffer, filename);
  if (!scanResult.safe) {
    throw new StorageValidationError(
      "MIME_TYPE_NOT_ALLOWED",
      `Malware security check failed for file "${filename}": ${scanResult.reason}`
    );
  }

  // QPR-004: Compute SHA-256 checksum for integrity verification and duplicate detection.
  const checksum = createHash("sha256").update(buffer).digest("hex");

  const provider = selectedRemoteProvider();
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.K_SERVICE ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.cwd().startsWith("/var/task")
  );

  const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  // Durable remote provider: GCS on Cloud Run, Vercel Blob on the existing host.
  if (provider) {
    const startTime = Date.now();
    try {
      const stored = await writeRemoteObject({
        objectPath: `${folder}/${safeFilename}`,
        body: buffer,
        contentType: file.type || "application/octet-stream",
      });
      const durationMs = Date.now() - startTime;
      void logThirdPartyCall({
        provider: stored.provider === "gcs" ? "GOOGLE_CLOUD_STORAGE" : "VERCEL_BLOB_STORAGE",
        url: stored.url,
        method: "PUT",
        status: 200,
        statusText: "OK",
        durationMs,
        metadata: `size=${file.size}B`,
      });

      return {
        url: stored.url,
        filename,
        size: file.size,
        checksum,
        provider: stored.provider,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      void logThirdPartyCall({
        provider: provider === "gcs" ? "GOOGLE_CLOUD_STORAGE" : "VERCEL_BLOB_STORAGE",
        url: `${folder}/${safeFilename}`,
        method: "PUT",
        durationMs,
        error: err,
        metadata: `size=${file.size}B`,
      });
      console.error(`[Storage] ${provider} upload failed:`, err);
      if (isServerless) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[Storage] ${provider} upload failed: ${message}`);
      }
    }
  } else if (isServerless) {
    throw new Error("[Storage] No durable object storage provider is configured.");
  }

  // Provider 2: Local Filesystem Storage (For local development ONLY)
  // Store originals outside public/ under .qubere/storage/uploads to prevent direct static access
  const uploadDir = path.join(process.cwd(), ".qubere", "storage", "uploads");
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, safeFilename);
    fs.writeFileSync(filePath, buffer);
    const localRefUrl = `/uploads/${safeFilename}`;

    console.log(`[Storage] Saved ${filename} locally at ${localRefUrl} (path: ${filePath}) sha256=${checksum}`);

    return {
      url: localRefUrl,
      filename,
      size: file.size,
      checksum,
      provider: "local-fs",
    };
  } catch (err: unknown) {
    try {
      const tmpDir = path.join(os.tmpdir(), "uploads");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpFilePath = path.join(tmpDir, safeFilename);
      fs.writeFileSync(tmpFilePath, buffer);
      console.log(`[Storage] Saved ${filename} to /tmp/uploads fallback`);
      return {
        url: `/uploads/${safeFilename}`,
        filename,
        size: file.size,
        checksum,
        provider: "local-fs",
      };
    } catch (tmpErr) {
      console.error("[Storage] Filesystem write error:", err, tmpErr);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[Storage] Failed to persist file "${filename}" to local storage. ${message}`);
    }
  }
}

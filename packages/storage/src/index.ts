/**
 * @qubere/storage — shared object-storage core for Qubere apps.
 *
 * One implementation of "where a document's bytes live" for the customs app, the
 * customer portal, and the shared upload service in @qubere/db. Google Cloud
 * Storage in production (Cloud Run), Vercel Blob where that is configured, and
 * local disk ONLY for localhost development.
 *
 * Never store document bytes in Postgres. A ShipmentDocument row carries a
 * `fileUrl` pointer (and, separately, extracted/parsed text) — not the file.
 */
import { Storage } from "@google-cloud/storage";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

/** Configurable file size limit (default 50 MB). */
export const MAX_UPLOAD_BYTES =
  parseInt(process.env.MAX_UPLOAD_BYTES ?? "", 10) || 50 * 1024 * 1024;

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

export class StorageObjectReadError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "StorageObjectReadError";
  }
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

let gcsClient: Storage | null = null;

export function selectedRemoteProvider(): RemoteStorageOrigin | null {
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

  // Default to GCS when running on GCP Cloud Run or GCS_BUCKET is configured.
  if ((process.env.GCS_BUCKET ?? "").trim()) return "gcs";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return null;
}

/** True on GCP Cloud Run / Lambda-style hosts where local disk is not durable. */
export function isServerlessHost(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GCP_PROJECT ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.cwd().startsWith("/var/task")
  );
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

export function parseGcsObjectUrl(fileUrl: string): { bucket: string; objectPath: string } {
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
 * Resolves a local document reference ("/uploads/...", "file://...", or a bare
 * filename) to a verified absolute path inside an allowed local upload dir.
 * Returns null if the file does not exist or the name attempts traversal.
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
    if (candidate.startsWith(dir + path.sep) && fs.existsSync(/* turbopackIgnore: true */ candidate)) {
      return candidate;
    }
  }

  if (fileUrl.startsWith("file://")) {
    const rawPath = path.resolve(fileUrl.slice(7));
    for (const dir of allowedDirs) {
      if (rawPath.startsWith(dir + path.sep) && fs.existsSync(/* turbopackIgnore: true */ rawPath)) {
        return rawPath;
      }
    }
  }

  return null;
}

/**
 * Resolves a stored file URL to a trusted remote storage origin.
 *
 * Returns `null` for values that are not remote allowlisted objects (local
 * `/uploads/...` or `file://...` paths), and throws for anything that looks
 * remote but is not allowlisted. Credentials must only ever be attached when
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
    const status =
      typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : 500;
    throw new StorageObjectReadError(
      `[Storage] Failed to read Cloud Storage object (HTTP ${status}).`,
      status === 408 || status === 429 || status >= 500
    );
  }
}

export async function writeRemoteObject(params: {
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
    return { body: fs.readFileSync(/* turbopackIgnore: true */ localPath), contentType: null };
  }
  if (origin === "gcs") return readGcsObject(fileUrl);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  // No Next fetch-cache: this is a credentialed, per-document read in a route
  // handler. `next: { revalidate: 0 }` is typed on the global fetch in every
  // consumer; the bare RequestInit in this package's lib does not carry it.
  const response = await fetch(fileUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...({ cache: "no-store" } as object),
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

/**
 * Best-effort deletion of a stored object. Never throws — callers use this for
 * cleanup after the owning DB row is gone, where a failed delete just leaves an
 * orphan (GCS lifecycle / soft-delete handles the rest).
 */
export async function deleteStoredObject(fileUrl: string): Promise<boolean> {
  try {
    const origin = resolveStorageOrigin(fileUrl);
    if (origin === null) {
      const localPath = resolveLocalFilePath(fileUrl);
      if (localPath) fs.rmSync(/* turbopackIgnore: true */ localPath, { force: true });
      return true;
    }
    if (origin === "gcs") {
      const { objectPath } = parseGcsObjectUrl(fileUrl);
      await storageClient().bucket(gcsBucketName()).file(objectPath).delete({ ignoreNotFound: true });
      return true;
    }
    // vercel-blob
    const { del } = await import("@vercel/blob");
    await del(fileUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  } catch (err) {
    console.error("[Storage] deleteStoredObject failed (ignored):", fileUrl, err);
    return false;
  }
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
 * Asserts that a URL points at Qubere-controlled object storage. Call this
 * before handing any URL to an external parser so the parser cannot be turned
 * into a confused deputy against an arbitrary host.
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

const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);

/**
 * Persists the immutable original bytes of an uploaded document.
 *
 * Durable remote storage (GCS / Vercel Blob) when configured; otherwise local
 * disk under `.qubere/storage/uploads` for localhost development only — which
 * throws on a serverless host, because ephemeral per-instance disk would lose
 * the file. Returns a `fileUrl` to persist on the document row. The bytes are
 * never written to Postgres.
 */
export async function storeDocumentBytes(params: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  /** Object-path prefix, e.g. `portal/<accountId>`. Sanitised. */
  folder?: string;
}): Promise<StorageUploadResult> {
  const { buffer, fileName, contentType } = params;
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("[Storage] Cannot store an empty document.");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new StorageValidationError(
      "FILE_TOO_LARGE",
      `File size ${buffer.byteLength} exceeds the maximum ${MAX_UPLOAD_BYTES} bytes.`
    );
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const folder = (params.folder ? params.folder.split("/").map(safeSegment).filter(Boolean).join("/") : "documents") || "documents";
  const safeName = `${checksum.slice(0, 12)}-${safeSegment(path.basename(fileName) || "document")}`;
  const objectPath = `${folder}/${safeName}`;

  const provider = selectedRemoteProvider();
  if (provider) {
    const stored = await writeRemoteObject({ objectPath, body: buffer, contentType });
    return {
      url: stored.url,
      filename: fileName,
      size: buffer.byteLength,
      checksum,
      provider: stored.provider,
    };
  }

  if (isServerlessHost()) {
    throw new Error(
      "[Storage] No durable object-storage provider is configured (set GCS_BUCKET or BLOB_READ_WRITE_TOKEN)."
    );
  }

  // localhost development only.
  const uploadDir = path.join(process.cwd(), ".qubere", "storage", "uploads");
  fs.mkdirSync(/* turbopackIgnore: true */ uploadDir, { recursive: true });
  fs.writeFileSync(/* turbopackIgnore: true */ path.join(uploadDir, safeName), buffer);
  return {
    url: `/uploads/${safeName}`,
    filename: fileName,
    size: buffer.byteLength,
    checksum,
    provider: "local-fs",
  };
}

/** Stores an application-generated export (PDF, CSV, …) using the configured provider. */
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

/**
 * Writes a derived processing artifact (parser JSON, Markdown, quality report)
 * under a tenant/document/run path.
 */
export async function storeProcessingArtifact(params: {
  accountId: string;
  documentId: string;
  processingRunId: string;
  name: string;
  contentType: string;
  body: Buffer;
}): Promise<StorageUploadResult> {
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

  if (isServerlessHost()) {
    throw new Error(
      "[Storage] Durable object storage is required to persist processing artifacts in a serverless environment."
    );
  }

  const artifactRoot = path.join(process.cwd(), ".qubere", "artifacts");
  const target = path.join(artifactRoot, objectPath);
  fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(target), { recursive: true });
  fs.writeFileSync(/* turbopackIgnore: true */ target, params.body);

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
    if (!resolved.startsWith(artifactRoot + path.sep)) {
      throw new StorageValidationError(
        "UNTRUSTED_STORAGE_ORIGIN",
        "Artifact reference points outside the artifact store."
      );
    }
    return fs.readFileSync(/* turbopackIgnore: true */ resolved);
  }
  return (await readStoredObject(storageRef)).body;
}

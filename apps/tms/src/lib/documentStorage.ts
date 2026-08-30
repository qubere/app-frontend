import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let gcs: Storage | undefined;

export function safeDocumentFileName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180) || "freight-document";
}

function bucketName(): string {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) throw new Error("GCS_BUCKET is required for Cloud Storage.");
  return bucket;
}

/** Cloud Storage when a bucket is configured (and STORAGE_PROVIDER isn't forced local); otherwise local disk. */
function useGcs(): boolean {
  const explicit = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (explicit === "local-fs") return false;
  return explicit === "gcs" || Boolean(process.env.GCS_BUCKET?.trim());
}

export async function storeTmsDocument(input: {
  accountId: string; storageName: string; mimeType: string; bytes: Buffer;
}): Promise<{ url: string; provider: "GCS" | "LOCAL_DEV" }> {
  const objectName = `tms/documents/${input.accountId}/${input.storageName}`;
  if (useGcs()) {
    const bucket = bucketName();
    gcs ??= new Storage();
    await gcs.bucket(bucket).file(objectName).save(input.bytes, {
      resumable: false, contentType: input.mimeType, metadata: { cacheControl: "private, no-store" },
    });
    return { url: `gs://${bucket}/${objectName}`, provider: "GCS" };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Durable document storage is not configured (set GCS_BUCKET).");
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, input.storageName), input.bytes, { flag: "wx" });
  return { url: `/uploads/${input.storageName}`, provider: "LOCAL_DEV" };
}

export async function readTmsDocument(fileUrl: string): Promise<{ body: Buffer; contentType: string | null }> {
  if (fileUrl.startsWith("gs://")) {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(fileUrl);
    if (!match || match[1] !== bucketName()) throw new Error("Untrusted Cloud Storage object.");
    gcs ??= new Storage();
    const file = gcs.bucket(match[1]).file(match[2]);
    const [[body], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return { body, contentType: typeof metadata.contentType === "string" ? metadata.contentType : null };
  }
  const fileName = path.basename(fileUrl);
  if (!fileName || fileName === "." || fileName === "..") throw new Error("Invalid local document path.");
  const root = path.resolve(process.cwd(), "public", "uploads");
  const target = path.resolve(root, fileName);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid local document path.");
  return { body: await readFile(target), contentType: null };
}

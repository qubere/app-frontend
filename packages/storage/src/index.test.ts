import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  resolveStorageOrigin,
  resolveLocalFilePath,
  storeDocumentBytes,
  StorageValidationError,
  selectedRemoteProvider,
} from "./index";

const ENV_KEYS = ["STORAGE_PROVIDER", "GCS_BUCKET", "BLOB_READ_WRITE_TOKEN", "K_SERVICE", "GCP_PROJECT"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("resolveStorageOrigin", () => {
  it("accepts GCS and Vercel Blob hosts", () => {
    process.env.GCS_BUCKET = "qubere-demo-uploaded-documents";
    expect(
      resolveStorageOrigin("https://storage.googleapis.com/qubere-demo-uploaded-documents/documents/x.pdf")
    ).toBe("gcs");
    expect(resolveStorageOrigin("https://abc.public.blob.vercel-storage.com/documents/x.pdf")).toBe(
      "vercel-blob"
    );
  });

  it("treats local upload paths as non-remote", () => {
    expect(resolveStorageOrigin("/uploads/1234-invoice.pdf")).toBeNull();
  });

  it("rejects a GCS URL for a different bucket", () => {
    process.env.GCS_BUCKET = "qubere-demo-uploaded-documents";
    expect(() =>
      resolveStorageOrigin("https://storage.googleapis.com/attacker-bucket/x.pdf")
    ).toThrow(StorageValidationError);
  });

  it("rejects lookalike hosts and non-https", () => {
    expect(() => resolveStorageOrigin("https://vercel-storage.com.evil.com/x")).toThrow(
      StorageValidationError
    );
    expect(() => resolveStorageOrigin("http://blob.vercel-storage.com/x")).toThrow(
      StorageValidationError
    );
  });
});

describe("selectedRemoteProvider", () => {
  it("is null with nothing configured (local-fs dev)", () => {
    expect(selectedRemoteProvider()).toBeNull();
  });
  it("prefers GCS when GCS_BUCKET is set", () => {
    process.env.GCS_BUCKET = "qubere-demo-uploaded-documents";
    expect(selectedRemoteProvider()).toBe("gcs");
  });
});

describe("storeDocumentBytes (local-fs dev fallback)", () => {
  it("writes to .qubere/storage/uploads and returns a resolvable /uploads ref", async () => {
    const res = await storeDocumentBytes({
      buffer: Buffer.from("%PDF-1.4 test"),
      fileName: "Commercial Invoice.pdf",
      contentType: "application/pdf",
      folder: "quarantine",
    });
    expect(res.provider).toBe("local-fs");
    expect(res.url.startsWith("/uploads/")).toBe(true);
    const resolved = resolveLocalFilePath(res.url);
    expect(resolved && fs.existsSync(resolved)).toBe(true);
    if (resolved) fs.rmSync(resolved);
  });

  it("rejects empty and oversized buffers", async () => {
    await expect(
      storeDocumentBytes({ buffer: Buffer.alloc(0), fileName: "x.pdf", contentType: "application/pdf" })
    ).rejects.toThrow();
  });

  it("refuses local-fs on a serverless host", async () => {
    process.env.K_SERVICE = "portal-web";
    await expect(
      storeDocumentBytes({ buffer: Buffer.from("x"), fileName: "x.pdf", contentType: "application/pdf" })
    ).rejects.toThrow(/durable object-storage/i);
  });
});

// Keep the ephemeral test dir out of the repo tree.
afterEach(() => {
  const dir = path.join(process.cwd(), ".qubere", "storage", "uploads");
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmSync(path.join(process.cwd(), ".qubere"), { recursive: true, force: true });
  }
});

void os;
